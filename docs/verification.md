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
