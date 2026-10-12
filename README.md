# AGY Usage Dashboard & MCP Plugin for Codex

Antigravity (AGY) 本地配额实时监控看板与 MCP 工具集成插件。面向 macOS 与本地 Codex 工作流打造，提供纯净的 Loopback 本地配额监控面板、只读配额 MCP 工具，以及 Supervisor 任务事件集成。

---

## 🌟 核心特性

1. **真实 CLI 配额探测，零 Token 消耗**:
   - 绝不通过模型提示词推算配额；直接调用底层 `agy --print /usage --print-timeout 15s` 查询。
   - 完整支持 Weekly 与 5-Hour 周期窗口，精准处理 0% 余量边界状态与 CST / UTC 重置时间。
   - 共享缓存机制：内置 10 秒防抖冷却时间，实际执行间隔 ≥ 30 秒（默认 60 秒），并发请求自动复用同一个 Promise 避免重复执行。
   - 容错保全：在进程超时或返回异常时，保留上一次成功的有效窗口数据，标记 `stale: true` 并返回清洗后的诊断信息。

2. **Loopback 专属与全方位安全加固**:
   - 默认仅绑定并监听 `127.0.0.1:8766` 本地环回接口。
   - **DNS Rebinding 防护**：严格校验 `Host` 头部，拒绝非本机域名访问。
   - **跨站请求防护**：对于修改状态的 POST 请求，严格验证 `Origin`（仅允许同源或无 Origin 的 Node/MCP 客户端），阻止任意跨域页面发起攻击。
   - **请求体约束与目录遍历防御**：限制 JSON 请求体不超过 100KB，静态资源路径严格约束在 `public/` 目录内部。

3. **优雅精致的深色中文监控看板**:
   - 纯原生 HTML5 / CSS3 / ES 模块构建，无需任何前端打包工具，零外部 CDN 依赖。
   - **Dark Graphite 深色石墨质感**，配以 **Cyan / Lime 荧光动态进度条**。
   - **配额紧张预警**：当余量 ≤ 20% 时，进度条自适应变更为琥珀/警示红，并展示醒目标签。
   - **重置倒计时**：统一显示为北京时间（`Asia/Shanghai CST`）；过期时间真实显示“已到期，等待下次刷新”，绝不自行臆造新配额。
   - **Supervisor 显式任务事件**：如实展示由 MCP 工具显式上报的运行事件，明确标明“不自动枚举后台桥接任务”，无任务时真实呈现空状态。
   - 完备的响应式设计（支持 390px 移动端至 1440px 桌面端）与无障碍 ARIA 支持、`prefers-reduced-motion` 适配。

4. **严格固定的 MCP 标准接口**:
   - 官方 `@modelcontextprotocol/sdk` 严格锁定为版本 **`1.32.1`**。
   - 提供基于 Stdio 传输的 MCP 服务，标准输出纯净保留给 JSON-RPC 通信。
   - 看板服务缺席自动拉起：MCP 客户端调用时若本地仪表盘尚未运行，会自动启动后台服务并等待健康校验。

---

## 🛠️ MCP 工具定义

| 工具名称 | 功能描述 | 参数说明 | 访问模式 |
| :--- | :--- | :--- | :--- |
| `agy_usage_get` | 获取当前配额余量及倒计时 | `force_refresh` (boolean, 可选, 默认 false) | 只读配额查询 |
| `agy_dashboard_open` | 获取看板地址及本地连接状态 | 无 | 只读状态查询 |
| `agy_supervisor_event` | 记录显式任务执行状态与 Token | `id` (string), `model` (string), `status` (enum), `usage` (object) | 事件写入 |

---

## 🚀 快速启动与使用

### 1. 安装依赖
```bash
npm install --no-audit --no-fund
```
> 注：已在 `package.json` 与 `package-lock.json` 中将 `@modelcontextprotocol/sdk` 精确锁定为 `1.32.1`。

### 2. 启动本地监控看板
```bash
npm start
```
服务将在本地启动：`http://127.0.0.1:8766`，在浏览器打开即可访问监控看板。

### 3. 运行 Stdio MCP 服务
```bash
npm run mcp
```

### 4. 运行完整测试套件与综合校验
```bash
# 运行单元测试与集成测试 (Node 内置 runner)
npm test

# 运行依赖校验、文件完整性、测试套件及 MCP 烟雾测试
npm run verify
```

---

## 🔌 Codex / MCP 客户端注册

### 方式一：使用 Codex 命令行添加
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
本插件已在 `.codex-plugin/plugin.json` 中配置 `"skills": "./skills/"`。当作为 Codex 插件加载时，Codex 会自动发现并注册 `skills/agy-usage/SKILL.md` 中的 `agy-usage` 技能，智能体可自动查阅配额指南与调用策略，无需手动导入。

### 🛠️ 辅助配置脚本
你可以随时运行内置的辅助脚本获取当前环境的绝对路径配置指令：
```bash
node scripts/install.mjs              # 打印绝对路径命令、TOML 与 JSON 配置（默认 dry-run，绝不篡改工程元数据）
node scripts/install.mjs --print-json # 仅输出通用客户端 JSON 配置块
node scripts/install.mjs --apply      # 直接调用 codex mcp add 注册（非必选）
```

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
├── public/                  # 零构建原生前端
│   ├── index.html           # 语义化响应式看板结构
│   ├── style.css            # Dark Graphite 深色样式、无障碍与动画
│   └── app.js               # 状态轮询、冷却防抖、倒计时逻辑
├── src/
│   ├── config.js            # 核心常量与配置
│   ├── parser.js            # TSV/对齐表格解析器（支持0%、CST/UTC）
│   ├── collector.js         # CLI 执行器、并发去重、冷却与原子持久化
│   ├── task-store.js        # Supervisor 任务事件管理与上限约束
│   ├── server.js            # Loopback HTTP 服务与安全防御
│   └── mcp/
│       └── server.js        # Stdio MCP 协议服务 (SDK 1.32.1)
├── scripts/
│   ├── install.mjs          # 安装与注册辅助脚本
│   ├── smoke-mcp.mjs        # 基于 SDK Client 的 Stdio 烟雾测试
│   └── verify.mjs           # 综合自动化校验脚本
├── skills/
│   └── agy-usage/
│       └── SKILL.md         # Codex 智能体使用技能指南
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
    └── mcp.test.js          # Stdio MCP 协议与工具链端到端测试
```

---

## 🛡️ 边界与已知限制

1. **配额探测机制**：完全基于 `agy --print /usage` 官方命令输出；若本地未安装 `agy` CLI 或未登录，看板会如实显示连接错误或保留上一次成功数据。
2. **任务追踪范围**：仅记录通过 `POST /api/tasks` 或 MCP 工具 `agy_supervisor_event` 显式上报的任务事件，不篡改、不越权枚举底层桥接器中未上报的后台进程。
3. **网络范围**：服务仅监听 `127.0.0.1` 环回地址，不支持也严禁暴露于公网环境中。
