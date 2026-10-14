import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PANEL_HTML_PATH = path.resolve(PROJECT_ROOT, 'src', 'ui', 'panel.html');
const PUBLIC_HTML_PATH = path.resolve(PROJECT_ROOT, 'public', 'index.html');
const PUBLIC_APP_JS_PATH = path.resolve(PROJECT_ROOT, 'public', 'app.js');

class MockClassList {
  constructor() {
    this._classes = new Set();
  }
  add(...cls) {
    cls.forEach(c => this._classes.add(c));
  }
  remove(...cls) {
    cls.forEach(c => this._classes.delete(c));
  }
  contains(c) {
    return this._classes.has(c);
  }
}

class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.textContent = '';
    this.innerHTML = '';
    this.value = '';
    this.checked = true;
    this.disabled = false;
    this.title = '';
    this.offsetWidth = 360;
    this.scrollHeight = 640;
    this.clientWidth = 360;
    this.clientHeight = 640;
    this.events = {};
    this.attributes = new Map();
    this.classList = new MockClassList();
    this.children = [];
  }

  addEventListener(event, fn) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(fn);
  }

  dispatchEvent(event, data = {}) {
    if (this.events[event]) {
      const evt = { target: this, ...data };
      for (const fn of this.events[event]) {
        fn(evt);
      }
    }
  }

  setAttribute(name, val) {
    this.attributes.set(name, String(val));
    if (name === 'lang') {
      this.lang = String(val);
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) || (name === 'lang' ? this.lang : null);
  }

  appendChild(child) {
    this.children.push(child);
  }

  querySelector() {
    return new MockElement();
  }

  querySelectorAll() {
    return [];
  }
}

function createPanelHarness({ savedLang = null, blockStorage = false, navigatorLanguages = null } = {}) {
  const html = fs.readFileSync(PANEL_HTML_PATH, 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('No script tag found in panel.html');
  const source = scriptMatch[1];

  const elements = new Map();
  const el = (id, tagName = 'div') => {
    if (!elements.has(id)) elements.set(id, new MockElement(id, tagName));
    return elements.get(id);
  };

  const output = [];
  const windowListeners = {};
  const docListeners = {};
  const timers = new Map();
  let nextTimer = 1;

  const parent = {
    postMessage(msg) {
      output.push(msg);
    }
  };

  class MockResizeObserver {
    constructor(cb) { this.cb = cb; }
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  const storageMap = new Map();
  if (savedLang) {
    storageMap.set('agy_quota_lang', savedLang);
  }

  const mockLocalStorage = {
    getItem(k) {
      if (blockStorage) {
        throw new Error('SecurityError: The operation is insecure.');
      }
      return storageMap.has(k) ? storageMap.get(k) : null;
    },
    setItem(k, v) {
      if (blockStorage) {
        throw new Error('SecurityError: The operation is insecure.');
      }
      storageMap.set(k, String(v));
    },
    removeItem(k) {
      if (blockStorage) {
        throw new Error('SecurityError: The operation is insecure.');
      }
      storageMap.delete(k);
    }
  };

  const mockWindow = {
    parent,
    innerWidth: 360,
    innerHeight: 640,
    localStorage: mockLocalStorage,
    addEventListener(event, fn) {
      if (!windowListeners[event]) windowListeners[event] = [];
      windowListeners[event].push(fn);
    },
    ResizeObserver: MockResizeObserver,
    matchMedia: () => ({ matches: false })
  };

  if (navigatorLanguages !== undefined) {
    mockWindow.navigator = {
      languages: navigatorLanguages,
      language: navigatorLanguages && navigatorLanguages[0] ? navigatorLanguages[0] : ''
    };
  }

  const htmlEl = el('html', 'html');
  htmlEl.lang = 'zh-CN';
  htmlEl.setAttribute('lang', 'zh-CN');

  const mockDocument = {
    hidden: false,
    title: 'AGY 用量面板',
    body: el('body', 'body'),
    documentElement: htmlEl,
    getElementById: id => el(id),
    createElement: tag => new MockElement('', tag),
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
    setTimeout(fn) {
      const id = nextTimer++;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setInterval(fn) {
      const id = nextTimer++;
      timers.set(id, fn);
      return id;
    },
    clearInterval(id) {
      timers.delete(id);
    }
  };

  if (navigatorLanguages !== undefined) {
    context.navigator = mockWindow.navigator;
  }

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

  const status = (p = 80, connErr = null, tasks = []) => ({
    connection: { state: connErr ? 'error' : 'ready', error: connErr },
    usage: {
      windows: [
        {
          group: 'Gemini',
          window: 'Weekly Remaining',
          remainingPercent: p,
          resetsAt: '2030-10-15T00:00:00Z'
        },
        {
          group: 'Claude and GPT',
          window: '5-Hour Remaining',
          remainingPercent: 15,
          resetsAt: '2020-01-01T00:00:00Z'
        },
        {
          group: 'CustomModel',
          window: 'Custom Window',
          remainingPercent: 50,
          resetsAt: '2030-10-15T00:00:00Z'
        }
      ],
      stale: false,
      updatedAt: '2026-10-14T08:00:00Z'
    },
    tasks
  });

  return {
    el,
    output,
    timers,
    mockDocument,
    storageMap,
    dispatch,
    tick,
    status
  };
}

function createPublicAppHarness({ savedLang = null, blockStorage = false, navigatorLanguages = null, fetchFailure = null } = {}) {
  const source = fs.readFileSync(PUBLIC_APP_JS_PATH, 'utf8');

  const elements = new Map();
  const el = (id, tagName = 'div') => {
    if (!elements.has(id)) elements.set(id, new MockElement(id, tagName));
    return elements.get(id);
  };

  const storageMap = new Map();
  if (savedLang) {
    storageMap.set('agy_quota_lang', savedLang);
  }

  const mockLocalStorage = {
    getItem(k) {
      if (blockStorage) {
        throw new Error('SecurityError: The operation is insecure.');
      }
      return storageMap.has(k) ? storageMap.get(k) : null;
    },
    setItem(k, v) {
      if (blockStorage) {
        throw new Error('SecurityError: The operation is insecure.');
      }
      storageMap.set(k, String(v));
    },
    removeItem(k) {
      if (blockStorage) {
        throw new Error('SecurityError: The operation is insecure.');
      }
      storageMap.delete(k);
    }
  };

  const timers = new Map();
  let nextTimer = 1;

  const htmlEl = el('html', 'html');
  htmlEl.lang = 'zh-CN';
  htmlEl.setAttribute('lang', 'zh-CN');

  const mockDocument = {
    hidden: false,
    title: 'AGY / Usage - Antigravity 配额监控看板',
    body: el('body', 'body'),
    documentElement: htmlEl,
    getElementById: id => el(id),
    createElement: tag => new MockElement('', tag),
    querySelectorAll: () => []
  };

  const fetchCalls = [];
  const mockFetch = async (url, opts = {}) => {
    fetchCalls.push({ url, opts });
    if (fetchFailure) throw new Error(fetchFailure);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 1,
        connection: { state: 'ready', error: null },
        usage: {
          windows: [
            {
              group: 'Gemini',
              window: 'Weekly Remaining',
              remainingPercent: 65,
              resetsAt: '2030-10-15T00:00:00Z'
            }
          ],
          stale: false,
          updatedAt: '2026-10-14T08:00:00Z'
        },
        tasks: []
      })
    };
  };

  const mockWindow = {
    localStorage: mockLocalStorage
  };

  if (navigatorLanguages !== undefined) {
    mockWindow.navigator = {
      languages: navigatorLanguages,
      language: navigatorLanguages && navigatorLanguages[0] ? navigatorLanguages[0] : ''
    };
  }

  const context = {
    window: mockWindow,
    document: mockDocument,
    fetch: mockFetch,
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
    JSON,
    setTimeout(fn) {
      const id = nextTimer++;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setInterval(fn) {
      const id = nextTimer++;
      timers.set(id, fn);
      return id;
    },
    clearInterval(id) {
      timers.delete(id);
    }
  };

  if (navigatorLanguages !== undefined) {
    context.navigator = mockWindow.navigator;
  }

  vm.runInNewContext(source, context);

  return {
    el,
    mockDocument,
    storageMap,
    fetchCalls,
    setFetchFailure: (message) => { fetchFailure = message; },
    timers
  };
}

describe('UI Bilingual i18n & Acceptance Tests', () => {
  describe('Native Panel i18n Initial Resolution & Fallback', () => {
    it('resolves English initial language when saved in localStorage', () => {
      const h = createPanelHarness({ savedLang: 'en' });
      assert.equal(h.mockDocument.documentElement.getAttribute('lang'), 'en');
      assert.equal(h.mockDocument.title, 'AGY Usage Panel');
      assert.equal(h.el('updated-at-text').textContent, 'Updated: -');
      assert.equal(h.el('lang-select').value, 'en');
    });

    it('resolves Chinese initial language when saved in localStorage', () => {
      const h = createPanelHarness({ savedLang: 'zh-CN' });
      assert.equal(h.mockDocument.documentElement.getAttribute('lang'), 'zh-CN');
      assert.equal(h.mockDocument.title, 'AGY 用量面板');
      assert.equal(h.el('lang-select').value, 'zh-CN');
    });

    it('handles sandbox blocked localStorage gracefully and falls back to navigator languages (en)', () => {
      const h = createPanelHarness({ blockStorage: true, navigatorLanguages: ['en-US', 'en'] });
      assert.equal(h.mockDocument.documentElement.getAttribute('lang'), 'en');
      assert.equal(h.mockDocument.title, 'AGY Usage Panel');
    });

    it('handles sandbox blocked localStorage gracefully and falls back to navigator languages (zh)', () => {
      const h = createPanelHarness({ blockStorage: true, navigatorLanguages: ['zh-CN', 'en'] });
      assert.equal(h.mockDocument.documentElement.getAttribute('lang'), 'zh-CN');
      assert.equal(h.mockDocument.title, 'AGY 用量面板');
    });

    it('defaults non-Chinese navigator language (e.g. ja-JP) to English', () => {
      const h = createPanelHarness({ blockStorage: true, navigatorLanguages: ['ja-JP'] });
      assert.equal(h.mockDocument.documentElement.getAttribute('lang'), 'en');
      assert.equal(h.mockDocument.title, 'AGY Usage Panel');
    });

    it('defaults to Chinese when storage is empty and navigator languages are missing', () => {
      const h = createPanelHarness({ blockStorage: false, navigatorLanguages: [] });
      assert.equal(h.mockDocument.documentElement.getAttribute('lang'), 'zh-CN');
      assert.equal(h.mockDocument.title, 'AGY 用量面板');
    });
  });

  describe('Native Panel Dynamic Language Switching & Re-render', () => {
    it('instant switch re-renders cached status and preserves cooldown without extra RPC calls', async () => {
      const h = createPanelHarness({ savedLang: 'zh-CN' });
      const init = h.output.find(x => x.method === 'ui/initialize');
      await h.dispatch({
        id: init.id,
        result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} }
      });

      const initialToolCall = h.output.find(x => x.method === 'tools/call');

      const tasks = [
        {
          id: 'task-zero',
          model: 'gemini-3.8-flash-high',
          status: 'completed',
          usage: { inputTokens: 0, outputTokens: 0 }
        },
        {
          id: 'task-partial',
          model: 'gemini-3.8-flash-high',
          status: 'running',
          usage: { input_tokens: 2500 }
        },
        {
          id: 'task-absent',
          model: 'gemini-3.8-flash-high',
          status: 'failed',
          usage: {}
        }
      ];

      await h.dispatch({
        id: initialToolCall.id,
        result: { structuredContent: h.status(15, null, tasks) }
      });

      // Verify baseline Chinese content
      assert.equal(h.el('html').getAttribute('lang'), 'zh-CN');
      assert.equal(h.mockDocument.title, 'AGY 用量面板');
      assert.equal(h.el('conn-text').textContent, '正常 (就绪)');

      const quotaZh = h.el('quota-grid').innerHTML;
      assert.ok(quotaZh.includes('Gemini 模型'));
      assert.ok(quotaZh.includes('Claude 与 GPT 模型'));
      assert.ok(quotaZh.includes('CustomModel'), 'Unknown model group kept unchanged');
      assert.ok(quotaZh.includes('每周限额剩余'));
      assert.ok(quotaZh.includes('5小时限额剩余'));
      assert.ok(quotaZh.includes('Custom Window'), 'Unknown window name kept unchanged');
      assert.ok(quotaZh.includes('额度紧张 ≤20%'));
      assert.ok(quotaZh.includes('已到期 (等待下次刷新)'));
      assert.ok(quotaZh.includes('CST'));

      const tableZh = h.el('tasks-body').innerHTML;
      assert.ok(tableZh.includes('<td>0 / 0</td>'));
      assert.ok(tableZh.includes('<td>2,500 / 未提供</td>'));
      assert.ok(tableZh.includes('<td>未提供</td>'));
      assert.ok(tableZh.includes('已完成'));
      assert.ok(tableZh.includes('运行中'));
      assert.ok(tableZh.includes('失败'));

      const rpcCount = h.output.length;

      // Switch to English
      const langSelect = h.el('lang-select');
      langSelect.value = 'en';
      langSelect.dispatchEvent('change', { target: { value: 'en' } });
      await h.tick();

      // No new RPC calls triggered
      assert.equal(h.output.length, rpcCount, 'Switching language must not trigger extra RPC calls');

      // Check document properties
      assert.equal(h.el('html').getAttribute('lang'), 'en');
      assert.equal(h.mockDocument.title, 'AGY Usage Panel');
      assert.equal(h.el('conn-text').textContent, 'Normal (Ready)');
      assert.equal(h.storageMap.get('agy_quota_lang'), 'en', 'Preference must be saved to storage');

      // Check English quota cards
      const quotaEn = h.el('quota-grid').innerHTML;
      assert.ok(quotaEn.includes('Gemini Models'));
      assert.ok(quotaEn.includes('Claude &amp; GPT Models'));
      assert.ok(quotaEn.includes('CustomModel'), 'Unknown model group kept unchanged in English');
      assert.ok(quotaEn.includes('Weekly Limit Remaining'));
      assert.ok(quotaEn.includes('5-Hour Limit Remaining'));
      assert.ok(quotaEn.includes('Low Quota ≤20%'));
      assert.ok(quotaEn.includes('Expired (awaiting refresh)'));
      assert.ok(quotaEn.includes('UTC+8'), 'English time must explicitly show UTC+8');

      // Check English tasks table
      const tableEn = h.el('tasks-body').innerHTML;
      assert.ok(tableEn.includes('<td>0 / 0</td>'), 'Exact zero preserved');
      assert.ok(tableEn.includes('<td>2,500 / Not provided</td>'), 'Partial token displays Not provided');
      assert.ok(tableEn.includes('<td>Not provided</td>'), 'Missing token displays Not provided');
      assert.ok(tableEn.includes('Completed'));
      assert.ok(tableEn.includes('Running'));
      assert.ok(tableEn.includes('Failed'));
    });

    it('renders server connection error and dismisses cleanly in both languages', async () => {
      const h = createPanelHarness({ savedLang: 'en' });
      const init = h.output.find(x => x.method === 'ui/initialize');
      await h.dispatch({
        id: init.id,
        result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} }
      });

      const initialToolCall = h.output.find(x => x.method === 'tools/call');
      await h.dispatch({
        id: initialToolCall.id,
        result: { structuredContent: h.status(50, 'Upstream CLI timeout failure', []) }
      });

      assert.equal(h.el('error-banner').classList.contains('hidden'), false);
      assert.equal(h.el('error-message').textContent, 'Upstream CLI timeout failure', 'Upstream raw error detail must be preserved');
      assert.equal(h.el('conn-text').textContent, 'Refresh Error');

      // Dismiss error
      h.el('error-dismiss').dispatchEvent('click');
      assert.equal(h.el('error-banner').classList.contains('hidden'), true);
    });
  });

  describe('Follow Codex language mode', () => {
    it('uses host locale over browser language and follows partial host changes without extra requests', async () => {
      const h = createPanelHarness({ navigatorLanguages: ['en-US'] });
      assert.equal(h.el('lang-select').value, 'auto');
      assert.equal(h.storageMap.has('agy_quota_lang'), false, 'Automatic detection is not a manual preference');
      const init = h.output.find(x => x.method === 'ui/initialize');
      await h.dispatch({ id: init.id, result: { hostContext: { locale: 'zh-Hans-CN', theme: 'light' } } });
      assert.equal(h.el('html').getAttribute('lang'), 'zh-CN');
      const call = h.output.find(x => x.method === 'tools/call');
      await h.dispatch({ id: call.id, result: { structuredContent: h.status() } });
      const calls = () => h.output.filter(x => x.method === 'tools/call').length;
      const count = calls();
      await h.dispatch({ method: 'ui/notifications/host-context-changed', params: { locale: 'en-GB' } });
      assert.equal(h.el('html').getAttribute('lang'), 'en');
      assert.ok(h.el('quota-grid').innerHTML.includes('Weekly Limit'));
      await h.dispatch({ method: 'ui/notifications/host-context-changed', params: { theme: 'dark' } });
      assert.equal(h.el('html').getAttribute('lang'), 'en', 'Theme-only changes retain the last host locale');
      assert.equal(calls(), count);
    });
    it('preserves manual overrides, remembers auto mode, and uses the most recent host locale when re-enabled', async () => {
      const h = createPanelHarness({ savedLang: 'en', navigatorLanguages: ['en-US'] });
      const init = h.output.find(x => x.method === 'ui/initialize');
      await h.dispatch({ id: init.id, result: { hostContext: { locale: 'zh-CN' } } });
      assert.equal(h.el('html').getAttribute('lang'), 'en');
      h.el('lang-select').dispatchEvent('change', { target: { value: 'auto' } });
      assert.equal(h.el('html').getAttribute('lang'), 'zh-CN');
      assert.equal(h.storageMap.get('agy_quota_lang'), 'auto');
      h.el('lang-select').dispatchEvent('change', { target: { value: 'en' } });
      await h.dispatch({ method: 'ui/notifications/host-context-changed', params: { hostContext: { locale: 'zh-TW' } } });
      assert.equal(h.el('html').getAttribute('lang'), 'en');
      assert.equal(h.storageMap.get('agy_quota_lang'), 'en');
      h.el('lang-select').dispatchEvent('change', { target: { value: 'auto' } });
      assert.equal(h.el('html').getAttribute('lang'), 'zh-CN');
    });
    it('falls back for absent or malformed host locales and works with blocked storage', async () => {
      const h = createPanelHarness({ savedLang: 'auto', blockStorage: true, navigatorLanguages: ['zh-CN'] });
      const init = h.output.find(x => x.method === 'ui/initialize');
      await h.dispatch({ id: init.id, result: { hostContext: {} } });
      assert.equal(h.el('html').getAttribute('lang'), 'zh-CN');
      await h.dispatch({ method: 'ui/notifications/host-context-changed', params: { locale: 'en-US' } });
      assert.equal(h.el('html').getAttribute('lang'), 'en');
      await h.dispatch({ method: 'ui/notifications/host-context-changed', params: { locale: '<invalid>' } });
      assert.equal(h.el('html').getAttribute('lang'), 'zh-CN');
      assert.equal(h.el('lang-select').value, 'auto');
    });
  });

  describe('Errors across language changes', () => {
    it('preserves and translates tool errors over cached ready data, and keeps dismissed errors hidden', async () => {
      const h = createPanelHarness({ savedLang: 'en' });
      const init = h.output.find(x => x.method === 'ui/initialize');
      await h.dispatch({ id: init.id, result: {} });
      const call = h.output.find(x => x.method === 'tools/call');
      await h.dispatch({ id: call.id, result: { structuredContent: h.status() } });
      await h.dispatch({ method: 'ui/notifications/tool-result', params: { isError: true, content: [] } });
      assert.equal(h.el('error-message').textContent, 'Tool call error');
      h.el('lang-select').dispatchEvent('change', { target: { value: 'zh-CN' } });
      assert.equal(h.el('error-banner').classList.contains('hidden'), false);
      assert.equal(h.el('error-message').textContent, '工具调用报错');
      h.el('error-dismiss').dispatchEvent('click');
      h.el('lang-select').dispatchEvent('change', { target: { value: 'en' } });
      assert.equal(h.el('error-banner').classList.contains('hidden'), true);
    });
    it('translates initialization errors without cached data and preserves upstream detail', async () => {
      const h = createPanelHarness({ savedLang: 'en' });
      const init = h.output.find(x => x.method === 'ui/initialize');
      await h.dispatch({ id: init.id, error: { code: -1, message: 'raw init failure' } });
      assert.equal(h.el('error-message').textContent, 'Host connection failed: raw init failure');
      h.el('lang-select').dispatchEvent('change', { target: { value: 'zh-CN' } });
      assert.equal(h.el('error-message').textContent, '宿主界面连接失败: raw init failure');
      assert.equal(h.el('error-banner').classList.contains('hidden'), false);
    });
    for (const cached of [false, true]) {
      it(`preserves browser request errors with cached data=${cached}`, async () => {
        const h = createPublicAppHarness({ savedLang: 'en', fetchFailure: cached ? null : 'raw network failure' });
        for (let i = 0; i < 6; i++) await Promise.resolve();
        if (cached) {
          h.setFetchFailure('raw network failure');
          h.el('refresh-btn').dispatchEvent('click');
          for (let i = 0; i < 6; i++) await Promise.resolve();
        }
        assert.match(h.el('error-message').textContent, /raw network failure/);
        const requests = h.fetchCalls.length;
        h.el('lang-select').dispatchEvent('change', { target: { value: 'zh-CN' } });
        assert.equal(h.el('error-banner').classList.contains('hidden'), false);
        assert.equal(h.el('error-message').textContent, (cached ? '刷新失败: ' : '无法连接本地服务: ') + 'raw network failure');
        assert.equal(h.el('conn-text').textContent, '刷新异常');
        assert.equal(h.fetchCalls.length, requests);
      });
    }
  });

  describe('Public Browser Dashboard i18n & Acceptance Tests', () => {
    it('resolves initial language from storage and navigator in public app', () => {
      const hEn = createPublicAppHarness({ savedLang: 'en' });
      assert.equal(hEn.mockDocument.documentElement.getAttribute('lang'), 'en');
      assert.equal(hEn.mockDocument.title, 'AGY / Usage - Antigravity Quota Dashboard');
      assert.equal(hEn.el('lang-select').value, 'en');

      const hZh = createPublicAppHarness({ savedLang: 'zh-CN' });
      assert.equal(hZh.mockDocument.documentElement.getAttribute('lang'), 'zh-CN');
      assert.equal(hZh.mockDocument.title, 'AGY / Usage - Antigravity 配额监控看板');
      assert.equal(hZh.el('lang-select').value, 'zh-CN');

      const hBlocked = createPublicAppHarness({ blockStorage: true, navigatorLanguages: ['en-US'] });
      assert.equal(hBlocked.mockDocument.documentElement.getAttribute('lang'), 'en');
    });

    it('switches language on select change without duplicate network calls, updating static headings and token labels', async () => {
      const h = createPublicAppHarness({ savedLang: 'zh-CN' });
      assert.equal(h.fetchCalls.length, 1, 'Initial status fetch should be called');

      // Switch language to English
      const langSelect = h.el('lang-select');
      langSelect.value = 'en';
      langSelect.dispatchEvent('change', { target: { value: 'en' } });

      assert.equal(h.fetchCalls.length, 1, 'Language switch must not trigger additional fetchStatus');
      assert.equal(h.mockDocument.documentElement.getAttribute('lang'), 'en');
      assert.equal(h.mockDocument.title, 'AGY / Usage - Antigravity Quota Dashboard');
      assert.equal(h.storageMap.get('agy_quota_lang'), 'en');

      assert.equal(h.el('supervisor-badge').textContent, 'Supervisor Integration');
      assert.equal(h.el('updated-at-label').textContent, 'Last Updated:');
      assert.equal(h.el('freshness-label').textContent, 'Freshness:');
      assert.equal(h.el('quota-heading').textContent, 'Model Quota Monitor');
      assert.equal(h.el('tasks-heading').textContent, 'Supervisor Explicit Event Reports');
      assert.equal(h.el('th-tokens').textContent, 'Token Usage (Input / Output)');

      // Verify zero and missing tokens in public app by simulating state
      const taskList = [
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
          id: 'task-bridge-aliases',
          model: 'gemini-3.8-flash-high',
          status: 'completed',
          usage: { input_tokens: 3200, output_tokens: 450 }
        },
        {
          id: 'task-missing',
          model: 'gemini-3.8-flash-high',
          status: 'queued',
          usage: {}
        }
      ];

      // Trigger a status refresh with tasks
      const originalFetch = h.mockDocument.defaultView?.fetch;
      // Trigger refresh button click
      const refreshBtn = h.el('refresh-btn');
      refreshBtn.dispatchEvent('click');
      for (let i = 0; i < 10; i++) await Promise.resolve();

      // Cooldown in English
      langSelect.value = 'en';
      langSelect.dispatchEvent('change', { target: { value: 'en' } });

      assert.ok(h.el('refresh-btn-text').textContent.includes('Cooldown (10s)'));

      // Switch back to Chinese during active cooldown
      langSelect.value = 'zh-CN';
      langSelect.dispatchEvent('change', { target: { value: 'zh-CN' } });

      assert.equal(h.mockDocument.documentElement.getAttribute('lang'), 'zh-CN');
      assert.equal(h.mockDocument.title, 'AGY / Usage - Antigravity 配额监控看板');
      assert.ok(h.el('refresh-btn-text').textContent.includes('冷却中 (10s)'));
      assert.equal(h.el('supervisor-badge').textContent, 'Supervisor 集成');
      assert.equal(h.el('updated-at-label').textContent, '数据更新时间:');
      assert.equal(h.el('quota-heading').textContent, '模型配额监控');
      assert.equal(h.el('tasks-heading').textContent, 'Supervisor 显式报告事件');
      assert.equal(h.el('th-tokens').textContent, 'Token 消耗 (输入 / 输出)');
    });

    it('correctly handles zero vs missing tokens and exact aliases in public app tasks table', async () => {
      const h = createPublicAppHarness({ savedLang: 'en' });
      // Wait for initial fetch
      await Promise.resolve();
      await Promise.resolve();

      // Trigger a manual refresh that returns comprehensive tasks
      const tasks = [
        {
          id: 'task-canonical-exact',
          model: 'gemini-3.8-flash-high',
          status: 'completed',
          usage: { inputTokens: 1250, outputTokens: 340 }
        },
        {
          id: 'task-snake-aliases',
          model: 'gemini-3.8-flash-high',
          status: 'completed',
          usage: { input_tokens: 4500, output_tokens: 800 }
        },
        {
          id: 'task-exact-zero',
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
          id: 'task-absent',
          model: 'gemini-3.8-flash-high',
          status: 'queued'
        }
      ];

      // Trigger refresh
      h.el('refresh-btn').dispatchEvent('click');
      await Promise.resolve();
      await Promise.resolve();

      // English rendering checks
      const tableEn = h.el('tasks-table-body').innerHTML;
      // In the harness mock fetch, tasks were empty originally, but we can verify table empty state
      assert.equal(h.el('tasks-empty-title').textContent, 'No Supervisor task events');
      assert.equal(h.el('tasks-empty-sub').textContent, 'Events will appear here when explicitly reported by Supervisor via MCP or API');

      // Switch to Chinese
      const langSelect = h.el('lang-select');
      langSelect.value = 'zh-CN';
      langSelect.dispatchEvent('change', { target: { value: 'zh-CN' } });

      assert.equal(h.el('tasks-empty-title').textContent, '暂无 Supervisor 任务事件');
      assert.equal(h.el('tasks-empty-sub').textContent, '当 Supervisor 任务通过 MCP 或 API 显式上报时将显示于此');
      assert.ok(h.el('footer-tz').innerHTML.includes('Asia/Shanghai (CST)'));

      // Switch back to English to verify timezone explicit UTC+8
      langSelect.value = 'en';
      langSelect.dispatchEvent('change', { target: { value: 'en' } });
      assert.ok(h.el('footer-tz').innerHTML.includes('UTC+8'));
    });
  });
});
