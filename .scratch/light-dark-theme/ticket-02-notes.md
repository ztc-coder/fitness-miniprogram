# Ticket 02 实施与验证记录

状态：页面和组件适配已落地；本票回归通过。**旧测试兼容性与原生验收待协调者处理，不关闭票，暂未提交。**

## 分支与范围

- 独立 worktree：`feat/light-dark-theme-02`；起点 `088e49a`。
- 开始确认工作区 clean，`git merge-base --is-ancestor 088e49a HEAD` 成功；HEAD 与 integration 一致，无需重置或对齐。
- 完成前 `git merge feat/light-dark-theme` → Already up to date（tip `088e49a`）。
- 仅修改 `pages/plan`、`pages/plan-day`、`pages/library`、`components/exercise-detail`、独立 `tests/theme-plan-browsing.test.js` 与本记录。未修改共享样式/工具、training、records 或既有测试。

## 逐文件实现

- 三页 JS：使用 `Page(themePage({...}))`，保留原生命周期与业务事件；计划与目标编辑 modal 浅色仅加确认/取消文字色，删除保留原红色，深色参数不变。
- 三页 WXML：根 `theme-{{theme}}`；library 调用显式传 `theme`。真实媒体图托按媒体是否存在加类，与加载失败占位分开。
- plan WXSS：当前循环、当前行、当前计划及状态徽标用浅绿/深绿；NEXT、图标、危险底色和边框移除浅色下的深色专属字面量；局部 important 主按钮及完成编辑使用 action 语义。原深色字面量作为回退保留。
- plan-day WXSS：主按钮 action 语义；真实示意图白底且 normal 混色，图托/占位区分；危险删除底色、边框及占位图标浅色适配。
- library WXSS：筛选和 picker 选中计划使用 signal-soft/signal-line/signal；picker 遮罩和阴影适配；真实示意图及图托白底、normal；深色 multiply 保留。
- exercise-detail：保留组件隔离，公开 theme 属性默认 dark；根主题类、自行 import 共享色板。遮罩用 overlay 原值回退，局部 important 主按钮 action 语义；真实 GIF/JPEG 与占位分开，浅色白底 normal，深色原样。媒体降级、署名及正文/操作布局未改。
- 色值依据 refined-c 的最终共享色板（未出稿页使用同套语义）；没有修改布局、字体字号、间距、圆角或业务逻辑。

## TDD 与实际验证

授权 seams：Page 生命周期/用户事件、wx/存储；组件公开属性与模板/CSS接入契约。未 mock 内部 db/domain/library。静态契约不冒充渲染证据。

逐片 red→green：library 主题恢复（undefined→light）、计划/训练日往返、原生提示文字色、隔离组件公开属性与主题传递、important 主按钮、浅绿选中状态、真实媒体白底、遮罩及深色字面量回退。另加既有编辑/加入行为的跨主题特征回归。

- 命令：`node /Users/ztc/fitness-miniprogram/node_modules/jest/bin/jest.js tests/theme-plan-browsing.test.js tests/board2-plan.test.js tests/board2-plan-day.test.js tests/exercise-detail.test.js tests/exercise-selector-ui.test.js tests/library-{multiselect,quick-add}.test.js tests/search-multiselect.test.js tests/exercise-selector.test.js --runInBand --coverage=false --silent`
- 结果：**9 suites passed，160 passed / 3 skipped**；其中本票新增 9 tests。
- 覆盖筛选及分页返回不重置、已打开详情保留、编辑状态与导航参数、目标/动作存储和游标保持；编辑 4×8×60、加入自重动作默认 3×10×0 后返回读取一致。
- `node --check`：三页、library-paging、组件和本票测试通过；`git diff --check` 通过。
- 未安装依赖、未跑生产构建、未重复全套 Jest 的 catalog 缺源已知失败。

## 未决旧测试兼容性（提交阻塞，未越界修改）

另运行本票+既有计划/动作库/详情 9 suites 时：7 passed / 2 failed，109 passed / 3 failed。

1. `tests/board1-library.test.js` 两项：`ReferenceError: wx is not defined`，该旧 Page 测试未提供 wx；接入装饰器后 onLoad 必须访问平台 API。
2. `tests/library-paging.test.js` 一项：`setDataCalls` 期待总长 2，实为 3；新增的一次是 onLoad 的 `{theme:'dark'}`，并非重复筛选/分页提交。

这两文件不属于用户授权的“本票独立测试”，未修改。候选方案：协调者授权最小调整测试夹具（补 wx 平台边界；只比较 onReachBottom 前后增量/业务数据提交，而非整个生命周期调用总数），或由协调者集成时另行调整。不得为通过测试取消主题生命周期或在生产逻辑中规避平台调用。遵守验证失败不提交约定，当前变更保留未提交，commit SHA 尚无；待上述范围许可后重跑并提交 Conventional Commit。

## 原生待验（不关闭票）

未访问模拟器（主线独占），未取得原生截图或真机证据。需主线补验：

- 浅/深计划列表、当前轨道、编辑完成、空状态、新建/删除提示。
- 训练日目标编辑、排序、删除、动作库加入后返回及游标不变。
- 搜索、七类/器械多选、清空、无结果、首屏/追加页和返回保留。
- 普通浏览 picker 多计划/训练日、遮罩/关闭/保存；详情有加入和只读两模式，长要领滚动、署名、GIF→JPEG→占位降级。
- 浅色真实媒体白底且不染色、深色逐值视觉回归、底部安全区。
- 原生 modal 仅文字色可控，其底板/遮罩与系统组合依平台限制；不替换控件。
- training 调用显式传 theme 属票03，本票默认 dark 兼容未接入调用方，不宣称其他流程详情已完成验收。
