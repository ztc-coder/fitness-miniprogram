# 双主题验收记录

状态：实施完成，四票 `status: done`。代码、可运行自动回归、双轴审查及指定模拟器关键流程通过；媒体染色 P2 已修复并原生复验关闭。以下保留每轮证据范围与未覆盖边界，不将模拟器等同真机或全平台验收。

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
- [x] 今天与我的：真实正常／草稿入口／月统计／设置，以及临时展示的无计划／零统计；自动回归补充状态边界，不宣称所有状态组合均原生穷举。
- [x] 02：浅深计划 → 训练日 → 动作库 → 共享详情 → 添加返回、筛选清空／分页、普通浏览训练日选择弹层；真实 GIF→JPEG→占位可见降级，媒体 P2 复验关闭。
- [x] 03：训练待练／当前／完成／跳过／暂停、独立间歇展开收起／暂停恢复／到时及小结；非空 deadline 跨真实主题开关保持。错误和深色小结部分使用展示 fixture，见报告。
- [x] 04：统计／趋势／PR／历史／指标弹层／单场详情及返回保留选择，浅深核心流程通过；空态、旧记录与分页边界另有自动回归。
- [x] 主题切换不改训练事实：自动边界测试及各轮真实六项存储指纹相同；合成场次跨主题保留稳定组 ID、成绩、暂停状态及非空 restEndsAt。
- [x] 所有页面与共享组件 WXML/WXSS、全局与主题 WXSS：20 项官方独立编译接口检查成功；不等同生产构建或全平台验证。
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
- 无生产构建、无推送。

最终媒体修正合入 `183d5a2`（源提交 `0e7c31a`），新增 1 项媒体契约：相关 26 suites / 391 passed / 4 skipped；最终可运行全套 **34 suites / 497 passed / 30 skipped / 0 failed**，仅额外排除同一既有 catalog 缺源单项。媒体修正原始 JSON `/tmp/fitness-theme-media-fix-jest.json`；收尾以 `npm test -- --runInBand --testNamePattern='^(?!.*生成器 buildCatalog 可用夹具目录跑通)' --json --outputFile=/tmp/fitness-theme-final-jest.json` 再次确认相同结果与 coverage 门槛，statements 96.28%、branches 91.24%、functions / lines 97.77%。原全量命令的缺源失败仍存在，不称无条件全绿。

真实媒体及有媒体图托是深色保持要求的明确例外：基线已有 multiply 染色，现对浅深统一白底 normal；其余深色配色、占位、几何、字体和业务保持。修正后两轴补审均 APPROVE / No findings，原生复验见下文。

## 编译接口证据（非生产构建）

早期补查遇 `-80408`（60 次／分钟工具限流），不是代码编译错误。停止并发后，主线对最终产品快照串行限速补查，**20 项均 `ok: true / success: true`**：8 页 WXML + WXSS 共 16 项、共享动作详情 WXML + WXSS 共 2 项、`app.wxss` 与 `styles/theme.wxss` 共 2 项。原始返回 `/tmp/fitness-light-dark-theme/compiler-final-{1,2,3,4}.json`。接口返回编译产物摘要，不代表真机或生产整包构建。

## 原生证据与范围

以下报告均已由主线读取核对；截图只保留本地 `.pi/visual-tests/`，不提交个人训练画面。

1. `.pi/visual-tests/light-dark-native-01-20261016-100422/report.md`：已完成真实开关、default dark、双向切换、刷新恢复、故障复位、原生栏图标、基线颜色与几何检查；业务存储指纹全部不变。
2. `.pi/visual-tests/light-dark-native-final-20261016-101503/report.md`：结论 **Partial**，30 张截图；核心训练、暂停、独立间歇、小结、records 两主题通过。真实 6 项 storage 指纹不变，mock 全部恢复；02/03 存在明确证据缺口，不能据此关闭全局验收。
3. `.pi/visual-tests/light-dark-native-targeted-20261016-1033/report.md`：16 张定向截图，02 浅深计划／目标／排序／库／添加返回、筛选清空／触底分页、自绘训练日选择器、真实 GIF→JPEG→glyph；03 非空 deadline 跨主题、2 秒到时／不重启、跳过及深色错误展示通过。该轮发现深色真实媒体染绿 P2，未归为通过；随后修正。
4. `.pi/visual-tests/light-dark-media-retest-20261016-105348/report.md`：修复后的指定模拟器媒体场景 **Passed**，六张截图。0001、0025 的浅深真实 GIF 与有媒体图托白区均采样 `#FFFFFF`，旧 P2 同点为浅绿；最终失败 glyph 仍主题图托。**P2 已关闭**。复验代理因模型服务 503 中断后，由协调者完成占位验证与 finally 恢复；所有 wx/cloud 函数恢复，真实业务写为 0，最终六项指纹相同、today/light、无 mock。

涉及隔离存储 sandbox 与运行时展示 fixture 的证据仅证明所构造状态的外观／交互，不是用户真实记录提交。真实 storage 指纹核对与 fixture 演示分开记录，不向真实历史写入 fixture，不将其冒充真实完成或云端提交证据。

## 原生证据规则

设计图仅用于颜色比对；布局、排版保持产品基线。原生自动化使用已安装微信开发者工具 CLI，不以浏览器原型代替产品。只读真实数据页面优先使用现有稳定记录。需要训练、间歇、错误和完成小结等状态时，可使用运行时展示 fixture 或隔离的 wx 存储边界；必须说明 fixture 与真实持久化流程的区别，不提交或覆盖用户训练成绩。

截图与运行时工件存本地 `.pi/visual-tests/`，本文件归档工具返回、覆盖范围和工件路径。模拟器证据与真机证据分别列明。原生系统控件无法手动控制的底板、键盘等按平台能力记录，不擅自替换现有控件，不将其标成全站已匹配。

平台限制详见 [platform-limits.md](./platform-limits.md)：modal / actionSheet / picker 底板、键盘不可独立手动主题化。保留原控件；真机尚未验证，不能将模拟器或自动测试扩大为真机结论。

未覆盖：iOS／Android 真机和各系统外观组合；原生轮盘实操与所有系统弹层底板；组件内部 theme property、stageIndex 与 computed style 数值（公开树／可见降级／真实媒体截图已验）；七类筛选原生逐项穷举、每个存储异常和错误分支；真机声音／振动／后台恢复。上述是明确的验收边界，不存在已知未修复 P0–P2。实施 worktree 已清理，原有未跟踪设计文件保留。
