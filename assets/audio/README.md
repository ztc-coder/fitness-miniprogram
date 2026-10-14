# 离线间歇提示音

`rest.wav` 是本项目自主通过数学正弦波合成的 0.3 秒短提示音，未采样或使用任何外部音频。单声道 16 kHz / 16-bit PCM WAV，9,644 字节，随小程序代码包离线使用。

生成：在仓库根目录执行 `node assets/audio/generate-rest.js`；无需依赖。

许可：本目录的生成脚本及生成音频由本项目贡献者以 **CC0 1.0 Universal** 贡献，允许复制、修改及商用，无需署名。许可全文：<https://creativecommons.org/publicdomain/zero/1.0/legalcode>。此许可不覆盖仓库其他媒体。

训练页显式播放，默认遵循系统静音设置；不设置全局音频选项、不后台保活。代码包根路径 `/assets/audio/rest.wav` 在微信 iOS/Android 的离线播放、静音与真实振动仍须按票 04 真机验证，Jest 不作为真机证据。