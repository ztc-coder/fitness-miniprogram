---
title: 精选动作库完整验收与领域文档同步
labels: [ready-for-human]
status: open
created: 2026-09-18
---

> ⚠️ **已被取代（2026-09-19）**：本轮口径由 `.scratch/catalog-expansion/issue.md` 取代——
> 精选目录最终 **136 条**、部位标签 **10 个**（筛选 **11 项**：全部 / 胸 / 背 / 肩 / 二头肌 / 三头肌 / 腿 / 腰腹 / 臀 / 热身 / 复合动作）、
> `aliases` 参与搜索、计划迁移升到 **v3**（无 replacement）、媒体目标集合 **272** 个对象。
> 本文保留当时的执行与验收记录（含当时的状态与检查项），**不再作为当前验收依据**；未完成的人工验收由新轮次承接。

# 05: 精选动作库完整验收与领域文档同步

**What to build:** 用户可以端到端确认精选动作库、计划迁移、分页缩略图和动作详情媒体共同可用；项目的领域语言与验收记录准确描述最终行为。

**本次仓库内完成范围：** Jest/Page harness、Node 语法检查、`git diff --check` 和领域文档已同步；微信开发者工具真实渲染/滚动及 CloudBase 真实媒体集合仍需人工验收，不能由 mock 或 dry-run 代替。

**Blocked by:** 02: 已存训练计划的目录迁移; 03: 动作库分页缩略图浏览; 04: 精选目录 CloudBase 媒体同步与旧媒体清理。

**Status:** ready-for-human

- [x] 仓库内 Jest Page harness 验证关键词、六个器械桶、九个部位筛选，以及复合动作与具体部位的重叠行为；未冒充微信开发者工具验收。
- [ ] 微信开发者工具真实验证上述筛选的 WXML 绑定与滚动状态。
- [x] 仓库内自动化验证列表首批 24 项、追加下一页、JPEG `cloud://` fileID、缩略图失败降级和详情 GIF 优先链路；未覆盖真实 WXML 渲染。
- [ ] 微信开发者工具真实验证列表滚动、图片加载失败和详情 GIF/JPEG/glyph 降级。
- [x] Jest 迁移验证确认旧 Plan 裁剪、空训练日/空计划清理、迁移不写入 Session、离线恢复云同步和幂等。
- [ ] CloudBase 真实验证确认最终目录 JPEG/GIF 可用且已移除动作媒体不再存在于专用前缀。
- [x] 全量 Jest、Node `--check`、`git diff --check` 通过；领域词汇表、规格和 ticket 状态已同步。

**Ticket 01–04 契约核对：**

- Ticket 01：`tests/catalog.test.js` 覆盖 104 条白名单一一对应、九标签、复合重叠、器械/关键词/部位 AND 和代表性动作。
- Ticket 02：`tests/db.test.js` 覆盖精选目录 v2 裁剪、空训练日/空计划删除、Session 零写入、离线恢复和幂等。
- Ticket 03：`tests/library-paging.test.js` 覆盖 24 条首屏、24 条追加、完整结果计数、JPEG fileID、失败 glyph 降级和 GIF 不进入列表。
- Ticket 04：`tests/upload-exercise-media.test.js` 覆盖最终目录白名单、路径/符号链接安全、受管前缀删除边界、最终集合校验和失败重试；真实桶的两项验收仍未完成。

**未完成/人工验收：** 当前环境没有微信开发者工具自动化基础设施、媒体源目录、`@cloudbase/manager-node` 或 CloudBase 凭据；Ticket 04 的两项真实媒体验收因此仍为 `ready-for-human`。
