---
title: 集成验收与领域文档一致性
labels: [ready-for-human]
status: done
created: 2026-09-19
---

# 05: 集成验收与领域文档一致性

## 历史票收口

用户已确认验收并授权关闭剩余票，本次同步此历史票的 done 状态。下方旧人工验收状态仅保留历史，不再作为当前未关闭任务。

本票的 136 条 / 11 标签 / v3 方案已被 [全量目录发布](../../full-catalog/issue.md) 和 [七类筛选](../../library-seven-parts/issue.md) 取代，按父 issue 历史票表同步为 done。旧 11 标签界面不再是当前验收目标；本轮不重跑退役方案、不改写历史验收结论。

下文为当时审计记录。后续真实媒体发布记录见 [媒体目标与发布](../../full-catalog/issues/04-media-and-contracts.md)；尚缺的当前微信端渲染、筛选、详情、加练与逐组训练证据统一挂在 [现有人工验收票](../../set-by-set-training/issues/04-integration-acceptance.md)。关闭历史票不等于当前真机通过。

**What to build:** 端到端确认 136 条精选目录、11 个标签筛选、分页缩略图、v3 计划迁移与媒体同步计划共同可用；
把领域文档（CONTEXT/spec/ADR/README）与旧 issue 状态同步到最终行为，并留下可复核的验收记录。
真实微信开发者工具渲染与真实 CloudBase 媒体集合仍为人工验收项，不得由 mock 或 dry-run 代替。

**Blocked by:** 02: 11 个标签筛选与动作库页面契约; 03: v3 计划迁移：直接删除旧 ID，无 replacement; 04: 媒体同步计划与最终集合核对。

**Status:** ready-for-human —— 仓库内自动化与文档一致性已通过；真实微信开发者工具渲染与真实 CloudBase 媒体验收仍未完成。

**Spec 来源**：`.scratch/catalog-expansion/issue.md`（数量与分布、迁移与契约、人工验收边界）。

## 文件范围（只改这些）

| 文件 | 改动 |
|---|---|
| `CONTEXT.md` | 目录规模改 136；`aliases` 定义为已实现并参与搜索；部位标签含「热身」共 10 个（筛选 11 项）；`mode` 词表与 `TARGET_WHITELIST` 口径一致。 |
| `docs/spec.md` | 精选目录规模、10 个标签（含热身）、别名可检索、v3 迁移与人工验收项同步（`docs/spec-mvp.md` 已于 2026-09-21 合并入本文件）。 |
| `docs/adr/0007-exercises-dataset-as-catalog.md` | 目录规模与白名单口径同步（不改变个人自用/署名约束）。 |
| `README.md` | 动作库体积与规模描述同步。 |
| `data/exercises.js` | 头注释里的目录规模描述同步。 |
| `AGENTS.md` | 项目文档索引把“动作库当前 spec/验收”指向 `.scratch/catalog-expansion/issue.md`。 |
| `.scratch/common-exercise-catalog/issue.md`、`issues/*.md` | 旧一轮 ticket 状态与最终 136 条口径对齐（不重写历史结论）；该目录已于 2026-09-21 整体删除（见本票验收记录）。 |
| `.scratch/catalog-expansion/issue.md`、`issues/*.md` | 本票完成后回写状态与验收记录。 |

**不在本票范围**：白名单/元数据（票 01）、筛选实现（票 02）、迁移实现（票 03）、媒体脚本（票 04）；
不新增功能，只做一致性收口与验收记录。

## 实现要点

1. **术语一致性**：`CONTEXT.md` 的领域词汇表必须与代码一致——
   `aliases` 参与搜索、`warm-up` 是第 10 个产品标签（筛选第 11 项含「全部」）、
   `mode` 是 39 词受控词表、`TARGET_WHITELIST` 16 项且不含 `forearms`/`levator scapulae`。
2. **数字一致性**：所有“约 100–140 条”表述保留（136 仍在该范围），
   但凡是写死 `104` 或“九个部位标签”的地方必须改为 136 / 10 个标签（筛选 11 项）。
3. **契约不变声明**：文档明确 Plan/Session 结构、主键格式、`equipment === 'body weight'` volume 口径未变。
4. **人工验收边界**：文档与 ticket 明确区分“仓库内自动化已验证”与“真实微信/CloudBase 待人工验收”。

## 验收

- [x] `npx jest --runInBand` 全量通过。
- [x] `node --check` 覆盖改动的 JS 文件；`git diff --check` 无空白错误。
- [x] 全仓 grep 无残留：`104`（指目录规模处）、`九个部位标签`、`PART_FILTERS).toHaveLength(10)`。
- [x] `CONTEXT.md` 目录规模 = 136，部位标签含「热身」，`aliases` 描述与实现一致。
- [x] `docs/spec.md`（已含原 `docs/spec-mvp.md` 全文）、`docs/adr/0007`、`README.md` 的目录规模与筛选描述一致。
- [x] `AGENTS.md` 的项目文档索引指向本轮 spec，不再把旧一轮 issue 当作当前验收依据。
- [x] `.scratch/catalog-expansion/` 下 01–05 的状态与验收记录回写完成。
- [x] 验收记录明确列出未完成的人工项：微信开发者工具真实筛选/滚动/图片降级；真实 CloudBase 最终集合与陈旧媒体清理。
- [x] 真实媒体验收结论不由 Node mock 或 dry-run 代替。

## 验证方式

```bash
npx jest --runInBand
node --check data/exercises.js && node --check utils/db.js
git diff --check
grep -rn "九个部位\|104" --include=*.md --include=*.js . | grep -v node_modules
```

## 剩余风险 / 人工事项

- 真实微信开发者工具与真实 CloudBase 验收需要本机环境与云凭据，属于人工步骤；
  未完成时本票只能标记为部分完成，不得声称端到端验收通过。

## 验收记录（2026-09-19，仓库内）

**最终契约核对（由测试断言，非人工目测）**

| 契约 | 实现位置 | 证据 |
|---|---|---|
| 136 条目录，与 `CURATED_EXERCISES` 一一对应 | `data/curated-catalog.js`、`data/exercises.js` | `tests/catalog.test.js`「恰好 136 条，与白名单一一对应」 |
| `0200`/`0673` 及 9 条排除 ID 不存在 | 同上 | `tests/catalog.test.js` `REMOVED_IDS` 断言 |
| `aliases` 参与关键词搜索（倒蹬/龙门架/下拉/澳式引体） | `data/exercises.js` `search()` | `tests/catalog.test.js`「用健身房俗称搜索可命中对应动作」 |
| `mode` 39 词受控词表 | `data/curated-catalog.js` | `tests/catalog.test.js` `MODE_VOCABULARY` |
| 11 项筛选严格顺序（全部/胸/背/肩/二头肌/三头肌/腿/腰腹/臀/热身/复合动作） | `PART_LABELS` + `PART_FILTERS` | `tests/catalog.test.js`、`tests/library-paging.test.js` |
| `warm-up` 18 条且与具体部位重叠 | `data/curated-catalog.js` | `tests/catalog.test.js`「热身是重叠标签」 |
| 24 条分页 / JPEG fileID | `pages/library/library-paging.js` | `tests/library-paging.test.js`（`resultCount = 136`） |
| v3 迁移、无 replacement | `utils/db.js` `PLAN_MIGRATION_VERSION = 3` | `tests/db.test.js` |
| 272 个受管媒体对象 | `scripts/upload-exercise-media.js` | `tests/upload-exercise-media.test.js` |
| 文档契约与代码一致 | `CONTEXT.md`、`docs/**`、`README.md`、`AGENTS.md` | 本票新增 `tests/contract-docs.test.js` |

**实际执行的验证**

```bash
npm test -- --runInBand --silent      # 8 suites / 139 tests 全通过（含修复后回归测试）
find . -name '*.js' (排除 node_modules) | xargs node --check   # 37 个文件全部通过
npx jest --runInBand                  # 同上，无失败
```

- `git diff --check`：无空白错误（退出码 0）。
- `PART_FILTERS).toHaveLength(10)`：0 处（现为 `toHaveLength(11)`）。
- 旧契约 grep（排除 node_modules）：
  - **契约文档已清空**：`CONTEXT.md`、`docs/spec.md`、`docs/adr/0007`、`README.md`、`AGENTS.md`、`data/exercises.js` 头注释中 `104` 与「九个部位」均为 0 处。
  - `104` 剩余处均不是目录规模口径：`data/curated-catalog.js` 头注释的基线公式 `104 − 2 + 34`、`.scratch/catalog-expansion/issue.md` 与 ticket 01 的同一公式、`tests/upload-exercise-media.test.js` 的「旧 104 条目录」注释。
  - 「九个部位」剩余处：`tests/contract-docs.test.js` 的过时短语常量与测试名（断言其不存在）、本票自身需求原文。
- 本轮改动文档：`CONTEXT.md`、`docs/spec.md`、`docs/adr/0007-exercises-dataset-as-catalog.md`、`README.md`、`data/exercises.js`（头注释）、`AGENTS.md`。
- 旧一轮 `.scratch/common-exercise-catalog/` 的 `issue.md` 与 5 张 ticket 当时已加「已被取代」横幅并把筛选口径对齐到 10 标签 / 11 项；历史检查项与状态保持原样，未篡改当时的验收结论。

**后续文档清理（2026-09-21）**

已删除（文件本体可从 git 历史取回）：

- `.scratch/exercise-catalog/`、`.scratch/common-exercise-catalog/`（issue + 5 票）、`.scratch/ppl-catalog-prune/`、`.scratch/ppl-media-upload/`、`.scratch/exercise-detail-modal-scroll/` —— 均已被后续轮次取代或已关闭。
- `.scratch/common-exercise-catalog/catalog-expansion-proposal.md`（冻结提案）与 `xiaohongshu-research.md`（调研稿）—— 白名单权威改由 `data/curated-catalog.js` 的 `CURATED_EXERCISES` 单独承担。
- `fitness-prototype.html` —— 早期浅色原型，已被深色 FORGE 设计取代。
- `docs/spec-mvp.md` —— 全文并入 `docs/spec.md`。

`tests/contract-docs.test.js` 中「被取代的旧一轮 ticket」用例随之删除，其余契约断言（136 条 / 11 项筛选 / 文档索引 / 人工验收口径）保持。

**未完成的人工验收（不由 agent 声称完成）**

1. 微信开发者工具：11 项筛选真实渲染与 WXML 绑定、滚动追加 24 条、缩略图加载失败降级、详情 GIF → JPEG → glyph。
2. 真实 CloudBase：上传 136 条目录的 272 个受管对象、确认最终集合一致、删除 `exercises/images` 与 `exercises/videos` 下的陈旧对象。

当前环境无微信开发者工具自动化基础设施、媒体源目录、`@cloudbase/manager-node` 与云凭据，两项均只能由人工执行；本票因此保持 `ready-for-human`。
