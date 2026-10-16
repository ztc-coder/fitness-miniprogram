# 双主题验收记录

状态：代码、自动验证与双轴 review 已完成；定向原生补验进行中，整体验收尚未关闭。本文归档主线已提供的结果，本次纯文档任务未运行测试、模拟器或构建。

## 基线

- 产品基线 `ab4826f`，集成分支 `feat/light-dark-theme`。
- `npm test -- --runInBand --json --outputFile=/tmp/fitness-theme-baseline-jest.json`：455 passed、29 skipped、1 failed；28 suites passed、1 failed。
- 既有失败：`tests/catalog.test.js` 的「生成器 buildCatalog 可用夹具目录跑通」依赖未随仓库提供的 `exercises.json`、`name_zh.json`，报错 `缺少源数据：需 exercises.json 与 name_zh.json`。不是本次主题变更引入。
- 未执行生产构建。项目无独立 lint/typecheck 脚本。
- 微信开发者工具可访问，skill 0.3.9，`versionRelation: equal`、登录有效；当前模拟器宽 375px。
- 模拟器已有本机浅色偏好与进行中草稿。原生验收前后必须恢复原偏好并核对业务存储，报告不得包含 openid、完整草稿或其他私有数据。

## 集成验证清单

勾选仅代表所述证据范围通过，不代表所有客户端与业务状态均已覆盖。

- [x] 01：无主题记录默认深色；真实开关双向切换、刷新恢复、保存故障复位、原生栏与图标同步；基线颜色与几何检查通过。
- [x] 自动回归覆盖设置合并、失败不发布、生命周期及业务状态保护；结果与既有失败见下文。
- [x] JS 13 / JSON 16 检查、10 份 WXSS 几何对照、图标资源及产品差异检查通过。
- [x] `code-review` Standards 与 Spec 两轴均 APPROVE，P0–P2 = 0，见 [review.md](./review.md)。
- [ ] 今天与我的全状态（正常／空／草稿恢复／月训练／设置）：01 已验证主题入口与基线，不据此宣称全部状态完成。
- [ ] 02：计划 → 训练日编辑 → 动作搜索筛选／多选／共享详情 → 返回保留编辑与选择；深浅完整流程、真实媒体与 picker 定向补验待结果。
- [ ] 03：训练待练／当前／完成／跳过／暂停／间歇／错误／小结全状态；核心训练、暂停、独立间歇与小结两主题已有证据，running deadline 跨主题与到时定向补验待结果。
- [ ] 04：统计／趋势／PR／历史／单场详情全状态及返回选择保留；records 两主题已有证据，不扩大为所有分支通过。
- [ ] 全链路主题切换不改变计划、草稿、稳定组 ID、暂停及间歇时间、历史或队列：已有真实 storage 指纹保护证据；02/03 尚有明确证据缺口。
- [ ] 所有 WXML/WXSS 独立编译接口检查：仅 6 项成功，其余限流或未独立执行，见下文。
- [ ] iOS／Android 真机：未验；平台不可独立配色部分单列，不视为代码缺陷。

## 集成与自动验证归档

- 产品基线 `ab4826f`；四票集成产品快照 `d33968f`：01 `088e49a`、02 `f4f1139`、03 `72d2bbb`、04 `d33968f`。本文档归档分支起点 HEAD 与集成分支 `feat/light-dark-theme` 同为 `d33968f`。
- 原完整测试 JSON：`/tmp/fitness-theme-integrated-jest.json`。32 suites passed / 1 failed；496 passed / 29 skipped / 1 failed。唯一失败仍是既有 catalog 生成器夹具缺少 `exercises.json` 与 `name_zh.json`，不是主题回归。
- 仅排除该既有用例后的回归 JSON：`/tmp/fitness-theme-integrated-regression-jest.json`。33 suites、496 passed / 30 skipped / 0 failed。不是整个 catalog suite 被排除，也不是无条件全量测试零失败。
- Coverage：statements 96.28%、branches 91.24%、functions / lines 97.77%；统计仅 `utils/domain.js` 与 `data/exercises.js`，不代表页面或原生覆盖率。
- JS 13 / JSON 16 检查通过。10 份 WXSS 旧 selector 的非颜色声明对照为 0 差异：`/tmp/fitness-light-dark-theme/style-geometry-comparison.json`。
- 主线已实际验证：8 张深色 PNG 与 `ab4826f` 字节相同；8 张浅色 PNG 均为 81×81、alpha 与原图相同、目标 RGB 正确、每图 <40KB。
- 产品 `git diff --check 088e49a...HEAD` 通过。以 `ab4826f` 整体检查时，只有冻结原始 refined-c HTML 的既有空白；保留原始副本，不做格式化。
- `core domain/db/queue/training-log`、`data`、`app.json`、package 文件对产品基线 git diff 为空，未改变业务规则或依赖。
- 无生产构建、无推送；本次归档不重复运行上述检查。

## 编译接口证据（非生产构建）

主线独立 compile 接口成功共 6 项：`app.wxss`、`styles/theme.wxss`、共享组件 WXML + WXSS、today WXML + WXSS。

me / plan / plan-day 各 2 项遇 `-80408`（60 次／分钟工具限流），不是代码编译错误；剩余页面未独立执行 compile 接口。不能宣称全站编译通过。原始返回：`/tmp/fitness-light-dark-theme/compiler-*.json`。

## 已有原生证据与待补项

以下路径为主线独立归档的本地报告；当前隔离 worktree 未带入 `.pi` 报告副本，摘要依据主线提供的已知事实，不声称本次重新读取或执行原生验证。

1. `.pi/visual-tests/light-dark-native-01-20261016-100422/report.md`：已完成真实开关、default dark、双向切换、刷新恢复、故障复位、原生栏图标、基线颜色与几何检查；业务存储指纹全部不变。
2. `.pi/visual-tests/light-dark-native-final-20261016-101503/report.md`：结论 **Partial**，30 张截图；核心训练、暂停、独立间歇、小结、records 两主题通过。真实 6 项 storage 指纹不变，mock 全部恢复；02/03 存在明确证据缺口，不能据此关闭全局验收。
3. 第三轮定向 native 补验正在主线后台进行：02 深浅完整流程、共享详情真实媒体与 picker，以及 running deadline 跨主题与到时。**尚无结果，全部 pending**；本归档不预言 Passed，不关闭 tickets。

涉及隔离存储 sandbox 与运行时展示 fixture 的证据仅证明所构造状态的外观／交互，不是用户真实记录提交。真实 storage 指纹核对与 fixture 演示分开记录，不向真实历史写入 fixture，不将其冒充真实完成或云端提交证据。

## 原生证据规则

设计图仅用于颜色比对；布局、排版保持产品基线。原生自动化使用已安装微信开发者工具 CLI，不以浏览器原型代替产品。只读真实数据页面优先使用现有稳定记录。需要训练、间歇、错误和完成小结等状态时，可使用运行时展示 fixture 或隔离的 wx 存储边界；必须说明 fixture 与真实持久化流程的区别，不提交或覆盖用户训练成绩。

截图与运行时工件存本地 `.pi/visual-tests/`，本文件归档工具返回、覆盖范围和工件路径。模拟器证据与真机证据分别列明。原生系统控件无法手动控制的底板、键盘等按平台能力记录，不擅自替换现有控件，不将其标成全站已匹配。

平台限制详见 [platform-limits.md](./platform-limits.md)：modal / actionSheet / picker 底板、键盘不可独立手动主题化。保留原控件；真机尚未验证，不能将模拟器或自动测试扩大为真机结论。
