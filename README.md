# 撸铁小账本

微信原生力量训练记录工具：第 N 天循环计划、逐组打卡、完成历史、离线动作目录和浅深主题。动作库为 1,295 条非 cardio 目录，支持关键词(含俗称别名)/七类部位/器械原值筛选。成绩先在本地成立，逐组记录不联网；首版不支持多设备并发编辑或备份恢复。

## 安全起点：克隆后不要直接运行启云

**仓库按维护者选择保留既有默认 AppID、云环境 ID 和媒体根，并非自行部署安全默认值，也没有运行时配置拦截。** 自行部署者必须在任何产品同意、云初始化或删除授权之前，将以下三项全部替换为自己独立环境的值；旧安装需先在不启动小程序的情况下清除开发者工具本地存储，避免已存同意自动启云。不要连接或共享原运营者的生产环境。

| 必须替换 | 位置 |
|---|---|
| 自己的 AppID | `project.config.json` → `appid` |
| 自己的环境 ID | `utils/cloud-service.js` → `ENV_ID` |
| 自己有权使用的存储桶/域名根 | `data/media-root.js` → `MEDIA_ROOT` |

AppID/环境定位符不是密钥；它们仍不能作为“可以使用他人环境”的许可。禁止向仓库提交私人凭据、管理密钥、身份日志或未批准的联系方式。完整步骤见 [独立部署指南](docs/independent-deployment.md)，不要沿用旧版“只部署 login、仅创建者可写”的操作。

## 本地检查（不部署、不编译）

已有依赖时执行（本轮未安装依赖）：

```bash
npm test -- --runInBand --silent
npm run check:package
npm run check:public-info
```

`check:public-info` 当前**预期退出 1 / Blocked**：真实运营者、支持/隐私联系渠道尚未填写且未人工核实。不要用示例信息让检查变绿。`check:package` 只按排除规则统计未压缩候选源码，低于 2 MiB 不代表微信最终编译包体合格；最终须开发者工具代码依赖分析、预览与真机确认。

## 实现与发布状态

同意/所有者隔离、持久同步及个人数据清理已有源码与 mock 自动回归；不等于已部署或真实云端权限已验收。未同意时可本地训练，不取身份/同步/远程媒体；同意后静默身份与本人同步。撤回不是云删除，清本机不是全端删除，离线设备不能即时远程擦除。

- [本轮验收矩阵与版本证据](docs/public-release-acceptance.md)：第05票保持 **open / ready-for-human / Blocked**，尚缺真实双微信、设备及最终编译包。
- [公开发布父规格](.scratch/public-release/issue.md)、[实施记录](.scratch/public-release/implementation.md)、[人工闸门](.scratch/public-release/human-clearance.md)：不因本地测试通过关闭父任务或第01/02/03全局验收；最终双轴审查尚未完成。
- [同意与隔离](docs/consent-owner-isolation.md)、[可靠同步](docs/durable-sync.md)、[数据删除](docs/data-deletion.md)、[隐私核对](docs/public-privacy-checklist.md)。

## 权利与人工阻断

动作图片/GIF 版权归 Gym visual，须保留 `© Gym visual — https://gymvisual.com/` 署名及 180×180 限制；免费、克隆源码、媒体已上传均不等于获得公开使用/分发授权。书面授权、真实运营者/渠道、平台资格、隐私后台指引、隔离测试、配额费用预警和具体版本生产操作授权均待人工核实。没有根 `LICENSE`，不能宣称已获得源码开源许可；许可证由维护者选择，第三方依赖与媒体另行核对。

本轮未部署、未运行生产构建、未推送、未操作真实云环境。没有稳定 URL、设计基准数据或设备可用于视觉验收，不宣称 UI/视觉或真机声音振动验收通过。
