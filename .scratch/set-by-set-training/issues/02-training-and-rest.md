---
title: 训练页逐组交互、间歇计时与提醒
labels: [ready-for-agent]
status: done
created: 2026-10-14
---

已实施并完成自动化收尾验证；训练页接入 01 逐组领域契约及 03 真实本地完成接口。依据 [spec](../spec.md) §2–§5。真机、实际 WXML 与静音等验收仍由 04 执行，本票 done 不代表整体验收完成。

## 修改范围

- `pages/training/training.{js,wxml,wxss}`：当前组手动开始/完成、真实进度、撤销、跳过剩余、已完成组编辑保护与整场门禁。
- 默认 90 秒；增减、暂停/继续、跳过；采用时间戳而非累减回调。
- 前台到时声音/短振动/页面提示；一次性提醒；本地音频许可与离线可用性可追溯。
- 页面隐藏与重进校准、主动暂停冻结、草稿持久化与资源清理。
- 训练页提交入口由本票维护；复用 03 的数据契约/用例，完成仅本地成立时推进一次，调整小结文案。

## 验收

- Spec A01–A10、A13–A16、A19–A21 的页面 harness 用例。
- 组训练、间歇、待整场确认明显区分；没有多个可操作当前组。
- 所有新增编辑即时离线保存，暂停/隐藏/重启不自动打卡。
- 声音/振动 API 在实现前查微信官方资料，真机测试见 04；失败仅降级，不阻塞下一组。

## 边界

不做后台准时通知或音频保活，不复制外部 App 资产。样式与现有变量/组件一致；未取得设计图和稳定 URL 前不声明视觉代理验收通过。

## 实施与收尾验证

- 恢复上一轮 `023cb48` 的训练页 JS/WXML/WXSS、Page 事件/生命周期测试与自主合成 CC0 提示音；起点为集成 tip `e559a01`，未修改 domain/db/queue 或其他页面。
- 当前组显式开始/完成、真实进度、编辑/撤销/跳过保护、持久化错误恢复、时间戳间歇与暂停冻结、一次性提醒及资源清理已由 Page harness 覆盖。整场完成使用真实 `queue.complete/getCompletedSession`，同步锁覆盖编辑和生命周期；本地固定小结先展示，历史比较异步更新。
- 收尾先重现失败：指定七套 Jest 的 JSON 为 `success:false`，143 passed / 25 skipped / 1 failed。核对公开契约后，仅将本测试全部加练 fixture 的 `id/nameZh` 改为 `exerciseId/name`，并按既有 `formatDuration` 四舍五入口径将 90 秒小结期望改为 `2m`；未改实现掩盖错误。
- 合并检查：`git merge feat/set-by-set-training` 返回 Already up to date，集成 tip 仍为 `e559a01`；之后再次执行下列回归命令。

```bash
npx jest tests/training-flow.test.js tests/training-media.test.js tests/training-submission.test.js tests/training-records.test.js tests/domain.test.js tests/db.test.js tests/library-quick-add.test.js --runInBand --json --outputFile=/tmp/set-by-set-training-02-finalize-tests.json
```

实际读取 JSON：`success:true`，7 suites passed，144 passed / 25 skipped / 0 failed（共 169）。日志重定向至 `/tmp/set-by-set-training-02-finalize.log`；不以工具摘要代替 JSON。

- `node --check`：`pages/training/training.js`、`tests/training-flow.test.js`、`assets/audio/generate-rest.js` 均通过；`git diff --check` 和相对 `e559a01` 的 diff 检查通过。
- Python `wave` 成功读取 `rest.wav`：16 kHz、mono、16-bit PCM、4,800 帧（0.3 秒）。无依赖运行生成脚本后字节完全一致，SHA-256：`599a36a005074c2f62d2e635cde241fde89e8344437fb9566db6daa5f5608fc1`；音频资源未变更。
- 未运行生产构建或 push。25 skipped 不视为通过；微信 iOS/Android 离线音频路径、实际静音/振动、锁屏/后台/杀进程恢复、真实 WXML/键盘/触控与视觉验收无设备证据，交 04 补测。不保证后台准时提醒，未宣称整体验收完成。