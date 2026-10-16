---
title: 离线检索改为官方原值多选
labels: [ready-for-human]
status: done
---

# 02: 离线检索改为官方原值多选

**状态：done；已在真实 1,295 条目录上复跑。**

## 当前契约

`search(query, equipmentKeys, bodyPartKeys)`：关键词与两行筛选为 AND；同一行多选为 OR；空数组表示无约束。关键词命中 id、英文名、中文名、target、bodyPart、equipment 与 aliases。筛选只认官方 bodyPart 和实际 equipment 原值，不再使用精选标签或器械归并桶。

- 9 个非 cardio 官方部位均可筛选。
- 器械原值动态取自发布目录；`assisted` 与 `body weight` 独立。
- `3011`、`3021` 已在真实源媒体完整后纳入目录。
- `findById`、别名搜索、大小写不敏感和多维 AND/OR 测试通过。

## 验证

```bash
npx jest tests/search-multiselect.test.js tests/catalog.test.js --runInBand
# 通过
```

页面胶囊交互由 03 票维护；媒体发布由 04 票维护。

本票保留全量目录发布时的历史口径；当前界面七类部位筛选见 `../../library-seven-parts/issue.md`。
