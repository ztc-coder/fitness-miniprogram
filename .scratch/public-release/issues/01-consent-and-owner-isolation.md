# 01: 本地可用、同意后启用本人云服务

**What to build:** 用户不登录、不启用云服务也能完成本地训练；主动同意后，通过可信微信身份访问本人计划和训练记录。身份获取失败、缓存归属不明或身份发生变化时，不泄漏或错误上传其他人的数据。继续使用 CloudBase，不引入账号密码、手机号或头像昵称采集。

**Blocked by:** None (can start immediately).

**Status:** ready-for-human (code complete; real cloud verification Blocked)

本轮仅批准落票，功能实施仍需另行授权。本票负责权限和同意门控的完整闭环，不把用户隔离推迟到最终验收；同期帮助文案由第04票交付。

- [x] 首次使用、拒绝同意及旧版无明确同意记录时，本地计划编辑、训练、完成与历史回看可用；不初始化个人云服务、不获取身份、不启动同步、不请求或预热远程动作媒体。
- [x] 同意入口明确说明处理的数据、用途和删除方式；只有用户主动同意后启用云能力。微信平台隐私接口授权状态与产品云服务同意分别判断，不从旧 openid 或平台授权返回值推断产品同意。
- [x] 重启后正确恢复同意状态，不重复注册网络监听或同步执行器；现有离线开关与实际云能力一致，不保留无效开关。
- [x] 身份获取失败不阻挡本地训练，不进入未知身份同步，不误报云端成功；用户能理解并重试失败的云服务启用。
- [x] 计划、历史、草稿及队列具有所有者边界；身份不匹配时不展示、不上传另一所有者数据。首次归属匿名数据需明确展示当前身份及待同步范围，不静默认领归属未知的旧缓存。
- [x] 客户端数据库权限和云函数均只允许访问本人数据；云函数从可信微信上下文取得身份，缺失或无效时拒绝，不信任前端传入的所有者字段。
- [x] 权限配置与实际查询方式兼容；提供可复现的配置说明。伪造所有者、猜测他人文档 ID、无身份调用均不能绕过权限。
- [x] 同意后保留现有媒体体验及署名；媒体加载失败不阻挡训练。媒体公开授权仍为正式发布阻断，本票不声称解决版权问题。
- [x] 自动测试覆盖未同意零云请求/零远程媒体请求、同意及重启、身份失败、缓存归属不匹配、越权请求拒绝；现有训练、主题与快照规则无回归。真实双用户云端验证由第05票记录。
## Implementation evidence and blocked real verification

User separately authorized local implementation/commits/integration, not deployment. Checked items above describe source implementation and automated evidence only; actual cloud permission configuration and real two-user/device verification remain **Blocked**, not satisfied deployment evidence. This ticket is not marked fully accepted/done.

- Architecture, public API, permission configuration and vertical red/green commands: `docs/consent-owner-isolation.md`.
- Integration tip `85f82ca` merged; ticket04 help entries preserved. Catalog fixture fix inherited from integration, not duplicated.
- Final regression: shared installed Jest `--runInBand --silent`: 39 suites passed, 517 passed / 29 skipped / 546 total. `git diff --check` passed. No dependency installation, dataset download, production build or deployment.
- New coverage includes local training without consent, consent/restart/failure, explicit anonymous claim, foreign-owner storage/drafts/queue protection, stale Page confirmations/responses, trusted cloud entrypoints, forged owners/guessed IDs/no identity, namespaced idempotent set/remove, and data API through actual cloud entrypoints with only platform boundaries mocked.
- Remaining: ticket02 durable plan retry/full plan pagination; ticket03 deletion UI and server write barrier. Existing same-kind owned local data rejects anonymous overwrite instead of silently merging. A cold start without verified identity hides owned buckets but permits anonymous local training.
- Real cloud rules, dual-user isolation and devices: Blocked (no environment/device supplied). Media authorization and public operator/contact evidence remain release blockers. No production release claimed.

### review01 focused fixes (local source / boundary-mocked evidence)

- Base/ancestry: isolated branch `fix/review01-consent` starts at integration `8b98f5b` (contains ticket01/04); `git merge-base --is-ancestor feat/public-release HEAD` succeeded. Before completion, `git merge feat/public-release` reported already up to date at that same integration tip.
- P1: current-epoch login failure now notifies service subscribers after clearing owner/changing status. Real plan Page `onShow` renders A's cached plan while retry login is pending at the wx cloud boundary; rejecting login clears plans/active plan immediately and blocks the stale edit action. Epoch conditional and late-response guards are retained, not broadened to superseded attempts.
- P2: failed identity lookup exposes a visible `重试云服务` button using existing `login-pill` styling and the existing consent-enable handler (no second consent flow). Toast/login guidance names that action; the offline switch still withdraws consent. Test starts with the real switch event and failing cloud login, reopens via Page `onShow`, reads the actual WXML button condition/binding, dispatches its tap to re-enable, and checks failure followed by switch withdrawal. No synthetic service state or internal collaborator mock is used.
- TDD command: shared installed `$JEST tests/consent-owner.test.js --runInBand --coverage=false --silent`. P1 red: after correcting a fixture whose empty cycle was migrated away, the displayed cached plan remained instead of `[]`; green: 8/8. P2 red: WXML retry button absent; initial implementation exposed an unguarded tap `detail` access, corrected within the same handler; green with focused me suite: 14/14.
- Final focused command: `$JEST tests/consent-owner.test.js tests/board2-me.test.js --runInBand --coverage=false --silent`: 2 suites, 14 passed. Full `$JEST --runInBand --silent`: 39 suites, 519 passed / 29 skipped / 548 total. `git diff --check` passed. `$JEST` is the preinstalled shared binary described in `docs/consent-owner-isolation.md`; no dependencies installed.
- Evidence is source-level Page/data/service execution with wx/cloud/storage boundaries mocked; WXML binding inspection is not native rendering or device interaction evidence. Real cloud permissions, dual-user and device verification remain **Blocked**. No build/deployment/push, no ticket02 sync or ticket03 deletion semantic change, no production release claim.
- Retry cancellation follow-up within P2: an added real modal-cancel assertion was red (`offlineMode` incorrectly became true while consent remained granted). Cancellation now reflects actual consent, leaves the retry action visible, and does not pretend to withdraw consent. Focused 14/14 and full 39 suites / 519 passed / 29 skipped were rerun successfully after this change; final integration merge check remained already up to date.
