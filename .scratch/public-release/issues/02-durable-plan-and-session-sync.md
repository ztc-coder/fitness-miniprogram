---
labels: [ready-for-human]
status: done
---

# 02: 计划与训练记录可靠同步

> **历史留档（2026-10-21 关闭）**：源码与自动边界测试已并入主线。真机「离线完成→联网」（M06）已由 [`.scratch/release-phase1/`](../../release-phase1/map.md) 票 07 验收通过；计划编辑/删除失败重试（M07）、超单页分页（M08）、响应丢失重复提交（M09）仍未做真实环境验证，保留 `Blocked`，属阶段二。下方「real-validation-blocked」为当时状态。

**What to build:** 用户离线修改计划或完成训练后，数据立即本地成立；联网或重启后能可靠重试，并明确看到仅本地、同步中、待同步/失败和已同步状态。网络中断、响应丢失、云端旧数据均不会造成静默丢失、重复训练记录或重复推进游标。

**Blocked by:** 01 — 本地可用、同意后启用本人云服务。

**Status:** code-complete / real-validation-blocked

首版只承诺单设备编辑，不增加冲突副本、文件备份恢复或完整多设备并发合并。该限制不允许过期请求无条件覆盖新状态。

- [x] 计划新建、修改、删除和训练完成均先持久保存到本地；未同意云服务时保持仅本地，不伪装成云端待上传成功。
- [x] 启用云服务后，两类数据均有持久同步任务；断网、失败、进程退出及重启不会丢失任务。网络恢复与手动重试可继续执行，不制造并行重复提交。
- [x] 同一训练记录重复提交、服务端成功但响应丢失后重试，不产生重复历史；训练实际成绩先落盘，游标只推进一次。
- [x] 云端旧状态、读取失败或分页中断不清空或覆盖本地待同步修改；计划和训练历史超过单页上限仍能完整读取，不以默认返回条数冒充全部数据。
- [x] 已删除计划不会因读取旧数据、延迟请求或旧任务重试而复活；过期写入被拒绝时保留用户本地修改并给出可理解的待处理状态，不静默丢弃或覆盖。
- [x] “我的”可查看两类数据的同步状态、失败及待处理任务，并手动重试。只有对应任务获云端确认才标已同步，不把仅本地保存当云端成功。
- [x] 开始提交与处理异步响应时均遵守当前同意及所有者边界，不将旧请求结果写入另一身份的数据；为第03票的停用、清除和删除提供可验证的任务失效边界。
- [x] 自动测试覆盖两类任务的失败后重启、响应丢失、重复重试、完整分页/中断、旧云数据、过期写入和计划删除防复活，并验证状态显示与手动重试。
- [x] 训练过程不引入逐组云写入；不可变快照、容量口径、本地完成、主题及现有训练回归保持通过。

## 源码交付与限制（02，不关闭父发布任务）

- 依据用户后续明确授权实施；初始 worktree HEAD `4d3b299` 为 integration 基线，开始前已快进 `8b98f5b`，完成前再次合入 `e80db8d`（包含01身份失败通知/显式重试修复）。
- 分支 `feat/public-release-02`；详细接口、03共享写边界、SDK依据和 TDD red/green 见 `docs/durable-sync.md`。
- 上面勾选仅表示对应**源码与自动边界测试**交付，不代表真实微信/云端验收。真实事务冲突、规则/两身份隔离、真机、响应丢失网络场景均 **Blocked**（未提供独立环境/真机）；没有部署、push 或生产构建。
- 聚焦：共享 Jest 执行 `tests/durable-sync.test.js tests/personal-cloud.test.js tests/training-submission.test.js --runInBand --coverage=false --silent`，3套30项通过，`/tmp/ticket02-focused-final.log`。
- 全量：`PATH=/Users/ztc/fitness-miniprogram/node_modules/.bin:$PATH npm test -- --runInBand --silent`，40套通过、528项通过、29项既有跳过（未新增skip），`/tmp/ticket02-full.log`。
- `npm run check:package`：1,195,154 bytes、86文件，低于2MiB；源码预算不是微信最终编译包体，`/tmp/ticket02-package.log`。
- 变更 JS `node --check`、`git diff --check` 通过。依赖未安装；personalData 固定 wx-server-sdk 2.6.3，基于官方文档和精确npm源码研究，尚无云端运行证据。
- 03必须通过 `cloudfunctions/personalData/write-boundary.js` 同一元数据事务推进 generation；增加 `personalDataMeta` 也必须 deny-all 客户端。不得将旧队列改绑新代际。全量删除/清本机/撤回UI不属于02。

## P1 复审修复证据

- 专用隔离 worktree 分支 `fix/ticket02-p1-durable-sync`，起点 `57462fd57b8c15abab6cf87d17497f5cb1a1f6e5`；`git merge-base --is-ancestor` 确认基线，完成前 `git merge feat/public-release` 快进到当前集成 `3b9f1504f1362ff6847e1a9146e1cb7ed9c96725`（仅增加集成证据文档）。
- 修复延迟旧云计划列表覆盖已确认新 revision/content；普通读取及目录迁移入口均回归。保持未知云端冲突拒绝，不自动重绑 expectedRevision。
- 修复升级后无 revision/operationId 旧场次成功但未本地确认的队首阻塞：可信所有者、未删除、代际与版本正确、完整快照一致才只读确认；原全局 ID/01 owned 命名空间均覆盖。后续计划/场次继续同步且游标不变；内容差异、未知字段、外人、墓碑与过期代际均拒绝且原文档不变。实现/Red→Green细节见 `docs/durable-sync.md` 新增 P1 节。
- 聚焦：`PATH=/Users/ztc/fitness-miniprogram/node_modules/.bin:$PATH jest tests/durable-sync.test.js tests/personal-cloud.test.js tests/training-submission.test.js --runInBand --coverage=false --silent`，3套42项通过，`/tmp/ticket02-p1-focused.log`。
- 全量：`PATH=/Users/ztc/fitness-miniprogram/node_modules/.bin:$PATH npm test -- --runInBand --silent`，40套540项通过，29项既有跳过不变（原528项全部保留，新增12项），`/tmp/ticket02-p1-full.log`。
- `npm run check:package`：1,195,554 bytes、86文件，低于2MiB，`/tmp/ticket02-p1-package.log`；非最终微信编译包体。三个变更 JS 的 `node --check` 和 `git diff --check` 通过。
- 仅公开数据 API / 云函数 main 与现有 Page 回归；只 mock wx/云/时间/存储边界。真实环境、双身份、设备及云事务仍 Blocked；未提供环境/设备，未部署、push或生产构建，未实现03。
