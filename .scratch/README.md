# `.scratch/` — 本地 Issue 跟踪

本目录是本项目的 issue tracker（见 `docs/agents/issue-tracker.md`）。

## 结构

```
.scratch/
  <feature-name>/
    issue.md      # 该 feature 的 issue 定义、相关草稿、测试数据
```

一个 feature 一个子目录，目录名用 kebab-case（例如 `plan-editor`、`trend-charts`）。

## Issue 格式

```markdown
---
title: 功能简短标题
labels: [needs-triage]   # needs-triage | needs-info | ready-for-agent | ready-for-human | wontfix
status: open             # open | done
created: 2026-09-17
---

# Issue 内容

问题描述、需求细节、验收标准等。
```

## 工作流

1. **Create** —— 创建 `.scratch/<feature-name>/issue.md`，默认打 `needs-triage`。
2. **Triage** —— 用 `triage` skill 评估并重新标记（词表见 `docs/agents/triage-labels.md`）。
3. **Work** —— agent 从 `ready-for-agent` 的 issue 中挑选任务。
4. **Close** —— 完成后把 frontmatter 改为 `status: done`。

## 注意

- 本目录**随代码提交进 git**，否则 issue 在换机器后丢失。
- 不使用 GitHub Issues；本目录是唯一的 issue 事实来源。
