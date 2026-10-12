#!/usr/bin/env node

/**
 * Verification script for agy-usage-dashboard plugin.
 * Runs complete test suite, checks pinned dependencies and plugin manifests.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('='.repeat(65));
console.log('🔍 开始执行 AGY Usage Dashboard & MCP 插件综合校验');
console.log('='.repeat(65));

let hasErrors = false;

// 1. Dependency pinning check
console.log('\n[1/4] 检查依赖版本锁定...');
const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const sdkVersion = pkg.dependencies?.['@modelcontextprotocol/sdk'];

if (sdkVersion === '1.32.1') {
  console.log(`  ✅ @modelcontextprotocol/sdk 准确锁定为版本: ${sdkVersion}`);
} else {
  console.error(`  ❌ 依赖错误: @modelcontextprotocol/sdk 版本应为 exact 1.32.1, 当前为: ${sdkVersion}`);
  hasErrors = true;
}

// 2. Manifests & structure check
console.log('\n[2/4] 检查工程文件结构与插件清单...');
const requiredFiles = [
  '.codex-plugin/plugin.json',
  '.mcp.json',
  'skills/agy-usage/SKILL.md',
  'src/server.js',
  'src/collector.js',
  'src/parser.js',
  'src/task-store.js',
  'src/mcp/server.js',
  'public/index.html',
  'public/style.css',
  'public/app.js',
  'scripts/install.mjs',
  'scripts/smoke-mcp.mjs'
];

for (const rel of requiredFiles) {
  const full = path.join(PROJECT_ROOT, rel);
  if (fs.existsSync(full)) {
    console.log(`  ✅ 存在: ${rel}`);
  } else {
    console.error(`  ❌ 缺失必需文件: ${rel}`);
    hasErrors = true;
  }
}

try {
  const pluginJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, '.codex-plugin/plugin.json'), 'utf8'));
  if (pluginJson.skills === './skills/' && pluginJson.mcpServers === './.mcp.json') {
    console.log('  ✅ .codex-plugin/plugin.json 包含标准兼容字段: skills="./skills/", mcpServers="./.mcp.json"');
  } else {
    console.error('  ❌ .codex-plugin/plugin.json 格式不符合标准要求');
    hasErrors = true;
  }
  if (!pluginJson.entry && !pluginJson.capabilities) {
    console.log('  ✅ .codex-plugin/plugin.json 已移除非标准的 entry / capabilities 字段');
  } else {
    console.error('  ❌ .codex-plugin/plugin.json 仍包含非标准的 entry 或 capabilities 字段');
    hasErrors = true;
  }
} catch (err) {
  console.error(`  ❌ 解析 plugin.json 异常: ${err.message}`);
  hasErrors = true;
}

// 3. Automated Test Suite
console.log('\n[3/4] 运行 Node 自动化测试套件 (node --test)...');
const testRun = spawnSync(process.execPath, ['--test', 'test/**/*.test.js'], {
  cwd: PROJECT_ROOT,
  stdio: 'inherit'
});

if (testRun.status === 0) {
  console.log('  ✅ 所有单元与集成测试均已通过');
} else {
  console.error(`  ❌ 测试套件执行失败，退出码: ${testRun.status}`);
  hasErrors = true;
}

// 4. MCP Smoke Test
console.log('\n[4/4] 运行 Stdio MCP 烟雾测试...');
const smokeRun = spawnSync(process.execPath, ['scripts/smoke-mcp.mjs'], {
  cwd: PROJECT_ROOT,
  stdio: 'inherit'
});

if (smokeRun.status === 0) {
  console.log('  ✅ MCP 烟雾测试通过');
} else {
  console.error(`  ❌ MCP 烟雾测试失败，退出码: ${smokeRun.status}`);
  hasErrors = true;
}

console.log('\n' + '='.repeat(65));
if (hasErrors) {
  console.error('❌ 综合校验存在未通过项目，请检查上述错误信息！');
  process.exit(1);
} else {
  console.log('🎉 综合校验全部通过！插件准备就绪。');
  console.log('='.repeat(65));
}
