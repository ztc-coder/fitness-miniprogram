# 01：同意、所有者隔离与可信云数据入口

## 证据边界

此文件是源码配置说明，**没有部署或核实任何云环境**。当前没有隔离测试环境/双微信用户/真机；真实权限检查 Blocked，不能声称生产已隔离或正式可发布。媒体书面公开授权、运营者与公开隐私联系资料仍是发布阻断。

## 架构与公共接口

- `utils/cloud-service.js`：`restore / enable / disable / ready / snapshot / assertCurrent / subscribe`。产品同意单独保存于 `fitness:cloudConsent === true`；旧 openid、旧 offlineMode、平台隐私状态均不授予同意。启动仅恢复明确同意；取身份失败保留本地能力，状态为 failed，设置开关可重试或停用。停用立即阻断新请求并失效旧响应，但不能取消已经到达服务端的写入，不删除云端数据。
- `utils/owner-storage.js`：私人键通过 `getStorageSync / setStorageSync / removeStorageSync` 访问。新匿名数据继续存裸键；进入身份区后以 `fitness:owned:<原键>` 的 `{version:1,buckets:[{owner,value}]}` 信封保存，旧裸键只当作匿名区。旧 openid 不参与推断；未验证身份的冷启动不读其他所有者缓存。主题/设置不属于私人训练命名空间。
- `claimPreview / claimAnonymous(expectedOwner)`：先显示完整当前身份、计划/去重场次/草稿数量；只有用户明确确认归属才迁移匿名区。取消不展示、不上传匿名区。其他所有者桶永远不参与认领；当前身份已有同类数据时拒绝覆盖，不做隐式合并。每键写失败保留剩余匿名数据，已迁移键可再次认领补完；没有备份/跨设备冲突功能。
- `utils/owner-page.js`：包裹私人 Page 生命周期与用户动作。代际变化清空已渲染旧数据/停止训练资源；旧异步渲染与延迟确认不继续写入。重新显示旧页面时重新进入今天页。
- `utils/db.js` 原公共 API 保留，数据侧全部经过所有者存储；异步 CRUD 对身份/停用代际做响应检查。`utils/personal-cloud.js` 是个人云 RPC 适配，不再调用客户端 `wx.cloud.database()`。
- `utils/queue.js` 仍是训练完成日志执行器，只有本人云服务 ready 后才执行网络检测/上传；网络监听最多注册一次，停用期间重试为空操作。
- `data/media-root.js`：运行时只用受门控的 `resolveMedia`，未就绪返回空地址；`resolveAsset` 是离线部署工具的纯地址拼接函数，不供 Page 使用。媒体失败不阻挡训练，保留原署名。
- `pages/me/me.js`：离线开关实际控制产品同意/启用/停用；失败可点击重试；提供匿名数据认领。文案不把本地保存、空训练队列或停用称作全部数据已同步/删除。保留 04 的帮助入口。

## 云函数契约（供 02/03 承接）

`login` 仅返回可信 `openid`，无有效 OPENID 抛错，不再返回 unionid/appid。

`personalData` 入参：

```js
{ collection: 'plans' | 'sessions', action: 'list' | 'add' | 'set' | 'update' | 'remove',
  id, data, skip, limit }
```

- 不接受调用方提供的 owner 作为权限来源。顶层 `_id/_openid/owner` 不写入用户输入，只写白名单业务字段及可信 `_openid`。
- list 始终 `where({_openid: OPENID})`，固定集合对应排序；默认 20 条，上限 100。前端历史已有分页，**计划完整分页与可靠持久任务交给 02**。
- 更新/删除/覆盖既有文档前核对 `_openid`；猜中他人的 `_id` 也拒绝。缺失文档的逻辑 ID 用 `owned_ + sha256(OPENID + '\0' + logicalId)` 隔离，幂等 set 返回实际 `_id`，更新/删除同样解析此命名空间。会兼容旧客户端生成的本人云 `_id`。
- 当前服务端写入口是 02 的收敛点；**尚无删除代际屏障、计划持久重试或多设备版本校验**。03 实施删除时，必须在此入口的所有写操作统一加入屏障，不得仅在客户端清队列。

## 以后获得隔离环境授权时的配置步骤（本轮不要执行）

1. 使用自行部署者自己的 AppID/环境；检查 `app.js` 已不承载环境配置，环境 ID 位于 `utils/cloud-service.js`，媒体根位于 `data/media-root.js`，不要误连现有生产环境。
2. 在该环境建立 `plans`、`sessions`；将 `cloudfunctions/personalData/client-permissions.json` 分别应用到两集合的自定义安全规则：`{"read":false,"write":false}`。也可使用等价“所有用户不可读写”基础权限；不要仅保留“创建者可写”。
3. 在隔离环境部署 `login`、`personalData` 及各自 package.json 声明的 SDK。管理 SDK 不受客户端规则限制，必须保留函数内可信身份核对。无客户端读写可以绕过服务端统一校验；运行时个人数据只调用云函数，因此与全拒绝规则兼容。公共动作媒体存储权限另行核实，不能沿用个人集合规则。
4. 分别用 A/B 两个真实微信身份验证：无身份拒绝；list 只返回本人；伪造 owner 被忽略；B 猜 A 文档 ID 的 set/update/remove 拒绝；客户端直接 get/add/set/update/remove 全部拒绝；A 的逻辑 ID 重复 set 只有一份；在本机切换身份看不到 A 的缓存/草稿/队列。
5. 记录环境、版本、规则截图、时间与原始结果；失败不得放开客户端写权限绕过问题。真实证据归 05，部署/控制台变更需再次取得人工授权。

官方资料（实施时已读取）：

- [getWXContext](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/reference-sdk-api/utils/Cloud.getWXContext.html)：OPENID 来自小程序调用上下文；必须在函数入口内读取，不能在 exports.main 外取得。
- [数据库安全规则](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide/database/security-rules.html)：规则限制前端请求；本人自定义规则要求查询条件包含 owner，`doc.set` 不能直接照搬本人规则。这里选择全部客户端拒绝并统一走可信云函数，不依赖原先无过滤的客户端查询。

## TDD 与回归记录

已确认 seam：domain/data 公开 API、Page 生命周期/用户操作、云函数 main；新增用例只 mock wx/云/时间/存储。

测试命令中的 `JEST` 为共享已安装依赖 `/Users/ztc/fitness-miniprogram/node_modules/.bin/jest`（worktree 未安装依赖，没有安装/下载数据）。

| 纵向切片 | Red 命令与结果 | Green 命令与结果 |
|---|---|---|
| 未同意本地计划/历史/媒体 | `npx jest tests/consent-owner.test.js --runInBand --coverage=false`：失败 unexpected direct database；旧 eager 网络 timer 导致进程不退出 | `$JEST tests/consent-owner.test.js --runInBand --coverage=false --silent`：通过 |
| 身份缓存/认领/重启 | 同上聚焦命令：新增用例失败 owner-storage 模块不存在 | 同命令：2 用例通过 |
| 身份失败与迟到响应 | 同命令：迟到请求没有进入受保护 RPC（resolve 未赋值） | 同命令：3 用例通过 |
| 我的同意用户动作 | 同命令：无同意 modal | 同命令：4 用例通过 |
| 旧 Page 延迟确认 | 同命令：B 的本地计划错误包含 A 数据 | 同命令：5 用例通过 |
| 可信云函数入口 | `$JEST tests/personal-cloud.test.js --runInBand --coverage=false --silent`：新增入口不存在（修正测试夹具语法后确认功能红灯） | 同命令：越权/缺失身份用例通过 |
| 本人逻辑 ID 幂等写/删 | 同上命令：实际 _id 未返回，不能解析逻辑 ID 删除 | 同命令：2 用例通过 |

旧测试的变化限定为新契约：明确需要云端时使用 wx/云/存储夹具启用本人服务；同意前期待占位媒体；主题/小结历史仍通过本地数据验证。`tests/helpers/cloud-runtime.js` 只适配云/存储边界，不 mock 项目模块。目录临时数据夹具修复来自 integration，未重复修改。

最终验证结果见本票本地 tracker；均不代表云端/真机证据。
