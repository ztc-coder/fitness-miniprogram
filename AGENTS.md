# Agent Skills Configuration

本文档定义了 agent skills 使用的项目配置。

## Agent skills

### Issue tracker

Issues 以本地 markdown 文件形式存储在 `.scratch/<feature>/` 目录下。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认的 5 个标准 triage 标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。详见 `docs/agents/triage-labels.md`。

### Domain docs

单一上下文布局：根目录 `CONTEXT.md` + `docs/adr/` 架构决策记录。详见 `docs/agents/domain.md`。

## 项目文档索引

- 领域词汇表与架构概览：`CONTEXT.md`
- 架构决策记录：`docs/adr/`
- 需求规格：`docs/spec.md`(grilling 结论)、`docs/spec-mvp.md`(spec 全文)
- 动作库当前 spec/验收：`.scratch/catalog-expansion/issue.md`、`.scratch/catalog-expansion/issues/05-integration-acceptance-and-docs.md`（历史规格：`.scratch/common-exercise-catalog/issue.md`、`.scratch/exercise-catalog/issue.md`）
- Issue 跟踪：`.scratch/<feature>/issue.md`
<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->
