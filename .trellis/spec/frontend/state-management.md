# 状态管理

> 没有状态管理库（无 Redux/MobX/Vuex，`devDependencies` 只有 jest）。
> 状态分四层：**页面 data → 页面实例私有字段 → app.globalData → 本地存储 / 云数据库**。

---

## 四层状态与放置规则

| 层 | 存放什么 | 生命周期 | 真实示例 |
|---|---|---|---|
| 页面 `data` | 只放渲染需要的字段 | 随页面销毁 | `pages/library/library.js` 的 `items / resultCount / hasMore` |
| 页面实例字段 `this._x` | 大结果集、内部游标，不需要渲染 | 随页面销毁 | `this._matchedItems`、`this._page` |
| `app.globalData` | 跨页共享的少量可变状态 | 随小程序 | `openid`、`activeTraining` 训练草稿 |
| 本地存储 / 云数据库 | 需要持久化的数据 | 永久 | `fitness:plans`、`fitness:pendingQueue` |

判断顺序：只在当前页面渲染用 → `data`；只是中间结果 → `this._x`；要跨页 → `globalData` 或存储；要跨启动 → 存储 + 云端。

---

## 页面 data：原子提交

**反模式**：先 `setData({ filter })`，再在回调里重新检索。回调可能晚于下一次事件，导致「选中态变了、列表没刷新」。

**正确做法**（`pages/library/library.js` → `applySearch(nextData)`）：一次算出筛选条件 + 结果 + 分页，单次 `setData` 提交。

```js
/**
 * 把筛选条件与结果一次提交。不能依赖 setData 回调触发检索：
 * 在部分运行态中，回调晚于下一次事件，导致选中态变更而列表未刷新。
 */
applySearch(nextData = {}) {
  const has = (key) => Object.prototype.hasOwnProperty.call(nextData, key);
  const query = has('query') ? nextData.query : this.data.query;
  // ...算出 _matchedItems，再 renderPage(nextData) 一次提交
}
```

`applySearch` 用 `hasOwnProperty` 区分「显式传了 undefined」与「没传」，保证局部更新不丢字段。

---

## 本地存储：key 命名与归属

所有 key 统一 `fitness:` 前缀，在**使用它的模块顶部**声明为常量，不在页面里散写字面量：

| Key | 声明位置 | 内容 |
|---|---|---|
| `fitness:plans` | `utils/db.js` → `LOCAL_KEYS` | 计划列表的本地镜像 |
| `fitness:seedVersion` / `fitness:planMigrationVersion` / `fitness:planMigrationCloudSynced` | `utils/db.js` → `LOCAL_KEYS` | 一次性迁移与播种版本号 |
| `fitness:pendingQueue` | `utils/queue.js` → `QUEUE_KEY` | 待提交 session 队列 |
| `fitness:trainingDraft` | `pages/today/today.js`、`pages/training/training.js`、`pages/library/library.js` | 进行中训练草稿 |
| `fitness:settings` | `pages/me/me.js` | 用户设置 |

新增 key 必须加 `fitness:` 前缀，并只在唯一一个模块里定义常量（其他模块 `require` 或复用同一常量）。

---

## 数据访问：统一走 `utils/db.js`

- 页面**不直接调用** `wx.cloud.database()`（全仓库只有 `utils/db.js` 与 `app.js` 的 `wx.cloud.init` 出现 `wx.cloud`）。
- `utils/db.js` 是仓库模式：云数据库优先，失败降级到 `wx.getStorageSync` / `wx.setStorageSync`，保证无网时本地记录仍然成立（ADR-0005）。
- 对外导出固定这批函数：`fetchPlans / savePlan / deletePlan / advancePlanCursor / setActivePlan / submitSession / fetchSessions / ensureSeedPlans / migratePlansForCatalog / isCloudError`。
- 数据从云端读回时必须过 `normalizePlan` / `migrateExercise` 做字段归一，页面拿到的是已归一对象。

---

## 提交队列：唯一允许的「延迟写」

离线优先的核心是**训练结束那一刻才联网**：

```
pages/training onFinish
  → queue.push(session)          // 先入队，本地记录立即成立
      → domain.enqueueSession    // 纯判定
      → domain.decideSubmission  // 纯判定
      → db.submitSession         // 真实网络请求（由 queue 注入）
      → 失败: domain.markAttemptFailed，等待网络恢复重试
```

- 队列判定是纯函数（`utils/domain.js`），网络请求由 `utils/queue.js` 注入；页面不感知重试细节。
- `watchNetwork()` 在 `app.js` `onLaunch` 注册一次。

---

## 跨页通信

- 读多写少的共享数据用 `app.globalData`（`getApp()` 获取）。
- 需要「返回上一页并带结果」时用页面栈 API 或存储草稿，不要自造事件总线。
- 训练草稿（`fitness:trainingDraft`）是跨页共享的既有机制：训练页写、今天页读来判断「继续训练」。

---

## 相关文档

- 离线优先决策：`docs/adr/0005-offline-first-local-cache-with-submit-queue.md`
- 快照与不可变历史：`docs/adr/0004-snapshot-sessions-immutable-history.md`
