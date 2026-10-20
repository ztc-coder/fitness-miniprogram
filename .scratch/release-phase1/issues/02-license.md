<!-- DSH-IDEMPOTENCY-KEY: deck-plan-wayfinder-public-release-phase1-child-license -->
<!-- parentKey: 00 -->
<!-- created: 2026-10-20T06:40:24.320Z -->
# 根 LICENSE 与全量许可核对

## Question

根 `LICENSE` 缺失（`docs/public-release-acceptance.md:19` 记「无输出；根LICENSE缺失」）。MIT 已定，但**仓库里哪些东西不能随 MIT 代码一起分发**还没核过。

## 已知事实

- ~~`images/`（960K）：动作图片/GIF，版权归 Gym visual，须保留 `© Gym visual` 署名与 180×180 限制~~ **此条经核查不成立**：仓库内没有任何动作图片/GIF，`images/` 只有 20 个自制 tabBar 图标；真实媒体在云存储，仓库仅存路径字符串。更正依据见「进度」第 2 条。
- `data/`（852K）：从 `hasaneyldrm/exercises-dataset` 派生，文本 MIT，须保留署名；`catalog-snapshot.json` 等派生文件是否构成衍生作品需判断。
- `assets/audio`（20K）：来源待查。
- npm 依赖：`package.json` 需逐项确认许可与 MIT 分发兼容。

## 验收

根目录有 `LICENSE`（MIT）与 `THIRD-PARTY.md`（或 `NOTICE`）：逐类列出来源、许可、义务（署名/尺寸限制/是否可再分发）；明确哪些目录不进公开仓库——交给「媒体与代码解耦」票落地。

## 进度

- 2026-10-20 认领（ztc-coder），开始全量许可核对：npm 依赖 / data/ / images/ / assets/audio。
- **已知事实更正（重要）**：正文「`images/`（960K）：动作图片/GIF，版权归 Gym visual」**不成立**。实测 `git ls-files images` 只有 20 个文件，全是 tabBar 图标（`images/tabbar/*.png` 16 + `images/tabbar/gen/*.png` 4 源图，gen 被 `project.config.json` 打包排除）；`git ls-files | grep -Ei '\.(jpg|jpeg|gif)$'` 为 0 行。动作媒体**从来不在仓库里**，仓库只存 `exercises/images/…`、`exercises/videos/…` 路径字符串，真实媒体在 CloudBase 云存储。
- 图标来源核查：commit `cc8f322 chore(assets): 重新生成 tabBar 图标`，提交说明为「替换为 imgGen 新字形，81×81 RGBA」→ 本项目自制，无第三方字形库。
- `assets/audio/` 核查：`rest.wav` + `generate-rest.js`，数学正弦波合成，`assets/audio/README.md` 已声明 **CC0 1.0**，无外部采样。
- 字体核查：无任何字体文件，样式只用系统字体栈（`app.wxss` 等）。
- npm 核查：`package-lock.json` 564 个包**全部 `dev:true`，0 个生产依赖**，小程序不打包 node_modules；无 GPL/AGPL/SSPL。分布 MIT 471、ISC 48、BSD-3-Clause 19、Apache-2.0 14、BSD-2-Clause 5、(AFL-2.1 OR BSD-3-Clause) 1、(MIT OR CC0-1.0) 1、CC-BY-4.0 1、Unlicense 1、lockfile 未声明 3（`@cloudbase/signature-nodejs@1.1.0`/`2.0.0` 的 package.json 无 license 字段、上游现版本 Apache-2.0；`exit@0.1.2` 用旧式 `licenses:[{type:"MIT"}]`）。均 dev-only，不随源码分发。
- 上游许可实测（curl 直连 raw.githubusercontent.com；`web_fetch` 与 `web_search` 在本环境不可用）：
  - `hasaneyldrm/exercises-dataset`：MIT，`Copyright (c) 2026 Hasan Emir Yıldırım`，覆盖 code/tooling/dataset structure/instruction text/translations；另附 MEDIA EXCEPTION，明确 **不覆盖** images/videos（© Gym visual，须 180×180 + 署名）。
  - `wangmuerxiao/exercises-dataset-zh`（默认分支 `master`）：LICENSE 为同一份 MIT；README「License & 许可」明确中文动作名 `name_zh.json` 为新增内容、同样 MIT。
  - 数据原始来源：ExerciseDB v1 by AscendAPI，经 Kaggle 重分发；上游自述不主张底层内容所有权，媒体许可链仍冲突（ADR-0007）。
- 交付物：
  - 新增根 `LICENSE`：MIT 全文，版权行 `Copyright (c) 2026 ztc-coder`（与 git 唯一作者身份一致，维护者确认）。
  - 新增 `THIRD-PARTY.md`（约 6.1KB）：§1 随仓库分发内容（动作目录文本 / 中文动作名 / 自制素材 / 上游 MIT 全文逐字保留）；§2 不随仓库分发（Gym visual 媒体：不在仓库、180×180、署名、授权冲突、媒体包前置条件 / npm 依赖表 / 字体）；§3 可重跑复核命令；§4 待人力确认 3 条。
  - `README.md`：删掉「没有根 LICENSE，不能宣称源码开源许可」的过时结论，新增「## 许可」段指向 `LICENSE` 与 `THIRD-PARTY.md`。
  - `docs/independent-deployment.md` §4：改为「根 LICENSE 已存在（MIT）」并指向 THIRD-PARTY.md（原「未发现跟踪许可证」已失效）。
  - `docs/public-release-acceptance.md:19`：保留第05票基线 `4d645c9` 的历史观测，加注「后续已由根 LICENSE + THIRD-PARTY.md 补齐」。
- 验证：`npm test -- --runInBand --silent` → 43 套全部通过，631 passed / 29 skipped / 660；`npm run check:package` exit 0（1,207.5 KiB，94 文件，低于 2 MiB）；`npm run check:public-info` 仍 exit 1（第04票范围，预期阻断）。
- THIRD-PARTY.md §3 的复核命令逐条跑过，与文中数字一致（jpg/gif=0、tracked images=20、npm 564/564 dev、nameZh 1,318 keys、published 1,295、tabbar 16+4）。
- **未做/明确不在本票**：媒体解耦（占位素材与独立媒体包）交「媒体与代码解耦」票；Gym visual 书面授权仍需人力取得，不因本票关闭而视为已授权。

## Comments

### local — 2026-10-20T07:34:12.024Z
## 结论：MIT + 第三方义务已落地，本票可关闭

**交付**：根 `LICENSE`（MIT，`Copyright (c) 2026 ztc-coder`）+ `THIRD-PARTY.md`（逐类来源/许可/义务/可否再分发）+ README「许可」段 + 两份旧文档的失效表述修正。

**核心判断**：
1. 仓库**本来就没有** Gym visual 媒体，MIT 不涉媒体，媒体解耦票要做的是「别把它们放进来 + 给占位素材」，不是「搬走已有媒体」。
2. 随仓库分发且带第三方义务的只有 `data/` 里的动作目录文本与中文动作名，均为 MIT，义务是保留上游版权行与许可声明——已在 `THIRD-PARTY.md` §1.4 逐字保留。
3. 其余（npm 564 包全 dev、音频 CC0、图标自制、无字体）不产生分发义务。

**验证**：`npm test` 43 套全通过（631 passed / 29 skipped）；`check:package` exit 0；`check:public-info` 仍 exit 1（第04票范围）。

**留给后续**：Gym visual 书面授权仍需人力取得；媒体包分发前必须满足 `THIRD-PARTY.md` §2.1 的三项前提。


## Answer

Status: resolved
Assignees: ztc-coder
Type: task
Blocked by:
Labels: wayfinder:task
