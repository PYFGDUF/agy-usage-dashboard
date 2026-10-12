# Release acceptance

Target: macOS, Node 24, AGY CLI 1.3.3, model gemini-3.8-flash-high.

The independent final checks must establish:

1. Clean locked-dependency install; parser/cache/concurrency/error/API/MCP tests pass.
2. Live quota query returns all four windows, no model prompt, truthful zero and stale behavior.
3. Dashboard shows the service's current values, reset time in Asia/Shanghai, fresh timestamp, visible refreshing state and errors; 1440px and 390px layouts do not overflow.
4. Refresh, automatic update toggle, keyboard focus and responsive layout work in a real browser; no browser console exceptions.
5. MCP initialize/list_tools/get quota/open URL/task event flow works from an unrelated working directory; stdout is valid protocol only.
6. Dashboard and MCP share one quota collector; duplicate reads do not cause independent query subprocesses.
7. No global Supervisor settings or credentials are altered; no fake runtime data or unsupported promise of automatic bridge job tracking.
8. Installation is reviewable, registers only this plugin's MCP/skill and points to the final root rather than a temporary worktree.

## Initial delegation audit

AGY job d669b42e82a04061bdd2ba71dfaa96fb, pinned model gemini-3.8-flash-high, permission bypass false.
Bridge reported completed / exit 0; envelope contained empty response and denied_actions RunCommand. This is permission_blocked, not succeeded. No implementation files were created. Isolated worktree retained; exact-worktree authorization requested before any permission-bypass retry.

## Permission recovery

The human user explicitly answered "允许，仅限本次插件工作区" to authorization of dangerously_skip_permissions=true for /Users/pengyufeng/Documents/agy_usage_dashboard_codex/.worktrees/agy-implementation, solely for this quota plugin implementation and testing. No global configuration, credentials, or publishing are authorized. This new authorization supersedes the initial false-mode instruction for the permitted corrective call.

Corrective call 1: AGY job be19179ed14f41e0b9f6a1da99240ae9. Same file ownership, worktree and model. Permission bypass true, confined by task contract and audited before acceptance.

## Baseline review

The first implementation returned exit 0, a usable report, no denied_actions. Independent `npm test` passed 25 tests. Acceptance remained incomplete: malformed partial quota and duplicate parser rows were accepted; UI initially refreshed cached state only every 60 seconds; installer did not actually register Codex MCP; test service isolation, origins, throttling and diagnostics required correction. Final corrective call job 8bcaceabc3c14a258b6baa7641dfe9a9 keeps the same ownership/worktree/model with the authorized permission setting. No fourth AGY implementation call is permitted.

## Final result (2026-10-13, Asia/Shanghai)

- Final AGY status became unavailable: controller exec session no longer existed, status snapshot stopped at 2026-10-12T16:09Z, no final report was captured. Treat the job as unknown, not AGY succeeded. OS process inspection confirmed no AGY worker remained. Worktree and branch retained for audit; no restart or fourth call.
- Codex audited the owned paths, committed c8e7a7a and fast-forward merged to main. Added final plugin cwd, installer failure exit status, Codex panel guidance and truthful report-time labels.
- Clean `npm ci --no-audit --no-fund` in the final root succeeded. `npm run verify` passed all 33 tests and isolated stdio MCP smoke.
- Live MCP from unrelated /tmp cwd started the real root service, fetched four quota windows, ready/error=null/stale=false. Snapshot at 2026-10-13 00:33 CST: Gemini weekly 79%, five-hour 47%; Claude/GPT weekly 48%, five-hour 100%. These values change and are not runtime fixtures.
- Installed and enabled agy-usage-dashboard@agy-usage-local via supported Codex local marketplace. Verified the cached installed MCP itself, then called native mcp__agy_usage tools in this chat. Removed only the temporary duplicate global MCP entry. Original codex-agy-bridge remained enabled.
- Browser verified current quotas, Beijing reset times, automatic display toggle off/on, manual refresh busy/cooldown behavior, true Supervisor receipt with CLI-reported input/output counters, and no warning/error console logs. Responsive checks: document scroll width equals 390 and 1440 respectively. Default viewport restored; browser tab retained and shown.
- Runtime service uses one shared loopback collector. It continues until stopped; MCP can start it when absent. Existing bridge tasks are not automatically enumerated. Only explicit events are shown.
- Evidence image: artifacts/dashboard.jpg (ignored local artifact, actual live dashboard).

The working AGY branch/worktree are retained because its final report was unknown even though the code was independently accepted. No Windows runtime claim or public publication is made.

## Native GUI extension task (2026-10-13)

User clarified that a browser tab does not satisfy the requirement. New bounded task: MCP Apps resource, local global/sidebar and thread/panel entrypoints, UI tools/call reads without model turns or direct browser HTTP fetch.

Client compatibility evidence: official plugin extension docs expose _meta.ui.resourceUri and openai/ui global/thread entrypoints. Read-only inspection of the installed app's bundled discovery code confirms local server/pluginId paths, local Codex thread panel support, text/html;profile=mcp-app resources, and UI bridge tools/call. No app binary or feature flag was modified.

Same previously authorized .worktrees/agy-implementation was clean and fast-forwarded to reviewed parent + new plan. New task initial job e38405bf57184e518edc1635f264c67c exited1 before implementation because sandbox blocked ephemeral localhost bind. Correction1 job a991a368e6aa43448fefab2cd1b47d13 runs in the authorized worktree with the same model/permission scope and host execution approved by auto-review. At most one remaining AGY correction.

Native app computer automation was denied for com.openai.codex. This prevents automated clicks on the Codex sidebar; it does not justify app UI scripting, binary patching or a false visual acceptance claim. The MCP Apps browser surface remains available for an opened widget. Final installation and native display are pending.

Correction1 returned exit0 with usable report, no permission errors. Reported34 tests and SDK smoke passed. Independent runtime node:vm probe identified protocol defects not covered by string assertions: direct tool-result notification failed to render0%; standard ui/resource-teardown request received no acknowledgement and left3timers. Code was not accepted as GUI-ready.

Final correction2 job023ca09e4bab4c3cbe46123d857bcfaa: same worktree/permission/model/ownership, targeted to src/ui/panel.html and test/native-ui.test.js. Correct notification shapes, independent request correlation, graceful teardown, connection-error visibility, refresh states, and resize behavior. Meaningful runtime bridge tests required. No fourth native-GUI delegation permitted.

## Native extension implementation and installation result

- Final AGY correction returned completed/exit0 with usable report and no denied actions. Runtime probe independently returned true/true/0 for standard0% notification, teardown acknowledgement and remaining timers. Audited only7 allowed implementation paths; committed4f994ff and fast-forwarded main. Worktree retained. No fourth call.
- Root version bumped to1.1.0. The first root verification found one prior hard-coded health test expecting1.0.0. Changed that assertion to package.json's declared version, then final npm run verify independently passed40 tests plus isolated stdio MCP smoke.
- Installed1.1.0 via codex plugin add agy-usage-dashboard@agy-usage-local. codex mcp list resolves agy-usage cwd to installed cache1.1.0, enabled=true.
- From /tmp, an SDK client connected to the installed cache itself: serverVersion1.1.0, ui://agy-usage/panel.html MIME text/html;profile=mcp-app, both global/thread entrypoints, self-contained38449-byte UI, real4 quota windows and5 Supervisor events. Snapshot 2026-10-13 01:14 CST: Gemini weekly78%, five-hour36%; Claude/GPT weekly48%, five-hour100%, ready/error=null. This changes over time.
- Actual Codex main-sidebar clicking remains unavailable to computer automation. Asked user to open AGY 用量 in right-side Plugins and MCPs / More tools or left plugin entry. Current chat's tool catalog still lists the old3 tools until host reload; actual GUI visibility, theme/responsive rendering and native controls have not yet been visually verified. These are pending, not inferred from protocol tests or prior browser screenshot.
- Source and metadata use standard MCP Apps. Browser URL remains only an explicit development fallback, no automatic browser opening; no host binary patch or global Supervisor configuration changed.

## Human confirmation of native GUI (2026-10-13)

User explicitly replied “已打开，能看到配额” after the1.1.0 native GUI opening request. This confirms the user can see quota inside Codex. MCP Apps automation still reports no current-chat side-panel tab, so it cannot capture or operate that opened view. Do not claim automatic visual, theme/responsive or native control verification; protocol/runtime tests and installed live-data verification passed, and actual display is human-confirmed.
