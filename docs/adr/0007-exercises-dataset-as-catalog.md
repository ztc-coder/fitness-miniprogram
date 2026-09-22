# ADR-0007：动作库接入 hasaneyldrm/exercises-dataset

- 状态：已采纳；目录范围与筛选口径已被 ADR-0008 取代
- 日期：2026-09-17
- 相关文档：`docs/spec.md`、`CONTEXT.md`、ADR-0001（云存储）、ADR-0004（快照不可变）、ADR-0005（离线优先）、ADR-0008（非 cardio 可用全量）

## Context（背景）

动作库目前是 30 条手写精选，`id` 为英文 slug（`bench-press`），详情用汉字占位，`imagePath` 无人消费。规格早已指定数据源 [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)：1,324 条，排除 cardio 后约 1,295 条；文本 MIT，媒体（180×180 JPEG + 分解 GIF）排除在 MIT 之外，版权主张在 Gym visual / ExerciseDB / 仓库作者之间冲突。

需要同时决定：主键、中文名、包体、媒体托管、个人自用能否加载未授权媒体。这些选择会写进计划种子、CloudBase 对象和主包，事后改成本高。

## Decision（决策）

1. **主键用数据集 4 位数字字符串**（如 `"0025"`）。种子计划里的 slug 一次性迁过去。记录趋势按动作名聚合，换 id 不拆历史曲线。发布目录范围与筛选口径见 ADR-0008（非 cardio 可用全量，不再用精选白名单做闸门）。
2. **`nameZh` 用社区映射打底**（[wangmuerxiao/exercises-dataset-zh](https://github.com/wangmuerxiao/exercises-dataset-zh)），原 30 条手译覆盖。展示中文名，英文 `name` 做副标题和检索别名。
3. **文本精简后打进主包**（离线可搜、可看要领）。字段只留 `id/name/nameZh/equipment/bodyPart/target/imagePath/gifPath/instructionSteps/aliases`。原文 17.4 MB 的多语言说明丢掉。超 2MB 再分包，不把目录放到云数据库。`aliases` 是目录一等字段，只参与关键词搜索，不参与部位筛选、不改展示名。
4. **示意图与动作演示上传 CloudBase，按需加载**。不热链 GitHub/jsDelivr。动作库列表和打卡页只加载 JPEG 缩略图，详情按 GIF → JPEG → glyph 降级。个人自用本轮加载真实媒体，页面保留 `© Gym visual — https://gymvisual.com/`；商用上线前必须书面授权，且不得把仓库媒体当可再分发素材镜像出去。
5. **打卡页用 `exerciseId` 反查动作库**拿示意图 / 演示 / 要领，不把媒体路径写入 session 快照（与 ADR-0004 的最小快照一致）。

## Considered Options（考虑过）

- **继续用 slug**：同名变体多，生成不稳定，对不上上游。
- **热链 raw/jsDelivr**：省 130 MB 上传，但要配合法域名、国内不稳定，等于公开再分发未授权媒体。
- **目录走云数据库**：主包最瘦，打破动作库离线只读，健身房无网不能加练。
- **媒体写入 session**：历史场次自带图，云存储一换路径就挂，快照变重。

## Consequences（后果）

**正向**

- 动作与上游一一对应，扩库、补媒体、对要领都走同一 id。
- 健身房无网仍能搜动作、看中文要领；只有演示 GIF 需要网。
- session 形状不变，domain / 提交队列 / 记录趋势不用跟着媒体改。

**代价**

- 必须做一次种子计划 `exerciseId` 迁移；用户云端若已有旧 slug 计划，加练反查会失败，需要同样迁移或兼容表。目录迁移当前版本仍为 **v5**（当时按可查性裁掉无可用 GIF 的 `3011/3021`，无 replacement 映射）。扩到非 cardio 可用全量不升迁移版本，见 ADR-0008。
- 社区中文名质量一般，部分条目要后续手修。
- 个人自用加载未授权媒体：可接受；仓库一旦公开发布/审核上线，授权仍是阻塞项。
- 一次性上传约 130 MB 到 CloudBase；主包文本裁完后仍需实测体积。
