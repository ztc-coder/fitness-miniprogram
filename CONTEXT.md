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
| 动作库 | `data/exercises.js` | **离线只读**数据，随主包发布，已排除 cardio 类 |
| 动作条目 | `{id, nameZh, equipment, bodyPart, target, imagePath}` | 精简字段；`equipment` 是判定自重动作的**唯一依据** |
| 器械 | `equipment` | `barbell` / `dumbbell` / `cable` / `machine` / `body weight` / `band` / `kettlebell` |
| 媒体 | `imagePath` | 图片与 GIF 走 CloudBase 云存储按需加载，**不进主包** |

## 3. 关键规则（改代码时不可破坏）

1. **完成驱动推进**：只有打卡完成才 `cursor + 1`；到 `cycleDays` 末尾回到开头；漏练（未完成）**不改变游标**。
2. **游标属于计划**：`cursor` 是 `Plan` 的字段，不是全局状态；切换计划不共享游标。
3. **记录不可变**：session 一旦生成即与 plan 解耦，改 plan 不影响历史记录。
4. **打卡可自由增删动作**：临时加练 / 跳过没练的，动作从动作库选。
5. **volume 口径唯一**：`computeVolume()` 同时供完成小结与记录趋势曲线使用，两处口径必须一致。
6. **逻辑不重复实现**：游标推进、快照复制、volume 计算、队列判定四类规则只存在于 domain 层；页面与云函数只做薄封装。

## 4. 架构分层

```
pages/*            UI 页面(WXML/WXSS/JS)  —— 薄封装
cloudfunctions/    login —— 静默 openid 登录
utils/queue.js     提交队列执行器(注入真实网络请求 + 网络恢复监听)
utils/db.js        CloudBase 数据访问层(仓库模式 + 本地存储降级)
utils/domain.js    ★ domain logic —— 唯一测试 seam(纯函数,无运行时依赖)
utils/format.js    展示层格式化纯函数
data/exercises.js  离线动作库
tests/             Jest 单测（domain 外部行为 + db 云主本地降级行为）
```

- `utils/domain.js` 不依赖 `wx.*`、CloudBase SDK 或 WXML，可直接用标准 Jest 测试。
- `tests/db.test.js` 通过 mock `wx` 验证数据访问层“云端不可用时写穿到本地缓存”的降级行为；
  但覆盖率统计只收 `utils/domain.js`（`jest.config.js` → `collectCoverageFrom`）。
- `utils/queue.js` 负责把 domain 的纯判定接上真实网络：`domain.decideSubmission()` 判定 → `db.submitSession()` 执行。
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
Exercise= { id, nameZh, equipment, bodyPart, target, imagePath }
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
npm test        # jest --coverage；40 个用例（domain 35 + db 5），domain.js 覆盖率 95%+
```

## 9. 约束与待办

- **媒体版权**：动作示意图/GIF 版权归 Gym visual，上线前必须取得书面授权、保留 `© Gym visual — https://gymvisual.com/` 署名，并遵守 180×180 分辨率限制。
- **包体积**：动作库 JSON 当前为精选子集；接入全量数据集后需实测是否落进 2MB 主包，超出则走分包。
- **环境配置**：`app.js` 顶部 `ENV_ID` 为云开发环境 ID；云数据库需建集合 `plans`、`sessions`；首次进入自动种入「推 / 拉 / 腿」演示计划。
- **MVP 不做**：组间休息计时器（后期评估）；趋势曲线的 top weight / 估算 1RM 指标（仅预留切换入口）。

## 10. 相关文档

- 需求规格：`docs/spec.md`（grilling 结论）、`docs/spec-mvp.md`（spec 全文）
- 架构决策：`docs/adr/`
- Issue 跟踪：`.scratch/<feature>/issue.md`
- UI 原型：`fitness-prototype.html`（早期浅色方向，已被深色 FORGE 重设计取代）
