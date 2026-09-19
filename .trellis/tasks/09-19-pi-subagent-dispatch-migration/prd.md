# Pi 子代理调度迁移

## Goal

Pi 主会话使用全局 `pi-interactive-subagents` 提供的 `subagent` 工具调度 Trellis Agent；Trellis 项目扩展继续提供任务、工作流和规格上下文注入。

## Confirmed Facts

- `.pi/extensions/trellis/index.ts` 同时承担上下文注入和原生 `trellis_subagent` 子进程调度；后者通过 `pi --mode json -p --no-session` 启动，不经过全局扩展的 tmux、会话、模型 fallback 或 `subagent_message` 生命周期。
- 全局 `~/.pi/agent/extensions/pi-interactive-subagents/index.ts` 自动发现并注册 `subagent`、`subagent_message`、`subagent_interrupt` 和 `subagents_list`。
- 项目 `.pi/agents/trellis-implement.md`、`.pi/agents/trellis-check.md` 会覆盖全局同名 Agent；两者已经包含 `Active task:` 优先、再调用 `task.py current --source` 的上下文拉取规则。
- 全局扩展只有 Agent frontmatter 含 `auto-exit: true` 时才会在自主任务结束后关闭子代理并向主会话发送结果。

## Requirements

1. 默认不注册 Trellis 内置 `trellis_subagent`，使主会话只使用全局 `subagent` 作为 Pi 子代理调度入口。
2. 保留一个显式环境变量回退路径：仅 `TRELLIS_NATIVE_SUBAGENT=1` 时注册旧 `trellis_subagent` 和其进度快捷键。
3. 保留 Trellis 扩展的 SessionStart、`before_agent_start`、工作流状态、任务上下文和 `TRELLIS_CONTEXT_ID` 注入行为。
4. 将项目 `trellis-implement` 与 `trellis-check` 配置为独立、自主、自动退出的全局扩展 Agent。
5. Pi 专属工作流说明必须要求调用 `subagent({ agent, task, ... })`，并且派发文本首行保留 `Active task: <task path>`。
6. 不修改全局 `pi-interactive-subagents` 源码，不改变其全局模型设置，也不改变非 Pi 平台的调度语义。

## Acceptance Criteria

- [ ] 默认启动时，Trellis 扩展不注册 `trellis_subagent`；设定 `TRELLIS_NATIVE_SUBAGENT=1` 时可注册它作为紧急回退。
- [ ] 默认启动时，`subagent` 可发现项目 `trellis-implement` 和 `trellis-check` Agent。
- [ ] 两个 Trellis Agent 均显式声明 `auto-exit: true`、`interactive: false`、`session-mode: standalone` 和 `system-prompt: append`。
- [ ] Pi 调度说明使用 `subagent` 的 `task` 参数，不再把 `trellis_subagent` 或 `prompt` 当作 Pi 默认接口。
- [ ] 派发约束仍要求首行 `Active task: <task path>`，并保留 Agent 内主动读取任务工件的兜底机制。
- [ ] 静态检查确认 Trellis 上下文注入事件仍存在；最小 Pi 启动检查确认工具注册结果符合默认和回退两种模式。

## Out of Scope

- 修改 `/Users/ztc/.pi/agent/extensions/pi-interactive-subagents/` 的实现。
- 修改 `/Users/ztc/.pi/agent/settings.json` 的模型、provider 或 fallback 配置。
- 迁移其他 AI 平台的 Trellis 代理实现。
- 删除 Trellis 原生调度器的死代码或重构其进度卡实现。

## Risks and Deferred Items

- 全局扩展依赖 tmux；实际派发验证需本机 tmux 和持久 Pi session。若环境不满足，保留静态启动检查并记录限制。
- 全局扩展的 Agent 定义加载依赖 Pi 自动发现行为；验证应使用实际 Pi CLI，而非仅检查文件存在。

## Open Questions

无。用户已指定仅迁移 Pi 项目调度，且全局扩展源码与模型配置不在范围内。
