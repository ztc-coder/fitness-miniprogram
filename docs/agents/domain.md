# Domain Documentation

本项目使用 **single-context** 布局(单一领域上下文)。

## Layout

- **`CONTEXT.md`**(根目录) — 项目领域词汇表、背景知识、核心概念
- **`docs/adr/`** — 架构决策记录(Architecture Decision Records)

## Consumer rules

### For agents reading CONTEXT.md

- 在实现新功能或重构前，优先读取 `CONTEXT.md` 了解项目术语与约定
- 使用文档中定义的术语，保持代码、注释、commit message 与领域词汇表一致
- 发现新的领域概念时，建议更新 `CONTEXT.md`

### For agents reading ADRs

- ADR 文件命名格式: `NNNN-title-in-kebab-case.md`(例如 `0001-use-cloudbase-for-backend.md`)
- 按时间顺序编号，新 ADR 追加到末尾
- 每个 ADR 包含: Context(背景)、Decision(决策)、Consequences(后果/影响)
- 实现架构相关变更前，检查 `docs/adr/` 是否有现存决策约束
- 做出新的架构决策时，创建新 ADR 记录

## Notes

- 本项目不是 monorepo，无需 `CONTEXT-MAP.md` 或多个 `CONTEXT.md`
- `CONTEXT.md` 与 `docs/adr/` 目前尚未创建，后续按需添加
