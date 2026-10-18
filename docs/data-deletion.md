# 03：撤回同意、清本机与全量删除（源码交付）

## 证据边界与用户操作

本轮只有源码及本机 mock 验证；无独立云环境、真实微信双用户或真机。没有部署、安装依赖、生产构建或 push；云规则、SDK 事务冲突和设备行为的真实验收仍 **Blocked**。入口是「我的 → 数据管理」，保留主题和单位偏好。

| 操作 / 公共 API | 精确范围 |
|---|---|
| 撤回 / `data-management.withdraw()` | 立即停用新增身份、同步、媒体请求并失效旧 epoch；保留本地和云端训练数据。在途请求不能取消，可能已执行。 |
| 清本机 / `clearLocal()` | 可离线；预览所有身份及匿名区草稿/待同步任务，二次确认后先撤回，再清全部私人键。云端不删除，重新主动同意后可能重新下载。 |
| 全量删除 / `authorizeDeletion()` + `deleteAll(token?)` | 单独 login 获取可信身份，不置产品同意、不启动普通上传；二次确认身份及当前 owner 损失后联网。只有云端完成确认才清该 owner 本地，保留其他 owner 和匿名区。失败/中断保留本地及删除 ID，需明确重试，不报成功。 |
| 替代任务恢复 / `inspectDeletion(token)` + `recoverDeletion(inspection)` | 删除专用授权后检查当前云状态；不同 job 且代际推进时标记旧任务 superseded，原 ID/代际不变。UI 重新展示本人损失和新旧代际，二次确认后再次核实同一云任务已完成，仅放弃当前 owner 本机残留及旧任务，不执行新云删除、不清其他 owner/匿名区。 |
| 屏障后重新使用 / `reconcile()` | 主动同意后，再二次确认放弃当前 owner 残留数据；确认云端不在删除中，清本地旧数据并采用当前代际。未完成本机删除任务须先重试；已被替代的旧任务使用独立检查/双确认恢复入口，不能通过普通协调跳过。 |

`deleteAll` 返回 `deleted / retry / stale / local-changed / recovery-required`（已标记 superseded 时要求显式恢复）。`recoverDeletion` 返回 `recovered / retry`，另带操作 scope 供 Page 校验回调 epoch；recovered 只表示核实当前云任务完成并协调本机，不表示新一轮云删除成功。本机清理中断可能已部分清理，UI 明示未完成并保留同一操作 ID；非原子全盘清空不冒充成功。云确认期间本机有写入则返回 local-changed，要求重新查看范围确认；身份/epoch 改变则 stale，不清新 owner。清理前再次失效 epoch，防止授权期间打开的旧页面之后写回。所有危险确认检查 owner、epoch 和本机变更版本；匿名认领也计入变更。

私人键（均有 owner 信封/匿名兼容）：`plans, trainingDraft, pendingQueue, completedTraining, seedVersion, planMigrationVersion, planMigrationCloudSynced, planSync, syncGeneration, syncBarrier, deletionOperation`，前缀 `fitness:`；清全部本机同时移除信封及裸键。`fitness:settings` 不动；`fitness:cloudConsent` 设 false。

## 服务端协议与串行边界

真实入口为 `cloudfunctions/personalData/index.js.main`，owner 仅来自 `getWXContext().OPENID`，不接受调用方 owner。

- `state` → `{generation, deleting, deletion?: {id,status}}`。
- `deleteAll` 入参 `{operationId, generation}`，稳定 ID 在客户端发送前落盘；返回 `{generation,deleted}`，未做完可含 `deleting:true`，过期 worker 可含 `stale:true`。每次最多物理删除100条，重试从剩余第一页继续；没有后台自动完成保证。
- 开始删除在事务里推进 generation 并记录 deleting；同一 ID 重试不再推进代际。删除未完成期间拒绝全部常规写及部分列表读取。list 在查询前后检查代际和 deleting。
- 普通 `set/remove`、删除开始、**每条**物理删除、最终 completed 都通过 `write-boundary.withOwnerGate` 争用同一 owner 元数据。事务内仅 doc 操作；外部 where 只用于找到候选文档。逐条删除必须在锁内重新检查 active job 及 owner，迟到 worker 不能删 completed 后的新数据。
- `withOwnerWrite` 在同一锁里检查请求代际和非 deleting；旧无版本 add/update 拒绝，旧代际写入拒绝。实际客户端旧直写必须依赖三个集合 `plans / sessions / personalDataMeta` 的 `client-permissions.json` **deny-all read/write**；文件并非规则已部署证明。禁止管理入口绕过这个锁。
- 最小记录只保留当前/最近一次 job；更早 ID 的旧请求凭旧 expected generation 拒绝，不重开删除。不会无限保存全部删除请求历史。

## 旧设备与重新使用

`personal-cloud.generation()` 在读取/上传前、云返回后核对 state；queue 在准备任务前也核对。**先检查当前 owner 的本机 deletionOperation**（state 请求前及响应后均检查）；有任务时阻止普通云读写/队列冲刷，保留本机计划、草稿、队列及任务直到显式重试/恢复，不能先被自动屏障清掉。没有自有待确认删除任务的旧设备，发现代际改变/删除中仍失效 epoch、清当前 owner 过期数据并保存 syncBarrier，阻止普通读写，直到用户明确协调。旧任务从创建起固定代际，**绝不重新赋值改绑**。删除中不能把半份列表当完整结果展示。

匿名数据默认未知旧代际0；Page 确认认领后先读取云代际，再调用认领 API，不会先迁移后才发现屏障而销毁匿名区。与当前 owner 不同代际的匿名数据拒绝认领，保留匿名区；不推断匿名旧数据是删除后的新数据。删除成功或明确协调后，该 owner 主动新建的数据可按新代际正常同步；删除成功仍保持停云，重新启用需主动同意。

其他离线设备无法即时远程物理擦除；只能在下次联网读取/上传前识别屏障。源码不支持多设备并发编辑，不把本测试当远程擦除证明。

## 最小技术元数据与保留策略（供04/06引用）

| 位置 | 字段 / 用途 / 保留 |
|---|---|
| 云 `personalDataMeta` | 文档 ID 是 SHA-256(owner)，正文 `_openid, generation, serial, deletion?:{id,status}`，SDK 自带 `_id`。无计划/成绩/草稿。generation 拒旧写；serial 串行争用；最近 job ID/status 支持响应丢失重试及迟到 worker 校验。服务存续期间持续保留，当前/最近 job 被下一 job 覆盖，不承诺固定天数或所有技术痕迹擦除。 |
| 云普通计划删除墓碑 | `_openid,id,revision,generation,operationId,deleted,createdAt` 及 `_id`；用于普通删除防复活，不含计划内容。保留至该 owner 全量删除物理清理；全量删除也移除业务集合中的历史、计划和墓碑。 |
| 本机 `deletionOperation` | `{id,generation,state,resultGeneration?,supersededBy?:{id,generation}}`，owner 桶隔离；请求前 pending、云确认后 cloud-confirmed；明确检查发现不同新 job 后 superseded，保留原 ID/代际及旧结果但不复用旧结果。直到原任务确认且本机清理完成，或新 job 完成经过重新核实与双确认协调后才移除；明确清全部本机也可移除，不代表云已完成。 |
| 本机 `syncGeneration / syncBarrier` | 当前代际；屏障 `{generation,deleting}`。代际保留至下次更新或清理；屏障保留至明确协调、成功删除清理或清本机。用于阻止旧任务重绑与部分读取。 |

公开披露由 `config/public-info.js` 和说明页显示。不填写运营者、联系方式或人工核实标记；这些缺项继续阻断发布。服务关闭后的清理流程未由此源码实现，不能以虚构固定日期承诺删除，也不声称清除了基础设施日志/备份等所有技术痕迹。

## TDD 与验证

已确认 seam：数据公共接口、Page 生命周期/用户事件、云函数 main；只 mock wx / 云 SDK与存储 / 时间。原实现检查点 `5c22ea9` 基于集成 `3219101`，以 `cherry-pick --no-commit` 恢复，未将未完成提交合入集成。接续已快进合入 `e8b97ff`。

`JEST=/Users/ztc/fitness-miniprogram/node_modules/.bin/jest` 是已有依赖的可执行文件，未安装依赖；所有源码编辑均在隔离 worktree。

接续 Red → Green（各次 `$JEST tests/data-deletion.test.js --runInBand --coverage=false --silent`）：

- 旧启用弹窗覆盖撤回：1失败/17通过 → 18通过（`/tmp/ticket03-{red,green}-consent.log`）。
- 同 owner 重启后的旧认领确认：1失败/18通过 → 19通过（`*-claim.log`）。
- 未知云删除代际认领会先搬走匿名数据：1失败/19通过 → 专项及 consent-owner 两套29通过（`*-unknown-claim.log`）。
- 协调云响应清掉期间新草稿：1失败/20通过 → 21通过（`*-reconcile.log`）。
- 授权期间打开的页面在删除成功后可写回旧计划：1失败/21通过 → 22通过（`*-page-after-delete.log`）。
- 认领没有失效旧损失确认：1失败/22通过 → 23通过（`*-claim-revision.log`）。

原有17项专项覆盖云写/删事务交错、迟到 worker、A/B 隔离、响应丢失/重启、分页中断/部分读取拒绝、存储失败、旧代际/旧版协议、离线清本机、网络/定时器撤回、迟到读/统计、双确认和删除后新建。公开说明测试保留发布阻断断言，新增真实元数据披露断言；修复检查点说明文本引号和“尚未确认”被误判占位的文字，不删除缺项检查。

最终全量、聚焦、语法、源码包体及差异检查的实际结果见03 tracker和 implementation；均不是云端/设备验收。

接续最后一项边界回归：删除的初始 state 响应前新建草稿，原实现因过晚采集本机版本而误清理（1失败/23通过）；版本采集移至删除公共操作开始后24项通过，日志 `/tmp/ticket03-{red,green}-initial-state.log`。最终聚焦3套30项，全量41套564通过/29既有跳过（共593项）；源码包体1,212,695 bytes/87文件，变更JS语法和差异检查通过，公开资料检查仍预期阻断四项真实资料。以上均非云端/真机验收。

## P1 审查修复（本机源码证据）

从集成 `4d645c9` 开始，交付前合入最新 `feat/public-release` 的 `ec2df6c`（05 的独立部署/验收文档，未修改默认 AppID/env/media）。

- P1a：增加「检查被其他设备替代的删除任务 / 协调本机」按钮。A 请求落盘但未执行、或 A 丢失完成响应后，B 同 owner 另一设备完成不同 job，A 可显式检查、双确认并仅协调当前 owner，不再永久卡在旧 ID/代际。双设备通过独立 wx 存储及客户端重启共享真实 personalData.main 的 mock 云执行，未 mock 业务模块。两项 UI 回归 Red：缺少恢复事件（2失败/25通过）；Green：27通过，日志 `/tmp/ticket03-p1a-{red,green}.log`。
- P1b：101条计划删除单次未完成，重新启用 + 网络回调/定时器/手动 flush 不再提前清本机。Red：旧实现自动屏障清理并失效队列 epoch；Green：保留101计划、草稿、队列和原任务，显式重试后才清理。日志 `/tmp/ticket03-p1b-{red,green}.log`（后续精确 testNamePattern 复跑的非匹配项为过滤，不是新增 skip）。原旧设备无自有 pending 的自动清屏障测试仍通过。
- 补充恢复安全回归：首次/二次取消、确认后新草稿、网络失败、epoch 变化、云新 job 变化、当前云任务未完成、部分本机清理失败后的持久 ID 与 UI 如实报告。原同 job 幂等重试、其他 owner/匿名保留及存储失败回归保留。
- 最终聚焦3套43通过；全量41套577通过/29既有跳过（606项），相对564通过基线新增13通过，无新增 skip。命令为 `$JEST tests/data-deletion.test.js tests/public-help-page.test.js tests/public-info-check.test.js --runInBand --coverage=false --silent` 与 `$JEST --coverage --runInBand --silent`，日志 `/tmp/ticket03-p1-{focused,full}.log`。
- 源码包体1,217,757 bytes/87文件；变更JS语法及差异检查通过。公开信息检查仍预期退出1：运营者、两个公开联系方式、人工 verified 四项阻断。无真实云/设备、安装、生产构建、部署或push；不改变最小技术元数据保留策略，不增加全 owner 清理路径。第05票最终验收汇总由父代理追加。
