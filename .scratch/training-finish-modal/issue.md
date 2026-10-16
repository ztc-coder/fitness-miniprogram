---
title: 结束训练因确认按钮文案超长而无反应
labels: [ready-for-human]
status: done
---

# 根因与复现

用户实测点击结束训练无反应。在微信模拟器当前 ready、7 组完成／3 组待练、canFinish=true 的页面复现 `onFinish`。使用临时 wx.showModal 包装捕获错误，成功分支强制取消以防意外提交，失败后立即恢复原接口。

实际错误：`showModal:fail confirmText length should not larger than 4 Chinese characters`。

原确认文案“保存并结束”有 5 个汉字，超出微信 API 上限；原 fail 回调仅解锁、resolve，没有页面反馈。页面锁、组数门禁与成绩校验均未阻止本次操作。

官方文档：https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showModal.html 。confirmText 与 cancelText 最多 4 个字符。

# 修复

- `pages/training/training.js`：确认文案改为“保存结束”（4 字），取消保持“继续记录”（4 字）。
- 弹窗失败时释放锁、显示错误和 toast；保留草稿，不提交，允许重试；卸载后不更新 UI。
- `tests/training-flow.test.js`：增加原生文案长度限制回归，以及失败提示／草稿不变／可重试回归。

# 验证

- Red：两项新增测试修复前均失败，分别捕获弹窗未打开与静默失败。
- Green：训练页专项 52 项通过；训练页、提交、首页新开 79 项定向通过。
- 全量 Jest + coverage：404 passed / 29 既有 skipped / 1 既有环境失败；唯一失败仍为目录测试缺少源 exercises.json 与 name_zh.json。
- JS 语法、git diff 空白检查通过。
- reviewer quick：APPROVE，无 P0–P2 findings，取消、卸载、确认后的草稿检查与提交保护保留。
- 开发者工具已刷新；复现期间未确认提交、未改变训练成绩或计划，临时探针随刷新清除。

本票 done 表示已定位原生错误、修复及回归通过；不表示修复后已在用户真实场次确认提交。为保护训练数据，没有执行真实结束／推进计划操作。未生产构建、未提交或发布。

后续用户已整体确认验收完成，并授权本轮提交推送 Git。代理没有代替用户执行真实场次提交，上述验证边界保持不变。