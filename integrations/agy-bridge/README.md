# AGY Bridge: asynchronous token metrics

[中文说明](#中文说明) · [English](#english)

## 中文说明

部分旧版 [AGY Supervisor / codex-antigravity-bridge](https://github.com/crazyzhang277/codex-antigravity-bridge) 的异步执行没有请求 JSON 输出，`agy_status` 只返回任务正文和状态，因此用量面板无法获得 Token 计数。

此目录提供可选补丁 [token-metrics.patch](token-metrics.patch)，已在上游提交 `d01160dbe45b04f32433b4ddf9549b1608d950b5` 上验证。它让异步任务和协作任务请求 CLI JSON 输出，返回真实的 `usage.input_tokens` / `usage.output_tokens`，并保留任务正文与会话 ID。缺失计数不会被估算，数值 0 会原样保留。

**只对尚未包含此修复、且工作区干净的兼容桥接器源码应用补丁。** 较新版本若已经返回 `usage`，无需应用。检查失败时请保留原文件，勿强行覆盖。

从本用量面板仓库根目录执行，将桥接器路径替换为实际路径：

```bash
bridge_dir="/absolute/path/to/codex-antigravity-bridge"
patch_file="$PWD/integrations/agy-bridge/token-metrics.patch"
git -C "$bridge_dir" status --short
git -C "$bridge_dir" rev-parse HEAD
git -C "$bridge_dir" apply --check "$patch_file"
git -C "$bridge_dir" apply "$patch_file"
```

补丁用于源码安装。若使用非源码安装，应从包含修复的源码重新安装桥接器；不要修改未知的包目录。重启 Codex，让已启动的 MCP 桥接进程重新加载代码。

桥接器返回计数后，Supervisor 仍须在任务结束时将真实值传给 `agy_supervisor_event`；此面板不会自动拦截其他桥接器。具体提取和上报方式见 [agy-usage 技能](../../skills/agy-usage/SKILL.md)。历史任务若未保存原始指标，无法补回。

验证结果：74 项 Python 桥接测试通过。真实异步任务返回输入 12,364、输出 239 Token，向本地面板上报后保存值完全一致。这些数值仅是一次验证任务的结果。

## English

Some older AGY Bridge versions run asynchronous tasks without JSON output and return only task text and status. This leaves the dashboard without exact token counts.

The optional [patch](token-metrics.patch) was verified against upstream revision `d01160dbe45b04f32433b4ddf9549b1608d950b5`. It requests CLI JSON telemetry for asynchronous and collaboration jobs, exposes exact input/output counts, and preserves task text and conversation IDs. Missing counts remain absent; real zeros are preserved.

Apply it only to a compatible, clean source checkout that does not already include this fix. Run the commands above from the dashboard repository, replacing the bridge path. If the applicability check fails, keep the original files and do not force the patch. For other installation methods, reinstall the bridge from patched source instead of editing an unknown package directory. Restart Codex to reload the MCP bridge process.

The Supervisor must still forward the returned counts to `agy_supervisor_event` when reporting the terminal state. The dashboard does not intercept unrelated bridge tasks. Historical counts cannot be recovered without recorded telemetry.

Validation: 74 Python tests passed, followed by a real asynchronous task. Its 12,364 input and 239 output tokens were stored unchanged by the dashboard. These are the results of a single verification task.

## License

This supplemental bridge patch is distributed under Apache-2.0, matching its upstream project. See [LICENSE](LICENSE) and [NOTICE](NOTICE). The dashboard's MIT license remains in the repository root.
