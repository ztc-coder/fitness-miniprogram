# public-release 实施记录

## 授权与基线

- 用户已明确授权实施 `public-release`，并确认本地提交、独立 worktree 与集成分支合并。
- 集成分支：`feat/public-release`；起点及最终审查基线：`f049ef5dc2951169aac2938a65d81d762b0579da`。
- 不推送，不运行生产构建，不部署生产，不提审。父规格中的“仅落规格”属于此前授权记录，不再代表本轮代码实施权限；生产发布限制仍有效。
- TDD 边界经用户确认：domain/数据层公开接口、Page 生命周期和用户事件、云函数入口；模拟限微信、云端、时间及存储边界。真实微信双用户、真机与控制台证据单列，不能用 mock 替代。
- 任务图：`01 → 02 → 03 → 05 → 06`；`04 → 05`。`06` 由人工解除发布阻断。
- 后续确认：本轮不提供独立测试环境或真机，也暂不提供真实运营者/公开联系方式。第05票真实验收保留 Blocked，第06票真实资料仍待人工提供；不部署云端。

## 基线测试修复

- 首次执行 `npm test -- --runInBand --silent`：35 套，34 通过、1 失败；530 项，500 通过、29 跳过、1 失败。
- 唯一失败来自 `tests/catalog.test.js` 的 `buildCatalog()` 默认依赖本机 `/tmp/exercises-dataset`；错误为 `缺少源数据：需 exercises.json 与 name_zh.json`。
- 将该用例改成临时小夹具，显式传入源目录、空覆盖及排除表，验证已知动作的输出；不改生成器、不跳过断言、不下载真实媒体，测试后清理夹具。
- 修复后同命令：35 套通过，501 项通过、29 跳过。`git diff --check` 通过。
- 原始日志：本机 `/tmp/public-release-baseline-tests.log`、`/tmp/public-release-fixture-tests.log`；后续各票须重新验证，不将本记录当作最终验收。

## 当前发布阻断

真实媒体书面授权、运营者及公开联系方式、平台资格、独立测试环境、真实双用户与真机、最终编译包体及生产操作授权均未由本记录证明。详见第05、06票。

## 第04票集成

- 合并提交：`c217465`；隐私/帮助说明页、支持配置和缺项阻断检查已集成。
- 集成后 `npm test -- --runInBand --silent`：37 套通过，507 项通过、29 跳过，无失败。
- 真实公开信息继续留空；`check:public-info` 预期失败是发布阻断，不是已具备有效对外隐私政策。
- 第04票聚焦只读审查通过：未发现可确认 P0–P2；静态审查不代表渠道可达、真机效果或法律合规。最终全范围双轴审查仍待其余票集成后执行。

## 第01票集成

- 合并提交：`4d3b299`；实现主动同意、可信身份入口、所有者缓存/草稿/队列隔离、匿名归属确认及媒体门控。
- 集成后测试：39 套通过，517 项通过、29 跳过；源码包体 1,190,300 bytes（85 文件），低于 2 MiB；`git diff --check` 通过。
- 配置及边界见 `docs/consent-owner-isolation.md`；客户端个人集合读写应全拒绝，运行时走可信云函数。本轮未部署这些规则，不宣称真实云端隔离已验收。
- 第02票已按第01票源码依赖就绪启动；第01票保留真实验收阻断记录，真实双用户与真机证据统一由第05票承接。
- 聚焦审查发现登录失败未通知视图清屏（P1）、失败重试提示与开关行为不一致（P2）；修复合并于 `484dd5a`。两项回归均先红后绿，定向只读复审通过，无新增 P0–P2。
- 修复集成后：39 套通过，519 项通过、29 跳过；源码 1,190,611 bytes；差异检查通过。上述仍非真机/线上隔离证据。

## SDK 文档核实

- 前两次调研请求在使用工具前遭遇上游 524；换路后取得官方文档，未把失败请求当作调研结果。
- 事务最低 SDK 要求 1.7.0，当前 `~2.6.3` 支持；云函数可用 `runTransaction`，事务内只允许单记录操作，可对多记录/多集合操作，不使用 `where` 批量写事务。
- 官方资料：[事务指南](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide/database/transaction)、[runTransaction](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/reference-sdk-api/database/Database.runTransaction.html)、[安全规则](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide/database/security-rules.html)。运行时代码必须核对具体 SDK 返回值与错误，不把任意读取失败当作不存在。
- 仓库外共享笔记 `/tmp/public-release-cloudbase-research.md` 供第02/03票参考；真实 SDK、规则与事务竞态仍须第05票测试环境实测。
- 精确版本补核：官方 npm 发布源码显示 `wx-server-sdk@2.6.3` 的 `runTransaction` 直接返回回调值，新版文档的 `{result, errMsg}` 包装不能照搬。默认缺失文档 `get()` 抛 `errCode:-1` 及明确的缺失消息；`-1` 不是专用不存在码，禁止吞掉全部读取错误。此修正已交第02票；包版本与实际云端部署仍需核对。