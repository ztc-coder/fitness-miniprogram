# ADR-0003：`utils/domain.js` 作为唯一测试 seam

- 状态：已采纳
- 日期：2026-09-17
- 相关文档：`docs/spec.md`（Implementation Decisions / Testing Decisions）

## Context（背景）

小程序 UI 层（WXML / WXSS / 页面 JS）与云函数入口都难以在 Node 环境中直接测试：
它们依赖 `wx.*` 运行时 API、页面生命周期与云开发 SDK。
如果核心规则直接写在这些薄封装里，就会出现两种坏结果：

- 规则无法自动化测试，只能靠开发者工具手动点。
- 同一条规则（例如 volume 口径）在完成小结与记录趋势曲线里各写一遍，长期必然漂移。

## Decision（决策）

新建 `utils/domain.js` 作为**唯一测试 seam**：与 CloudBase SDK、WXML 渲染层完全解耦的纯逻辑模块，
输入输出均为纯 JS 对象/数组，不依赖网络或小程序运行时 API。

模块承载四类核心规则：

| 能力 | 入口函数 |
|---|---|
| 游标推进 | `advanceCursor(plan, completed)` |
| 打卡快照 | `snapshotSession(plan)` / `addSessionExercise` / `removeSessionExercise` / `updateSessionSet` / `addSessionSet` / `removeSessionSet` / `setExerciseSkipped` |
| volume 计算 | `computeVolume` / `computeSessionTotalVolume` / `computeExerciseCount` / `computeSummary` |
| 提交队列判定 | `decideSubmission` / `enqueueSession` / `dequeueSession` / `markAttemptFailed` |

约束：

- **页面与云函数只做薄封装**，不重复实现上述规则。
- **队列判定不发起真实网络请求**，提交函数由上层（`utils/queue.js`）注入。
- 测试**只断言外部行为**（返回值与产生的数据结构），不断言内部实现细节。

## Consequences（后果）

**正向**

- 核心规则可用标准 Jest 直接单测（`tests/domain.test.js`），无需 `miniprogram-simulate`。
- volume 口径唯一，完成小结与记录趋势曲线共用同一个函数，不会漂移。
- 规则变更只改一处，页面代码保持声明式、易读。

**代价 / 需要接受**

- 页面层必须做数据到视图的映射，多了一层胶水代码（如 `pages/training/training.js` 里的 `isBodyWeight` / `volume` 计算）。
- 纯函数返回新对象（`clone` 深拷贝），在长列表场景有额外开销；本项目数据量小，可接受。
- 测试覆盖率只反映 domain 层，UI 与网络链路仍无自动化覆盖。

**边界说明**

- `utils/format.js` 是纯函数但非核心规则，不在 Jest 覆盖范围内。
- `utils/queue.js` 依赖 `wx.*`，目前无自动化测试。
- `utils/db.js` 有 `tests/db.test.js`（mock `wx`，5 个用例，验证云端不可用时写穿到本地缓存）；
  但 `jest.config.js` 的 `collectCoverageFrom` 只收 `utils/domain.js`，因此覆盖率报告仅反映 domain 层。
