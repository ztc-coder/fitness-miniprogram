# 逐组训练实施契约（01，供 02/03 共用）

实现：`utils/domain.js`；公开纯函数测试：`tests/domain.test.js`。本票不做页面、持久化、队列或游标推进。历史 records **不调用升级函数**。

## 数据

- 新场次和每个新动作均有 `flowVersion: 1`。组为 `{ id: 'set_N', status: 'pending' | 'completed' | 'skipped', weight, reps }`。
- `id` 在同一场次唯一；`nextSetId` 单调递增，删除不复用。控制引用为组 ID，不是列表下标。目标预填、加组、加练共用 pending 初始化，绝不等同 completed。
- `training = { phase, currentSetId, restSeconds, restEndsAt, restRemainingSec, restNotified, restSkipped, undoSetId, resumePhase }`。
- `phase`: `ready` 待开始、`active` 当前组训练中、`rest` 间歇、`finished` 无待练组等待整场确认、`paused` 暂停。`finished` 本身不等于允许提交（空场/全跳过不允许）。
- `currentSetId` 为当前 active 组或顺序第一个 pending，无 pending 为 null；恢复较早跳过组不会抢占已有 active。增删/跳过后由 domain 核对引用。
- 默认 `restSeconds = 90`，本场统一；`restEndsAt` 为毫秒时间戳。暂停清空截止并冻结 `restRemainingSec`（ceil 整秒），`resumePhase` 保存原阶段。非主动切后台不暂停，返回只校准时间。
- `restNotified` 表示该间歇到时提醒已在业务状态认领；`restSkipped` 表示主动跳过。新间歇重置两者。到时将 phase 改为 ready，`restNotified` 置 true，不自动开始组；重复校准 no-op。跳过置 `restSkipped: true, restNotified: false`，后续校准不会补响。
- 页面必须先持久化返回状态，再对本次 `restNotified: false → true` 发出一次提示/声音/振动；失败不得重新清除此标记。暂停调整至零亦认领到时；页面自行决定暂停 UI 的提示展示，但不得重复发声。单纯后台/销毁仅停止页面资源，不能改业务截止。
- `undoSetId` 最近可撤销 completed 组；在下一组开始时清空。在间歇、待开始、待整场确认时可撤销；暂停时须先继续。撤销保留输入，取消间歇并回该组 active。
- 新流程以逐组 status 为准，动作 `skipped` 仅保留既有操作标记，**不得用它过滤整个动作/成绩**。跳过只改非 completed 组；恢复不改 completed。

## 公开 API 与拒绝策略

除校验/查询和 finalize 特别注明外，函数返回新 session；拒绝/无效操作返回输入 session 或等值对象、不抛错、不修改输入。调用方将返回值作为下一草稿。所有 `now` 均为调用方显式提供的有限毫秒数；不存在 wx/timer 依赖。

| 函数签名 | 返回/行为 |
|---|---|
| `buildSessionSets(planExercise, firstId = 1)` | 目标预填 pending 数组，至少一组；外部使用时由调用方保证 firstId 唯一 |
| `snapshotSession(plan)` | 独立新流程草稿；无训练日 null。保留既有创建时 ID/startedAt 生成方式，不推进计划 |
| `upgradeTrainingDraft(session)` | 仅显式升级未提交旧草稿，保留重量/次数与旧整项 skipped，所有其他组 pending，从首个 pending 待开始；空组动作补一组；新流程/已提交场次原样返回，幂等 |
| `startTrainingSet(session, setId, now)` | 仅 ready 的当前组可开始；只保留一个 active，并关闭撤销窗口 |
| `validateTrainingSet(exercise, set)` | 合法返回归一化数值 `{weight, reps}`，否则 null。reps 正整数；普通 weight 非空有限非负；只有原值 body weight 允许空重量归零；允许非空合法数字字符串，拒绝布尔、NaN、Infinity |
| `completeTrainingSet(session, setId, now)` | 仅当前 active 且 pending、成绩合法可打卡；有 pending 则间歇（跨动作也休息），无 pending 则 finished。零秒间歇立即到时；双击 no-op，不重建截止 |
| `getRestRemainingSec(session, now)` | rest 按 `max(0, ceil((restEndsAt-now)/1000))`；paused rest 返回冻结秒；其他阶段/无草稿返回 0 |
| `tickTrainingRest(session, now)` | 仅到时 rest 转待开始/finished 并认领提醒；重复调用 no-op |
| `skipTrainingRest(session)` | 仅 rest 转待开始/finished，不认领到时提醒；暂停态须先继续 |
| `pauseTraining(session, now)` / `resumeTraining(session, now)` | 保存/恢复原阶段；冻结/重建间歇截止；重复操作 no-op；恢复冻结零秒时校准到时 |
| `adjustTrainingRest(session, deltaSec, now)` | 只接受数值 +15/-15；当前剩余与后续 restSeconds 同调，最小 0。暂停调整冻结值；已过期先认领到时，不被 +15 重开；非 rest 只调后续时长 |
| `undoLastTrainingSet(session)` | 窗口内最近 completed 回 active、保留输入、取消间歇；下一组开始后拒绝 |
| `editTrainingSet(session, setId, {weight, reps})` | 原子编辑两值，两字段均须提供；completed 必须整组合法并归一化，不创建/改动间歇；pending/skipped 可未填 |
| `getTrainingProgress(session)` | `{completed, pending, skipped, total, ratio}`，total=completed+pending，ratio 为完成比例（0–1），分母 0 时为 0 |
| `canFinishTraining(session)` | boolean：phase 必须 finished，至少一组 completed，所有组 completed/skipped；paused 不可提交 |
| `finalizeTrainingSession(session, now)` | gate 后深拷贝，固定 submittedAt=now，删除 training/nextSetId，保留 session/动作 flowVersion 与逐组结果。非法 now、gate 不通过、已提交均返回 null；不存储、不入队、不推进。已提交快照不可再次 finalize |

### 既有编辑签名保持不变

- `addSessionExercise(session, exercise)`：追加 pending 空组，保留当前控制状态/截止。
- `removeSessionExercise(session, index)`：含 completed 组拒绝整项移除；完全未练动作可移除（含 active，属显式整项移除），重新核对引用。
- `addSessionSet(session, exIndex)`：追加 pending 空组；全部练完后新增会重新回 ready 并禁用整场完成。
- `removeSessionSet(session, exIndex, setIndex)`：新流程仅可删除非 completed 的末组、且至少留一组；active（含暂停中的 active）不可删除，不能绕过打卡。
- `updateSessionSet(session, exIndex, setIndex, field, value)`：仅 weight/reps，空字符串/undefined 归 null；pending 允许未填；completed 以候选整组校验后编辑（非法 no-op），不启动第二次间歇。非有限输入保留到校验前，绝不会由 clone 意外转为空重量。
- `setExerciseSkipped(session, exIndex, skipped)`：跳过剩余/恢复；completed 不变。没有待练组时结束当前间歇；有待练组且仍处间歇时保留原截止。
- 空 session、无效动作/组下标（负数、非整数、字符串或越界）、未知编辑字段安全 no-op。旧草稿入口应**先显式 upgrade**；编辑函数不会隐式重置旧草稿所有组状态。

## 统计与 03 的提交边界

`computeVolume(exercise)` **不需要 session 参数**：动作 `flowVersion === 1` 或任一组有 status 时，只计 completed（无状态组也不计）；旧动作既无版本又无状态则保持原重量/次数容量。普通 `Σweight×reps`，body weight `Σreps`。旧单动作 computeVolume 保留原行为（包括不自行过滤旧 skipped）；`computeSessionTotalVolume(session)` 仍排除旧 skipped 整项。新流程部分 skipped 的 completed 容量保留。

`computeExerciseCount(session)`：新动作只计含 completed 的项，旧历史仍计非 skipped 项。`computeSummary(session, previousSessions)` 共用上述筛选；有 submittedAt 时用其固定时长，无 submittedAt 保留旧 Date.now() 调用行为，口径包含暂停/间歇真实经过时间。

建议 03 的本地完成封装先 gate/finalize，然后只持久化 final 快照、入队和推进游标；submittedAt 是**本地成立时间**，网络重试不得重写。控制态已清理，不需页面自行拼快照。页面提交锁、本地写入失败回滚/错误提示、队列推进幂等不属于本票，须在 02/03 集成。记录详情/趋势应保留逐组 status，跳过预填不得当成绩展示；历史 records 零升级写入。
