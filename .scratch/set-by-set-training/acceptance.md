# 逐组训练集成验收

状态：**集成进行中，未验收完成**。分支 `feat/set-by-set-training`；固定基线 `0850414189c6ebbf6c4f42469b8ebaa336490fce`。无生产构建、云端部署、真实 WXML / 真机验收。

## 已执行检查

| 阶段 | 检查 | 结果 |
|---|---|---|
| 基线 | 全量 Jest + coverage，核对 JSON | 14 套件通过、1 失败；275 用例通过、29 跳过、1 失败 |
| 01 合并 `81d4e78` | domain 定向 Jest，核对 JSON | 73 / 73 通过 |
| 01 合并 `81d4e78` | domain JS / tests 的 `node --check`、`git diff --check` | 通过 |
| 01 合并后 | 回归 + coverage，显式排除 `tests/catalog.test.js` | 14 套件、305 用例通过，29 既有跳过，覆盖率门禁通过；不是全量通过 |

### 基线环境失败

`tests/catalog.test.js`：`生成器 buildCatalog 可用夹具目录跑通` 调用默认源目录 `/tmp/exercises-dataset`，但源 `exercises.json` 与 `name_zh.json` 缺失，`DATASET_DIR` 未设置。错误：`缺少源数据：需 exercises.json 与 name_zh.json`。

保留原测试。不能为本功能去修改、跳过或伪造动作库生成测试；最终仍运行全量并区分基线失败与新回归。

domain 单套件加覆盖率会因收集但未执行 `data/exercises.js` 使全局 branch 阈值失败；domain 自身 branches 为 342 / 389。包括目录相关套件的上述回归覆盖率门禁已通过，未降低阈值。

## 尚待执行

- 02 / 03 合并后的完整自动回归：Page 生命周期、休息提醒、输入 / 存储失败、加练、记录与本地完成 / 游标。
- 双轴代码审查：Standards 与 Spec，固定比较 `git diff 0850414189c6ebbf6c4f42469b8ebaa336490fce...HEAD`；P0–P2 修复和定向复验。
- 修改 JS 全部 `node --check`，整体 diff whitespace 与 Markdown 链接检查。
- 真机关键场景，证据模板见 [manual-acceptance.md](manual-acceptance.md)。无本地设计图与稳定页面 URL，不声明视觉代理验收通过。

## 状态关闭规则

01–03 仅在实现及对应自动验证、最终集成审查通过后标 done。04 与父 issue 的真机关键场景无证据时保持 `labels: [ready-for-human]`、`status: open`，结论为部分完成，不把 mock 测试当真实设备证据。