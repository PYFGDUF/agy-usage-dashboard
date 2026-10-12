#!/usr/bin/env node

/**
 * Portable installation and configuration helper for agy-usage-dashboard.
 *
 * Default behavior: dry-run, prints configuration commands and metadata.
 * Never rewrites local portable .mcp.json metadata.
 * Flag --print-json: prints generic JSON MCP configuration block.
 * Flag --apply: invokes `codex mcp add agy-usage -- <node> <server>` directly without shell.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MCP_SERVER_ENTRY = path.resolve(PROJECT_ROOT, 'src', 'mcp', 'server.js');

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply') || args.includes('--register');
const shouldPrintJson = args.includes('--print-json');

const genericJsonSnippet = {
  mcpServers: {
    'agy-usage': {
      command: process.execPath,
      args: [MCP_SERVER_ENTRY],
      env: {
        AGY_USAGE_PORT: '8766'
      }
    }
  }
};

const tomlSnippet = `# ~/.codex/config.toml
[mcp_servers.agy-usage]
command = "${process.execPath}"
args = ["${MCP_SERVER_ENTRY}"]

[mcp_servers.agy-usage.env]
AGY_USAGE_PORT = "8766"
`;

if (shouldPrintJson) {
  console.log(JSON.stringify(genericJsonSnippet, null, 2));
  process.exit(0);
}

console.log('='.repeat(65));
console.log('🚀 AGY Usage Dashboard & MCP 插件安装与注册配置指南');
console.log('='.repeat(65));
console.log('');
console.log('插件根目录:', PROJECT_ROOT);
console.log('MCP 入口脚本:', MCP_SERVER_ENTRY);
console.log('Node 运行时:', process.execPath);
console.log('');
console.log('📋 【方式一：通过 Codex CLI 命令行注册 MCP 服务】');
console.log('运行以下命令（使用绝对路径与参数数组）:');
console.log(`  codex mcp add agy-usage -- "${process.execPath}" "${MCP_SERVER_ENTRY}"`);
console.log('');
console.log('📋 【方式二：在 Codex 配置文件 (~/.codex/config.toml) 中配置】');
console.log('Codex 使用 TOML 格式配置，请将以下内容加入 ~/.codex/config.toml:');
console.log('');
console.log(tomlSnippet);
console.log('📋 【方式三：通用 MCP 客户端 (如 Claude Desktop) 配置 (JSON)】');
console.log('在支持标准 JSON 的通用 MCP 客户端配置文件中添加:');
console.log('');
console.log(JSON.stringify(genericJsonSnippet, null, 2));
console.log('');
console.log('📋 【Skill 技能注册与发现机制说明】');
console.log('Codex 插件已在 .codex-plugin/plugin.json 中声明 skills: "./skills/"。');
console.log('插件加载后，Codex 会自动发现 skills/agy-usage/SKILL.md，无需额外配置。');
console.log('');
console.log('📋 【本地仪表盘服务启动方式】');
console.log('  npm start             # 启动本地 Loopback HTTP 看板服务 (http://127.0.0.1:8766)');
console.log('  npm run mcp           # 启动 stdio MCP 服务 (如果看板未启动，MCP 会自动拉起)');
console.log('  npm test              # 运行完整自动化测试套件');
console.log('  npm run verify        # 运行综合校验');
console.log('');

if (shouldApply) {
  console.log('🔄 正在调用 Codex CLI 注册 MCP 服务 (不修改便携式工程元数据)...');
  const spawnArgs = ['mcp', 'add', 'agy-usage', '--', process.execPath, MCP_SERVER_ENTRY];
  const res = spawnSync('codex', spawnArgs, {
    stdio: 'inherit',
    shell: false
  });
  if (res.status === 0) {
    console.log('✅ 已成功通过 Codex CLI 注册 agy-usage MCP 服务！');
  } else {
    console.error(`⚠️ Codex CLI 注册退出码: ${res.status}。请确认 codex 命令已安装且可用。`);
  }
} else {
  console.log('💡 默认仅执行干运行 (dry-run)，未修改任何本地文件或全局配置。');
  console.log('若需自动执行 codex 注册命令，请追加 --apply 参数。');
}
console.log('='.repeat(65));
