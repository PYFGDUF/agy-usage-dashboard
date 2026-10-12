# AGY Development Plan: Antigravity Usage for Codex

Status: READY_FOR_AGY
Created: 2026-10-12 (Asia/Shanghai)
Project: /Users/pengyufeng/Documents/agy_usage_dashboard_codex
Task risk class: code_changes
Authorization: The user requested this local plugin and explicitly delegated primary implementation to Gemini 3.8 Flash High. Permission bypass is NOT authorized.

## Baseline and worktrees

The project was empty. Codex root branch: main.
AGY worktree: /Users/pengyufeng/Documents/agy_usage_dashboard_codex/.worktrees/agy-implementation
AGY branch: agy/usage-plugin
Delegation: existing bridge agy_start through a caller-owned MCP client. Its AGY_PATH wrapper pins --model gemini-3.8-flash-high. Keep dangerously_skip_permissions=false and all default permission checks.
No parallel implementation track: AGY writes the implementation; Codex writes only this plan, review notes, external QA evidence and later fixes after AGY stops.

## Goal

Build a complete macOS-first local Codex plugin providing real Antigravity quota monitoring in an attractive Chinese dashboard, read-only MCP quota tools and an explicit Supervisor task-event integration. Use Node 24 and vanilla HTML/CSS/JS, no frontend build tool. Pin the MCP SDK to the version recorded in the delegation prompt and commit a lockfile. No external assets or CDN.

## Verified upstream behavior

- `agy --print /usage --print-timeout 15s` returns TAB-separated group, window label, remaining percent, UTC reset time. This is a CLI-handled query, no model task.
- Example syntax (test fixture ONLY): `Gemini Models\tWeekly Limit Remaining\t85%\t2026-10-15T08:29:26Z`.
- Groups currently Gemini Models and Claude and GPT models; weekly and five-hour windows.
- Model id: gemini-3.8-flash-high. CLI 1.3.3 installed.
- Official docs: https://www.antigravity.google/docs/cli/headless/ and https://www.antigravity.google/docs/cli/commands/usage . Never infer quota from task token counts.

## File ownership

AGY exclusively owns package.json, package-lock.json, README.md, src/**, public/**, test/**, scripts/**, skills/**, .codex-plugin/** and .mcp.json.
Codex owns docs/** and .gitignore. Forbidden: .git internals except ordinary status/diff commands, docs/** edits, parent worktree, global Codex/AGY configuration, credentials, auth files, other repositories. Do not commit, push, publish, install global packages, change model defaults, disable permissions or start another agent. Do not read or store private machine configuration or tokens.

## Shared contracts and behavior

- Main local HTTP service defaults to http://127.0.0.1:8766, listens ONLY on loopback. /api/health identifies `agy-usage-dashboard`.
- npm start starts the service; npm run mcp starts a stdio MCP server; npm test runs meaningful Node tests. MCP stdout is reserved for the protocol.
- MCP server calls the same HTTP collector used by the browser and may start it if absent. Use absolute module paths derived from import.meta.url, no caller-cwd assumptions. Verify app identity before using an existing port. Avoid refresh duplication when UI and MCP read simultaneously.
- GET /api/status returns {schemaVersion:1, connection:{state,error}, usage:{source,updatedAt,stale,refreshIntervalSeconds,windows}, tasks}. windows items: {id,group,window,remainingPercent,resetsAt}. Percent is 0..100; UTC ISO timestamps. connection state ready|refreshing|error|unavailable. stale becomes true after 120 seconds or refresh failure.
- POST /api/refresh triggers one shared deduplicated refresh; actual quota process interval >=30 seconds (default 60), manual refresh cooldown >=10 seconds. Concurrent requests must join the same pending promise. Cached reads never invoke a model. Use execFile/spawn with array args, never shell. Resolve agy from AGY_PATH or PATH and common user-local bin without copying auth. Set per-process logs inside local .runtime, timeout <=25s, bounded output. Retain previous successful windows on error; mark stale and record a short sanitized diagnostic. Empty/malformed output and permission failures are errors even with exit zero.
- Only sanitized quota/task metadata persisted atomically to .runtime; no prompts, model output, raw logs or personal account data exposed in APIs. Tests may use fixtures; runtime must never silently substitute fake data. Date display Asia/Shanghai; passed reset timestamps show awaiting refresh rather than inventing a new allowance.
- POST /api/tasks and MCP agy_supervisor_event record explicit job events. Input id (bounded), model (default known id), status queued|running|completed|failed|unknown, optional bounded usage counters. Server timestamps events; maintain start/end time and retain <=100 tasks. Never spawn model tasks through these tools. Label task list as Supervisor-reported events; absent events show a truthful empty state. Existing bridge is unmodified and not auto-enumerated. Do not claim automatic tracking of all bridge tasks.
- Protect loopback endpoints against unrelated origins/Host headers and JSON body abuse: allow same-origin dashboard writes and MCP Node clients without Origin, bounded bodies; reject cross-origin writes, DNS rebinding, traversal, wrong methods. No wildcard CORS.
- Tools: agy_usage_get(force_refresh=false), agy_dashboard_open() returning local URL and state, agy_supervisor_event(...). Use official @modelcontextprotocol/sdk, structuredContent and text summaries, read-only annotations for reads. Skill explains quota-before-delegation and optional matching task events around agy_start/agy_status. Preserve permission checks and model id.
- Provide .codex-plugin/plugin.json manifest and .mcp.json with plugin-root placeholder support if documented; otherwise document clearly generated absolute-path registration using scripts/install.mjs and `codex mcp add`. The install script should only register this MCP and local usage skill, never modify existing Supervisor/bridge; default should print the commands/config, explicit flag may install. Keep portable packaging separate from machine-specific registration.

## UI acceptance

Chinese-first polished dashboard: dark graphite palette, cyan/lime quota bars, two model-group cards each with weekly and five-hour progress and reset countdown, refresh and auto-update controls, updated-at/freshness/error label, low allowance threshold (20%), compact header AGY / Usage with Supervisor integration, honest task list and token counters when known. Responsive at 390px and 1440px, accessible keyboard focus and button labels, aria status, reduced-motion support. Visible errors and unavailable first load. No implementation secrets in UI. Real quota displayed from service, refresh visibly progresses, controls function. Do not overbuild charts with invented history.

## Verification commands

Run npm install --no-audit --no-fund (pin dependencies), npm test, npm run verify if provided. Tests must cover real TSV parsing including 0%, malformed/empty output, stale-on-failure cache, timeout and refresh concurrency, API origin/Host/body/route checks, task event validation. Add a stdio MCP smoke script using SDK Client: initialize, list_tools, call usage, dashboard and one explicit test job event, then close. Tests must use fixture executables and an isolated state directory; never burn real model tokens. Real CLI quota and browser runtime acceptance are Codex's final checks.

## Permission and call limits

dangerously_skip_permissions=false. If edits or commands are denied, STOP and report exact permission error. Do not work around permission denial. Three total AGY implementation calls maximum: initial plus two evidence-based corrections with unchanged worktree/ownership/permissions.

## Report and lifecycle

Return final status, changed files, exact test output, blockers/permission errors, dependency version, startup/MCP commands and limitations. Leave edits uncommitted for Codex audit. Codex audits git status --short, git diff --check, git diff --name-only, git worktree list, tests and runtime before committing and merging. Preserve unverified worktree on failure. Never auto-merge or clean it.
