# AGY Development Plan: Native quota panel visual refinement

Status: READY_FOR_AGY
Created: 2026-10-13
Project: /Users/pengyufeng/Documents/agy_usage_dashboard_codex
Task risk class: code changes, reversible single-file UI refinement
Authorization: User explicitly invoked AGY Supervisor for this UI task. Earlier permission explicitly permits dangerously_skip_permissions=true only for this plugin workspace at the exact AGY worktree below; this remains the same plugin project and workspace.

## Baseline and ownership

Codex worktree: /Users/pengyufeng/Documents/agy_usage_dashboard_codex
AGY worktree: /Users/pengyufeng/Documents/agy_usage_dashboard_codex/.worktrees/agy-implementation
AGY branch: agy/usage-plugin
Baseline: both clean before synchronization; AGY branch will fast-forward to the committed main plan baseline before delegation.
Codex owns this plan and final integration, installation, visual verification.
AGY owns only src/ui/panel.html. Do not modify or commit the plan.

## Goal and design

Improve the existing native Codex MCP Apps quota panel with a restrained premium appearance. Prefer graphite neutrals in dark mode, warm white in light mode, and one desaturated sage accent. Remove neon cyan/lime gradients, colored border proliferation, glows, and excessive badges. Distinguish hierarchy using type size/weight, whitespace, thin neutral dividers, generous but compact card padding. Make percentage values the focus, secondary reset time/countdown quiet but readable. Keep all existing functions and accurate CLI quota data.

Palette starting point (adjust contrast if needed): dark #1b1b1d canvas, #222225 surface, #343438 separators, #f3f3f3 primary text, #a2a2a7 secondary, #a6b7a0 sage. Light #f7f7f5 canvas, #ffffff surface, #e4e4e1 separators, #252528 primary, #64646b secondary, #657860 sage. Warning amber and muted terracotta red only for semantic alerts.

## File boundaries and forbidden operations

Allowed: src/ui/panel.html CSS, HTML, UI-only render markup/copy and small accessibility improvements.
Forbidden: other project files, backend/data model, quota collection, RPC/bridge protocol or lifecycle behavior, dependency/manifest/version changes, credentials, global configuration, external network/resources, publication, destructive commands, automatic merge/cleanup. No git commits by AGY. No access outside the assigned worktree except the configured agent/runtime required to execute the tool itself.

## Acceptance

- Light and dark themes respect existing host theme events.
- No neon colors, gradients, glows or decorative animation; focus indicators remain visible.
- 320px/420px right panels and wide layouts render without document-level horizontal overflow; reset labels, countdowns and task note wrap gracefully; task table may scroll inside its region.
- Existing identifiers, bridge initialization, tools/call, single request/polling, hidden/teardown behavior and refresh cooldown remain intact.
- 0%, <=20%, missing/empty/error/stale states remain accurate and visible, progressbar semantics preserved.
- No new external dependencies or assets. User copy must avoid implementation details like enumerating bridge jobs.

## Verification commands

Run node --test test/native-ui.test.js in the assigned worktree; report exact results. Run git diff --check and git diff --name-only. Do not add superficial style tests. Codex will inspect real browser rendering with an isolated MCP Apps host harness at narrow/wide sizes, light/dark themes, low/zero quota, and interactions before integration.

## Permission and correction budget

Permission mode: dangerously_skip_permissions=true, using the user's existing exact-plugin-workspace authorization.
One initial call and at most two corrections. Corrections retain the same worktree, owned file and permission mode. Preserve worktree if unknown, timeout, permission/authentication errors or failures.

## Report contract

Return changed files, design choices, test output summary, final status, blockers and permission errors. Do not claim actual native-client visual success; Codex verifies that separately.
