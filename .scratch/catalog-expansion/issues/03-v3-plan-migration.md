---
title: v3 计划迁移：直接删除旧 ID，无 replacement
labels: [ready-for-agent]
status: done
created: 2026-09-19
---

# 03: v3 计划迁移：直接删除旧 ID，无 replacement

**What to build:** 升级到最终 136 条目录后，已有 Plan 自动移除不再存在的动作（含 `0200/0673`），
随之出现的空训练日和空计划被删除，游标仍落在可用训练日上；历史 Session 零写入；
离线先完成本地迁移，恢复网络后补偿云端同步且幂等。**不建立任何旧 ID → 新 ID 的替换映射。**

**Blocked by:** 01: 最终 136 条目录元数据与生成链（含 aliases、TARGET_WHITELIST）。

**Spec 来源**：提案 E 节（删除 2 条、无 replacement）、I 节（v3 迁移影响）。

## 文件范围（只改这些）

| 文件 | 改动 |
|---|---|
| `utils/db.js` | `PLAN_MIGRATION_VERSION` 由 2 改为 3；迁移注释同步（明确“可用性裁剪、无 replacement”）。 |
| `tests/db.test.js` | 迁移用例更新为 v3，并补 `0200/0673` 与无 replacement 的断言。 |

**不在本票范围**：`prunePlanCycleDays` 的裁剪算法（已按 `findById` 可用性实现，本票不改）；
白名单/元数据（票 01）；筛选与页面（票 02）；媒体（票 04）；文档（票 05）。

## 实现要点

1. **只升版本号**：迁移逻辑本身已是“按最终目录可查性裁剪”，v3 不需要新的映射表或数据表。
   `PLAN_MIGRATION` 与 `PLAN_MIGRATION_CLOUD` 两个本地键都会因版本不同而重新执行一次。
2. **删除顺序不变**：移除无效动作 → 删除空训练日 → 删除无训练日的整份计划；
   游标优先停在原当前日，原当前日被删时沿原顺序环回到下一个有效日。
3. **无 replacement**：`0200/0673` 直接从计划移除，**不得**改写成 `0201` 或 `0198/2616`；
   新增的 34 条也不自动注入既有计划。
4. **Session 不变**：迁移路径不得读取或改写 `sessions` 集合与本地 session 缓存。
5. **离线与幂等**：云端不可达时本地裁剪先落定、云端键不落定；恢复后补偿云端；两者都完成后不重复写入。
6. **旧 slug 不新增 replacement**：被移除动作的 slug 不再指向任何 ID；保留动作的既有 slug 继续可用。

## 验收

- [x] `PLAN_MIGRATION_VERSION === 3`，且迁移对 v2 已完成迁移的设备会再执行一次。
- [x] 计划中含 `0200/0673` 的动作被移除；移除后为空的训练日被删除；无训练日的计划被整份删除。
- [x] `0200/0673` 被移除后**没有**被替换成 `0201`、`0198`、`2616` 或任何其他 ID（断言无 replacement 映射）。
- [x] 新增动作不会出现在既有计划中。
- [x] 游标在被删训练日之后仍指向有效训练日；末尾正确环回。
- [x] `sessions` 与本地 session 缓存零写入、零变更，历史快照字段保持原样。
- [x] 离线迁移本地立即生效；恢复网络后云端补偿；云端失败不撤销本地结果；重复执行不重复写云端。
- [x] `npx jest tests/db.test.js --runInBand` 通过。

## 验证方式

```bash
npx jest tests/db.test.js --runInBand
node --check utils/db.js
```

## 剩余风险 / 人工事项

- 真实云端计划裁剪需要真实 CloudBase 凭据，属于人工验收项（票 05）。

## 验收记录（2026-09-19，agent）

- 改动：`utils/db.js` 只把 `PLAN_MIGRATION_VERSION` 由 2 升到 3 并同步迁移注释
  （明确“按最终目录可查性裁剪、无 replacement、新增动作不注入”）；迁移算法与数据表未变。
- 改动：`tests/db.test.js` 迁移用例升到 v3（原 v1→v2 用例改为 v2→v3），
  新增 `0200/0673` 移除且无 replacement、新增动作不注入既有计划、种子 `0314` 冻结名一致性断言。
- 命令与结果：
  - `npx jest tests/db.test.js --runInBand` → 1 suite / 25 tests 全通过。
  - `npx jest --runInBand` → 7 suites / 123 tests 全通过。
  - `node --check utils/db.js && node --check tests/db.test.js` → 通过；`git diff --check` 无空白错误。
  - 反向校验：临时把版本改回 2 时 8 个迁移用例失败，确认版本断言是有效判据（已恢复为 3）。
- 未覆盖（人工项）：真实 CloudBase 云端计划裁剪需要真实凭据，见票 05。
