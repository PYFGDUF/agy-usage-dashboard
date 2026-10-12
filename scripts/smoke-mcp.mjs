#!/usr/bin/env node

/**
 * Isolated Smoke test for AGY stdio MCP Server using the official MCP SDK Client.
 *
 * Verifies:
 * 1. Dedicated temporary state dir (AGY_USAGE_RUNTIME_DIR) & fixture executable (FAKE_AGY)
 * 2. Dynamically allocated ephemeral port to guarantee test isolation
 * 3. Stdio transport connection & initialize
 * 4. Tool listing (agy_usage_get, agy_dashboard_open, agy_supervisor_event)
 * 5. Calling agy_dashboard_open (assert !isError & structuredContent)
 * 6. Calling agy_supervisor_event (assert !isError & structuredContent)
 * 7. Calling agy_usage_get (assert !isError & structuredContent)
 * 8. Clean shutdown of owned test server process & directory cleanup
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MCP_SERVER_ENTRY = path.resolve(PROJECT_ROOT, 'src', 'mcp', 'server.js');
const FAKE_AGY = path.resolve(PROJECT_ROOT, 'test', 'fixtures', 'fake-agy.sh');

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

async function runSmokeTest() {
  console.log('🔄 正在准备隔离测试环境与动态分配端口...');
  const testPort = await getAvailablePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-smoke-test-'));

  console.log(`  - 隔离运行目录: ${tempDir}`);
  console.log(`  - 动态测试端口: ${testPort}`);
  console.log(`  - 仿真 CLI 路径: ${FAKE_AGY}`);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MCP_SERVER_ENTRY],
    env: {
      ...process.env,
      AGY_PATH: FAKE_AGY,
      AGY_USAGE_PORT: String(testPort),
      PORT: String(testPort),
      AGY_USAGE_RUNTIME_DIR: tempDir
    }
  });

  const client = new Client(
    {
      name: 'smoke-test-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  try {
    await client.connect(transport);
    console.log('✅ MCP 客户端已成功通过 stdio 连接并完成握手');

    // 1. List tools and annotations
    const { tools } = await client.listTools();
    const toolNames = tools.map(t => t.name);
    console.log('✅ 获取可用工具列表:', toolNames.join(', '));

    assert.ok(toolNames.includes('agy_usage_get'), '缺少 agy_usage_get 工具');
    assert.ok(toolNames.includes('agy_dashboard_open'), '缺少 agy_dashboard_open 工具');
    assert.ok(toolNames.includes('agy_supervisor_event'), '缺少 agy_supervisor_event 工具');

    const usageTool = tools.find(t => t.name === 'agy_usage_get');
    assert.ok(usageTool.annotations, 'agy_usage_get 应包含 annotations');
    assert.equal(usageTool.annotations.readOnlyHint, true);

    // 2. Call agy_dashboard_open
    const dashboardResult = await client.callTool({
      name: 'agy_dashboard_open',
      arguments: {}
    });
    assert.ok(!dashboardResult.isError, 'agy_dashboard_open 执行报错');
    assert.ok(dashboardResult.structuredContent, '缺少 structuredContent');
    assert.ok(dashboardResult.structuredContent.url.includes(String(testPort)));
    console.log('✅ agy_dashboard_open 校验通过 (结构化 URL 与状态就绪)');

    // 3. Call agy_supervisor_event
    const eventResult = await client.callTool({
      name: 'agy_supervisor_event',
      arguments: {
        id: 'smoke-job-101',
        model: 'gemini-3.8-flash-high',
        status: 'running',
        usage: { inputTokens: 450, outputTokens: 80 }
      }
    });
    assert.ok(!eventResult.isError, 'agy_supervisor_event 执行报错');
    assert.ok(eventResult.structuredContent, '缺少 structuredContent');
    assert.equal(eventResult.structuredContent.id, 'smoke-job-101');
    assert.equal(eventResult.structuredContent.model, 'gemini-3.8-flash-high');
    assert.equal(eventResult.structuredContent.status, 'running');
    assert.equal(eventResult.structuredContent.usage.inputTokens, 450);
    console.log('✅ agy_supervisor_event 校验通过 (显式任务结构化断言成功)');

    // 4. Call agy_usage_get
    const usageResult = await client.callTool({
      name: 'agy_usage_get',
      arguments: {
        force_refresh: true
      }
    });
    assert.ok(!usageResult.isError, 'agy_usage_get 执行报错');
    assert.ok(usageResult.structuredContent, '缺少 structuredContent');
    assert.equal(usageResult.structuredContent.schemaVersion, 1);
    assert.equal(usageResult.structuredContent.connection.state, 'ready');
    assert.ok(Array.isArray(usageResult.structuredContent.usage.windows));
    assert.equal(usageResult.structuredContent.usage.windows.length, 4);
    console.log('✅ agy_usage_get 校验通过 (配额窗口结构化断言成功，共 4 个窗口)');

    console.log('🎉 所有 MCP 烟雾测试项均已顺利通过！');
  } finally {
    try {
      await transport.close();
    } catch {
      // Ignore
    }

    // Cleanly terminate owned child server process
    try {
      const pidFile = path.join(tempDir, 'server.pid');
      if (fs.existsSync(pidFile)) {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
        if (!isNaN(pid) && pid > 0) {
          try {
            process.kill(pid, 'SIGTERM');
          } catch {
            // Already exited
          }
        }
      }
    } catch {
      // Ignore
    }

    // Cleanup isolated temp dir
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  }
}

runSmokeTest().catch(err => {
  console.error('❌ MCP 烟雾测试失败:', err);
  process.exit(1);
});
