# 02：计划与训练记录可靠同步（源码交付）

## 范围与证据

仅实现 ticket02；没有部署、真机、独立云环境或双微信身份验证。以上真实验证全部 **Blocked**，不代表发布完成。01 的同意门控、所有者区、训练成绩/容量/主题契约继续保留。没有逐组网络请求，没有冲突副本、备份或03的清除/撤回/全量删除 UI。

## 本地提交点与公开接口

- `utils/db.js`：`savePlan/deletePlan` 在返回前同步持久化计划操作；返回表示**本地成立**，不表示上云。逻辑 ID 永久稳定，不再 `.add` 后重映射。缓存是可修复投影；`getLocalPlans/fetchPlans` 优先叠加任务及本地删除墓碑。正常目录迁移仍执行，完整云迁移与本地迁移分开标记，故意留空的新计划/训练日不会被反复删除。
- `utils/plan-operations.js`：所有者区 `fitness:planSync` 保存按顺序执行的 set/remove 快照、稳定 operation key、expectedRevision、generation、尝试次数/时间/错误、已确认操作和删除 ID。计划新修改不会覆盖未确认操作；服务端确认后才移除对应操作。版本拒绝不删本地任务，不自动抬高版本覆盖云端。
- `utils/training-log.js` / `queue.complete`：完成成绩和一次游标推进先在单个完成日志键提交。补写计划任务/清草稿失败可重启修复；重复 complete 返回原成绩。`planQueued` 防止旧完成快照盖过之后的计划编辑。旧版已有 cloudPlanId 继续解析，新增计划不产生别名。
- `utils/queue.js`：`flush` 对两个类型单飞，网络检查前、请求前后及确认落盘前检查同意/身份 epoch。旧 epoch 的 flight 不阻挡新 epoch，也不能清除新 flight。网络恢复、启动监听及定时器触发重试，监听最多注册一次。训练结果先上传，计划任务再串行处理；失败停在队首。
- `getStatus()` 返回 `{plans,sessions}`，每类含 `{state,pending,details:[{id,attempts,error,lastAttemptAt}]}`。状态为仅本地、同步中、待同步/失败、已同步。session 队列兼容旧数据；只有 session 真正未确认才计入训练待同步，计划错误归计划详情。
- `getReadStatus()` 分别报告计划和历史的未读取/完整/读取未完整/仅本地。计划以20条完整分页后才写穿，任何分页失败保留原缓存和所有未确认编辑；历史分页继续合并已读部分及本地成绩，不宣称完整。历史/统计仍为只读派生，不因主题或回看改写成绩。
- `pages/me/me` 显示两类状态、次数/错误及读取完整性，手动重试检查两类剩余任务，不把训练空队列或本地保存提示为全量云同步成功。保留集成01的显式云服务重试按钮。

## 云函数 RPC（取代01的无版本写协议）

所有私人数据都只经 `personalData.main`；可信 owner 只来自 `getWXContext().OPENID`。

| action | 参数/返回 |
|---|---|
| `state` | 返回 `{generation}`，仅当前可信 owner；无元数据时初始0 |
| `list` | `collection,skip,limit`；可信 owner 过滤、业务时间+`_id`稳定排序；计划包含最小墓碑，客户端过滤但分页仍计数 |
| `set/remove` | `collection,id,data,operationId,expectedRevision,generation`；返回 `{_id,revision,acknowledged:true}` |

不再允许无版本 add/update；adapter 保留链式读取语法，所有运行时写路径使用版本化 set/remove。旧客户端不能绕过新屏障。

- 版本从0开始，每次成功写入增加1。重复同一 operationId 返回确认，不重复写业务文档；已确认更晚操作后的旧重试被版本拒绝。
- 删除保留 `_openid/id/revision/generation/operationId/deleted/createdAt` 最小墓碑，不保留计划内容；后续旧 set 被拒绝。不可变 session 以稳定 `session_<id>` 幂等键重试，不重新推进游标。
- `write-boundary.js.withOwnerWrite(db,owner,generation,callback)` 是共用服务端写边界。通过 `startTransaction` 读 owner 元数据、校验 generation，回调仅执行 txn.doc 单文档操作，再写 metadata serial 并 commit。失败 rollback；读失败直接传播，不把网络/权限异常当不存在。不使用 where/batch 或外部请求做事务内操作。
- **新增集合 `personalDataMeta` 也必须和 `plans/sessions` 一样应用 `client-permissions.json` 的 `{"read":false,"write":false}`**。客户端不得直接访问元数据或写个人集合。规则文件是配置意图，不是控制台已配置证据。

## 交给03的硬契约

1. 所有写入必须通过 `withOwnerWrite`，包括全量删除推进 generation。元数据文档 ID 为 `sha256(owner)`；序列写使同一 owner 的所有业务写与未来删除争用同一事务锁。03 可在回调修改 `meta.generation`，由边界原子持久化；禁止新增不经过此锁的管理写入旁路。
2. 每个计划任务创建时固定 generation（未获知时为0）；完成日志/旧队列也保留任务代际。已保存的旧 generation 不自动改绑。首次 state 非0时不会把未知旧任务认领到新代际，而是保留待处理。
3. 03 清本机必须清除所有者区 plans、trainingDraft、pendingQueue、completedTraining、planSync、syncGeneration、seedVersion 和两项迁移状态，并先失效 epoch。全量删除先服务端确认，再清本地；新建数据只有在显式采用新代际后才能上传。不要把旧 tasks 改 generation 后重传。
4. 停用/清除不能取消已经到达服务端的写入；03 依赖事务屏障处理在途竞态。离线其他设备不能物理远程擦除。实际事务冲突、deny-all规则与双用户验证仍 Blocked。

## 官方 SDK 核对

已读取微信 [Database.startTransaction](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/database/Database.startTransaction.html) 的手动事务示例：`cloud.database({throwOnNotFound:false})`、await startTransaction/get/set/commit/rollback。使用文档规定的不抛 not-found 选项，不 catch 任意 get 错误冒充空文档。

亦核对 [CloudBase事务](https://docs.cloudbase.net/database/transaction) 和本机研究记录 `/tmp/public-release-cloudbase-research.md`：wx-server-sdk最低1.7.0，此函数已固定 wx-server-sdk 2.6.3（其余函数不在本票升级范围）；事务只允许 doc，跨集合多条 doc 可用；版本专属 npm 源码复核纠正了新版文档的返回包装描述：**2.6.3 的 runTransaction 直接返回 callbackRes，不是新版文档中的 `{result,errMsg}`**。本实现使用手动 startTransaction，直接返回业务确认，不使用 runTransaction。cloud.init 显式传 `throwOnNotFound:false`；该版本源码透传链支持此选项，普通/事务 doc.get 缺失返回 null。默认缺失错误 errCode=-1 是泛码，绝不能据此吞掉其他读取失败。真实部署SDK/冲突行为仍需隔离环境核实。

## TDD/回归证据（本机，不是云端验收）

确认 seam：domain/data 公共接口、Page 生命周期/用户操作、云函数 main；只模拟 wx/存储/云/时间。`tests/helpers/cloud-runtime.js` 仅增加外部 state RPC 适配，不 mock 项目模块。

| 纵向切片 | Red | Green |
|---|---|---|
| 计划失败→重启→手动确认 | `durable-sync.test.js`：getStatus 不存在，`/tmp/ticket02-red1.log` | 1项通过，`/tmp/ticket02-green1.log` |
| 服务端版本/墓碑/代际 | `personal-cloud.test.js`：state 被拒绝，`/tmp/ticket02-red2.log` | 两套5项通过，`/tmp/ticket02-green2.log` |
| 我的双类型/失败不报成功 | `durable-sync.test.js`：syncStatus 不存在，`/tmp/ticket02-red4.log` | 页面用例通过，`/tmp/ticket02-green4.log`（同次暴露旧ack夹具适配问题，已修复并重新全量验证） |

追加真实数据层→云函数 main 贯通用例覆盖响应丢失、重启、重复flush、完整45计划分页/中断、旧云读、删除重启/防复活、一次成绩/一次游标。保留全部原断言；原“正式ID回填”断言更新为稳定逻辑ID；旧 in-flight add 测试改为 in-flight set，仍断言删除不复活和历史保留。旧25+4个历史 skip 未新增或变更。

最终命令及结果见02 tracker和 implementation；原始日志在 `/tmp/ticket02-*.log`。未运行生产构建、未安装依赖、未 push/部署。
