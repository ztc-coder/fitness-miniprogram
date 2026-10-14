---
title: 删除 3011/3021 与 v5 目录迁移
labels: [ready-for-agent]
status: done
created: 2026-09-21
---

# 01: 删除 3011/3021 与 v5 目录迁移

## What to build

从精选白名单删除 `3011`（上斜肩胛俯卧撑）和 `3021`（肩胛俯卧撑），清理生成链与媒体目标，目录迁移升 v5。

## Acceptance

- [x] 两个 ID 不在 `CURATED_EXERCISES`、离线目录、slug/aliases 和上传目标。
- [x] 目录 125 条、热身 14 条、媒体目标 250 个，已有筛选顺序不变。
- [x] v4 设备升级到 v5 时裁剪两个动作、删除空日/空计划、正确调整游标；离线恢复和幂等成立。
- [x] 历史 Session 零读取、零写入；不建立 replacement。

## Verification

```bash
node scripts/build-exercises.js
npx jest tests/catalog.test.js tests/db.test.js tests/upload-exercise-media.test.js --runInBand
```

## 验证记录（2026-09-21）

改动文件：

| 文件 | 改动 |
|---|---|
| `data/curated-catalog.js` | 删除 `3011` / `3021` 两条白名单元数据；头部注释改为最终 125 条（本轮裁 2 条，更早轮次见 `.scratch` 历史） |
| `scripts/hand-overrides.js` | 删除 `incline-scapula-push-up`（3011）、`scapula-push-up`（3021）两个 slug 与 `3011` / `3021` 两条 aliases |
| `scripts/build-exercises.js` | `TARGET_WHITELIST` 上方注释：`traps` / `serratus anterior` 保留在 16 项粗筛表内，但当前目录已无对应动作（3011/3021 下架）；粗筛表本身未动 |
| `data/exercises.js` | 头部注释目录规模 127 → 125（生成器不写该文件） |
| `data/exercises-data-1.js` / `data/exercises-data.js` / `data/slug-map.js` | 重跑生成器：125 条分片、slug-map 89 → 87 |
| `utils/db.js` | `PLAN_MIGRATION_VERSION` 4 → 5；迁移注释补第 5 条（本轮 3011/3021，无 replacement） |
| `tests/catalog.test.js` | 127 → 125；`FROZEN_TAG_COUNTS` 重算（chest 21→19、shoulders 22→20、warm-up 16→14，其余不变）；`WARM_UP_IDS` 去 3011/3021 剩 14 条；`ADDED_IDS` 去 3011/3021 剩 28 条；新增 `SCAPULAR_REMOVED_IDS` 用例（白名单/目录/slug/别名/旧展示名）；`traps|serratus` 断言改为当前目录无实例；冻结 nameZh 去 3021 |
| `tests/db.test.js` | 全部迁移版本期望 4 → 5；`describe` 更名「最终 125 条目录 v5」；新增 `describe('目录裁剪迁移(票 01 的两个下架动作 v5)')` 5 条用例（v5 裁剪、空日/空计划、游标、v4→v5 在线、v4→v5 离线恢复+幂等） |
| `tests/library-paging.test.js` | `resultCount` 127 → 125；热身 16 → 14；末页 125 条 |
| `tests/upload-exercise-media.test.js` | 127 → 125、254 → 250；`NEW_EXERCISE_IDS` 30 → 28；`EXCLUDED_MEDIA` 补 3011/3021 的 4 个上游媒体路径（20 → 22 条）；陈旧候选用例 `alreadyPresent` 254 → 250 |
| `tests/contract-docs.test.js` | 契约改为 125 条 / 250 目标 / 14 条热身 / v5；过时规模模式补 `127 条`、`127 个`、`254 个`，新增过时版本模式 `v4 迁移`、`迁移到 v4`、`迁移版本为 **v4**`；AGENTS.md 索引断言改指本轮票 |
| `CONTEXT.md` | 动作库规模 127 → 125；热身词条「当前 16 条」→ 14 条；文档索引改指本轮 issue，保留历史轮次记录 |
| `docs/spec.md` | 状态行 / 取值范围 / 主键 / 筛选 / 验收边界 / Testing Decisions / 待办 / 当前实现 全部同步到 125 条、v5、250 目标、热身 14 条；主键段改列本轮裁掉的 `3011/3021` |
| `docs/adr/0007-exercises-dataset-as-catalog.md` | 白名单规模 127 → 125；迁移版本 v4 → v5 并改列本轮裁掉 ID |
| `README.md` | 动作库 127 → 125 条、热身 16 → 14 条；发布前置阻塞项媒体集合 254 → 250 个受管对象并标注 v5；验收索引改指本轮 issue |
| `AGENTS.md` | 项目文档索引改指 `.scratch/exercise-selector/issue.md` 与本票，保留上一轮与扩容历史记录 |
| `.scratch/exercise-selector/issue.md` | 票表 01 → done、02 → ready-for-agent（03 仍 blocked） |
| `.scratch/exercise-selector/issues/01-remove-scapular-pushups.md` | 本票 frontmatter、验收项与验证记录 |

命令与结果：

```bash
node scripts/build-exercises.js
# chunk 1: 125 条, 77.7 KB → data/exercises-data-1.js
# exercises: 125 条 → data/exercises-data.js
# slug-map: 87 → data/slug-map.js

npx jest tests/catalog.test.js tests/db.test.js tests/upload-exercise-media.test.js --runInBand
# 3 suites / 95 tests passed
npx jest tests/catalog.test.js tests/db.test.js tests/upload-exercise-media.test.js tests/library-paging.test.js tests/contract-docs.test.js --runInBand
# 5 suites / 111 tests passed
npm test -- --runInBand
# 9 suites / 168 tests passed
node --check data/curated-catalog.js data/exercises.js data/exercises-data-1.js data/exercises-data.js data/slug-map.js scripts/hand-overrides.js scripts/build-exercises.js utils/db.js tests/catalog.test.js tests/db.test.js tests/library-paging.test.js tests/upload-exercise-media.test.js tests/contract-docs.test.js
# 全部通过
git diff --check
# 无空白错误
```

可复核的纯函数证据（非云端结果）：

```text
catalog.EXERCISES 125 / CURATED_EXERCISES 125 / findById('3011')=null / findById('3021')=null
warm-up 14 / chest 19 / shoulders 20 / compound 55 / slug-map 87
buildUploadTargets 125 × (JPEG+GIF) = 250；3011/3021 的 4 个媒体路径均不在目标集合中
traps / serratus anterior 在当前目录已无实例
```

新增迁移用例覆盖（`tests/db.test.js` → `目录裁剪迁移(票 01 的两个下架动作 v5)`）：

1. 两个下架 ID 从计划移除、纯下架训练日删除、不注入 replacement，本地版本键落 5，`sessions:*` 零调用。
2. 全部动作被下架的整份计划删除：在线时 `plans:remove` 1 次、本地与云端版本键落 5、`sessions:*` 零调用。
3. 游标：当前训练日整日下架时落到下一个保留日；被删日之前的有效日仍指向同一个当前日。
4. v4 已完成迁移的在线设备升级到 v5：云端计划被裁剪、`plans:update` 1 次、两个版本键落 5、再执行不重复写。
5. v4 设备离线升级到 v5：本地立即裁剪并落 5、云端键停在 4 且不发云写；联网后补偿云端并落定 5；再执行不重复写、`sessions:*` 零调用。

变异验证（确认新断言真的锁住契约）：

- 把 `3011` 重新加回 `CURATED_EXERCISES` 并重跑生成器 → `tests/db.test.js`、`catalog.test.js`、`upload-exercise-media.test.js`、`contract-docs.test.js` 共 13 条用例失败（含本票新增的 2 条裁剪用例）；恢复后全绿。
- 把 `PLAN_MIGRATION_VERSION` 改回 4 → `tests/db.test.js` 20 条用例失败（含本票新增 5 条）；恢复后全绿。
- 把 `README.md` 的「125 条精选子集」改回 127 → `tests/contract-docs.test.js` 文档契约用例失败；恢复后全绿。

范围边界（保持）：

- 未改动 `tools/exercise-selector/`（票 02/03 范围）、`project.config.json`、`docs/exercise-selector-prd.md`、票 02/03 文件。
- 未执行 CloudBase `--execute`：`3011/3021` 的 4 个媒体对象只在真实同步时作为陈旧候选处理，需人工在确认后执行删除。
- 未提交 git commit（由协调者统一处理）；历史 `.scratch/catalog-expansion/`、`.scratch/catalog-quality-fixes/` 保留为历史记录，未回写。

## 人工验收（保持 ready-for-human）

- [ ] 真实 CloudBase：`node scripts/upload-exercise-media.js`（dry-run）确认 125 条目录的 250 个受管对象存在，`3011/3021` 的 4 个对象为陈旧候选；删除范围仅 `exercises/images/`、`exercises/videos/`。
- [ ] 微信开发者工具 / 真机：动作库列表与筛选在 125 条目录下渲染正常，热身筛选显示 14 条。
