# 逐组训练集成验收

状态：**代码实施与双轴复审完成；无新增自动回归失败，真机待验，整体部分完成**。分支 `feat/set-by-set-training`；固定基线 `0850414189c6ebbf6c4f42469b8ebaa336490fce`，最终代码提交 `26c83c1c4069efa6955e73fd8a8c0141264e9989`。无生产构建、云端部署、真实 WXML / 真机验收。

## 已执行检查

| 阶段 | 检查 | 结果 |
|---|---|---|
| 基线 | 全量 Jest + coverage，核对 JSON | 14 套件通过、1 失败；275 用例通过、29 跳过、1 失败 |
| 01 合并 `81d4e78` | domain 定向 Jest，核对 JSON | 73 / 73 通过 |
| 01 合并 `81d4e78` | domain JS / tests 的 `node --check`、`git diff --check` | 通过 |
| 01 合并后 | 回归 + coverage，显式排除 `tests/catalog.test.js` | 14 套件、305 用例通过，29 既有跳过，覆盖率门禁通过；不是全量通过 |
| 03 合并 `0c64878` | 9 个相关套件，核对 JSON；9 份修改 JS 的语法与 diff 检查 | 147 用例通过、25 既有跳过、0 失败；语法与 diff 通过 |
| 03 合并后 | 全量 Jest + coverage，核对 JSON | 16 套件通过、1 失败；327 用例通过、29 既有跳过、1 基线目录环境失败；无新增失败 |
| 02 合并 `afec2c5` | 7 个相关套件；随后全量回归 | 144 通过、25 跳过、0 失败；全量 353 通过、29 跳过、1 基线目录环境失败 |
| 统一修复合入 `26c83c1` | 10 个相关套件，核对 JSON | 186 通过、25 既有跳过、0 失败，success=true |
| 统一修复合入 `26c83c1` | 全量 Jest + coverage，核对 JSON | 17 套件通过、1 失败；366 通过、29 既有跳过、唯一 1 个基线目录环境失败；覆盖率门禁通过，无新增失败 |
| 最终代码 | 14 份 JS 的 node --check、19 份 Markdown 链接 / 围栏、整体 diff、WAV 校验 | 全通过；提示音为 16 kHz / mono / 16-bit PCM / 0.3 秒，SHA-256 未变 |
| 最终代码 | 主代理重跑删除公开接口探针 | 删除后计划为空，canonical 历史保留，离线场次仍待同步 |
| 最终代码 | 独立 Standards / Spec 定向复审 `86bc5de..26c83c1` | 两轴分别 APPROVE，0 个剩余 P0–P2；静态复核，不称设备验收 |

### 基线环境失败

`tests/catalog.test.js`：`生成器 buildCatalog 可用夹具目录跑通` 调用默认源目录 `/tmp/exercises-dataset`，但源 `exercises.json` 与 `name_zh.json` 缺失，`DATASET_DIR` 未设置。错误：`缺少源数据：需 exercises.json 与 name_zh.json`。

保留原测试。不能为本功能去修改、跳过或伪造动作库生成测试；最终仍运行全量并区分基线失败与新回归。

domain 单套件加覆盖率会因收集但未执行 `data/exercises.js` 使全局 branch 阈值失败；domain 自身 branches 为 342 / 389。包括目录相关套件的上述回归覆盖率门禁已通过，未降低阈值。

## 尚待执行

- 真机与实际 WXML 验收不由自动测试替代。
- 真机关键场景，证据模板见 [manual-acceptance.md](manual-acceptance.md)。无本地设计图与稳定页面 URL，不声明视觉代理验收通过。

## 状态关闭规则

01–03 实现、自动集成验证与双轴复审完成，标 done。04 与父 issue 的真机关键场景无证据，保持 `labels: [ready-for-human]`、`status: open`，结论为部分完成，不把 mock 测试当真实设备证据。实现代理 worktree 已清理，仅保留主工作区；未 push 或创建 PR，本地 Markdown tracker 按上述状态关闭实现票。
## 双轴统一修复：实际自动验证

基于集成 `86bc5deaf84b6ca81ae795af5055058813b86966` 的隔离 worktree；修复后检查 `git merge --ff-only feat/set-by-set-training` 返回 `Already up to date`，再执行下面两轮测试并实际读取 JSON。

```bash
npx --no-install jest tests/domain.test.js tests/training-flow.test.js tests/training-submission.test.js tests/training-records.test.js tests/db.test.js tests/training-media.test.js tests/media-root.test.js tests/library-*.test.js --runInBand --json --outputFile=/tmp/set-by-set-training-review-fixes-tests.json
npx --no-install jest --runInBand --coverage --json --outputFile=/tmp/set-by-set-training-review-fixes-full.json
```

- 定向：`success: true`，10 suites passed；182 passed / 25 skipped / 0 failed。
- 全量：`success: false`，17 suites passed / 1 failed；366 passed / 29 skipped / 1 failed。唯一失败仍为 catalog 默认 `/tmp/exercises-dataset` 缺源数据，无新增 failed，不改历史 skip。
- coverage：全局 statements 94.10%、branches 88.65%、functions 97.46%、lines 96.06%；domain branches 89.00%（原 88.69%），保持原 80% 门禁。
- 9 份修改 JS 全部 `node --check`、`git diff --check` 通过；修改 Markdown 相对链接检查通过。
- 音频读取：16 kHz、mono、16-bit PCM、4,800 frames（0.3 秒）；执行原生成脚本后 SHA-256 保持 `599a36a005074c2f62d2e635cde241fde89e8344437fb9566db6daa5f5608fc1`，未修改资源。
- 不运行 production build、不 push、不产生云部署或真机证据。修复完成不表示独立审查通过。

### 新增回归与问题对应

| 问题 | 公开 seam 回归 | 实际结果 |
|---|---|---|
| Standards P1 / Spec P1 删除复活 | db/queue：cloud id、local id、inflight stable alias/raw 删除、网络重试、canonical 历史仍在、删除标记/缓存写失败恢复、原 save 回调补删除 | submission 17 tests passed |
| Standards P2 队列判定旁路 | real queue + wx：无网不上传、head 失败阻塞后续、legacy 重试、plan-only 不再上传/推进；执行路径每轮使用 real domain.decideSubmission | submission 17 tests passed；旧返回契约不变 |
| Spec P1 重载覆盖加练 | Page：已升级 show 无多余写入；加练成功后 read throw / legacy upgrade write fail；全部旧状态写入口拒绝，显式重试采用新增动作并继续，deadline 保留 | flow 31 tests passed |
| Spec P2 连续零秒漏响 | Page：3 组零秒两个间歇各一次、重复完成/show/tick 不重响、final 无 rest、撤销再确认及写失败不响 | flow 31 tests passed |
| Standards 判断性重复 | domain 公开共享识别/实际组 selector null、新/旧/混合状态；详情实际/跳过展示兼容 | domain 74 tests / records 5 tests passed |

主要 red→green 记录：删除回归先复现 local 计划重新出现；升级草稿 show 回归先复现无意义写；连续零秒回归先复现第二间歇仅响一次；公开 selector 回归先复现未导出；save 旧回调回归先复现无补删除。零秒身份修复的首轮回归发现开始组清空 undoSetId 多响，核对根因后限定非空认领 ID，最终连续零秒/撤销/失败回归通过。队列纯判定属于审查指出的结构修复，真实执行回归在修改前后均通过，未伪称其行为测试先失败。
