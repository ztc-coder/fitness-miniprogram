---
title: 生成非 cardio 可用全量目录
labels: [ready-for-human]
status: done
---

# 01: 生成非 cardio 可用全量目录

**状态：done；当前发布已完成。**

## 当前结果

- 上游：`hasaneyldrm/exercises-dataset` commit `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`
- 候选：1,324 条，其中 cardio 29 条
- 发布：1,295 条非 cardio 动作，排除清单为空
- 产物：`data/exercises-data-1.js` ~ `-3.js`、`data/catalog-snapshot.json`
- 运行时：`data/exercises.js` 显式加载 3 个分片
- 媒体闸门：1,295 JPEG + 1,295 GIF + 中文要领均通过

## 当前契约

- 候选只排除 `body_part/category === cardio`。
- 源 JPEG、GIF、中文要领缺失时，只有锁定排除清单中的 id 可被剔除；清单外缺口或过期清单直接失败。
- id 必须是唯一 4 位数字；`name` 保留英文原值；`nameZh` 与中文要领非空。
- 生成器支持夹具参数、快照、分片和可复现时间注入。

## 验证

```bash
npx jest tests/build-exercises.test.js tests/catalog.test.js --runInBand
# 通过
```

真实目录已生成并接入小程序；CloudBase 上传结果记录在 04 票。旧的“本机缺少源媒体”“3011/3021 排除”“仅第一分片接线”记录属于实施前快照，已不代表当前状态。
