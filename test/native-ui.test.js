import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import net from 'node:net';
import vm from 'node:vm';
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

describe('Native MCP GUI & UI Resource Integration Tests', () => {
  it('verifies native UI resource listing, exact URI read, security isolation, metadata entrypoints, and panel tool execution', async () => {
    const testPort = await getAvailablePort();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-native-ui-state-'));
    const unrelatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-unrelated-cwd-'));

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
        name: 'native-ui-test-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    try {
      await client.connect(transport);

      // 1. Verify resource listing
      const { resources } = await client.listResources();
      assert.ok(Array.isArray(resources), 'Resources list must be an array');
      const panelResource = resources.find(r => r.uri === 'ui://agy-usage/panel.html');
      assert.ok(panelResource, 'Resource ui://agy-usage/panel.html must be advertised');
      assert.equal(panelResource.mimeType, 'text/html;profile=mcp-app');
      assert.equal(panelResource.name, 'AGY 用量');
      assert.ok(panelResource._meta?.ui?.csp, 'Resource must declare CSP metadata');
      assert.deepEqual(panelResource._meta.ui.csp.connectDomains, [], 'connectDomains must be empty');
      assert.deepEqual(panelResource._meta.ui.csp.resourceDomains, [], 'resourceDomains must be empty');

      // 2. Read resource content and verify security & protocol rules
      const readResult = await client.readResource({ uri: 'ui://agy-usage/panel.html' });
      assert.ok(readResult.contents && readResult.contents.length > 0, 'Resource read must return content');
      const resourceContent = readResult.contents[0];
      assert.equal(resourceContent.uri, 'ui://agy-usage/panel.html');
      assert.equal(resourceContent.mimeType, 'text/html;profile=mcp-app');
      assert.ok(typeof resourceContent.text === 'string' && resourceContent.text.length > 100);

      const html = resourceContent.text;

      // Verify self-containment & security isolation (no external fetch, no localhost address, no external scripts)
      assert.equal(html.includes('fetch('), false, 'GUI resource must not use fetch()');
      assert.equal(html.includes('http://127.0.0.1'), false, 'GUI resource must not contain localhost/127.0.0.1');
      assert.equal(html.includes('http://localhost'), false, 'GUI resource must not contain localhost string');
      assert.equal(/<script\s+[^>]*src=/i.test(html), false, 'GUI resource must not contain external scripts');
      assert.equal(/<link\s+[^>]*href=/i.test(html), false, 'GUI resource must not contain external stylesheets');

      // Verify MCP Apps bridge handshake & protocol implementation in GUI
      assert.ok(html.includes('ui/initialize'), 'GUI resource must initiate ui/initialize');
      assert.ok(html.includes('2026-01-26'), 'GUI resource must declare protocolVersion 2026-01-26');
      assert.ok(html.includes('ui/notifications/initialized'), 'GUI resource must notify ui/notifications/initialized');
      assert.ok(html.includes('event.source !== window.parent'), 'GUI resource must verify event.source === window.parent');
      assert.ok(html.includes('jsonrpc'), 'GUI resource must verify JSON-RPC 2.0');
      assert.ok(html.includes('agy_usage_get'), 'GUI resource must request agy_usage_get data');
      assert.ok(html.includes('size-changed'), 'GUI resource must notify size-changed on layout change');
      assert.ok(html.includes('Asia/Shanghai') || html.includes('CST'), 'GUI resource must format Beijing time');

      // 3. Reject unknown resource URI
      await assert.rejects(
        async () => {
          await client.readResource({ uri: 'ui://agy-usage/unknown.html' });
        },
        /Resource not found/
      );

      // 4. Verify tool definitions & GUI metadata
      const { tools } = await client.listTools();
      const panelTool = tools.find(t => t.name === 'agy_usage_panel');
      assert.ok(panelTool, 'Tool agy_usage_panel must be declared');
      assert.equal(panelTool.title, 'AGY 用量');
      assert.equal(panelTool.annotations?.title, 'AGY 用量');
      assert.equal(panelTool.annotations?.readOnlyHint, true);
      assert.equal(panelTool.annotations?.idempotentHint, true);

      // Verify metadata for Codex GUI discovery
      assert.equal(panelTool._meta?.ui?.resourceUri, 'ui://agy-usage/panel.html');
      assert.equal(panelTool._meta?.['openai/widgetAccessible'], true);
      const entrypoints = panelTool._meta?.['openai/ui']?.entrypoints;
      assert.ok(Array.isArray(entrypoints), 'entrypoints must be an array');
      assert.ok(entrypoints.some(e => e.type === 'global'), 'Must include global entrypoint');
      assert.ok(entrypoints.some(e => e.type === 'thread'), 'Must include thread entrypoint');

      // Verify agy_usage_get has visibility for UI calling
      const getTool = tools.find(t => t.name === 'agy_usage_get');
      assert.deepEqual(getTool._meta?.ui?.visibility, ['model', 'app']);

      // 5. Call agy_usage_panel tool and verify typed response
      const panelCallRes = await client.callTool({
        name: 'agy_usage_panel',
        arguments: {}
      });
      assert.equal(panelCallRes.isError, undefined);
      assert.ok(panelCallRes.content && panelCallRes.content.length > 0);
      assert.ok(panelCallRes.content[0].text.includes('AGY 用量监控面板'));
      assert.ok(panelCallRes.structuredContent, 'Must return structuredContent');
      assert.equal(panelCallRes.structuredContent.schemaVersion, 1);
      assert.ok(Array.isArray(panelCallRes.structuredContent.usage?.windows));
      assert.equal(panelCallRes.structuredContent.usage.windows.length, 4);

    } finally {
      try {
        await transport.close();
      } catch {
        // Ignore
      }

      // Cleanup temp server process
      try {
        const pidFile = path.join(tempDir, 'server.pid');
        if (fs.existsSync(pidFile)) {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
          if (!isNaN(pid) && pid > 0) {
            try {
              process.kill(pid, 'SIGTERM');
            } catch {
              // Exited
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

describe('Runtime Bridge node:vm Regression Tests', () => {
  function createHarness() {
    const panelHtmlPath = path.resolve(PROJECT_ROOT, 'src', 'ui', 'panel.html');
    const html = fs.readFileSync(panelHtmlPath, 'utf8');
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    if (!scriptMatch) throw new Error('No script tag found in panel.html');
    const source = scriptMatch[1];

    class MockElement {
      constructor(id = '') {
        this.id = id;
        this.textContent = '';
        this.innerHTML = '';
        this.checked = true;
        this.disabled = false;
        this.offsetWidth = 320;
        this.scrollHeight = 640;
        this.clientWidth = 320;
        this.clientHeight = 640;
        this.events = {};
        this.attributes = new Map();
        this.classList = {
          _classes: new Set(),
          add: (...cls) => cls.forEach(c => this.classList._classes.add(c)),
          remove: (...cls) => cls.forEach(c => this.classList._classes.delete(c)),
          contains: (c) => this.classList._classes.has(c)
        };
      }
      addEventListener(event, fn) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(fn);
      }
      dispatchEvent(event, data = {}) {
        if (this.events[event]) {
          for (const fn of this.events[event]) {
            fn(data);
          }
        }
      }
      setAttribute(name, val) { this.attributes.set(name, String(val)); }
      getAttribute(name) { return this.attributes.get(name) || null; }
      querySelector() { return new MockElement(); }
      querySelectorAll() { return []; }
    }

    const elements = new Map();
    const el = id => {
      if (!elements.has(id)) elements.set(id, new MockElement(id));
      return elements.get(id);
    };

    const output = [];
    const windowListeners = {};
    const docListeners = {};
    const timers = new Map();
    let nextTimer = 1;

    const parent = {
      postMessage(msg) { output.push(msg); }
    };

    class MockResizeObserver {
      constructor(cb) { this.cb = cb; }
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    const mockWindow = {
      parent,
      innerWidth: 320,
      innerHeight: 640,
      addEventListener(event, fn) {
        if (!windowListeners[event]) windowListeners[event] = [];
        windowListeners[event].push(fn);
      },
      ResizeObserver: MockResizeObserver,
      matchMedia: () => ({ matches: false })
    };

    const mockDocument = {
      hidden: false,
      body: el('body'),
      documentElement: el('html'),
      getElementById: el,
      querySelectorAll: () => [],
      addEventListener(event, fn) {
        if (!docListeners[event]) docListeners[event] = [];
        docListeners[event].push(fn);
      }
    };

    const context = {
      window: mockWindow,
      document: mockDocument,
      console,
      Intl,
      Date,
      Map,
      Set,
      Promise,
      Error,
      Number,
      String,
      Math,
      setTimeout(fn, delay) {
        const id = nextTimer++;
        timers.set(id, fn);
        return id;
      },
      clearTimeout(id) { timers.delete(id); },
      setInterval(fn, delay) {
        const id = nextTimer++;
        timers.set(id, fn);
        return id;
      },
      clearInterval(id) { timers.delete(id); }
    };

    vm.runInNewContext(source, context);

    const tick = async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    };

    const dispatch = async (data) => {
      if (windowListeners.message) {
        for (const listener of windowListeners.message) {
          listener({ source: parent, data: { jsonrpc: '2.0', ...data } });
        }
      }
      await tick();
    };

    const status = (p, connErr = null, tasks = []) => ({
      connection: { state: connErr ? 'error' : 'ready', error: connErr },
      usage: {
        windows: [{
          group: 'Gemini',
          window: 'Weekly',
          remainingPercent: p,
          resetsAt: '2030-10-15T00:00:00Z'
        }],
        stale: false,
        updatedAt: new Date().toISOString()
      },
      tasks
    });

    return {
      el,
      output,
      timers,
      windowListeners,
      docListeners,
      dispatch,
      tick,
      status
    };
  }

  it('renders direct notification with 0% quota and handles isError banner', async () => {
    const h = createHarness();
    const init = h.output.find(x => x.method === 'ui/initialize');
    assert.ok(init, 'App should send ui/initialize');
    assert.equal(init.params.appInfo.version, '1.1.0', 'appInfo version should be 1.1.0');

    await h.dispatch({
      id: init.id,
      result: {
        protocolVersion: '2026-01-26',
        hostCapabilities: {},
        hostContext: { theme: 'dark' }
      }
    });

    const toolCall = h.output.find(x => x.method === 'tools/call');
    assert.ok(toolCall, 'App should call tools/call');
    await h.dispatch({ id: toolCall.id, result: { structuredContent: h.status(80) } });

    // Host sends direct tool-result notification with 0%
    await h.dispatch({
      method: 'ui/notifications/tool-result',
      params: { structuredContent: h.status(0), content: [] }
    });
    assert.ok(h.el('quota-grid').innerHTML.includes('>0%</span>'), '0% quota window must be rendered');
    assert.ok(h.el('quota-grid').innerHTML.includes('剩余 0%'), 'progressbar aria-label should indicate 0%');

    // Host sends tool-result notification with isError: true
    await h.dispatch({
      method: 'ui/notifications/tool-result',
      params: { isError: true, content: [{ text: '宿主工具调用失败' }] }
    });
    assert.equal(h.el('error-banner').classList.contains('hidden'), false, 'Error banner must be visible');
    assert.equal(h.el('error-message').textContent, '宿主工具调用失败');
  });

  it('acknowledges ui/resource-teardown, stops all timers, disposes state, and ignores late init/events', async () => {
    const h = createHarness();
    const init = h.output.find(x => x.method === 'ui/initialize');
    await h.dispatch({
      id: init.id,
      result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} }
    });
    const toolCall = h.output.find(x => x.method === 'tools/call');
    await h.dispatch({ id: toolCall.id, result: { structuredContent: h.status(50) } });

    assert.ok(h.timers.size > 0, 'Timers should be running before teardown');

    // Send teardown request
    await h.dispatch({ id: 800, method: 'ui/resource-teardown', params: {} });

    // Assert acknowledgement
    const teardownAck = h.output.find(x => x.id === 800 && x.result && !x.error);
    assert.ok(teardownAck, 'ui/resource-teardown must be acknowledged with result: {}');
    assert.equal(JSON.stringify(teardownAck.result), '{}');
    assert.equal(h.timers.size, 0, 'No timers should remain after teardown');

    const outputLenBeforeEvents = h.output.length;

    // Attempt user interactions after disposal
    h.el('refresh-btn').dispatchEvent('click');
    h.el('auto-refresh-toggle').dispatchEvent('change');
    if (h.docListeners.visibilitychange) {
      for (const fn of h.docListeners.visibilitychange) fn({});
    }
    await h.tick();

    assert.equal(h.output.length, outputLenBeforeEvents, 'No new messages sent after disposal');
    assert.equal(h.timers.size, 0, 'No new timers created after disposal');

    // Late tool notification after disposal should be ignored
    await h.dispatch({
      method: 'ui/notifications/tool-result',
      params: { structuredContent: h.status(100) }
    });
    assert.ok(!h.el('quota-grid').innerHTML.includes('>100%</span>'), 'Late data after disposal must be ignored');
  });

  it('handles late initialize response after early teardown without restarting', async () => {
    const h = createHarness();
    const init = h.output.find(x => x.method === 'ui/initialize');

    // Teardown before init response arrives
    await h.dispatch({ id: 750, method: 'ui/resource-teardown', params: {} });
    assert.ok(h.output.some(x => x.id === 750 && x.result));
    assert.equal(h.timers.size, 0);

    // Late initialize response
    await h.dispatch({
      id: init.id,
      result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} }
    });

    assert.ok(!h.output.some(x => x.method === 'ui/notifications/initialized'), 'Must not notify initialized after disposal');
    assert.equal(h.timers.size, 0, 'Must not start timers on late initialize');
  });

  it('responds with -32601 for unknown host requests and handles request ID collisions safely', async () => {
    const h = createHarness();
    const init = h.output.find(x => x.method === 'ui/initialize');

    // Host sends unknown request
    await h.dispatch({ id: 999, method: 'custom/unknown-method', params: {} });
    const unknownRes = h.output.find(x => x.id === 999);
    assert.ok(unknownRes, 'Must respond to unknown host request');
    assert.equal(unknownRes.error?.code, -32601, 'Must return error code -32601');

    // Host sends incoming request with colliding ID matching client pending request (e.g. init.id)
    // It must NOT resolve init promise with error/result
    await h.dispatch({ id: init.id, method: 'custom/host-request', params: {} });
    const collisionRes = h.output.find(x => x.id === init.id && x.error?.code === -32601);
    assert.ok(collisionRes, 'Host request with method must be answered as host request, not client response');

    // Now properly resolve client init request
    await h.dispatch({
      id: init.id,
      result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} }
    });
    assert.ok(h.output.some(x => x.method === 'ui/notifications/initialized'), 'Client request resolves correctly');
  });

  it('keeps inFlight and disables manual button during tools/call despite unrelated host notifications', async () => {
    const h = createHarness();
    const init = h.output.find(x => x.method === 'ui/initialize');
    await h.dispatch({
      id: init.id,
      result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} }
    });

    const initialToolCall = h.output.find(x => x.method === 'tools/call');
    await h.dispatch({ id: initialToolCall.id, result: { structuredContent: h.status(70) } });

    // User clicks manual refresh button
    h.el('refresh-btn').dispatchEvent('click');
    await h.tick();

    assert.equal(h.el('refresh-btn').disabled, true, 'Refresh button must be disabled while in flight');
    assert.ok(h.el('refresh-btn-text').textContent.includes('刷新中'), 'Refresh button text must show 刷新中');

    const toolsCalls = h.output.filter(x => x.method === 'tools/call');
    assert.equal(toolsCalls.length, 2, 'Second tools/call dispatched for manual refresh');
    const manualCall = toolsCalls[1];
    assert.equal(manualCall.params.arguments.force_refresh, true);

    // Host sends unrelated tool-result notification
    await h.dispatch({
      method: 'ui/notifications/tool-result',
      params: { structuredContent: h.status(60) }
    });
    assert.equal(h.el('refresh-btn').disabled, true, 'Refresh button must still be disabled');
    assert.ok(h.el('refresh-btn-text').textContent.includes('刷新中'), 'Refresh button text must stay 刷新中');

    // Host sends unrelated tool-cancelled notification
    await h.dispatch({
      method: 'ui/notifications/tool-cancelled',
      params: {}
    });
    assert.equal(h.el('refresh-btn').disabled, true, 'Refresh button must remain disabled');

    // Second click during in flight must be ignored
    h.el('refresh-btn').dispatchEvent('click');
    await h.tick();
    assert.equal(h.output.filter(x => x.method === 'tools/call').length, 2, 'No duplicate tools/call while pending');

    // Correlated response arrives
    await h.dispatch({
      id: manualCall.id,
      result: { structuredContent: h.status(100) }
    });
    assert.ok(h.el('refresh-btn-text').textContent.includes('冷却中'), 'Button switches to cooldown after completion');
  });

  it('renders status.connection.error as visible banner and preserves cached quota data', async () => {
    const h = createHarness();
    const init = h.output.find(x => x.method === 'ui/initialize');
    await h.dispatch({
      id: init.id,
      result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} }
    });

    const initialToolCall = h.output.find(x => x.method === 'tools/call');
    // First load with normal status
    await h.dispatch({ id: initialToolCall.id, result: { structuredContent: h.status(40) } });
    assert.equal(h.el('error-banner').classList.contains('hidden'), true);
    assert.ok(h.el('quota-grid').innerHTML.includes('>40%</span>'));

    // Host delivers status with connection error
    await h.dispatch({
      method: 'ui/notifications/tool-result',
      params: { structuredContent: h.status(40, 'CLI 后台服务离线') }
    });

    assert.equal(h.el('error-banner').classList.contains('hidden'), false, 'Error banner must be visible on connection error');
    assert.equal(h.el('error-message').textContent, 'CLI 后台服务离线');
    assert.ok(h.el('quota-grid').innerHTML.includes('>40%</span>'), 'Cached quota windows must be preserved');
    assert.ok(h.el('conn-badge').classList.contains('badge-error'), 'Connection badge should show error style');

    // Next update recovers without connection error
    await h.dispatch({
      method: 'ui/notifications/tool-result',
      params: { structuredContent: h.status(50, null) }
    });
    assert.equal(h.el('error-banner').classList.contains('hidden'), true, 'Error banner should be hidden when recovered');
    assert.ok(h.el('quota-grid').innerHTML.includes('>50%</span>'));
  });

  it('renders task tokens with canonical and snake_case exact fields, shows 未提供 when absent, and distinguishes numeric 0', async () => {
    const h = createHarness();
    const init = h.output.find(x => x.method === 'ui/initialize');
    await h.dispatch({
      id: init.id,
      result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} }
    });

    const initialToolCall = h.output.find(x => x.method === 'tools/call');

    const tasks = [
      {
        id: 'task-canonical',
        model: 'gemini-3.8-flash-high',
        status: 'completed',
        usage: { inputTokens: 1250, outputTokens: 340 }
      },
      {
        id: 'task-bridge',
        model: 'gemini-3.8-flash-high',
        status: 'completed',
        usage: { input_tokens: 4500, output_tokens: 800 }
      },
      {
        id: 'task-zero',
        model: 'gemini-3.8-flash-high',
        status: 'completed',
        usage: { inputTokens: 0, outputTokens: 0 }
      },
      {
        id: 'task-partial-zero',
        model: 'gemini-3.8-flash-high',
        status: 'running',
        usage: { input_tokens: 0 }
      },
      {
        id: 'task-absent-1',
        model: 'gemini-3.8-flash-high',
        status: 'queued'
      },
      {
        id: 'task-absent-2',
        model: 'gemini-3.8-flash-high',
        status: 'running',
        usage: {}
      }
    ];

    await h.dispatch({
      id: initialToolCall.id,
      result: { structuredContent: h.status(60, null, tasks) }
    });

    const tableHtml = h.el('tasks-body').innerHTML;
    assert.equal(h.el('tasks-count').textContent, '6');
    assert.equal(h.el('tasks-table-wrap').classList.contains('hidden'), false);
    assert.equal(h.el('tasks-empty').classList.contains('hidden'), true);

    // 1. Canonical tokens rendered
    assert.ok(tableHtml.includes('1,250 / 340'), 'Canonical inputTokens/outputTokens must render');

    // 2. Bridge snake_case tokens rendered
    assert.ok(tableHtml.includes('4,500 / 800'), 'Bridge input_tokens/output_tokens must render');

    // 3. Numeric zero rendered as '0 / 0' (not '未提供')
    assert.ok(tableHtml.includes('<td>0 / 0</td>'), 'Exact zero tokens must render as 0 / 0');

    // 4. Partial zero rendered with 未提供 for absent side
    assert.ok(tableHtml.includes('<td>0 / 未提供</td>'), 'Partial count must display 0 and 未提供 for absent side');

    // 5. Absent counts rendered as '未提供'
    assert.ok(tableHtml.includes('<td>未提供</td>'), 'Absent usage must display 未提供');
  });
});
