# 前端开发规范（微信原生小程序）

> 本目录是 `.trellis/spec/` 的前端层规范，供 `trellis-implement` / `trellis-check` 子代理与新人直接加载。
> **技术栈**：微信原生小程序（WXML / WXSS / JS），无 TypeScript、无跨端框架、无构建步骤（ADR-0002）。
> **语言**：所有文档、注释、提交说明使用**中文**。

---

## 阅读顺序

1. `CONTEXT.md`（仓库根，领域词汇表 + 关键规则 + 数据模型）——**改代码前必读**
2. 本目录下列规范文件
3. `docs/adr/`（架构决策，实现架构相关变更前先查是否已有约束）

---

## 规范索引

| 规范 | 内容 | 状态 |
|---|---|---|
| [目录结构](./directory-structure.md) | pages / components / utils / data / scripts / tests 的真实布局与放置规则 | 已完成 |
| [页面与组件规范](./component-guidelines.md) | `Page` / `Component` 写法、事件命名、setData 原子提交、WXSS token | 已完成 |
| [生命周期与可复用逻辑](./hook-guidelines.md) | 无 Hooks；生命周期用法、纯函数模块拆分、副作用注册 | 已完成 |
| [状态管理](./state-management.md) | 四层状态、存储 key 约定、`utils/db.js` 仓库模式、提交队列 | 已完成 |
| [类型与数据契约](./type-safety.md) | 无 TS；JSDoc、`CONTEXT.md` 契约、运行时归一与防御 | 已完成 |
| [质量规范](./quality-guidelines.md) | 测试与覆盖率、禁止模式、ADR / issue / 提交约定 | 已完成 |

思考指南见 [`../guides/`](../guides/index.md)（通用最佳实践，未做项目化改动）。

---

## 三条最容易被违反的约束

1. **规则只写在 `utils/domain.js`**：游标推进、快照复制、volume、队列判定四类逻辑不允许在页面里重复实现。
2. **数据访问只走 `utils/db.js`**：页面不直接调用 `wx.cloud`，云端失败必须降级到本地存储。
3. **媒体不进主包、不硬编码地址**：一律经 `data/media-root.js` 的 `resolveMedia(path)`，列表只加载 JPEG。

---

## 维护方式

- 本目录记录的是**代码实际做法**，不是理想规划；发现规范与代码不一致时，先确认代码意图，再同步文档。
- 从调试或实现中总结出的可复用约定，追加到对应文件（或新增文件并登记到上面的索引表）。
- 与架构层决策相关的变化写进 `docs/adr/`，不要只写在这里。
