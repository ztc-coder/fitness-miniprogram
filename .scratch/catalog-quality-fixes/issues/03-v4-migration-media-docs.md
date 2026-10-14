---
title: v4 计划迁移、媒体集合与文档一致性
labels: [ready-for-human]
status: done
created: 2026-09-21
---

# 03: v4 计划迁移、媒体集合与文档一致性

## Blocked by

02: 127 条精选目录、0238 命名与生成链。

## What to build

把计划目录迁移升到 v4，覆盖 9 个下架动作的自动裁剪与历史 Session 零写入；同步 `CONTEXT.md`、`docs/spec.md`、ADR-0007、README 与契约测试到 127 条 / 254 媒体目标。用真实 CloudBase dry-run 核对缺失与陈旧对象；不得执行 `--execute` 删除。

## Acceptance

- [x] v3 设备升级后执行 v4，裁掉 9 个动作并保持游标、离线恢复、幂等语义。
- [x] 历史 Session 零读取、零写入。
- [x] 领域文档统一为 127 条、v4、254 个目标；删除已无实例的 `carry` 领域词条。
  - `39 词受控词表` 本身**按协调者指令保留完整**（该词表是精选元数据的受控词表，`carry` / `scapular-retraction` 已无目录实例但仍属合法模式），因此 `CONTEXT.md` 的该表述与 `tests/contract-docs.test.js` 的对应断言未删除，只在词条里注明「词表不等于当前目录出现过的模式集合」。
- [x] CloudBase dry-run 给出最终集合差异；当前环境无法执行，已记录实际失败原因并保持 `ready-for-human`（见「CloudBase dry-run 记录」）。
- [x] 全量 Jest、JS 语法检查、diff check 通过。

## Verification

```bash
npx jest tests/db.test.js tests/contract-docs.test.js --runInBand
npm test -- --runInBand
git diff --check
```

## 验证记录（2026-09-21）

改动文件：

| 文件 | 改动 |
|---|---|
| `utils/db.js` | `PLAN_MIGRATION_VERSION` 3 → 4；迁移注释补第 4 条（本轮 9 个下架 ID，无 replacement） |
| `tests/db.test.js` | 所有迁移版本期望 3 → 4；`describe` 更名「最终 127 条目录 v4」；新增 `describe('目录裁剪迁移(本轮 9 个下架动作 v4)')` 4 条用例 |
| `tests/contract-docs.test.js` | 契约改为 127 条 / 254 目标 / 16 条热身 / v4；新增 254 媒体目标用例；过时规模模式补 `136/272`，新增过时版本模式 `v3 迁移`、`迁移到 v3`、`迁移版本为 **v3**`；锁定 `CONTEXT.md` 不再出现 `负重行走` |
| `CONTEXT.md` | 动作库规模 136 → 127；删除 `carry`（负重行走）领域词条与 `mode` 行的「负重行走」示例，并注明受控词表不等于当前目录模式集合；热身动作词条补「当前 16 条」；文档索引改指本轮 issue |
| `docs/spec.md` | 状态行 / 取值范围 / 主键 / 筛选 / 验收边界 / Testing Decisions / 待办 全部同步到 127 条、v4、254 目标、热身 16 条；主键段列出本轮裁掉的 9 个 ID |
| `docs/adr/0007-exercises-dataset-as-catalog.md` | 白名单规模 136 → 127；迁移版本 v3 → v4 并列出本轮裁掉 ID |
| `README.md` | 动作库 136 → 127 条、热身 16 条；发布前置阻塞项媒体集合 272 → 254 个受管对象并标注 v4 |
| `.scratch/catalog-expansion/issue.md` | 历史轮次状态回写：`status: open → done`，顶部加「状态回写」说明（136/v3/272 只描述当时状态，当前契约以本轮 issue 为准） |
| `.scratch/catalog-quality-fixes/issue.md` | 票表 01/02/03 状态更新为 done；frontmatter `labels: [ready-for-human]`、`status: done`；新增人工验收清单 |
| `.scratch/catalog-quality-fixes/issues/03-v4-migration-media-docs.md` | 本票 frontmatter、验收项与验证记录 |

命令与结果：

```bash
npx jest tests/db.test.js --runInBand            # 1 suite / 33 tests passed
npx jest tests/contract-docs.test.js --runInBand # 1 suite / 8 tests passed
npm test -- --runInBand                          # 9 suites / 159 tests passed
node --check utils/db.js tests/db.test.js tests/contract-docs.test.js   # 通过
git diff --check                                 # 无空白错误
```

变异验证（确认新断言真的锁住契约）：把 `README.md` 的「127 条精选目录」改回「136 条精选目录」，`tests/contract-docs.test.js` 的文档契约用例失败；恢复后通过。

新增迁移用例覆盖（`tests/db.test.js` → `目录裁剪迁移(本轮 9 个下架动作 v4)`）：

1. 9 个 ID 全部不可 `findById`；含它们的训练日裁剪后保留有效动作，纯下架训练日整日删除，不注入 replacement，本地版本键落 4。
2. 全部动作被下架的整份计划删除：在线时 `plans:remove` 1 次、本地与云端版本键落 4、`sessions:*` 零调用。
3. 游标：当前训练日整日下架时落到下一个保留日；被删日之前的有效日仍指向同一个当前日。
4. v3 设备离线升级到 v4：本地立即裁剪并落 4、云端键停在 3 且不发云写；联网后补偿云端（`plans:update` 1 次）并落定 4；再执行不重复写、`sessions:*` 零调用。

既有用例同步（沿用上一轮 0200/0673、0994 的裁剪与 local_ 合并语义）：迁移版本期望全部升到 4，`v2 离线升级`、`local_ 计划上云`、`seedVersion` 等用例的版本键与描述同步更新。

## CloudBase dry-run 记录（保持 ready-for-human）

按票面要求只做真实 dry-run，**未执行 `--execute`，未做任何上传或删除**：

```bash
node scripts/upload-exercise-media.js
# 未找到媒体源目录,已探测:/tmp/exercises-dataset
# 请 clone hasaneyldrm/exercises-dataset 后用 --src 指定,或设置 EXERCISES_MEDIA_DIR。
# EXIT=1
```

实际失败原因（本机环境，非代码问题）：

1. **媒体源缺失**：`/tmp/exercises-dataset` 只下载了 `exercises.json`、`name_zh.json`，没有 `images/`、`videos/` 子目录，`resolveSrcDir()` 探测全部候选后退出 1（媒体约 130 MB，未在本机取得）。
2. **SDK 未安装**：`require.resolve('@cloudbase/manager-node')` → `MODULE_NOT_FOUND`；按任务约束不安装依赖，即使补上媒体源也无法走到列举远端与删除候选阶段。
3. 凭据已在环境变量中（`TCB_SECRET_ID` / `TCB_SECRET_KEY` 均非空，未打印取值），因此凭据不是本次阻塞点。

因此**不声称**云端最终集合或陈旧对象已核对，保持 `ready-for-human`。

仓库内可复核的等价纯函数证据（非云端结果，仅证明目标集合与差异逻辑）：

```text
EXERCISES 127 / buildUploadTargets 254 / findUnresolvableMedia 0
9 个下架 ID 的 18 个媒体路径均不在 254 目标集合中
模拟远端 = 254 目标 + 18 陈旧对象 + 1 个范围外对象
  → toUpload 0, alreadyPresent 254, staleCandidates 18, outOfScope ['other/keep.txt']
```

人工验收项（保持 `ready-for-human`）：

- [ ] 用真实媒体源执行 `node scripts/upload-exercise-media.js`（dry-run），确认远端受管对象与 254 目标一致、陈旧候选恰为本轮 9 个 ID 的 18 个对象。
- [ ] 确认删除范围仅 `exercises/images/`、`exercises/videos/`；`--execute` 由人工在确认后执行。

未提交 git commit（由协调者统一处理）；未改动 `project.config.json`；未执行 `--execute`/删除。
