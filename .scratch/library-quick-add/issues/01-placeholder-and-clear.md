---
title: 训练日占位与搜索清空
labels: [ready-for-agent]
status: done
created: 2026-09-25
---

按 `../spec.md` 修改 `pages/plan/plan.js`、`pages/library/library.{js,wxml,wxss}`。为搜索清空补页面测试，确认不影响筛选、不依赖 `setData` 回调。

## 验证记录（2026-09-25）

| 文件 | 改动 |
|---|---|
| `pages/plan/plan.js` | 新建训练日 `showModal` 的 `placeholderText` 由 `例如:推 / 拉 / 腿 / 肩` 改为 `胸/背/肩/腿` |
| `pages/library/library.js` | 新增 `onClearSearch()`，走既有 `applySearch({ query: '' })`：关键词与两行筛选胶囊、`items`/`resultCount`/`hasMore` 同一次 `setData` 提交，不依赖回调；新增 `noop()` 供弹层阻断触摸冒泡 |
| `pages/library/library.wxml` | 搜索框内新增清空图标，`wx:if="{{query}}"` 仅非空可见，`catchtap="onClearSearch"` |
| `pages/library/library.wxss` | `.search-row` 定位、`.search-input` 右侧预留 84rpx 触控区、`.search-clear` / `.search-clear-glyph` / `.search-clear-hover` |
| `tests/library-quick-add.test.js` | 新增票 01 契约与页面行为测试（占位文字、清空图标可见性/绑定、清空后筛选保留 + 一次提交 + 无回调） |

命令与结果：

```bash
npx jest tests/library-quick-add.test.js --runInBand   # 1 suite / 13 tests passed（含票 02 用例）
node --check pages/library/library.js                  # 通过
node --check pages/plan/plan.js                        # 通过
git diff --check                                       # 无空白错误
```

- 清空后结果按保留的器械 + 部位条件重算，断言 `resultCount` 与 `items` 等于 `catalog.search('', ['dumbbell'], ['chest'])` 的前 24 条。
- `pendingCallbacks` 为 0，证明条件与结果同次提交、不靠 `setData` 回调补检索。
- 未运行生产构建（按 spec 要求）。
