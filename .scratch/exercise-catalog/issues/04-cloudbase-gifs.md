# 04: 标准动作 GIF 能播

**What to build:** 示意图和动作演示上传到 CloudBase 并按需加载。打开任意已接入动作的详情（动作库或打卡弹层），能看到 180×180 分解 GIF；GIF 失败退示意图，再失败退 glyph。页面保留 © Gym visual 署名。不热链 GitHub。未授权媒体仅个人自用。

**Blocked by:** 01: 离线全库可检索、可看要领

**Status:** ready-for-agent

- [ ] 详情弹层对已上传动作播放分解 GIF（例：杠铃卧推）
- [ ] GIF 失败→示意图→glyph 的降级可观察到
- [ ] 若 03 已完成，打卡行内缩略图为示意图而非永远 glyph
- [ ] 主包不含 GIF/JPEG 二进制；有可重复的上传方式与 fileID 前缀配置
- [ ] 详情可见 `© Gym visual — https://gymvisual.com/`
