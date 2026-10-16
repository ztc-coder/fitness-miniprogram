# 微信 API 实施依据

来源：researcher 只读调研，完整笔记 `/tmp/set-by-set-training-wx-api.md`。本文件保留实施所需来源和能力边界，避免临时目录清理后失去依据。没有真机结果。

## 提醒与生命周期（02）

- [createInnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createInnerAudioContext.html)、[InnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.html)：显式 `play()`，不要 autoplay / loop；音频资源不会自动释放，页面 `onHide/onUnload` 调 `destroy()`。`onError` 和同步调用异常均只降级，不阻塞训练。
- 官方格式表支持 iOS / Android 的 WAV。优先自主合成短 PCM WAV，记录生成方式和许可，随代码包发布，不依赖网络。
- 代码包根路径的支持由[官方同源音频指南](https://mp.weixin.qq.com/debug/minigame/dev/guide/base-ability/audio.html)与[开发者社区回复](https://developers.weixin.qq.com/community/develop/doc/0000ee8f36cd302e92197ad7a5e400)交叉佐证。小程序 `src` 条目未逐字取证“代码包路径”，需要真机确认离线加载。
- [setInnerAudioOption](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.setInnerAudioOption.html)：保持默认遵循静音开关，不主动覆盖全局音频选项。不要承诺静音下必响；真实 iOS / Android 表现另验。
- [vibrateShort](https://developers.weixin.qq.com/miniprogram/dev/api/device/vibrate/wx.vibrateShort.html)：15ms；`type` 用 `light`（2.13.0 起支持），`fail` 静默降级。旧设备或不支持档位时无需重试长振动。
- [运行机制](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/operating-mechanism.html)、[Page 生命周期](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html)：后台 JS 会挂起，定时器不保证触发；隐藏清理运行时资源，不改非主动暂停的业务截止时间；`onShow` 校准并最多补一次前台提醒。不使用后台音频或系统通知保活。

## 新场次幂等上传（03）

- [Document.set](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/database/document/Document.set.html)、[更新指南](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide/database/update.html)：`collection('sessions').doc(session.id).set({ data })` 替换更新；指定 ID 不存在则创建。稳定 id 避免服务端成功、本地确认丢失后的重试产生重复场次。
- 场次 `submittedAt` 固定为本地完成时间，网络重试不能改时长或再次推进计划。云端失败只保留待同步状态，不否定本地完成。
- 发送完整快照时剔除 `_id` / `_openid` 等服务端字段；系统自动设置创建者，不允许调用者修改 `_openid`。
- 返回 `stats.created / stats.updated`；明确返回二者均为 0 时不能视为已同步。拒绝或权限失败保留队列。
- [简易权限](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide/database/legacy-permission.html)：沿用项目已要求的“仅创建者可读写”。不扩大权限，不为实现幂等改成公开写入。
- [安全规则](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide/database/security-rules.html)：若集合采用自定义安全规则，客户端 `doc.set` 可能不满足查询规则，需要云函数或合规的条件更新。不要把简易权限下的实现保证推广到所有规则模式。

## 未覆盖

`doc.set` 的越权错误形态、真实集合权限、稳定 id 参数在实际基础库中的表现，以及静音、振动、锁屏 / 进程恢复 / WXML，必须在微信端验证。无相关凭据或设备时，保持人工验收未完成。不得用 mock 的成功响应宣称云端或真机通过。