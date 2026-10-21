<!-- DSH-IDEMPOTENCY-KEY: deck-plan-wayfinder-public-release-phase1-child-deploy-rehearsal -->
<!-- parentKey: 00 -->
<!-- created: 2026-10-20T06:40:24.409Z -->
# 按 README 从零部署自验证

## Question

`docs/independent-deployment.md` 从未被实际跑过（第05票 6 项未勾之一）。维护者已定：自己从零跑一遍并修文档。

## 验收

- 在干净目录（或另一台机器）按 README 走完：clone → 装依赖 → 替换 AppID/环境 → 放媒体包 → 上传云函数 → 配置集合权限 → 编译预览。
- 记录每一步的卡点并回写文档；不做「看起来能跑」的判断。
- 产出 `docs/` 下的部署验证记录：日期、环境、结果、仍缺的平台动作。

## 依赖

等媒体解耦、防误连、真实资料、测试隔离四票完成后再跑，否则验的是旧形态。

## 进度

- 2026-10-21 认领（ztc-coder）；干净 clone 到 `/tmp/wf-deploy-09`（HEAD 38a7b4f），环境 macOS / node v22.22.3 / npm 10.9.8。
- 本地半程实跑（干净 clone 默认状态）：`npm ci` exit 0（564 包，3.8s）；`npm test` 43 套 611 passed / 28 skipped；`check:package` exit 0（1,196.9 KiB / 90 文件）；`check:public-info` exit 0；`check:cloud-env` exit 1（设计如此，发布阻断）；101 个 tracked JS 全过 `node --check`，JSON 全可解析；小程序代码里非相对 `require` 0 处（不依赖 `miniprogram_npm`）。
- 卡点 A（已修）：`config/cloud-env.js` 原来只读 `process.env.*`，而小程序运行时没有 `process.env`，部署者照着「替换位置」打开文件无处可填 → 改为文件顶部 `DEPLOY` 三个字面量（`appId`/`envId`/`mediaRoot`），环境变量仅作 CI/测试覆盖。
- 卡点 B（已修）：`tests/cloud-env.test.js` 用「删除环境变量」模拟未配置；一旦部署者按 README 填入字面量，删除后仍回落到字面量，「未配置」夹具失效，describe「未配置自己的云环境时禁用云能力」下 4 条红 → 配置语义改为「显式空字符串=明确未配置，未设置才回落字面量」，夹具改为置空。两种仓库状态实测均 43 套全绿。
- 填配置复测：三项填假值 → `check:cloud-env` exit 0、`MEDIA_ROOT` 正确派生、`upload-exercise-media.js` 不再被 envId 拦、`npm test` 仍全绿；只填工程 `project.config.json` 的 `appid` 而 `DEPLOY.appId` 留空 → exit 0（与文档一致）；两处 appid 不一致 → exit 1（明细准确）。
- 云函数依赖：`wx-server-sdk@~2.6.3` 解析为 2.6.3（上游最新 4.0.2），两函数各装出约 80 MB `node_modules`，该目录被 `.gitignore` 命中。
- 文档：新建 `docs/deployment-rehearsal.md`（日期/环境/逐步结果/两处卡点/仍缺平台动作/复跑命令）；`docs/independent-deployment.md` 与 `README.md` 同步「本地半程已实测」及 `DEPLOY` 三行的替换位置。
- 未做（需维护者账号与 GUI）：建独立云环境、开发者工具导入+编译预览（`appid` 为空时工具表现未实测）、上传 `login`/`personalData`、建三集合与 `client-permissions.json` 规则、建索引、Gym visual 授权与媒体包上传、配额告警、后台隐私指引核对、双身份真机。
- **本票保持 open**：验收第 1 条要求的平台半程没有跑，不宣称「按 README 可部署」。下一步是维护者按 `docs/deployment-rehearsal.md` §5 清单跑完并回填结果。

## Comments

## Answer

Status: claimed
Assignees: ztc-coder
Type: task
Blocked by: #03, #05, #04, #08
Labels: wayfinder:task, ready-for-human
