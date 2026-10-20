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

- 认领：2026-10-20 由 ztc-coder 认领，按 wayfinder 流程推进（本票无 needs-triage，无需阶段闸门）。
- 现状核查：硬编码实为 **4 处**，不止票面写的 2 处——`utils/cloud-service.js:3` 的 `ENV_ID`、`data/media-root.js:20` 的 `MEDIA_ROOT`（运营者云桶根）、`project.config.json` 的 `appid`、`scripts/upload-exercise-media.js:16` 的独立 `ENV_ID`；README 当时也明写「没有运行时配置拦截」。
- 设计：新建单一配置点 `config/cloud-env.js`（`appId`/`envId`/`mediaRoot`，默认全空＝未配置），配 `utils/cloud-env.js` 纯校验（识别原运营者 AppID/环境 ID/桶根、游客模式、AppID 形状），默认值全部移除，改由启动硬拦截。
- 代码落地：`utils/cloud-service.js` 新增 `configured()`/`configIssues()`，`initialize()` 在 `wx.cloud.init` 之前 `assertConfigured()`，`enable()` 在写同意之前拦截并抛「云能力未配置，保持本地模式：…」，`restore()` 未配置时不读旧同意、不启云；`data/media-root.js` 的 `MEDIA_ROOT` 改为从 config 派生，原运营者桶根按未配置处理；`app.js` 启动弹「云能力已禁用」并跳过 restore；`scripts/upload-exercise-media.js` 去掉硬编码 ENV_ID、未配置时拒绝执行；`project.config.json` 的 `appid` 置空。
- 自动检查：新增 `scripts/check-cloud-env.js` + `npm run check:cloud-env`，检查 project.config.json appid、config 三项、是否仍是原运营者基线，未填好退出 1（当前仓库刻意空值，预期 exit 1）。
- 测试：jest `setupFiles` 注入测试部署配置（`tests/setup-cloud-env.js`，process.env 跨 resetModules 存活，13 个既有 enable() 测试文件零改动）；重写 `tests/media-root.test.js`，新增 `tests/cloud-env.test.js`（未配置 5 例：启云拒绝/删除授权拒绝/旧同意不恢复/本地训练可用/启动弹窗；配置齐全 3 例：正常启云/原 AppID 拦截/游客模式拦截）。
- 全量验证：`npm test -- --runInBand --silent` → **45 套全过，650 passed / 29 skipped / 679**（本票前为 44 套 / 637 passed）；`check:package` exit 0（1,213.8 KiB / 96 文件，仍低于 2 MiB）；`check:cloud-env` exit 1、`check:public-info` exit 1（均为预期阻断）。
- 文档：README「安全起点」重写为「没有自己的云环境，就不要启云」+ 三项替换表 + check:cloud-env；媒体段改指 `config/cloud-env.js → mediaRoot`；`docs/independent-deployment.md` §1/§4 与 `docs/adr/0001-use-cloudbase-for-backend.md` 同步为配置点 + 硬拦截。
- 未验证：微信开发者工具真实编译与真机运行（本机无 GUI）；真实云环境可用性（需部署者自己的 AppID/环境，属 #07/#09）。关闭本票不等于云同步已验收。
- 验收结论：3 条验收全部满足——未配置时启动明确提示且云能力禁用、本地训练完整可用；未配置/已配置两侧均有自动化覆盖；README 列出 AppID、环境 ID、媒体根三项。

## Comments

### local — 2026-10-20T08:48:06.312Z
完成：默认值已全部移除，未配置自己的 AppID/环境 ID 时启动即硬拦截（不 init 云、不恢复旧同意、不取远程媒体），本地训练与动作库照常可用。

改动：新增 `config/cloud-env.js`（单一配置点）、`utils/cloud-env.js`（纯校验）、`scripts/check-cloud-env.js` + `npm run check:cloud-env`、`tests/cloud-env.test.js`、`tests/setup-cloud-env.js`；重写 `utils/cloud-service.js`/`app.js`/`tests/media-root.test.js` 的配置与拦截路径；`data/media-root.js`、`scripts/upload-exercise-media.js`、`project.config.json` 去掉硬编码；README、部署指南、ADR 0001 同步。

验证：全量 `npm test -- --runInBand --silent` 45 套 / 650 passed / 29 skipped；`check:package` exit 0（1,213.8 KiB / 96 文件）；`check:cloud-env` 与 `check:public-info` 均 exit 1（仓库刻意空值，属预期阻断）。
未验证：微信开发者工具真实编译/真机、真实云环境可用性（归 #07/#09）。

## Answer

Status: resolved
Assignees: ztc-coder
Type: task
Blocked by:
Labels: wayfinder:task
