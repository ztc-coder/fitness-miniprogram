# ADR-0006：Issue 跟踪使用仓库内本地 markdown

- 状态：已采纳
- 日期：2026-09-17
- 相关文档：`docs/agents/issue-tracker.md`

## Context（背景）

本仓库有 GitHub remote（`ztc-coder/fitness-miniprogram`），也可以走 GitHub Issues。
但项目是**单人自用**：没有外部贡献者、没有 issue 分诊队列的协作需求，
而 issue 与代码、spec 文档同仓库演进更直接（一次 clone 拿到全部上下文，不依赖 `gh` 可用性）。

## Decision（决策）

Issues 以**本地 markdown 文件**形式存储在 `.scratch/<feature-name>/issue.md`，
不使用 GitHub Issues。

- 每个 issue 带 YAML frontmatter：`title` / `labels` / `status` / `created`。
- 标签词表见 `docs/agents/triage-labels.md`（5 个标准 triage 标签）。
- `.scratch/` 随代码提交进 git，否则 issue 在换机器后丢失。
- 不支持把 PR 作为 triage 输入。

## Consequences（后果）

**正向**

- issue 与代码同仓库，上下文完整、离线可用。
- 不依赖 `gh` CLI 与网络。
- 单人项目中 markdown 比 issue 表单更灵活，可承载较长上下文。

**代价 / 需要接受**

- 没有 GitHub 的搜索、看板、跨仓库引用、自动关闭等能力。
- 不会自动关联 commit 与 PR。
- 若未来引入协作者，需要迁移到 GitHub Issues（重新运行 `setup-matt-pocock-skills`）。

**复审触发条件**

- 出现第二位贡献者，或需要外部反馈入口时，重新评估是否切换到 GitHub Issues。
