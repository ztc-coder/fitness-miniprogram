# 真实媒体白底验收修复

任务 ID：light-dark-theme-media-fix；独立 worktree / 并行 worktree 提交模式。

## 定性与边界

- 起点 `d33968f`，开始确认 clean 且该提交为 HEAD 祖先；分支 `feat/light-dark-theme-media-fix`。
- 已读取主线原生定向报告 `/Users/ztc/fitness-miniprogram/.pi/visual-tests/light-dark-native-targeted-20261016-1033/report.md` 及 `10-dark-detail.png`：真实 0001 GIF 已加载，但白底区域呈 mint 绿色，为 P2 验收偏差。
- 不是本次新增的 dark 回归：主题实施前基线 `088e49a` 的 `.detail-media` 已有 transparent + multiply；`d33968f` 沿用同值。原图托与 multiply 合成会染色。本次是兑现 spec「真实动作媒体保留原样／原白底」要求。
- **真实示意图、动作演示及其有媒体外图托，是“深色颜色保持不变”的明确例外**。除此以外深色 token、卡片、占位、按钮、几何均保持。

## 修改范围

- `pages/today/today.wxss`：`.exercise-image` 基础规则白底、normal；删除浅色重复覆盖。
- `pages/training/training.wxss`：`.ex-thumb-img`、`.preview-image` 同上。
- `pages/library/library.wxss`：`.library-art-image` 基础白底、normal；`.library-art-wrap.has-media` 双主题白底。
- `pages/plan-day/plan-day.wxss`：`.exercise-thumb image` 与 `.exercise-thumb.has-media` 双主题白底，normal。has-media 规则排在浅色通用图托之后，避免同优先级被覆盖。
- `components/exercise-detail/exercise-detail.wxss`：`.detail-media` 基础白底、normal；`.detail-art-wrap.has-media` 双主题白底。
- 图托 has-media 判据仍用现有公开模板：媒体存在时白底；最终失败 glyph 保留主题图托。today/training 图片占满原图托，不改容器与媒体尺寸。不改共享 `--thumb-gradient`、资源、alpha、filter、布局、字体、间距或边框宽；无产品 JS / 主题状态机制变更。
- `tests/theme-media-style.test.js`：单条聚焦公开 WXSS 契约，验证双主题共享白底 normal、有媒体外图托与占位分开、无冗余主题专属媒体覆盖。只是静态契约，不模拟通用 CSS 级联，也不等于原生渲染证据。
- `tests/theme.test.js`、`theme-plan-browsing.test.js`、`training-theme.test.js`：原浅色媒体 selector 改基础 selector；废止深色 multiply 旧预期，其余行为断言保留。
- 相关回归还发现 `tests/board1-today.test.js`、`board1-training.test.js` 三条静态媒体断言要求 multiply，与新验收契约冲突；仅更新为白底 normal 和描述，保留输入聚焦及其余行为断言。

## TDD 与验证

1. Red：只新增媒体样式测试，执行 `node /Users/ztc/fitness-miniprogram/node_modules/jest/bin/jest.js tests/theme-media-style.test.js --runInBand --coverage=false`，1 failed；today 基础图片只有 multiply、缺白底。日志 `/tmp/fitness-theme-media-fix-red.log`。
2. Green：最小 CSS 修改后相同测试 1 passed。测试不 mock 自有模块；沿用既有 Page 公开事件 / wx / 媒体加载边界回归。
3. 相关测试：`node /Users/ztc/fitness-miniprogram/node_modules/jest/bin/jest.js --runInBand --coverage=false --testPathPattern='(media|detail|theme|today|training|library|plan|exercise-selector|search-multiselect).*\.test\.js$' --json --outputFile=/tmp/fitness-theme-media-fix-related-jest.json` → **26 suites passed，391 passed / 4 skipped**。首轮两处 multiply 旧断言失败，按上述最小同步后通过；日志同名 `.log`。
4. 全量：`node /Users/ztc/fitness-miniprogram/node_modules/jest/bin/jest.js --runInBand --coverage=false --testNamePattern='^(?!.*生成器 buildCatalog 可用夹具目录跑通)' --json --outputFile=/tmp/fitness-theme-media-fix-jest.json` → **34 suites passed，497 passed / 30 skipped**。仅额外排除 catalog 已知缺源单项，catalog 其他 7 项和整个 suite 均执行；29 项为仓库既有 skip。日志 `/tmp/fitness-theme-media-fix-jest.log`。
5. 完成前 `git merge feat/light-dark-theme`：fast-forward 到 `b496af0`（仅集成主线文档更新，未编辑 acceptance / issues / 其他 notes）；祖先检查成功。合入后重跑全量结果同上。
6. `git diff --check` 与相关页面、组件、改动测试 `node --check` 均通过；diff 确认无产品 JS 修改，无布局属性修改。未安装依赖、未生产构建、未访问模拟器。

## 未验

未取得修复后的原生截图或真机证据，**不声称 native 已通过**。待主线统一原生复验：深浅真实 JPEG/GIF 白底不染色、有媒体外图托白底，GIF→JPEG→glyph 最终失败回到主题占位，以及其余深色区域/几何保持。静态与 Jest 通过不替代该视觉确认。
