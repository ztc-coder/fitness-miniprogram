# Triage Label Vocabulary

本项目使用以下 5 个标准 triage 标签:

| Label | 含义 | 使用场景 |
|-------|------|----------|
| `needs-triage` | 待分类 | 新创建的 issue 默认标签 |
| `needs-info` | 需要更多信息 | issue 描述不清晰或缺少关键细节 |
| `ready-for-agent` | 可交给 agent | 已分类、信息完整、可自动化执行 |
| `ready-for-human` | 需要人工处理 | 需要人类判断、设计决策或手动操作 |
| `wontfix` | 不修复/不实现 | 明确不做的需求或 bug |

## Label mapping

使用默认标签名(无自定义映射):

```yaml
needs-triage: needs-triage
needs-info: needs-info
ready-for-agent: ready-for-agent
ready-for-human: ready-for-human
wontfix: wontfix
```

## Workflow

1. 新 issue 创建时打 `needs-triage`
2. 使用 `triage` skill 评估并重新标记
3. Agent 从 `ready-for-agent` 的 issue 中挑选任务
4. 人工从 `ready-for-human` 的 issue 中处理决策类任务
