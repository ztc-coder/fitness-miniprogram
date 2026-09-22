# 01: 生成非 cardio 可用全量目录

**What to build:** 维护者给定锁定的数据集与中文映射后，生成器产出可发布的离线动作目录：排除有氧，排除锁定清单里缺源 JPEG、源 GIF 或中文要领的动作；每条都有唯一 id、非空中文名、非空中文要领和对应媒体路径。没有源媒体目录、或清单外再缺文件时，生成失败、不写出可发布目录。快照记录数据集版本、映射版本、排除清单与生成时间，结果可复现。

**Blocked by:** None (can start immediately)

**Status:** implemented — 生成器与闸门已就绪并夹具验证；`data/exercises-data-*.js` 全量重生成被本机源媒体缺失阻塞（见「未验证项与剩余风险」）

- [x] 发布目录不含 cardio，也不含排除清单中的 id
- [x] 清单外每条非 cardio 动作均可按 id 查到，且 name 与上游英文一致、nameZh 与中文要领非空
- [x] 允许不同 id 共用同一中文名；id 必须唯一
- [x] 无源媒体目录，或清单外源 JPEG/GIF 缺失时生成失败
- [x] 既有手译中文名与俗称别名仍写进对应动作；未覆盖的新动作别名为空
- [x] 文本目录继续本地分片、离线可读；生成锁定版本信息
- [x] 本票不改动作库筛选 UI，也不执行真实云上传

## 闸门口径（实现）

1. 候选 = 上游 `body_part !== 'cardio'` 且 `category !== 'cardio'`；**不再**使用 `CURATED_EXERCISES` 白名单或 `TARGET_WHITELIST` 粗筛（耸肩 / 前臂 / 颈 / 肩胛提肌 / 平衡设备 / 爆发变式一律放行）。
2. 「可访问」= `DATASET_DIR/<image>` 与 `DATASET_DIR/<gif_url>` `lstat` 为**普通文件**（目录、符号链接含断链都不算，与 `scripts/upload-exercise-media.js` 拒收口径一致）；JSON 里有 `gif_url` 不算通过。
3. 缺源 JPEG / 源 GIF / 中文要领的 id 必须已在 `scripts/catalog-exclusions.js` 锁定清单内：**清单外缺口 → 失败**；**清单条目在源文件里没有缺口 → 失败**（清单过期，健康动作不允许被静默剔除）。
4. 缺 `images/` 或 `videos/` 源目录 → 失败；id 非 4 位数字或重复 → 失败；`nameZh` 为空 → 失败（不把英文名当中文名发布）；手译覆盖指向 cardio / 排除清单 / 数据集外 → 失败（选定「失败」策略，已钉死在测试）。
5. 快照 `catalog-snapshot.json` 记录 `exercises.json` / `name_zh.json` 的 sha256 前 12 位、行数/键数、排除清单、非 cardio 候选数/发布数/排除数、生成时间、分片策略与各分片条数。

## 改动文件

| 文件 | 改动 |
|---|---|
| `scripts/build-exercises.js` | 重写生成器：退役精选白名单与 target 粗筛；新增非 cardio + 源媒体 lstat + 中文要领 + id/nameZh 闸门；排除清单双向对齐；分片写出 + 顶层 require loader + slug-map + 版本快照；导出 `generateCatalog` / `writeCatalog` 供夹具测试，新增 `OUT_DIR`，`require.main === module` 才跑 CLI |
| `scripts/catalog-exclusions.js` | 新增：锁定的媒体排除清单（仓库内可审计输入，id → 原因），当前 `3011` / `3021`（2026-09 快照无可用 GIF） |
| `tests/build-exercises.test.js` | 新增 21 条夹具用例：非 cardio 全量放行、唯一 4 位 id、中文名碰撞允许、缺媒体/缺要领/缺媒体目录/清单过期失败、清单内缺口剔除、手译 nameZh 与别名（走真实 `hand-overrides.js`）、分片与 loader 离线可读、快照字段、可复现、当前发布产物不变量 |
| `tests/catalog.test.js` | 只删与「生成闸门退役」直接冲突的 `TARGET_WHITELIST` 源码断言用例，留注释指向新用例；125/CURATED 与产品筛选契约原样留给 02/04 |
| `.scratch/full-catalog/issues/01-generate-full-catalog.md` | 本票验收框、状态与验证记录 |
| `.scratch/full-catalog/issue.md` | 票表 01 状态 → implemented（注明阻塞项） |

未改动（有意保持）：`data/exercises.js`、`data/exercises-data-*.js`、`data/exercises-data.js`、`data/slug-map.js`、`data/curated-catalog.js`、`scripts/hand-overrides.js`、`scripts/upload-exercise-media.js`、`pages/library/*`、`utils/db.js`（`PLAN_MIGRATION_VERSION` 未动）、`project.config.json`。

## 验证记录（2026-09-22）

命令与结果：

```bash
node --check scripts/build-exercises.js scripts/catalog-exclusions.js tests/build-exercises.test.js tests/catalog.test.js
# 语法通过

npx jest tests/build-exercises.test.js
# 1 suite / 21 tests passed

npx jest tests/build-exercises.test.js tests/catalog.test.js tests/upload-exercise-media.test.js tests/library-paging.test.js
# 4 suites / 85 tests passed

npx jest
# 12 suites: 11 passed, 1 failed（tests/contract-docs.test.js 5 条，票 04 范围，本轮基线已失败）
# Tests: 5 failed, 3 skipped, 269 passed, 277 total
# 3 skipped = tests/exercise-selector.test.js 里 HAS_DATASET 条件跳过（本机数据集目录被清空）

node scripts/build-exercises.js
# exit 1：缺少源数据 exercises.json:/tmp/exercises-dataset/exercises.json + 下载提示（预期失败路径）

git diff --check
# 无空白错误
```

变异验证（确认新断言真的锁住契约，改后已还原）：

- 把 target 粗筛加回生成器（`if (row.target !== 'pectorals') return;`）→ `cardio 按 body_part 或 category 排除,其余全量放行` 失败（前臂/颈/肩胛提肌动作被丢掉）。
- 把 `isAccessibleFile` 的 `lstatSync(...).isFile()` 换成 `existsSync(...)` → `源路径是目录或符号链接都不算可访问` 失败。
- 还原后 `tests/build-exercises.test.js` 21 条全绿。

## 未验证项与剩余风险

1. **全量重生成被源媒体缺失阻塞（唯一阻塞项）**：`/tmp/exercises-dataset` 在本轮会话中被系统清空（`exercises.json` / `name_zh.json` 也没了），本机从未有上游 `images/` 与 `videos/`。因此 `data/exercises-data-*.js` 仍是上一轮 125 条精选产物，**未重生成**，生成器对真实 1295 条的产物也未经真实媒体复核。闸门行为全部用夹具目录验证（含成功路径与各失败路径）。
2. **排除清单 `3011` / `3021` 只有仓库历史证据**（`.scratch/exercise-selector/issues/01-remove-scapular-pushups.md`：无可用 GIF），未经真实媒体复核。真实重生成时双向对齐会强制复核：清单条目无缺口即失败。
3. **分片 > 1 时的应用接线未做**：生成器已写出含全部分片顶层 require 的 `data/exercises-data.js` loader，但 `data/exercises.js` 仍只 `require('./exercises-data-1')`（当前 125 条单片成立）。全量约 1295 条会切 3 片，届时需把顶层 require 接到生成产物；本票未改该文件，因为微信依赖分析是否跟随间接 require 无法用 Jest 验证（Jest 不代替微信开发者工具）。
4. 动作语义 / GIF 内容 / 译名对错不做自动审校；真实 CloudBase 上传与旧对象清理仍是人工门控（本票未执行任何云上传）。
5. `tests/contract-docs.test.js` 的 5 条失败属票 04（把文档契约改到全量 / 官方原值 / 排除清单口径），本轮基线即失败，本票未改。
6. `data/curated-catalog.js` 仍随包发布且 `data/exercises.js` 仍导出 `CURATED_EXERCISES`（旧检索语义）；退役筛选契约与页面多选留给票 02/03。
