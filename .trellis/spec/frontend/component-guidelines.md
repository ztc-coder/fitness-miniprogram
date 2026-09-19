# 页面与组件规范

> 本项目没有 React/Vue。视图层只有两种形态：**Page**（页面）与 **Component**（自定义组件），
> 都是微信原生 `Page({...})` / `Component({...})` 对象字面量。

---

## 页面（Page）

### 结构顺序

固定按这个顺序写，方便扫读：文件头注释 → `require` → 模块级常量 → `Page({ data, 生命周期, 事件处理, 私有方法 })`。

真实示例（`pages/library/library.js`）：

```js
/**
 * 动作库:离线浏览精选目录、搜索、器械桶 + 部位标签两维筛选
 * 三种打开方式:普通浏览 / pick=1(训练中临时加练) / planId + dayId
 */
const lib = require('../../data/exercises');
const media = require('../../data/media-root');
const paging = require('./library-paging');

const DRAFT_KEY = 'fitness:trainingDraft';

Page({
  data: { query: '', equipFilter: '全部', items: [], resultCount: 0 },
  onLoad(options = {}) { /* ... */ },
  onQueryInput(e) { this.applySearch({ query: e.detail.value }); },
});
```

### 文件头注释

每个页面/组件/工具模块顶部必须有一段中文块注释，说明**这个文件负责什么、关键取舍是什么**。仓库里所有文件都遵守（`utils/domain.js`、`utils/queue.js`、`pages/training/training.js`、`data/media-root.js` …），新增文件必须跟上。

### 生命周期用法

| 生命周期 | 本项目用途 |
|---|---|
| `onLoad(options)` | 只做一次性初始化（读路由参数、构建筛选项）；必须写默认值 `options = {}`，防止 `undefined` 解构 |
| `onShow()` | 刷新跨页可见数据（`pages/today/today.js` 的 `onShow` 调 `this.refresh()`）；不要在这里做重初始化 |
| `onUnload()` | 清理定时器 / 持久化草稿（`pages/training/training.js`） |

### 事件处理命名

- 统一 `onXxx` 前缀，语义化：`onInputWeight`、`onAddSet`、`onSkipExercise`、`onThumbError`、`onEquipFilterTap`。
- WXML 通过 `data-*` 传参，处理函数从 `e.currentTarget.dataset` 取。示例：

```html
<button class="btn-del" catchtap="onRemoveSet" data-ex="{{ex.exIndex}}" data-set="{{set.setIndex}}" aria-label="删除本组">
```

```js
onRemoveSet(e) {
  const { ex, set } = e.currentTarget.dataset;
  // ...
}
```

- 列表内按钮用 `catchtap` 阻止冒泡到行点击；整行点击用 `bindtap`。
- 图标/无文案按钮必须带 `aria-label`（如 `aria-label="暂停训练"`）。

### setData 规则

- **筛选/检索类状态必须与结果原子提交**：不要依赖 `setData` 回调再触发检索，回调可能晚于下一次事件，导致选中态变了列表没刷新。参考 `pages/library/library.js` 的 `applySearch(nextData)`——它同时算出新筛选条件和 `items/resultCount`，一次 `setData` 提交。
- 大结果集保留在页面实例（`this._matchedItems`），`data` 只放当前渲染窗口（每页 24 条）。

---

## 自定义组件（Component）

真实示例 `components/exercise-detail/exercise-detail.js`：

```js
Component({
  properties: {
    detail: { type: Object, value: null },
    showPick: { type: Boolean, value: false },
    pickText: { type: String, value: '加入训练' },
  },
  data: { mediaStages: [], stageIndex: 0 },
  observers: {
    detail(detail) {
      if (!detail) return;
      const mediaStages = [detail.gifSrc, detail.imageSrc].filter(Boolean);
      this.setData({ mediaStages, stageIndex: 0 });
    },
  },
  methods: {
    onClose() { this.triggerEvent('close'); },
    onPick() { this.triggerEvent('pick'); },
    onMediaError() { this.setData({ stageIndex: this.data.stageIndex + 1 }); },
    noop() {},
  },
});
```

约定：

- `properties` 每个字段都要有显式 `type` 与 `value`；带 `/** 中文说明 */` 注释。
- **组件不直接改父级数据**，只 `this.triggerEvent('xxx')`；父级在 WXML 上 `bind:xxx` 处理。
- 需要「同一组件、不同入口不同行为」时用 property 开关（`showPick`）而不是复制组件。
- 派生视图状态放 `observers`（本项目用 `observers`，未用 `properties` 的 observer 写法）。
- 组件无逻辑的占位方法命名 `noop`（用于 `catchtap` 吞事件）。
- 组件 `.json` 固定 `{ "component": true }`。

### 媒体降级链（组件内既有约定）

`exercise-detail` 的图片展示顺序是 **GIF → JPEG 示意图 → 首字 glyph**，靠 `mediaStages` + `binderror="onMediaError"` 逐级后退；`src` 为空直接跳过该级。新增任何媒体展示都应复用这条降级链，不要新写一套。

---

## 样式（WXSS）

- 设计 token 只在 `app.wxss` 的 `page { --bg: ...; --t-body: 28rpx; }` 里定义，页面 WXSS 一律 `var(--token)` 引用（`pages/training/training.wxss` 用了 58 处 `var(--…)`）。
- 尺寸单位统一 `rpx`；数字/数据类文本套 `.mono`（等宽 + `tabular-nums`）。
- 全局重置在 `app.wxss`（`box-sizing`、`button` 去默认样式、`button::after` 去边框），页面不要重复写。

---

## 相关文档

- 领域术语与页面职责表：`CONTEXT.md` §5
- 设计系统色板与 token：`app.wxss` 文件头（当前为浅色「晴空青黄」方向）
