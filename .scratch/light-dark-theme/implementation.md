# 实施约定与记录

状态：四票代码已合入，自动验证与双轴 review 已完成；定向 native 验收待完成，不关闭 tickets。证据与边界见 [acceptance.md](./acceptance.md)、[review.md](./review.md)。

- 集成分支：`feat/light-dark-theme`。
- 产品基线：`ab4826f`，来自当前 `feat/set-by-set-training`，后续审查比较 `git diff ab4826f...HEAD`。
- 规格：`spec.md`；依赖图：`01 → [02, 03, 04]`。
- 本地 issue tracker：本次只归档证据，不修改 issues 或票据状态；原生证据不充分的项目保持待验。
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

运行项目 Jest；不存在额外 lint/typecheck 脚本。不运行生产构建。原生模拟器与真机验证分开记录，不以原型或 Jest 代替原生外观证据。主线已完成两轮原生证据归档，第二轮结论 Partial；第三轮定向补验进行中，不以自动回归替代原生证据。

平台能力研究已归档到 [platform-limits.md](./platform-limits.md)，原始记录 `/tmp/fitness-light-dark-theme/platform-notes.md`。手动主题不启用系统跟随；modal/actionSheet/picker 底板与键盘不可独立配色，真机未验。

## 集成完成与剩余验收

- 集成分支 `feat/light-dark-theme` 的产品快照 `d33968f` 已包含 01 `088e49a`、02 `f4f1139`、03 `72d2bbb`、04 `d33968f`；相对产品基线 `ab4826f` 做双轴 review，两轴均 APPROVE / No findings / P0–P2 = 0。
- 自动回归已归档：完整运行仅既有 catalog 夹具用例失败；仅排除该用例后 496 passed / 30 skipped / 0 failed。覆盖率只统计 domain/exercises，不等于 UI 验收。JS/JSON、旧 WXSS 非颜色声明与 PNG 检查已通过，详见 acceptance。
- 独立编译接口仅成功 6 项；me/plan/plan-day 各两项受 `-80408` 限流，其他页面未独立执行，不宣称全编译通过。未运行生产构建或推送。
- 原生 01 检查已通过；最终综合报告为 Partial（30 截图），核心训练／暂停／独立间歇／小结／records 两主题已有证据，真实六项 storage 指纹不变且 mock 已恢复。
- 02 深浅流程、共享详情真实媒体与 picker、03 running deadline 跨主题及到时，仍待正在主线后台进行的定向补验结果；不得将展示 fixture 或 sandbox 当作真实历史提交，不据此关闭 tickets。
- 冻结 refined-c 原始 HTML 保留既有空白，不格式化；本次只更新 acceptance、implementation 并新增 review，不修改 spec、CONTEXT、ticket notes、issues 或产品代码。
