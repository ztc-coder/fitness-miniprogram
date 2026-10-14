# 集成双轴审查

初审固定比较：`git diff 0850414189c6ebbf6c4f42469b8ebaa336490fce...afec2c5598804a04727bb5a95981e1976b8a0e8d`。Standards 与 Spec 独立并行审查，以下不跨轴合并或重新排序。原始两轴发现保留；统一修复已合入 `26c83c1`，独立双轴复审均 APPROVE，结果见末尾。

## Standards

结论：**REQUEST_CHANGES**。高覆盖，只读。

### Hard violations

1. **P1：删除契约被完成日志覆盖**。`utils/training-log.js:18` 在未同步计划缺失时无条件追加。离线完成后 `db.deletePlan()` 已写穿删除，但读取计划会复活；同步也可能重建云端项。违反本地立即删除契约。修复：删除时使相同 local/cloud alias 的待同步推进结果失效，保留场次历史；覆盖删除后的读取和重试。
2. **P2：队列核心判定旁路**。`utils/queue.js:76–78` 的 flush 自行判断离线与顺序，绕过 `domain.decideSubmission()`，领域判定测试与真实执行脱钩。违反 `CONTEXT.md` §3 / §4 的纯判定集中原则。修复：新日志同步阶段的纯判定归 domain，queue 只执行 I/O，回归真实执行路径。

### Judgment calls

Possible Duplicated Code / Shotgun Surgery：详情页多次判断 `flowVersion/status`，与 domain 的兼容识别形成多个维护点；当前合法 schema 下未确认行为错误，不另列 P2。其它 baseline smell 未达到报告门槛。

审查覆盖 runtime / test hunks、计划迁移与历史读取；未执行动态测试、构建或网络请求。云权限、真实 WXML、存储配额与设备行为不在本轮只读证据内。

## Spec

结论：**REQUEST_CHANGES**。高覆盖，只读。

1. **P1：已删计划被完成日志复活**。`utils/training-log.js:18`；违反提交契约“无计划时 plan=null，不伪造计划”。静态核对主代理复现：离线 complete → deletePlan → getLocalPlans，日志重加计划，后续可重建云端项。修复：删除时取消该计划待同步推进，覆盖映射 ID 与重试，保留场次。
2. **P1：返回加练页重载保存失败后，旧页面覆盖最新草稿**。`pages/training/training.js:66,185`；违反 A16“不丢新增动作”。动作库已成功追加，训练页无条件重写最新草稿失败时仍保留旧 session 且 canEdit=true；随后跳过间歇或编辑会把旧快照写回，新增动作丢失，甚至可提前完成整场。修复：重载失败关闭编辑，成功采用最新草稿前不允许写入；已升级草稿不无条件重写。
3. **P2：连续零秒间歇漏提醒**。`pages/training/training.js:210`；违反 §2.2“前台到时播放短提示音、短振动”。三组训练中第一组后间歇减到零，认领标记 true；第二组后新的零秒间歇也直接 true，比较布尔 false→true 的页面逻辑不认领新间歇，漏响 / 漏振。修复：按间歇身份而非单个布尔值比较。

顺序、门禁、暂停、撤销、部分跳过、新旧统计有静态实现及用例；加练恢复、提醒、提交兼容仍为 partial。无设备证据，不验证真实微信行为。未发现明确 scope creep；未运行测试、探针或构建。新增复现链为静态推演，基线目录失败与旧 skipped 不计新回归。

## 汇总

Standards：2 个硬问题（最高 P1），1 项判断性维护建议。Spec：3 个问题（最高 P1）。两轴独立保留；实际修复包含共同报告的计划删除问题、队列判定、重载保护、零秒提醒，并处理兼容识别重复。由单个实现代理统一修复，再定向复验。
## 本轮修复记录

原始 Standards / Spec 发现和 REQUEST_CHANGES 保持独立，不删除共同的计划删除发现。修复与实际新增回归见 [acceptance.md](acceptance.md) 的“双轴统一修复”节。

- Standards P1：完成日志计划删除标记匹配 raw/cloud alias；取消计划工作，保留 canonical/history；读取及 inflight 回调不复活，网络已开始则 best-effort 补删除。公开 db/queue 失败/重试/race 回归已执行。
- Standards P2：flush 每轮使用 domain.decideSubmission，执行层不再自行选择 head/online；真实 wx 边界验证顺序/失败重试/plan-only 不重复上传与游标。
- Standards 判断性建议：导出原 domain 兼容识别和 actualSets，详情每动作一次调用，共用判据。
- Spec P1 删除：同上述实现，但本轴发现独立保留；不改变 session/history、默认 savePlan 或 v5 迁移。
- Spec P1 重载：新草稿直接采用快照；读取/升级写失败关闭写入，WXML 显式重试；所有写事件直到重载成功才解锁。
- Spec P2 提醒：以非空最近完成 setId 辨认新认领，连续零秒分别提醒；先成功存储，final/skip/双击/重进不补响。

修复代理定向 JSON success=true（182 passed / 25 skipped / 0 failed）；合并后协调者指定 10 套件为 186 passed / 25 skipped / 0 failed。全量 JSON success=false（366 passed / 29 skipped / 唯一已知 catalog 缺源失败）。阈值未改，domain branches 89%。设备验证仍未执行。

## 独立复审 — Standards

**APPROVE；0 个剩余 P0–P2。** 固定范围 `86bc5de..26c83c1`，只读高覆盖静态复核。

- P1 删除复活：Resolved。raw / cloud alias 的删除标记持久取消计划工作，overlay 排除已删计划；同步前后复查，旧回调不 upsert，已发请求 best-effort 补删除；场次历史保留。
- P2 队列旁路：Resolved。flush 每轮调用 `domain.decideSubmission()`，符合核心规则集中原则。
- 判断性兼容重复：Resolved。详情页使用 domain 导出 selector，与统计共用判据。

未运行测试或构建；动态结果引用协调者实际验证，不误称 reviewer 独立执行。云权限、远端补删除失败、设备存储配额与真实 WXML / 提醒未动态验证。

## 独立复审 — Spec

**APPROVE；0 个剩余 P0–P2。** 固定范围 `86bc5de..26c83c1`，只读高覆盖静态复核，不等同重新扫描全量基线。

- 删除与历史保留：Covered。raw / alias、旧异步回调、重试及历史保留有实现与 submission 回归。
- A16 / A21 最新草稿恢复：Covered。新草稿直接采用；读取 / 升级写失败阻断事件、finish、tick，显式重试成功才解锁；新增动作与截止时间保留。
- 每次零秒间歇提醒：Covered。比较非空稳定最近完成组 ID，先持久化；连续零秒、final、skip、重进、撤销均有回归。
- 真机验收：Not Verifiable。无设备、真实 WXML 或云权限证据，04 / 父 issue 保持 ready-for-human / open。

未运行测试或构建。远端补删除仍为 best-effort，真实设备行为待人工验证。

最终两轴汇总：Standards 0 个剩余问题、Spec 0 个剩余问题；两轴均 APPROVE，不据此关闭人工验收。
