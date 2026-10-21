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
- 验收第 1 条（README 顶部给部署入口与媒体包说明）**已满足**：README 有「部署配置：两个配置点，填本项目的值」与「动作媒体：仓库里没有，部署时怎么补」两节；顺带把 README「实现与发布状态」里那句「验收矩阵保持 Blocked」更新为当前事实（10 行通过 / 12 行 Blocked 并写明缺口）。
- 验收第 2 条（发布说明列已知限制）**已起草**：`docs/release-notes-v0.1.0.md`，含 8 条已知限制（单设备编辑、无备份恢复、媒体未授权不入库、云环境自备、清缓存后协调、新身份种子计划、验收证据缺口、配额/隐私指引/两设备未验证）与部署入口、许可段。**未打 tag、未推送**。
- 验收第 3 条（新克隆者按 README 能编译运行）以 #09 的本地半程 + 平台半程记录为证，已满足。
- 验收第 4 条（公开与 tag 需维护者明确授权）：**未执行**，等授权。授权后执行：`git tag v0.1.0 && git push origin v0.1.0`，并用本文件正文作为 GitHub Release 说明。
- 本票保持 open：差「公开可见 + tag + Release 发布」三件需要授权的事；另注意工作区当前有大量未提交改动（#05/#10 等），打 tag 前应先提交并复跑全量检查。

## Comments

## Answer

Status: claimed
Assignees: ztc-coder
Type: task
Blocked by: #09, #07
Labels: wayfinder:task
