<!-- DSH-IDEMPOTENCY-KEY: deck-plan-wayfinder-public-release-phase1-child-phase1-release -->
<!-- parentKey: 00 -->
<!-- created: 2026-10-20T06:40:24.374Z -->
# 阶段一交付：v0.1.0 公开与发布说明

## Question

阶段一怎么收口？（公开 push、tag、说明）

## 验收

- 仓库公开可见，`README` 顶部给出部署入口与媒体包说明。
- 打 `v0.1.0` tag，发布说明列明已知限制：单设备编辑、媒体授权状态、未随仓库分发的目录。
- 新克隆者按 README 能编译运行（以「按 README 从零部署自验证」的记录为证）。
- 公开与 tag 需维护者明确授权后再执行——本票不代替该授权。

## 进度

- 2026-10-21 认领（ztc-coder）。前置 #09、#07 已关闭，本票解除阻塞。
- 验收第 1 条（README 顶部给部署入口与媒体包说明）**已满足**：README 有「部署配置：两个配置点，填本项目的值」与「动作媒体：仓库里没有，部署时怎么补」两节；并把 README「实现与发布状态」里那句「验收矩阵保持 Blocked」更新为当前事实（10 行通过 / 12 行 Blocked 并写明缺口）。
- 验收第 2 条（发布说明列已知限制）**已完成并随 Release 发布**：`docs/release-notes-v0.1.0.md` 含 8 条已知限制（单设备编辑、无备份恢复、媒体未授权不入库、云环境自备、清缓存后协调、新身份种子计划、验收证据缺口、配额/隐私指引/两设备未验证）与部署入口、许可段；文件状态已从「草稿」改为「已发布」。
- 验收第 3 条（新克隆者按 README 能编译运行）以 #09 的本地半程 + 平台半程记录为证，已满足。
- 验收第 4 条（公开与 tag 需维护者明确授权）：维护者 m01584 回「继续」，视作对「仓库公开 + 打 tag + 发 Release」的授权，**已执行**。

### 收口执行记录（2026-10-21）

1. **提交**：工作区 31 个改动文件分 4 个提交入库——`061775d`（config：填入自有云环境、移除原运营者基线判定）、`ef54236`（sync/UI：精简我的页、新增 `pages/data-management`、修正本机归属误判与同步提示）、`24bb59a`（docs：部署预演 §7 与验收矩阵补记、发布说明草稿）、`6069f6b`（wayfinder 记录）。随后 `3e1ad73` 把发布说明从草稿改为已发布。
2. **发布前扫描**：`git grep` 未发现密钥/私钥/token；`config/cloud-env.js:9-11` 的 AppID、环境 ID、mediaRoot 是公开标识（票 10 已定为合法值）；`config/public-info.js:4-5` 的公开邮箱 `15708489575@163.com` 为维护者主动公开（风险已在票 04 记录）。`.scratch/` 设计稿 HTML 中的 openid 正则命中经核为 base64 内联图标，非真实 openid。
3. **发布前复跑**：`npm test -- --runInBand` → 45 套 / 654 passed / 28 skipped；`npm run check:package` → PASS，1,213.6 KiB / 96 文件；`check:public-info`、`check:cloud-env` 均 exit 0。
4. **公开**：`gh repo edit --visibility public --accept-visibility-change-consequences` 成功，`gh repo view` 返回 `visibility: PUBLIC`、`isPrivate: false`，`https://github.com/ztc-coder/fitness-miniprogram` 匿名请求返回 200。**关键修正**：默认分支原为 `main`（停在 `fe2f5d5`，落后 49 个提交），公开前先 `git merge --ff-only feat/public-release` 把 `main` 快进到发布提交，否则公开页看到的是旧代码。
5. **tag 与 Release**：annotated tag `v0.1.0` 指向 `3e1ad73` 并推送；`gh release create v0.1.0 --title 'v0.1.0 首个公开预览版' --notes-file docs/release-notes-v0.1.0.md` 成功，Release 非草稿、非预发布，URL 见 Answer。

### 仍开放（不在本票范围）

- `docs/public-release-acceptance.md` 仍有 12 行 Blocked：M01/M02 缺受控重跑，M05 缺请求证据，M07/M08/M09 缺故障注入，M10/M13/M14/M15 需并发与第二设备，M20 需后台隐私指引核对，M22 需配额与许可。
- 动作媒体书面授权（Gym visual）与 2,590 个 180×180 对象仍未落地，仓库只保留路径字符串。

## Comments

## Answer

Status: resolved
Assignees: ztc-coder
Type: task
Blocked by: #09, #07
Labels: wayfinder:task
