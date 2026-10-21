# targetedbugfix — 本机归属误判与同步反馈

## 边界

- 串行，共享 checkout `feat/public-release`，基点 `2aeb8a4`。保留进入任务时已有的“我的/数据管理”未提交 UI 改动；不提交、不安装、不构建、不执行真实云请求或清理数据。
- 用户报告先遇到 `FUNCTION_NOT_FOUND`，手动部署 personalData 后又遇到归属冲突、泛化重试提示和读取不完整警告。**没有真实云日志或云环境访问；不能据此确认部署后的服务端失败原因，更不能宣称真实云同步已修复。**

## 复现与排序假设

测试 seam：真实 Page 的 `onClaimLocalData` / 确认回调、`onFlushQueue`，仅模拟 wx 平台存储、网络及 callFunction。

最初命令：`npx jest tests/sync-feedback-fix.test.js --runInBand --coverage=false`。
纠正存储夹具为权威 owner 信封内同时包含本人和匿名桶后，两个确定性测试均红：归属后匿名计划数仍为 1（期望 0）；state RPC 注入 501000/FUNCTION_NOT_FOUND 后仍显示“本机记录已保存，等待云端确认”（期望服务未配置原因）。单次约 0.2 秒。

按代码证据排序：
1. **已确认**：claimAnonymous 对所有非 Version 键只检查“双方存在”，空数组、空 planSync、同代际 syncGeneration 都成为假业务冲突。空本人数据 + 匿名计划/历史在公开页面复现。
2. **已确认**：queue 在任务前 generation 失败时吞掉异常返回原队列，没有可供 UI 展示的原因；Page 只按待同步数量显示泛化提示。state 和任务 RPC 注入已知 SDK 错误均可复现。
3. **需保留的可能性**：本人确有另一份非空计划（包括自动种入的演示计划）、历史或任务冲突。不能通过强制覆盖/清理解决。回归验证拒绝且双方原样保留；此轮不做备份或合并。
4. **真实云端未知**：当前是否为服务部署、集合、权限、版本或其他问题，现有用户提示不能区分。没有真实环境循环；仅对本仓库实际错误文本和明确提供的 SDK 模式作提示映射，不猜集合/索引错误。

## 改动

- `utils/owner-storage.js`：归属先预检；只允许空值/相同值共存，不合并不同业务字段或非空任务/墓碑。空本人数组不再丢掉匿名记录。本人 syncGeneration、syncBarrier、deletionOperation 不参与迁移，不被匿名技术状态覆盖；保留代际校验、屏障阻断、部分存储失败后的权威信封重跑策略，不改绑旧任务。匿名技术状态留在匿名区。
- `utils/sync-feedback.js`：小型白名单格式化器。同时检查 SDK 的 message 与 errMsg；仅 FUNCTION_NOT_FOUND 或明确的 FunctionName 缺失文本显示“云同步服务尚未配置，请联系维护者”。不凭外层正/负501000数字码单独断言函数未部署。本仓库确定的删除/版本错误有对应非技术提示；未知错误只显示“同步未完成，可查看详情”，不输出原始 SDK 文本、内部标识或记录内容。
- `utils/queue.js`：保留一个 owner+epoch 范围内的最近失败原因（内存，无新增持久日志），覆盖任务前、训练任务、计划任务失败；旧在途失败不能更新新范围。重试开始不先清掉原因，成功在线完成确认才清除。单飞显示同样按当前范围隔离；持久待提交数据不丢弃。
- `utils/claim-local-data.js`：共享归属流程使用安全格式化提示及 dataResult，给出保留记录/查看指引的非破坏性建议；身份改变不展示旧请求错误。
- `pages/me/me.js`、`pages/me/me.wxml`：保留小卡片结构，以简短原因更新同步副标题和重试 Toast；无失败原因的非零待提交显示等待确认，不猜网络原因。独立保留读取不完整警告。删除/屏障状态指向数据管理，不提供无效的普通同步重试；未知错误有简短详情弹窗及联系维护者指引，不显示 SDK 技术墙。
- `pages/data-management/data-management.js`：删除/屏障存在时不显示普通本机归属入口，仍保留原来的显式数据管理流程。
- `tests/sync-feedback-fix.test.js`：新增 11 个公开 seam 回归，覆盖空桶、非空业务/任务冲突、前置与任务 SDK 失败、安全锁/非零代际、旧请求隔离、确认后清原因及安全详情。
- `tests/ui-simplification.test.js`、`tests/durable-sync.test.js`：仅更新相关提示及按钮条件的旧预期。

## 实际验证

- 聚焦：`npx jest tests/sync-feedback-fix.test.js tests/durable-sync.test.js tests/consent-owner.test.js tests/data-deletion.test.js tests/ui-simplification.test.js --runInBand --coverage=false` → **5 suites / 93 tests 通过**，约 0.8 秒。原有部分写入失败/重跑、裸备份不复活、删除代际测试继续通过。
- 全量：`npm test -- --runInBand` → **43 suites 通过；623 passed / 29 skipped / 652 total**。基线为 612 passed / 29 skipped；新增 11 个，无新增 skip。
- `npm run check:package` → **PASS**，候选源码 1,235,358 bytes / 1206.4 KiB，93 文件；这不是微信最终包分析，也不是生产构建。
- `git diff --check` → 通过。
- `node --check`（owner-storage、queue、sync-feedback、claim-local-data、me、data-management、新增测试）→ 全部通过。

## 剩余风险

- 未进行真实云部署、真实云请求或真机复验；用户目前究竟是哪一项非空冲突/删除流程/云端故障，仍需在保留记录的前提下查看新提示与服务端日志。
- 真实两份业务数据合并仍不支持，会明确拒绝且保留双方；不会建议清缓存或清本机解决同步。
- 前置失败原因仅内存且 owner/epoch 隔离，重启后需重新尝试才能得到该次原因；已有任务持久错误仍按原策略保留。本轮没有无限错误日志或新增数据采集。

## 主协调者复核修正与最终运行

- 只读审查未发现直接覆盖非空业务、任务/墓碑、foreign桶或旧身份失败污染，发现两项P2：有失败原因但空队列的成功子状态未隐藏；只读取一个SDK消息字段、数字码处理不准确。
- 补充公开Page回归后，先红3失败/12通过；修正成功子状态要求无失败原因，同时读取message及errMsg中的明确缺失标记。对没有具体缺失标记的正/负501000保持未知失败提示，不擅自判断部署原因。最终专项17项通过，其中新增6项。
- 主协调者最终全量：**43套629项通过、29项既有跳过，共658项**，`/tmp/sync-feedback-final-tests.log`；源码包体**1,235,417 bytes / 1206.5 KiB，93文件**，`/tmp/sync-feedback-final-package.log`；差异检查通过。
- 没有更改云端函数、实际部署、生产构建、提交或清理用户数据。仍需用户在新前端重新编译后确认真实提示；本机测试不是实际云端同步成功证据。

### 官方错误形态补核

调研确认不能只按外层 -501000 判断函数缺失；微信错误表未给它专属缺函数含义，官方社区同码覆盖不同故障。判据来自嵌套的明确错误名/消息。CloudBase当前定义为 `FUNCTIONS_NOT_FOUND`，兼容截图的 `FUNCTION_NOT_FOUND` 及旧版 `Function not found: [...]`，只输出固定安全提示。

- 来源：[微信错误码](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/reference/errcode.html)、[CloudBase FUNCTIONS_NOT_FOUND](https://docs.cloudbase.net/error-code/FUNCTIONS_NOT_FOUND)。未访问实际云环境。
- 新增两种官方/旧版形态回归：红2失败/17通过，绿19通过；全量 **43套631通过、29既有跳过**（660项），日志 `/tmp/sync-feedback-verified-tests.log`。源码 **1,235,440 bytes / 93文件**，日志 `/tmp/sync-feedback-verified-package.log`；差异检查通过。后续计数以此节为准。
