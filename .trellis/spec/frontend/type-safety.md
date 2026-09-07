# 类型安全

> 本项目中的类型安全实践。

---

## 概览

**没有 TypeScript**,纯 JavaScript(微信原生小程序标准写法)。类型信息靠 JSDoc 风格的函数注释表达,不做编译期类型检查,不引入 `.d.ts`、不引入运行时校验库(如 zod/yup)。

## JSDoc 注释约定

只在**领域逻辑函数**(`utils/domain.js`)上写参数/返回值说明,格式参考:

```js
/**
 * 完成驱动推进:打卡完成才推进游标;漏练(未完成)不改变游标。
 * @param plan Plan 对象(含 cycleDays、cursor)
 * @param completed 是否完成打卡
 * @returns 新的 plan(游标 +1,到末尾则回到开头);未完成返回原样
 */
function advanceCursor(plan, completed) {
```

要点:

- 第一行是函数用中文一句话说明"做什么",不重复参数细节。
- `@param` / `@returns` 后面直接写中文说明,不写类型标注(如 `{Plan}`),因为没有 TS 编译器会消费它,写类型标注只会增加维护负担且容易和实际漂移。
- 简单的工具函数(`format.js`)用简短的行内注释代替完整 JSDoc,例如 `/** 2026年07月21日 · 周二 */`,不用 `@param`/`@returns` 展开。
- 页面级方法(`pages/**/*.js`)只在逻辑不直观时加单行中文注释,不要求每个方法都有 JSDoc。

## 数据形状约定(非强制类型)

领域对象的形状靠代码里的构造函数和测试用例体现,不写单独的类型定义文件。关键形状:

- **Plan**:`{ id, name, cursor, active, cycleDays: Day[], createdAt }`
- **Day**:`{ dayId, name, exercises: PlanExercise[] }`
- **PlanExercise**:`{ exerciseId, name, equipment, sets, targetReps, targetWeight }`
- **Session**(打卡快照):`{ id, planId, planName, dayId, dayName, dayIndex, startedAt, submittedAt, exercises: SessionExercise[] }`
- **SessionExercise**:`{ exerciseId, name, equipment, skipped, sets: Set[] }`
- **Set**:`{ weight, reps }`(自重动作 `weight` 表示额外负重,为 0 或 null)

新增字段时,同步检查 `utils/db.js` 的 `normalizePlan()` / `buildSeedPlan()` 和 `tests/domain.test.js` 的 `buildPlan()` 测试夹具,保持形状一致。

## 空值处理约定

- 未填写的数值字段用 `null`,不用 `undefined` 或 `''`(参考 `updateSessionSet` 里 `value === '' || value === undefined ? null : value`)。
- 判空优先用 `!!x` 或显式 `x === null || x === undefined` 双重判断,不用 `x == null` 这种隐式相等。
- 数值计算前统一 `Number(x) || 0` 兜底,防止 `null`/`''` 参与运算产生 `NaN`(参考 `computeVolume`)。

## 禁止事项

- 不要引入 TypeScript 或 JSDoc `@type`/`@typedef` 全量类型标注——这是一次性决定,除非用户明确要求迁移,否则维持纯 JS。
- 不要引入运行时数据校验库,当前用简单的 `if (!plan || ...)` 前置判断即可。
