<!-- DSH-IDEMPOTENCY-KEY: wayfinder-release-phase1-child-10-personal-guard -->
<!-- parentKey: 00 -->
<!-- created: 2026-10-21T05:50:20.162Z -->
# 按个人项目定位放开云环境守卫：允许本人 AppID 与云环境

## Question

#05 按「他人 clone 后独立部署」的前提做了硬拦截：`utils/cloud-env.js` 的 `LEGACY`（`wxa884033ad71b4514` / `cloud1-d2ga0mned4bbf9b29` / 桶前缀）被当成「别人的值」，填了就阻断——包括维护者本人。

维护者 2026-10-21 明确（原话）：「该项目本身是我个人项目，开发完成后提交上传到小程序中并发布，由我或者其他用户使用，无需做他人部署」。于是这条拦截只剩误伤：填自己的真实值 → `check:cloud-env` 红、启动弹「云能力已禁用」、云同步不可用、`mediaRoot` 被清空。

## 已定方案

保留「未配置（`envId` 为空）→ 禁用云」这条守卫，删掉「原运营者」概念本身：

- `utils/cloud-env.js`：移除 `LEGACY` 与 `isLegacyAppId`/`isLegacyEnvId`/`isLegacyMediaRoot`；`getCloudIssues` 只判「envId 未配置」「游客模式 AppID」。
- `data/media-root.js`：配置的 `mediaRoot` 直接用，不再因历史前缀被清空。
- `scripts/check-cloud-env.js`：去掉 legacy 判定，保留 appid 为空/形状不符/两处不一致三项检查。
- `config/cloud-env.js`、`project.config.json`：填入本项目自己的 AppID 与环境值。
- 测试与文档同步：`tests/cloud-env.test.js`、`tests/media-root.test.js`、`tests/setup-cloud-env.js` 注释、README、`docs/deployment-rehearsal.md`、`docs/independent-deployment.md`。

## 验收

- `npm run check:cloud-env` exit 0。
- `npm test` 全绿（含「未配置仍禁云」仍在）。
- 配置填好后启动不再弹「云能力已禁用」；`envId` 留空时仍禁用云。

## 进度

2026-10-21 完成并关闭。

**做了什么（全部落地）**

- `utils/cloud-env.js`：删 `LEGACY` 与 `isLegacyAppId`/`isLegacyEnvId`/`isLegacyMediaRoot`；`getCloudIssues` 只剩两条——「envId 未配置」与「游客模式 AppID」；`getMediaNotices` 只在未配置时提示降级。
- `data/media-root.js`：`MEDIA_ROOT = configuredRoot`，不再按历史前缀清空。
- `scripts/check-cloud-env.js`：去掉 legacy 判定，保留 envId 为空、appid 为空/形状不符、两处 appid 不一致、游客模式四项；文案「发布阻断」→「配置检查未通过」，仍 exit 1。
- `config/cloud-env.js` 填入 `appId: wxa884033ad71b4514`、`envId: cloud1-d2ga0mned4bbf9b29`、`mediaRoot: cloud://cloud1-d2ga0mned4bbf9b29.636c-cloud1-d2ga0mned4bbf9b29-1456520720`；`project.config.json` 的 `appid` 同步。
- 测试：`tests/cloud-env.test.js` 删两条 legacy 断言，新增「填了本项目自己的值即放行」`toEqual([])` 与「编译结果就是本项目自己的 AppID 时正常启云」（断言 `wx.cloud.init({ env, traceUser: false })`、`status: ready`）；`tests/media-root.test.js` legacy 用例改为「原样使用」；`tests/setup-cloud-env.js` 注释改为「测试专用假环境」。
- 文档：README 的 `## 安全起点…` 整段换成 `## 部署配置：两个配置点，填本项目的值`；`docs/deployment-rehearsal.md` 加 2026-10-21 修订块（§2/§3 的 exit 1 是历史结果）；`docs/independent-deployment.md` 加「已移出范围」横幅；`utils/cloud-service.js`、`scripts/upload-exercise-media.js` 注释/文案同步。

**验证（实测）**

- `npm test -- --runInBand --silent`：45 套全过，654 passed / 28 skipped / 682。
- `npm run check:cloud-env`：**exit 0**（「部署配置检查通过；仍需在控制台核对环境归属、权限与配额」）。
- `npm run check:public-info` exit 0；`npm run check:package` exit 0（1,213.4 KiB / 96 文件）。
- 反向验证：「envId 留空仍禁用云」的用例保留并通过，守卫没有被一并删掉。

**未验证**

- 没有在微信开发者工具里实际编译：本机无 CLI 登录态，属 #09 的人工半程。用户在 IDE 里点「编译」后弹窗应消失。
- 云环境是否仍存在、配额与权限只能到云开发控制台/`console.cloud.tencent.com/tcb` 核对，仓库侧无从判断。

**遗留**

- #09 仍开着（平台半程），但前置的配置阻塞已解除；#06 的 10 项放行检查不变。

Status: resolved
Assignees: ztc-coder
Type: task
Blocked by:
Labels: wayfinder:task

## Comments

## Answer

