---
title: 逐组真实打卡与组间间歇倒计时
labels: [ready-for-agent]
status: open
created: 2026-10-14
---

# 状态

需求已经三轮澄清并确认；方案阶段结束后，用户已授权实施。**当前处于实施阶段，未完成的票不表示已经交付或通过验收。**

集成分支：`feat/set-by-set-training`。实施基线：`0850414189c6ebbf6c4f42469b8ebaa336490fce`。基线全量 Jest：14 个套件通过、1 个套件失败；275 用例通过、29 跳过、1 失败。既有失败为 `tests/catalog.test.js` 的生成器用例，默认源目录 `/tmp/exercises-dataset` 缺少 `exercises.json` 与 `name_zh.json`，`DATASET_DIR` 未设置；不改无关测试掩盖失败。TDD 边界已确认：domain 公开函数、Page 用户事件/生命周期、记录与提交/队列公开边界。禁止生产构建。

Spec：[spec.md](spec.md)。领域术语：根目录 `CONTEXT.md`。

## 核心目标

将“填完表即可提交”改为“每组手动开始、实际练完后打卡”。目标预填不算完成；一组打卡后开始间歇；间歇结束提醒，等待用户开始下一组；所有待练组打卡后才可手动完成整场。

## 分票

| 票 | 范围 | 依赖 | 状态 |
|---|---|---|---|
| [01](issues/01-domain-and-draft.md) | 纯状态流、输入校验、草稿兼容、容量/完成判定 | 无 | done |
| [02](issues/02-training-and-rest.md) | 训练页逐组交互、离线倒计时、提醒与生命周期 | 01 | open |
| [03](issues/03-records-and-finish.md) | 实际记录展示、提交门禁、加练与游标推进集成 | 01；最终集成依赖 02 | 独立实现已合入，待 02 联调 |
| [04](issues/04-integration-acceptance.md) | 回归、聚焦审查与微信端人工验收 | 01–03 | open |

01 先落地状态与数据契约。02、03 仅在契约锁定后并行，且避免同时编辑 `pages/training/training.js`；训练页提交入口由 02 维护、03 提供集成用例与数据封装。04 最后执行。禁止生产构建。

## 方案阶段交付（历史）

- 已记录业务规则、状态流、页面结构建议、兼容/统计方案与验收场景。
- 功能代码、测试代码、音频资源、云数据库均未修改。
- 外部参考与文档检查结果见 spec 和下方记录；不把参考产品的后台能力当作微信小程序能力。

## 验证记录

2026-10-14，文档阶段：

- `npx jest tests/contract-docs.test.js --runInBand`：7 passed / 0 failed。仅验证现有文档/动作库契约，不代表逐组功能已通过测试。
- `git diff --check`：通过。
- 本轮 8 份相关 Markdown 文件：相对链接、代码围栏、新文件尾部空白检查通过。
- 官方参考：Strong Rest Timer、Hevy Workout Rest Timer / Live Activity，来源和能力边界已写入 spec。
- 未运行全量功能测试、生产构建或微信端验收；本轮未新增功能代码，状态仍为方案阶段。