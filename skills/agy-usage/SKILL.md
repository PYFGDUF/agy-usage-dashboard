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
  - `usage` (对象，可选): `{ inputTokens?: number, outputTokens?: number }`。

```json
// 任务启动上报示例
{
  "name": "agy_supervisor_event",
  "arguments": {
    "id": "task-impl-101",
    "model": "gemini-3.8-flash-high",
    "status": "running"
  }
}

// 任务结束上报示例
{
  "name": "agy_supervisor_event",
  "arguments": {
    "id": "task-impl-101",
    "status": "completed",
    "usage": {
      "inputTokens": 3200,
      "outputTokens": 850
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
4. **保留安全与权限检查**:
   保持默认权限校验，不得要求禁用权限隔离或越权访问认证凭证。
