# 主代理集成检查补充

以下是已执行的公开接口探针，不替代最后双轴审查。

## 待修复：未同步完成日志复活已删除计划

检查提交：`0c64878`。

1. 本地 `fitness:plans` 存计划 `p`，两天循环、游标 0。
2. 按 domain 公开接口开始并完成第 1 天的一组。
3. 离线调用 `queue.complete(session)`；本地成立，未同步推进结果游标 1。
4. 调用 `db.deletePlan('p')`，云端 `remove()` Promise reject 模拟离线。
5. 读取 `db.getLocalPlans()`。

实际输出：`fitness:plans` 为 `[]`，但 `getLocalPlans()` 返回 `[{id: 'p', cursor: 1}]`。`training-log.overlayPlans()` 把已明确删除的计划重新追加；随后同步也可能重建远端计划。

应保留已完成场次历史，但使该计划的待同步推进失效或显式标记删除，避免日志把删除动作撤销。需要通过 db / queue 公开边界增加回归，覆盖 cloud id、映射后的 local id 与网络重试。不扩大成一般离线计划同步框架；旧计划目录迁移 v5 规则不改。
## 统一修复后

以上原探针保留为问题来源。完成日志现持久取消同 raw/cloud alias 的计划工作；公开 db/queue 回归覆盖删除后读取、重试、inflight set 回调及删除存储失败，保留场次 canonical/history。实际自动验证见 [acceptance.md](acceptance.md)，独立复审及真机未完成。
