# 实施约定与记录

状态：四票实施、可运行自动回归、双轴审查与指定模拟器验收完成，四票已按本地 tracker 标记 `status: done`。证据与边界见 [acceptance.md](./acceptance.md)、[review.md](./review.md)。

- 集成分支：`feat/light-dark-theme`。
- 产品基线：`ab4826f`，来自当前 `feat/set-by-set-training`，后续审查比较 `git diff ab4826f...HEAD`。
- 规格：`spec.md`；依赖图：`01 → [02, 03, 04]`。
- 本地 issue tracker：四票已关闭；真机、系统控件和未穷举边界独立记录，不冒充已验证。
- 冻结浅色参考：`.scratch/huashu-color-only-v2/refined-c/`；深色以产品基线实际色值为准。

## 共享接入约定

01 建立 `utils/theme.js`，提供 `getTheme()`、`setTheme(next)`、`applyTheme(page)`、`themePage(definition)`。主题值为 `dark` / `light`，保存在已有 `fitness:settings` 的 `theme` 字段，合并写入，不覆盖已有设置。无记录或非法值回退深色；写失败不发布成功切换。

页面使用 `Page(themePage({...}))`。装饰器在 `onLoad` 和 `onShow` 获取当前偏好、更新 `data.theme` 与原生栏，保留原钩子的参数、this、返回值与单次调用；不包裹全局 Page，不订阅业务事件，不调用额外业务 refresh，不累积监听器。

各页面根 view 增加 `theme-{{theme}}`。共享主题色放在 `styles/theme.wxss` 的 `.theme-light` 中，通过 `app.wxss` 引入。保留原有深色变量与字面量值；按语义区分深绿状态、炭黑主按钮、亮绿反馈/进度，避免一个强调色同时承担三种角色。页面局部深色字面量改成带原值的变量，浅色只覆盖所需颜色。不得改动几何、字体与业务交互。

自定义组件保留隔离，显式传递 `theme="{{theme}}"`，组件自行引入共享主题并在根节点加主题类。共享动作详情归 02 维护，03 只在调用点传主题。

后续票可在各自页面中声明语义变量的深色原值，并在 `.theme-light` 下覆盖浅色。若必须修改共享主题文件，先在本票说明；优先页面局部变量，减少并行冲突。

## 分工

- 01：共享主题、app、今天、我的、浅色 tabBar 图标、主题公开行为回归。
- 02：计划、训练日编辑、动作库、共享动作详情；不修改 03/04 页面。
- 03：训练、间歇、完成小结；不修改共享动作详情实现。
- 04：记录、历史详情；不修改 02/03 页面。

## 测试与验收边界

沿用 `CONTEXT.md` 已定义的测试边界：Page 用户事件/生命周期、公开记录/队列接口、domain 公开函数，仅 mock wx、存储、时间与云端边界。TDD 逐个场景 red → green。主题测试覆盖默认深色、双向切换、持久化恢复、生命周期原样执行、往返恢复状态和业务存储不变；现有业务回归验证训练事实和统计口径。

运行项目 Jest；不存在额外 lint/typecheck 脚本。不运行生产构建。原生模拟器与真机验证分开记录，不以原型或 Jest 代替原生外观证据。已完成原生基础闭环、全流程、定向补验与媒体复验；各轮 Partial 的具体缺口及后续覆盖见 acceptance。

平台能力研究已归档到 [platform-limits.md](./platform-limits.md)，原始记录 `/tmp/fitness-light-dark-theme/platform-notes.md`。手动主题不启用系统跟随；modal/actionSheet/picker 底板与键盘不可独立配色，真机未验。

## 集成完成与剩余验收

- 集成分支 `feat/light-dark-theme` 的产品快照 `d33968f` 已包含 01 `088e49a`、02 `f4f1139`、03 `72d2bbb`、04 `d33968f`；相对产品基线 `ab4826f` 做双轴 review，两轴均 APPROVE / No findings / P0–P2 = 0。
- 自动回归已归档：完整运行仅既有 catalog 夹具用例失败；仅排除该用例后 496 passed / 30 skipped / 0 failed。覆盖率只统计 domain/exercises，不等于 UI 验收。JS/JSON、旧 WXSS 非颜色声明与 PNG 检查已通过，详见 acceptance。
- 最终限速串行执行全站及共享组件 WXML/WXSS、全局与主题 WXSS 共 20 项独立编译接口，全部成功；早期限流不再构成该检查缺口。未运行生产构建或推送。
- 原生 01 检查已通过；最终综合报告为 Partial（30 截图），核心训练／暂停／独立间歇／小结／records 两主题已有证据，真实六项 storage 指纹不变且 mock 已恢复。
- 定向补验完成 02 浅深流程、共享详情真实媒体与自绘选择器、03 非空 running deadline 跨主题及到时；发现的深色媒体染绿 P2 已由 `0e7c31a` 修正并合入 `183d5a2`，原生真实媒体白底复验 Passed。
- 真实媒体及其有媒体图托是深色保持要求的明确例外；双主题均 white/normal，失败占位仍原主题图托。最终可运行全套 34 suites / 497 passed / 30 skipped，补充两轴审查无 P0–P2。核心数据层、色板和几何不改。
- 四票按记录的实施／模拟器证据关闭；真机与系统底板、组件内部量测等边界见 acceptance。展示 fixture 与 sandbox 不等于用户真实历史提交，每轮真实存储指纹均相同、mock 已恢复。
- 冻结 refined-c 原始 HTML 保留既有空白，不格式化。无生产构建、推送或发布；全部实施 worktree 已清理，集成分支留待后续审阅。
