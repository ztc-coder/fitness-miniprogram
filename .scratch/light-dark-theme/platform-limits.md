# 微信手动主题能力与边界

来源：微信官方文档；研究原始记录 `/tmp/fitness-light-dark-theme/platform-notes.md`。本项目采用本机手动选择，不启用跟随系统的 `darkmode/theme.json`，不用 `prefers-color-scheme` 媒体查询。

| 接入点 | 可手动控制 | 限制与最低基础库 |
| --- | --- | --- |
| [setNavigationBarColor](https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.setNavigationBarColor.html) | 导航栏底色，标题／按钮／状态栏前景 | 前景仅 `#000000` / `#ffffff`；1.4.0 |
| [setBackgroundColor](https://developers.weixin.qq.com/miniprogram/dev/api/ui/background/wx.setBackgroundColor.html) | 窗口底色 | 顶／底独立底色仅 iOS；2.1.0 |
| [setBackgroundTextStyle](https://developers.weixin.qq.com/miniprogram/dev/api/ui/background/wx.setBackgroundTextStyle.html) | 下拉 loading 样式 | 仅 `dark` / `light`；2.1.0 |
| [setTabBarStyle](https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.setTabBarStyle.html) | 文字、选中文字、底色、分隔线 | 分隔线仅 `black` / `white`；1.9.0 |
| [setTabBarItem](https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.setTabBarItem.html) | 选中／未选中图标路径 | 无运行时染色；每图 ≤40KB，本地 PNG；1.9.0 |
| [showModal](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showModal.html) | `confirmColor` / `cancelColor` 按钮文字 | 底板、标题、正文、遮罩无颜色参数 |
| [showActionSheet](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showActionSheet.html) | `itemColor` 菜单文字 | 底板、取消按钮、遮罩无颜色参数 |
| [picker](https://developers.weixin.qq.com/miniprogram/dev/component/picker.html) | 页面中的触发区域 | 原生弹出面板无配色属性；保留原控件 |
| [switch](https://developers.weixin.qq.com/miniprogram/dev/component/switch.html) | `color` 激活色 | 其余原生形态由客户端绘制 |
| [input](https://developers.weixin.qq.com/miniprogram/dev/component/input.html) | 文字及 `placeholder-style` / `placeholder-class` | 键盘外观由客户端控制；光标色有平台限制 |

## 验收解释

- 浅色原生导航前景选黑，深色恢复原白；tabBar 分隔线使用平台允许的黑／白值，不能承诺精确映射设计稿的 `#E5E8EB`。
- 深色图标复用原资源；浅色新增同尺寸、同形状、同 alpha 的双色 PNG，浅色选中深绿 `#3E5429`、未选中灰 `#626D76`。
- 页面自绘弹层、共享动作详情、图表与输入占位属于可控范围，按规格适配。
- 系统弹窗／操作菜单底板、picker 弹出面板和键盘外观列为平台限制；模拟器结果不能代替 iOS／Android 真机与不同微信客户端外观组合的验收。
- 不为外观替换业务控件。原生弹窗按钮色需结合客户端底板保证可读，不能将页面主按钮的亮绿文字直接套用到系统白底。
- [DarkMode 官方说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/darkmode.html)：`prefers-color-scheme` 不受 `darkmode` 开关控制；本实现应避免使用它，以免覆盖手动选择。