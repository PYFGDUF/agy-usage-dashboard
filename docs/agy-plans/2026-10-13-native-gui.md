Status: READY_FOR_AGY

# Native Codex GUI integration — 2026-10-13

This is a new bounded extension task after the reviewed v1 implementation. User explicitly corrected the requirement to a real Codex GUI component, not a browser tab. The installed client discovers local MCP UI resources and openai/ui global + thread entrypoints. Official reference: https://developers.openai.com/plugins/build/extensions and /chatgpt-ui.

## Ownership and authorization

- Codex root: /Users/pengyufeng/Documents/agy_usage_dashboard_codex
- AGY worktree: /Users/pengyufeng/Documents/agy_usage_dashboard_codex/.worktrees/agy-implementation, same previously authorized plugin workspace; reviewed v1 work preserved, fast-forwarded to this plan.
- Risk: reversible plugin source changes. Model gemini-3.8-flash-high. One implementation task, no concurrent agents.
- Permission: dangerously_skip_permissions=true under user's prior explicit permission “允许，仅限本次插件工作区”. Same exact worktree, same plugin implementation/testing; no app installation or external writes delegated.
- AGY owns src/mcp/server.js, src/ui/**, test/native-ui.test.js, test/mcp.test.js, scripts/smoke-mcp.mjs, README.md, skills/agy-usage/SKILL.md.
- Codex owns this plan, manifests/version/release packaging, client installation, UI validation, docs/verification.md, any review corrections.
- All other files forbidden. Do not change app binaries, global settings, credentials, other projects, existing public web page, collector/parser/task-store. Do not commit/merge/publish. No dependency installation needed.

## Fixed contract

1. Add agy_usage_panel tool, title/annotations.title = AGY 用量. Empty input, readOnlyHint=true, idempotentHint=true. Return existing current /api/status as structuredContent plus concise useful text.
2. Metadata: _meta.ui.resourceUri = ui://agy-usage/panel.html; _meta["openai/ui"] = {entrypoints:[{type:"global"},{type:"thread"}]}; _meta["openai/widgetAccessible"]=true. Data tools continue without UI metadata. If required for UI calling add _meta.ui.visibility:["model","app"] to usage getter.
3. Advertise resources capability; implement resources/list and resources/read using SDK schemas. Only exact URI accepted; text/html;profile=mcp-app. Inline JS/CSS into resource loaded relative to module, independent cwd. No external scripts, CDN, fetch, iframe URL or localhost address in GUI resource. ui.csp.connectDomains and resourceDomains empty.
4. GUI loads data through MCP Apps bridge JSON-RPC postMessage: ui/initialize (protocolVersion=2026-01-26, appInfo{name,version}, appCapabilities{}), then ui/notifications/initialized. Listener verifies event.source === window.parent, JSON-RPC2.0. Handle ui/notifications/tool-result, host-context-changed, teardown. Tool requests tools/call name agy_usage_get arguments {force_refresh:false/true}. Check isError. Request timeout/cleanup, only one in flight, no polling before successful initialization; pause while hidden; 5-second cached polling (CLI remains60s). Do not emit ui/message or use model turn for refresh. Auto-display switch and manual refresh cooldown10s. Send size notification on layout changes, avoid resize feedback loops. Support parent ui/notifications/tool-cancelled if necessary.
5. Accurate Chinese quotas (0% stays0), progressbar, low <=20%, Beijing reset/countdown, connection/loading/empty/error/stale (locally age120s), task receipt timestamps and optional usage. Responsive narrow right panel320px to fullscreen; host light/dark theme from initialize hostContext and host-context-changed. Build concise UI that looks part of app.
6. Skill now instructs native plugin panel/global sidebar, never opens browser automatically. Keep old URL tool only as explicitly requested development fallback. README native installation and opening instructions; no unverified completion claims.

## Verification and report

Run npm test and npm run verify. Add meaningful isolated MCP test for metadata, resource content/mime, rejecting unknown URI, panel typed data, no localhost fetch/external resources. Report changed files, test results, blockers, permission errors. Do not claim native GUI success; Codex verifies actual client after installing.

One initial AGY call plus at most two evidence-based corrections for this native GUI task. Preserve worktree on unknown/timeout. Do not widen ownership.
