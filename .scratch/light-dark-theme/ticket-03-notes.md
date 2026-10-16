# Ticket 03 实施与验证记录

状态：训练页代码及独立回归已实现；**相关旧测试有两处边界注入不兼容，按执行规则未提交，交集成者决定测试文件范围；原生待验，不关闭票。**

## 范围与基线

- 票03，独立 worktree 分支 `feat/light-dark-theme-03`。
- 初始工作区 clean、HEAD `088e49a413552ca1670655e38891668cc4116fa9`；已确认其为 integration `feat/light-dark-theme` 的祖先且当时二者相等。
- 已读 karpathy-guidelines、TDD SKILL 与 tests/mocking 附件、CONTEXT、关联 ADR、完整主题规格与票01/平台记录。
- 使用已授权的 Page 用户事件/生命周期、wx/存储/时间边界；不 mock domain/queue/db 内部模块。
- 收尾执行 `git merge feat/light-dark-theme` → Already up to date，integration tip 仍 `088e49a`。
- 仅修改 `pages/training/training.js/wxml/wxss`、新增 `tests/training-theme.test.js` 及本记录；共享动作详情只在模板传 theme，不修改组件实现、domain、queue 或快照。

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
6. `jest tests/training-flow.test.js --runInBand --coverage=false --silent` → **50 passed / 2 failed**。两处失败分别在 :536 和 :576（read 分支）的 `wx.getStorageSync.mockImplementationOnce`：现装饰器先读 `fitness:settings`，一次性异常被主题恢复边界接住，因此未注入到原测试想覆盖的 `fitness:trainingDraft`。不是草稿读取失败被业务吞掉；本票独立测试已经按 draft key 注入并验证同一公开行为正确。
   - 不为满足旧测试而修改共享装饰器或业务读取顺序。
   - 用户限定只维护本票独立测试，故没有越界改 `tests/training-flow.test.js`；需协调者授权修改或由集成者将两处异常按 key 注入（仅 draft key throw，其余返回 storage.get(key)），然后重跑。
   - 因相关验证仍有失败，遵循执行规则**不提交**，保留当前现场。未运行失败排除后声称全绿。
7. `git diff --check`、`node --check pages/training/training.js`、`node --check tests/training-theme.test.js` 通过。未运行生产构建或重复全量 catalog 缺源失败。

## 原生待验与平台限制

- 未访问主线独占模拟器，无本票原生截图/真机证据；不以 HTML 原型或静态 Jest 断言冒充视觉验收。
- 待协调者验：训练待练/当前/完成/跳过/禁用、输入焦点与占位、浅深双向往返与冷恢复、暂停 banner/保存失败、间歇展开/收起/运行/独立暂停/整场暂停/到时及调整按钮、预告媒体白底、完成小结双单位/对比、深色逐值视觉回归。
- 与02联合验收训练调用的动作详情与加练入口，组件外观不是本票产物。
- 原生 Modal/actionSheet 只覆盖可控文字色，底板/标题正文/取消项/蒙层由客户端控制；picker/键盘等亦见 platform-limits.md。不承诺手动主题重绘系统底板。
- issue 保持 open、原生验收不勾选。
