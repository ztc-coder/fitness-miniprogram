# 撸铁小账本

微信原生力量训练记录工具：第 N 天循环计划、逐组打卡、完成历史、离线动作目录和浅深主题。动作库为 1,295 条非 cardio 目录，支持关键词(含俗称别名)/七类部位/器械原值筛选。成绩先在本地成立，逐组记录不联网；首版不支持多设备并发编辑或备份恢复。

## 安全起点：没有自己的云环境，就不要启云

**仓库不带可用的部署默认值：`project.config.json` 的 `appid` 为空，`config/cloud-env.js` 的 `envId`、`mediaRoot` 也为空。** 这不是“能用只是没换”，也不是可以忽略的占位——启动时 `utils/cloud-service` 会硬拦截：不初始化 `wx.cloud`、不恢复旧同意、不请求远程媒体，只弹窗说明「云能力已禁用」，本地计划、训练、历史与动作库照常可用（与未同意时的边界一致）。所以干净 clone 不会误连原运营者的云环境。

要启用云同步，必须把三项都换成自己的值，填完重启：

| 必须替换 | 位置 | 说明 |
|---|---|---|
| 自己的 AppID | `project.config.json` → `appid` | 开发者工具导入时选择自己主体的小程序 |
| 自己的环境 ID | `config/cloud-env.js` → `envId` | 缺失或仍是原运营者环境时云能力保持禁用 |
| 自己有权使用的存储桶/域名根 | `config/cloud-env.js` → `mediaRoot` | 可留空：媒体逐级降级为占位，不阻塞训练 |

`npm run check:cloud-env` 会检查 `project.config.json` 的 `appid`、`config/cloud-env.js` 的三项，以及是否仍是原运营者基线；任一项没填好就退出 1。这仍然是人工替换与人工核对，不是自动部署。旧安装需先在不启动小程序的情况下清除开发者工具本地存储，避免已存同意自动启云。不要连接或共享原运营者的生产环境。AppID/环境定位符不是密钥；它们仍不能作为“可以使用他人环境”的许可。禁止向仓库提交私人凭据、管理密钥、身份日志或未批准的联系方式。完整步骤见 [独立部署指南](docs/independent-deployment.md)，不要沿用旧版“只部署 login、仅创建者可写”的操作。

## 本地检查（不部署、不编译）

已有依赖时执行（本轮未安装依赖）：

```bash
npm test -- --runInBand --silent
npm run check:package
npm run check:cloud-env
npm run check:public-info
```

`check:cloud-env` 当前**预期退出 1 / Blocked**：仓库刻意不带部署默认值（空 `appid`、空 `envId`），填好自己的值才会通过，且通过只代表配置齐了，不代表云环境可用。`check:public-info` 当前**预期退出 1 / Blocked**：真实运营者、支持/隐私联系渠道尚未填写且未人工核实。不要用示例信息让检查变绿。`check:package` 只按排除规则统计未压缩候选源码，低于 2 MiB 不代表微信最终编译包体合格；最终须开发者工具代码依赖分析、预览与真机确认。

## 实现与发布状态

同意/所有者隔离、持久同步及个人数据清理已有源码与 mock 自动回归；不等于已部署或真实云端权限已验收。未同意时可本地训练，不取身份/同步/远程媒体；同意后静默身份与本人同步。撤回不是云删除，清本机不是全端删除，离线设备不能即时远程擦除。

- [本轮验收矩阵与版本证据](docs/public-release-acceptance.md)：第05票保持 **open / ready-for-human / Blocked**，尚缺真实双微信、设备及最终编译包。
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

本轮未部署、未运行生产构建、未推送、未操作真实云环境。没有稳定 URL、设计基准数据或设备可用于视觉验收，不宣称 UI/视觉或真机声音振动验收通过。
