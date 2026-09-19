# 类型与数据契约

> **本项目不使用 TypeScript**（ADR-0002），没有编译期类型检查。
> 类型安全靠三件事兜住：**JSDoc 注释 + `CONTEXT.md` 数据契约 + 运行时归一/防御**。

---

## 现实：没有类型系统

- `devDependencies` 只有 `jest`，没有 `tsc`、没有 ESLint 规则集、没有构建步骤。
- 字段拼写错误只能在**运行时或 Jest 测试**中暴露。
- 因此：**凡是跨模块传递的数据结构，必须有文档契约 + 归一函数**，不能靠记忆。

---

## 数据契约的唯一来源

`CONTEXT.md` §6 是数据模型的文档契约，代码变更必须同步更新：

```js
Plan    = { id, name, cycleDays: [{ dayId, name, exercises: [{ exerciseId, name, equipment, sets, targetReps, targetWeight }] }], cursor, active }
Session = { id, planId, planName, dayId, dayName, dayIndex, startedAt, submittedAt, exercises: [{ exerciseId, name, equipment, skipped, sets: [{ weight, reps }] }] }
Exercise= { id, name, nameZh, equipment, bodyPart, target, imagePath, gifPath, instructionSteps, aliases }
```

- 新增/改名字段时：先改 `CONTEXT.md`，再改代码，再补/改测试。
- 领域术语一律用 `CONTEXT.md` 词汇表里的**代码标识符**（如 `cursor`、`dayId`、`exerciseId`、`nameZh`），不要自造同义词。

---

## JSDoc 与注释约定

- 文件头：中文块注释说明职责与关键取舍（全仓库统一）。
- 非平凡函数：单行 `/** 中文说明 */` 或 `/** 入参 → 出参 示例 */`。示例：

```js
/** 2026年07月21日 · 周二 */
function formatDateLine(timestamp) { /* ... */ }

/** 12345 → "12,345" */
function formatNumber(n) { /* ... */ }

/** 秒 → "46m" / "1h12m" */
function formatDuration(sec) { /* ... */ }

/** 动作库入口带「加入」按钮;打卡页只看不选 */
showPick: { type: Boolean, value: false },
```

- 组件 `properties` 每个字段都要有类型 + 默认值 + 中文说明。
- 注释里出现的字段名必须与 `CONTEXT.md` 一致。

---

## 运行时防御（事实上的「类型检查」）

因为没编译期检查，**边界处一律做归一**：

```js
// utils/db.js —— 云端数据读回后统一过归一函数
function normalizePlan(raw) { /* 补默认值、修正字段名、丢弃脏数据 */ }
function migrateExercise(rawExercise) { /* 旧 slug id → 4 位数字 id，字段精简 */ }
```

约定：

- 外部输入（云端返回、本地存储、路由参数、脚本读入的数据集）先归一再用。
- 函数入参给默认值并防御：`function pageWindow(items, page = 1, pageSize = PAGE_SIZE)`、`onLoad(options = {})`、`Array.isArray(items) ? items : []`、`Number.isFinite(value) && value >= 1`。
- 数字入参统一用 `Number(...)` + `Number.isFinite` 收口，不要直接信任字符串。

---

## 枚举与常量：用常量，不用裸字符串

- 数据集英文原值（`equipment`、`bodyPart`、`target`）**按原值存储**，展示时经 label 函数映射：

```js
const { equipmentLabel } = require('../../data/exercises');
// data/exercises.js 导出：EQUIPMENT_FILTERS / PART_FILTERS / PART_LABELS
//                          equipmentBucket / equipmentLabel / bodyPartLabel / targetLabel / partTagsLabel
```

- 判定「自重动作」只认原值 `'body weight'`（`domain.isBodyWeight`），**不要**用筛选桶判断——筛选桶「自重」还含 `assisted`，两者语义不同（见 `CONTEXT.md` 器械筛选桶表）。
- 云端错误判定走 `db.isCloudError(err)`，不要在页面里 `err.message.includes(...)`。
- 存储 key、集合名、分页大小等都定义成模块级常量（`LOCAL_KEYS`、`COLLECTIONS`、`PAGE_SIZE`）。

---

## 对象与不可变

- `utils/domain.js` 的所有函数**返回新对象**（内部用 `clone` 深拷贝），不原地改传入的 `plan` / `session`。调用方依赖这一点，不要改成 mutate。
- 用作字典的临时对象用 `Object.create(null)`（`library-paging.js` 的 `uniqueItems`），避免原型键污染。
- 合并局部更新用 `Object.assign({}, 原对象, patch)`（`pages/me/me.js`）。

---

## 测试替代类型系统

核心规则集中在 `utils/domain.js` 并用 Jest 覆盖（ADR-0003），这是本项目对「没有类型系统」的正式缓解措施：

- 改动 `Plan` / `Session` 结构时，`tests/domain.test.js` 的 `buildPlan()` fixture 必须同步。
- 新增规则先写测试再实现，断言**外部行为**（返回值 / 产生的新结构），不断言内部实现。

---

## 相关文档

- `CONTEXT.md`（词汇表与数据模型速查）
- `docs/adr/0002-native-miniprogram-no-typescript.md`
- `docs/adr/0003-domain-logic-module-as-sole-test-seam.md`
