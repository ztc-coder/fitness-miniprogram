<!-- DSH-IDEMPOTENCY-KEY: deck-plan-wayfinder-public-release-phase1-child-media-decouple -->
<!-- parentKey: 00 -->
<!-- created: 2026-10-20T06:40:24.335Z -->
# 媒体与代码解耦：占位素材与独立媒体包

## Question

怎么让公开仓库不含 Gym visual 媒体，同时部署者仍拿得到可用媒体？

## 已定形态

> **前提已由 #02 更正（2026-10-20）**：仓库里**本来就没有** Gym visual 媒体——`git ls-files images` 只有 20 个自制 tabBar 图标，真实动作图片/GIF 一直在运营者云存储，仓库只存 `exercises/images/…`、`exercises/videos/…` 路径字符串。所以本票不是「把已有媒体搬出去」，而是「保证它们不被放进来 + 没有媒体时仓库仍可编译可跑」。

仓库只放自有占位素材；真实媒体作为独立「媒体包」（或部署者自己的云存储）在部署时按 README 放入。代码侧媒体根路径必须可配置——`data/media-root.js` 已存在且当前硬编码运营者云桶，先审它现在怎么解析、以及硬编码属 #05 的替换项。

## 验收

- 干净 clone 后开发者工具可编译、`npm test` 可跑。
- 缺媒体时显示占位、不阻塞训练流程。
- README 写明媒体包获取方式与署名要求（Gym visual / 180×180）。
- 仓库 `git ls-files images/` 不再包含有版权风险的素材。

## 依赖

- 原被「根 LICENSE 与全量许可核对」阻塞，该票已于 2026-10-20 关闭：结论是仓库不分发 Gym visual 媒体，`LICENSE`(MIT) 与 `THIRD-PARTY.md` 已落地，媒体义务见其 §2.1。
- 本票因此**解阻**。仍须先读 `THIRD-PARTY.md` §2.1 的三项前置条件（书面授权 / 署名 / 180×180）再决定媒体包形态。

## 进度

<!-- 做到哪一步了，在这里一行一行记 -->


## Comments


## Answer

Status: open
Type: task
Blocked by: #02
Labels: wayfinder:task
