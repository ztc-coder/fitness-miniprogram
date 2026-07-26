# Agent Skills Configuration

本文档定义了 agent skills 使用的项目配置。

## Agent skills

### Issue tracker

Issues 以本地 markdown 文件形式存储在 `.scratch/<feature>/` 目录下。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认的 5 个标准 triage 标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。详见 `docs/agents/triage-labels.md`。

### Domain docs

单一上下文布局：根目录 `CONTEXT.md` + `docs/adr/` 架构决策记录。详见 `docs/agents/domain.md`。
