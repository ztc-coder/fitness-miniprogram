---
title: 逐组真实打卡与组间间歇倒计时
labels: [ready-for-human]
status: done
created: 2026-10-14
---

# 状态

**已关闭：用户明确确认验收完成，并授权关闭剩余 issue / ticket。** 01–03 实现与自动回归、复审已完成；04 按用户验收确认关闭。原交互已由 [训练清单改版](../training-checklist-redesign/issue.md) 替代，保留旧实施记录，不重跑退役流程。

集成分支：`feat/set-by-set-training`。实施基线：`0850414189c6ebbf6c4f42469b8ebaa336490fce`。基线全量 Jest：14 个套件通过、1 个套件失败；275 用例通过、29 跳过、1 失败。既有失败为 `tests/catalog.test.js` 的生成器用例，默认源目录 `/tmp/exercises-dataset` 缺少 `exercises.json` 与 `name_zh.json`，`DATASET_DIR` 未设置；不改无关测试掩盖失败。TDD 边界已确认：domain 公开函数、Page 用户事件/生命周期、记录与提交/队列公开边界。禁止生产构建。

Spec：[spec.md](spec.md)。领域术语：根目录 `CONTEXT.md`。

## 核心目标

以下为原始目标；当前自由勾选、手动间歇与部分结束规则以 [新版规格](../training-checklist-redesign/spec.md) 为准。

将“填完表即可提交”改为“每组手动开始、实际练完后打卡”。目标预填不算完成；一组打卡后开始间歇；间歇结束提醒，等待用户开始下一组；所有待练组打卡后才可手动完成整场。

## 分票

| 票 | 范围 | 依赖 | 状态 |
|---|---|---|---|
| [01](issues/01-domain-and-draft.md) | 纯状态流、输入校验、草稿兼容、容量/完成判定 | 无 | done |
| [02](issues/02-training-and-rest.md) | 训练页逐组交互、离线倒计时、提醒与生命周期 | 01 | done |
| [03](issues/03-records-and-finish.md) | 实际记录展示、提交门禁、加练与游标推进集成 | 01；最终集成依赖 02 | done（自动集成验证完成） |
| [04](issues/04-integration-acceptance.md) | 回归、聚焦审查与微信端人工验收 | 01–03 | done（用户确认验收） |

01 先落地状态与数据契约。02、03 仅在契约锁定后并行，且避免同时编辑 `pages/training/training.js`；训练页提交入口由 02 维护、03 提供集成用例与数据封装。04 最后执行。禁止生产构建。

## 方案阶段交付（历史）

- 已记录业务规则、状态流、页面结构建议、兼容/统计方案与验收场景。
- 功能代码、测试代码、音频资源、云数据库均未修改。
- 外部参考与文档检查结果见 spec 和下方记录；不把参考产品的后台能力当作微信小程序能力。

## 方案阶段验证记录（历史）

2026-10-14，文档阶段：

- `npx jest tests/contract-docs.test.js --runInBand`：7 passed / 0 failed。仅验证现有文档/动作库契约，不代表逐组功能已通过测试。
- `git diff --check`：通过。
- 本轮 8 份相关 Markdown 文件：相对链接、代码围栏、新文件尾部空白检查通过。
- 官方参考：Strong Rest Timer、Hevy Workout Rest Timer / Live Activity，来源和能力边界已写入 spec。
- 未运行全量功能测试、生产构建或微信端验收；本轮未新增功能代码，状态仍为方案阶段。

## 实施结果（历史）

- 集成分支 `feat/set-by-set-training`，最终功能 / 修复提交 `26c83c1`；01–03 按本地 tracker 标 done。
- 最终定向 186 passed / 25 skipped / 0 failed；全量 366 passed / 29 skipped / 1 既有目录源数据环境失败，无新增失败，覆盖率阈值未改。
- 原始两轴问题统一修复，独立 Standards / Spec 复审均 APPROVE，0 个剩余 P0–P2。
- 14 份修改 JS 语法、Markdown、diff 与自主提示音验证通过；隔离 worktree 已清理。未运行生产构建、push 或部署。
- 04 与父 issue 保持 open / ready-for-human。具体检查见 [acceptance.md](acceptance.md)，人工证据模板见 [manual-acceptance.md](manual-acceptance.md)。

## 全 issue 收口（上一轮历史）

历史 catalog-expansion 04 / 05 的 frontmatter 已与父票后续交付记录同步 done，未改写旧测试或人工结论。最新工作区自动复验：定向 190 passed / 26 既有 skipped / 0 failed；全量 375 passed / 29 既有 skipped / 1 既有目录缺源失败。新开 / 继续修复已验证，微信端场景加入 04。

用户选择真实验收、未豁免设备证据；当前仅本父票与 04 保持 open，等待真机、真实 WXML / 触控与云权限结果。不能在缺证据时把所有 issue 标 done。

## 最终关闭

后续实现、原生布局修复和结束确认修复已在 `6355a76` 提交推送，用户再次明确表示“我已经验收，可以关闭”。据此本父票与 04 标记 done，历史目录票 04 / 05 的关闭记录一并收口。

关闭依据是用户验收确认，不将未提供的设备型号、逐项声音／锁屏／云权限测试补写为代理已执行。代理实际自动结果为 404 passed / 29 既有 skipped / 1 既有目录源数据环境失败；原生模拟器证据与后续实现边界见 [新版验收记录](../training-checklist-redesign/acceptance.md)。