# 02: 离线检索改为官方原值多选

**What to build:** 训练者对已生成的全量目录做本地检索时，部位按官方身体部位原值筛选，器械按目录里实际出现的器械原值筛选，不再使用归并桶或热身/复合/二头三头等产品标签。同一维多选为并集，部位、器械与搜索词之间为交集；空选表示该维无约束。俗称别名仍能搜到对应动作。自重容量判据仍是器械原值 body weight。

**Blocked by:** 01 生成非 cardio 可用全量目录

**Status:** implemented

- [x] 每个非 cardio 官方部位筛选结果非空（若该部位在发布目录中存在）
- [x] 每个实际器械原值筛选结果非空；`assisted` 与 `body weight` 不相等
- [x] 多选部位 = 并集；部位 ∩ 器械 ∩ 搜索 = 交集
- [x] 已有俗称别名仍能命中对应 id；别名不改变展示名
- [x] 热身、复合、归并桶筛选入口不再存在于检索 API
- [x] `findById` 对发布目录内 id 成功，对排除清单 id 失败
- [x] 本票不改页面胶囊交互（交给 03）

## 交付的检索契约

`data/exercises.js`：

```js
search(query, equipmentKeys, bodyPartKeys)
```

- `query`：关键词，不区分大小写，命中 `id` / `name` / `nameZh` / `target` / `bodyPart` / `equipment`（均为数据集原值）与 `aliases`（俗称 / 旧译名）。
- `equipmentKeys`：器械原值数组；空数组或 `undefined` 表示该维无约束。
- `bodyPartKeys`：官方 `bodyPart` 原值数组；空数组或 `undefined` 表示该维无约束。
- 同维多选为并集（OR），维度之间为交集（AND）。
- 返回 `EXERCISES` 中命中的条目**原引用**，不复制。

退役（不再导出）：`equipmentBucket`、`EQUIPMENT_FILTERS`、`EQUIPMENT_LABELS`、`equipmentLabel`、`BODY_PART_LABELS`、`bodyPartLabel`、`PART_LABELS`、`PART_FILTERS`、`matchCuratedPart`、`partTagsLabel`。
保留不变：`EXERCISES`、`CURATED_EXERCISES`、`targetLabel`、`findById`（`TARGET_LABELS` 转为模块私有以维持 `targetLabel` 行为）。

## 改动文件

| 文件 | 改动 |
|---|---|
| `data/exercises.js` | 新 `search` 签名与语义；退役筛选/展示词汇与相关 import；`TARGET_LABELS` 转私有；顺手修中文名里拉丁字母未小写化导致漏命中的旧 bug（如 `v 杆窄距高位下拉` 搜不到 `2616`） |
| `tests/search-multiselect.test.js` | 新增：检索契约 10 条用例 |
| `tests/catalog.test.js` | 只改与检索签名/筛选契约直接冲突的断言（退役产品标签、归并桶、`'全部'` 旧调用约定）；125/CURATED 口径保留给票 04 |
| `tests/library-paging.test.js` | 分页 helper 用例保留；页面级筛选用例改 `describe.skip` + TODO 指向票 03；WXML 绑定用例移到独立 describe 保持有效 |
| `tests/training-media.test.js` | 详情断言从精选部位标签改为上游原值 |
| `pages/today/today.js` | 器械显示原值（不再用退役的 `equipmentLabel`） |
| `pages/training/training.js` | 详情器械/部位显示原值（不再用退役的 `equipmentLabel` / `partTagsLabel`） |

`pages/library/*` 一行未改（票 03）。

## 验证记录（2026-09-22）

```bash
npx jest tests/search-multiselect.test.js tests/catalog.test.js tests/upload-exercise-media.test.js tests/library-paging.test.js
# 4 suites passed / Tests: 5 skipped, 62 passed, 67 total
# 5 skipped = tests/library-paging.test.js 页面级筛选用例（票 03 重写后启用）

npx jest
# 13 suites: 12 passed, 1 failed（tests/contract-docs.test.js 6 条，票 04 范围）
# Tests: 6 failed, 8 skipped, 266 passed, 280 total
# 8 skipped = 5（library-paging 页面级）+ 3（exercise-selector 因本机数据集目录被清空条件跳过）
# 相对基线 277 total 的变化：+10（新检索用例）-7（catalog 退役筛选断言）=+3；
# contract-docs 由基线 5 条失败增至 6 条，新增那条正是断言退役的 PART_LABELS / search('', '', 'warm-up')

node --check data/exercises.js pages/today/today.js pages/training/training.js
# 语法通过

git diff --stat -- pages/library/
# 空：本票未改动作库页
```

行为抽查（125 条夹具）：

```
search('', [], [])                       → 125（= EXERCISES.length，同一引用）
search('', ['barbell','dumbbell'], [])   → 45（并集，两组互斥）
search('卧推', ['barbell','dumbbell'], ['chest']) → ['0025','0047','0289','0314']
search('倒蹬')                           → ['0739']；search('倒蹬', ['sled machine'], ['upper legs']) → ['0739']
search('v 杆窄距高位下拉') / search('BENCH PRESS') → 命中 2616 / 0025（大小写不敏感）
search('', ['assisted'], []) → 0；search('', ['body weight'], []) → 27（不合并）
search('', [], ['warm-up']) → 0；search('', ['全部'], []) → 0（退役入口）
findById('0025') → 命中；findById('3011') → null
```

## 未验证项与剩余风险

1. **动作库页仍是旧筛选实现**：`pages/library/library.js` 继续引用已退役的 `EQUIPMENT_FILTERS` / `PART_FILTERS` / `equipmentLabel` / `partTagsLabel`，页面 `onLoad` 在当前代码下会抛错。页面胶囊多选属票 03，本票按约定未改该目录，页面级用例在 02 期间 `describe.skip`。
2. **`pages/today` / `pages/training` 的器械与部位显示退化为英文原值**（`barbell` / `chest`），因为器械中文表与精选部位标签已退役；中文标签映射需由票 03 及后续重建。这是本票的已知观感回退，非功能回归（`equipment === 'body weight'` 的自重判据不变）。
3. **中文标签不再参与关键词搜索**：新契约只命中数据集原值字段，`search('胸大肌')` / `search('杠铃')` 这类按中文标签的旧命中改为按 `nameZh` 命中（`'杠铃'` 仍命中 `0025`，因为中文名含「杠铃」）。中文部位/器械由票 03 的胶囊承担。
4. **未在真实全量目录（约 1295 条）上验证**：本机 `/tmp/exercises-dataset` 已被清空，`data/exercises-data-*.js` 仍是 125 条精选产物。新用例的期望集一律按目录原值推导（不写死条数），少量硬编码 id（`0025`/`0739`/`0314`/`0748` 等）都属发布目录内稳定条目，但全量重生成后仍需复跑本文件。
5. **`assisted` 在 125 条夹具里没有条目**：`search('', ['assisted'], [])` 为空，故该用例用「原值集合互斥、并集不膨胀、辅助类动作 `0009/0017/0019` 不被自重命中」钉住「不归并」，而不是断言非空结果集。
6. **`data/curated-catalog.js` 仍导出 `PART_LABELS` / `PART_FILTERS`**（本票只从 `data/exercises.js` 退役，不再 re-export），精选白名单与 125/CURATED 口径迁移属票 04；`tests/contract-docs.test.js` 的 6 条失败即由此而来，本票未改该文件。
7. 本票未执行任何 CloudBase 上传，未改 `utils/domain.js` / `PLAN_MIGRATION_VERSION`，未重新生成 `data/exercises-data-*.js`，未提交。
