# Hook 规范

> 本项目中「hook」概念对应的模式。

---

## 概览

微信原生小程序没有 React hooks 概念,不用 `useState` / `useEffect` 之类的机制。以下记录本项目里承担相同职责(生命周期、数据获取、跨页共享逻辑)的实际模式。

## 页面生命周期对应关系

| React 概念 | 本项目对应写法 |
|---|---|
| `useEffect` 挂载时拉数据 | `Page().onLoad()` 或 `onShow()`,视是否需要每次显示都刷新而定 |
| 组件卸载清理副作用 | `Page().onUnload()`,例如 `clearInterval(this.timer)`(参考 `pages/training/training.js`) |
| 每次聚焦重新拉数据 | `onShow()`,如 `pages/today/today.js`、`pages/plan/plan.js` 的 `onShow() { this.refresh(); }` |
| 跨页返回后同步外部状态变化 | `onShow()` 里重读本地存储草稿并比对 id,参考 `pages/training/training.js` 的 `onShow()` 从动作库返回后重新渲染草稿 |

`onLoad` 只在页面首次创建时跑一次,用于依赖 query 参数的初始化(参考 `pages/training/training.js` 的 `onLoad()` 读草稿、没有草稿就 `navigateBack`)。`onShow` 每次页面重新可见都会跑,用于「离开又回来数据可能变了」的场景。

## 数据获取模式

统一走 `utils/db.js` 暴露的 Promise 函数,不在页面里直接调 `wx.cloud.database()`:

```js
refresh() {
  db.ensureSeedPlans().then((plans) => {
    const plan = plans.find((p) => p.active) || plans[0] || null;
    this.setData({ plan, ... });
  });
},
```

- 页面方法名统一叫 `refresh()`,承担"拉数据 + setData"的职责,`onShow` 里直接调用它。
- 定时刷新用原生 `setInterval` / `setTimeout`,在 `onUnload` 清理,不引入额外的定时器封装。

## 跨页共享状态

没有全局状态管理库,跨页共享状态用两种方式,按数据生命周期选择:

1. **跨页临时数据**(如训练草稿):`wx.setStorageSync` / `wx.getStorageSync`,页面在 `onShow`/`onLoad` 主动重新读取,参考 `TRAINING_DRAFT_KEY`。
2. **应用级瞬时状态**(不需要持久化,只在当前小程序运行期间有效):`app.globalData`,参考 `app.js` 的 `globalData: { openid, activeTraining }`。

## 禁止事项

- 不要为了"复用逻辑"引入自定义 hook 式的封装函数模拟 React 写法——微信小程序的 Page 生命周期和数据流是同步的,直接在对应生命周期方法里写就够。
- 不要把跨页共享逻辑做成全局单例状态管理(如手写 store/pub-sub),本项目规模下 `globalData` + 本地存储已经够用。
