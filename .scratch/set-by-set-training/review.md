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

审查运行中，尚无结果；不预测结论。

## 汇总

Standards：2 个硬问题（最高 P1），1 项判断性维护建议。Spec：待结果。后续将由单个实现代理统一修复，并定向复验。