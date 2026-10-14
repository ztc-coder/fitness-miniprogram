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
| [0003](./0003-domain-logic-module-as-sole-test-seam.md) | `utils/domain.js` 作为唯一测试 seam | 核心逻辑原则保留；测试边界由 0010 扩展 |
| [0004](./0004-snapshot-sessions-immutable-history.md) | 打卡快照复制，历史记录不可变 | 原则保留；新组结果与跳过规则见 0010 |
| [0005](./0005-offline-first-local-cache-with-submit-queue.md) | 离线优先：本地缓存 + 结束时提交 + 队列重试 | 原则保留；本地提交点与幂等见 0010 |
| [0006](./0006-local-markdown-issue-tracker.md) | Issue 跟踪使用仓库内本地 markdown | 已采纳 |
| [0007](./0007-exercises-dataset-as-catalog.md) | 动作库接入 hasaneyldrm/exercises-dataset | 已采纳；范围见 0008，部位筛选见 0009 |
| [0008](./0008-full-non-cardio-catalog.md) | 发布目录改为非 cardio 可用全量，器械筛选改官方原值 | 部位筛选已被 0009 取代 |
| [0009](./0009-seven-part-library-filter.md) | 动作库部位筛选改为七类训练部位 | 已采纳 |
| [0010](./0010-explicit-set-results-and-local-completion.md) | 逐组显式结果、草稿兼容与整场本地完成 | 已采纳；实现与复审完成，待真机验收 |
