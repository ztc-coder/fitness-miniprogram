---
title: 全量动作索引与筛选选择核心
labels: [ready-for-agent]
status: done
created: 2026-09-21
---

# 02: 全量动作索引与筛选选择核心

## What to build

为静态工具生成 1324 条精简索引，并实现无 DOM 依赖的导入规范化、AND 筛选、双分组、分页、选择集合和导出 payload 纯函数。

## Acceptance

- [x] Node 生成脚本从上游 `exercises.json` 产生确定的 1324 条精简索引，按 ID 排序。
- [x] 导入规范化校验必需字段，拒绝非数组/无 ID/重复 ID 等脏数据并返回可读错误。
- [x] 关键词、部位、器械 AND 筛选与按部位/器械分组正确。
- [x] 分页每页 48 条；选择跨筛选与分页保持。
- [x] 导出 payload 使用 spec schema，selected 按 ID 排序。
- [x] 纯函数 Jest 覆盖成功、空结果、错误输入和选择边界。

## Verification

```bash
node tools/exercise-selector/build-index.js
npx jest tests/exercise-selector.test.js --runInBand
```

## 验证记录（2026-09-21）

改动文件：

| 文件 | 改动 |
|---|---|
| `tools/exercise-selector/core.js` | 新增无 DOM 纯 JS 核心（UMD：浏览器 `<script>` 加载后读全局 `ExerciseSelectorCore`，Node/Jest 直接 `require`）。`normalizeExercises` 导入规范化（上游 snake_case 与内置 camelCase 都接受，输出严格 8 字段并按 4 位 ID 排序）、`filterExercises` 关键词+bodyPart+equipment AND、`groupExercises` 按 bodyPart/equipment 稳定分组、`paginate` 每页 48 条、选择集合（`createSelection` / `toggleSelection` / `selectAll` / `removeSelection` / `clearSelection` / `selectedIds`，全部纯函数）、`buildExportPayload`（schemaVersion 1、source、selectedCount、selected 按 ID 升序且不含 category） |
| `tools/exercise-selector/build-index.js` | 新增生成器：读 `DATASET_DIR/exercises.json`（默认 `/tmp/exercises-dataset`），复用核心规范化后渲染可直接 `<script>` 加载的索引 JS；支持 `--out`；源数据缺失时报可读下载提示并 exit 1；导出 `renderIndexFile` / `buildIndex` 供测试复用 |
| `tools/exercise-selector/index-data.js` | 生成的内置精简索引：1324 条 / 272.8 KB，字段严格 `id/name/category/bodyPart/equipment/target/imagePath/gifPath`，按 4 位 ID 升序，媒体保留上游相对路径（`images/…`、`videos/…`），浏览器无需 fetch |
| `tests/exercise-selector.test.js` | 新增 52 条纯函数用例（索引契约、生成确定性、导入错误、筛选/分组/分页/选择/导出、浏览器脚本加载） |
| `.scratch/exercise-selector/issues/02-selector-core.md`、`.scratch/exercise-selector/issue.md` | 本票状态 done + ready-for-agent；父 issue 票表 02 → done、03 → ready-for-agent |

命令与结果：

```bash
node tools/exercise-selector/build-index.js
# index: 1324 条, 272.8 KB → tools/exercise-selector/index-data.js

node tools/exercise-selector/build-index.js --out /tmp/idx-a.js
node tools/exercise-selector/build-index.js --out /tmp/idx-b.js
shasum -a 256 /tmp/idx-a.js /tmp/idx-b.js tools/exercise-selector/index-data.js
# 6c57c9ee21ac29dd8383f3c277c75eac5dc884714af0185b9017ae3037f28ed6 三份一致 → 生成确定

npx jest tests/exercise-selector.test.js --runInBand
# 1 suite / 52 tests passed
npm test -- --runInBand
# 10 suites / 220 tests passed
node --check tools/exercise-selector/core.js tools/exercise-selector/build-index.js tools/exercise-selector/index-data.js tests/exercise-selector.test.js
# 全部通过
git diff --check
# 无空白错误（新增未跟踪文件另用 git diff --no-index --check 复核，无输出）
```

可复核的纯函数证据（非浏览器结果）：

```text
内置索引 1324 条 / 唯一 ID 1324 / 字段严格 8 项 / ID 升序 / 媒体前缀 images/ 与 videos/
bodyPart 10 组：waist 169、back 203、chest 163、upper legs 227、upper arms 292、shoulders 143、lower arms 37、lower legs 59、cardio 29、neck 2；equipment 28 组
关键词（大小写不敏感）：bench 73、BENCH 73、0025 → 1、pectorals 158、upper legs 228（227 条 bodyPart 命中 + 0543 名称命中）、kettlebell 41
AND 组合：chest+barbell 13；chest+barbell+press 9
分页：1324 / 48 = 28 页，末页 28 条；28 页合并不重不漏、保持 ID 升序；越界页码收敛
选择：首末页 selectAll = 76 条，跨筛选/分组/翻页后集合不变
export：0025 与 spec 示例逐字段一致；空选择 selectedCount 0；未选中索引外 ID 报错而非静默丢弃
```

变异验证（确认新断言真的锁住契约）：

- 去掉规范化末尾的 `sort(compareById)` → 2 条用例失败；恢复后全绿。
- `PAGE_SIZE` 48 → 24 → 8 条用例失败；恢复后全绿。
- 跳过重复 ID 检查 → 2 条用例失败；恢复后全绿。

范围边界（保持）：

- 未创建 `index.html` / CSS（票 03 范围）；核心无 DOM 依赖，票 03 可直接用全局 `ExerciseSelectorCore` + `EXERCISE_SELECTOR_INDEX`。
- 导出只返回 payload，不写入 `data/curated-catalog.js`（用例锁定导出前后该文件字节不变）。
- 未改动票 01 / 票 03 文件、`docs/exercise-selector-prd.md`、目录数据与 `project.config.json`；未提交 commit。

## 人工验收（保持 ready-for-human）

- [ ] 浏览器打开票 03 的 `index.html`：内置索引 1324 条、导入错误提示、筛选/分组/分页与 GIF 加载状态可用。
