---
title: 全量动作选择器与目录裁剪
labels: [ready-for-human]
status: done
created: 2026-09-21
---

**历史轮次：已被 `.scratch/full-catalog/` 取代。** 本目录只保留早期 125 条精选与选择器方案的审计记录；选择器工具本身仍可独立使用，但不定义小程序当前目录。


**Spec 来源**：`docs/exercise-selector-prd.md`。

删除无可用 GIF 的 `3011/3021`，目录迁移升 v5；新增可直接打开的静态动作策展网页，浏览上游 1324 条动作、预览 GIF、多选并导出精选清单 JSON。

## Tickets

| # | 标题 | 依赖 | 状态 |
|---|---|---|---|
| 01 | 删除 3011/3021 与 v5 目录迁移 | 无 | done |
| 02 | 全量动作索引与筛选选择核心 | 无 | done |
| 03 | 静态网页、GIF 浏览、多选与 JSON 导出 | 02 | done |

## 完成标准

- 目录 v5 仓库自动化通过。
- 静态网页可直接打开，1324 条内置索引、导入、本地筛选、多选、分页 GIF 和 JSON 下载通过浏览器验收。
- CloudBase 对象实际清理仍保持人工操作边界，不由本票自动执行。

## 验证记录（2026-09-21）

三张票均已 done，转 `ready-for-human` 复核。

| 票 | 产物 | 自动化证据 |
|---|---|---|
| 01 | `data/curated-catalog.js`、`scripts/hand-overrides.js`、`utils/db.js`（v5）、重跑生成器 | `npx jest tests/catalog.test.js tests/db.test.js tests/upload-exercise-media.test.js --runInBand` 通过；125 条 / 250 媒体目标 / 热身 14 条 |
| 02 | `tools/exercise-selector/core.js`、`build-index.js`、`index-data.js` | `npx jest tests/exercise-selector.test.js --runInBand` 52 条通过；内置索引 1324 条、生成确定 |
| 03 | `tools/exercise-selector/index.html`、`styles.css`、`app.js`、`tests/exercise-selector-ui.test.js` | `npx jest tests/exercise-selector-ui.test.js --runInBand` 34 条通过；`agent-browser` 在 1440×1000 与 390×844 完成交互验收 |

仓库级验证：

```bash
npm test -- --runInBand
# 11 suites / 254 tests passed;覆盖率 94 / 84.56 / 97.61 / 96.29(阈值 80)

git diff --check
# exit 0
```

浏览器验收截图：`.pi/visual-tests/exercise-selector/desktop.png`、`mobile.png`（附加 `desktop-selected.png`、`mobile-selected.png`）。逐项命令与结果见各票「验证记录」。

## 剩余风险（人工复核时注意）

- 静态网页的 GIF/JPEG 全部来自 `raw.githubusercontent.com/hasaneyldrm/exercises-dataset`，**外部网络可变**：断网或上游改动时只能显示 JPEG 兜底或「GIF 不可用」文字占位（已用真实 404 验证兜底链路），页面不复制媒体。
- 上游仓库路径或前缀变动需人工更新 `tools/exercise-selector/app.js` 的 `MEDIA_BASE`。
- 选择摘要最多可渲染 1324 行（用户主动「选择当前结果」全量时），未做虚拟滚动；卡片本身只渲染当前页 48 条。
- 未做屏幕阅读器实测：aria/label/焦点为源级 + DOM 契约断言与键盘实测，非辅助技术端到端验证。
- `3011/3021` 的旧精选媒体删除记录属于历史轮次；当前 full-catalog 已确认两条媒体存在并纳入 2,590 个对象。
