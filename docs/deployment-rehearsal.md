# 部署预演记录（第09票，2026-10-21）

**结论先行**：在干净目录按 README 把「本地半程」实际跑了一遍（clone → 装依赖 → 测试 → 三项本地检查 → 填入配置 → 复跑），撞到 2 处卡点并已修掉；**平台半程（云环境、云函数上传、集合权限、开发者工具编译预览、媒体包、真机）本轮没有账号与 GUI，一条都没执行**。所以这份记录**不构成「按 README 能从零部署成功」的结论**，只记已验证的事实、修掉的卡点，以及仍缺的平台动作。

## 1. 环境与做法

- 日期：2026-10-21（Asia/Shanghai）
- 机器：macOS；node v22.22.3；npm 10.9.8
- 源码：commit `38a7b4f`，干净 clone 到 `/tmp/wf-deploy-09`
- 做法：所有操作只在 clone 里做，不碰工作区；「未配置」（干净 clone 默认）与「已填配置」两种状态各跑一遍；结论一律以命令实际退出码与输出为准，不以「看起来能跑」判断。
- 已知局限：仓库尚未公开，克隆走本地路径而非远程 HTTPS；没有微信开发者工具 GUI、没有真实云账号，平台侧无法自动化。

## 2. 逐步结果（干净 clone，未填任何配置）

| 步骤 | 命令 | 结果 |
|---|---|---|
| 克隆 | `git clone <本仓库> /tmp/wf-deploy-09` | ✅ exit 0 |
| 装依赖 | `npm ci --no-audit --no-fund` | ✅ exit 0，564 packages，3.8s，不需要任何额外配置 |
| JS 语法 | 对 `git ls-files '*.js'`（101 个）逐个 `node --check` | ✅ 101/101 通过 |
| JSON | 逐个 `JSON.parse` | ✅ 全部可解析 |
| 测试 | `npm test -- --runInBand --silent` | ✅ 43 套全过，611 passed / 28 skipped / 639 |
| 包体预算 | `npm run check:package` | ✅ exit 0，1,196.9 KiB / 90 文件（data 828.5、pages 217.1、utils 86.4 KiB） |
| 公开资料检查 | `npm run check:public-info` | ✅ exit 0 |
| 部署配置检查 | `npm run check:cloud-env` | ⛔ exit 1（**预期**）：未配置自己的云开发环境 ID，按设计「发布阻断」 |
| 云函数依赖 | 在 `cloudfunctions/{login,personalData}` 副本里实装 + `npm view` | ✅ `wx-server-sdk@~2.6.3` 解析为 2.6.3（上游最新 4.0.2）；两个函数各自装出约 80 MB `node_modules`；该目录被 `.gitignore` 命中，不随仓库分发 |

补充：工作区本地跑是 45 套 / 654 passed，干净 clone 是 43 套 / 611 passed——差的 2 套是本会话之外他人正在写的未提交测试（`sync-feedback-fix`、`ui-simplification`），与克隆无关，克隆里本来就不该有。

## 3. 填入配置后再跑（模拟部署者按 README 填值）

在 clone 里把三项填成假值（`wx0123456789abcdef` / `rehearsal-env-2026` / `cloud://rehearsal-env-2026.636c-rehearsal-1234567890`）后：

- `npm run check:cloud-env` → ✅ exit 0，输出「部署配置检查通过；仍需在控制台核对环境归属、权限与配额」；
- `data/media-root.js` 的 `MEDIA_ROOT` 正确派生为所填桶根；
- `scripts/upload-exercise-media.js` 不再被 `envId` 拦住，一直走到「未找到媒体源目录」；
- `npm test` → ✅ 43 套全绿——**这是修掉下面卡点 B 之后的结果，修之前有 4 条红**；
- 只填 `project.config.json` 的 `appid`、`DEPLOY.appId` 留空（文档说的主路径）→ ✅ exit 0，与「`appId` 可选、以工程配置为准」一致；
- 两处 appid 写成不一致的值 → ⛔ exit 1，明细行准确：「appId：config/cloud-env.js 与 project.config.json 的 appid 不一致」。唯一瑕疵是这行明细的标题仍印「部署配置未填写自己的值」，属文案措辞问题，不阻塞使用。

注意：`check:cloud-env` 通过只代表本地配置形状齐了，不代表云环境存在或可用；用假值也能变绿，正说明它不能替代控制台核对。

## 4. 本轮撞到并修掉的卡点

**卡点 A：配置没有可填的地方。**
`config/cloud-env.js` 原来只读 `process.env.*`，而小程序运行时根本没有 `process.env`——部署者照着「替换位置」打开文件，看到的只是 `env.FITNESS_CLOUD_ENV_ID || ''`，不知道往哪写。
→ 改为文件顶部三个字面量 `const DEPLOY = { appId: '', envId: '', mediaRoot: '' }`，运行时优先取环境变量、未设置时回落字面量；注释写明「改这三行，不要设环境变量」。README 与部署指南的替换位置都指向这三行。

**卡点 B：填了字面量之后 `npm test` 变红。**
`tests/cloud-env.test.js` 用「删除环境变量」模拟未配置；删除后配置回落到新字面量，「未配置」夹具失效，describe「未配置自己的云环境时禁用云能力」下 4 条失败。也就是说：部署者按 README 填完配置再跑测试，必然看到红。
→ 配置改为「环境变量显式设为空字符串 = 明确未配置，完全未设置时才回落字面量」；测试夹具改成置空而非删除。两种仓库状态（字面量全空 / 已填值）实测都是 43 套全绿。

**其它观察（未改代码，只记录）**

- `project.config.json` 的 `appid` 为空时，微信开发者工具导入会怎样，本轮**未实测**（无 GUI）。若工具拒绝导入或进入游客模式，按工具提示填入自己的 AppID，然后确认与 `config/cloud-env.js` 的 `appId` 一致并重跑 `check:cloud-env`。
- 私有配置不会被仓库里的别人的设置压住：`git ls-files` 里只有 `project.config.json`（311 个跟踪文件中的一个），`project.private.config.json` 被 `.gitignore` 忽略、不在仓库里。开发者工具会为你生成自己的私有配置（基础库版本、本地设置），照常用即可，别反向提交回仓库。
- 没有媒体也能跑：干净 clone 的测试与检查全绿，完全不依赖 `exercises/` 或 `media-pack/`（两者都在 `.gitignore` 里）。

## 5. 仍缺的平台动作（需要你的账号与 GUI，本轮一条都没做）

| 动作 | 为什么本轮做不了 | 完成判据 |
|---|---|---|
| 建独立 CloudBase 测试环境 | 需要你的主体账号与计费/权限 | 环境 ID、区域、绑定 AppID、计费主体有截图记录 |
| 开发者工具导入 + 编译预览 + 代码依赖分析 | 无 GUI | 能编译、能预览，代码依赖分析包体在限制内 |
| 上传 `login`、`personalData` 两个云函数（云端安装依赖） | 无云账号 | 云端包与依赖解析版本、Node 运行时、部署版本与源码 SHA 一致 |
| 建 `plans`/`sessions`/`personalDataMeta` 三集合并应用 `client-permissions.json`（`{"read": false, "write": false}`） | 无云账号 | 三集合规则截图；客户端直读被拒、RPC 正常 |
| 按真实查询报错建索引 | 需要真实错误 | 索引定义截图；报错消失且未放宽 owner 条件 |
| 媒体包：先拿 Gym visual 书面授权，再按同构路径上传 2,590 个 180×180 对象 | 授权未落地 | 授权文件 + 对象数与路径核对；**不做也能跑，媒体降级为占位** |
| 配额/告警与费用主体 | 需要后台 | 各项额度与告警收件人截图 |
| 后台《用户隐私保护指引》与真实渠道核对 | 需要后台 | 见 [隐私清单](public-privacy-checklist.md) 第 20 条 |
| 双身份 A/B + 两设备真机 | 需要真实微信与设备 | 见 [验收矩阵](public-release-acceptance.md) |

## 6. 复跑命令

```bash
git clone <本仓库> /tmp/wf-deploy-09 && cd /tmp/wf-deploy-09
npm ci --no-audit --no-fund
npm test -- --runInBand --silent      # 43 套，611 passed
npm run check:package                 # exit 0，1,196.9 KiB / 90 文件
npm run check:public-info             # exit 0
npm run check:cloud-env               # 未填配置时预期 exit 1
# 填好 config/cloud-env.js 顶部三行后再跑一次：
npm test -- --runInBand --silent      # 仍应 43 套全绿
npm run check:cloud-env               # 应 exit 0
```

本轮没有执行任何云端写操作：没有创建环境、没有上传云函数或媒体、没有改集合规则、没有部署、没有推送。操作步骤仍以[独立部署指南](independent-deployment.md)为准。
