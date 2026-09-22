# 03: 动作库页官方原值胶囊多选

**What to build:** 动作库页两行筛选改为官方部位与器械原值胶囊。点击切换选中，同行可多选，再点取消；点「全部」清空该行。列表、匹配数与筛选条件一次提交，滚动仍按 24 条追加、最多预热 48 张 JPEG。加练/加入训练日入口保持可用。

**Blocked by:** 02 离线检索改为官方原值多选

**Status:** implemented

- [x] 部位行展示 9 个官方非 cardio 部位中文标签加「全部」
- [x] 器械行展示发布目录实际器械原值加「全部」，缺译名回退英文
- [x] 多选与「全部」清空的选中态与列表结果一致
- [x] 筛选条件与 items/resultCount 一次提交，不依赖 setData 回调再检索
- [x] 首屏 24 条，触底再加 24 条；列表不预取 GIF
- [x] 详情仍按 GIF → JPEG → glyph 降级；pick/加入训练日行为不变
- [x] 本票不执行真实云上传

## 交付的页面契约

`pages/library/library.js`：

- 选中态是**原值数组**：`equipmentKeys`（器械原值）/ `bodyPartKeys`（官方 `body_part` 原值），空数组 = 该行无约束。
- 两行胶囊由选中集推导，`[{key, label, active}]`：首项 `key === '全部'`（`active` 当且仅当该行空选），其余 `key` 是官方原值、`label` 走共享中文表。
- `onEquipFilterTap` / `onBodyPartFilterTap`：点未选项加入、点已选项取消；点 `'全部'` 清空该行（不影响另一行与搜索词）。
- `applySearch` 一次 `setData` 提交 `query` + 两行选中集 + 两行胶囊 + `items` / `preheatItems` / `resultCount` / `hasMore`，**不传 `setData` 回调**。
- 检索走 02 的 `lib.search(query, equipmentKeys, bodyPartKeys)`：组内 OR、组间与搜索 AND。
- 分页与预热仍走 `pages/library/library-paging.js`：首屏 24、触底 +24、当前页+下一页最多 48 张 JPEG；列表条目不含 `gifSrc`。
- 详情 `equipmentZh` / `bodyPartZh` 改为共享中文表（原 `partTagsLabel` 精选标签口径已退役）。

`data/exercise-labels.js`（新增，**唯一一处**中文表定义，动作库页 / 打卡页详情共用）：

- `BODY_PART_KEYS`（9 个官方非 cardio `body_part`，顺序即胶囊顺序）+ `BODY_PART_LABELS`（背 / 胸 / 前臂 / 小腿 / 颈 / 肩 / 上臂 / 大腿 / 腰腹）。
- `EQUIPMENT_LABELS`：barbell 杠铃、dumbbell 哑铃、ez barbell EZ杆、cable 绳索、rope 绳索、machine / leverage machine 器械、smith machine 史密斯机、sled machine 滑轨机、kettlebell 壶铃、band / resistance band 弹力带、body weight 自重、weighted 负重、assisted 辅助；**未预置原值回退英文原值**。
- `EQUIPMENT_ORDER` 固定序表 + `equipmentKeys(items)`：发布目录实际出现的原值，已知走表序、未知按字母序追加、去重。`assisted` 与 `body weight` 是两个独立胶囊（两个独立原值，不归并）。

## 改动文件

| 文件 | 改动 |
|---|---|
| `data/exercise-labels.js` | 新增：官方原值中文表 + 固定序表 + `equipmentKeys()`；未知原值回退英文 |
| `pages/library/library.js` | 两行筛选改原值多选（`equipmentKeys` / `bodyPartKeys`）；`filterPills` 推导 `active`；一次 `setData` 提交；详情用共享中文表 |
| `pages/library/library.wxml` | 两行 `wx:for` 渲染 `equipmentFilters` / `bodyPartFilters`，`data-key` + `item.active` 选中态；空态文案改为「请尝试其他器械、部位或检索词」。wxss 未改（沿用 `.filter-pill`） |
| `pages/today/today.js` | 器械显示恢复中文译名（缺译名回退原值），自重口径提示不变 |
| `pages/training/training.js` | 详情器械/部位显示恢复中文译名（缺译名回退原值） |
| `tests/library-paging.test.js` | 解除 `describe.skip`；分页 helper 与 WXML 绑定用例保留；页面级用例按新契约重写（多选选中态、「全部」清空、一次提交、24/48 窗口、JPEG fileID、全量匹配数、pick 入口） |
| `tests/library-multiselect.test.js` | 新增：中文表契约（9 部位 / 器械译名 / 未知回退 / assisted ≠ body weight / 稳定排序）+ WXML 胶囊绑定 |
| `tests/training-media.test.js` | 详情断言从上游原值改为中文译名（`chest` → `胸`、`barbell` → `杠铃`），与恢复中文展示同步 |

未改：`data/exercises-data-*.js`（票 01）、`tests/contract-docs.test.js`（票 04）、`utils/domain.js` / `PLAN_MIGRATION_VERSION`、`computeVolume` 的 `equipment === 'body weight'` 判据。

## 验证记录（2026-09-22）

```bash
npx jest tests/library-paging.test.js tests/library-multiselect.test.js tests/catalog.test.js tests/search-multiselect.test.js
# Test Suites: 4 passed, 4 total
# Tests:       43 passed, 43 total

npx jest
# Test Suites: 1 failed, 13 passed, 14 total
# Tests:       6 failed, 3 skipped, 280 passed, 289 total
# 唯一失败套件 = tests/contract-docs.test.js（6 条，票 04 范围：仍断言 125 条 / 14 条热身 / 11 项筛选顺序 /
#   旧 search 签名 search('', '', 'warm-up') / 文档 250 个媒体目标 / AGENTS.md 索引；本票未碰这些文档与目录）
# 3 skipped = tests/exercise-selector*.test.js 因本机数据集目录缺失的条件跳过（票 02 起既有）

node --check data/exercise-labels.js pages/library/library.js pages/today/today.js pages/training/training.js
# 语法通过
```

页面行为抽查（125 条夹具，`Page` harness + 记录 `setData` 调用）：

```
onLoad({})
  器械行: 全部(*) 杠铃(barbell) 哑铃(dumbbell) EZ杆(ez barbell) 绳索(cable) 器械(leverage machine)
          史密斯机(smith machine) 滑轨机(sled machine) 弹力带(band) 弹力带(resistance band) 自重(body weight)
  部位行: 全部(*) 背 胸 前臂 小腿 颈 肩 上臂 大腿 腰腹
  items 24 / preheatItems 48 / resultCount 125
onBodyPartFilterTap('upper legs') + onEquipFilterTap('sled machine')
  → equipmentKeys ['sled machine'] / bodyPartKeys ['upper legs'] / resultCount 2（首条 0739 腿举，meta「臀肌 · 滑轨机」）
onEquipFilterTap('barbell') → setData 调用数 1，patch 同时含 equipmentKeys / equipmentFilters / items / resultCount / hasMore
                             且未传回调（pendingCallbacks 为空）
onEquipFilterTap('全部') → equipmentKeys []，器械行仅「全部」active，另一行与 query 不变
onReachBottom() → items 48、id 不重复、不再触发检索
onThumbError(id) → 该条 thumbSrc ''，name 保留
onItemTap(id) → detail.gifSrc 以 .gif 结尾、imageSrc 以 .jpg 结尾、equipmentZh/bodyPartZh 为中文译名
onLoad({pick:'1'}) + onItemTap + onPickExercise() → 训练草稿新增该动作（exerciseId + 原值 equipment）并 navigateBack
```

## 未验证项与剩余风险

1. **未在真实全量目录（约 1295 条）上验证**：`data/exercises-data-*.js` 仍是 125 条精选产物（全量重生成被本机源媒体缺失阻塞，票 01 遗留）。页面级用例的期望集一律由 `catalog.search(...)` / 目录原值推导，不写死条数，故换全量目录后仍成立。
2. **未在微信开发者工具里渲染验证**：`wx:for` / `item.active` / `data-key` 绑定只由 Jest 读 WXML 文本与 `Page` harness 断言，真实渲染与横向滚动、胶囊换行/裁切仍需人工过一遍。
3. **`data-key` 传含空格原值**（`body weight` / `ez barbell` / `leverage machine` / `sled machine` / `smith machine` / `lower arms`）依赖 `dataset.key` 原样回传；harness 覆盖了该路径，真机未验。
4. **同一行可能出现两个同中文标签的胶囊**：`band` 与 `resistance band` 都是「弹力带」，全量目录里 `machine` 与 `leverage machine` 也会都是「器械」。这是原值即身份这一契约的固有结果（票 01/02 明确 `assisted` 与 `body weight` 也不归并），胶囊以 `key`（原值）区分，不是 bug；若产品上不接受，需另开票改展示名策略。
5. **中文表只覆盖目录现有原值 + 票内点名值**：全量目录若出现未预置原值，界面按契约回退英文原值，不做兜底翻译。
6. **本票未执行任何 CloudBase 上传**；未重新生成目录数据；未改 `utils/domain.js` / `PLAN_MIGRATION_VERSION`；未改 `computeVolume` 的自重判据；未 commit / push / build。
7. **`tests/contract-docs.test.js` 仍失败**（票 04）：它断言的是旧精选口径（125 条、14 条热身、11 项筛选顺序、`search('', '', 'warm-up')`），与本票无关，按约定未改该文件。
