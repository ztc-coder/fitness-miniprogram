---
title: 动作详情与精选目录质量修复
labels: [ready-for-human]
status: done
created: 2026-09-21
---

**历史轮次：已被 `.scratch/full-catalog/` 取代。** 本目录只保留早期 127 条精选方案的审计记录，不作为当前目录、筛选、迁移或媒体状态依据。


**Spec 来源**：`docs/prd.md`。

修复动作详情底部操作区遮挡正文，统一 `0238` 为“绳索直臂下压”，从精选目录删除 9 个明确动作，并通过 v4 迁移清理现有计划。最终目录 127 条、媒体目标 254 个；历史 Session 不变。

## Tickets

| # | 标题 | 依赖 | 状态 |
|---|---|---|---|
| 01 | 共享动作详情弹层滚动与底部操作区 | 无 | done（真机视觉保持 ready-for-human） |
| 02 | 127 条精选目录、0238 命名与生成链 | 无 | done |
| 03 | v4 计划迁移、媒体集合与文档一致性 | 02 | done（真实 CloudBase dry-run 保持 ready-for-human） |

## 完成标准

- 三张票验收项全部通过。
- 仓库自动化通过；真实微信渲染与 CloudBase 对象集合若无法在当前环境验证，保持 `ready-for-human` 并记录原因。

## 人工验收（保持 ready-for-human）

1. 微信开发者工具 / 真机：动作库详情（`showPick=true`）滚到底能看到全部要领、备注与署名；打卡页只读详情（`showPick=false`）无异常空白。
2. 旧精选轮次的 CloudBase 254 对象验收不再是当前发布契约；当前发布以 `.scratch/full-catalog/issues/04-media-and-contracts.md` 的 2,590 对象记录为准。
3. 本历史轮次的旧媒体源/SDK 缺失记录不代表当前环境。
