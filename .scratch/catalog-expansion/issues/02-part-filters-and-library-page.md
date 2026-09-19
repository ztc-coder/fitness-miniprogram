---
title: 11 个标签筛选与动作库页面契约
labels: [ready-for-agent]
status: done
created: 2026-09-19
---

# 02: 11 个标签筛选与动作库页面契约

**What to build:** 动作库的部位筛选从 9 个扩到 10 个标签（含新增「热身」），筛选行按固定顺序显示 11 项；
「热身」是与具体部位重叠的标签，选中它只命中带 `warm-up` 的动作，且这些动作仍能从「肩」「臀」等具体部位筛选中找到。
关键词、器械桶、部位标签继续三维 AND，分页与缩略图行为不变，结果计数为 136。

**Blocked by:** 01: 最终 136 条目录元数据与生成链（含 aliases、TARGET_WHITELIST）。

**Status:** done

**Spec 来源**：提案 C 节（热身 18 条）、F.2（tags 规则）、G.2/G.3（分布）、K 节（逐条 tags）。

## 文件范围（只改这些）

| 文件 | 改动 |
|---|---|
| `data/curated-catalog.js` | `PART_LABELS` 末尾新增 `'warm-up': '热身'`，使 `PART_FILTERS` 变为 11 项；`partTagsLabel` 注释同步。 |
| `data/exercises.js` | 字段/注释与 `partTagsLabel` 行为核对（`warm-up` 中文标签能正常拼出）；如无必要不改逻辑。 |
| `tests/catalog.test.js` | 11 标签顺序、热身重叠、各筛选非空、复合重叠、三维 AND 断言更新。 |
| `tests/library-paging.test.js` | 页面级筛选暴露 11 项、`resultCount = 136`、分页窗口断言更新。 |

**不在本票范围**：`pages/library/library.wxml` 与 `.wxss`（筛选行已是横向 `scroll-view`，11 个 pill 不需要改布局）；
白名单/元数据本身（票 01）；迁移（票 03）；文档（票 05）。

## 实现要点

1. **筛选顺序固定为 11 项**：`全部 / 胸 / 背 / 肩 / 二头肌 / 三头肌 / 腿 / 腰腹 / 臀 / 热身 / 复合动作`。
   `PART_FILTERS = ['全部'].concat(Object.keys(PART_LABELS))`，因此 `PART_LABELS` 中 `warm-up` 必须位于 `compound` 前。
2. **`warm-up` 与部位重叠**：`matchCuratedPart` 已按 `tags` 匹配，无需新分支；
   但必须断言「每个 `warm-up` 结果都至少带一个具体部位标签」。
3. **热身集合固定 18 条**：`0233 0276 0628 0705 0216 0235 0710 0864 0993 1604 3006 3012 3021 3561 2143 1017 3011 0688`。
   必须断言 `0464 0979 3699 0624 0659` **不带** `warm-up`。
4. **`compound` 仍是重叠标签**：选中「复合动作」命中 62 条，且每条也能从某个具体部位筛选中找到。
5. **分页与缩略图不变**：首屏 24 条、追加 24 条、当前页与下一页最多 48 张 JPEG 预热、列表不请求 GIF；
   仅结果总数由 104 变为 136。
6. **展示顺序不改**：`partTagsLabel` 仍按条目 `tags` 数组顺序拼接（本轮不重排既有数组）。

## 验收

- [x] `PART_FILTERS` 长度为 11，顺序等于 `全部/胸/背/肩/二头肌/三头肌/腿/腰腹/臀/热身/复合动作`。
- [x] `PART_LABELS['warm-up'] === '热身'`；其余 9 个标签中文不变。
- [x] 10 个标签筛选各自命中数非零；「热身」命中 18 条，且每条都带具体部位标签。
- [x] `0464 0979 3699 0624 0659` 不在「热身」结果中。
- [x] 「复合动作」命中 62 条，且与具体部位标签结果重叠（每条复合动作都能被某具体部位筛到）。
- [x] 关键词 + 器械桶 + 部位标签仍是 AND；`equipment === 'body weight'` 仍是自重口径唯一判断。
- [x] 页面级：`resultCount === 136`，`partFilters` 渲染 11 项，首屏 24 条、追加后 48 条、无重复 ID。
- [x] 列表项 JPEG `cloud://` fileID 与失败 glyph 降级行为不变；列表不请求 GIF。
- [x] `npx jest tests/catalog.test.js tests/library-paging.test.js --runInBand` 通过。

## 验证方式

```bash
npx jest tests/catalog.test.js tests/library-paging.test.js --runInBand
node --check data/curated-catalog.js
```

## 剩余风险 / 人工事项

- 11 个筛选 pill 在真机上的横向滚动与选中态属于人工验收项（票 05）。
