---
title: 共享动作详情弹层滚动与底部操作区
labels: [ready-for-human]
status: done
created: 2026-09-21
---

# 01: 共享动作详情弹层滚动与底部操作区

## What to build

调整 `components/exercise-detail/` 布局，使 `showPick=true` 时底部按钮独立占位，正文滚动到末尾后仍能完整看到动作要领、备注与署名；`showPick=false` 不保留按钮空白。

## Acceptance

- [x] 标题区、滚动正文和操作区边界明确，按钮不覆盖正文。（WXML 结构契约 + WXSS 样式契约覆盖，见验证记录；真机视觉见「人工验收」）
- [x] 安全区和窄屏下正文仍可滚动到底。（遮罩保留 `env(safe-area-inset-bottom)`；`has-actions` 卡片的确定高度、82vh 与安全区约束、正文区 `flex + height:0` 由样式契约锁定；真机滚动见「人工验收」）
- [x] 关闭、选择、媒体降级行为不变。（组件行为测试覆盖 close / pick / GIF→JPEG→glyph）
- [x] 增加可由 Jest 执行的组件结构/样式契约测试。（`tests/exercise-detail.test.js`，17 条）

## Verification

```bash
npx jest tests/exercise-detail.test.js --runInBand
node --check components/exercise-detail/exercise-detail.js
```

## 验证记录（2026-09-21，第二轮：reviewer P2 反馈后定稿）

改动文件（仅票 01 范围）：

| 文件 | 改动 |
|---|---|
| `components/exercise-detail/exercise-detail.wxml` | 卡片加 `has-actions` 状态类（`{{showPick ? 'has-actions' : ''}}`）；正文末尾新增仅在 `showPick=true` 时渲染的留白占位；补布局契约注释 |
| `components/exercise-detail/exercise-detail.wxss` | `.detail-card.has-actions { height: 82vh; max-height: calc(100vh - 72rpx - env(safe-area-inset-bottom)) }`；`.detail-card.has-actions .detail-scroll { flex: 1 1 0%; height: 0 }`；基础 `.detail-scroll` 为 `flex: 1 1 auto` + `min-height: 0`（不再有 `max-height`）；`.detail-actions` 去掉 `margin-top`，改为 `padding-top` + 顶部分隔线 + 卡片底色；新增 `.detail-tail-space` |
| `tests/exercise-detail.test.js` | 新增 17 条结构契约 + 样式契约 + 组件行为测试；文件头声明契约测试不替代真机验收 |

命令与结果：

```bash
npx jest tests/exercise-detail.test.js --runInBand   # 1 suite / 17 tests passed
node --check components/exercise-detail/exercise-detail.js   # 通过
npm test -- --runInBand                              # 9 suites / 162 tests passed
git diff --check                                     # 无空白错误
```

注：全量 162 条包含同工作区里票 02/03 的在途改动，不是票 01 单独贡献；票 01 只新增/维护 `tests/exercise-detail.test.js`。

变异验证（两轮均做过，确认测试不空转）：

- 第二轮：去掉 `.detail-card.has-actions` 确定高度、去掉 `.detail-card.has-actions .detail-scroll` 的 `height: 0`、给基础 `.detail-scroll` 重新加回 `max-height`、给基础 `.detail-card` 加固定 `height`、去掉 WXML 的 `has-actions` 类绑定 —— 五个变异分别只让对应契约测试失败，随后文件已逐字节还原。
- 第一轮：`.detail-scroll` 回退为 `flex: 1`、`.detail-actions` 回退为无边界写法、删掉末尾留白元素，同样分别失败。

修复依据：

1. 根因：卡片只有 `max-height: 82vh` 时正文区拿不到确定高度，内容溢出卡片，按钮落到正文尾部。
2. reviewer P2 指出第一轮方案（正文区 `max-height: 50vh` 当兜底）不成立：`max-height` 不是微信 `scroll-view` 要求的确定 `height`，契约测试会跟着假通过。
3. 定稿方案：只有 `showPick=true`（`.has-actions`）时给卡片确定高度（`height: 82vh`，再用 `max-height: calc(100vh - 72rpx - env(safe-area-inset-bottom))` 保证窄屏/带 home indicator 时仍在遮罩可视区内）；正文区在该状态下 `flex: 1 1 0%` + `height: 0`，吃满“卡片减标题区减操作区”的剩余高度，原生 `scroll-view` 因此拿到确定高度。
4. 只读态（`showPick=false`）不加固定高度、不设 `max-height`、不写 `height: 0`，保持内容自适应，既不出现固定大空白也不被过早截断。
5. 操作区始终是滚动区的兄弟节点（`flex-shrink: 0`、不定位、无负边距、带顶部分隔线），只在 `showPick=true` 时渲染。

未提交 git commit（由协调者统一处理）；未改动 `project.config.json`、其他票文件、README/spec。

## 人工验收（保持 ready-for-human）

- [ ] 微信开发者工具 / 真机：动作库详情（`showPick=true`）滚到底能看到最后一条要领、自重备注与 `© Gym visual` 署名，按钮不被安全区压住。
- [ ] 打卡页只读详情（`showPick=false`）：内容短时不留按钮空白，内容长时同样可滚到底。
- [ ] 视觉确认：`showPick=true` 内容较短时卡片仍为 82vh 的确定高度、按钮钉在卡片底部（这是为了给 `scroll-view` 确定高度而刻意取的做法）。若视觉上不接受这种固定高度的弹层，下一步应改为测量可用高度后在 JS 里给 `scroll-view` 写死 `height`（社区方案），本票不预先实现。
- 原因：Node/Jest 只能验证 WXML/WXSS 结构与样式契约，不能渲染真实 `scroll-view` 的滚动、安全区与窄屏表现；本票只锁定“给 `scroll-view` 确定高度”这一前提条件。
