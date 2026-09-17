# 架构决策记录（ADR）

本目录记录本项目的架构与流程决策。格式与消费规则见 `docs/agents/domain.md`。

## 约定

- 文件名：`NNNN-title-in-kebab-case.md`，四位递增编号，新决策追加到末尾。
- 每篇包含：Context（背景）/ Decision（决策）/ Consequences（后果）。
- 决策被推翻时**不删除旧 ADR**，而是新增一篇并标注 `状态：已被 ADR-XXXX 取代`。
- 实现架构相关变更前，先检查本目录是否有现存决策约束。

## 索引

| 编号 | 决策 | 状态 |
|---|---|---|
| [0001](./0001-use-cloudbase-for-backend.md) | 后端使用微信云开发 CloudBase | 已采纳 |
| [0002](./0002-native-miniprogram-no-typescript.md) | 前端用原生小程序，不引入 TypeScript / 跨端框架 | 已采纳 |
| [0003](./0003-domain-logic-module-as-sole-test-seam.md) | `utils/domain.js` 作为唯一测试 seam | 已采纳 |
| [0004](./0004-snapshot-sessions-immutable-history.md) | 打卡快照复制，历史记录不可变 | 已采纳 |
| [0005](./0005-offline-first-local-cache-with-submit-queue.md) | 离线优先：本地缓存 + 结束时提交 + 队列重试 | 已采纳 |
| [0006](./0006-local-markdown-issue-tracker.md) | Issue 跟踪使用仓库内本地 markdown | 已采纳 |
