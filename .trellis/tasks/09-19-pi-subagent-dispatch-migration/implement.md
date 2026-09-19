# 实施计划：Pi 子代理调度迁移

1. 读取 `trellis-before-dev` 指引和现有 Trellis 扩展注册范围；搜索所有 Pi 专属调度说明。
2. 在 `.pi/extensions/trellis/index.ts` 增加 `TRELLIS_NATIVE_SUBAGENT` 开关，并将原生 `Alt+O` 与 `trellis_subagent` 注册包在同一开关内；不得改变上下文注入事件。
3. 更新 `.pi/agents/trellis-implement.md` 与 `.pi/agents/trellis-check.md` 的自主退出、交互模式、session 模式和 system prompt frontmatter。
4. 更新 `.trellis/workflow.md` 的 Pi 调度契约及 `.pi/prompts/trellis-start.md`、`trellis-continue.md`、`trellis-finish-work.md` 的 Pi 使用说明；其它平台文字保持原状。
5. 静态搜索旧接口，确认其仅在回退实现或历史解释中存在；检查 Agent frontmatter 与工作流契约一致。
6. 执行 `npm test -- --runInBand`；执行 Pi CLI 最小启动检查，确认默认工具集和 `TRELLIS_NATIVE_SUBAGENT=1` 回退工具集。
7. 运行 `trellis-check` 审查修改、评估 `trellis-update-spec` 是否需要记录新约定，再按 Phase 3.4 单独提交本任务文件。

## Rollback

- 紧急恢复：以 `TRELLIS_NATIVE_SUBAGENT=1` 重启 Pi。
- 代码回滚：仅撤回本任务对 `.pi/` 和 `.trellis/workflow.md` 的修改；不触碰全局扩展或既有动作库改动。
