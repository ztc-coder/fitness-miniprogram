# 目录结构

> 本项目是**微信原生小程序**（无构建步骤，仓库源码即运行物，见 ADR-0002）。
> 下面的结构是当前仓库的真实布局，不是理想规划。

---

## 仓库根目录

```
fitness-miniprogram/
├── app.js / app.json / app.wxss   # 应用入口、页面与 tabBar 声明、全局设计系统
├── pages/                         # 8 个页面，每个一个目录
├── components/                    # 自定义组件（目前仅 exercise-detail）
├── utils/                         # 逻辑层：domain / db / queue / format
├── data/                          # 离线动作库与媒体根配置（随主包发布）
├── cloudfunctions/login/          # 云函数：静默 openid 登录
├── tests/                         # Jest 单测（Node 环境，mock wx）
├── scripts/                       # 一次性/离线脚本：目录生成、媒体同步
├── images/                        # 主包内图片（tabbar 图标等）
├── docs/                          # spec.md / spec-mvp.md / adr/ / agents/
├── .scratch/<feature>/issue.md    # 本地 issue 跟踪（ADR-0006）
├── .trellis/                      # 本规范与任务系统
├── CONTEXT.md                     # 领域词汇表 + 架构概览（改代码前先读）
└── jest.config.js / package.json  # 唯一工具链：jest
```

---

## pages/

一个页面 = 同名四件套 `xxx.js / xxx.json / xxx.wxml / xxx.wxss`，目录名与文件名一致（微信要求）。

```
pages/
├── today/            # tab：今天该练什么 + 开始训练
├── plan/             # tab：管理循环计划
├── records/          # tab：场次时间线 + 单动作趋势
├── me/               # tab：设置
├── training/         # 打卡中（非 tab）
├── library/          # 动作库（非 tab）
├── plan-day/         # 训练日编辑（非 tab）
└── session-detail/   # 记录详情（非 tab）
```

约定：

- tab 页必须在 `app.json` → `tabBar.list` 里声明，且 tab 数保持 2–5 个；当前 4 个 tab 使用**标准 tabBar**，未使用 custom tabBar（`custom-tab-bar/` 目录不存在，不要凭空引入）。
- 页面私有逻辑可拆成同目录的普通模块，页面 `require('./xxx')`。示例：`pages/library/library-paging.js` 被 `pages/library/library.js` 引用，也被 `tests/library-paging.test.js` 直接测试。
- 新增页面要同步改 `app.json` → `pages` 数组；非 tab 页不需要进 `tabBar.list`。

---

## components/

自定义组件与页面同级同构，目录名即组件名：`components/exercise-detail/`。

- 组件 `.json` 必须写 `{ "component": true }`。
- 页面/组件通过绝对路径注册：`"usingComponents": { "exercise-detail": "/components/exercise-detail/exercise-detail" }`（见 `pages/library/library.json`）。
- 组件要能被多个入口复用（`exercise-detail` 同时服务动作库与打卡页），跨页复用逻辑放 `components/`，只服务单页的 UI 留在该页目录。

---

## utils/（逻辑层，按职责分层）

| 文件 | 职责 | 可测试性 |
|---|---|---|
| `utils/domain.js` | ★ 核心规则纯函数：游标推进、快照、volume、队列判定 | 直接 Jest 覆盖 |
| `utils/db.js` | 数据访问层（仓库模式）：云数据库读写 + 本地存储降级 | `tests/db.test.js` mock `wx` |
| `utils/queue.js` | 提交队列执行器：把 domain 判定接上真实网络与网络恢复监听 | 依赖 `wx.*`，无自动化覆盖 |
| `utils/format.js` | 展示层格式化纯函数（日期、数字、时长） | 不在覆盖率统计内 |

新增规则时先问：它是不是「游标 / 快照 / volume / 队列」四类之一？是就进 `utils/domain.js`，不要在页面里重写。

---

## data/（离线数据，随主包发布）

| 文件 | 说明 |
|---|---|
| `data/exercises.js` | 动作库唯一对外入口：`search` / `findById` / 各类 label 与筛选常量 |
| `data/exercises-data-1.js` | 实际动作条目（分片，避开微信单文件体积上限） |
| `data/curated-catalog.js` | 精选白名单与标签（`CURATED_EXERCISES`、`PART_LABELS`） |
| `data/slug-map.js` | 旧英文 slug → 新 4 位数字 id 的兼容反查 |
| `data/media-root.js` | CloudBase 媒体根，`resolveMedia(path)` 单一拼接点 |

- 媒体（JPEG / GIF）**不进主包**，只存相对路径，运行时经 `resolveMedia` 拼成 `cloud://` 地址。
- 目录数据变更走 `scripts/build-exercises.js` 生成，不手改分片文件。

---

## scripts/ 与 tests/

- `scripts/` 放离线/一次性工具（`build-exercises.js`、`upload-exercise-media.js`、`hand-overrides.js`），运行在 Node，可 `require` 仓库内模块，但**不进入小程序包**。
- `tests/` 与源码目录**不镜像**，全部平铺为 `tests/*.test.js`，`jest.config.js` 用 `testMatch: ['**/tests/**/*.test.js']` 匹配。
- 覆盖率只统计 `utils/domain.js` 与 `data/exercises.js`（`collectCoverageFrom`），阈值 80%。

---

## 相关文档

- 领域词汇与分层说明：`CONTEXT.md`
- 架构决策：`docs/adr/`（分层相关见 ADR-0002 / 0003 / 0004 / 0005 / 0007）
