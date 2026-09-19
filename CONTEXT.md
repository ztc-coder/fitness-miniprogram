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
| 打卡 | — | 开始训练 = 把当天计划**快照复制**成一条独立 session |
| 训练场次 | `Session` | 一次实际训练记录，生成后与 plan **解耦** |
| 快照 | `snapshotSession()` | 深拷贝当前游标指向的训练日；不与 plan 共享引用 |
| 组 | `set: {weight, reps}` | **唯一 set 模型**，只做力量训练；不做有氧/计时类 |
| 自重动作 | `equipment === 'body weight'` | 复用同一 set 模型，`weight` 表示**额外负重**（徒手为 0 或空） |
| 跳过 | `skipped: true` | 该动作本次没练；不计入动作数与总容量 |
| 容量 | volume | 常规动作 `Σ(weight × reps)`；自重动作 `Σreps` |
| 完成小结 | `computeSummary()` | 结束后展示 动作数 / 总容量 / 时长，并与**上次同类型**（同 `planId` + `dayId`）对比 |
| 提交队列 | pending queue | 本地已完成但未提交成功的 session 列表，无网时排队重试 |

### 动作库侧

| 术语 | 代码字段 | 含义 |
|---|---|---|
| 动作库 | `data/exercises.js` | **离线只读**数据，随主包发布；经 `data/curated-catalog.js` 精选白名单裁剪的常用动作目录（当前 136 条，规格区间约 100–140 条） |
| 动作条目 | `{id, name, nameZh, equipment, bodyPart, target, imagePath, gifPath, instructionSteps, aliases}` | 精简字段；`id` 用数据集 4 位数字字符串（如 `"0025"`）；`name` 为英文原名，`nameZh` 为展示名（社区映射打底，手译覆盖）；`equipment` 是判定自重动作的**唯一依据** |
| 动作演示 | `gifPath` | 数据集提供的 180×180 分解 GIF（灰阶解剖人、目标肌群红高亮）。这就是界面上的「标准动作」视觉。_Avoid_: 视频、跟练 |
| 动作要领 | `instructionSteps` | 中文分步说明（数据集 `instruction_steps.zh`） |
| 示意图 | `imagePath` | 与演示同构图的 JPEG 静帧。动作库列表与打卡页行内缩略图；演示 GIF 加载失败时的占位。列表不加载 GIF。 |
| 器械 | `equipment` | 存数据集原值。筛选 6 桶只影响列表，不改原值、不改 volume。 |
| 部位 | `bodyPart` | 存数据集英文原值，仅展示用；产品筛选改走精选元数据的**部位标签**。 |
| 精选动作 | `CURATED_EXERCISES`（`data/curated-catalog.js`） | 经多来源训练内容发现、训练模式与器械可用性复核后人工保留的健身房常用动作；同一模式可保留有意义的器械、难度或单侧替代，不保留纯握距、附件、左右侧或版本号重复 |
| 动作展示名 | `nameZh` | 用户在健身房常用的规范中文名；列表只展示该名称，不把多个称呼堆在名称中 |
| 动作别名 | `aliases` | **已实现的目录一等字段**：动作的常见中文称呼、旧译名或健身房俗称（如「倒蹬」「龙门架」「下拉」），参与关键词搜索，不参与部位筛选、不改展示名；与上游英文名一起提供可发现性，不作为独立动作或重复条目 |
| 动作模式 | `mode` | 描述动作力学类型的规范术语（如水平推、垂直推、水平拉、垂直拉、深蹲、髋铰链、负重行走、屈肘）；口语“举”统一指肩上推举并归入垂直推，不指高翻、抓举或挺举。精选元数据的 `mode` 必须取自 39 词受控词表 |
| 负重行走 | `carry` | 持负重移动并维持躯干稳定的复合模式；农夫行走同时属于腿、腰腹和复合动作，可用于训练计划，不等同于有氧项目 |
| 抗旋转 | `anti-rotation` | 在外力下阻止躯干旋转的核心稳定模式；标准 Pallof Press 是代表动作，与主动转体分开分类 |
| 躯干侧屈 | `trunk-lateral-flexion` | 躯干在额状面侧向屈曲的核心模式，如哑铃侧屈和绳索侧卷腹；不归入躯干旋转 |
| 部位标签 | `tags` / `PART_LABELS` | 用户按训练区域或用途浏览动作的可重叠分类，共 10 个标签：胸、背、肩、二头肌、三头肌、腿、腰腹、臀、热身、复合动作。筛选行按此顺序显示 11 项（含「全部」） |
| 热身动作 | `warm-up` 部位标签 | 为抗阻训练做准备的激活或活动动作，如弹力带拉开、肩袖外旋、面拉、怪兽走和髋部动态活动；不包含跑步机、有氧器械或完整体能训练 |
| 复合动作 | `compound` | 多关节动作的**重叠标签**：命中「复合动作」筛选，同时保留具体部位标签的可发现性 |
| 目标肌群 | `target` | 存数据集英文枚举，展示用固定中文表（如 `pectorals` → 胸大肌）。详情不展示次要肌群。 |
| 生成器粗筛 | `TARGET_WHITELIST` | `scripts/build-exercises.js` 的目标肌群放行表，共 16 项，与上游 `target` 原值比对（含 `traps`、`serratus anterior`，不含 `forearms`、`levator scapulae`）。它只做粗筛，`CURATED_EXERCISES` 才是最终目录的唯一闸门 |
| 媒体 | `imagePath` / `gifPath` | 示意图与动作演示走 CloudBase 按需加载，**不进主包**；须保留 `© Gym visual` 署名。打卡页用 `exerciseId` 反查动作库，**不写入 session 快照**。 |

器械筛选桶（语义归并）：

| 筛选桶 | 数据集 `equipment` 原值 |
|---|---|
| 杠铃 | `barbell` / `ez barbell` / `olympic barbell` / `trap bar` |
| 哑铃 | `dumbbell` |
| 绳索 | `cable` / `rope` |
| 器械 | `leverage machine` / `smith machine` / `sled machine` |
| 自重 | `body weight` / `assisted` |
| 其他 | 其余（含 `kettlebell`、`band`、`weighted`、`stability ball` 等） |

注意：**自重动作**（volume 口径）仍只认原值 `body weight`；**自重筛选**含 `assisted`。两者不是同一概念。

部位中文标签：`back` 背 / `chest` 胸 / `lower arms` 前臂 / `lower legs` 小腿 / `neck` 颈 / `shoulders` 肩 / `upper arms` 上臂 / `upper legs` 大腿 / `waist` 腰腹。

## 3. 关键规则（改代码时不可破坏）

1. **完成驱动推进**：只有打卡完成才 `cursor + 1`；到 `cycleDays` 末尾回到开头；漏练（未完成）**不改变游标**。
2. **游标属于计划**：`cursor` 是 `Plan` 的字段，不是全局状态；切换计划不共享游标。
3. **记录不可变**：session 一旦生成即与 plan 解耦，改 plan 不影响历史记录。
4. **打卡可自由增删动作**：临时加练 / 跳过没练的，动作从动作库选。
5. **volume 口径唯一**：`computeVolume()` 同时供完成小结与记录趋势曲线使用，两处口径必须一致。判据是 `equipment` **原值** `body weight`，与筛选桶无关。
6. **逻辑不重复实现**：游标推进、快照复制、volume 计算、队列判定四类规则只存在于 domain 层；页面与云函数只做薄封装。
7. **媒体反查不进快照**：打卡页示意图 / 动作演示 / 动作要领用 `exerciseId` 查动作库；session 仍只快照 `exerciseId / name / equipment`。旧 slug id 的历史场次可以没有媒体。

## 4. 架构分层

```
pages/*            UI 页面(WXML/WXSS/JS)  —— 薄封装
cloudfunctions/    login —— 静默 openid 登录
utils/queue.js     提交队列执行器(注入真实网络请求 + 网络恢复监听)
utils/db.js        CloudBase 数据访问层(仓库模式 + 本地存储降级)
utils/domain.js    ★ domain logic —— 唯一测试 seam(纯函数,无运行时依赖)
utils/format.js    展示层格式化纯函数
data/exercises.js  离线动作库
tests/             Jest 单测（domain、精选目录、页面级分页、db 迁移、媒体根与同步脚本）
```

- `utils/domain.js` 不依赖 `wx.*`、CloudBase SDK 或 WXML，可直接用标准 Jest 测试。
- `tests/db.test.js` 通过 mock `wx` 验证数据访问层“云端不可用时写穿到本地缓存”的降级行为；
  但覆盖率统计只收 `utils/domain.js`（`jest.config.js` → `collectCoverageFrom`）。
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

```js
Plan    = { id, name, cycleDays: [{ dayId, name, exercises: [{ exerciseId, name, equipment, sets, targetReps, targetWeight }] }], cursor, active }
Session = { id, planId, planName, dayId, dayName, dayIndex, startedAt, submittedAt, exercises: [{ exerciseId, name, equipment, skipped, sets: [{ weight, reps }] }] }
Exercise= { id, name, nameZh, equipment, bodyPart, target, imagePath, gifPath, instructionSteps, aliases }
```

CloudBase 集合：`plans`、`sessions`（权限：仅创建者可读写）。

## 7. 设计系统：FORGE

深色运动编辑风，全局深墨绿，签名元素是「今天」页的巨型描边游标数字（DAY 01）。

| 角色 | 色值 | 用途 |
|---|---|---|
| 底色 | `#0c1613` | 全局背景 |
| 浮层 | `#14211c` / `#1b2b24` | 卡片、输入框 |
| 信号绿 | `#3ddc97` | 行动按钮、完成态、数据强调 |
| 琥珀 | `#ffb020` | 游标/进行中标记、状态章、头像 |
| 墨色 | `#eef5f1` | 主文字（55% / 32% 两级弱化） |

- 数字一律等宽（SF Mono / `tabular-nums`），与中文黑体形成字体张力。
- 结构编码：字标 `01 02 03` = 第 N 天循环顺序；琥珀点 = 当前游标。

## 8. 命令

```bash
npm install
npm test        # jest --coverage
```

## 9. 约束与待办

- **媒体版权**：数据层 MIT 可用；示意图/GIF 版权归 Gym visual（与 ExerciseDB 权利主张冲突，克隆仓库 ≠ 授权）。个人自用可加载真实媒体并署名；商用上线前必须取得书面授权，且不得把仓库媒体镜像再分发。分辨率限制 180×180。
- **包体积**：动作库文本裁成 `id/name/nameZh/equipment/bodyPart/target/imagePath/gifPath/instructionSteps` 后打进主包；超 2MB 再分包。示意图与 GIF 不进包。
- **环境配置**：`app.js` 顶部 `ENV_ID` 为云开发环境 ID；云数据库需建集合 `plans`、`sessions`；首次进入自动种入「胸三 / 背二 / 肩腿」演示计划。
- **MVP 不做**：组间休息计时器（后期评估）；趋势曲线的 top weight / 估算 1RM 指标（仅预留切换入口）。

## 10. 相关文档

- 需求规格：`docs/spec.md`（grilling 结论）、`docs/spec-mvp.md`（spec 全文）
- 动作库实现：`data/curated-catalog.js`（白名单与标签）、`data/exercises.js`（离线目录）、`data/media-root.js`（CloudBase 媒体根）、`pages/library/library-paging.js`（分页预热）、`scripts/build-exercises.js` 与 `scripts/upload-exercise-media.js`
- 动作库当前 spec/验收：`.scratch/catalog-expansion/issue.md`（136 条扩容、热身标签、v3 迁移与媒体同步）；历史规格：`.scratch/common-exercise-catalog/issue.md`、`.scratch/exercise-catalog/issue.md`
- 架构决策：`docs/adr/`（动作库接入见 ADR-0007）
- Issue 跟踪：`.scratch/<feature>/issue.md`
- UI 原型：`fitness-prototype.html`（早期浅色方向，已被深色 FORGE 重设计取代）
