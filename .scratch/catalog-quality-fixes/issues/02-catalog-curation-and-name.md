---
title: 127 条精选目录、0238 命名与生成链
labels: [ready-for-agent]
status: done
created: 2026-09-21
---

# 02: 127 条精选目录、0238 命名与生成链

## What to build

按 `docs/prd.md` 从权威白名单删除 9 个 ID；在 `scripts/hand-overrides.js` 固定 `0238` 展示名“绳索直臂下压”并保留旧名别名；重跑生成器得到 127 条目录。同步目录、分页和媒体纯函数测试中的冻结契约。

## Acceptance

- [x] 9 个 ID 不在白名单、离线目录、slug/alias 覆盖和媒体目标中。（`tests/catalog.test.js` 新增白名单/目录/slug/alias 四路断言；媒体目标由 `tests/upload-exercise-media.test.js` 的 `EXCLUDED_MEDIA` 覆盖）
- [x] `0238` 展示名和旧名搜索行为正确，媒体路径不变。（`nameZh === '绳索直臂下压'`，别名「绳索直臂下拉」仍命中，`0238-x69MAlq.jpg/.gif` 未变）
- [x] 127 条目录与白名单一一对应；热身 16 条；筛选顺序不变。
- [x] 媒体目标为 254 个，18 个被删媒体不再进入上传集合。

## Verification

```bash
node scripts/build-exercises.js
npx jest tests/catalog.test.js tests/library-paging.test.js tests/upload-exercise-media.test.js --runInBand
```

## 验证记录（2026-09-21）

改动文件：

| 文件 | 改动 |
|---|---|
| `data/curated-catalog.js` | 白名单删除 `0499/0573/0603/0606/0659/0688/2133/2137/3012`（136 → 127）；`0238` 行注释改为「绳索直臂下压」；文件头规模说明改为 127 |
| `scripts/hand-overrides.js` | 删除上述 7 个有 slug 的 ID 的 `slugMap` 条目与 8 个 ID 的 `aliasesById` 条目；新增 `'cable-straight-arm-pulldown': { id: '0238', nameZh: '绳索直臂下压' }`；新增 `aliasesById['0238'] = ['绳索直臂下拉']` |
| `scripts/build-exercises.js` | 仅更新 `TARGET_WHITELIST` 上方注释（`traps`/`serratus anterior` 现在只服务 3011/3021），16 项粗筛表本身未动 |
| `data/exercises-data-1.js`、`data/slug-map.js` | 重跑生成器产出（`data/exercises-data.js` loader 内容不变） |
| `data/exercises.js` | 注释里的目录规模 136 → 127 |
| `tests/catalog.test.js` | 冻结契约：127 条、`FROZEN_TAG_COUNTS` 重算、`WARM_UP_IDS` 16 条、`NOT_WARM_UP_IDS` 去 `0659`、`ADDED_IDS` 30 条、新增票 02 删除 ID 断言、`0238` nameZh/别名/媒体断言、`traps|serratus` 只剩 3011/3021 |
| `tests/library-paging.test.js` | 结果数 136 → 127、腿 38 → 36、臀 31 → 29、热身 18 → 16、末页长度 127 |
| `tests/upload-exercise-media.test.js` | 目录 136 → 127、目标 272 → 254、`NEW_EXERCISE_IDS` 30 条、`EXCLUDED_MEDIA` 增补 9 个 ID 的 18 个媒体路径（11 → 20 条） |

命令与结果：

```bash
node scripts/build-exercises.js                        # chunk 1: 127 条 / 78.9 KB; slug-map 89 条
npx jest tests/catalog.test.js tests/library-paging.test.js tests/upload-exercise-media.test.js --runInBand
                                                       # 3 suites / 64 tests passed
node --check <改动涉及的 10 个 JS 文件>                 # 全部通过
git diff --check                                       # 无空白错误
```

额外核对（脚本直算，非测试）：

```text
EXERCISES 127 / buildUploadTargets 254 / 9 个删除 ID 的媒体文件名在目标集合中为 0 条
0238 目标仅 exercises/images/0238-x69MAlq.jpg 与 exercises/videos/0238-x69MAlq.gif
warm-up 筛选 16 条；生成产物相对 HEAD 只差「删 9 条 + 0238 nameZh/aliases」，无其他漂移
```

重新生成的目录与 HEAD 版本逐条比对结果：removed = 9 个目标 ID，added = 0，changed = 仅 `0238` 的 `nameZh` 与 `aliases`。

说明与遗留：

- 未提交 git commit（由协调者统一处理）。
- `npx jest --runInBand` 全量 9 suites 中仅 `tests/contract-docs.test.js` 失败（仍断言 136 条 + 文档含 `136`）；该文件与 `CONTEXT.md`/`docs/spec.md`/ADR-0007/README 按本票边界不得改动，由票 03 统一同步到 127 条 / v4。
- 真实 CloudBase 对象存在性与 254 目标集合一致性、18 个被删媒体的实际清理仍属人工/票 03 验收（`--execute` 不在本票范围），本票只保证纯函数层面的目标集合为 254 且不含被删媒体。
