import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MCP_SERVER_ENTRY = path.resolve(PROJECT_ROOT, 'src', 'mcp', 'server.js');
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const FAKE_AGY = path.join(FIXTURES_DIR, 'fake-agy.sh');

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

describe('MCP Server Integration Tests', () => {
  it('connects via stdio, lists tools with annotations, validates types before spawn, and executes typed tools from unrelated cwd', async () => {
    const testPort = await getAvailablePort();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-mcp-test-'));
    const unrelatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-unrelated-cwd-'));

    // No HOME overrides! Use AGY_USAGE_RUNTIME_DIR and dynamic allocated port.
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [MCP_SERVER_ENTRY],
      env: {
        ...process.env,
        AGY_USAGE_PORT: `${testPort}`,
        PORT: `${testPort}`,
        AGY_PATH: FAKE_AGY,
        AGY_USAGE_RUNTIME_DIR: tempDir
      },
      cwd: unrelatedCwd
    });

    const client = new Client(
      {
        name: 'mcp-integration-test-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    try {
      await client.connect(transport);

      // 1. List tools and assert annotations
      const { tools } = await client.listTools();
      const toolNames = tools.map(t => t.name);
      assert.ok(toolNames.includes('agy_usage_panel'));
      assert.ok(toolNames.includes('agy_usage_get'));
      assert.ok(toolNames.includes('agy_dashboard_open'));
      assert.ok(toolNames.includes('agy_supervisor_event'));

      for (const t of tools) {
        assert.ok(t.annotations, `Tool ${t.name} must declare annotations`);
        assert.ok(typeof t.annotations.title === 'string');
      }

      const getTool = tools.find(t => t.name === 'agy_usage_get');
      assert.equal(getTool.annotations.readOnlyHint, true);

      // 2. Reject unknown tools BEFORE spawning service
      const unknownRes = await client.callTool({
        name: 'unknown_tool_test',
        arguments: {}
      });
      assert.equal(unknownRes.isError, true);
      assert.ok(unknownRes.content[0].text.includes('Unknown tool'));

      // 3. Reject invalid parameter types BEFORE spawning service
      // Test string "false" for boolean parameter
      const badBoolRes = await client.callTool({
        name: 'agy_usage_get',
        arguments: { force_refresh: 'false' }
      });
      assert.equal(badBoolRes.isError, true);
      assert.ok(badBoolRes.content[0].text.includes('must be a boolean'));

      // Test invalid task parameters
      const badTaskRes = await client.callTool({
        name: 'agy_supervisor_event',
        arguments: { id: '', status: 'running' }
      });
      assert.equal(badTaskRes.isError, true);

      const badUsageRes = await client.callTool({
        name: 'agy_supervisor_event',
        arguments: { id: 'job-1', status: 'running', usage: { inputTokens: -50 } }
      });
      assert.equal(badUsageRes.isError, true);

      // 4. agy_dashboard_open returns structuredContent with URL
      const dashRes = await client.callTool({
        name: 'agy_dashboard_open',
        arguments: {}
      });
      assert.ok(!dashRes.isError);
      assert.ok(dashRes.content[0].text.includes(`${testPort}`));
      assert.ok(dashRes.structuredContent);
      assert.ok(dashRes.structuredContent.url.includes(`${testPort}`));

      // 5. agy_supervisor_event with valid typed args
      const eventRes = await client.callTool({
        name: 'agy_supervisor_event',
        arguments: {
          id: 'test-job-999',
          model: 'gemini-3.8-flash-high',
          status: 'running',
          usage: { inputTokens: 1000, outputTokens: 200 }
        }
      });
      assert.ok(!eventRes.isError);
      assert.ok(eventRes.content[0].text.includes('test-job-999'));
      assert.equal(eventRes.structuredContent.id, 'test-job-999');
      assert.equal(eventRes.structuredContent.status, 'running');
      assert.equal(eventRes.structuredContent.usage.inputTokens, 1000);
      assert.equal(eventRes.structuredContent.usage.outputTokens, 200);

      // 6. agy_usage_get with valid typed args
      const usageRes = await client.callTool({
        name: 'agy_usage_get',
        arguments: { force_refresh: true }
      });
      assert.ok(!usageRes.isError);
      assert.ok(usageRes.content[0].text.includes('Antigravity 配额状态'));
      assert.ok(Array.isArray(usageRes.structuredContent.usage.windows));
      assert.equal(usageRes.structuredContent.usage.windows.length, 4);

    } finally {
      try {
        await transport.close();
      } catch {
        // Ignore
      }

      // Cleanly terminate owned test server process
      try {
        const pidFile = path.join(tempDir, 'server.pid');
        if (fs.existsSync(pidFile)) {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
          if (!isNaN(pid) && pid > 0) {
            try {
              process.kill(pid, 'SIGTERM');
            } catch {
              // Ignore
            }
          }
        }
      } catch {
        // Ignore
      }

      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.rmSync(unrelatedCwd, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }
  });
});
