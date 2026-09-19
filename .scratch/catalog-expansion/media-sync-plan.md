# 最终 136 条动作媒体同步计划

> 状态：仓库内计划已验证；真实 CloudBase 同步待人工执行。

## 目标集合

- 动作目录：136 条。
- 每条媒体：1 个 JPEG + 1 个 GIF。
- 受管目标：272 个对象。
- 目标来源：`data/exercises.js` 中每条动作的 `imagePath` 与 `gifPath`，不扫描或整目录上传。
- 受管前缀仅为：
  - `exercises/images/`
  - `exercises/videos/`

新增 34 条动作的 JPEG/GIF 必须进入目标集合；已删除的 `0200`、`0673` 及严格排除 ID 的媒体不得进入目标集合。

## 仓库内验证结果

- `npx jest tests/upload-exercise-media.test.js --runInBand`：33/33 通过（含异常对象只报告不删除回归）。
- 目标集合断言：272 个对象。
- JPEG/GIF fileID、路径遍历、错误扩展名、符号链接、远端差异、删除范围、dry-run、上传失败与最终集合校验均有自动化覆盖。
- `node scripts/upload-exercise-media.js --src /tmp/exercises-dataset`：当前环境缺少媒体源目录，按预期以退出码 1 停止；未连接 CloudBase，未上传或删除任何对象。

## 人工执行前置条件

1. 准备与生成目录相同版本的 `hasaneyldrm/exercises-dataset`，其中包含 `images/` 与 `videos/`。
2. 安装 `@cloudbase/manager-node`。
3. 通过环境变量提供 `TCB_SECRET_ID` / `TCB_SECRET_KEY`（或 `CLOUDBASE_SECRET_ID` / `CLOUDBASE_SECRET_KEY`），不得写入仓库。
4. 确认 `data/media-root.js` 指向目标环境的桶根。
5. 执行前备份两个受管前缀的远端对象清单。

## 执行步骤

```bash
# 1. 只读 dry-run；不得上传或删除
node scripts/upload-exercise-media.js --src /absolute/path/to/exercises-dataset

# 2. 人工核对输出：目标 272、待上传、待删除、范围外对象

# 3. 明确确认后执行
node scripts/upload-exercise-media.js --src /absolute/path/to/exercises-dataset --execute

# 4. 再跑一次 dry-run，确认待上传与待删除均为 0
node scripts/upload-exercise-media.js --src /absolute/path/to/exercises-dataset
```

同步顺序固定为：列举远端 → 计算差异 → 上传缺失 → 重新列举并验证最终目标全部存在 → 删除陈旧对象。上传或最终集合校验失败时不得删除。

## 陈旧对象与删除边界

- `0200`、`0673` 的旧 JPEG/GIF 若仍在远端，应成为陈旧候选。
- 删除候选必须是两个受管前缀下的单层合法 `.jpg` / `.gif` 文件。
- 仍被最终目录引用的对象不得删除。
- 其他前缀、嵌套路径、扩展名不匹配或形态异常的对象只报告，不删除。

## 失败与重试

- 任一源媒体缺失、符号链接、上传失败、远端列举失败或最终集合缺失都必须非零退出。
- 失败时保留逐项清单，不输出“同步完成”。
- 重跑会重新计算远端差异，只补缺失项；删除失败可安全重试。
- 不使用桶级或 `exercises/` 目录级广泛删除。

## 回滚

- 上传是补充/覆盖式；若新增媒体有问题，可在修正源文件后重跑。
- 陈旧媒体删除前必须保存远端清单；需要恢复时，从相同版本媒体源按精确 cloudPath 重新上传。
- 不通过修改 `MEDIA_ROOT` 或删除整个前缀来回滚。

## 人工验收清单

- [ ] dry-run 显示目标总数为 272。
- [ ] 136 条动作的 JPEG/GIF 均能解析为非空 `cloud://` fileID。
- [ ] 执行后待上传为 0。
- [ ] 执行后待删除为 0。
- [ ] `0200`、`0673` 的旧媒体不再存在于受管前缀。
- [ ] 两个受管前缀之外的对象未发生变化。
- [ ] 小程序中抽查新增动作列表 JPEG 与详情 GIF 可加载。
