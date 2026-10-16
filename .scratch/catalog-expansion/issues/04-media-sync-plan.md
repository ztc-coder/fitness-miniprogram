---
title: 媒体同步计划与最终集合核对
labels: [ready-for-human]
status: done
created: 2026-09-19
---

# 04: 媒体同步计划与最终集合核对

## 历史票收口

用户已确认验收并授权关闭剩余票，本次同步此历史票的 done 状态。关闭依据是后续交付取代旧范围，不新增媒体上传／删除操作或测试结论。

本票已被 [全量目录发布](../../full-catalog/issue.md) 与 [媒体发布记录](../../full-catalog/issues/04-media-and-contracts.md) 取代，按父 issue 的历史票表同步为 done。当前发布为 1,295 条 / 2,590 个对象；后续发布记录已记载 118 个补传成功、0 个删除、最终集合一致。

此关闭表示历史范围被后续交付取代，**不表示本轮重新执行 272 对象上传或把旧人工验收补写为通过**。下文保留当时结果；当前微信页面验收按 [七类筛选规格](../../library-seven-parts/issue.md) 与 [现有人工验收票](../../set-by-set-training/issues/04-integration-acceptance.md) 跟踪，不再重复执行已退役目录方案。

**What to build:** 动作媒体同步脚本以最终 136 条目录为唯一白名单，
产出可复核的同步计划：需要上传 272 个受管对象（136 条 × JPEG + GIF）、
最终集合校验可执行、陈旧对象候选严格限于 `exercises/images` 与 `exercises/videos`。
真实 CloudBase 上传/删除与最终集合确认留人工执行。

**Blocked by:** 01: 最终 136 条目录元数据与生成链（含 aliases、TARGET_WHITELIST）。

**Spec 来源**：提案 B.1/B.2（逐条媒体路径）、I.7（媒体影响）。

## 文件范围（只改这些）

| 文件 | 改动 |
|---|---|
| `scripts/upload-exercise-media.js` | 仅当最终目录暴露出问题时改动（如新增动作媒体路径形态不被 `parseManagedCloudPath` 接受）；否则不改。 |
| `tests/upload-exercise-media.test.js` | 目标数改为 272；补新增/删除 ID 的媒体断言；保持路径安全与删除边界断言。 |
| `.scratch/catalog-expansion/media-sync-plan.md` | 新增：同步执行计划与人工验收清单（上传清单统计、陈旧候选、dry-run 结果、执行步骤与回滚说明）。 |

**不在本票范围**：`data/media-root.js` 的桶根配置（不改）；真实上传/删除执行（人工）；目录元数据（票 01）。

## 实现要点

1. **白名单来源**：目标集合必须由 `data/exercises.js` 的最终目录推导，不整目录上传、不硬编码文件名。
   预期目标数 `136 × 2 = 272`。
2. **新增/删除核对**：
   - 34 条新增的 JPEG/GIF 必须全部出现在目标集合中（路径取自提案 B.1/B.2）；
   - `0200/0673` 的媒体必须**不在**目标集合中，且只能作为受管前缀内的陈旧候选出现；
   - `1015 0222 2399 3697 0549 2571 1419 1314 0241` 的媒体不得进入目标集合。
3. **路径安全不变**：`buildUploadTargets` 继续拒收缺路径、前缀不符、遍历、反斜杠、错误扩展名；
   `planUploads` 继续拒收符号链接与被替换成链接的媒体根目录。
4. **删除边界不变**：`staleCandidates` 只来自两个受管前缀；`assertDeletionScope` 仍是删除前最后一道断言；
   范围外对象只报告、不删除。
5. **失败可重试**：上传或校验未通过时绝不删除；失败项逐条进入失败清单并以非 0 退出；重跑只补缺失项。
6. **dry-run 默认**：默认不写远端，只有显式 `--execute` 才上传/删除。

## 验收

- [x] `buildCatalogMediaFileIds` / 目标集合恰好 272 个对象，且 34 条新增全部在内。
- [x] `0200/0673` 与 9 条排除 ID 的媒体不出现在目标集合中。
- [x] 每条目标的 JPEG/GIF 都能由 `data/media-root.js` 解析出非空 `cloud://` fileID。
- [x] 陈旧候选只包含 `exercises/images/`、`exercises/videos/` 下单层合法文件，且不含仍被目标引用的对象。
- [x] 路径遍历、符号链接、错误扩展名、范围外对象仍被拒收或只报告。
- [x] dry-run 只列举与计算差异，不上传不删除；上传/校验失败时不执行任何删除。
- [x] `media-sync-plan.md` 记录：目标总数、dry-run 前置条件、执行与回滚步骤、人工验收清单。
- [x] `npx jest tests/upload-exercise-media.test.js --runInBand` 通过。

## 验证方式

```bash
npx jest tests/upload-exercise-media.test.js --runInBand
node scripts/upload-exercise-media.js --src <媒体源目录>            # dry-run，只读
```

## 剩余风险 / 人工事项（不由 agent 声称完成）

- 真实 CloudBase 上传 272 个对象、确认最终集合、删除陈旧对象：需要 `@cloudbase/manager-node`、媒体源目录与云凭据。
- 上游媒体版本漂移可能让个别源文件缺失；缺失项必须报告并停下，不得静默跳过。

## 验收记录（2026-09-19）

- 目录目标：136 条 / 272 个受管媒体对象。
- `npx jest tests/upload-exercise-media.test.js --runInBand`：33/33 通过（含异常对象只报告不删除回归）。
- `node scripts/upload-exercise-media.js --src /tmp/exercises-dataset`：当前环境无媒体源，按预期以退出码 1 停止，未连接 CloudBase、未上传、未删除。
- 真实上传、最终远端集合确认与陈旧对象删除仍待人工，故状态保持 `ready-for-human`。
