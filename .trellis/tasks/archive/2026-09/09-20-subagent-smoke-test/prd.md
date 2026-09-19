# 子代理调度冒烟测试

## 背景

Pi 平台下 Trellis 子代理已切换到 `.pi/extensions/trellis/index.ts` 提供的 `trellis_subagent` 工具派发。
需要一次端到端冒烟，确认「任务上下文注入 → 子代理执行 → 进度/结果回传」链路可用。

## 目标

验证 `trellis_subagent` 能以 `trellis-implement` 角色被派发，并且：

1. 子代理能自动解析当前任务目录（通过 `task.py current` 或 dispatch prompt 首行 `Active task:`）。
2. 子代理能读到本任务 `prd.md`。
3. 子代理能真实执行 `bash` 与 `write` 工具。
4. 主会话能收到子代理的最终文本结果。

## 交付物

- `.trellis/tasks/09-20-subagent-smoke-test/scratch/probe.txt`
  - 内容须包含：`git rev-parse --short HEAD` 的输出，以及一行 `trellis-implement ok`。

## 验收标准

- `scratch/probe.txt` 存在，且含当前 short HEAD。
- 子代理回复中明确说明它解析到的任务目录路径。
- 不修改任何产品代码、spec 或其他任务文件。

## 非目标

- 不验证 `parallel` / `chain` 模式。
- 不验证模型/thinking 覆盖。
