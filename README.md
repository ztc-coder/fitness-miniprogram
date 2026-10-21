# 撸铁小账本

微信原生力量训练记录工具：第 N 天循环计划、逐组打卡、完成历史、离线动作目录和浅深主题。动作库为 1,295 条非 cardio 目录，支持关键词(含俗称别名)/七类部位/器械原值筛选。成绩先在本地成立，逐组记录不联网；首版不支持多设备并发编辑或备份恢复。

## 部署配置：两个配置点，填本项目的值

这是**个人项目**：自己开发、自己上传发布，供本人与其他使用者使用；不面向「他人 clone 后改造部署」（该场景 2026-10-21 起移出范围，见[地图 00](.scratch/release-phase1/map.md)）。所以仓库里放的就是本项目自己的部署值，配置只有两个点：

| 配置项 | 位置 | 说明 |
|---|---|---|
| AppID | `project.config.json` → `appid` | 本项目的小程序 AppID；`config/cloud-env.js` 若也填了 `appId`，两处必须一致 |
| 环境 ID | `config/cloud-env.js` → `envId` | 本项目云开发环境；**留空 = 未配置**，云同步不可用 |
| 媒体根 | `config/cloud-env.js` → `mediaRoot` | 本项目有权使用的存储桶/域名根，可留空：媒体逐级降级为占位，不阻塞训练 |

`envId` 留空时启动会禁用云能力并弹窗说明：不初始化 `wx.cloud`、不恢复旧同意、不请求远程媒体，本地计划、训练、历史与动作库照常可用（与未同意时的边界一致）。

`npm run check:cloud-env` 检查 `envId` 是否填了、`project.config.json` 的 `appid` 是否为空或形状不对、两处 `appId` 是否一致；任一项不合格就退出 1。它只查本地配置，不代表云环境可用。AppID/环境 ID 不是密钥，但**不要提交私人凭据、管理密钥、身份日志或未批准的联系方式**。

## 本地检查（不部署、不编译）

干净 clone 直接可跑（已实测：`npm ci` 装 564 个包，`npm test` 43 套 / 611 passed，详见[部署预演记录](docs/deployment-rehearsal.md)）：

```bash
npm ci --no-audit --no-fund
npm test -- --runInBand --silent
npm run check:package
npm run check:cloud-env
npm run check:public-info
```

`check:cloud-env` 当前**exit 0**：本项目自己的 AppID 与环境已填好（2026-10-21 起不再有「原运营者基线」判定，见[票 10](.scratch/release-phase1/issues/10-appid.md)）。把 `envId` 清空它会退出 1，那是「未配置」的正常反应；通过只代表配置齐了，不代表云环境可用（已实测：填入形状正确但实际不存在的值也会 exit 0，正说明它替代不了控制台核对）。配置填好时 `npm test` 仍全绿（已实测）。`check:public-info` 已通过（exit 0）：`config/public-info.js` 的运营者、公开隐私/支持渠道由维护者提供并置 `verified: true`。该文件随小程序公开打包——**你若部署自己的小程序，必须替换成你已批准的对外资料**，不要沿用维护者的联系方式；换成空值或示例值时检查会重新阻断（缺项 exit 1，占位文本同样拦截）。不要用示例信息让检查变绿。`check:package` 只按排除规则统计未压缩候选源码，低于 2 MiB 不代表微信最终编译包体合格；最终须开发者工具代码依赖分析、预览与真机确认。

`npm test` 不依赖仓库外的数据集：生成器与索引的用例默认读仓库夹具 `tests/fixtures/exercises-dataset/`（3 条合成动作，无媒体文件）。只有两条「与完整上游数据集逐条一致」的比对需要真实数据集，缺 `/tmp/exercises-dataset` 时显式跳过并注明启用条件——把数据集放好并设 `DATASET_DIR=<目录>` 后再跑就会自动启用。生成器本身仍可用 `node scripts/build-exercises.js --src <数据集目录> --out <输出目录>` 指向真实数据。

## 实现与发布状态

同意/所有者隔离、持久同步及个人数据清理已有源码与 mock 自动回归；不等于已部署或真实云端权限已验收。未同意时可本地训练，不取身份/同步/远程媒体；同意后静默身份与本人同步。撤回不是云删除，清本机不是全端删除，离线设备不能即时远程擦除。

- [本轮验收矩阵与版本证据](docs/public-release-acceptance.md)：2026-10-21 真机 + 双身份验收后，M03/M04/M06/M11/M12/M16/M17/M18/M19/M21 十行转为**通过**，其余 12 行仍 `Blocked` 并逐条写明缺口（未附截图与版本号，提审前需补）。
- [公开发布父规格](.scratch/public-release/issue.md)、[实施记录](.scratch/public-release/implementation.md)、[双轴审查](.scratch/public-release/code-review.md)、[人工闸门](.scratch/public-release/human-clearance.md)：源码双轴审查及修复复测完成，无待处理P0–P2；不因本地结果关闭父任务或第01/02/03真实验收。
- [同意与隔离](docs/consent-owner-isolation.md)、[可靠同步](docs/durable-sync.md)、[数据删除](docs/data-deletion.md)、[隐私核对](docs/public-privacy-checklist.md)。

## 动作媒体：仓库里没有，部署时怎么补

仓库**不含任何真实动作图片/GIF**：目录里只有路径字符串（`exercises/images/…jpg`、`exercises/videos/…gif`），文件既不在 git 里，也不随 npm 或任何发布物分发。媒体根是单一配置点 `config/cloud-env.js` → `mediaRoot`（`data/media-root.js` 的 `MEDIA_ROOT` 由此派生；空值 = 未配置，见上一节）。

部署者按自己拿到的素材三选一：

1. **用自己有权使用的存储**：媒体放进自己 CloudBase 桶或 HTTPS 域名的 `exercises/images/`、`exercises/videos/` 前缀下，把 `mediaRoot`（派生为 `MEDIA_ROOT`）改成自己的桶根（不要再带 `/exercises`）。
2. **换自有素材**：保持同样的相对路径（`exercises/images/<id>-<hash>.jpg`、`exercises/videos/<id>-<hash>.gif`）与 180×180 规格，界面无需改动。
3. **什么都不放**：干净 clone 照样可编译、`npm test` 可跑。运行时媒体逐级降级——详情为 **分解 GIF → JPEG 示意图 → 首字占位**，列表缩略图加载失败只清那一行，今天页回 `↔` 图形、计划日回缩略占位；训练、打卡、历史流程都不受阻塞。

**媒体包**（取得授权后才考虑）：与目录相对路径同构的独立目录，1,295 条 × 2 项 = 2,590 个对象；只放进自己环境，不入库、不作为公开附件再分发。

**署名与限制**：使用 Gym visual 媒体须保留 `© Gym visual — https://gymvisual.com/` 署名与 180×180 限制（详情页、计划日页已固定展示）。没有书面授权就不分发媒体包，也不能用 GitHub/jsDelivr 热链或镜像代替授权。逐条义务见 [THIRD-PARTY.md](THIRD-PARTY.md) §2.1，操作步骤见[独立部署指南](docs/independent-deployment.md) 第 4 节。

## 权利与人工阻断

动作图片/GIF 版权归 Gym visual，须保留 `© Gym visual — https://gymvisual.com/` 署名及 180×180 限制；免费、克隆源码、媒体已上传均不等于获得公开使用/分发授权。书面授权、真实运营者/渠道、平台资格、隐私后台指引、隔离测试、配额费用预警和具体版本生产操作授权均待人工核实。

## 许可

- 源码、文档与自制素材（含 `images/` 下的 tabBar 图标、`.scratch/` 内部记录与设计原型）以 [MIT](LICENSE) 发布，版权行 `Copyright (c) 2026 ztc-coder`。
- 动作目录文本与中文动作名来自 MIT 许可的上游数据集，随仓库分发并保留其版权与许可声明；`assets/audio/rest.wav` 为自制正弦波合成音，以 CC0 1.0 声明。
- **动作图片/GIF 不随本仓库分发**，其版权归 Gym visual，MIT 不涉及这部分。逐项条款、署名义务与可重跑的复核命令见 [THIRD-PARTY.md](THIRD-PARTY.md)。

本地半程（clone → 装依赖 → 测试 → 三项本地检查 → 填配置复跑）已在 2026-10-21 实际跑过并修掉两处卡点，见[部署预演记录](docs/deployment-rehearsal.md)；平台半程仍未部署、未运行生产构建、未推送、未操作真实云环境。没有稳定 URL、设计基准数据或设备可用于视觉验收，不宣称 UI/视觉或真机声音振动验收通过。
