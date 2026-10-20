# 动作选择器测试夹具（合成数据，不是上游数据集）

`tools/exercise-selector/build-index.js` 与 `core.normalizeExercises` 的字段映射、排序与确定性
在测试时都读这里，**不读** `/tmp/exercises-dataset`，所以干净 clone（机器上没有上游数据集）也能跑通。

- `exercises.json`：3 条合成行，字段形状与上游 `hasaneyldrm/exercises-dataset` 一致（snake_case、`image`/`gif_url` 为相对路径）。
- `name_zh.json`：中文名映射，形状同 `wangmuerxiao/exercises-dataset-zh` 的 `data/name_zh.json`。
- 目录里**没有媒体文件**：生成器只做字段映射，不校验媒体存在性；真实媒体不进仓库（见 README「动作媒体」）。

id 刻意乱序（9102 在 9101 前）以覆盖生成结果的 4 位 ID 升序排序。

与**完整**上游数据集（1,324 条）逐条比对的测试仍需真实数据集：放好 `/tmp/exercises-dataset`，
或用 `DATASET_DIR=<目录> npm test` 指定，缺数据集时这两条测试显式跳过并在名称里标注。
