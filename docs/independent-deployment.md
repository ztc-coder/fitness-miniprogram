# 独立部署指南（第05票，操作清单而非已执行记录）

**本地半程已实际跑过**（2026-10-21：干净 clone → `npm ci` → `npm test` 43 套全过 → 三项本地检查 → 填入配置复跑，并修掉两处卡点），记录见[部署预演记录](deployment-rehearsal.md)。**下列控制台、上传、预览和设备步骤全部未执行**：本轮没有云环境/设备授权，也没有开发者工具 GUI。仅供获得独立测试环境授权后的维护者复现；不构成生产部署、提审或发布授权。状态见 [验收矩阵](public-release-acceptance.md)。

## 1. 自有身份与隔离环境：先配置，后打开运行

1. 通过微信公众平台创建/确认自己主体下的小程序，取得自己的 AppID；按后台实际要求核实主体、类目、备案及测试人员。不要使用原运营者 AppID 或借用生产数据。
2. 在自己账号下创建独立 CloudBase 测试环境，确认区域、绑定 AppID、环境 ID、计费主体、管理员权限；生产另建，不与开发或其他自行部署者共享环境、数据或凭据。
3. **不要先运行克隆项目。** 仓库刻意不带部署默认值：`project.config.json` 的 `appid` 为空，`config/cloud-env.js` 顶部的 `DEPLOY` 三个字面量（`appId`、`envId`、`mediaRoot`）也为空。未填时启动会硬拦截（不初始化 `wx.cloud`、不恢复旧同意、弹窗说明云能力已禁用），不会落到原运营者环境；任何产品同意、`restore()`、`wx.cloud.init`、删除专用身份授权之前，三项必须换成自己的值并逐一与自己控制台核对：

   | 配置 | 仓库现状（空值不是给你的默认值，旧基线也不是） | 替换位置 |
   |---|---|---|
   | AppID | 空 | `project.config.json` 的 `appid`；`config/cloud-env.js` 顶部 `DEPLOY.appId` 可选，仅用于一致性检查 |
   | 环境 ID | 空 | `config/cloud-env.js` 顶部 `DEPLOY.envId`（写成普通字符串，不要设环境变量：小程序运行时没有 `process.env`） |
   | 媒体 ROOT | 空 | `config/cloud-env.js` 顶部 `DEPLOY.mediaRoot`（`data/media-root.js` 的 `MEDIA_ROOT` 由此派生） |

   `npm run check:cloud-env` 会检查三项是否已填、是否仍是原运营者基线、`appid` 形状与两处是否一致；它只是本地配置检查，仍须人工在控制台核对环境归属、权限与配额。三项中任一未填、仍等于旧基线、未知归属或与控制台不符，均 **Blocked，停止启动**。不要仅换 AppID；不要把原运营者值当成可用配置，也不要请求默认媒体测试。
4. 开发者工具导入项目时核对 AppID（`appid` 为空时工具可能提示选择小程序或进入游客模式——这一表现本票未在工具里实测；按提示填入自己的 AppID，并确认与 `config/cloud-env.js` 的 `DEPLOY.appId` 一致）；在首次编译运行前清除该测试安装的本地存储/旧同意（备份必要测试证据，不操作生产设备）。旧安装可能存有 `fitness:cloudConsent=true` 并在启动恢复同意。删除授权也会初始化云能力，不能作为跳过配置的路径。
5. 留存本地配置对照表：源码 SHA、自己的预期 AppID/环境/媒体根、实际值、核对人和 UTC 时间；公开仓库只放获批可公开定位符，不放 secret、token、管理证书、私钥、真实 openid、私人日志。没有任何理由共享原运营者私有凭据。

## 2. 个人集合与规则（必须先于客户端启云）

在自己的测试环境建立 `plans`、`sessions`、`personalDataMeta`，三个集合分别应用 `cloudfunctions/personalData/client-permissions.json`：

```json
{"read": false, "write": false}
```

即客户端全部不可读写，不是旧文档的“仅创建者可读写”。所有运行时私人访问通过 `personalData` RPC，服务端从 `getWXContext().OPENID` 取可信身份；管理 SDK 不受客户端规则兜底，故不可删去函数内 owner/版本/代际检查。只复制规则文件不等于规则已生效；保存各集合规则截图/导出及环境和时间。媒体存储权限独立，不能将个人集合开放来修复媒体失败。

若查询提示需索引，在该测试环境按真实错误及当前查询（owner 过滤、业务时间与 `_id` 排序）建立所需索引并保存定义；不要通过去掉 owner 条件或放开规则绕过。索引、事务冲突和 SDK 返回行为都须实测，mock 不证明平台兼容。

## 3. 云函数及依赖（仅描述 GUI 上传，未执行）

| 函数目录 | 当前依赖声明 | 核对重点 |
|---|---|---|
| `cloudfunctions/login` | `wx-server-sdk: ~2.6.3` | 波浪范围，不保证云端实际恰好2.6.3；记录安装解析版本及运行时 |
| `cloudfunctions/personalData` | `wx-server-sdk: 2.6.3` | 精确固定；包括 index/write-boundary/deletion 等完整文件，不仅 index |

获得授权后，在微信开发者工具云开发面板选**自己的测试环境**；分别右键两个目录 →「上传并部署：云端安装依赖」。这是未来人工操作说明，本轮没有上传或安装。核对云端包、依赖解析版本、函数 Node 运行时、部署版本/时间与源码 SHA，不能只根据本地 package.json 宣称部署一致。不要执行仓库未知的一键部署脚本、全环境覆盖或生产命令。

当前 personalData 用手动 `startTransaction`，最低事务 SDK 要求1.7.0；2.6.3版本的 `runTransaction` 直接返回 callback 值，不能按新版包装误解。实际 `throwOnNotFound:false`、缺失文档、权限/网络错误、提交/回滚与并发删除行为仍需真实测试；任何错误不能一概当不存在。参阅 [可靠同步](durable-sync.md) 与 [数据删除协议](data-deletion.md)。

## 4. 媒体、公开资料、资源及许可

- 媒体根只能指向自己获授权的存储桶根或 HTTPS 域名，不再附 `/exercises`；相对路径已有 `exercises/images/…jpg`、`exercises/videos/…gif`。目录1,295条对应2,590个对象，**不是自己环境已上传的证明**。
- **媒体包布局与缺媒体表现**：自建媒体包须与目录相对路径同构（`exercises/images/<id>-<hash>.jpg`、`exercises/videos/<id>-<hash>.gif`，1,295 条共 2,590 个对象，180×180），放上自己桶根后只在 `config/cloud-env.js` 改 `mediaRoot`（`data/media-root.js` 的 `MEDIA_ROOT` 由此派生）；媒体包不进仓库、不作公开附件。**没有媒体也照样能启动**：干净 clone 可编译、`npm test` 可跑，运行时逐级降级（详情 分解 GIF → JPEG 示意图 → 首字占位；列表缩略图失败只清该行；今天页 `↔`、计划日缩略占位），训练/打卡/历史不被阻塞。不要为了“界面完整”把媒体塞回仓库。
- 先取得 Gym visual 书面公开展示/存储/分发授权、180×180限制及署名要求；不得从默认环境或 GitHub/jsDelivr 热链、镜像再分发来绕过授权。没有授权不对外发布，不以审核时隐藏媒体解决。
- 若未来使用 `scripts/upload-exercise-media.js`，它现在从 `config/cloud-env.js` 读 `envId` 与 `mediaRoot`，未填 `envId` 时脚本直接拒绝执行；使用前仍须复核源数据权利、源目录、受管前缀及清理计划。**本轮不运行该脚本，包括 dry-run，不执行 `--execute`**；优先由获授权人员通过自己环境存储 GUI 按相对路径上传，并记录对象/权限。禁止将原运营者凭据交给该脚本。
- 云存储读取策略、AppID环境绑定、HTTPS 合法域名/证书及客户端访问能力须在自己环境核实；公共媒体如需公开读取仅限有授权的媒体对象，禁止私人集合公开。确认未同意不取媒体、同意后仅取本环境、失败回退不阻挡训练。
- 填写 `config/public-info.js` 真实运营者、公开隐私权益/支持渠道；维护者验证可达后才置 `verified=true`。已披露最小删除屏障保留范围/服务存续期策略，须对照实际实现。**本仓库当前已由维护者填入「赵天才 / 公开邮箱」并将 `verified` 置 `true`，`npm run check:public-info` 因此 exit 0**；该文件随小程序一起公开打包，你部署自己的小程序时必须换成自己获批的对外资料（换回空值或示例文本会重新阻断为 exit 1）。
- 为自己环境设置数据库/存储容量、读写次数、函数调用/时长/并发、流量/下载与费用额度和告警收件人；按控制台当前套餐核定阈值、预算/停服策略，记录告警实收证据，不能编造通用免费额度。不得把耗尽配额导致的失败显示成同步成功。
- 根 `LICENSE` 已存在（MIT，版权行 `Copyright (c) 2026 ztc-coder`），第三方条款、署名义务与复核命令见 [THIRD-PARTY.md](../THIRD-PARTY.md)。部署者仍须自行核对 package-lock 的直接/传递依赖、SDK 及数据来源许可/声明，并按上一节的媒体授权要求处理动作媒体；数据/某依赖 MIT 不代表整仓库或媒体 MIT。

## 5. 基础库、API、平台隐私及真实运行核验

记录开发者工具版本、基础库选择、微信版本、设备 OS/型号及云函数运行时；仓库没有可据此宣布全部兼容的最终最低基础库认证。`wx.cloud` 缺失应保留本地能力并明确失败，不允许降为客户端直写。

需测试云初始化/可信 login/函数调用、网络变化与重试、存储读写/失败、页面生命周期、导航/tabBar主题 API、音频及振动在目标微信/设备实际可用。隐私 API `wx.getPrivacySetting` 自2.32.3起支持，若当前实现/未来使用受控接口，须按功能检测及官方清单核对兼容；不把2.32.3当本项目已认证的最低版本。`needAuthorization=false` 不等于产品云服务同意或后台合规，不能只加 `__usePrivacyCheck__`。

由维护者在自己的管理后台真实核对《用户隐私保护指引》、实际身份/训练/同步/媒体/删除元数据处理及用户权利渠道，保存日期/版本/核对结果。参见 [隐私清单](public-privacy-checklist.md)。官方入口：[云开发](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/basis/capabilities.html)、[安全规则](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide/database/security-rules.html)、[隐私指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)、[getPrivacySetting](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/privacy/wx.getPrivacySetting.html)。本票未访问后台或重新验证平台现状。

## 6. 验证与放行

先执行 README 本地命令，再按 [完整矩阵](public-release-acceptance.md) 在自己的隔离环境用真实身份A/B和至少两设备验证。记录失败，不能用 mock 勾选真实项。开发者工具最终编译代码包/预览另需授权和环境，本轮未执行；源码体积不是编译包体。

保存脱敏的版本化证据索引，原始云日志/身份/截图放受控位置而非仓库。第05票未解除前，第06票及父任务不完成；生产部署、提审、发布要另行明确授权。
