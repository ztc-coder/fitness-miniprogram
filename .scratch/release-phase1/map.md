<!-- DSH-IDEMPOTENCY-KEY: deck-plan-wayfinder-public-release-phase1-map -->
<!-- created: 2026-10-20T06:40:24.274Z -->
# 阶段一：可部署源码交付

## Destination

阶段一：让仓库**可直接编译上线**——这是**个人项目**（维护者自己开发、提交上传并发布，供本人与其他用户使用），交付口径是「维护者自己的 AppID + 云环境 + 真实资料齐备，从仓库直接编译即可发布」，**不做「他人 clone 后独立部署」**（2026-10-21 修订，见票 10）。动作媒体不在仓库内，配置不得误连未知云环境。

阶段二（正式提审上线）本 map 暂不展开，只记在 Not yet specified；阶段一完成后重新评估。

## Notes

- **本 effort 显式覆盖 wayfinder 默认的「只决策不执行」**：`task` 票直接改代码/文档，做完即关闭，不等下一步移交。
- **已拍定的决策（2026-10-20 与维护者逐轮确认）**：
  - 许可证 MIT；放 LICENSE 前先做全量许可核对（npm 依赖 + `data/` + `images/` + `assets/audio`）。
  - 媒体与代码解耦：仓库只放自有占位素材，真实图片/GIF 走独立「媒体包」目录，部署时放入。
  - 默认 AppID / `ENV_ID` **移除默认值 + 启动时硬校验**，不靠文档提醒。**（2026-10-21 票 10 修订：项目定位为个人项目后，守卫只保留「`envId` 未配置 → 禁用云」与「游客模式 AppID」，删除「原运营者基线」判定——维护者本人的 AppID/环境就是合法值。）**
  - 阶段一 DoD 包含「填入真实资料使 `check:public-info` 转绿」。
  - 交付渠道 GitHub 公开仓库 + `v0.1.0` tag。
  - 可部署验收由维护者自己从零跑一遍并修文档。
  - 双用户/独立环境验收**不建票**，记入 fog，条件具备再拆。
- **事实基线**：01–04 票源码已实现并合并 `63fbf37`；双轴审查 P0/P1 清零；`docs/public-release-acceptance.md` 的 M01–M22 真实结果行全为 `Blocked`；`config/public-info.js` 四项为空、`verified:false`，`check:public-info` 预期 exit 1（2026-10-20 起已由 #04 填真实资料并置 `verified:true`，检查转 exit 0；此处是当时基线）。
- **媒体版权事实**：动作图片/GIF 归 **Gym visual**，须保留 `© Gym visual — https://gymvisual.com/` 与 180×180 限制；数据集文本 MIT（`hasaneyldrm/exercises-dataset`），媒体排除在 MIT 之外，且版权主张在 Gym visual / ExerciseDB / 仓库作者间冲突（ADR-0007）。**这些媒体从未在仓库里**：仓库只存 `exercises/images/…`、`exercises/videos/…` 路径字符串，真实文件在云存储。许可逐项结论见 `THIRD-PARTY.md`。
- **技能**：动代码前读 `karpathy-guidelines`；跑不通先读 `diagnosing-bugs`。

## Decisions so far

<!-- 一票一行：关闭时追加，链接指向票，细节留在票里 -->

- [根 LICENSE 与全量许可核对](.scratch/release-phase1/issues/02-license.md)：MIT 已落地（`Copyright (c) 2026 ztc-coder`），`THIRD-PARTY.md` 逐类记录来源/许可/义务；**关键更正是仓库内从来没有 Gym visual 媒体**——`images/` 只有 20 个自制 tabBar 图标，随仓库分发且带第三方义务的只有 MIT 的动作目录文本与中文动作名（保留上游版权行即可），npm 564 包全为 dev 依赖、音频 CC0、无字体。
- [媒体与代码解耦：占位素材与独立媒体包](.scratch/release-phase1/issues/03-media-decoupling.md)：仓库守住「媒体不进来」（`tests/media-decoupling.test.js` 6 条守卫：不得跟踪媒体文件、`images/` 只许 tabBar 图标、文档文案、`.gitignore` 兜住 `exercises/`+`media-pack/`、`app.json` 引用文件齐全），缺媒体走既有降级链不阻塞训练；媒体根仍是 `data/media-root.js` 的 `MEDIA_ROOT` 单点，默认值替换留给 #05；媒体包需 Gym visual 书面授权后才落地，本票关闭不等于已授权。干净 clone 实测 42 套 593 passed。
- [默认 AppID 与云环境防误连硬校验](.scratch/release-phase1/issues/05-cloud-guard.md)：硬编码实为 4 处（`utils/cloud-service.js` 的 `ENV_ID`、`data/media-root.js` 的 `MEDIA_ROOT`、`project.config.json` 的 `appid`、`scripts/upload-exercise-media.js` 的独立 `ENV_ID`），全部改为从单一配置点 `config/cloud-env.js` 读取、默认空值；未配置时 `utils/cloud-service.js` 在 `wx.cloud.init` 前硬拦截、`app.js` 启动弹「云能力已禁用」、`restore()` 不恢复旧同意，本地训练与动作库不受影响；`npm run check:cloud-env` 自动检查（仓库刻意空值故当前 exit 1）；新增 `tests/cloud-env.test.js` 覆盖两侧，全量 45 套 / 650 passed。

- [隔离 npm test 对外部 /tmp 数据集的依赖](.scratch/release-phase1/issues/08-test-isolation.md)：`workspace-baseline.md` 记的那条失败其实早已消失（`tests/catalog.test.js` 已是 mkdtemp 夹具），真正残留的只是 `tests/exercise-selector.test.js` 三条「有 `/tmp/exercises-dataset` 才跑」的静默 skip；改为读新增仓库夹具 `tests/fixtures/exercises-dataset/`（3 条合成动作、无媒体）后，干净 clone 无外部数据集也 **43 套全过 / 610 passed / 28 skipped**（工作区 45 套 653 passed），两条「与完整上游数据集逐条一致」改名加 `[需完整数据集]` 前缀并写明启用条件；顺带发现票面假定的 `--src` 在 `scripts/build-exercises.js` 里根本不存在，按验收补齐 `--src` 与 `--out` 两个参数，缺省行为不变。
- [填入真实运营者资料并让公开资料校验转绿](.scratch/release-phase1/issues/04-public-info.md)：HITL 已落地——维护者提供「赵天才 / 公开邮箱 15708489575@163.com / verified=true」，写入 `config/public-info.js`（`antiResurrection` 文案未改），`check:public-info` 转 **exit 0**，说明页同源渲染实测 `releaseBlocked=false`、两条渠道可复制。**关键澄清：平台后台的《用户隐私保护指引》≠ 仓库配置**，前者是审核材料、后者是小程序内展示与闸门数据源，不会自动同步，核对清单第 20 条要求两边一致。前置改造：两个把「配置必须为空、检查必须 exit 1」写死的测试改为「结论与当前配置一致」，否则填值那刻假红。保留风险：渠道可达性由维护者承诺、未实际发信；`verified` 由维护者拍板；该邮箱本地部分即手机号，公开邮箱等于该号码公开。
- [按个人项目定位放开云环境守卫](.scratch/release-phase1/issues/10-appid.md)：维护者明确「该项目本身是我个人项目…无需做他人部署」，#05 的「原运营者基线」判定（`LEGACY` 三值与 `isLegacy*` 三个函数）全部删除，守卫只剩「`envId` 未配置 → 禁云」与「游客模式 AppID」；`config/cloud-env.js` 与 `project.config.json` 填入本项目真实 AppID/环境/桶根，`check:cloud-env` 从 exit 1 转 **exit 0**，启动不再弹「云能力已禁用」，`mediaRoot` 不再被清空；README「安全起点」段替换为「部署配置：两个配置点」，`docs/independent-deployment.md` 标注移出范围。45 套 654 passed。**平台侧能否真启云仍未验证**（#09 人工半程）。

- [单身份真机验收（自有手机 + 自有微信号）](.scratch/release-phase1/issues/07-device-acceptance.md)：2026-10-21 维护者本人真机 + 双身份跑完，`docs/public-release-acceptance.md` 的 M03/M04/M06/M11/M12/M16/M17/M18/M19/M21 十行由 `Blocked` 转**通过**（末列带日期，文末补记写实际结果与缺口），其余 12 行仍 Blocked 并逐条写明缺什么。两条结论性事实：① 清缓存/重装使本机 `syncGeneration` 归零、与云端代际不等，触发删除屏障，必须走「我的 → 数据管理 → 重新使用云同步」显式协调，代价是清掉本机未同步数据；② 新身份看到的「力量循环」是 `utils/db.js:430` `ensureSeedPlans` 的种子计划（`fitness:seedVersion` 按 owner 分桶，每个新身份各种一次），不是跨账号泄漏，隔离验收要判断「B 里有没有 A 的业务数据」而不是「B 是否为空」。证据缺口：无脱敏截图/日志路径、无设备型号与基础库版本。
- [按 README 从零部署自验证](.scratch/release-phase1/issues/09-deploy-rehearsal.md)：本地半程（干净 clone：`npm ci`、43 套 611 passed、三项检查、修掉「配置无处可填」与「填配置后测试假红」两处卡点）+ 平台半程（维护者本人：三集合与自定义规则 `{"read": false, "write": false}`、部署 `login`/`personalData`、编译预览、云同步读写核对、复合索引 `plans`/`sessions`）均实跑，`check:cloud-env` 转 **exit 0**；产出 `docs/deployment-rehearsal.md` §7 逐动作记录与卡点 C（清缓存后的代际协调）。仍未做：媒体授权与 2,590 对象上传、配额告警、后台隐私指引核对、两台真机同时在线。
- [阶段一交付：v0.1.0 公开与发布说明](.scratch/release-phase1/issues/06-phase1-release.md)：2026-10-21 收口，仓库由 private 转 **public**（`gh repo edit --visibility public`），annotated tag `v0.1.0` 与 GitHub Release（正文即 `docs/release-notes-v0.1.0.md`，8 条已知限制原样保留）同日落地，匿名访问仓库页返回 200。**关键修正**：默认分支原为 `main`（停在 `fe2f5d5`、落后 49 提交），公开前先 `git merge --ff-only feat/public-release` 快进 `main` 到发布提交，否则公开页展示旧代码。发布前把 31 个改动文件分成 4 个提交入库并复跑全量：45 套 654 passed / 28 skipped、`check:package` 1,213.6 KiB / 96 文件 PASS、`check:public-info` 与 `check:cloud-env` exit 0；`git grep` 未发现密钥，AppID/环境 ID/mediaRoot 为公开标识、公开邮箱为维护者主动公开。

## Not yet specified

- **阶段二提审路径**：发布主体与类目资格、备案、生产 AppID 与云环境、后台《用户隐私保护指引》填报、提审材料与最终编译包检查。
- **双用户云端隔离验收**：**部分已落地（2026-10-21，票 07/09）**——同一台设备切换两个真实微信号的 A/B 隔离已验收通过（M03/M04）；仍缺「两台真机同时在线」，以及 M10/M13/M14/M15 这类需要可控并发与第二设备的删除/撤回编排。触发条件：第二台设备可用，或决定正式提审。届时拆成独立票。
- **生产部署与提审的放行授权**：由谁在什么时点授权、留什么记录（第06票的 10 项全未勾即卡在此）。
- **媒体包的授权与分发形态**：`#03` 已定「不入库、部署时自备」，但要真正对外提供媒体包，仍需 Gym visual 书面授权（主体/范围/期限/分发方式）+ 打包与校验方式 + 部署者获取入口；授权未落地前不拆票。

## Out of scope

- 个人备份导出与备份合并恢复（ADR-0012 延后）。
- 多设备并发编辑与自动冲突副本；首版只承诺单设备编辑（ADR-0012）。
- 独立账号体系、手机号/头像昵称采集、通知、支付、商业后台、自建工单后端（ADR-0012、`.scratch/public-release/issue.md` 第 1 节）。
- 动作库扩容与筛选：已由 `.scratch/library-seven-parts/`、`.scratch/full-catalog/` 等既有 effort 处理。
- **他人 clone 后独立部署**：项目定位为个人项目（票 10，2026-10-21），`docs/independent-deployment.md` 仅留档，不再提供该路径。

## Comments

## Answer

Status: resolved
Type: map
Blocked by:
Labels: wayfinder:map

## 进度

- 2026-10-21 收口：9 张子票全部关闭（02 许可、03 媒体解耦、04 公开资料、05 云环境守卫、06 发布、07 真机验收、08 测试隔离、09 部署预演、10 AppID 定位修订），可接 0 张、被阻塞 0 张。

**Destination 逐条对账**：

1. 「维护者自己的 AppID + 云环境 + 真实资料齐备」——`config/cloud-env.js:9-11` 写入本项目 AppID/环境 ID/媒体根，`config/public-info.js:4-5` 写入运营者与公开渠道，`check:cloud-env`、`check:public-info` 均 exit 0（票 04、10）。
2. 「从仓库直接编译即可发布」——干净 clone 与平台半程实跑均通过（票 09），`docs/deployment-rehearsal.md` §7 逐动作留档；`check:package` PASS 1,213.6 KiB / 96 文件。
3. 「动作媒体不在仓库内」——`tests/media-decoupling.test.js` 6 条守卫，仓库只存路径字符串（票 03）。
4. 「配置不得误连未知云环境」——未填 `envId` 时启动硬拦截云能力，游客模式 AppID 亦被拒（票 05/10）。
5. 「交付渠道 GitHub 公开仓库 + `v0.1.0` tag」——仓库已 public、tag 与 Release 已发布（票 06）。

**结论**：阶段一 Destination 达成。阶段二（正式提审上线：发布主体与类目资格、备案、生产 AppID 与云环境、后台《用户隐私保护指引》填报、提审材料）按 Notes 的约定本 map 不展开，已留在 Not yet specified；重新评估时另开 effort。

**移交到阶段二的未决项**（不是阶段一的缺口，但会影响提审）：`docs/public-release-acceptance.md` 仍 12 行 Blocked（M01/M02 受控重跑、M05 请求证据、M07–M09 故障注入、M10/M13–M15 并发与第二设备、M20 后台隐私核对、M22 配额与许可）；Gym visual 媒体书面授权与 2,590 个 180×180 对象分发未落地。

