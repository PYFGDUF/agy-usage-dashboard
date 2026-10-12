import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_ID,
  APP_VERSION,
  DEFAULT_PORT,
  HOST,
  MAX_BODY_SIZE_BYTES,
  PUBLIC_DIR,
  REFRESH_INTERVAL_SECONDS
} from './config.js';
import { QuotaCollector } from './collector.js';
import { TaskStore } from './task-store.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

/**
 * Validates Host header to prevent DNS rebinding.
 */
function isValidHost(hostHeader, serverInstance) {
  if (!hostHeader) return false;
  const host = hostHeader.toLowerCase().trim();
  const match = host.match(/^(127\.0\.0\.1|localhost|\[::1\])(?::(\d+))?$/);
  if (!match) {
    return false;
  }
  const hostPort = match[2] ? parseInt(match[2], 10) : null;
  const actualPort = serverInstance?.address?.()?.port;
  if (hostPort && actualPort && hostPort !== actualPort) {
    return false;
  }
  return true;
}

/**
 * Validates Origin header for state-mutating requests.
 * Rejects foreign loopback ports to prevent cross-port local exploitation.
 */
function isValidOrigin(originHeader, serverInstance) {
  if (!originHeader) {
    // Non-browser clients (MCP server, curl) omit Origin header
    return true;
  }
  let parsed;
  try {
    parsed = new URL(originHeader);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== '[::1]') {
    return false;
  }
  const actualPort = serverInstance?.address?.()?.port;
  if (actualPort) {
    const originPort = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
    if (originPort !== actualPort) {
      return false; // foreign loopback port
    }
  }
  return true;
}

/**
 * Reads and parses JSON body with size bounding.
 * Drains residual socket data on overflow to guarantee HTTP 413 response.
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let bytesRead = 0;
    const chunks = [];
    let exceeded = false;

    req.on('data', chunk => {
      if (exceeded) return;
      bytesRead += chunk.length;
      if (bytesRead > MAX_BODY_SIZE_BYTES) {
        exceeded = true;
        req.resume(); // drain remaining socket stream so connection isn't aborted
        const err = new Error('Payload Too Large');
        err.statusCode = 413;
        return reject(err);
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (exceeded) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        return resolve({});
      }
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch {
        const err = new Error('Invalid JSON');
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on('error', err => {
      if (!exceeded) reject(err);
    });
  });
}

/**
 * Creates and returns the HTTP server instance.
 *
 * @param {Object} [options]
 * @param {number} [options.port]
 * @param {QuotaCollector} [options.collector]
 * @param {TaskStore} [options.taskStore]
 * @param {boolean} [options.startBackgroundPolling=true]
 */
export function createServer(options = {}) {
  const port = options.port || DEFAULT_PORT;
  const taskStore = options.taskStore || new TaskStore();
  const collector = options.collector || new QuotaCollector({ taskStore });
  let pollTimer = null;

  const server = http.createServer(async (req, res) => {
    // Security headers for all responses
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'"
    );

    // 1. Host header validation (DNS rebinding defense)
    const hostHeader = req.headers['host'];
    if (!isValidHost(hostHeader, server)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid Host header' }));
    }

    // Parse URL
    let parsedUrl;
    try {
      parsedUrl = new URL(req.url, `http://${hostHeader || '127.0.0.1'}`);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Malformed request URL' }));
    }

    const pathname = parsedUrl.pathname;

    // 2. Origin check on state-mutating methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.headers['origin'];
      if (!isValidOrigin(origin, server)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Cross-origin request prohibited' }));
      }
    }

    // 3. API Routes
    if (pathname === '/api/health') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        app: APP_ID,
        version: APP_VERSION
      }));
    }

    if (pathname === '/api/status') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      }
      const status = collector.getStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(status));
    }

    if (pathname === '/api/refresh') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      }
      try {
        await readJsonBody(req); // bounded body consumption
        const status = await collector.refresh({ force: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(status));
      } catch (err) {
        const code = err.statusCode || 500;
        res.setHeader('Connection', 'close');
        res.writeHead(code, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message || 'Refresh error' }));
      }
    }

    if (pathname === '/api/tasks') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      }
      try {
        const body = await readJsonBody(req);
        const task = taskStore.recordEvent(body);
        collector.persistState();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, task }));
      } catch (err) {
        const code = err.statusCode || (err.message.includes('Task') ? 400 : 500);
        res.setHeader('Connection', 'close');
        res.writeHead(code, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // 4. Static Files
    if (req.method === 'GET' || req.method === 'HEAD') {
      let relativePath = pathname === '/' ? '/index.html' : pathname;
      // Prevent path traversal
      const safeRelative = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(PUBLIC_DIR, safeRelative);

      // Verify that target path is within PUBLIC_DIR
      if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Forbidden');
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Not Found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stats.size,
          'Cache-Control': 'no-cache'
        });

        if (req.method === 'HEAD') {
          return res.end();
        }

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      });
      return;
    }

    // Other methods
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
  });

  // Background polling manager
  const startBackgroundPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      try {
        await collector.refresh({ force: false });
      } catch {
        // Polling errors handled inside collector
      }
    }, REFRESH_INTERVAL_SECONDS * 1000);
    pollTimer.unref();
  };

  const stopBackgroundPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const originalListen = server.listen.bind(server);
  server.listen = function (listenPort = port, listenHost = HOST, callback) {
    return originalListen(listenPort, listenHost, () => {
      // Record server pid in runtime dir
      try {
        const pidFile = path.join(collector.runtimeDir, 'server.pid');
        fs.writeFileSync(pidFile, String(process.pid), 'utf8');
      } catch {
        // Ignore
      }

      if (options.startBackgroundPolling !== false) {
        startBackgroundPolling();
      }
      // Kick off initial refresh in background
      collector.refresh({ force: false }).catch(() => {});
      if (typeof callback === 'function') callback();
    });
  };

  const originalClose = server.close.bind(server);
  server.close = function (cb) {
    stopBackgroundPolling();
    try {
      const pidFile = path.join(collector.runtimeDir, 'server.pid');
      if (fs.existsSync(pidFile)) {
        const recorded = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
        if (recorded === process.pid) {
          fs.unlinkSync(pidFile);
        }
      }
    } catch {
      // Ignore
    }
    return originalClose(cb);
  };

  return { server, collector, taskStore, port };
}

// If executed directly: start server
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { server, port } = createServer();
  server.listen(port, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`AGY Usage Dashboard running at http://${HOST}:${port}`);
  });
}
