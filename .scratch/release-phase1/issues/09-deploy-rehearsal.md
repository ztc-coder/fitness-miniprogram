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

- 2026-10-21 平台半程由维护者本人跑完（agent 给步骤，未代操作控制台）：配置真实值 → `check:cloud-env` exit 0 → 开发者工具编译预览通过、启动弹窗消失 → 建 `plans`/`sessions`/`personalDataMeta` 三集合并应用自定义安全规则 `{"read": false, "write": false}` → 部署 `login`/`personalData`（云端安装依赖，Nodejs 16.13）→ 同意云同步后建计划与提交记录，状态从「1 条待同步」转为「已全部云同步」，控制台能看到写入文档 → 建复合索引 `plans`(`_openid`↑+`createdAt`↑+`_id`↑)、`sessions`(`_openid`↑+`submittedAt`↓+`_id`↑)。
- 部署过程中撞到卡点 C（已写进文档，不是代码缺陷）：清缓存导致本机 `fitness:syncGeneration` 归零、与云端 `generation: 1` 不等，`utils/personal-cloud.js` 的删除屏障拒绝普通读写并报「请确认云端删除完成并协调本机数据后重新使用」；解法是走 UI「我的 → 数据管理 → 重新使用云同步」连按两次，由 `reconcile()` 采用云端代际，代价是本机未同步数据被清。
- 验收产出已回写 `docs/deployment-rehearsal.md`：新增 §7 平台半程实跑记录（逐动作结果 + 卡点 C + 仍未做的媒体授权/配额告警/隐私指引核对/两设备在线），§5 标注为当时事实。
- 仍未做且不随本票关闭：Gym visual 书面授权与 2,590 个媒体对象上传、配额告警收件人、后台《用户隐私保护指引》逐条核对、两台真机同时在线。
- 结论：README 与 `docs/deployment-rehearsal.md` 记录的路径，维护者已在自己账号下从零走通（本地半程 + 平台半程），文档按实际卡点修订；本票验收达成，关闭。

## Comments

### local — 2026-10-21T05:59:18.467Z
2026-10-21 票 10 落地后：配置侧阻塞已解除——`config/cloud-env.js` 与 `project.config.json` 已填本项目真实值，`npm run check:cloud-env` 现在 **exit 0**，启动不再弹「云能力已禁用」。本票剩下的只有平台半程：开发者工具里点「编译」看云能力是否真的 ready、建 `plans`/`sessions`/`personalDataMeta` 三集合与自定义安全规则、部署 `login`/`personalData` 两个云函数、按真实报错建索引、双身份真机走一遍、回填 `docs/deployment-rehearsal.md` §5。

## Answer

Status: resolved
Assignees: ztc-coder
Type: task
Blocked by: #03, #05, #04, #08
Labels: wayfinder:task, ready-for-human
