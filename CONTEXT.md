# CONTEXT — 训练日志 · 健身训练小程序

本文件是本项目的领域词汇表与架构概览。改代码前先读这里，保持代码、注释、commit message 与本文术语一致。
发现新领域概念时，补充到本文；做出架构决策时，在 `docs/adr/` 追加 ADR。

---

## 1. 项目是什么

个人自用的**力量训练打卡工具**（微信原生小程序）。

- 单用户闭环：无社交、无多角色（无私教/学员）、无支付、无通知。
- 核心模型是**第 N 天循环**（如 推-拉-腿），不绑定星期几。
- 训练场景常在健身房、网络不稳定：**全程本地缓存，只在结束提交那一刻联网**。
- 历史记录必须**忠实于当时实际发生的训练**，不受后续改计划影响。

## 2. 领域词汇表

术语以「中文名（代码标识符）」形式给出，代码里一律用标识符。

### 计划侧

| 术语 | 代码字段 | 含义 |
|---|---|---|
| 计划 | `Plan` | 一份循环训练计划，可存多份，同一时刻只有一个 `active` |
| 循环日 | `cycleDays: [{dayId, name, exercises}]` | 计划内的有序训练日列表，长度即循环长度 |
| 游标 | `cursor` | **计划自身字段**，指向 `cycleDays` 当前下标；切回某计划即从上次离开处继续 |
| 训练日 | `dayId` / `day` | 循环中的一天，是一份**有序动作列表**；计划里只有训练日，**没有休息日概念** |
| 动作目标 | `{sets, targetReps, targetWeight}` | **动作级统一目标**：该动作所有组共享同一目标，逐组差异靠打卡时自由填写兜住 |
| 计划动作项 | `{exerciseId, sets, targetReps, targetWeight}` | 训练日里的一条动作条目 |

### 打卡 / 记录侧

| 术语 | 代码字段 | 含义 |
|---|---|---|
| 开始训练 | — | 把当天计划快照复制成独立训练场次；目标预填不表示实际完成 |
| 逐组打卡 | `set.status` | 实际练完后直接勾选任意组；无需开始本组，可随时修改成绩或取消完成，预填不算完成 |
| 组间间歇 | — | 完成组后手动开启的休息倒计时；可独立暂停、收起、调整或重启；记录操作不打断间歇，到时声音、振动与页面提示 |
| 整场完成 | — | 至少一组已打卡，由训练者结束；仍有待练组时先确认跳过剩余，只保存实际完成成绩并推进计划 |
| 训练场次 | `Session` | 一次实际训练记录，生成后与 plan **解耦** |
| 快照 | `snapshotSession()` | 深拷贝当前游标指向的训练日；不与 plan 共享引用 |
| 组 | `set` | 一次实际力量训练的单位，新流程用场次内稳定 `id` 引用、`status` 区分待练/已打卡/跳过；以重量与次数记录成绩，不做有氧/计时类 |
| 自重动作 | `equipment === 'body weight'` | 复用同一 set 模型，`weight` 表示**额外负重**（徒手为 0 或空） |
| 跳过剩余 | — | 显式放弃一个动作尚未打卡的组；已打卡的实际训练保留，完全没练的动作不计动作数与容量 |
| 待练组 | `pending` | 尚未勾选完成的组，可自由选择、编辑或删除；每个动作至少保留一组 |
| 训练中 | — | 本场训练尚未结束，可记录任意组，不再表示某一组独占进行状态 |
| 暂停训练 | — | 暂时中断本场训练，冻结未结束的间歇并禁用记录；继续整场不会误启动先前已独立暂停的间歇 |
| 取消完成 | — | 取消任意已完成组的勾选，保留数值，不改变间歇；需要删除已完成组时先取消完成 |
| 容量 | volume | 常规动作 `Σ(weight × reps)`；自重动作 `Σreps` |
| 完成小结 | `computeSummary()` | 整页展示完成组数、动作数、时长、负重容量与自重次数；两种单位分开，并与**上次同类型**（同 `planId` + `dayId`）分别对比 |
| 提交队列 | pending queue | 本地已完成但未提交成功的 session 列表，无网时排队重试 |

### 动作库侧

| 术语 | 代码字段 | 含义 |
|---|---|---|
| 动作库 | `data/exercises.js` | **离线只读**数据，随主包分片发布；当前发布目录为上游非 cardio 可用全量（1,295 条） |
| 动作条目 | `{id, name, nameZh, equipment, bodyPart, target, imagePath, gifPath, instructionSteps, aliases}` | 精简字段；`id` 用数据集 4 位数字字符串（如 `"0025"`）；`name` 为英文原名，`nameZh` 为展示名（社区映射打底，手译覆盖）；`equipment` 是判定自重动作的**唯一依据** |
| 动作演示 | `gifPath` | 数据集提供的 180×180 分解 GIF（灰阶解剖人、目标肌群红高亮）。这就是界面上的「标准动作」视觉。_Avoid_: 视频、跟练 |
| 动作要领 | `instructionSteps` | 中文分步说明（数据集 `instruction_steps.zh`） |
| 示意图 | `imagePath` | 与演示同构图的 JPEG 静帧。动作库列表与打卡页行内缩略图；演示 GIF 加载失败时的占位。列表不加载 GIF。 |
| 器械 | `equipment` | 存数据集原值，也是器械筛选的匹配键。界面只翻译，不归并。 |
| 部位 | `bodyPart` | 存数据集官方 `body_part` 原值（非 cardio 共 9 类）；界面按七类训练部位筛选，原值不改。 |
| 训练部位 | 部位筛选键 | 胸、背、肩、手臂、腿、腰腹、臀；每个动作仅归入一类，臀部目标肌群优先归臀。 |
| 媒体排除清单 | 锁定排除 id | 源 JPEG、源 GIF 或中文要领缺失的动作 id；这些 id 不进发布目录。清单外再缺则生成失败。 |
| 动作展示名 | `nameZh` | 列表主名。闸门是每条非空；允许不同 id 共用同一中文名。_Avoid_: 把中文名唯一当成生成闸门 |
| 动作别名 | `aliases` | 常见中文称呼、旧译名或健身房俗称（如「倒蹬」「龙门架」「下拉」），参与关键词搜索，不参与部位筛选、不改展示名；未覆盖的新动作可为空 |
| 目标肌群 | `target` | 存数据集英文值，展示用中文表（未知原值回退英文）。详情不展示次要肌群。 |
| 媒体 | `imagePath` / `gifPath` | 示意图与动作演示走 CloudBase 按需加载，**不进主包**；须保留 `© Gym visual` 署名。打卡页用 `exerciseId` 反查动作库，**不写入 session 快照**。 |

训练部位筛选（含「全部」）：胸 / 背 / 肩 / 手臂 / 腿 / 腰腹 / 臀。臀部目标肌群优先归臀；颈归肩、上下臂归手臂、上下腿归腿，归类互斥。

器械筛选原值：扫描发布目录得到的实际 `equipment` 集合，稳定排序；当前目录的标签均有中文展示。`assisted` 与 `body weight` 是不同原值。

注意：**自重动作**（volume 口径）仍只认原值 `body weight`，与筛选选中哪几个器械无关。

## 3. 关键规则（改代码时不可破坏）

> 当前训练交互与验收边界见 `.scratch/training-checklist-redesign/spec.md`。原生实现、自动回归、代码复审与模拟器布局复验完成，用户已确认本轮验收并授权提交推送。代理证据范围见 `acceptance.md`，不以浏览器原型或用户整体确认代替未记录的逐项真机证据。

1. **完成驱动推进**：只有打卡完成才 `cursor + 1`；到 `cycleDays` 末尾回到开头；漏练（未完成）**不改变游标**。
2. **游标属于计划**：`cursor` 是 `Plan` 的字段，不是全局状态；切换计划不共享游标。
3. **记录不可变**：session 一旦生成即与 plan 解耦，改 plan 不影响历史记录。
4. **打卡可自由增删动作**：临时加练 / 跳过没练的，动作从动作库选。
5. **volume 口径唯一**：`computeVolume()` 同时供完成小结与记录趋势曲线使用，两处口径必须一致。判据是 `equipment` **原值** `body weight`，与筛选选中哪些器械无关。
6. **逻辑不重复实现**：游标推进、快照复制、volume 计算、队列判定四类规则只存在于 domain 层；页面与云函数只做薄封装。
7. **媒体反查不进快照**：打卡页示意图 / 动作演示 / 动作要领用 `exerciseId` 查动作库；session 仍只快照 `exerciseId / name / equipment`。旧 slug id 的历史场次可以没有媒体。

## 4. 架构分层

```
pages/*            UI 页面(WXML/WXSS/JS)  —— 薄封装
cloudfunctions/    login —— 静默 openid 登录
utils/queue.js     提交队列执行器(注入真实网络请求 + 网络恢复监听)
utils/db.js        CloudBase 数据访问层(仓库模式 + 本地存储降级)
utils/domain.js    ★ domain logic —— 核心规则 seam(纯函数,无运行时依赖)
utils/format.js    展示层格式化纯函数
data/exercises.js  离线动作库
tests/             Jest 单测（domain、离线目录、页面级分页、db 迁移、媒体根与同步脚本）
```

- `utils/domain.js` 不依赖 `wx.*`、CloudBase SDK 或 WXML，可直接用标准 Jest 测试。
- 测试边界包括 domain 公开函数、Page 用户事件/生命周期、记录与提交队列公开接口；仅 mock `wx`、云端、时间和存储边界。覆盖率统计收 `utils/domain.js` 与 `data/exercises.js`（`jest.config.js` → `collectCoverageFrom`），不代表真实页面或设备验收。
- `utils/queue.js` 负责把 domain 的纯判定接上真实网络：`domain.decideSubmission()` 判定 → `db.submitSession()` 执行。
- `pages/library/library-paging.js` 保持动作库匹配集与渲染窗口分离：首屏/追加页每页 24 条，当前页和下一页最多预热 48 张 JPEG；页面层不预取 GIF。
- 数据访问统一走 `utils/db.js`；云端失败时降级到 `wx.getStorageSync`，不阻塞本地记录成立。

## 5. 页面结构

底部 4 个固定 tab（`app.json` → `tabBar.list`，标准 tabBar，未使用 custom tabBar）：

| tab | 路径 | 职责 |
|---|---|---|
| 今天 | `pages/today/today` | active 计划当前游标指向的训练日 + 动作清单 + 「开始训练」入口 |
| 计划 | `pages/plan/plan` | 管理循环计划（增删动作、调顺序）、设为 active |
| 记录 | `pages/records/records` | 按场次时间线倒序回看；单动作趋势曲线 |
| 我的 | `pages/me/me` | 设置、个人信息 |

非 tab 页：`pages/training/training`（打卡中）、`pages/library/library`（动作库）、`pages/plan-day/plan-day`（训练日编辑）、`pages/session-detail/session-detail`（记录详情）。

## 6. 数据模型速查

以下为当前领域模型。旧已提交历史不迁移；无逐组状态的历史按旧口径读取。进行中的 v1 草稿升级到 v2 时保留完成成绩、稳定组 ID、暂停与间歇；更早无状态草稿的目标预填仍为待练。

```js
Plan    = { id, name, cycleDays: [{ dayId, name, exercises: [{ exerciseId, name, equipment, sets, targetReps, targetWeight }] }], cursor, active }
Session = { id, planId, planName, dayId, dayName, dayIndex, startedAt, submittedAt, flowVersion: 2, exercises: [{ exerciseId, name, equipment, skipped, flowVersion: 2, sets: [{ id, status: 'pending' | 'completed' | 'skipped', weight, reps }] }] }
// 进行中草稿另有 nextSetId 和 training；finalize 后移除，不写入最终场次。
training = { phase: 'ready' | 'rest' | 'finished' | 'paused', currentSetId, restSeconds, restEndsAt, restRemainingSec, restPaused, restNotified, restSkipped, resumePhase }
Exercise= { id, name, nameZh, equipment, bodyPart, target, imagePath, gifPath, instructionSteps, aliases }
```

CloudBase 集合：`plans`、`sessions`（权限：仅创建者可读写）。

## 7. 设计系统：FORGE

全站采用 FORGE 深色运动风：今天、计划、训练日编辑、训练中、完成小结、记录与详情、动作库、我的及动作详情弹层共享色板；导航栏与 tabBar 同步深色。今天页 DAY 只表达循环位置，训练页以紧凑组表和勾选为主，间歇用可收起的大数字圆环面板。

| 角色 | 色值 | 用途 |
|---|---|---|
| 底色 | `#0c1613` | 全局背景 |
| 浮层 | `#14211c` / `#22352b` | 卡片、输入框 |
| 信号绿 | `#3ddc97` | 行动按钮、完成态、数据强调 |
| 琥珀 | `#ffb020` | 游标/进行中标记、状态章、头像 |
| 墨色 | `#eef5f1` | 主文字（55% / 32% 两级弱化） |

- 数字一律等宽（SF Mono / `tabular-nums`），与中文黑体形成字体张力。
- 结构编码：DAY = 第 N 天循环顺序；行号 = 动作内组序。已完成使用绿色与勾号，间歇使用柔和黄绿色。
- 原生按钮：`style: v2` 默认宽度会覆盖低优先级规则。行内按钮与底栏需要明确尺寸、flex、居中和页面作用域选择器；完成行之间保留间距，不合并为整块背景。动作详情组件有独立色板，真实动作媒体保留原白底，不反相。

## 8. 命令

```bash
npm install
npm test        # jest --coverage
```

## 9. 约束与待办

- **媒体版权**：数据层 MIT 可用；示意图/GIF 版权归 Gym visual（与 ExerciseDB 权利主张冲突，克隆仓库 ≠ 授权）。个人自用可加载真实媒体并署名；商用上线前必须取得书面授权，且不得把仓库媒体镜像再分发。分辨率限制 180×180。
- **包体积**：动作库文本裁成 `id/name/nameZh/equipment/bodyPart/target/imagePath/gifPath/instructionSteps` 后打进主包；超 2MB 再分包。示意图与 GIF 不进包。
- **环境配置**：`app.js` 顶部 `ENV_ID` 为云开发环境 ID；云数据库需建集合 `plans`、`sessions`；首次进入自动种入「胸三 / 背二 / 肩腿」演示计划。
- **训练清单改版与间歇**：用户已确认规则并验收视觉稿，领域与页面接入采用 v2；当前规格见 `.scratch/training-checklist-redesign/spec.md`。上一轮先开始本组、顺序推进和自动休息规则已被替代。微信原生关键场景无证据时不能标整体验收完成。
- **MVP 不做**：趋势曲线的 top weight / 估算 1RM 指标（仅预留切换入口）。

## 10. 相关文档

- 需求规格：`docs/spec.md`（定位、数据模型、动作库与验收边界）
- 当前训练规格与验收任务：`.scratch/training-checklist-redesign/spec.md`、`.scratch/training-checklist-redesign/issue.md`；上一轮记录：`.scratch/set-by-set-training/`
- 全站主题与原生布局修复：`.scratch/forge-theme-unification/issue.md`；只读量测脚本 `.scratch/forge-theme-unification/check-native-layout.py`
- 动作库实现：`data/exercises.js`（离线目录）、`data/media-root.js`（CloudBase 媒体根）、`pages/library/library-paging.js`（分页预热）、生成脚本与媒体同步脚本
- 动作库当前筛选/展示 spec：`.scratch/library-seven-parts/issue.md`；全量目录发布记录见 `.scratch/full-catalog/issue.md`，历史选择器与精选目录记录见 `.scratch/exercise-selector/`、`.scratch/catalog-quality-fixes/`、`.scratch/catalog-expansion/`。
- 架构决策：`docs/adr/`（接入见 ADR-0007，全量范围与器械筛选见 ADR-0008，七类部位筛选见 ADR-0009）
- Issue 跟踪：`.scratch/<feature>/issue.md`
