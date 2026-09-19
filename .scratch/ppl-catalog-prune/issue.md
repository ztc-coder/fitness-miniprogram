---
title: 三分化动作库裁剪与计划迁移
labels: [ready-for-agent]
status: done
created: 2026-09-18
---

# 三分化动作库裁剪与计划迁移

## 已确认规则

动作库按 `target` 白名单裁剪，保留：

- 胸三：`pectorals`、`triceps`
- 背二：`lats`、`upper back`、`spine`、`biceps`
- 肩腿：`delts`、`quads`、`hamstrings`、`glutes`、`calves`、`abductors`、`adductors`
- 腹：`abs`

删除其余 target：`serratus anterior`、`forearms`、`traps`、`levator scapulae` 等。预计目录从 1295 条收至 1236 条。

## Scope

1. 修改 `scripts/build-exercises.js`，从源数据生成上述白名单目录；保留现有 cardio 排除、中文名覆盖、slug 映射和分片机制。
2. 重新生成 `data/exercises-data-*.js` 与 `data/slug-map.js`；目录只含白名单 target。
3. 自动一次性迁移已有本地/云端训练计划：删除不在新目录的动作；删除空训练日；无训练日时删除整份计划；历史 session 不变。
4. 演示计划更新为“胸三 / 背二 / 肩腿”；第三天加入肩部动作，但不预置腹部动作。腹部仅保留于动作库。
5. 迁移必须版本化、幂等，并有准确的本地/云端写入顺序，不能每次启动重复写入。

## Non-goals

- 不删除或修改任何历史 session。
- 不上传媒体；媒体上传属于 `.scratch/exercise-catalog/issues/04-cloudbase-gifs.md`，依赖本 issue 的最终目录。
- 不改变搜索、器械归并、volume 口径。

## Acceptance

- [x] 目录 target 集合是上述白名单子集，目录总数为 1236。
- [x] 非白名单动作不能搜索、不能从动作库加入计划。
- [x] 计划迁移删除不可用动作和空训练日；空计划被删除；session 保留。
- [x] 迁移重复执行不重复写云端或改变既有有效计划。
- [x] 演示计划为“胸三 / 背二 / 肩腿”，且第三天有肩部动作、无腹部预置动作。
- [x] 现有 Jest 测试及新增迁移/目录行为测试通过。

## 后续修复记录

- 2026-09-18 P1：迁移原实现把「本地迁移」与「云端同步」写在同一个版本号里，云端写失败后仍落版本号，联网后 fetchPlans 拉回未裁剪的云端旧计划且迁移不再执行。已拆为 `fitness:planMigrationVersion`（本地写穿成功即落）与 `fitness:planMigrationCloudSynced`（确认云端可达且云端写全部成功才落）两个键；云端同步未落定时联网后自动重试云端裁剪，成功后不再重复写。回归测试覆盖「离线迁移 → 联网恢复」。历史 session 不动。
