---
labels: [ready-for-human]
status: done
---

# 03: 撤回同意与个人数据清理

> **历史留档（2026-10-21 关闭）**：源码与双轴审查修复已并入主线。真机「清本机」（M11）与「全部删除失败/重试」（M12）已由 [`.scratch/release-phase1/`](../../release-phase1/map.md) 票 07 验收通过；撤回同意（M10）、删除与写入竞态（M13）、旧设备/旧路径（M14）、元数据披露（M15）仍 `Blocked`，属阶段二。下方「Blocked」为当时状态。

**What to build:** 用户能明确区分撤回云服务同意、清除本机数据和删除全部个人数据。撤回立即停止新增云请求，本地训练继续可用；删除全部个人数据必须联网确认，失败可重试，旧设备及旧队列不能让已删除数据复活。

**Blocked by:** 02 — 计划与训练记录可靠同步。

**Status:** 源码与最终双轴审查完成；真实云端/设备验收 Blocked

本票落实拆票时新确认的规则：撤回同意与云端删除分开；不得声称已撤销在途请求。此规则取代父规格里尚待确认的候选描述，不修改父 issue。

- [x] “我的”提供三个含义明确的独立操作；撤回后立即停止新增身份、同步及远程媒体请求，不能被重试定时器或网络恢复监听自动重新开启。
- [x] 撤回同意不冒充云数据已删除；说明在途请求可能已执行，旧回调不得重新开启云服务或回填已清理的本地状态。重新启用云服务需再次主动同意。
- [x] 撤回后仍能在明确授权的删除操作中联网删除本人云数据；该次授权仅用于删除，不顺带恢复常规同步或上传本地数据。
- [x] 清除本机可离线执行；有进行中草稿或未同步数据时展示损失范围并二次确认。确认文案明确偏好及同意状态的处理范围，不能混淆为全端删除。
- [x] 清本机覆盖本地计划、历史、草稿、队列及相应同步状态；旧任务/在途回调不得重新写回或上传已清数据。明确云端仍保留，重新启用同步可能下载既有云数据。
- [x] 全部删除需联网、校验可信本人身份并二次确认；云端删除确认完成后才清本地，不影响其他用户或公共动作媒体。失败或中断不报成功，保留幂等重试及可理解的状态。
- [x] 删除屏障覆盖所有写入路径，包括客户端直写、云函数、延迟请求和旧设备队列；不能只给新版本 UI 加检查。删除与并发写入交错、旧版直接写入也不能绕过屏障复活数据。
- [x] 其他设备下次联网时识别旧数据失效并处理缓存，不把旧任务重新绑定为新数据上传。告知离线设备缓存无法即时远程物理擦除；删除后主动新建的数据可正常使用。
- [x] 仅保留防复活必需的最小技术元数据，明确用途、范围和保存策略，向第04票提供真实隐私说明，不承诺所有技术痕迹均被擦除。
- [x] 自动测试覆盖撤回后网络恢复/定时重试、在途回调、离线清本机、删除失败/响应丢失/重试、A删除不影响B、旧设备/旧版写入、删除与写入竞态及删除后重新使用。
## 源码证据与交接（不代表真实验收）

- 从集成 `3219101` 恢复未完成检查点 `5c22ea9`（no-commit），接续快进集成 `e8b97ff`；检查点本身不合入集成。现行说明在 `docs/data-deletion.md`、`docs/durable-sync.md`、`docs/consent-owner-isolation.md`（仓库实际是两个根级文件，并无 `docs/durable-sync/consent-owner-isolation.md`）。
- 入口：`pages/me/me` 独立撤回、清全部本机、删除当前本人云端、屏障后重新使用；`utils/data-management` 暴露公共操作。两次确认显示范围并检查身份/epoch/本机变更；删除专用授权不启用常规同步。
- `personalData.main` 的 state/deleteAll 与 `write-boundary.withOwnerGate` 是云端协议；所有写、删除推进、逐条物理清理、完成确认共用 owner 元数据事务锁。deny-all 文件覆盖三个私人集合的配置意图，**尚未部署验证**。
- 其他离线设备下次读取/上传识别屏障；旧任务绝不改绑，新代际经明确协调或删除成功后可重新使用。元数据字段及服务存续期保留策略已在说明配置披露，运营者/联系方式仍空，verified=false。
- 接续新增7个 Red→Green 行为回归；继承17个删除专项，无新增 skip。完整命令/逐轮红绿结果见删除文档。
- 勾选仅表示源码/mock覆盖完成；独立静态审查尚待协调者安排，真实云 SDK/事务冲突、客户端 deny-all、双微信身份、设备/网络及最终编译包体全部留给05，公开资料和人工核实仍由06解除阻断。

### 本次最终验证

- `$JEST tests/data-deletion.test.js tests/public-help-page.test.js tests/public-info-check.test.js --runInBand --coverage=false --silent`：3套30项通过。
- `$JEST --coverage --runInBand --silent`：41套通过，564项通过、29项既有跳过，共593项；基线540通过，增加24项删除专项，未新增 skip。
- `node scripts/check-package-size.js`：1,212,695 bytes / 87文件，低于2 MiB，仅源码估算。
- JS语法及 `git diff --check` 通过；`node scripts/check-public-info.js` 按预期退出1，仅运营者、两个公开联系方式、人工 verified 仍阻断，不再错误称元数据披露缺失。
- 日志：`/tmp/ticket03-focused-final.log`、`/tmp/ticket03-full-final.log`；JEST为已有共享依赖 `/Users/ztc/fitness-miniprogram/node_modules/.bin/jest`，没有安装依赖。

## P1 双设备恢复 / 待确认删除保护修复

- 基于集成 `4d645c9`，交付前快进合入最新 `feat/public-release`：`ec2df6c`。仅修改03代码/测试/说明，不改05文档及默认 AppID/env/media。
- P1a：公开 `inspectDeletion(token)` + `recoverDeletion(inspection)`，Page 新增「检查被其他设备替代的删除任务 / 协调本机」。检查最新不同 job/推进代际，旧任务标记 superseded 但原 ID/代际不变；当前云任务完成后展示本人损失及新旧任务/代际，再经两次确认与执行前联网核实，仅放弃当前 owner 本机残留/旧任务。其他 owner、匿名及当前云端新数据不动；不复用旧 ack、不隐式重绑或新发云删除。
- P1b：personal-cloud 在任何自动屏障清理前检查自有 deletionOperation，并在 state 响应后复查。未完成删除重新启用/网络冲刷保留计划、草稿、队列、任务；无自有待确认任务的旧设备仍自动清过期缓存。
- TDD：双设备公开客户端 + 真实云入口，A 请求未执行/B完成新 job、A丢完成响应/B再删除两例 Red 2失败/25通过 → Green 27通过；101计划单次删除未完成 Red（旧屏障自动清理失效 epoch）→ Green 保留本机/同 ID 显式重试完成。日志 `/tmp/ticket03-p1a-{red,green}.log`、`/tmp/ticket03-p1b-{red,green}.log`。只 mock wx/云SDK/存储/时间，无业务模块 mock。
- 新增13通过，保留原564通过/29既有 skip。最终聚焦3套43通过；完整 `--coverage --runInBand --silent`：41套577通过/29跳过/共606项，无新增 skip。过滤复跑显示的非匹配项不计 skip 变更。日志 `/tmp/ticket03-p1-{focused,full}.log`。
- 源码包体1,217,757 bytes/87文件；变更JS `node --check` 和 `git diff --check` 通过。公开资料检查预期退出1，仅运营者、两个联系方式、人工verified四项阻断。第05票验收最终汇总由父代理追加。
- **仍是源码/mock证据**：真实云SDK/事务冲突、deny-all部署、微信双身份、设备/网络及最终编译包体验收 Blocked。未安装依赖、生产构建、部署或push；未改变元数据保留策略，未增加全owner清理。

## finalcode-review P1/P2 收尾（源码/mock）

- 分支 `fix/public-release-final-findings`，干净基线 `10548fd` 含 `07a23a6`、审查目标 `8c7ccf9`；交付前合入父集成当前 tip `80cd133`。同一 worker/worktree 修复最终全部两项，不动默认AppID/env/media或05既有 checked SHA。
- P1：所有写信封的路径 durable set 后才移除裸键；有效信封兼作修复来源，get/set 失败不删唯一原件，remove失败保留信封并传播错误。当前 owner 删除补清旧安装已认领裸副本，匿名/其他 owner 桶保留；真正匿名裸值先保全到匿名桶，不静默认领。全量删除清理失败保留任务、返回 retry，重启仍复用原删除 ID；清全部本机先移除裸键再移除信封避免归属回退。精确语义见删除/同意文档。
- P1 Red：匿名创建/逐组完成→明确认领→全删返回 deleted 后，平台裸 plans 仍在（1失败/37通过）；Green 主切片38通过。新增 get/set/remove故障、重启认领/全删修复、旧信封副本、真正匿名及 foreign保留、set/remove 转换、清全部本机故障，共45专项通过（新增8项）。原双设备fixture用运行时真实匿名桶代替已有信封外人为写入裸值，保留数据断言未跳过。
- P2 Red：61条云历史无本地完成日志，第61条详情 session=null（1失败/5通过）；详情改为完整分页 API 后8通过，新增3项包含迟到页在身份切换/删除后不能恢复渲染、快照容量/成绩及完整统计保持不变。旧不存在历史主题测试改期待分页大小20，原提示/返回延时/只读断言均保留。
- `$JEST` 使用已有 `/Users/ztc/fitness-miniprogram/node_modules/.bin/jest`；聚焦4套71通过，完整 `--coverage --runInBand --silent`：41套588通过/29既有skip/617项，577基线新增11通过，无新增skip。日志 `/tmp/final-p1-{red,green,edge}.log`、`/tmp/final-p2-{red,green}.log`、`/tmp/final-{focused,full}.log`。旧云平台适配器用裸键名虚拟映射 owner 桶，修复移除别名语义；本轮真实裸副本回归用独立Map存储检查，不用该适配器、不mock业务模块。
- `npm run check:package` 1,218,018 bytes/87文件通过；JS语法、19JSON解析及diff检查通过。`npm run check:public-info` 预期退出1，仅运营者、两公开联系方式及verified仍阻断。无安装、云访问、设备、生产构建、部署或push。真实SDK/云隔离/双身份/真机/最终编译包体与公开资料仍Blocked；最终复审报告由父代理另写。
