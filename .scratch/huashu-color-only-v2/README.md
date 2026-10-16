# FORGE · C 配色精修 v2

用户选择：「以C为主，继续打磨」。以 `../huashu-color-only-v1/c-charcoal/` 为冻结基准，新增精修版。

## 本轮调整

- 头像：炭黑底 `#20262B` + 亮绿「训」`#C3ED42`，呼应主按钮和当前训练步骤。
- 历史图表：橄榄绿改为冷灰 `#879197`，最新 PR 仍用亮绿。
- 状态文字、图标、选中导航、月训练圆环：统一为深绿 `#3E5429`。
- 当前训练行和选中标签：浅绿 `#F2F6E8`，边框 `#A7B68F`；已完成行底色 `#F7F8F4`。

保留原 C 的黑底绿字主按钮、亮绿完成勾选、进度和开关。仅追加颜色 CSS；原 HTML、字体、字号、字重、行高、间距、圆角、边框宽度、阴影形态、透明度和数据均保留。

## 预览

```sh
python3 .scratch/huashu-color-only-v2/generate.py
python3 -m http.server 8793 --bind 127.0.0.1 --directory .scratch/huashu-color-only-v2
# 另一个终端
python3 .scratch/huashu-color-only-v2/capture.py
```

- 原版 / 精修对照：<http://127.0.0.1:8793/>
- 精修四页总览：<http://127.0.0.1:8793/overview.html>
- 单页：`refined-c/{today,training,records,me}.html?theme=light`
- 调色源：`refined-c/colors.css`、`refined-c/chrome-colors.css`

截图为 390×844。设计沿用静态数据，比较页支持切换页面、打开单页；产品内按钮为原稿静态示意，未接小程序业务。

## 验证

`capture.py` 对照原 C 与精修 C 的页面、外层导航及伪元素布局和排版，检查颜色实际生效、核心色对对比度及比较页切换，再保存截图与 `verification.json`。原 C 文件哈希保存在 `source-hashes.json`。本轮不依赖已缺失的 `cyan-light-design-v4/`。

本轮实际验证结果：

- 四页共 1701 项元素 / 伪元素量测，原 C 与精修 C 的几何、排版和效果形态差异为 0，页面正文 DOM 相同。
- 四页新色实际生效，主按钮仍为炭黑底亮绿字，浏览器页面错误为 0。
- 六组核心色对通过：主按钮 / 头像 11.29:1；深绿文字最低 7.63:1；灰色历史柱对白底 3.22:1。
- 比较页四个切换按钮和对应单页链接通过检查，已保存四组对照图和 `overview.png`。
- 八份原 C HTML 文件哈希未变，`original-c/` 副本与源文件逐字节相同。

具体执行结果见 `verification.json`；核心色对检查不等于完整无障碍审计。