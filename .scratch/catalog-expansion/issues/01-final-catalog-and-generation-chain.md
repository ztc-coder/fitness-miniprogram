---
title: 最终 136 条目录元数据与生成链（含 aliases、TARGET_WHITELIST）
labels: [ready-for-agent]
status: done
created: 2026-09-19
---

# 01: 最终 136 条目录元数据与生成链（含 aliases、TARGET_WHITELIST）

**What to build:** `data/curated-catalog.js` 的 `CURATED_EXERCISES` 变成冻结提案 K 节的 136 条白名单与元数据；
离线目录 `data/exercises.js` 由生成器重新产出后仍与白名单严格一一对应；`aliases` 成为目录一等字段并参与搜索；
生成器粗筛放行 `traps`、`serratus anterior`。

**Blocked by:** None (can start immediately).

**Spec 来源**：`.scratch/catalog-expansion/issue.md`
（最终 136 条白名单、删除/新增/排除 ID 清单、热身标签归属、`TARGET_WHITELIST` 放行项与 v3 迁移口径）。
逐条元数据的唯一权威是 `data/curated-catalog.js` 的 `CURATED_EXERCISES`。

## 文件范围（只改这些）

| 文件 | 改动 |
|---|---|
| `data/curated-catalog.js` | 白名单与元数据改为 136 条；删除 `0200/0673`；新增 34 条；按 F 修正既有 mode/tags。 |
| `scripts/build-exercises.js` | `TARGET_WHITELIST` 增 `traps`、`serratus anterior`（14 → 16）；输出 `aliases` 字段（缺省 `[]`）。 |
| `scripts/hand-overrides.js` | 新增 34 条 `nameZh` 手译；新增按 id 的 aliases 映射（覆盖 K 表所有非空 aliases）。 |
| `data/exercises.js` | 字段清单与注释同步；`search()` 命中 `aliases`。 |
| `data/exercises-data-1.js`、`data/slug-map.js` | 生成物，由 `node scripts/build-exercises.js` 重写（本票不手改）。 |
| `tests/catalog.test.js` | 白名单/规模/新增/排除/别名/粗筛相关断言更新。 |

**不在本票范围**：`utils/db.js` 迁移版本（票 03）、`pages/**`（票 02）、`CONTEXT.md`/`docs/**`（票 05）、媒体上传（票 04）。

## 实现要点

1. **数量与 ID**：`104 − 2 + 34 = 136`。
   - 删除：`0200`、`0673`。
   - 新增：`0009 0017 0216 0223 0226 0235 0246 0336 0381 0407 0437 0475 0575 0710 0864 0979 0993 1361 1604 1757 2133 2188 2616 3006 3012 3021 3561 3699 2143 1017 3011 0688 0624 0659`。
   - 保留且不得删除：`0227 0297 0310 0333`。
   - 严格排除且不得出现：`1015 0222 2399 3697 0549 2571 1419 1314 0241`，以及 `0129 0095 0406`。
2. **元数据逐条对齐 K 表**：`mode` 必须取自 F.1 的 39 词受控词表；`tags` 取 K 表所列顺序；
   `compound` 按 K 表布尔值。重点修正：飞鸟类 `0171 0188 0227 0308 0319 0596` → `chest-fly`；
   `0431` → `step-up`；`1299` → `incline-push`；`0472 0475 0620` → `hip-flexion`；
   `0464` → `trunk-rotation`；`0223 0407` → `trunk-lateral-flexion`；`0489 0573` 补 `glutes`。
3. **nameZh 冻结值**：`0314` = 上斜哑铃卧推；`0196` = 绳索穿腿后拉；`0464` = 平板支撑带转体；
   `0472` = 悬垂举腿（上游 `instruction_steps.zh` 明写“保持伸直”，**不得**写成屈膝）；
   `0201` = 绳索下压；`0431` = 哑铃登阶；`1299` = 器械上斜推胸；`0710` = 站姿髋外展；
   `3012` = 站姿肩胛后缩撑起；`3021` = 肩胛俯卧撑。
4. **`aliases` 生成链**：`hand-overrides.js` 暴露 id→aliases 映射；`build-exercises.js` 把 `aliases` 写进目录条目
   （无别名写 `[]`）；`data/exercises.js` 的 `search()` 关键词匹配追加 `item.aliases`；
   别名不参与部位筛选、不进入展示名、不改变 `findById`。
5. **新增条目的 slug**：在 `hand-overrides.js` 按现有约定补语义化 slug（如 `assisted-pull-up` → `0017`），
   不照抄误导性上游名（`3012` 不得用 `scapula-dips` 语义）。slug 必须唯一，且不得与既有 slug 冲突。
6. **生成器**：`TARGET_WHITELIST` 增 `traps`、`serratus anterior`；`TARGET_LABELS` 保持不变（18 项）。
   放行只服务 `0688/3011/3012/3021`，不得顺带收录 `0095/0406` 耸肩或任何前臂动作。
7. **上游数据前置**：生成需要 `/tmp/exercises-dataset/{exercises,name_zh}.json`（或 `DATASET_DIR`）。
   生成前必须复核 `0472/0475/0624/3012/3699/0710` 的 `instruction_steps.zh` 与 K 表名称一致；
   若上游说明书与 K 表冲突，停下报告，不静默改名。

## 验收

- [ ] `CURATED_EXERCISES` 恰好 136 条，ID 集合与提案 K 表 136 行完全一致（无多、无少、无重复）。
- [ ] `data/exercises.js` 的 `EXERCISES.length === 136`，且与白名单一一对应；`findById` 可查到全部 34 条新增。
- [ ] `0200/0673` 与 `1015 0222 2399 3697 0549 2571 1419 1314 0241 0129 0095 0406` 在 `CURATED_EXERCISES` 与目录中都不存在。
- [ ] `0227 0297 0310 0333` 仍在目录中，且 `0227` 的 mode 是 `chest-fly`。
- [ ] 每条 `mode` 在 F.1 词表内、`tags` 非空且都在 10 个部位/热身标签内、`compound` 为布尔值。
- [ ] `0464/0472/0314/0196/0201/0431/1299/0710/3012/3021` 的 `nameZh` 等于冻结值。
- [ ] 用俗称搜索可命中：`倒蹬`→0739、`龙门架`→0188 或 0868、`下拉`→0198、`澳式引体`→0499、`高脚杯深蹲`→1760。
- [ ] `TARGET_WHITELIST` 含 `traps`、`serratus anterior` 且不含 `forearms`、`levator scapulae`。
- [ ] `node scripts/build-exercises.js` 的 `absent` / `missing` / `uncurated` 检查全部通过，无错误退出。
- [ ] `npx jest tests/catalog.test.js --runInBand` 通过。

## 验证方式

```bash
node scripts/build-exercises.js          # 需要 /tmp/exercises-dataset
npx jest tests/catalog.test.js --runInBand
node --check data/curated-catalog.js && node --check data/exercises.js
```

## 剩余风险 / 人工事项

- 上游数据集版本漂移可能让个别 ID 的 `target`/媒体路径变化；生成前按实现要点 7 复核并报告。
- 真实 CloudBase 媒体不在本票范围（票 04）。
