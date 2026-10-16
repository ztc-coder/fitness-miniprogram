# Ticket 02 实施与验证记录

状态：页面和组件适配、既有测试兼容修复及相关回归已完成并提交；票保持 open，原生验收待主线，不关闭票。

## 分支与范围

- 独立 worktree：`feat/light-dark-theme-02-complete`；起点 `088e49a`。恢复前代理保存分支 `pi-agent-c90dc4fe-5bcc-497` 的 tip `0ede8f710dd9804b78ded15110ad6e71dac1a1ad`（cherry-pick 为 `4617814`），完整保留产品改动、独立测试及记录。
- 开始确认工作区 clean，`git merge-base --is-ancestor 088e49a HEAD` 成功；HEAD 与 integration 一致，无需重置或对齐。
- 完成前 `git merge feat/light-dark-theme` → Already up to date（tip `088e49a`）。
- 修改范围：`pages/plan`、`pages/plan-day`、`pages/library`、`components/exercise-detail`、独立 `tests/theme-plan-browsing.test.js`、获授权的两份既有测试与本记录。未修改共享样式/工具、training、records。

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

## 既有测试兼容修复与最终回归

已获授权仅适配既有测试，不改生产共享主题或移除主题生命周期。

- Red：运行 `tests/board1-library.test.js tests/library-paging.test.js --runInBand --coverage=false`，稳定复现 **2 suites failed，3 failed / 12 passed**。board1 两项缺少 wx 平台边界；paging 一项把主题 onLoad 的 setData 计入分页业务调用总数（期待 2，实际 3）。
- `tests/board1-library.test.js`：补最小 `wx.getStorageSync` 空存储 fixture；afterEach 同时清理 `global.Page` 与 `global.wx`，原行为断言不变。
- `tests/library-paging.test.js`：记录 onReachBottom 前调用数，仅检查事件提交增量为 1；断言 patch 只含窗口字段、完整前 48 条匹配项及总数，保留无重复、首屏前缀、筛选重置和详情行为断言，不因主题生命周期误报。
- Green：相同两文件 **2 suites passed，15 passed**。
- 最终命令：`node /Users/ztc/fitness-miniprogram/node_modules/jest/bin/jest.js --runInBand --coverage=false --testPathPattern='(library|plan|exercise-detail|exercise-selector|search-multiselect).*\.test\.js$'`。
- 最终结果：**11 suites passed，175 passed / 3 skipped**，覆盖所有 library、plan、exercise-detail、新 theme-plan-browsing 及直接相关选择器回归。
- 完成前再次 `git merge feat/light-dark-theme`，Already up to date（tip `088e49a`）。相关 JS `node --check` 与 `git diff --check` 通过。未构建、未访问模拟器、未运行无关全套测试；使用现有 Jest，未安装依赖。

## 原生待验（不关闭票）

未访问模拟器（主线独占），未取得原生截图或真机证据。需主线补验：

- 浅/深计划列表、当前轨道、编辑完成、空状态、新建/删除提示。
- 训练日目标编辑、排序、删除、动作库加入后返回及游标不变。
- 搜索、七类/器械多选、清空、无结果、首屏/追加页和返回保留。
- 普通浏览 picker 多计划/训练日、遮罩/关闭/保存；详情有加入和只读两模式，长要领滚动、署名、GIF→JPEG→占位降级。
- 浅色真实媒体白底且不染色、深色逐值视觉回归、底部安全区。
- 原生 modal 仅文字色可控，其底板/遮罩与系统组合依平台限制；不替换控件。
- training 调用显式传 theme 属票03，本票默认 dark 兼容未接入调用方，不宣称其他流程详情已完成验收。
