---
title: 媒体目标规划与文档契约
labels: [ready-for-human]
status: done
---

# 04: 媒体目标规划与文档契约

**状态：done；真实发布已完成。**

## 当前结果

- 最终目录：1,295 条
- 媒体目标：2,590 个（1,295 JPEG + 1,295 GIF）
- dry-run：远端已有 2,472 个，待上传 118 个，待删除 0 个，范围外 0 个
- execute：118/118 上传成功，0 删除；最终远端集合与目录一致
- 上游：`7455efae41b330c265e7cd4b78dfa848e7ce5ebd`

## 当前契约

- 上传目标严格来自 `data/exercises.js` 最终目录。
- 目标只允许 `exercises/images/` 与 `exercises/videos/` 两个受管前缀。
- CloudBase 远端写入已完成，后续重复同步仍先 dry-run，再人工确认 execute。
- 真实微信开发者工具验收不由 Jest 代替。

## 验证

```bash
npx jest --runInBand
# 14 suites passed, 254 passed, 26 historical skips
```
