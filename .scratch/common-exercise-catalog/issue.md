---
title: 常用动作精选库、分区筛选与缩略图列表
labels: [ready-for-human]
status: open
created: 2026-09-18
---

> ⚠️ **已被取代（2026-09-19）**：本轮口径由 `.scratch/catalog-expansion/issue.md` 取代——
> 精选目录最终 **136 条**、部位标签 **10 个**（筛选 **11 项**：全部 / 胸 / 背 / 肩 / 二头肌 / 三头肌 / 腿 / 腰腹 / 臀 / 热身 / 复合动作）、
> `aliases` 参与搜索、计划迁移升到 **v3**（无 replacement）、媒体目标集合 **272** 个对象。
> 本文保留当时的执行与验收记录（含当时的状态与检查项），**不再作为当前验收依据**；未完成的人工验收由新轮次承接。

## Problem Statement

当前动作库有 1236 条三分化相关动作，仍包含大量单侧、特殊握距、平衡球、版本号和其他冷门变式。用户很难从中快速找到健身房常用动作，也无法按二头肌、三头肌、臀或复合动作筛选。

历史问题曾是列表只显示首字 glyph、一次性下发所有匹配结果；当前实现已改为 24 项递增分页和 JPEG 缩略图。精选目录再次裁剪后，CloudBase 仍可能保留不再被目录引用的 JPEG/GIF，需真实同步验收。

## Solution

将动作库从“数据集的肌群全集”变成一套可审计的健身房常用动作精选库。精选库用精确 `exerciseId` 白名单和人工分类元数据维护，覆盖三分化、四分化和五分化所需的胸、背、肩、二头肌、三头肌、腿、腰腹、臀训练。

动作库提供 10 个部位标签（胸、背、肩、二头肌、三头肌、腿、腰腹、臀、热身、复合动作），筛选行固定顺序 11 项（含「全部」）。复合动作与热身都是重叠标签，不取代其具体部位标签。器械筛选与部位筛选继续采用 AND 关系。

列表以 24 项递增分页显示 JPEG 缩略图：首屏和下一页预热，详情按既有链路加载 GIF。最终目录重新同步到 CloudBase，删除 `exercises/images` 和 `exercises/videos` 前缀下不再被最终目录引用的媒体对象。

## User Stories

1. As a gym trainee, I want the exercise library to contain common gym movements, so that I can select movements without sorting through obscure variations.
2. As a gym trainee, I want common barbell, dumbbell, machine, cable, and bodyweight alternatives for a movement pattern, so that I can train in different gym equipment conditions.
3. As a gym trainee, I want the same movement pattern not to appear as many trivial grip, angle, balance-device, or version-number variants, so that the library remains easy to scan.
4. As a trainee using a three-day push/pull/legs split, I want the library to cover horizontal push, vertical push, horizontal pull, vertical pull, squat, and hip-hinge patterns, so that I can build a complete plan.
5. As a trainee using an upper/lower four-day split, I want all upper and lower body regions represented, so that I can reuse one catalog instead of switching catalogs.
6. As a trainee using a five-day split, I want dedicated chest, back, shoulder, arm, leg, glute, and waist/abdominal movements, so that each day can be planned independently.
7. As a trainee, I want to filter by chest, so that I can find presses, flies, dips, and suitable chest alternatives.
8. As a trainee, I want to filter by back, so that I can find common rows, pull-ups, chin-ups, and pulldowns.
9. As a trainee, I want to filter by shoulders, so that I can find shoulder presses, lateral raises, rear-delt movements, and common machine alternatives.
10. As a trainee, I want separate biceps and triceps filters, so that arm isolation movements are not mixed into one upper-arm bucket.
11. As a trainee, I want a leg filter, so that I can find squat, leg press, lunge, leg extension, leg curl, and calf movement patterns.
12. As a trainee, I want a waist/abdominal filter, so that I can find common trunk flexion, leg raise, anti-extension, anti-rotation, and rotation movements.
13. As a trainee, I want a glute filter, so that I can find hip hinges, hip thrusts, bridges, squats, and abduction patterns relevant to glute training.
14. As a trainee, I want a compound-movement filter, so that I can quickly find multi-joint foundational lifts such as squats, presses, pull-ups, rows, deadlifts, lunges, leg presses, hip thrusts, and dips.
15. As a trainee, I want a compound movement to remain discoverable through its specific muscle-group filter, so that “compound” does not hide useful movements from chest, back, shoulder, leg, or glute browsing.
16. As a trainee, I want keyword, equipment, and body-part filters to combine, so that I can narrow a common movement to equipment available in my gym.
17. As a trainee, I want the result count to describe all matched catalog items, so that pagination does not make a large matching set look incomplete.
18. As a trainee, I want the first 24 matching actions to appear quickly, so that entering the library or changing a filter feels responsive.
19. As a trainee, I want more matching actions to appear as I approach the end of the list, so that I can browse without a manual pagination control.
20. As a trainee, I want visible and next-page action thumbnails prepared before I scroll to them, so that the list does not show avoidable blank image flashes.
21. As a trainee, I want each list row to show a JPEG action thumbnail, so that I can recognize an action before opening its detail.
22. As a trainee, I want thumbnails to fall back safely when media is unavailable, so that the action remains selectable when a network or CloudBase media request fails.
23. As a trainee, I want action details to retain the existing GIF-first media behavior, so that the list stays efficient while the detail view provides the animation.
24. As a trainee with an existing plan, I want actions removed from the final curated catalog to be removed from my plan automatically, so that I cannot retain unavailable catalog actions.
25. As a trainee, I want empty training days and plans created by catalog cleanup to be removed, so that my plan cursor never points to unusable training days.
26. As a trainee, I want completed historical sessions left unchanged, so that catalog curation does not alter the training I actually performed.
27. As a catalog maintainer, I want every retained action to have an explicit ID, canonical movement mode, filters, and compound flag, so that future catalog changes are reviewable and deterministic.
28. As a catalog maintainer, I want media synchronization to upload only final-catalog media and remove obsolete catalog media, so that CloudBase storage matches the current catalog.
29. As a catalog maintainer, I want media deletion confined to the exercise-media prefixes, so that unrelated CloudBase files cannot be deleted.
30. As a catalog maintainer, I want an interrupted upload or deletion to be reported and retryable, so that a partial synchronization never silently claims completion.

## Implementation Decisions

- The offline action catalog remains the single source for action lookup, text search, plan entry validation, and media-path references. It continues to use the upstream dataset’s four-digit string ID as its primary key.
- The final curated catalog contains approximately 100–140 unique actions. Selection is an exact, version-controlled `exerciseId` whitelist with per-action curation metadata, never an English-name keyword heuristic.
- Curation metadata records canonical movement mode, one or more product-facing body-part tags, and whether an action is compound. It is the authoritative source for the new filters and survives upstream naming changes.
- The common-movement baseline is based on major movement patterns and common equipment alternatives: horizontal and incline chest pressing, chest fly/dip/push-up; horizontal and vertical pulling; shoulder pressing and common lateral/rear-delt work; barbell, dumbbell, cable, EZ-bar, and preacher curl variants; close-grip pressing, pushdowns, extensions, and dips; squat, leg press, lunge/split-squat, extension, curl, calf-raise, and hip-hinge patterns; deadlift, Romanian deadlift, hip thrust/bridge, and hip-abduction patterns; and common trunk flexion, leg-raise, plank, rotation, and anti-rotation patterns.
- One movement mode may keep two to four meaningful gym-equipment alternatives. The curation excludes trivial grip changes, unilateral duplicates when a bilateral standard exists, balance-device variants, novelty/plyometric variants, camera/sex suffix duplicates, and version-number duplicates unless the movement has no normal alternative.
- The product-facing body-part filters are ordered: 全部, 胸, 背, 肩, 二头肌, 三头肌, 腿, 腰腹, 臀, 热身, 复合动作. The exact implementation key names are internal; labels are the user-facing contract.
- Body-part matching uses curation metadata rather than the upstream coarse `bodyPart` field. The compound tag is intentionally overlapping: selecting it matches all marked multi-joint actions; selecting a concrete body part still matches its marked compound actions.
- Equipment filtering preserves its existing semantic buckets and AND behavior with keyword and body-part filters. `equipment === 'body weight'` remains the sole volume rule and is not changed by curation.
- Result handling separates all matches from rendered items. A filter/search reset creates the first 24 rendered items; reaching the list threshold appends the next 24 without recomputing or losing filter state. The full matched count remains visible.
- Each rendered list item receives a JPEG fileID generated from the existing CloudBase media root. List images use native lazy loading and a bounded preheat buffer for the current and next page. Media failure falls back to the existing glyph presentation.
- Detail media continues GIF → JPEG → glyph. List browsing never automatically requests GIFs.
- The final-catalog migration version is increased. It follows the existing local/Cloud synchronization safety model: remove unavailable plan actions, then empty training days, then empty plans; preserve all sessions; keep local migration completion distinct from cloud-sync completion so offline migration retries after connectivity returns.
- CloudBase media synchronization is allowlist-based. It validates all final JPEG/GIF source paths first, uploads only allowlisted objects, verifies the final set, then removes obsolete objects only inside the two dedicated exercise-media prefixes. It must not use a broad bucket deletion or affect unrelated storage.
- The domain glossary is updated to define curated action, action mode, product-facing body-part tag, and compound action. The existing media copyright and personal-use constraints from ADR-0007 remain unchanged.

## Testing Decisions

- The primary seam is the offline catalog module because it is the highest existing deterministic seam shared by action-library search, plan migration, and media synchronization input.
- Catalog tests verify observable behavior: every retained ID is in the curated whitelist; the final size is within the approved range; no excluded novelty/duplicate IDs remain; each curated action has valid metadata; each product-facing filter returns only actions bearing that tag; compound results overlap with concrete tags; and keyword/equipment/body-part filtering remains an AND operation.
- Catalog tests use representative standard actions such as barbell squat, barbell bench press, pull-up, deadlift, common row, shoulder press, curl, pushdown, hip thrust, and an abdominal action to test the public lookup and search behavior rather than private implementation details.
- Page-level unit tests or a extracted pure pagination helper verify initial 24-item rendering, reset on a new query/filter, page append without duplicate IDs, final-page behavior, and result count independent of rendered count.
- Existing database migration tests are extended to cover the new curation version, deletion of an action removed by the curated catalog, empty day/plan removal, historical-session non-mutation, offline migration followed by cloud recovery, and idempotence after cloud completion.
- Upload-script tests verify that only final catalog media paths are planned, source validation catches missing/traversal/symlink paths, stale object calculation never leaves the exercise-media prefixes, and unrelated storage paths cannot become deletion candidates.
- WeChat developer-tools automation verifies user-visible behavior: filter changes produce the expected count and first page, scroll appends the next 24 items, list rows receive JPEG fileIDs, list images fall back safely, and action details retain GIF source selection.
- The existing Jest catalog, database, media-root, and upload-script suites are prior art. The automated simulator check is the integration seam for WXML binding, scrolling, and CloudBase fileID propagation.

## Out of Scope

- Changing the primary action ID, session snapshot shape, volume calculation, or historical record schema.
- Creating separate action catalogs for three-, four-, and five-day training splits.
- Automatically generating training plans or changing a user’s chosen split.
- Full public redistribution, commercial licensing, or relicensing of Gym visual JPEG/GIF media; ADR-0007’s personal-use and attribution constraints remain in force.
- Downloading all GIFs for list browsing, autoplaying GIFs in the list, or preloading the complete catalog media set.
- Adding arbitrary new CloudBase storage areas or deleting files outside the dedicated action image/video prefixes.

## Further Notes

Research basis:

- ACSM’s 2026 resistance-training position stand recommends covering major regions through upper/lower push/pull and horizontal/vertical movement patterns, and finds no material result advantage for many exercise variants when total training volume is matched.
- ExRx’s Basic/Compound classification provides the common foundational-movement baseline. It is used for curation rationale, not as a claim of a universal popularity ranking.
- A 2024 JSCR systematic review found split and full-body routines produce comparable strength and hypertrophy outcomes when volume is matched; three-, four-, and five-way splits therefore share one catalog.
- Exact curated IDs, Chinese names, action modes, tags, and compound markers are an implementation artifact and must be reviewed before regeneration. The current upstream directory is the candidate pool; no media synchronization occurs until the exact final whitelist passes catalog tests.
