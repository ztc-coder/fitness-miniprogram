---
title: 静态网页、GIF 浏览、多选与 JSON 导出
labels: [ready-for-human]
status: done
created: 2026-09-21
---

# 03: 静态网页、GIF 浏览、多选与 JSON 导出

## Blocked by

02: 全量动作索引与筛选选择核心。

## What to build

在 `tools/exercise-selector/` 完成无需构建的静态工作台 UI，接上内置索引与导入、分组筛选、分页 GIF、多选摘要和 JSON 下载。

## Acceptance

- [x] 直接打开 `index.html` 可工作，无服务器和构建步骤。
- [x] 桌面为筛选侧栏 + 浏览区 + 选择摘要；移动端单列，无重叠或溢出。
- [x] 部位/器械分组切换、AND 筛选、分页和结果计数接入核心函数。
- [x] 当前页最多 48 个 GIF，加载中/失败状态明确。
- [x] 多选、选择当前结果、清空、摘要移除和导出下载完整可用。
- [x] 本地 JSON 导入只在浏览器读取，不上传；成功与错误反馈明确，超过 32 MiB 的文件在读取前拒绝。
- [x] 使用 `agent-browser` 在桌面与移动视口完成交互和截图验证。

## Verification

```bash
npx jest tests/exercise-selector-ui.test.js tests/exercise-selector.test.js --runInBand
npm test -- --runInBand
node --check tools/exercise-selector/app.js tests/exercise-selector-ui.test.js
git diff --check
# 浏览器验收：file:///…/tools/exercise-selector/index.html（见票内记录）
```

## 验证记录（2026-09-21）

改动文件：

| 文件 | 改动 |
|---|---|
| `tools/exercise-selector/index.html` | 新增静态工作台骨架：紧凑顶栏（标题 + 结果/总数/已选计数 + 保存 JSON + 导入数据集）、`role=status`/`role=alert` 两个反馈区、左筛选面板（分组 radio 段控、关键词 search、部位/器械 select、选择当前结果/清空选择）、中浏览区（`#cards` + 分页）、右「已选动作」摘要、Gym visual 署名页脚。按 `core.js → index-data.js → app.js` 顺序用普通 `<script src>` 加载，无 module、无内联脚本、无预置 `<img>` |
| `tools/exercise-selector/styles.css` | 新增样式：浅灰工作台底色 `--bg #ecedea`、墨绿主文字 `--ink #1e3b32`、琥珀选择态 `--accent #b4761a`；桌面 `216px / minmax(0,1fr) / 264px` 三栏（筛选与摘要 sticky），`@media (max-width:900px)` 单列；卡片圆角 8px（≤8px）、无渐变、无嵌套卡片（浏览区不做白色面板）、无 clamp/vw 字号与 transform scale；`:focus-visible` 2px 琥珀描边、`accent-color` 原生控件强调色；`aspect-ratio:1/1` 方形缩略图 + `object-fit:contain` |
| `tools/exercise-selector/app.js` | 新增界面逻辑（UMD：浏览器挂全局 `ExerciseSelectorApp` 并 `init()`，Node/Jest 直接 require 纯函数）。媒体 URL 用官方 raw 前缀拼相对路径；`buildGroups` 只把当前页 items 切成组（组标题显示筛选后整组条数 + 本页条数）；`buildOptions`/`parseDataset`/`pruneSelection`/`serializeExport` 为可测纯函数；卡片用 `<label>` 包 checkbox（点卡片或 checkbox 均可选）、`loading="lazy"`、`dataset.stage` 三态兜底（gif → JPEG → 文字占位并移除 img）；选择变化就地更新已渲染卡片不重建 DOM；导出 `buildExportPayload` + Blob + `exercise-selection.json`，无选择时禁用；导入 `FileReader.readAsText` + `normalizeExercises`，成功后替换数据集、清理不存在选择、重建选项并回到第 1 页，错误写入 `role=alert` 区 |
| `tests/exercise-selector-ui.test.js` | 新增 34 条 UI 契约用例（无新依赖，`vm` 按浏览器脚本顺序加载）：脚本顺序/无 module/无 fetch/无预置 img、`getElementById` 与 HTML id 双向对齐、关键控件与 label、radio 段控、反馈区 role/aria-live、媒体只由分页 items 渲染（28 页 ≤48 且合计 1324、组内恰好一次、组计数 ≥ 本页条数）、媒体 URL 前缀与相对路径、卡片字段、选择跨页/分组保持、导出文件名与 Blob 下载、导出正文 schema 与 ID 排序、无选择禁用、导入 FileReader 链路与错误消息、清理不存在选择、媒体三态兜底、署名与无教程文案、样式约束（无渐变、圆角 ≤8px、焦点、无字体缩放、三栏/单列） |

命令与结果：

```bash
npx jest tests/exercise-selector-ui.test.js tests/exercise-selector.test.js --runInBand
# 2 suites / 86 tests passed

npm test -- --runInBand
# 11 suites / 254 tests passed;覆盖率 94 / 84.56 / 97.61 / 96.29(阈值 80)

node --check tools/exercise-selector/core.js tools/exercise-selector/build-index.js \
  tools/exercise-selector/index-data.js tools/exercise-selector/app.js \
  tests/exercise-selector-ui.test.js tests/exercise-selector.test.js
# 全部通过

git diff --check                       # exit 0,无空白错误
git diff --no-index --check /dev/null <新增文件>   # index.html / styles.css / app.js / tests 均 clean
```

浏览器验收（`agent-browser 0.27.0`，直接打开 `file:///Users/ztc/fitness-miniprogram/tools/exercise-selector/index.html`，无服务器、无构建）：

| 视口 | 操作 | 结果 |
|---|---|---|
| 1440×1000 | 初始 | 结果 1324 / 总数 1324 / 已选 0；48 张卡片；第 1 / 28 页；部位 11 项、器械 29 项（含「全部」）；保存 JSON disabled；`img.loading="lazy"`；GIF src = `raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/…`；缩略图实测 157×157（1:1，`object-fit:contain` 无变形）；无 console 报错 |
| 1440×1000 | GIF 实际加载 | 滚动后 43/48 已加载（`naturalWidth=180`），0 失败；未进入视口的保持「加载中」占位（懒加载生效） |
| 1440×1000 | 关键词 `bench` / `BENCH` | 73 / 73（大小写不敏感）；清空后回到 1324 |
| 1440×1000 | AND：`chest` + `barbell` + `press` | 9（与票 02 记录一致） |
| 1440×1000 | 分组切换「按器械」 | 段控琥珀 active + 组标题 `body weight 325 条 · 本页 5`、`cable 157 条 · 本页 1`、… `barbell 154 条 · 本页 31`；卡片仍 48 |
| 1440×1000 | 分页 | 下一页/上一页正常；第 28 / 28 页 28 张卡片，next disabled、prev enabled |
| 1440×1000 | 多选跨分页 | 点卡片本体选 0001/0002（第 1 页）+ 0055（第 2 页）→ 已选 3、摘要 3 行、保存 JSON 变为可用；第 2 页只有 0055 呈琥珀态 |
| 1440×1000 | 选择跨筛选/分组保持 | 筛选 `chest`（163）后已选仍 3；切回「按身体部位」仍 3 |
| 1440×1000 | 选择当前结果 | 163 + 3 → 166；状态「已选择当前筛选结果 163 条」；当前页 48 张全部琥珀 |
| 1440×1000 | 摘要移除 | 166 → 165，行数同步减少 |
| 1440×1000 | 导出下载 | `agent-browser download "#export" /tmp/exercise-selector-dl/exercise-selection.json` 成功落盘 42328 B；`schemaVersion 1` / `source hasaneyldrm/exercises-dataset` / `selectedCount 165` / 165 条 / ID 升序 / 字段 `id,name,bodyPart,equipment,target,imagePath,gifPath`（无 category） |
| 1440×1000 | 导入错误（损坏 JSON） | `#status-error`（`role=alert`、`aria-live=assertive`）显示「导入失败:JSON 解析失败:…」；数据仍 1324、已选不变 |
| 1440×1000 | 导入错误（非数组） | 「导入失败:数据集必须是数组,收到 object」 |
| 1440×1000 | 导入成功（3 条上游 snake_case） | 总数 3、卡片 3、ID 0001/0002/0900；选项重建为「全部部位/chest/waist」；关键词与筛选清空；页码 1/1；已选 165 → 1 并提示「已导入 3 条动作,已清理 164 条不存在的选择」 |
| 1440×1000 | 媒体兜底（真实 404） | gif 404 + jpeg 正常 → `stage=image` 且 JPEG 加载成功（180px）；gif 与 jpeg 都 404 → img 被移除、文字「GIF 不可用」（不再重试，页面无残留 error img）；gif 正常 → `stage=gif` |
| 1440×1000 | 键盘 | Tab 顺序 `import-file → … → select-filtered`；焦点为 2px solid `rgb(180,118,26)`；焦点在 checkbox 上按 Space 切换选择且焦点不丢（DOM 未重建）；radio 组按 → 切换为「按器械」并重排分组，选择保持 |
| 1440×1000 | 空结果 | 关键词 `zzzznope` → 结果 0 /「没有符合条件的动作」/ 页码「无结果」/ 上下页均禁用；已选 2 保持；「选择当前结果」提示「已选择当前筛选结果 0 条」 |
| 390×844 | 布局 | 单列 351px；卡片 2 列 171.5px；顶栏 static；`scrollWidth 375 ≤ 390`，无横向溢出元素；筛选面板、组标题、分页、摘要、署名正常 |
| 390×844 | 交互 | 翻到第 2 / 28 页；跨页多选 0001 + 0055 → 已选 2、摘要 2 行、保存 JSON 可用 |

截图（`.pi/visual-tests/exercise-selector/`）：

- `desktop.png`：1440×1000 初始态（1324/1324/0、48 卡片、分组标题、GIF 卡片、空摘要、禁用导出）。
- `mobile.png`：390×844 初始态（单列、顶栏两行、筛选面板、分组标题、双列卡片）。
- `desktop-selected.png`（附加证据）：琥珀多选态 + 右侧摘要 3 行 + 导出可用。
- `mobile-selected.png`（附加证据）：移动端卡片、分页「第 2 / 28 页」、摘要与署名。

变异验证（确认新断言真的锁住契约）：

- `buildGroups` 改成用整份索引而不是分页 items → 6 条用例失败；恢复后全绿。
- 去掉 `image.loading = 'lazy'` → 1 条失败。
- `--radius` 8px → 12px → 1 条失败。
- 把 `app.js` 提到 `core.js` 之前 → 1 条失败。

范围边界（保持）：

- 未改动 `tools/exercise-selector/core.js`、`index-data.js`、`build-index.js`（票 02 范围，本次仅作为依赖使用，字节未变）。
- 未改动 `data/`、`utils/db.js`、`scripts/`、`docs/spec.md`、`docs/adr/`、`project.config.json`、`AGENTS.md`、`CONTEXT.md`、`README.md`。
- 未复制或镜像任何 Gym visual 媒体；页面只引用官方 raw URL。
- 未引入构建步骤或依赖（无 npm 包、无打包器）；`file://` 直接可用。
- 未提交 git commit（由协调者统一处理）。

## 人工验收（保持 ready-for-human）

- [ ] 打开 `tools/exercise-selector/index.html`（或 `open tools/exercise-selector/index.html`）确认 1324 条、筛选/分组/分页/多选/导入/导出可用；GIF 需外网可达，不可达时应看到 JPEG 兜底或「GIF 不可用」文字占位。
- [ ] 上游 `hasaneyldrm/exercises-dataset` 媒体路径或仓库结构若变动，需按新前缀更新 `app.js` 的 `MEDIA_BASE`（外部网络可变，非本票可锁定）。
