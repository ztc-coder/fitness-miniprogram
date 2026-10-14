# 集成双轴审查

固定比较：`git diff 0850414189c6ebbf6c4f42469b8ebaa336490fce...afec2c5598804a04727bb5a95981e1976b8a0e8d`。Standards 与 Spec 独立并行审查，以下不跨轴合并或重新排序。修复未完成。

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