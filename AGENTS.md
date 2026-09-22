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
- 需求规格：`docs/spec.md`
- 动作库当前 spec/验收：`.scratch/full-catalog/issue.md`
- 动作库上一轮选择器与 125 条精选（历史）：`.scratch/exercise-selector/issue.md`
- 动作库更早质量修复（历史）：`.scratch/catalog-quality-fixes/issue.md`
- 动作库更早扩容（历史）：`.scratch/catalog-expansion/issue.md`
- Issue 跟踪：`.scratch/<feature>/issue.md`
