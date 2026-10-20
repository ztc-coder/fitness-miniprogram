<!-- DSH-IDEMPOTENCY-KEY: deck-plan-wayfinder-public-release-phase1-child-public-info -->
<!-- parentKey: 00 -->
<!-- created: 2026-10-20T06:40:24.348Z -->
# 填入真实运营者资料并让公开资料校验转绿

## Question

`config/public-info.js` 的 `operatorName`、`privacyContact{label,value}`、`supportContact{label,value}` 全为空且 `verified:false`，`npm run check:public-info` 因此预期 exit 1（`docs/public-release-acceptance.md:94`、`issues/01:53`）。维护者称真实资料与平台材料均已就绪。

## 动作

填入真实值、置 `verified: true`，跑 `check:public-info` 至退出 0。`antiResurrection` 那段披露文案已写好，不要改写。

## 验收

- `npm run check:public-info` 退出 0。
- 隐私页与帮助页展示的联系方式与配置一致。
- 不填示例、不填未获授权的私人联系方式。

## 注意

HITL：具体取值需维护者提供，agent 不代填。

## 进度

- 2026-10-20 认领（`assignees: [ztc-coder]`），票面 / 评论 / 标签 / 阻塞边读完；`blockedBy` 为空，本票阻塞 06、07、09。
- **前置澄清**：微信公众平台后台的《用户隐私保护指引》≠ 仓库 `config/public-info.js`。前者是平台审核材料，后者是小程序内「我的 → 关于 → 隐私说明」展示与 `check:public-info` 闸门的数据源，二者不会自动同步；[docs/public-privacy-checklist.md](docs/public-privacy-checklist.md)20 要求两边「一致」，即都要有且文字对得上。
- **前置改造**（不依赖取值，否则填值那刻反而假红）：
  - `tests/public-info-check.test.js` 原先把「配置必须为空、检查必须 exit 1」写死，改为「脚本结论与当前配置一致」——缺项断言 exit 1 并逐项指出阻断键，齐全断言 exit 0 与通过文案。
  - `tests/public-help-page.test.js` 缺资料态/齐全态改用 `withPublicInfo()` 在内存里临时改写并在 `finally` 还原（不写磁盘、不污染其他用例）；新增「说明页展示与当前仓库配置一致」——`missingInfo` 等于 `getPublicInfoIssues(info)`、`releaseBlocked` 同源、齐全时展示值等于配置值。
- **维护者提供的真实取值**（2026-10-20）：运营者 `赵天才`；隐私渠道与支持渠道相同，`label = 公开邮箱`、`value = 15708489575@163.com`；`verified = true`。
- 已写入 [config/public-info.js](config/public-info.js)，`antiResurrection.scope` / `retention` 文案**一字未改**。
- **验证**：
  - `npm run check:public-info` → **exit 0**，输出「公开资料配置检查通过；不代表整体验收或正式可发布。」
  - 页面同源渲染实测：`releaseBlocked=false`、`operatorName=赵天才`、隐私与支持渠道 `available:true` 且 value 可复制、`missingInfo=[]`。
  - 全量 `npm test` → **45 套全过，654 passed / 28 skipped / 682，0 失败**。
  - `npm run check:package` → exit 0，1,213.9 KiB / 96 文件。`check:cloud-env` 仍 exit 1（部署默认值，属票 05，预期）。
- **文档同步**：[README.md](README.md) 的本地检查段由「预期退出 1」改为「已通过 + 部署者必须替换」；[docs/independent-deployment.md](docs/independent-deployment.md)51 同步；[docs/public-privacy-checklist.md](docs/public-privacy-checklist.md) 增加当前状态段；[docs/public-release-acceptance.md](docs/public-release-acceptance.md) 末尾加「补记（2026-10-20）」——第 16/94/105 行是各自执行时刻的历史记录，未改写。
- **未验证 / 保留风险**：① 渠道可达性由维护者对外承诺，我未实际发信验证；② `verified=true` 由维护者拍板，第 06 票要求的「平台后台《用户隐私保护指引》与本配置一致」仍需人工核对；③ 该邮箱本地部分即手机号，邮箱公开等于该号码公开；④ 该文件随小程序公开打包，部署者必须换成自己的资料（README 与部署指南已写明）。
- 本票验收三条全部满足（check exit 0；页面展示与配置一致；未填示例、取值由维护者提供），关闭。

## Comments

### local — 2026-10-20T09:32:10.779Z
前置改造已完成并全量验证（45 套 654 passed / 28 skipped）。配置未动，仍在等维护者提供四项真实取值；票保持 open。

### local — 2026-10-20T09:36:01.239Z
已填入维护者提供的真实资料并置 verified=true：check:public-info exit 0，页面同源渲染一致，全量 45 套 654 passed / 0 失败；antiResurrection 文案未改。文档同步并保留历史记录不改写。验收三条满足，关闭本票。

## Answer

Status: resolved
Assignees: ztc-coder
Type: task
Blocked by:
Labels: wayfinder:task
