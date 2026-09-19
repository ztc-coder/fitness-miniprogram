# Pi 调度架构调查

调查日期：2026-09-19

## 结论

项目 Trellis 扩展的 `trellis_subagent` 是独立的进程内实现：它构造 `pi --mode json -p --no-session` 子进程，并以 `TRELLIS_SUBAGENT_CHILD=1` 避免子进程再次加载自身。该路径不调用全局 `pi-interactive-subagents` 的 `subagent` 工具。

全局扩展已自动发现，负责 Agent 定义优先级、tmux pane、session 文件、结果回传、fallback model 和 `subagent_message`。项目 `.pi/agents/trellis-implement.md` 与 `.pi/agents/trellis-check.md` 已符合其项目级覆盖位置，但需要自动退出配置。

## 迁移原则

1. 不耦合两个扩展的内部实现；它们各自注册工具。
2. Trellis 保留上下文注入，子代理通过派发首行和 Agent pull 规则取得 task context。
3. 默认只暴露一个调度工具，避免模型在 `trellis_subagent` 与 `subagent` 之间随机选择。
4. 旧工具保留环境变量回退，便于处理全局扩展或 tmux 不可用的故障。

## 证据位置

- `.pi/extensions/trellis/index.ts`: `buildContext()`、`before_agent_start`、`trellis_subagent` 注册和 `TRELLIS_SUBAGENT_CHILD` guard。
- `~/.pi/agent/extensions/pi-interactive-subagents/index.ts`: `subagent` 注册、项目 Agent 覆盖发现、`auto-exit` 关闭与结果回传。
- `.pi/agents/trellis-implement.md`、`.pi/agents/trellis-check.md`: `Active task:` 和 task 工件加载规则。
