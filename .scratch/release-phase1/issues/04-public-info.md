<!-- DSH-IDEMPOTENCY-KEY: deck-plan-wayfinder-public-release-phase1-child-public-info -->
<!-- parentKey: 00 -->
<!-- created: 2026-10-20T06:40:24.348Z -->
# 填入真实运营者资料并让公开资料校验转绿

## Question

`config/public-info.js` 的 `operatorName`、`privacyContact{label,value}`、`supportContact{label,value}` 全为空且 `verified:false`，`npm run check:public-info` 因此预期 exit 1（`docs/public-release-acceptance.md:94`、`issues/01:53`）。维护者称真实资料与平台材料均已就绪。

## 动作

填入真实值、置 `verified: true`，跑 `check:public-info` 至退出 0。`antiResurrection` 那段披露文案已写好，不要改写。

## 验收

- `npm run check:public-info` 退出 0。
- 隐私页与帮助页展示的联系方式与配置一致。
- 不填示例、不填未获授权的私人联系方式。

## 注意

HITL：具体取值需维护者提供，agent 不代填。

## 进度

<!-- 做到哪一步了，在这里一行一行记 -->


## Comments


## Answer

Status: open
Type: task
Blocked by:
Labels: wayfinder:task
