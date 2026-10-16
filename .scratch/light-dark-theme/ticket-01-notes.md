# Ticket 01 实施与验证记录

状态：已集成并关闭。下文保留实施代理当时的验证范围；后续原生闭环、定向补验与媒体修正结果以 [acceptance.md](acceptance.md) 为准，真机仍未验。

- 任务：01；独立 worktree，分支 `feat/light-dark-theme-01`。
- 开始 HEAD `d365e6d`，已确认基于 `feat/light-dark-theme`，工作区 clean。
- 完成前执行 `git merge feat/light-dark-theme`，先合入 `30fdecf`（含 `83c0f12` 验收基线与平台能力归档），提交前再次快进合入最新 `de65388`（各票认领约定）。
- 只修改 01 自有页面、共享主题基础设施、浅色图标、直接相关测试及本票记录；未修改 02/03/04 页面或共享动作详情。

## 实现

- `utils/theme.js`：公开 `getTheme()` / `setTheme(next)` / `applyTheme(page)` / `themePage(definition)`。
  - `getTheme()` 每次读取 `fitness:settings.theme`；缺失、非法值或读取失败返回 `dark`，不补写存储。
  - `setTheme('light'|'dark')` 合并新对象写回设置；成功返回 `true`，非法输入返回 `false`；读写失败返回 `false` 并提示“主题保存失败，请重试”，不发布原生/页面切换，不就地修改原设置对象。
  - `applyTheme(page)` 读取当前偏好，更新 `page.data.theme` 和原生导航/背景/tabBar，返回当前主题。省略 page 时只更新原生栏（app 启动使用）。不调用业务生命周期。
  - `themePage` 默认 `data.theme='dark'`，在 `onLoad/onShow` 先 apply，再以原 this/全部参数调用原钩子一次，直接返回原返回值（包括同一个 Promise）。不劫持全局 Page、不订阅/广播业务事件，无监听器积累。
  - 原生 API 用函数存在性检测；有 `fail` 回调并捕获同步异常。非 tab 页 tabBar 调用失败不阻断业务，下一次显示重新尝试，不缓存“成功”或进行无限重试。
  - 不 require JSON：微信仅 JS 模块加载器不能按 Node 方式 require app.json。原生深色常量与 app.json 由回归逐值核对。
- `app.js`：启动时恢复原生外观，在云能力检测前执行；云登录、队列逻辑不变。`app.json` 深色默认值不改。
- `app.wxss` / `styles/theme.wxss`：共享 `.theme-light` 色板通过 app 样式引入。既有深色变量和字面量不变；主按钮通过新语义变量加原值回退，不影响尚未接入主题的页面。
- `pages/me/me.*`：训练偏好新增浅色模式开关；成功后 apply 当前页，不重调 onShow/统计/网络请求；失败重置绑定值。保留单位和离线模式偏好。头像炭黑底亮绿字，月圆环/状态深绿，设置卡片白色，原生 switch 激活色浅色亮绿/深色原绿。
- `pages/today/today.*`：接入装饰器与根主题类；含正常、空、草稿入口、进度与循环状态配色。主按钮炭黑底亮绿字，进度保留亮绿而非黑色。真实动作图浅色下白底、`mix-blend-mode: normal`；灰色图托仅用于占位；深色原有薄荷图托与 multiply 不改。
- 今天替换草稿确认框、我的登录/授权说明框：仅浅色增加可控的深绿确认文字（今天取消文字炭黑），深色参数不变；未包装全站 modal。
- `images/tabbar/*-light.png`：8 张浅色副本，未选 `#626D76`，选中 `#3E5429`；81×81，保留原图 alpha。深色 8 张文件逐字节与 `ab4826f` 一致，实际 active 像素仍 `#3ddc97`，不强行对齐 selectedColor `#3ee6a0`。
- `tests/theme.test.js`：公开 Page/生命周期、wx 与存储边界回归；附模板/色板加载契约检查（不视作渲染证据）。`tests/today-display.test.js` 将过时的“禁止调用 tabBar”断言更新为“共享深色栏逐值一致且业务只刷新一次”。

## 颜色与后续接入

浅色取 `refined-c/today-content.html`、`me-content.html` 及追加 CSS 的最终值，不取其中原型深色。共享主题提供：

| 用途 | 浅色 token / 值 |
| --- | --- |
| 页面/卡片/次表面 | `--bg #F5F6F7` / `--surface #FFFFFF` / `--surface-2 #EEF0F2` |
| 正文/次文/弱文 | `--ink #20262B` / `--ink-dim #606B74` / `--ink-faint #626D76` |
| 状态文字/图标/月圆环 | `--signal`、`--signal-deep #3E5429` |
| 当前行/选中边框 | `--signal-soft #F2F6E8` / `--signal-line #A7B68F` |
| 主按钮 | `--action-background #20262B` / `--action-ink #C3ED42` |
| 完成反馈/进度 | `--energy #C3ED42` / `--signal-gradient linear-gradient(#C3ED42, #C3ED42)`，`--signal-ink #20262B` |
| 完成行/历史图/自有蒙层 | `--completed-background #F7F8F4` / `--chart-history #879197` / `--overlay rgba(32,38,43,.40)` |

页面接入（02/03/04 自行处理各自局部字面量，保留深色原值）：

```js
const { themePage } = require('../../utils/theme');
Page(themePage({
  data: { /* 原 data */ },
  onShow() { return this.refresh(); }, // 原业务仍只执行一次
}));
```

```xml
<view class="page theme-{{theme}}">
  <exercise-detail theme="{{theme}}" />
</view>
```

```css
/* 页面自身已有深色值放在回退，浅色值来自共享类。 */
.action-button {
  background: var(--action-background, var(--signal-gradient));
  color: var(--action-ink, var(--signal-ink));
}
```

隔离组件：增加 `theme: { type: String, value: 'dark' }` property，自行 `@import "../../styles/theme.wxss";`（按目录调整），根节点 `theme-{{theme}}`，由调用者显式传 theme；不要解除组件隔离。01 自有页面没有自定义组件调用点，因此这里只核验接入契约，实际动作详情组件属性和渲染证据归 02；没有提前修改共享组件。新增局部 token 优先在各票页面处理，不再改共享色板。不要全局改黑 `--signal-gradient`，不要给原生白底弹窗按钮用亮绿文字。

## 实际验证

依赖沿用已安装 Jest，独立 worktree 未安装依赖；命令中的 Jest 来自主工作区 node_modules（只读使用），等价 npm test。

1. 逐场景 red→green：无主题默认（undefined→dark）、双向切换事件（缺 handler→立即切换并合并持久化）、今天加载/往返（缺 onLoad→恢复并业务单次刷新）、原生 API（零调用→浅/深参数与图标路径）、app 无云启动（零调用→恢复栏）、模板根类/开关（缺失→接入）、共享色板（缺 import→语义分离）、JS-only 模块加载（require JSON 失败→JS 常量）、本票 modal 可控按钮色（缺参数→深绿）、真实媒体（缺浅色白底规则→白底不混色）。每次添加一个场景后先运行失败，再实现并重跑；失败原值/生命周期返回与参数/非 tab 边界等作为对应薄片的补充回归保留。
2. 针对性 Jest：`jest tests/theme.test.js tests/today-display.test.js tests/board1-today.test.js tests/board2-me.test.js tests/today-training-start.test.js --runInBand --coverage=false --silent` → **5 suites / 42 tests passed**（其中主题新增 14 项）。
3. 完整 `npm test -- --runInBand --silent` → **29 suites passed / 1 failed；469 passed / 29 skipped / 1 failed**。唯一失败为已确认的基线：catalog 生成器缺 `exercises.json/name_zh.json`，没有修 unrelated 或伪造数据，也不称完整 Jest 全绿。
4. 排除唯一环境基线场景后的可运行回归：`npm test -- --runInBand --silent --testNamePattern='^(?!.*生成器 buildCatalog 可用夹具目录跑通)'` → **30 suites passed；469 passed / 30 skipped**。覆盖率 statements 96.28%、branches 91.24%、functions/lines 97.77%，范围仍仅 domain 与 exercises，不代表主题 UI 覆盖率。
5. `git diff --check`、`node --check`（theme/app/今天/我的 JS）通过。
6. Pillow 检查 8 张原深色 PNG 与 `git show ab4826f:<path>` 字节完全相同；8 张浅色 PNG 的尺寸 81×81、alpha bytes 与对应原图相同、所有 RGB 为指定未选/选中色、每张 <40KB → 通过。先运行副本存在性检查确认缺失（red），生成后相同尺寸/alpha/RGB 检查 green。
7. 不执行生产构建，不并发访问协调者占用的模拟器；没有取得本次改动的原生截图或真机证据。

## 原生与剩余边界

已读取 `/tmp/fitness-light-dark-theme/platform-notes.md`，结论与 integration 的 [platform-limits.md](platform-limits.md) 一致：

- 导航栏 API 1.4.0；tabBar 样式/图标 API 1.9.0；窗口背景/下拉文字 API 2.1.0。状态栏文字仅黑白；tabBar 分隔线仅 black/white，本票浅色用 white；窗口 top/bottom 配色仅 iOS。
- modal 只可配置确认/取消文字色，actionSheet 只可配置 itemColor；弹出底板、正文、蒙层不在手动主题完全控制范围。picker 弹出面板无配色属性。本票未替换系统控件、未声称其跟随手动主题全量匹配。
- switch 只保证可控激活色；系统平台的滑块/未选区域仍需真机确认。没有启用 darkmode/theme.json、系统主题订阅或 prefers-color-scheme。
- app.json 冷启动默认仍深色，运行后恢复本机偏好；首帧切色时序与各原生 API 在不同客户端的表现待原生验证。
- 待协调者模拟器与真机补证：无偏好默认、双向切换/关闭重开、今天正常/空/草稿、我的零值/非零月统计、往返保留状态、导航/状态栏/下拉与 tabBar 全部图标、深色逐值视觉对照、原生说明/确认弹窗。Jest 参数断言与静态 CSS/PNG 校验不替代上述证据。
- 02/03/04 与动作详情尚未由本票适配，未接入页面仍保持深色；不标称全站浅色完成。01 issue 原生相关验收项保持未勾选。
