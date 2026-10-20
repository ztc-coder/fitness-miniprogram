<!-- DSH-IDEMPOTENCY-KEY: deck-plan-wayfinder-public-release-phase1-map -->
<!-- created: 2026-10-20T06:40:24.274Z -->
# 阶段一：可部署源码交付

## Destination

阶段一：让仓库**公开可交付**——他人按 README 从零部署即可跑起来，且动作媒体不在仓库内、默认配置不会误连运营者云环境。

阶段二（正式提审上线）本 map 暂不展开，只记在 Not yet specified；阶段一完成后重新评估。

## Notes

- **本 effort 显式覆盖 wayfinder 默认的「只决策不执行」**：`task` 票直接改代码/文档，做完即关闭，不等下一步移交。
- **已拍定的决策（2026-10-20 与维护者逐轮确认）**：
  - 许可证 MIT；放 LICENSE 前先做全量许可核对（npm 依赖 + `data/` + `images/` + `assets/audio`）。
  - 媒体与代码解耦：仓库只放自有占位素材，真实图片/GIF 走独立「媒体包」目录，部署时放入。
  - 默认 AppID / `ENV_ID` **移除默认值 + 启动时硬校验**，不靠文档提醒。
  - 阶段一 DoD 包含「填入真实资料使 `check:public-info` 转绿」。
  - 交付渠道 GitHub 公开仓库 + `v0.1.0` tag。
  - 可部署验收由维护者自己从零跑一遍并修文档。
  - 双用户/独立环境验收**不建票**，记入 fog，条件具备再拆。
- **事实基线**：01–04 票源码已实现并合并 `63fbf37`；双轴审查 P0/P1 清零；`docs/public-release-acceptance.md` 的 M01–M22 真实结果行全为 `Blocked`；`config/public-info.js` 四项为空、`verified:false`，`check:public-info` 预期 exit 1。
- **媒体版权事实**：动作图片/GIF 归 **Gym visual**，须保留 `© Gym visual — https://gymvisual.com/` 与 180×180 限制；数据集文本 MIT（`hasaneyldrm/exercises-dataset`），媒体排除在 MIT 之外，且版权主张在 Gym visual / ExerciseDB / 仓库作者间冲突（ADR-0007）。**这些媒体从未在仓库里**：仓库只存 `exercises/images/…`、`exercises/videos/…` 路径字符串，真实文件在云存储。许可逐项结论见 `THIRD-PARTY.md`。
- **技能**：动代码前读 `karpathy-guidelines`；跑不通先读 `diagnosing-bugs`。

## Decisions so far

<!-- 一票一行：关闭时追加，链接指向票，细节留在票里 -->

- [根 LICENSE 与全量许可核对](.scratch/release-phase1/issues/02-license.md)：MIT 已落地（`Copyright (c) 2026 ztc-coder`），`THIRD-PARTY.md` 逐类记录来源/许可/义务；**关键更正是仓库内从来没有 Gym visual 媒体**——`images/` 只有 20 个自制 tabBar 图标，随仓库分发且带第三方义务的只有 MIT 的动作目录文本与中文动作名（保留上游版权行即可），npm 564 包全为 dev 依赖、音频 CC0、无字体。

## Not yet specified

- **阶段二提审路径**：发布主体与类目资格、备案、生产 AppID 与云环境、后台《用户隐私保护指引》填报、提审材料与最终编译包检查。
- **双用户云端隔离验收**：需要第二台真实设备 + 第二个微信号，当前无条件。触发条件：设备与身份齐备，或决定正式提审。届时拆成独立票。
- **生产部署与提审的放行授权**：由谁在什么时点授权、留什么记录（第06票的 10 项全未勾即卡在此）。

## Out of scope

- 个人备份导出与备份合并恢复（ADR-0012 延后）。
- 多设备并发编辑与自动冲突副本；首版只承诺单设备编辑（ADR-0012）。
- 独立账号体系、手机号/头像昵称采集、通知、支付、商业后台、自建工单后端（ADR-0012、`.scratch/public-release/issue.md` 第 1 节）。
- 动作库扩容与筛选：已由 `.scratch/library-seven-parts/`、`.scratch/full-catalog/` 等既有 effort 处理。


## Comments


## Answer

Status: open
Type: map
Blocked by:
Labels: wayfinder:map
