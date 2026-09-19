# trellis-implement 子代理派发冒烟测试

## 背景

`.pi/agents/trellis-implement.md` 本轮有未提交改动：agent 定义移除了 `auto-exit` / `interactive` / `session-mode` / `system-prompt` 等 frontmatter。

需要一次端到端冒烟，确认改动后「任务上下文注入 → 子代理执行 → 结果回传」链路仍然可用。按全局 `AGENTS.md` 约定，派发工具使用 pi-interactive-subagents 扩展的 `subagent`，不使用 trellis 内置 `trellis_subagent`。

## 目标

派发 `subagent`（pi-interactive-subagents 扩展，agent = `trellis-implement`），验证：

1. 子代理能自行解析活动任务目录（dispatch prompt 首行 `Active task:`）。
2. 子代理能读到本任务 `prd.md`。
3. 子代理能读到 `implement.jsonl` 中列出的 spec 文件，并从中提取一条真实约定。
4. 子代理能真实调用 `bash` 与 `write` 工具（非模拟）。
5. 主会话能收到子代理的最终文本结果。

## 交付物

`.trellis/tasks/09-20-trellis-implement-dispatch-test/scratch/probe.txt`，内容须包含四行：

1. `task_dir=<子代理解析到的任务目录路径>`
2. `head=<git rev-parse --short HEAD 的输出>`
3. `spec_rule=<从 implement.jsonl 指向的 spec 文件中摘出的一条真实约定原文>`
4. `trellis-implement ok`

## 验收标准

- `scratch/probe.txt` 存在，四行齐全，`head` 与仓库当前 short HEAD 一致。
- `spec_rule` 能在对应 spec 文件中原文检索到。
- 子代理回复中明确说明它解析到的任务目录路径。
- 不修改任何产品代码、spec 文件或其他任务目录。

## 非目标

- 不验证 `parallel` / `chain` 模式。
- 不验证模型 / thinking 覆盖。
- 不验证 `trellis-check` 角色。
- 不提交、不归档任务（留给主会话决定）。
