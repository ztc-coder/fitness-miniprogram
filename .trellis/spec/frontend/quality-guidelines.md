# 质量规范

> 本项目前端开发的代码质量标准。

---

## 概览

没有配置 ESLint / Prettier(项目内没有 `.eslintrc*` / `.prettierrc*`)。质量把关主要靠:Jest 单测覆盖率门槛 + 代码评审时对齐既有风格。风格一致性靠模仿现有代码,而不是工具强制。

## 测试要求

- 测试框架:Jest,配置见 `jest.config.js`。
- **只测 `utils/domain.js`**(`collectCoverageFrom: ['utils/domain.js']`),覆盖率门槛 branches/functions/lines/statements 均 **80%**。
- 测试文件放 `tests/`,命名 `<module>.test.js`,用 `describe` 按子能力分组(如「游标推进 advanceCursor」「打卡快照 snapshotSession」),`test` 描述用中文说明具体场景。
- 测试**只断言外部行为**(输入 → 输出),不断言内部实现细节。参考 `tests/domain.test.js` 顶部注释:"只断言输入/输出,不断言内部实现"。
- `db.js` 之类依赖 `wx.*` 的模块,测试里手写内存版 mock(`mockWx()`),不引入 mock 库,参考 `tests/db.test.js`。

跑测试:

```bash
npm install
npm test
```

新增/修改 `utils/domain.js` 里的函数,必须补充对应测试用例,且不能拉低覆盖率门槛。

## 代码风格

- 缩进 2 空格,字符串用单引号,语句结尾加分号——和现有文件保持一致(无 Prettier,靠人工对齐)。
- 中文注释、中文字符串、中文 commit message,变量名/函数名用英文驼峰。
- 模块顶部用 `// ===== 分区名 =====` 划分逻辑区块(参考 `utils/domain.js`、`utils/db.js` 的分区注释)。
- `module.exports` 放文件最底部,统一对象字面量导出所有公开函数。

## 禁止模式

- **禁止在页面 JS 里写业务规则**——游标推进、volume 计算等必须在 `utils/domain.js` 里实现并测试,页面只做"调用 + 展示"。
- **禁止本地写操作等云端返回后才生效**——所有写操作先写本地存储让 UI 立即响应,云端同步是 best-effort,失败只 `console.warn`,不抛出中断 UI(参考 `savePlan()`、`advancePlanCursor()`)。
- **禁止在多处重复格式化逻辑**——日期/数字/时长格式化统一走 `utils/format.js`,不要在页面里手写 `padStart`/日期拼接。
- **禁止跳过 `domain.js` 直接操作 `session`/`plan` 对象**——增删 set、增删动作、跳过动作等操作必须走 `domain.js` 里的纯函数(`updateSessionSet`、`addSessionSet` 等),保证返回新对象(不可变更新),不要直接 `session.exercises[i].sets.push(...)`。

## 无障碍

- 装饰性 / 纯视觉元素加 `aria-hidden="true"`(参考 `pages/today/today.wxml` 的 `hero-day-frame`、分隔线)。
- 目前项目规模小,未做系统性无障碍审查;新增交互元素时至少保证可点击区域有文本或图标语义,不强制额外规范。

## 已知技术债(如实记录,非改进任务)

- 无 lint/format 工具链,风格一致性纯靠人工对齐,新增代码前应参考同类文件的现有写法。
- 覆盖率门槛只覆盖 `domain.js`,`db.js`/`queue.js`/页面逻辑未纳入强制覆盖率(`tests/db.test.js` 存在但未加入 `collectCoverageFrom`)。
