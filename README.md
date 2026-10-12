# AGY Usage Dashboard & MCP Plugin for Codex

Antigravity (AGY) 本地配额实时监控看板、原生 GUI 面板组件与 MCP 工具集成插件。面向 macOS 与本地 Codex 工作流打造，提供 Codex 原生 MCP Apps GUI 面板、Loopback 本地配额监控面板、只读配额 MCP 工具，以及 Supervisor 任务事件集成。

---

## 🌟 核心特性

1. **Codex 原生 GUI 组件 (MCP Apps 原生集成)**:
   - 提供标准 MCP Apps UI 资源 `ui://agy-usage/panel.html`（MIME: `text/html;profile=mcp-app`）。
   - 声明 `openai/ui` 全局入口（`global` 侧边栏）与对话入口（`thread` 聊天右侧面板），用户可在 Codex 客户端中直接唤起原生面板。
   - 基于标准 JSON-RPC 2.0 `window.parent.postMessage` 桥接协议（`ui/initialize` 握手与 `tools/call` 数据加载），自适应宿主深色/浅色主题。
   - 严格安全隔离：纯原生自包含 HTML/CSS/JS，零外部 CDN，零外部脚本，无任何 `fetch` 或 `localhost` 网络请求，CSP 域名列表完全清空。
   - 动态尺寸上报与防抖循环保护，为 320px 窄面板至全屏提供响应式布局。

2. **真实 CLI 配额探测，零 Token 消耗**:
   - 绝不通过模型提示词推算配额；直接调用底层 `agy --print /usage --print-timeout 15s` 查询。
   - 完整支持 Weekly 与 5-Hour 周期窗口，精准处理 0% 余量边界状态与 CST / UTC 重置时间。
   - 共享缓存机制：后台每 60 秒查询额度，普通查询至少间隔 30 秒，手动刷新至少间隔 10 秒。原生组件每 5 秒读取缓存，并发刷新复用同一个请求。
   - 容错保全：在进程超时或返回异常时，保留上一次成功的有效窗口数据，标记 `stale: true` 并返回清洗后的诊断信息。

3. **Loopback 专属与全方位安全加固**:
   - 本地看板服务默认仅绑定并监听 `127.0.0.1:8766` 本地环回接口。
   - **DNS Rebinding 防护**：严格校验 `Host` 头部，拒绝非本机域名访问。
   - **跨站请求防护**：对于修改状态的 POST 请求，严格验证 `Origin`（仅允许同源或无 Origin 的 Node/MCP 客户端），阻止任意跨域页面发起攻击。
   - **请求体约束与目录遍历防御**：限制 JSON 请求体不超过 100KB，静态资源路径严格约束在 `public/` 目录内部。

4. **严格固定的 MCP 标准接口**:
   - 官方 `@modelcontextprotocol/sdk` 严格锁定为版本 **`1.32.1`**。
   - 提供基于 Stdio 传输的 MCP 服务，标准输出纯净保留给 JSON-RPC 通信。
   - 看板服务缺席自动拉起：MCP 客户端调用时若本地仪表盘尚未运行，会自动启动后台服务并等待健康校验。

---

## 🛠️ MCP 工具定义

| 工具名称 | 功能描述 | 参数说明 | 访问模式 |
| :--- | :--- | :--- | :--- |
| `agy_usage_panel` | 唤起/展示原生 AGY 用量监控面板（全局侧边栏/聊天右侧面板） | 无 | 原生 GUI 入口 (只读) |
| `agy_usage_get` | 获取当前配额余量及倒计时（只读查询，供模型与原生组件桥接） | `force_refresh` (boolean, 可选, 默认 false) | 只读配额查询 |
| `agy_dashboard_open` | 获取看板地址及本地连接状态（仅作开发与浏览器回退） | 无 | 只读状态查询 |
| `agy_supervisor_event` | 记录显式任务执行状态与 Token | `id` (string), `model` (string), `status` (enum), `usage` (object) | 事件写入 |

---

## 🚀 快速启动与使用

### 1. 安装依赖
```bash
npm ci --no-audit --no-fund
```
> 注：已在 `package.json` 与 `package-lock.json` 中将 `@modelcontextprotocol/sdk` 精确锁定为 `1.32.1`。

### 2. 启动本地监控看板（开发/备用）
```bash
npm start
```
服务将在本地启动：`http://127.0.0.1:8766`，供浏览器直接访问。

### 3. 运行 Stdio MCP 服务
```bash
npm run mcp
```

### 4. 运行完整测试套件与综合校验
```bash
# 运行单元测试、集成测试与原生 GUI 资源测试 (Node 内置 runner)
npm test

# 运行依赖校验、文件完整性、测试套件及 MCP 烟雾测试
npm run verify
```

---

## 🔌 Codex / MCP 客户端注册

### 安装为本地 Codex 插件

先在项目目录运行上面的 `npm ci`，然后执行：

```bash
codex plugin marketplace add "$PWD"
codex plugin add agy-usage-dashboard@agy-usage-local
codex plugin list --json
```

本地目录包含 `.agents/plugins/marketplace.json`，插件安装后同时提供 MCP 和 `agy-usage` 技能：
- **内嵌用量面板**：在支持 MCP Apps 的 Codex 客户端中，从左侧栏的插件入口，或聊天右侧新标签页的「Plugins and MCPs / 插件与 MCP」菜单打开「AGY 用量」。组件由 MCP 资源加载，刷新通过宿主调用数据工具，不需要浏览器网址。
- **任务协同**：与 AGY Supervisor 一起使用时，先查询额度，再按原有权限与工作区约定委派任务；通过 `agy_supervisor_event` 上报起止状态和 CLI 返回的 Token 数。
- **浏览器回退**：仅当用户明确要求在浏览器查看时，智能体才调用 `agy_dashboard_open` 提供本地环回地址。

也可以尝试插件深链接：[打开 AGY 用量](codex://plugins/agy-usage-dashboard@agy-usage-local/app/agy_usage_panel)。入口未出现时，重新载入聊天或重启客户端后检查插件是否启用。

### 仅接入 MCP：使用 Codex 命令行添加
Codex 支持直接通过命令行注册 MCP 服务（推荐使用绝对路径）：
```bash
codex mcp add agy-usage -- "<Node绝对路径>" "<插件绝对路径>/src/mcp/server.js"
```

### 方式二：在 Codex 配置文件中配置 (TOML)
Codex 采用 TOML 格式配置文件，请在 `~/.codex/config.toml` 中添加：
```toml
# ~/.codex/config.toml
[mcp_servers.agy-usage]
command = "node"
args = ["<插件绝对路径>/src/mcp/server.js"]

[mcp_servers.agy-usage.env]
AGY_USAGE_PORT = "8766"
```

### 方式三：通用 MCP 客户端配置 (JSON)
对于支持标准 JSON 配置的通用 MCP 客户端（如 Claude Desktop），在配置文件的 `mcpServers` 字段中添加：
```json
{
  "mcpServers": {
    "agy-usage": {
      "command": "node",
      "args": ["<插件绝对路径>/src/mcp/server.js"],
      "env": {
        "AGY_USAGE_PORT": "8766"
      }
    }
  }
}
```

### 🧩 Skill 技能自动发现说明
本插件已在 `.codex-plugin/plugin.json` 中配置 `"skills": "./skills/"`。当作为 Codex 插件加载时，Codex 会自动发现并注册 `skills/agy-usage/SKILL.md` 中的 `agy-usage` 技能，智能体优先使用原生 GUI 面板，绝不自动弹出浏览器。

---

## 📂 项目结构

```
.
├── .codex-plugin/
│   └── plugin.json          # 插件元数据与能力清单
├── .mcp.json                # 本地 MCP 服务配置文件
├── package.json             # 依赖锁定 @modelcontextprotocol/sdk@1.32.1
├── package-lock.json        # 确定的依赖锁文件
├── README.md                # 完整的中文工程与使用文档
├── public/                  # 零构建原生前端 (开发/浏览器备用)
│   ├── index.html           # 语义化响应式看板结构
│   ├── style.css            # Dark Graphite 深色样式、无障碍与动画
│   └── app.js               # 状态轮询、冷却防抖、倒计时逻辑
├── src/
│   ├── config.js            # 核心常量与配置
│   ├── parser.js            # TSV/对齐表格解析器（支持0%、CST/UTC）
│   ├── collector.js         # CLI 执行器、并发去重、冷却与原子持久化
│   ├── task-store.js        # Supervisor 任务事件管理与上限约束
│   ├── server.js            # Loopback HTTP 服务与安全防御
│   ├── ui/
│   │   └── panel.html       # 原生 MCP Apps GUI 组件 (自包含/postMessage桥接)
│   └── mcp/
│       └── server.js        # Stdio MCP 协议服务 (SDK 1.32.1，支持 UI 资源与工具)
├── scripts/
│   ├── install.mjs          # 安装与注册辅助脚本
│   ├── smoke-mcp.mjs        # 基于 SDK Client 的 Stdio 烟雾测试
│   └── verify.mjs           # 综合自动化校验脚本
├── skills/
│   └── agy-usage/
│       └── SKILL.md         # Codex 智能体使用技能指南 (优先原生面板)
└── test/
    ├── fixtures/            # 测试夹具与 Mock 可执行程序
    │   ├── fake-agy.sh
    │   ├── valid-usage.tsv
    │   ├── valid-usage-spaces.txt
    │   ├── zero-percent.tsv
    │   └── malformed.tsv
    ├── parser.test.js       # 表格解析与边界用例
    ├── collector.test.js    # 收集器防抖、并发去重与错误保全
    ├── server.test.js       # HTTP 接口、Host/Origin与安全防御
    ├── mcp.test.js          # Stdio MCP 协议与工具链端到端测试
    └── native-ui.test.js    # 原生 MCP GUI 资源与面板协议集成测试
```

---

## 🛡️ 边界与已知限制

1. **宿主客户端验证**：本仓库通过 MCP SDK 客户端与独立进程校验了 UI 资源、工具元数据、桥接协议约束及自包含沙箱特性；Codex 客户端内部的实际原生 GUI 呈现效果将由宿主环境安装后实测验证。
2. **配额探测机制**：完全基于 `agy --print /usage` 官方命令输出；若本地未安装 `agy` CLI 或未登录，看板会如实显示连接错误或保留上一次成功数据。
3. **任务追踪范围**：仅记录通过 `POST /api/tasks` 或 MCP 工具 `agy_supervisor_event` 显式上报的任务事件，不篡改、不越权枚举底层桥接器中未上报的后台进程。
4. **网络范围**：服务仅监听 `127.0.0.1` 环回地址，不支持也严禁暴露于公网环境中。
