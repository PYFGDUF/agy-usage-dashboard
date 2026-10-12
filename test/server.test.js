import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/server.js';
import { QuotaCollector } from '../src/collector.js';
import { TaskStore } from '../src/task-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const FAKE_AGY = path.join(FIXTURES_DIR, 'fake-agy.sh');
const PACKAGE_VERSION = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')).version;

describe('HTTP Server & Security Defense Tests', () => {
  let serverInstance;
  let port;
  let tempDir;

  function doRequest(options, bodyData = null) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: options.path,
          method: options.method || 'GET',
          headers: {
            Host: `127.0.0.1:${port}`,
            ...options.headers
          }
        },
        res => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body
            });
          });
        }
      );
      req.on('error', reject);
      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    });
  }

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-server-test-'));
    const stateFile = path.join(tempDir, 'state.json');

    const taskStore = new TaskStore({ stateFile });
    const collector = new QuotaCollector({
      agyPath: FAKE_AGY,
      runtimeDir: tempDir,
      stateFile,
      taskStore
    });

    // Use ephemeral port 0
    serverInstance = createServer({
      port: 0,
      collector,
      taskStore,
      startBackgroundPolling: false
    });

    await new Promise(resolve => {
      serverInstance.server.listen(0, '127.0.0.1', () => {
        port = serverInstance.server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise(resolve => serverInstance.server.close(resolve));
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('GET /api/health returns app identification', async () => {
    const res = await doRequest({ path: '/api/health' });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.status, 'ok');
    assert.equal(json.app, 'agy-usage-dashboard');
    assert.equal(json.version, PACKAGE_VERSION);
  });

  it('GET /api/status returns valid schemaVersion 1 response', async () => {
    const res = await doRequest({ path: '/api/status' });
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.schemaVersion, 1);
    assert.ok(json.connection);
    assert.ok(json.usage);
    assert.ok(Array.isArray(json.tasks));
  });

  it('POST /api/refresh performs quota refresh', async () => {
    const res = await doRequest(
      { path: '/api/refresh', method: 'POST' },
      JSON.stringify({})
    );
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.connection.state, 'ready');
    assert.equal(json.usage.windows.length, 4);
  });

  it('POST /api/tasks records new and updated task events', async () => {
    // 1. Create task
    const postRes = await doRequest(
      {
        path: '/api/tasks',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      JSON.stringify({
        id: 'task-test-01',
        model: 'gemini-3.8-flash-high',
        status: 'running',
        usage: { inputTokens: 500 }
      })
    );
    assert.equal(postRes.statusCode, 200);
    const postJson = JSON.parse(postRes.body);
    assert.equal(postJson.ok, true);
    assert.equal(postJson.task.id, 'task-test-01');
    assert.equal(postJson.task.status, 'running');

    // 2. Verify via /api/status
    const statusRes = await doRequest({ path: '/api/status' });
    const statusJson = JSON.parse(statusRes.body);
    assert.ok(statusJson.tasks.some(t => t.id === 'task-test-01'));
  });

  it('POST /api/tasks rejects invalid task input', async () => {
    const res = await doRequest(
      {
        path: '/api/tasks',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      JSON.stringify({ id: '', status: 'invalid' })
    );
    assert.equal(res.statusCode, 400);
  });

  it('blocks DNS rebinding with invalid Host header', async () => {
    const res = await doRequest({
      path: '/api/health',
      headers: { Host: 'malicious.attacker.com' }
    });
    assert.equal(res.statusCode, 400);
    const json = JSON.parse(res.body);
    assert.equal(json.error, 'Invalid Host header');
  });

  it('blocks cross-origin POST requests with external Origin header', async () => {
    const res = await doRequest({
      path: '/api/tasks',
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Origin: 'https://evil-website.com'
      }
    });
    assert.equal(res.statusCode, 403);
    const json = JSON.parse(res.body);
    assert.equal(json.error, 'Cross-origin request prohibited');
  });

  it('blocks cross-origin POST requests with foreign loopback port in Origin header', async () => {
    const foreignPort = port === 9999 ? 9998 : 9999;
    const res = await doRequest({
      path: '/api/tasks',
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Origin: `http://127.0.0.1:${foreignPort}`,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({ id: 'task-foreign', status: 'running' }));
    assert.equal(res.statusCode, 403);
    const json = JSON.parse(res.body);
    assert.equal(json.error, 'Cross-origin request prohibited');
  });

  it('allows same-origin POST requests matching server port', async () => {
    const res = await doRequest({
      path: '/api/tasks',
      method: 'POST',
      headers: {
        Host: `127.0.0.1:${port}`,
        Origin: `http://127.0.0.1:${port}`,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({ id: 'task-same-origin', status: 'running' }));
    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.ok, true);
  });

  it('rejects oversized payloads with 413 Payload Too Large', async () => {
    const hugeBody = 'x'.repeat(120 * 1024); // 120KB > 100KB limit
    const res = await doRequest(
      {
        path: '/api/tasks',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      hugeBody
    );
    assert.equal(res.statusCode, 413);
  });

  it('prevents path traversal attacks on static routes', async () => {
    const res = await doRequest({
      path: '/../../package.json'
    });
    // Either 403 Forbidden or 404 Not Found, never 200 with source files
    assert.ok([403, 404].includes(res.statusCode));
  });

  it('serves static files correctly with security headers', async () => {
    const res = await doRequest({ path: '/' });
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.body.includes('AGY'));
  });
});
