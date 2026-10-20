<!-- DSH-IDEMPOTENCY-KEY: deck-plan-wayfinder-public-release-phase1-child-test-isolation -->
<!-- parentKey: 00 -->
<!-- created: 2026-10-20T06:40:24.398Z -->
# 隔离 npm test 对外部 /tmp 数据集的依赖

## Question

`scripts/build-exercises.js:10` 的 `DEFAULT_SRC_DIR = process.env.DATASET_DIR || '/tmp/exercises-dataset'` 让测试依赖一台机器上的临时目录。`workspace-baseline.md` 记录过 35 套里 1 套因此失败，并明确「不能声称全量测试全绿」。

## 验收

- 干净环境（无 `/tmp/exercises-dataset`）下 `npm test` 全绿，失败项不再混在「29 跳过」里。
- 需要外部数据集的用例进仓库夹具，或显式 skip 且写明原因与启用条件。
- 不改变正式构建脚本的默认行为（`scripts/build-exercises.js` 仍可用 `--src` 指向真实数据集）。

## 进度

<!-- 做到哪一步了，在这里一行一行记 -->


## Comments


## Answer

Status: open
Type: task
Blocked by:
Labels: wayfinder:task
