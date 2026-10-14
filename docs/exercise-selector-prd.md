> **历史文档**：本规格描述 2026-09 的精选目录与选择器轮次，已被 `docs/spec.md` 与 ADR-0008 取代；其中 125/250/v5 只作审计记录，不是当前目录契约。

> 状态：需求已锁定（2026-09-21）。本轮删除两个无可用 GIF 的肩胛俯卧撑动作，并新增本地静态网页，用于从上游 1324 条数据集中筛选、预览和导出候选动作。

## Problem Statement

1. 当前精选目录中的 `3011`（上斜肩胛俯卧撑）和 `3021`（肩胛俯卧撑）在实际使用环境未显示 GIF，不应继续出现在动作库和既有计划中。
2. 后续扩充动作库时，直接阅读 1324 条原始 JSON 难以比较动作、器械和 GIF；需要一个不依赖小程序运行时的可视化策展工具。

## Solution

### 1. 删除两个动作并升级计划迁移

- 从 `CURATED_EXERCISES` 删除 `3011`、`3021`。
- 同步清理 `scripts/hand-overrides.js` 中对应 slug 和 aliases，再重跑目录生成器。
- 最终精选目录从 127 条变为 **125 条**；热身从 16 条变为 **14 条**；受管媒体目标从 254 个变为 **250 个**。
- `PLAN_MIGRATION_VERSION` 从 v4 升到 **v5**。既有计划自动删除这两个动作；空训练日、空计划和游标沿用现有裁剪规则；历史 Session 不读取、不改写。
- 两个动作的 4 个媒体对象不再进入上传目标，仅可在真实 CloudBase 同步时作为陈旧候选处理。

### 2. 静态动作选择器

在 `tools/exercise-selector/` 提供无需构建的静态网页，可直接打开 `index.html` 使用。

#### 数据范围与加载

- 内置上游 `hasaneyldrm/exercises-dataset` 当前 **1324 条**动作的精简索引。
- 索引字段：`id`、`name`、`nameZh`、`category`、`bodyPart`、`equipment`、`target`、`imagePath`、`gifPath`；1324 条都必须有中文 `nameZh`。
- 提供“导入数据集”操作，可选择本地 `exercises.json` 并在浏览器内替换当前索引，不上传文件；原始上游条目按内置英文名映射补齐中文名，映射外的新动作必须自带 `nameZh` 或 `name_zh`，否则拒绝导入。为避免主线程无界读入，导入文件限制为 **32 MiB**（当前上游文件约 17.4 MiB），超限在页面错误区拒绝。
- 提供可重复执行的 Node 生成脚本，从 `DATASET_DIR/exercises.json` 和 `DATASET_DIR/name_zh.json` 更新内置索引；生成结果必须确定、按 4 位 ID 排序。

#### 浏览与分类

- 默认展示全部 1324 条，包含 cardio 和所有上游变式。
- 提供“按身体部位 / 按器械”分组切换。
- 提供关键词、身体部位、器械三个筛选维度，组合关系为 AND。
- 显示总数、筛选结果数、已选数；空结果和加载错误有明确状态。
- 每个动作展示 GIF、4 位 ID、中文主名称、英文副标题、身体部位、器械和目标肌群；关键词同时匹配中英文名。
- 列表分页渲染，单页 48 条；只为当前页创建 GIF 元素，避免同时请求 1324 个 GIF。

#### 多选与导出

- 每张动作项有 checkbox；点击卡片或 checkbox 均可切换选择。
- 选择跨搜索、筛选、分组和分页保持。
- 支持选择当前筛选结果、清空全部选择、从选择摘要中移除单项。
- “保存 JSON”通过浏览器下载文件，格式如下：

```json
{
  "schemaVersion": 1,
  "source": "hasaneyldrm/exercises-dataset",
  "selectedCount": 1,
  "selected": [
    {
      "id": "0025",
      "name": "barbell bench press",
      "nameZh": "杠铃卧推",
      "bodyPart": "chest",
      "equipment": "barbell",
      "target": "pectorals",
      "imagePath": "images/0025-EIeI8Vf.jpg",
      "gifPath": "videos/0025-EIeI8Vf.gif"
    }
  ]
}
```

- `selected` 按 ID 排序；中英文名均导出，不导出当前筛选 UI 状态，也不伪造 `mode`、`tags` 或 `compound`。
- 导出文件仅作为后续人工策展输入，不直接修改 `CURATED_EXERCISES`。

### 3. 视觉与可用性

- 工具定位是高密度训练档案台，不是营销落地页。
- 使用与健身内容匹配的工作台布局：紧凑顶栏、筛选侧栏、动作浏览区、固定选择摘要。
- GIF 是动作卡片主要视觉，不使用装饰插画、渐变背景或嵌套卡片。
- 桌面优先，同时支持窄屏单列；所有按钮、checkbox、筛选控件可键盘操作并有可见焦点。
- 显示 Gym visual 媒体署名和“仅用于本地策展”的用途提示。

## Acceptance Criteria

- 当前全量目录已纳入 `3011/3021`；本历史文档中的 125/250 与删除动作仅描述旧轮次。
- [ ] 可按身体部位/器械切换分组，关键词+部位+器械 AND 筛选正确。
- [ ] 当前页最多渲染 48 个 GIF；分页、结果数和空状态正确。
- [ ] 多选跨筛选和分页保持，选择当前结果与清空操作正确。
- [ ] 导出的 JSON 符合 schema、字段完整、按 ID 排序，并能在浏览器下载。
- [ ] 本地 `exercises.json` 导入成功和错误状态可用。
- [ ] Node 测试、JS 语法检查、`git diff --check` 通过。
- [ ] 浏览器桌面和移动视口完成交互与截图验收；外部 GIF 加载受网络影响时明确显示失败状态。

## Out of Scope

- 从选择器直接写入 `data/curated-catalog.js`。
- 自动翻译内置中文映射之外的新动作名称，或自动生成 `mode`、`tags`、`compound`、迁移 replacement。
- 上传、删除 CloudBase 对象。
- 在小程序中嵌入该选择器。
- 公开镜像或重新分发 Gym visual 媒体文件。
