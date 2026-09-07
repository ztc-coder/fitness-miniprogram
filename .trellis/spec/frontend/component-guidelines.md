# 组件规范

> 本项目中「组件」是如何构建的。

---

## 概览

微信原生小程序不用自定义 component,当前所有页面都是 `Page()` + WXML 模板,没有 `Component()` 自定义组件、没有跨页复用的 UI 组件库。以下规范针对 Page 级组织方式。

## Page 结构约定

参考 `pages/today/today.js`:

```js
const db = require('../../utils/db');
const domain = require('../../utils/domain');
const queue = require('../../utils/queue');
const fmt = require('../../utils/format');

const TRAINING_DRAFT_KEY = 'fitness:trainingDraft'; // 本地存储 key 常量提到顶部

Page({
  data: {
    // 只放 WXML 渲染需要的视图模型字段,不放原始业务对象的全部字段
    dateLine: '',
    plan: null,
    exercises: [],
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    // 拉数据 → 组装视图模型 → setData
  },

  buildView(plan) {
    // 把领域对象转成 WXML 友好的视图模型(格式化、派生字段)
  },

  onStartTraining() {
    // 事件处理器统一 on 前缀 + 驼峰,对应 WXML 里的 bindtap="onXxx"
  },
});
```

要点:

- `require` 顺序:先 `utils/db`,再 `utils/domain`,再 `utils/queue`,再 `utils/format`,最后本页专属常量/数据源(如 `data/exercises`)。
- 页面本地存储 key 用 `模块:含义` 格式的字符串常量,声明在文件顶部,例如 `fitness:trainingDraft`、`fitness:pendingQueue`。
- `data` 里只放视图模型(展示用字段),不直接把 domain 对象整体塞进 `data` 后在 WXML 里做逻辑判断——复杂派生逻辑在 JS 里通过 `buildView` / `renderExercises` 之类的方法算好,WXML 只做纯展示。参考 `pages/today/today.js` 的 `buildView()`、`pages/training/training.js` 的 `renderExercises()`。
- 事件处理器命名统一 `on` + 动作,如 `onStartTraining`、`onResumeDraft`、`onAddSet`、`onSkipExercise`,对应 WXML `bindtap="onXxx"`。

## WXML 约定

- 用 `wx:if` / `wx:else` 做条件渲染,`block wx:if` 包裹一组不需要额外容器的元素(参考 `pages/today/today.wxml` 顶层 `block`)。
- 列表用 `wx:for` + `wx:key`,`wx:key` 用业务唯一字段或 `index`(视图模型是纯展示数组时用 `index` 即可,参考 `exercise-list` 的 `wx:key="index"`)。
- 装饰性、无语义的元素加 `aria-hidden="true"`(参考 `hero-day-frame`、`cycle-dot` 的分隔线)。
- 按钮统一用 `class="primary-button"` / `class="ghost-button"`(定义在 `app.wxss`),配 `hover-class="cta-press" hover-stay-time="80"`,不要每个页面各写一套按钮样式。
- 关键结构块用注释标出分区,例如 `<!-- 顶栏：日期台 + 同步状态 -->`,注释统一中文。

## Props / 组件通信

目前无自定义组件,不涉及 props 设计。页面间传参走 `wx.navigateTo({ url: '/pages/xxx/xxx?key=value' })` 的 query string,复杂对象(如训练草稿)不通过 query 传,而是写入 `wx.setStorageSync` 后到目标页读取(参考 `TRAINING_DRAFT_KEY` 的用法)。

## 禁止事项

- 不要在 WXML 里写复杂表达式或多层三元(超过一层 `? :` 就下沉到 JS 算好塞进 `data`)。
- 不要引入自定义 component 或第三方 UI 组件库来复用「卡片」「按钮」之类的样式——目前靠 `app.wxss` 里的通用 class(`.primary-button`、`.section-kicker`、`.empty-state` 等)复用,新增通用样式先检查 `app.wxss` 有没有现成的。
