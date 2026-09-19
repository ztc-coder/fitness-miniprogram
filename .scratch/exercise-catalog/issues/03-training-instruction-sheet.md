# 03: 打卡页能对照要领

**What to build:** 打卡过程中每个动作行内有示意图（没有图或旧 slug 查不到时用 glyph）。点缩略图打开与动作库相同的详情弹层，看动作演示位和中文要领，不必跳去动作库。弹层只读、没有「加入」。整场训练不自动播放多个 GIF。session 快照仍只有 exerciseId / name / equipment，不写入媒体路径。

**Blocked by:** 01: 离线全库可检索、可看要领

**Status:** ready-for-agent

- [ ] 打卡页每个未跳过动作能点开展示要领的同一套详情弹层
- [ ] 行内是示意图或 glyph，不是一排自动播放的 GIF
- [ ] 用 exerciseId 反查动作库；查不到时安静降级，不崩草稿
- [ ] 结束提交后的 session 不含 imagePath/gifPath/instructionSteps
- [ ] 今天页、计划清单、记录页仍不出现媒体
