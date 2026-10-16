# Ticket 04 实施与验证记录

状态：代码与针对性自动回归完成；**待主线原生验收，票保持 open，不标 done**。

## 范围与分支

- 任务 04；独立 worktree / `feat/light-dark-theme-04`。
- 起点 HEAD `088e49a`，工作区 clean；已确认 `088e49a → HEAD → feat/light-dark-theme` 祖先关系（起始三者相同），无须重置或强行对齐。
- 完成前执行 `git merge feat/light-dark-theme`，当前 integration tip 为 `088e49a`，结果 `Already up to date`。
- 已读 karpathy-guidelines、TDD 技能及 tests/mocking 附件、CONTEXT、主题完整规格、01 记录、平台限制和 04 issue；测试沿用户授权的 Page 生命周期/事件、wx/存储/时间与公开记录边界运行。
- 不改 domain、queue、db、共享样式、其他页面及 CONTEXT；未安装依赖、未访问模拟器、未生产构建、未重跑已知 catalog 缺源的全量套件。

## 逐文件实现

- `pages/records/records.js`：仅引入 `themePage`、使用 `Page(themePage({...}))`；原刷新、统计、分页调用、趋势选择、PR、指标事件逐字节不变。原 onShow 仍只刷新一次；主题恢复不重置 view / selectedExercise / metric / showMetricSheet。
- `pages/records/records.wxml`：根节点加入 `theme-{{theme}}`，不改布局或绑定。
- `pages/records/records.wxss`：保留原深色 CSS 全文，仅追加 `.theme-light` 颜色规则。复用共享浅色 token 的灰白页面/白卡/炭黑正文、深绿状态及浅绿选中项。按 refined-c/records-content.html（含追加 CSS）的最终值：历史柱 `--chart-history #879197`，去原 opacity 与 glow；`.chart-bar.last` 亮绿 `--energy #C3ED42`、深绿顶边与 2rpx 内描边，不改变几何；PR 徽章仍只受原 `isPR` 控制，不把 latest 与 PR 重新定义为同义。stat-number/时间线容量炭黑，icon-flame 深绿，历史柱值/日期次文字，统计卡浅边框；自有 sheet 遮罩使用 `--overlay`。
- `pages/session-detail/session-detail.js`：仅同样接主题装饰器，原 onLoad(options) 与所有展示计算不变。新增的主题 onShow 不重复读取详情或重建展示。
- `pages/session-detail/session-detail.wxml`：根主题类；空 session 仍按原条件不显示内容，窗口底色由共享原生主题 API 恢复。
- `pages/session-detail/session-detail.wxss`：保留原深色 CSS，仅追加浅色合计炭黑规则；白卡、深绿组成绩/容量、浅绿组标签和跳过态继承共享 token。
- `tests/records-history-theme.test.js`：本票独立的 9 项回归；只 mock wx/存储/云端与时间，不 mock 自有 domain/db/queue/theme 模块。附根模板与局部颜色声明契约，**不是原生渲染/最终计算色证据**。

## TDD 与实际验证

逐场景 red → green：

1. 记录首次默认深色、再次 show 双向恢复且保持页签/动作/指标弹层：初始 theme undefined 失败 → 接装饰器通过。
2. 从记录打开旧详情、读取浅色及返回保持选择：详情缺 theme 失败 → 接装饰器通过；原合计的测试预期先核对为 308（300 负重 + 8 次自重），时长为 `1m`，没有为主题票改变旧展示口径。
3. 两页根模板主题接线缺失失败 → 增加根类通过。
4. 历史柱透明度/辉光及最新柱颜色契约缺失失败 → 追加浅色规则通过。
5. 炭黑数值/深绿火焰/sheet 遮罩及详情数值契约缺失失败 → 追加对应颜色通过。

另补原行为保持回归：空统计、预留指标提示/选中关闭/手动关闭；新历史完成/待练/跳过组展示；缺失历史提示与原 600ms 返回；61 场分页与同 id 云端→队列→完成日志优先级，切主题后累计负重容量仍 12400，历史合计行仍 408 kg（含自重次数的旧展示）。存储边界逐项断言没有历史、草稿、队列写入或删除，云端没有写入；仅显式 setTheme 写设置。

命令（复用现有 Jest，只读依赖，不安装）：

```sh
/Users/ztc/fitness-miniprogram/node_modules/.bin/jest \
  tests/records-history-theme.test.js tests/board2-records.test.js \
  tests/session-history-read.test.js tests/training-records.test.js tests/theme.test.js \
  --runInBand --coverage=false --silent
```

结果：**5 suites / 40 tests passed**。包含原 PR 条件、负重/自重、部分跳过、旧历史、完整分页、本地合并与共享主题行为回归。

- `node --check pages/records/records.js`、`node --check pages/session-detail/session-detail.js`、`node --check tests/records-history-theme.test.js` → 通过。
- `git diff --check` → 通过。
- 对照 `git show 088e49a:<path>`：两页 CSS 原文是修改后全文前缀，新增规则只作用于 `.theme-light`；两页 JS 除主题 import、Page 包裹之外逐字节一致 → 通过。未改变字号、字重、间距、圆角、排版或业务函数。

## 平台限制与原生待验

- 原生 picker **仅适配页面内触发区域**：chart-title、箭头、白卡及文字继承浅色 token，原尺寸、布局、选择行为不变。系统弹出的 picker 底板无手动配色接口，保留原控件，不替换、不声称完全适配。
- 两页没有 input，也没有详情自有 sheet；记录指标 sheet 的白卡/选项/选中项/自有遮罩均可控并已接入。原缺失记录 toast、返回计时等行为不改，系统 toast 外观不在本页自绘范围。
- 本票未取得模拟器或真机截图，未访问主线独占模拟器；Jest 与 CSS 契约不能代替原生验收。
- 待主线补证：趋势/历史 tab、空/非空/同步待处理状态、动作 picker 触发区与系统面板边界、指标 sheet、非 PR 最新柱与有 PR 最新柱、历史冷灰及亮绿柱实际色/文字/描边、旧/新详情及跳过组、详情往返和主题双向切换保留选择、深色逐值视觉对照、导航/tabBar 恢复。首帧、不同微信基础库、iOS/Android 仍按 platform-limits.md 验证。
- 详情原来只读最近 50 场，未扩大读取范围；统计历史原有合计口径未调整。均不属于主题票重定义范围。
