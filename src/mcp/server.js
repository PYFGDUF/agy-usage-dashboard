import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import {
  APP_ID,
  APP_VERSION,
  DEFAULT_PORT,
  DEFAULT_MODEL_ID,
  HOST
} from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_PATH = path.resolve(__dirname, '..', 'server.js');
const UI_PANEL_PATH = path.resolve(__dirname, '..', 'ui', 'panel.html');

function getPanelHtml() {
  return fs.readFileSync(UI_PANEL_PATH, 'utf8');
}

const PORT = parseInt(process.env.AGY_USAGE_PORT || process.env.PORT || `${DEFAULT_PORT}`, 10);
const BASE_URL = `http://${HOST}:${PORT}`;

/**
 * Checks if the local dashboard HTTP server is running and verified.
 */
async function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/health`, { timeout: 1500 }, (res) => {
      if (res.statusCode !== 200) {
        return resolve(false);
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.app === APP_ID);
        } catch {
          resolve(false);
        }
      });
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Ensures the local dashboard server is running. Spawns it if absent.
 */
async function ensureServerRunning() {
  const isHealthy = await checkHealth();
  if (isHealthy) {
    return true;
  }

  // Server not healthy or not running, spawn it in background
  console.error(`[mcp-server] Dashboard server not running on ${BASE_URL}. Starting background server...`);
  const runtimeDir = process.env.AGY_USAGE_RUNTIME_DIR || path.resolve(__dirname, '..', '..', '.runtime');
  const child = spawn(process.execPath, [SERVER_PATH], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: `${PORT}`,
      AGY_USAGE_PORT: `${PORT}`,
      AGY_USAGE_RUNTIME_DIR: runtimeDir
    }
  });
  child.unref();

  // Poll until ready, up to 15 attempts (3 seconds)
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (await checkHealth()) {
      console.error(`[mcp-server] Dashboard server ready on ${BASE_URL}`);
      return true;
    }
  }

  throw new Error(`Failed to start local dashboard HTTP server on ${BASE_URL}`);
}

/**
 * Sends HTTP request to local dashboard API.
 */
function apiRequest(method, endpoint, bodyData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const bodyStr = bodyData ? JSON.stringify(bodyData) : null;

    const req = http.request(
      url,
      {
        method,
        headers: {
          'Host': `${HOST}:${PORT}`,
          'Accept': 'application/json',
          ...(bodyStr ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyStr)
          } : {})
        },
        timeout: 25000
      },
      (res) => {
        let resBody = '';
        res.on('data', chunk => { resBody += chunk; });
        res.on('end', () => {
          try {
            const parsed = resBody ? JSON.parse(resBody) : {};
            if (res.statusCode >= 400) {
              return reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Failed to parse API response: ${e.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('API request timed out'));
    });

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

/**
 * Format ISO UTC to Asia/Shanghai time string.
 */
function formatShanghaiTime(isoString) {
  if (!isoString) return '未知';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date) + ' CST';
  } catch {
    return isoString;
  }
}

/**
 * Format relative reset time countdown.
 */
function formatCountdown(isoString) {
  if (!isoString) return '';
  const diffMs = new Date(isoString).getTime() - Date.now();
  if (diffMs <= 0) {
    return '已过期 (等待刷新)';
  }
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `剩余 ${days}天 ${remHours}小时`;
  }
  return `剩余 ${hours}小时 ${mins}分`;
}

export function createMcpServer() {
  const server = new Server(
    {
      name: 'agy-usage-mcp',
      version: APP_VERSION
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'ui://agy-usage/panel.html',
          name: 'AGY 用量',
          description: 'Antigravity 用量与配额原生 GUI 监控面板',
          mimeType: 'text/html;profile=mcp-app',
          _meta: {
            ui: {
              csp: {
                connectDomains: [],
                resourceDomains: []
              }
            }
          }
        }
      ]
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri !== 'ui://agy-usage/panel.html') {
      throw new Error(`Resource not found: ${uri}`);
    }

    return {
      contents: [
        {
          uri: 'ui://agy-usage/panel.html',
          mimeType: 'text/html;profile=mcp-app',
          text: getPanelHtml(),
          _meta: {
            ui: {
              csp: {
                connectDomains: [],
                resourceDomains: []
              }
            }
          }
        }
      ]
    };
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'agy_usage_panel',
          title: 'AGY 用量',
          description: '展示 Antigravity 用量与配额原生 GUI 监控面板（支持全局侧边栏与聊天右侧面板）',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          annotations: {
            title: 'AGY 用量',
            readOnlyHint: true,
            idempotentHint: true
          },
          _meta: {
            ui: {
              resourceUri: 'ui://agy-usage/panel.html'
            },
            'openai/ui': {
              entrypoints: [
                { type: 'global' },
                { type: 'thread' }
              ]
            },
            'openai/widgetAccessible': true
          }
        },
        {
          name: 'agy_usage_get',
          description: '获取当前 Antigravity 配额使用情况及重置倒计时（支持强制刷新，只读配额查询）',
          inputSchema: {
            type: 'object',
            properties: {
              force_refresh: {
                type: 'boolean',
                description: '是否强制触发一次配额刷新（受10秒冷却限制）',
                default: false
              }
            }
          },
          annotations: {
            title: 'AGY Quota Query',
            readOnlyHint: true,
            idempotentHint: true
          },
          _meta: {
            ui: {
              visibility: ['model', 'app']
            }
          }
        },
        {
          name: 'agy_dashboard_open',
          description: '获取本地 AGY 配额监控看板 URL 及当前连接与服务状态（仅作开发或浏览器回退使用）',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          annotations: {
            title: 'AGY Dashboard URL',
            readOnlyHint: true,
            idempotentHint: true
          }
        },
        {
          name: 'agy_supervisor_event',
          description: '显式记录 Supervisor 任务执行事件与 Token 使用统计（不启动实际模型任务）',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: '任务唯一标识符 (1-64 字符)'
              },
              model: {
                type: 'string',
                description: `模型名称，默认 ${DEFAULT_MODEL_ID}`,
                default: DEFAULT_MODEL_ID
              },
              status: {
                type: 'string',
                enum: ['queued', 'running', 'completed', 'failed', 'unknown'],
                description: '任务状态'
              },
              usage: {
                type: 'object',
                properties: {
                  inputTokens: { type: 'number', description: '输入 token 数量' },
                  outputTokens: { type: 'number', description: '输出 token 数量' }
                },
                description: '可选的 token 统计'
              }
            },
            required: ['id', 'status']
          },
          annotations: {
            title: 'Supervisor Event Logger',
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    // 1. Validate unknown tool BEFORE spawning or touching service
    const KNOWN_TOOLS = new Set(['agy_usage_panel', 'agy_usage_get', 'agy_dashboard_open', 'agy_supervisor_event']);
    if (!KNOWN_TOOLS.has(name)) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool name: ${name}` }]
      };
    }

    // 2. Validate parameter types BEFORE spawning service
    if (args !== null && typeof args !== 'object') {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Arguments must be an object' }]
      };
    }

    if (name === 'agy_usage_get') {
      if (args.force_refresh !== undefined && typeof args.force_refresh !== 'boolean') {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Invalid parameter "force_refresh": must be a boolean' }]
        };
      }
    } else if (name === 'agy_supervisor_event') {
      if (typeof args.id !== 'string' || !args.id.trim() || args.id.trim().length > 64 || !/^[a-zA-Z0-9_-]+$/.test(args.id.trim())) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Invalid or missing parameter "id": must be 1-64 alphanumeric characters, underscores, or dashes' }]
        };
      }
      if (typeof args.status !== 'string' || !['queued', 'running', 'completed', 'failed', 'unknown'].includes(args.status.toLowerCase())) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Invalid or missing parameter "status": must be queued, running, completed, failed, or unknown' }]
        };
      }
      if (args.model !== undefined && (typeof args.model !== 'string' || !args.model.trim() || args.model.trim().length > 64 || !/^[a-zA-Z0-9_.:\/-]+$/.test(args.model.trim()))) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Invalid parameter "model"' }]
        };
      }
      if (args.usage !== undefined) {
        if (typeof args.usage !== 'object' || args.usage === null || Array.isArray(args.usage)) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Invalid parameter "usage": must be an object' }]
          };
        }
        for (const k of Object.keys(args.usage)) {
          if (k !== 'inputTokens' && k !== 'outputTokens') {
            return {
              isError: true,
              content: [{ type: 'text', text: `Unexpected field in usage: "${k}"` }]
            };
          }
        }
        if (args.usage.inputTokens !== undefined) {
          if (typeof args.usage.inputTokens !== 'number' || !Number.isFinite(args.usage.inputTokens) || !Number.isInteger(args.usage.inputTokens) || args.usage.inputTokens < 0 || args.usage.inputTokens > 100_000_000_000) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Invalid parameter "usage.inputTokens": must be a non-negative bounded integer' }]
            };
          }
        }
        if (args.usage.outputTokens !== undefined) {
          if (typeof args.usage.outputTokens !== 'number' || !Number.isFinite(args.usage.outputTokens) || !Number.isInteger(args.usage.outputTokens) || args.usage.outputTokens < 0 || args.usage.outputTokens > 100_000_000_000) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Invalid parameter "usage.outputTokens": must be a non-negative bounded integer' }]
            };
          }
        }
      }
    }

    try {
      await ensureServerRunning();

      if (name === 'agy_usage_panel') {
        let status = await apiRequest('GET', '/api/status');

        // If initial refresh on startup is pending and windows are not yet populated, boundedly join
        if (status.connection?.state === 'refreshing' && (!status.usage?.windows || status.usage.windows.length === 0)) {
          const startTime = Date.now();
          const maxWaitMs = 12000;
          while (Date.now() - startTime < maxWaitMs) {
            await new Promise(r => setTimeout(r, 250));
            status = await apiRequest('GET', '/api/status');
            if (status.connection?.state !== 'refreshing' || (status.usage?.windows && status.usage.windows.length > 0)) {
              break;
            }
          }
        }

        const windows = status.usage?.windows || [];
        const isStale = status.usage?.stale;
        const updatedAtCst = formatShanghaiTime(status.usage?.updatedAt);
        const connState = status.connection?.state || 'unknown';

        let text = `### 📊 AGY 用量监控面板\n\n`;
        text += `- **连接状态**: \`${connState}\`${isStale ? ' (⚠️ 数据已过期 >120s)' : ' (实时)'}\n`;
        text += `- **更新时间**: ${updatedAtCst}\n\n`;

        if (windows.length === 0) {
          text += `*暂无配额窗口数据*\n`;
        } else {
          text += `| 模型分组 | 配额窗口 | 剩余百分比 | 重置时间 (北京时间) | 倒计时 |\n`;
          text += `| :--- | :--- | :--- | :--- | :--- |\n`;

          const lowWarnings = [];
          for (const win of windows) {
            const percentStr = `${win.remainingPercent}%`;
            const resetCst = formatShanghaiTime(win.resetsAt);
            const countdown = formatCountdown(win.resetsAt);
            const isLow = win.remainingPercent <= 20;

            if (isLow) {
              lowWarnings.push(`- ⚠️ **${win.group} - ${win.window}**: 仅剩 **${percentStr}** (${countdown})`);
            }

            text += `| ${win.group} | ${win.window} | **${percentStr}** | ${resetCst} | ${countdown} |\n`;
          }

          if (lowWarnings.length > 0) {
            text += `\n> [!WARNING] **配额紧张预警 (≤20%)**:\n`;
            text += lowWarnings.join('\n') + '\n';
          }
        }

        return {
          content: [
            {
              type: 'text',
              text
            }
          ],
          structuredContent: status
        };
      }

      if (name === 'agy_usage_get') {
        const forceRefresh = args.force_refresh === true;
        let status = forceRefresh
          ? await apiRequest('POST', '/api/refresh', {})
          : await apiRequest('GET', '/api/status');

        // If initial refresh on startup is pending and windows are not yet populated, boundedly join
        if (!forceRefresh && status.connection?.state === 'refreshing' && (!status.usage?.windows || status.usage.windows.length === 0)) {
          const startTime = Date.now();
          const maxWaitMs = 12000;
          while (Date.now() - startTime < maxWaitMs) {
            await new Promise(r => setTimeout(r, 250));
            status = await apiRequest('GET', '/api/status');
            if (status.connection?.state !== 'refreshing' || (status.usage?.windows && status.usage.windows.length > 0)) {
              break;
            }
          }
        }

        const windows = status.usage?.windows || [];
        const isStale = status.usage?.stale;
        const updatedAtCst = formatShanghaiTime(status.usage?.updatedAt);
        const connState = status.connection?.state || 'unknown';

        let text = `### 📊 Antigravity 配额状态\n\n`;
        text += `- **连接状态**: \`${connState}\`${isStale ? ' (⚠️ 数据已过期 >120s)' : ' (实时)'}\n`;
        text += `- **更新时间**: ${updatedAtCst}\n\n`;

        if (windows.length === 0) {
          text += `*暂无配额窗口数据，请稍后重试刷新。*\n`;
        } else {
          text += `| 模型分组 | 配额窗口 | 剩余百分比 | 重置时间 (北京时间) | 倒计时 |\n`;
          text += `| :--- | :--- | :--- | :--- | :--- |\n`;

          const lowWarnings = [];
          for (const win of windows) {
            const percentStr = `${win.remainingPercent}%`;
            const resetCst = formatShanghaiTime(win.resetsAt);
            const countdown = formatCountdown(win.resetsAt);
            const isLow = win.remainingPercent <= 20;

            if (isLow) {
              lowWarnings.push(`- ⚠️ **${win.group} - ${win.window}**: 仅剩 **${percentStr}** (${countdown})`);
            }

            text += `| ${win.group} | ${win.window} | **${percentStr}** | ${resetCst} | ${countdown} |\n`;
          }

          if (lowWarnings.length > 0) {
            text += `\n> [!WARNING] **配额紧张预警 (≤20%)**:\n`;
            text += lowWarnings.join('\n') + '\n';
          }
        }

        return {
          content: [
            {
              type: 'text',
              text
            }
          ],
          structuredContent: status
        };
      }

      if (name === 'agy_dashboard_open') {
        const status = await apiRequest('GET', '/api/status');
        const text = `### 🖥️ AGY 本地配额监控看板\n\n` +
          `- **看板地址**: [${BASE_URL}](${BASE_URL})\n` +
          `- **当前服务状态**: \`${status.connection?.state || 'ready'}\`\n` +
          `- **最近更新**: ${formatShanghaiTime(status.usage?.updatedAt)}\n\n` +
          `可直接在浏览器中打开以上本地地址访问深色监控看板与实时任务事件跟踪。`;

        return {
          content: [
            {
              type: 'text',
              text
            }
          ],
          structuredContent: {
            url: BASE_URL,
            status: status.connection?.state || 'ready',
            updatedAt: status.usage?.updatedAt || null
          }
        };
      }

      if (name === 'agy_supervisor_event') {
        const { id, model = DEFAULT_MODEL_ID, status, usage } = args;
        const res = await apiRequest('POST', '/api/tasks', { id, model, status, usage });

        const text = `已成功记录 Supervisor 任务事件:\n` +
          `- **任务 ID**: \`${res.task.id}\`\n` +
          `- **模型**: \`${res.task.model}\`\n` +
          `- **状态**: \`${res.task.status}\`\n` +
          `- **更新时间**: ${formatShanghaiTime(res.task.updatedAt)}`;

        return {
          content: [
            {
              type: 'text',
              text
            }
          ],
          structuredContent: res.task
        };
      }

      throw new Error(`Unknown tool name: ${name}`);
    } catch (err) {
      console.error(`[mcp-server] Error executing ${name}:`, err);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `执行失败: ${err.message}`
          }
        ]
      };
    }
  });

  return server;
}

// Start stdio MCP transport if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const mcpServer = createMcpServer();
  const transport = new StdioServerTransport();
  mcpServer.connect(transport).catch((err) => {
    console.error('[mcp-server] Fatal MCP initialization error:', err);
    process.exit(1);
  });
}
