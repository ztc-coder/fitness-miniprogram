# 实施约定与记录

- 集成分支：`feat/light-dark-theme`。
- 产品基线：`ab4826f`，来自当前 `feat/set-by-set-training`，后续审查比较 `git diff ab4826f...HEAD`。
- 规格：`spec.md`；依赖图：`01 → [02, 03, 04]`。
- 本地 issue tracker：完成后添加 frontmatter `status: done`；原生证据不充分时明确保留待验项。
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

运行项目 Jest；不存在额外 lint/typecheck 脚本。不运行生产构建。原生模拟器与真机验证分开记录，不以原型或 Jest 代替原生外观证据。已发现本机安装微信开发者工具，将核查现有原生自动化接口。

平台能力研究记录由研究代理写入 `/tmp/fitness-light-dark-theme/platform-notes.md`，完成后将相关结论归档到本目录。