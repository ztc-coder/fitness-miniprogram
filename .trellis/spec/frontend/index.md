# 前端开发指南

> 本项目前端开发的实际约定。

---

## 概览

技术栈:微信原生小程序(WXML / WXSS / JS),无 TypeScript,无跨端框架(不用 Taro / uni-app)。
后端:微信云开发 CloudBase(云数据库 + 云存储 + 云函数)。
测试:Jest,只测 `utils/domain.js` 这一个纯逻辑模块。

详见项目根目录 `README.md`(设计系统 FORGE / 晴空青黄配色、目录结构总览)与 `docs/spec.md`(需求规格)。

---

## 指南索引

| 指南 | 说明 | 状态 |
|-------|-------------|--------|
| [目录结构](./directory-structure.md) | 页面 / utils / data 的组织方式 | 已填写 |
| [组件规范](./component-guidelines.md) | 小程序 Page 组织、WXML/WXSS 约定 | 已填写 |
| [Hook 规范](./hook-guidelines.md) | 无 React hooks;对应生命周期与数据获取模式 | 已填写 |
| [状态管理](./state-management.md) | 本地存储 / 云数据库 / 页面 data 的分层 | 已填写 |
| [质量规范](./quality-guidelines.md) | 测试要求、代码风格、禁止模式 | 已填写 |
| [类型安全](./type-safety.md) | 无 TypeScript;JSDoc 注释约定 | 已填写 |

---

**语言约定**:本项目所有文档资产使用**简体中文**编写(代码内标识符、API 名称保持英文原样)。
