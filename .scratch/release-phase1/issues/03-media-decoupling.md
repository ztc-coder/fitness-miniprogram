<!-- DSH-IDEMPOTENCY-KEY: deck-plan-wayfinder-public-release-phase1-child-media-decouple -->
<!-- parentKey: 00 -->
<!-- created: 2026-10-20T06:40:24.335Z -->
# 媒体与代码解耦：占位素材与独立媒体包

## Question

怎么让公开仓库不含 Gym visual 媒体，同时部署者仍拿得到可用媒体？

## 已定形态

> **前提已由 #02 更正（2026-10-20）**：仓库里**本来就没有** Gym visual 媒体——`git ls-files images` 只有 20 个自制 tabBar 图标，真实动作图片/GIF 一直在运营者云存储，仓库只存 `exercises/images/…`、`exercises/videos/…` 路径字符串。所以本票不是「把已有媒体搬出去」，而是「保证它们不被放进来 + 没有媒体时仓库仍可编译可跑」。

仓库只放自有占位素材；真实媒体作为独立「媒体包」（或部署者自己的云存储）在部署时按 README 放入。代码侧媒体根路径必须可配置——`data/media-root.js` 已存在且当前硬编码运营者云桶，先审它现在怎么解析、以及硬编码属 #05 的替换项。

## 验收

- 干净 clone 后开发者工具可编译、`npm test` 可跑。
- 缺媒体时显示占位、不阻塞训练流程。
- README 写明媒体包获取方式与署名要求（Gym visual / 180×180）。
- 仓库 `git ls-files images/` 不再包含有版权风险的素材。

## 依赖

- 原被「根 LICENSE 与全量许可核对」阻塞，该票已于 2026-10-20 关闭：结论是仓库不分发 Gym visual 媒体，`LICENSE`(MIT) 与 `THIRD-PARTY.md` 已落地，媒体义务见其 §2.1。
- 本票因此**解阻**。仍须先读 `THIRD-PARTY.md` §2.1 的三项前置条件（书面授权 / 署名 / 180×180）再决定媒体包形态。

## 进度

- 2026-10-20 认领（ztc-coder），读全票、`data/media-root.js`、全部媒体消费点与既有降级链，再改。
- 事实核实：仓库**本来就没有** Gym visual 媒体。tracked 二进制只有 31 个 png + 1 个 wav + 1 个 py；`images/` 20 个全是 `images/tabbar/**`（含 4 张被 `project.config.json` 打包排除的 gen 源图）；`git ls-files` 里 jpg/jpeg/gif/webp/mp4 = 0。所以本票的重点从「把媒体搬出去」改成「守住不让它们进来 + 没有媒体也能编译能跑」。
- 媒体根已是单点配置：`data/media-root.js` 的 `MEDIA_ROOT`；`resolveAsset(path, root)` 只做拼接，`resolveMedia(path, root)` 在云服务未 ready 时直接返回空串，消费点各自降级。默认值仍指向运营者云桶——**替换属 #05，本票不改值**。
- 降级链已存在且有既有测试覆盖：详情 GIF → JPEG → 首字占位（`components/exercise-detail/exercise-detail.js:21-45` onMediaError 递增 stageIndex）；列表缩略图失败只清该行（`pages/library/library.js:159`）；今天页回 `↔`；计划日回缩略占位 + `© Gym visual` 署名。**本票未新增 UI 代码**，只补文档与守卫。
- 写文档：`README.md` 新增「## 动作媒体：仓库里没有，部署时怎么补」——三条部署路径（自有存储 / 自有素材同路径同 180×180 / 什么都不放）、媒体包与目录相对路径同构共 1,295×2=2,590 个对象且不入库、`© Gym visual — https://gymvisual.com/` 与 180×180 署名要求、指向 `THIRD-PARTY.md` §2.1 与部署指南第 4 节。
- 写文档：`docs/independent-deployment.md` §4 新增「媒体包布局与缺媒体表现」bullet；`THIRD-PARTY.md` §2.1 末行由「落地见 wayfinder 票」改成指向上述两份文档（票关了不能留死链）。
- 写守卫：新增 `tests/media-decoupling.test.js` 6 条——(1) tracked 文件无 jpg/jpeg/gif/webp/mp4/mov/m4v/avi；(2) `images/` 只允许 `images/tabbar/(gen/)?<name>.png`；(3) README 含该小节标题、`MEDIA_ROOT`、2,590、署名串、180×180；(4) 部署指南与 THIRD-PARTY 互指这套规则；(5) `.gitignore` 有 `exercises/` 与 `media-pack/`；(6) `app.json` 引用的 tabBar 图标与全部页面四件套都存在——这是「干净 clone 可编译」的静态前提，也是本票最容易踩的坑（把 tabBar 图标当媒体搬走）。无 `.git` 时（下载 zip 的部署者）自动回退为遍历目录并跳过 node_modules/coverage/.pi/exercises/media-pack。
- `.gitignore` 追加「第三方动作媒体与自建媒体包绝不入库」+ `exercises/` + `media-pack/`，避免误 `git add` 后再靠人工清理。
- 验证（本机实测，2026-10-20）：`npm test -- --runInBand --silent` → **44 套全过，637 passed / 29 skipped**（基线为 43 套 631 passed，新增 1 套 6 条）；`npm run check:package` exit 0（1,207.5 KiB / 94 文件，低于 2 MiB）；`npm run check:public-info` 仍 Blocked（operatorName / privacyContact / supportContact / verified 四项缺，属 #04，与本票无关）。
- 干净 clone 验证（不是 `git ls-files | tar` 那种会把脏改动带进来的假验证）：`git clone` HEAD(`1ab5c4a`) 到 /tmp → 41 套 588 passed；把本票 5 个改动文件叠进 clone → 42 套 593 passed；再删掉 clone 的 `.git` → 守卫测试仍 6 passed，回退路径生效。
- 未验证：微信开发者工具里的真实编译（本机无该 GUI 环境），只验证了「app.json 引用的图标与页面文件齐全」这一静态前提。
- 明确不在本票：`MEDIA_ROOT` 默认值与 `scripts/upload-exercise-media.js` 的 `ENV_ID` 都仍指向原运营者云环境，替换属 #05；不创建/不获取媒体包（需 Gym visual 书面授权，`THIRD-PARTY.md` §2.1 三项前置条件未满足前不落地）。

## Comments

### local — 2026-10-20T07:56:23.458Z

## 结论：媒体不入库的边界守住 + 缺媒体可编译可跑，本票可关闭

**本票实际要解决的问题比标题小**：仓库里从来没有 Gym visual 媒体（tracked 中零个 jpg/gif/webp/mp4，`images/` 只有自制 tabBar 图标），真实媒体一直在运营者云存储。所以要做的是把「不进来」变成可执行的守卫，而不用搬走任何东西。

**交付**：
1. `README.md` 新增「动作媒体：仓库里没有，部署时怎么补」：三条部署路径、媒体包形态（与目录相对路径同构、2,590 个对象、不入库）、署名与 180×180 要求。
2. `docs/independent-deployment.md` §4 与 `THIRD-PARTY.md` §2.1 同步指向同一套规则（不留「看 wayfinder 票」这种会失效的指针）。
3. `tests/media-decoupling.test.js` 6 条守卫：媒体文件不得被跟踪、`images/` 只允许 tabBar 图标、README 与两份文档文案、`.gitignore` 兜底、`app.json` 引用的图标与页面文件存在。没有 `.git` 时回退遍历目录，下载 zip 的部署者也能跑。
4. `.gitignore` 加 `exercises/`、`media-pack/`。

**验收对照**（票里的四条）：
- 干净 clone 可编译、`npm test` 可跑 → `git clone` HEAD 后 41 套 588 passed；叠加本票改动 42 套 593 passed。真实编译未验证（无 GUI），用「app.json 引用文件齐全」作为静态替代。
- 缺媒体显示占位、不阻塞训练 → 降级链本就存在且已被既有测试覆盖（详情 GIF→JPEG→首字、列表清行、今天 `↔`、计划日缩略占位），本票补了 README 说明；未改 UI 代码。
- README 写明媒体包获取方式与署名 → 已写（含 `© Gym visual — https://gymvisual.com/` 与 180×180）。
- `git ls-files images/` 无有版权风险的素材 → 是，且现在有测试守着，再加进来会红。

**留给后续**：`MEDIA_ROOT` 默认值与上传脚本的 `ENV_ID` 仍指原运营者云环境（#05）；媒体包本身需 Gym visual 书面授权后才能落地（`THIRD-PARTY.md` §2.1），本票关闭不等于已获授权。

## Answer

Status: resolved
Assignees: ztc-coder
Type: task
Blocked by: #02
Labels: wayfinder:task
