# Issue Tracker: Local Markdown

Issues 以本地 markdown 文件形式存储在本仓库中。

## Location

- **Base directory**: `.scratch/`
- **Structure**: `.scratch/<feature-name>/issue.md`

每个 feature 一个子目录，包含该 feature 的 issue 定义、相关草稿、测试数据等。

## Workflow

1. **Create**: 使用 `to-tickets` 或手动创建 `.scratch/<feature-name>/issue.md`
2. **Triage**: 使用 `triage` skill 添加 frontmatter 标签
3. **Work**: agent 从 `ready-for-agent` 标签的 issue 中挑选任务
4. **Close**: 完成后在 frontmatter 中标记 `status: done`

## Issue format

每个 issue.md 包含 YAML frontmatter:

```yaml
---
title: 功能简短标题
labels: [needs-triage]  # or needs-info, ready-for-agent, ready-for-human, wontfix
status: open  # or done
created: 2026-07-21
---

# Issue 内容

问题描述、需求细节、验收标准等。
```

## Notes

- 本地 markdown tracker 适合个人项目或无远端仓库的场景
- 不支持 PR 作为 triage 输入(仅限本地 issues)
- `.scratch/` 目录建议加入 `.gitignore`(若未来项目转为 git 仓库)
