---
title: 动作卡片快捷加入训练日
labels: [ready-for-agent]
status: done
created: 2026-09-25
---

依赖 01。按 `../spec.md` 在 `pages/library/` 增加独立卡片按钮及普通浏览训练日选择，并验证指定训练日、普通浏览和训练草稿入口；不修改 `0314` 数据。

## 验证记录（2026-09-25）

| 文件 | 改动 |
|---|---|
| `pages/library/library.js` | 抽出 `buildPlanExercise()` / `addToPlanDay()` / `addToDraft()`，详情确认与卡片快捷按钮共用同一写入路径；新增 `onQuickAdd()`（`pickMode` → 草稿 + 返回；指定 `planId`+`dayId` → 直接加入；否则打开选择器）、`buildPickerPlans()` / `openDayPicker()` / `onPickerPlanTap()` / `onPickerDayTap()` / `onClosePicker()`；删除因抽取而失效的 `rawEquipmentOf()` |
| `pages/library/library.wxml` | 每张卡片右侧新增独立快捷按钮，`catchtap="onQuickAdd"` 不冒泡到卡片的 `onItemTap`；新增普通浏览用的计划/训练日选择弹层（计划行横向滚动 + 训练日 `scroll-y` 列表） |
| `pages/library/library.wxss` | `.library-quick-btn` 等快捷按钮样式；`.picker-*` 弹层样式（卡片取 62vh 确定高度，内层 `scroll-view` 才能原生滚动） |
| `tests/library-quick-add.test.js` | 三种入口、保存失败、不打开详情、详情流程不退化、计划切换只换列表不写入 |

命令与结果：

```bash
npx jest tests/library-quick-add.test.js tests/library-paging.test.js tests/library-multiselect.test.js --runInBand
# 3 suites / 35 tests passed
node --check pages/library/library.js   # 通过
git diff --check                        # 无空白错误
```

- 指定训练日入口：写入指定 `dayId`，其他训练日原样保留；处方为目录原值 + 默认 `3 组 / 10 次 / 自重 0 其余 20`。
- 普通浏览入口：无可选训练日时提示 `请先创建训练日` 且不写计划；有训练日时先打开选择器再写入所选日。
- 训练草稿入口：`pick=1` 写入 `fitness:trainingDraft` 并 `navigateBack`，不调用 `fetchPlans`/`savePlan`。
- 保存失败：`savePlan` 拒绝时提示 `保存失败`，不误报成功。
- `0314`（哑铃上斜卧推）数据与中文名未改动。
- 未运行生产构建（按 spec 要求）。

未提交 git commit（由协调者统一处理）。
