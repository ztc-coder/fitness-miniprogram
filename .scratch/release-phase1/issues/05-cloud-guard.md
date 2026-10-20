<!-- DSH-IDEMPOTENCY-KEY: deck-plan-wayfinder-public-release-phase1-child-cloud-guard -->
<!-- parentKey: 00 -->
<!-- created: 2026-10-20T06:40:24.362Z -->
# 默认 AppID 与云环境防误连硬校验

## Question

`utils/cloud-service.js:3` 的 `const ENV_ID = 'cloud1-d2ga0mned4bbf9b29';` 与 `project.config.json` 的 `appid: wxa884033ad71b4514` 是硬编码。别人 clone 后部署会直接写进运营者云环境（`implementation.md:83` 记录「用户选择保留现有默认…没有运行时强制拦截」）。

## 已定方案

移除默认值 + 启动时硬校验（不是只写文档）。

## 验收

- 未配置真实 AppID/环境 ID 时，启动给出明确提示并禁用云能力；本地训练仍完整可用（与同意前边界一致）。
- 有自动化测试覆盖「未配置 → 禁云」「已配置 → 正常」。
- README 部署步骤列出必须替换的三项：AppID、环境 ID、媒体标识。

## 进度

<!-- 做到哪一步了，在这里一行一行记 -->


## Comments


## Answer

Status: open
Type: task
Blocked by:
Labels: wayfinder:task
