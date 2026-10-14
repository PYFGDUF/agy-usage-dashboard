---
name: agy-usage
description: Antigravity 配额查询、原生 GUI 面板展示与 Supervisor 任务生命周期事件上报指南。在委派耗用大量 Token 或长运行任务前查询配额，并在任务起止时显式记录事件。
---

# AGY Usage Skill

本 Skill 为 Codex 智能体提供与 Antigravity 本地配额监控系统、原生 GUI 面板组件及 Supervisor 任务协同的最佳实践。

## 核心理念

1. **原生插件面板与全局侧边栏优先 (Native Plugin Panel / Sidebar)**:
   当用户需要查看用量面板或可视化监控时，调用 `agy_usage_panel` 或引导用户使用原生界面（侧边栏 / 聊天右侧面板）。
   **严禁自动在外部浏览器中弹窗或打开网址**。原生 GUI 组件通过 MCP Apps 桥接在 Codex 宿主中直接渲染。
2. **委派前先查配额 (Quota-Before-Delegation)**:
   在准备执行复杂规划、大批文件修改或派发耗量大的子任务前，先调用只读工具 `agy_usage_get` 获取当前限额剩余情况。
3. **低余量预警 (≤ 20%)**:
   若任一限额窗口（尤其是 5-Hour 窗口或 Weekly 窗口）剩余低于 20%，避免发起突发式并发任务，提醒用户或合理控制上下文长度。
4. **显式任务事件跟踪 (Supervisor Event Reporting)**:
   在围绕 `agy_start` / `agy_status` 或自主任务的执行周期中，调用 `agy_supervisor_event` 记录任务状态变化。
   **注意**：本插件绝不自动拦截或枚举所有桥接任务，仅如实记录显式上报的事件。

---

## 常用工具

### 1. `agy_usage_panel`
展示 Antigravity 用量与配额原生 GUI 监控面板（支持全局侧边栏与聊天右侧面板）：
- 返回数据：当前配额状态结构化数据与精简中文摘要。
- 绑定元数据：`_meta.ui.resourceUri = "ui://agy-usage/panel.html"`，支持 global 与 thread 入口。
- 适用场景：用户要求“打开用量面板”、“查看 AGY 用量”或需要原生界面交互时调用。

```json
// 调用示例
{
  "name": "agy_usage_panel",
  "arguments": {}
}
```

### 2. `agy_usage_get`
获取当前 Antigravity 配额使用情况（只读配额查询，适合模型静默获取或桥接交互）：
- 参数：
  - `force_refresh` (布尔值，默认 `false`): 是否强制向本地 CLI 触发一次配额刷新（受 10 秒冷却防护限制）。
- 返回数据：
  - 各模型分组（如 `Gemini Models`、`Claude and GPT models`）下的 Weekly 和 5-Hour 剩余百分比（0%~100%）。
  - 重置时间（北京时间 CST）与倒计时。
  - 数据过期状态（`stale`）。

```json
// 调用示例
{
  "name": "agy_usage_get",
  "arguments": {
    "force_refresh": false
  }
}
```

### 3. `agy_dashboard_open`
获取本地配额监控看板 URL 及服务状态（**仅作开发调试或明确要求外部浏览器时的回退工具**）：
- 默认服务地址：`http://127.0.0.1:8766`
- **使用规范**：除非用户明确提出“在浏览器中打开”或“获取本地看板 URL”，否则不要主动使用此工具替代原生面板。

### 4. `agy_supervisor_event`
上报显式任务生命周期状态：
- 参数：
  - `id` (字符串，必填): 任务唯一标识符（1~64 字符）。
  - `model` (字符串，可选): 模型名称，默认为 `gemini-3.8-flash-high`。
  - `status` (枚举，必填): `queued` | `running` | `completed` | `failed` | `unknown`。
  - `usage` (对象，可选): 支持规范驼峰 `{ inputTokens?: number, outputTokens?: number }` 与桥接 snake_case 别名 `{ input_tokens?: number, output_tokens?: number }`。
- 特性：
  - REST 与 MCP 接口均接受两类字段，存储时会自动规范化（canonicalize）为 `inputTokens` / `outputTokens`。
  - 严格校验数值为非负有界整数，若传入数值不一致的冲突别名（如 `inputTokens` 与 `input_tokens` 不等）将被严格拒绝报错。

---

## Supervisor Token 指标提取与上报安全工作流 (Safe Token Extraction & Reporting Workflow)

在围绕 Supervisor 或自主任务（如 `agy_start`、`agy_status` 等）的执行周期中，智能体应按照以下安全流程提取指标并上报至 `agy_supervisor_event`：

### 1. 精确指标提取 (Exact Metric Extraction)
- **优先从 structuredContent 提取**：
  若桥接工具返回中包含 `structuredContent`，检查其中是否存在 `usage` 对象（例如 `structuredContent.usage` 或 `structuredContent.task.usage`），直接提取精确的 `input_tokens` / `inputTokens` 与 `output_tokens` / `outputTokens`。
- **从嵌套 JSON 文本提取**：
  若上游工具仅在文本中输出（例如 `content[0].text` 或日志输出），解析其中的嵌套 JSON 结构，并严格提取 exact 字段：
  ```javascript
  // 提取示例
  const payload = JSON.parse(rawText);
  const bridgeUsage = payload.usage || payload.task?.usage || {};
  const input = bridgeUsage.input_tokens ?? bridgeUsage.inputTokens;
  const output = bridgeUsage.output_tokens ?? bridgeUsage.outputTokens;
  ```
- **异步桥接结果解包**：修复版 `agy_status` 在任务结果顶层提供 `usage`。若 MCP 包装为 `structuredContent.result` JSON 字符串，应先解析该字符串；没有结构化结果时再解析 `content` 中的 JSON 文本。只读取桥接结果顶层（或明确的 `task` 对象）的真实指标，不能把模型回复 `response` / `text` 中的示例数字当作用量。
- **任务结束时必须转发**：检查 `completed` 或 `failed` 等终态返回的真实 `usage`，逐项映射为 `inputTokens` / `outputTokens` 后传入 `agy_supervisor_event`。即使任务失败，有真实计数也应保留；运行中暂未返回计数时保持缺失。若旧版异步桥接始终不返回计数，参阅 [桥接器修复补丁](../../integrations/agy-bridge/README.md)，不要用估算值替代。
- **保留确切数值**：
  保持上游返回的真实整数值，切勿四舍五入或截断。

### 2. 不可用指标必须保持不可用 (Unavailable Metrics Must Remain Unavailable)
- **严禁推断或臆测指标 (Never Infer Counts)**：
  若桥接输出中未包含 Token 计数，或者字段为 `undefined` / `null`，该指标即为**不可用**。
  - **严禁**通过 prompt 长度、字符数、输出词数或经验公式推算 Token 数量。
  - **严禁**在指标缺失时随意填充默认值（例如私自填 `0`）。
  - **不可用指标必须保持缺失**：在调用 `agy_supervisor_event` 时，省略未提供的字段或直接不传递 `usage`。
- **严格区分“缺失”与“数值 0”**：
  - 仅当上游桥接明确返回数值 `0`（例如确定消耗 0 Token）时，才上报 `0`。
  - 原生监控面板会将未提供的指标清晰呈现为“`未提供`”，并将数值 `0` 明确展示为 `0`，避免信息混淆。

### 3. 严格别名与冲突校验 (Strict Aliases Validation)
- 接口接受 canonical (`inputTokens`, `outputTokens`) 或 snake_case (`input_tokens`, `output_tokens`)。
- 若同时提供同名别名，两者的值必须完全相同；若别名数值存在冲突（如 `{ inputTokens: 100, input_tokens: 200 }`），请求将被服务端与 MCP 严格拦截报错。

### 4. 规范上报示例 (Reporting Examples)

```json
// 示例 1: 任务启动上报（无指标，仅记录状态）
{
  "name": "agy_supervisor_event",
  "arguments": {
    "id": "task-impl-101",
    "model": "gemini-3.8-flash-high",
    "status": "running"
  }
}

// 示例 2: 任务完成，从桥接输出信封提取 exact snake_case 指标
{
  "name": "agy_supervisor_event",
  "arguments": {
    "id": "task-impl-101",
    "status": "completed",
    "usage": {
      "input_tokens": 3200,
      "output_tokens": 850
    }
  }
}

// 示例 3: 任务完成，但上游未提供 Token 指标（保持缺失，面板显示“未提供”）
{
  "name": "agy_supervisor_event",
  "arguments": {
    "id": "task-impl-102",
    "status": "completed"
  }
}

// 示例 4: 仅部分指标可用（如仅输入计数可用）
{
  "name": "agy_supervisor_event",
  "arguments": {
    "id": "task-impl-103",
    "status": "running",
    "usage": {
      "input_tokens": 1200
    }
  }
}
```

---

## 规范与限制

1. **原生组件优先**:
   在支持 MCP Apps 与 UI 资源的 Codex 客户端中，优先使用 `agy_usage_panel` 提供原生界面，避免频繁弹出外部浏览器。
2. **模型名称保留**:
   系统默认模型固定为 `gemini-3.8-flash-high`，严禁擅自修改默认模型 ID。
3. **切勿根据 Token 计数推断配额**:
   Antigravity 配额由官方服务端与 CLI 维护，严禁通过累加 Token 数自行计算剩余配额百分比。配额必须且仅能以 `agy --print /usage` 官方输出为准。
4. **指标不可用时严禁推断**:
   若上游桥接未提供 Token 计数，必须如实保持缺失（面板显示“未提供”），严禁按字符猜测或填充默认值。
5. **保留安全与权限检查**:
   保持默认权限校验，不得要求禁用权限隔离或越权访问认证凭证。
