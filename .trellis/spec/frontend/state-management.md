# 状态管理

> 本项目中状态是如何管理的。

---

## 概览

没有 Redux/MobX/Zustand 之类的状态库。状态分三层,按生命周期和共享范围区分:

| 层级 | 载体 | 生命周期 | 典型数据 |
|---|---|---|---|
| 页面视图状态 | `Page().data` | 页面存在期间 | 格式化后的展示字段(`dateLine`、`exercises` 视图模型) |
| 跨页/跨会话本地状态 | `wx.setStorageSync` / `getStorageSync` | 持久化到设备,主动清除前一直存在 | 训练草稿、待提交队列、种子数据版本号 |
| 服务端权威状态 | CloudBase 云数据库 | 永久,多设备共享(同一用户) | `plans`、`sessions` 集合 |
| 应用级瞬时状态 | `app.globalData` | 当前小程序运行期间,重启后清空 | `openid`、`activeTraining` |

## 本地状态(page data)

`data` 里只放 WXML 直接渲染需要的字段,是"视图模型"而不是原始领域对象的直接映射。复杂派生(格式化、百分比、分组)在 JS 方法里算好再 `setData`,参考 `pages/today/today.js` 的 `buildView()` 把 `plan.cycleDays[dayIndex]` 转成 `dayNum`、`dayTotal`、`cycleDots` 等展示字段。

## 本地持久化(local storage)

本地存储 key 全部用 `模块前缀:含义` 格式的字符串常量,统一定义在使用它的文件顶部:

```js
const LOCAL_KEYS = {
  PLANS: 'fitness:plans',
  SEED_VERSION: 'fitness:seedVersion',
};
```

本地存储承担两种职责:

1. **云端降级缓存**——`utils/db.js` 里 `fetchPlans()` 云端读取失败时降级读本地缓存;`savePlan()` 本地写穿(立即生效),云端 best-effort 异步同步。
2. **离线草稿的唯一真相来源**——训练进行中的草稿(`fitness:trainingDraft`)、待提交队列(`fitness:pendingQueue`)全程只存本地,直到训练结束提交那一刻才需要联网。

**写穿原则**:任何写操作(新建计划、推进游标、增删训练日)先写本地存储让 UI 立即生效,再异步同步云端;云端失败不回滚本地、不阻塞 UI,只 `console.warn`。参考 `utils/db.js` 的 `savePlan()`、`advancePlanCursor()`。

## 服务端状态(CloudBase)

两个集合:`plans`(训练计划)、`sessions`(已提交的训练记录快照)。访问统一走 `utils/db.js` 的仓库模式函数(`fetchPlans`、`savePlan`、`submitSession`、`fetchSessions`),页面和其他 utils 模块不直接调 `wx.cloud.database()`。

`sessions` 一旦提交视为不可变快照,后续计划变更不影响历史记录(参考 `docs/spec.md` "记录不可变" 一节)。

## 提交队列的状态流转

训练结束提交是唯一需要联网的时刻。状态流转由 `utils/domain.js` 的 `decideSubmission` 纯函数判定(`idle` / `queued` / `retry` / `submit-now`),真实网络请求由 `utils/queue.js` 注入执行,两者分离便于 `decideSubmission` 被 Jest 测试覆盖。

## 禁止事项

- 不要引入状态管理库——当前状态复杂度用 `data` + 本地存储 + `globalData` 已经覆盖,没有必要的抽象不要加。
- 不要在页面 `data` 里直接存 CloudBase 返回的原始文档对象(带 `_id` 等云端字段),统一先过 `normalizePlan()` 之类的归一化函数。
- 不要绕过 `utils/db.js` 直接在页面里调用 `wx.cloud.database()`。
