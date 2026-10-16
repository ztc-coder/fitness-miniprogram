# Ticket 03 实施与验证记录

状态：已集成并关闭。两处旧测试的草稿读取故障注入已按 key 适配，8 suites / 148 tests 通过；后续暂停、独立间歇、非空 deadline 跨主题、到时及小结原生补验见 [acceptance.md](acceptance.md)。下文保留实施阶段验证范围，真机未验。

## 范围与基线

- 票03，续作独立 worktree 分支 `feat/light-dark-theme-03-complete`。
- 初始工作区 clean、HEAD `088e49a413552ca1670655e38891668cc4116fa9`；建立续作分支后 cherry-pick harness 保存的 `40fb5a2` 为 `411a99f`，完整保留上一执行代理的产品改动、独立测试及记录。
- 已读 karpathy-guidelines、TDD SKILL 与 tests/mocking 附件、CONTEXT、关联 ADR、完整主题规格与票01/平台记录。
- 使用已授权的 Page 用户事件/生命周期、wx/存储/时间边界；不 mock domain/queue/db 内部模块。
- 续作收尾执行 `git merge feat/light-dark-theme` → Already up to date，最新 integration tip 为 `088e49a`。
- 产品改动仅涉及 `pages/training/training.js/wxml/wxss`，独立测试为 `tests/training-theme.test.js`；续作额外按明确授权适配 `tests/training-flow.test.js` 的两处存储边界 mock，并更新本记录。共享动作详情只在模板传 theme，不修改组件实现、domain、queue 或快照。

## 实现

- JS 复用 `Page(themePage({...}))`；原 onLoad/onShow/onHide 业务逐行不变，没有新 timer、主题订阅或业务写入。
- WXML 根节点增加 `theme-{{theme}}`；动作详情调用点显式传 theme。
- WXSS 共享色板覆盖训练、间歇和小结卡片/文字/输入/状态；当前行继承 F2F6E8/A7B68F；完成行 F7F8F4；勾选边框/反馈与进度亮绿。主按钮及间歇结束按钮局部用 action token，深色回退保持原值。
- 浅色 paused/error 使用参考最终 #FFF4DF/#805307，自有间歇遮罩用 overlay；elapsed/mini-time/stat-number 按参考最终 CSS 使用墨色，状态用深绿。没有更改几何、字号、间距和圆角。
- 训练缩略图、间歇预告真实媒体只在浅色加白底、normal 混合；深色 multiply 和原图托保留。无 filter/反相/资源修改。
- 动作菜单浅色 itemColor 炭黑；结束确认浅色 confirmColor 深绿/cancelColor 炭黑；深色参数不新增颜色字段。

## TDD 与实际验证

使用只读现有 Jest：`/Users/ztc/fitness-miniprogram/node_modules/.bin/jest`，未安装依赖。

1. 主题恢复薄片先 red（theme undefined），接入装饰器后 green。独立回归覆盖运行间歇、独立暂停间歇、整场暂停且间歇原独立暂停、整场暂停且原运行间歇；主题往返不改变成绩、稳定 set ID、paused/restEndsAt/剩余时间，不额外写入且只保留原业务一个 timer。
2. 原生菜单/结束确认薄片先 red（浅色 itemColor 缺失），添加浅色条件参数后 green；深色参数不变，取消确认不结束训练。
3. 模板/颜色契约薄片先 red（根主题类缺失），接入模板与局部色值后 green。静态契约不视作渲染证据。
4. 补充草稿按 key 读取失败阻塞写入/可显式重试，以及真实 Page 结束训练到小结后的双向切换；小结完成组数/动作数/时长/负重容量/上次对比、完成事实与队列不变，零 timer。
5. 针对性运行：`jest tests/training-theme.test.js tests/training-submission.test.js tests/training-media.test.js tests/training-records.test.js tests/board1-training.test.js tests/training-checklist-domain.test.js tests/theme.test.js --runInBand --coverage=false --silent` → **7 suites / 96 tests passed**（本票独立新增 9 tests）。
6. 续作先运行 `jest tests/training-flow.test.js --runInBand --coverage=false --silent -t '首次升级保存失败|reload read失败'` → **2 failed / 50 skipped（red）**。原 :536 与 :576 的 `wx.getStorageSync.mockImplementationOnce` 将一次异常注入给装饰器新增的 `fitness:settings` 读取，未触发测试想覆盖的 `fitness:trainingDraft` 故障。
   - 按本次授权仅将两处 mock 改为按 `DRAFT_KEY` 注入：其它 key 原样返回 `storage.get(key)`；第一次草稿读取时恢复默认 storage mock 后抛错，后续读取/显式重试正常恢复。保留原有全部断言及训练行为，不更改主题装饰器、业务逻辑或读取顺序。
   - 同一筛选命令重跑 → **2 passed / 50 skipped（green）**；原 reload 测试继续验证故障阻塞陈旧写入、显式重试采纳加练及后续保存恢复。
   - 完整指定回归：`jest tests/training-flow.test.js tests/training-theme.test.js tests/training-submission.test.js tests/training-media.test.js tests/training-records.test.js tests/board1-training.test.js tests/training-checklist-domain.test.js tests/theme.test.js --runInBand --coverage=false --silent` → **8 suites / 148 tests passed**。
7. `git diff --check`、`node --check pages/training/training.js`、`node --check tests/training-theme.test.js`、`node --check tests/training-flow.test.js` 通过。未安装依赖，未运行生产构建、模拟器或重复全量 catalog 缺源失败。

## 原生待验与平台限制

- 未访问主线独占模拟器，无本票原生截图/真机证据；不以 HTML 原型或静态 Jest 断言冒充视觉验收。
- 待协调者验：训练待练/当前/完成/跳过/禁用、输入焦点与占位、浅深双向往返与冷恢复、暂停 banner/保存失败、间歇展开/收起/运行/独立暂停/整场暂停/到时及调整按钮、预告媒体白底、完成小结双单位/对比、深色逐值视觉回归。
- 与02联合验收训练调用的动作详情与加练入口，组件外观不是本票产物。
- 原生 Modal/actionSheet 只覆盖可控文字色，底板/标题正文/取消项/蒙层由客户端控制；picker/键盘等亦见 platform-limits.md。不承诺手动主题重绘系统底板。
- issue 保持 open、原生验收不勾选。
