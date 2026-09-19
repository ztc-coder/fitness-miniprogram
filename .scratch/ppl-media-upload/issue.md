---
title: 仅上传三分化动作库媒体
labels: []
status: done
created: 2026-09-18
---

# 仅上传三分化动作库媒体

## Problem

现有 `scripts/upload-exercise-media.js` 递归上传数据集完整 `images/` 与 `videos/` 目录；用户仅要三分化最终目录中的 1236 条动作媒体。

## Scope

- 上传脚本以 `data/exercises.js` 的最终目录为唯一白名单。
- 仅上传白名单动作的 `imagePath` 与 `gifPath`，维持云端路径 `exercises/images|videos/...`。
- 上传前输出白名单 JPEG/GIF 数量、缺失媒体数量和源/目标总字节数；缺失应显式失败，不可静默上传不完整集。
- 不读取或输出凭据；继续从环境变量取 CloudBase API 密钥。
- 上传成功后才能配置 `data/media-root.js`，其 CloudBase 根路径必须由实际桶信息确定。

## Non-goals

- 不上传被三分化裁掉动作的媒体。
- 不热链 GitHub/jsDelivr。
- 不改变 GIF → JPEG → glyph 降级链。

## Acceptance

- [x] 上传集合与最终 1236 条目录的 imagePath/gifPath 一一对应。
- [x] 不执行整目录上传。
- [x] 缺失源媒体会失败并报告路径。
- [x] 上传后能配置并验证一个动作的 GIF URL。（已上传到 CloudBase 默认桶 `636c-cloud1-d2ga0mned4bbf9b29-1456520720`（Region ap-shanghai）；`data/media-root.js` 已配置为 `cloud://cloud1-d2ga0mned4bbf9b29.636c-cloud1-d2ga0mned4bbf9b29-1456520720`，并经 API 确认对象 `exercises/videos/0001-2gPfomN.gif` 存在，`getTemporaryUrl` 返回域名与路径一致。）
