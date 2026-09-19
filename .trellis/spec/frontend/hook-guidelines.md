# 生命周期与可复用逻辑

> **本项目没有 React Hooks**（微信原生小程序，无框架、无构建，见 ADR-0002）。
> 本文件记录的是与之等价的真实约定：**生命周期怎么用**，以及**跨页面复用的逻辑放在哪**。

---

## 没有 hook，用什么替代

| 需求 | 本项目做法 | 真实示例 |
|---|---|---|
| 跨组件复用有状态 UI 逻辑 | 自定义组件（`Component`） | `components/exercise-detail/` |
| 跨页面复用无状态计算 | 独立纯函数模块，页面 `require` | `utils/format.js`、`pages/library/library-paging.js` |
| 跨页面复用「规则」 | 一律进 `utils/domain.js` | `snapshotSession`、`computeVolume`、`decideSubmission` |
| 跨页面共享可变状态 | `app.globalData` + `wx.setStorageSync` | `app.js` 的 `globalData.activeTraining` |
| 副作用编排（网络、监听） | 单独的执行器模块 | `utils/queue.js` |

原则：**能写成纯函数的逻辑不要放进页面生命周期**。页面只做「取数据 → 映射成视图字段 → setData」。

---

## 可复用模块的写法

拆出的模块遵守与 `utils/domain.js` 相同的风格：文件头中文块注释 + 命名导出 + 无运行时依赖。

```js
/**
 * 动作库分页与缩略图预热的纯函数。
 * 页面保留完整匹配集，渲染层只展开当前页；预热窗口始终限制为当前页与下一页。
 */
const PAGE_SIZE = 24;
const PREHEAT_PAGE_COUNT = 2;

function pageWindow(items, page = 1, pageSize = PAGE_SIZE) { /* ... */ }

module.exports = { PAGE_SIZE, PREHEAT_PAGE_COUNT, uniqueItems, pageWindow, preheatWindow };
```

约定：

- 所有入参给默认值并做防御（`pageWindow` 里 `uniqueItems` 兜 `Array.isArray`、`normalizePage` 兜非数字与越界）。
- 常量与函数一起导出，调用方不复制魔数（页面不写 `24`，用 `paging.PAGE_SIZE`）。
- 模块命名 `xxx-paging.js` / `format.js` 这类「能力名」，页面目录下放页面专属模块，跨页面放 `utils/`。

---

## 生命周期调用链的真实约定

```js
// pages/today/today.js
onShow() {
  this.refresh();   // 每次回到页面都重新读 active 计划、草稿、待提交队列
},
```

- **读取类刷新放 `onShow`**，保证从训练页/计划页返回时数据是新的。
- **一次性初始化放 `onLoad`**（路由参数、静态筛选项列表），不要重复做。
- **清理放 `onUnload`**（保存训练草稿、停定时器）。
- 生命周期里不要直接写业务规则，调用 `db.*` / `domain.*` / `queue.*`。

---

## 副作用与监听

网络恢复监听、定时重试这类副作用集中在一个模块里注册一次，由 `app.js` 的 `onLaunch` 调起：

```js
// app.js
queue.watchNetwork();
```

不要在多个页面里重复 `wx.onNetworkStatusChange`。定时器必须在页面/模块卸载时清掉。

---

## 相关文档

- 分层职责：`CONTEXT.md` §4
- 测试 seam 决策：`docs/adr/0003-domain-logic-module-as-sole-test-seam.md`
