---
title: 动作详情弹层锁定背景滚动
labels: [ready-for-agent]
status: done
created: 2026-09-18
---

# 动作详情弹层锁定背景滚动

## Problem

动作库或打卡页打开 `exercise-detail` 后，手指在详情弹层内移动时，遮罩下的调用页面仍会滚动。

## Scope

仅修改 `components/exercise-detail/` 的遮罩触摸事件处理；详情卡片内的 `scroll-view` 必须仍可滚动。不得改调用页、动作库检索或媒体降级链。

## Acceptance

- [x] 详情弹层显示时，遮罩下页面不响应触摸滚动。（`detail-mask` 加 `catchtouchmove="noop"` 阻断冒泡）
- [x] 详情卡片正文的 `scroll-view` 保持纵向滚动。（catch 只阻止向页面冒泡，不影响 scroll-view 原生滚动）
- [x] 点击遮罩仍关闭；点击卡片内部不关闭。（`bindtap="onClose"` 与 `catchtap="noop"` 未动）
- [x] 不影响动作库和打卡页复用。（纯组件内部事件处理，调用方零改动）
