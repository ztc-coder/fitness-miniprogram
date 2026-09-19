# 技术设计：Pi 子代理调度迁移

## 边界

| 组件 | 迁移后职责 |
| --- | --- |
| `.pi/extensions/trellis/index.ts` | 注入 Trellis SessionStart、工作流状态、任务上下文和 bash 的 `TRELLIS_CONTEXT_ID`；默认不提供调度工具。 |
| `~/.pi/agent/extensions/pi-interactive-subagents/` | 发现 Agent、启动 tmux pane、持久化 session、派发结果、支持 `subagent_message`。不修改。 |
| `.pi/agents/trellis-implement.md`、`.pi/agents/trellis-check.md` | 定义自主子代理角色和主动读取 Trellis task 工件的规则。 |
| `.trellis/workflow.md`、`.pi/prompts/trellis-*.md` | 指导 Pi 主会话使用正确的 `subagent` 调用契约。 |

## Dispatch Contract

Pi 主会话按全局扩展的接口调用：

```ts
subagent({
  agent: "trellis-implement",
  name: "trellis-implement",
  task: "Active task: .trellis/tasks/<task>\n\n..."
})
```

- 使用 `task`，不使用 Trellis 原生工具的 `prompt`。
- 并行工作由主会话发起多个独立 `subagent` 调用；串行依赖等待前一个 `subagent_result` 后继续。
- 子代理从派发首行解析 task path；缺失时仍可运行 `task.py current --source` 兜底。

## Native Fallback

将原生调度工具和其 `Alt+O` progress-card 快捷键放入同一条件：

```ts
process.env.TRELLIS_NATIVE_SUBAGENT === "1"
```

默认路径不注册该工具，避免模型同时看到两个调度入口。回退只影响工具注册，不影响上下文注入事件；移除环境变量并重启 Pi 即恢复全局调度路径。

## Compatibility

- 不移动或改名 `.pi/agents/trellis-*.md`，因此项目级覆盖优先级保持不变。
- 仅调整 Pi 专属工作流文字；其他平台继续使用各自原生 Agent/Task 工具。
- 不向项目 `.pi/settings.json` 添加全局扩展路径，避免同一扩展因自动发现和显式路径重复加载。

## Validation Shape

1. 静态搜索确认 `before_agent_start`、`tool_call` 和任务上下文构建仍在 Trellis 扩展中。
2. 用实际 Pi CLI 在默认和回退环境各启动一次，检查可见工具与项目 Agent 发现结果。
3. 对修改的 TypeScript/Markdown 执行可用的项目测试与语法检查；不运行生产构建。
