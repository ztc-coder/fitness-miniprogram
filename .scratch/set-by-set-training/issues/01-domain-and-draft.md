---
title: 逐组状态、草稿兼容与实际统计
labels: [ready-for-agent]
status: done
created: 2026-10-14
---

需求已确认，本票纯 domain 能力已实施；页面、提交持久化与真机验收留给 02–04。依据 [spec](../spec.md) §2、§3、§5.1。公开数据/API 契约见 [implementation.md](../implementation.md)。

## 修改范围

- `utils/domain.js`：统一初始化未打卡组、纯状态迁移、完成校验、当前组选择、撤销最近组、跳过剩余、增删保护与完成门禁。
- 本地旧草稿升级保持输入和旧跳过；升级幂等，历史 session 不写入。
- 统计规则区别新流程组状态与旧历史：新场次只计已打卡组，部分跳过仍保留完成容量；自重判据及容量公式不改。
- 补 domain 回归测试；模块不依赖 `wx`、真实时钟回调或 SDK，时间通过输入传入。

## 验收

- Spec A01–A05、A07、A11–A15、A17–A18 的纯逻辑用例通过。
- 预填不是完成；全跳过不是有效训练；不能完成未开始组或越组打卡。
- 双击完成幂等，增删不会指错当前组，撤销仅在下一组开始前有效。
- 快照独立、旧历史容量/动作数保持原行为。
- 提供 02/03 可复用的组状态、草稿控制与统计契约，字段名以实际最小实现为准。

## 依赖/边界

无前置票。先交付本票再开始依赖页改动。不得修改计划目录 v5 迁移，不引入通用状态机依赖，不完成整场提交或触发游标推进。

## 实施与实际验证

- pending 统一初始化、稳定组 ID、顺序开始/完成、合法成绩、双击幂等、绝对时间间歇、暂停继续、±15 秒、跳过与单次提醒、撤销窗口、编辑/增删保护、进度和整场 gate 已实现。
- 仅显式升级本地旧草稿，幂等且不升级历史；新旧单动作/整场统计兼容。`finalizeTrainingSession(session, now)` 仅构造可提交快照并清理控制态；`computeSummary` 使用已有 submittedAt 固定时长。
- 按 domain 公开边界逐行为 red→green；旧 snapshot 精确对象断言保留并更新新增字段。
- 合入集成分支文档 tip `db9a479` 后实际执行 `/Users/ztc/fitness-miniprogram/node_modules/.bin/jest tests/domain.test.js --runInBand`：**1 suite / 73 tests passed，0 failed**（借用现有 Jest，不安装依赖）。
- `node --check utils/domain.js`、`node --check tests/domain.test.js`、`git diff --check`：通过。
- 未运行生产构建、全量测试或微信端验收。已知基线 catalog 源数据缺失不属于本票，未修改无关测试；02–04 与父 issue 不标完成。
