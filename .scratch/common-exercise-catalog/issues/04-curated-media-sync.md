---
title: 精选目录 CloudBase 媒体同步与旧媒体清理
labels: [ready-for-human]
status: open
created: 2026-09-18
---

> ⚠️ **已被取代（2026-09-19）**：本轮口径由 `.scratch/catalog-expansion/issue.md` 取代——
> 精选目录最终 **136 条**、部位标签 **10 个**（筛选 **11 项**：全部 / 胸 / 背 / 肩 / 二头肌 / 三头肌 / 腿 / 腰腹 / 臀 / 热身 / 复合动作）、
> `aliases` 参与搜索、计划迁移升到 **v3**（无 replacement）、媒体目标集合 **272** 个对象。
> 本文保留当时的执行与验收记录（含当时的状态与检查项），**不再作为当前验收依据**；未完成的人工验收由新轮次承接。

# 04: 精选目录 CloudBase 媒体同步与旧媒体清理

**What to build:** CloudBase 中的动作 JPEG/GIF 与最终精选目录严格一致。用户能查看最终目录动作的缩略图和 GIF；已移除动作的媒体仅从专用动作媒体前缀清理，不影响其他云存储对象。

**Blocked by:** 01: 精选常用动作目录与新部位筛选。

**Status:** ready-for-human

- [x] 上传计划只包含最终目录引用的 JPEG/GIF，上传前验证每个源文件存在且路径安全。
- [ ] 同步完成后，每个最终目录动作的 JPEG 和 GIF 对象存在且可由 CloudBase fileID 解析。
- [x] 清理范围严格限制于专用动作图片和视频前缀，绝不删除无关对象。
- [x] 远端差异、待删除对象和同步失败会被明确报告；失败后可安全重试。
- [ ] 不在最终目录的动作媒体已从专用动作媒体前缀清理。

## 实现说明

当前仓库内自动化只覆盖计划、路径安全、差异计算、最终集合校验和失败重试；真实 CloudBase 最终集合与旧媒体清理仍未验收，因此本 ticket 保持 `ready-for-human`。

`scripts/upload-exercise-media.js` 分为三层，纯函数与编排逻辑不依赖 CloudBase SDK，
未安装 `@cloudbase/manager-node` 时仍可被测试导入：

- 路径层：`parseManagedCloudPath` / `isManagedCloudPath` 只承认 `exercises/images/`、`exercises/videos/`
  下单层、扩展名匹配的文件名；`buildUploadTargets` 拒绝缺路径、前缀不符、遍历、反斜杠与错误扩展名；
  `planUploads` 用 `lstat` 拒收符号链接并拒绝被替换成链接的媒体根目录。
- 差异层：`buildSyncPlan` 产出 `toUpload` / `alreadyPresent` / `staleCandidates` / `outOfScope`，
  删除候选只来自受管前缀，范围外对象只报告；`assertDeletionScope` 是删除前最后一道断言；
  `verifyFinalSet` 校验最终集合，`buildCatalogMediaFileIds` 用 `data/media-root.js` 解析每条动作的 JPEG/GIF fileID。
- 编排层：`runSync` 列举远端 → 差异 → 上传缺失 → 校验最终集合 → 删除陈旧；
  dry-run 默认开启，`--execute` 才写入；上传或校验未通过时绝不再删除；
  上传/删除失败逐项进入失败清单并以非 0 退出，重跑会重新拉取远端状态只补缺失项。

适配层 `createStorageAdapter` 已按 `@cloudbase/manager-node@5.8.8` 核对：
`app.storage` 为 getter，列举用 `listDirectoryFiles(cloudPath)`（返回 `Key`，内部自动翻页），
删除用 `deleteFile(cloudPathList: string[])`，上传用 `uploadFile({ localPath, cloudPath, onProgress })`。

测试：`tests/upload-exercise-media.test.js` 覆盖上述路径校验、差异计算、
删除范围、dry-run/执行/失败重试与适配层签名；本次 `npm test -- --runInBand --silent` 全量 107 例通过。

剩余两项（最终集合在真实云存储中确认、陈旧媒体已从真实前缀清除）需要真实 CloudBase 凭据与
`npm i -D @cloudbase/manager-node` 才能执行脚本核对，本工作区无凭据与 SDK，留待 Ticket 05 端到端验收。
