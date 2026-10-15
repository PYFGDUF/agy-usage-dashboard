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

## Native panel UI refinement (2026-10-13)

- Explicit Supervisor task, exact existing worktree and permission authorization reused. Gemini 3.8 Flash High jobs `6fb06baeba5e40418b561052423352e2` and corrective call `93acc50094b046379af8d2caa0ab2b3f` both completed with exit 0, usable reports and no permission errors. Only `src/ui/panel.html` was modified by AGY; Codex calibrated three semantic/secondary color tokens after independent contrast review. Two calls total; no further delegation.
- Replaced neon gradients with graphite/warm-white neutrals and a sage accent, enlarged percentage typography, simplified the header/empty state, improved spacing and narrow-layout wrapping, and added visible focus/reduced-motion styles. The embedded bridge script is byte-for-byte unchanged from the baseline; backend, collector, manifests and version remain unchanged.
- Independent `npm run verify` passed all 40 existing tests and isolated MCP smoke. Final browser rendering used the actual self-contained panel HTML in an isolated MCP Apps host harness, with example quota/task data. Five scenarios passed: dark 420px, light 1024px, dark/light 320px with 0%/20%/error/stale and all task statuses, and light 320px empty state. Document widths matched viewport widths, no console/page errors; auto-sync off/on, manual refresh/cooldown, host theme changes and error dismissal passed. Checked small text contrast minimum 4.53:1 across these scenarios.
- Preview evidence (example data): ignored local `artifacts/native-panel-dark.png` and `artifacts/native-panel-light.png`. These are browser-rendered component previews, not a capture of the Codex shell.
- Integrated source commit `574d4d1`. Synchronized only the panel HTML into the installed local `agy-usage-dashboard/1.1.0` cache, with the prior resource backed up under `/private/tmp/agy-installed-panel-before-ui-refinement.html`. An SDK client from an unrelated cwd read the installed `ui://agy-usage/panel.html` resource and confirmed exact equality with reviewed source (43,271 bytes, SHA-256 `dbbb8cf71df946d26f905a924b071ebd3a9323832c2ca48bdb1370c2d2c62e34`).
- Existing open panels keep their loaded HTML until reopened. Actual Codex shell capture remains unavailable because the MCP Apps surface exposes no tab for this chat. No app binary, global settings, external publication or standalone browser product was changed. Worktree retained for continued plugin development.


## 2026-10-14 — Bilingual interface, version 1.2.0

- Added Chinese/English selection to the native MCP Apps component and browser fallback, with stored preference, navigator-language fallback, and defensive storage handling. English timestamps remain in Asia/Shanghai and explicitly show UTC+8.
- AGY implemented the bounded UI changes in the retained implementation worktree. A corrective AGY call timed out after partially fixing native error state; Codex inspected those changes, completed the browser counterpart, and independently verified the final source. The worktree is retained.
- Final `npm run verify`: 58 tests passed, zero failures, plus the stdio MCP smoke test. Regression checks cover missing versus zero tokens, dynamic language/cooldown changes, storage restrictions, and errors surviving language changes without resurrecting dismissed banners.
- Headless Chrome exercised the actual native HTML through a mocked MCP parent at 360px and 1000px in both themes; language switching, persistence, UTC+8 labels, missing/zero counts, local error translation, and document overflow checks passed. The browser fallback was also exercised at both widths. These checks do not claim direct automation of the Codex app shell.
- Refreshed example-data screenshots for both README languages. Installed 1.2.0 through the configured local marketplace; the installed panel hash matches reviewed source, and the installed cache passed an isolated stdio MCP smoke test. Existing open panels may require reopening or a client restart to load the updated resource.


## 2026-10-14 — Follow Codex mode, version 1.3.0

- Added native-panel auto mode using the optional MCP Apps `hostContext.locale` from initialization and partial `ui/notifications/host-context-changed` updates. Fresh installations default to auto; stored manual overrides remain intact. Missing/invalid host locale falls back to navigator language. Automatic detection never saves a detected language as a manual preference.
- Protocol reference: https://apps.extensions.modelcontextprotocol.io/api/interfaces/types.McpUiHostContext.html . The locale field is optional; this does not establish that every Codex version emits its selected UI language.
- Final verification: 61 tests passed, zero failures, plus stdio MCP smoke. Browser-rendered native-component checks at 360px/1000px in light/dark themes simulated differing browser/host locales, live host updates, manual overrides, persisted auto mode, and missing locale; no document overflow or runtime errors. Actual current Codex-shell locale emission has not been directly observed.
- Installed 1.3.0 from the local marketplace and verified the cached panel hash equals reviewed source. Reopen the panel or restart Codex to load the new resource.


## 2026-10-14 — Async bridge Token telemetry fix

- Root cause: older AGY Bridge asynchronous jobs requested text output and returned no exact counters. The dashboard correctly retained empty usage.
- AGY implemented a bounded patch in an isolated public-source snapshot inside the previously authorized plugin worktree. Boundary checks confirmed no existing plugin files were changed by AGY. Codex tightened envelope recognition and diagnostic detection to prevent fabricated JSON metrics and false failures from prose mentioning authentication/permission tests.
- Reviewed patch applied to the live editable bridge on local branch `codex/async-token-metrics`, local commit `561491e`. No push to the upstream bridge repository was performed. Existing MCP processes must be restarted to load it.
- Bridge verification: 74 Python tests passed in the live source. The exported patch was also applied to a clean archive of upstream d01160d and reproduced 74 passing tests.
- A fresh stdio MCP process ran a real read-only asynchronous task: `bridge-token-proof-20261014`, reply `AGY_TOKEN_OK`, input 12,364 / output 239. These CLI telemetry values were forwarded unchanged to the active local dashboard; subsequent GET /api/status confirmed the same stored counters. This verifies a new task, not recovery of old task counts.
- Supplemental Apache-2.0 patch, upstream license and notice are in `integrations/agy-bridge/`. Reporting instructions were refreshed in the installed 1.3.0 plugin skill. The implementation job itself started under the old bridge and returned no telemetry, so its missing counters were not fabricated.


## 2026-10-15 — Native panel visual refinement, version 1.3.1

- Refined the native MCP Apps panel with graphite/warm-white surfaces, restrained champagne accents, larger quota values, quieter progress bars, a compact toolbar, and responsive task records. Added explicit section/table labels, a keyboard-focusable scrolling task region, reduced-motion handling and stronger light-theme text contrast.
- Updated existing UI assertions to tolerate styled percent units and translated responsive cell labels, preserving zero quota, zero/missing token, cached data and language-switch coverage.
- `npm run verify`: 61 tests passed; dependency/manifest checks and stdio MCP smoke test passed. `git diff --check` passed.
- Isolated Chromium MCP Apps host preview: 12 combinations of 320/420/1000px, light/dark, Chinese/English passed, with no document overflow or page errors. Exercised refresh, auto-sync toggle, manual/automatic language selection, long task IDs, 0%/20% alerts, stale/error/dismissal and empty states. These checks exercise the actual panel resource inside a simulated host; they do not establish rendering inside a freshly restarted Codex desktop shell.
- Installed 1.3.1 through the existing local marketplace and compared cached UI/version files byte-for-byte with reviewed source. Reopen the native panel; restart Codex if the previous resource remains cached.
- Screenshots, render results and logs remain local under ignored `artifacts/ui-refinement-20261015/`.


## 2026-10-15 — Same-style UI polish, version 1.3.2

- Preserved every light/dark palette token from 1.3.1. Reduced duplicated quota divider spacing, prioritized reset countdowns, aligned exact reset dates inline where space permits, and gave narrow card headings a consistent title/subtitle layout. Right-aligned desktop task numbers and dates and added a quiet footer divider.
- Stabilized the refresh control across English refresh/cooldown labels. At <=360px it becomes an icon button while retaining its accessible label and tooltip. Keyboard focus remains immediate. Forced-colors mode uses a native checkbox.
- `npm run verify`: 61 tests passed plus stdio MCP smoke checks. Isolated Chromium host preview: 12 width/theme/language combinations passed, including empty/error/stale/0%/20%, long IDs, zero/missing Token counts, refresh/cooldown width, keyboard Tab/Space, forced-colors and reduced-motion checks. Palette comparison and `git diff --check` passed.
- Installed local 1.3.2; cached native UI and version files match reviewed source. Fresh rendering within the actual Codex shell still requires reopening the panel or restarting Codex when cached. Preview fixtures and evidence remain ignored under `artifacts/ui-polish-20261015/`.


## 2026-10-15 — Native panel composition refinement, version 1.3.3

- Preserved existing graphite/warm-white/champagne color tokens. Replaced the quota card's vertical form-like rows with equal metric columns, a light divider, 44px values and 16px percentage units. Grouped language/auto-sync controls into a single settings group and retained the separate refresh action. Added only a restrained inset surface edge.
- Compact countdown and date text reduces repeated metadata; complete timestamps, timezone and precise countdown descriptions remain in titles and accessible labels. Explicit Token metrics are unchanged. Narrow task lists now flow with the panel rather than clipping inside a 280px scroll area; long IDs use two visual lines and retain full titles.
- `npm run verify`: 61 tests plus stdio MCP smoke checks passed. Isolated Chromium host: 12 combinations of 320/420/1000px, Chinese/English and dark/light passed; verified equal column widths, aligned progress bars, complete narrow task lists, full reset timestamp availability, keyboard/forced-colors/reduced-motion, refresh/cooldown, 0%/20% warnings and empty/error/stale states. `git diff --check` and palette comparison passed.
- Independent screenshot/source design review found no blocking issues. This remains simulated-host rendering evidence; actual Codex shell rendering after reopening is not independently established here.
- Installed local 1.3.3 and verified cached UI/version files match source. Fixtures, screenshots and logs remain ignored under `artifacts/ui-craft-20261015/`.
