# 质量规范

> 唯一工具链是 `jest`（`npm test` = `jest --coverage`）。没有 lint、没有类型检查、没有 CI 配置，
> 质量靠**测试 + 分层约束 + 提交/文档流程**保证。

---

## 验证命令

```bash
npm test          # jest --coverage，全部 tests/*.test.js
npx jest tests/domain.test.js   # 单文件
```

- `jest.config.js`：`testEnvironment: 'node'`，`testMatch: ['**/tests/**/*.test.js']`。
- 覆盖率只统计 `utils/domain.js` 与 `data/exercises.js`，阈值 **branches/functions/lines/statements 均为 80%**。
- 改这两个文件后必须跑 `npm test` 且覆盖率不低于阈值。

---

## 测试要求

| 范围 | 要求 |
|---|---|
| `utils/domain.js` | 必须覆盖；只断言外部行为（输入/输出），不断言内部实现 |
| `data/exercises.js`（含精选目录） | 必须覆盖（`tests/catalog.test.js`） |
| `pages/library/library-paging.js` | 已覆盖（`tests/library-paging.test.js`），分页/去重/预热窗口改动必须补测试 |
| `utils/db.js` | `tests/db.test.js` 用内存版 `wx` mock（`mockWx()`）验证「云端不可用时写穿本地」 |
| `utils/queue.js`、页面 UI、WXSS | 无自动化覆盖；改动靠微信开发者工具手动验证，需在汇报里写明验证方式 |
| `scripts/*.js` | 一次性脚本，无单测（`upload-exercise-media` 有对应测试：`tests/upload-exercise-media.test.js`） |

测试写法约定：

- `tests/` 平铺，不镜像源码目录。
- 用 builder 函数造 fixture（`tests/domain.test.js` 的 `buildPlan(overrides)`、`library-paging.test.js` 的 `buildItems(count)`），不要在用例里手抄大对象。
- `describe` / `test` 名称用中文描述行为（如 `test('完成打卡后游标 +1')`）。

---

## 禁止模式

1. **在页面/云函数里重复实现 domain 规则**。游标推进、快照复制、volume 计算、队列判定只存在于 `utils/domain.js`；页面只能 `require('../utils/domain')` 调用（ADR-0003）。
2. **页面直接调用 `wx.cloud.database()`**。数据访问统一走 `utils/db.js`（全仓库仅 `utils/db.js` 与 `app.js` 的 `wx.cloud.init` 触碰 `wx.cloud`）。
3. **绕过 `domain` 的 volume 口径**。完成小结与记录趋势必须共用 `computeVolume()` / `computeSessionTotalVolume()`，禁止各写一份（两处口径漂移是本项目明确要防的问题）。
4. **硬编码媒体地址**。一律 `data/media-root.js` 的 `resolveMedia(path)`；禁止热链 GitHub / jsDelivr，禁止把 GIF/JPEG 打进主包（版权与包体积双重约束）。
5. **列表加载 GIF**。动作库列表只用 JPEG 缩略图（每页 24 条，预热当前页与下一页），GIF 只在详情弹层加载。
6. **依赖 `setData` 回调做检索**。筛选状态与结果必须原子提交（见 `pages/library/library.js` → `applySearch`）。
7. **手改生成的数据分片**。`data/exercises-data-1.js` 由 `scripts/build-exercises.js` + `data/curated-catalog.js` 生成；改目录要改白名单/脚本再重新生成。
8. **把媒体路径写进 session 快照**。session 只存 `exerciseId / name / equipment`，媒体靠 `lib.findById(exerciseId)` 反查（ADR-0007）。
9. **新增运行时依赖或构建链路**。`devDependencies` 只有 jest，仓库无构建步骤（ADR-0002）；引入框架/TS/打包器需先开 ADR。
10. **在提交历史里删除或改写 ADR**。决策被推翻时新增一篇并标注取代关系。

---

## 文档与流程

- **改代码前先读 `CONTEXT.md`**（领域词汇表 + 关键规则 + 数据模型）；术语必须与它一致。
- **新领域概念** → 补进 `CONTEXT.md`；**架构决策** → 在 `docs/adr/` 追加 `NNNN-kebab-title.md`（Context / Decision / Consequences），并更新 `docs/adr/README.md` 索引。
- **需求与 issue** → 本地 markdown：`.scratch/<feature>/issue.md`，带 YAML frontmatter（`title` / `labels` / `status` / `created`），标签用 `needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`（ADR-0006，不使用 GitHub Issues）。
- **提交信息** → Conventional Commits：type/scope 英文小写，描述与正文中文。示例（真实历史）：

```
feat(library): 完成动作目录扩展与媒体同步
fix(library): 顶层 require 目录分片并避免 onLoad 抛错
fix(library): 拆分动作目录以避开微信单文件体积上限
```

---

## 样式与可访问性

- 颜色/字号只用 `app.wxss` 定义的 CSS 变量，不写裸色值（页面 WXSS 大量使用 `var(--…)`）。
- 尺寸单位 `rpx`；数字类文本套 `.mono`。
- 仅图标按钮必须带 `aria-label`（如 `aria-label="暂停训练"`、`aria-label="删除本组"`）。
- 媒体展示必须走 GIF → JPEG → glyph 的降级链，`binderror` 不能静默失败。

---

## 已知技术债（记录现状，不在此处修）

- `utils/queue.js`、页面 UI 无自动化测试，靠开发者工具手测。
- `CONTEXT.md` §7 仍写着旧的深色 FORGE 设计系统，而 `app.wxss` 实际是浅色「晴空青黄」；两处尚未对齐。
- 覆盖率报告只反映 domain 与目录层，不代表整体质量。

---

## 相关文档

- `docs/adr/`（0002 / 0003 / 0004 / 0005 / 0006 / 0007）
- `docs/agents/issue-tracker.md`、`docs/agents/triage-labels.md`
