# 训练日志 · 健身训练小程序 MVP

个人自用的力量训练打卡工具:「第 N 天循环」计划 + 完成驱动游标推进 + 离线打卡 + 快照式历史记录。

- 需求规格:`docs/spec.md`

## 设计系统:FORGE

深色运动编辑风,全局深墨绿,签名元素为「今天」页的巨型描边游标数字(DAY 01)。

| 角色 | 色值 | 用途 |
|---|---|---|
| 底色 | `#0c1613` | 全局背景 |
| 浮层 | `#14211c` / `#1b2b24` | 卡片、输入框 |
| 信号绿 | `#3ddc97` | 行动按钮、完成态、数据强调 |
| 琥珀 | `#ffb020` | 游标/进行中标记、状态章、头像 |
| 墨色 | `#eef5f1` | 主文字(55%/32% 两级弱化) |

- 数字一律等宽(SF Mono / tabular-nums),与中文黑体形成字体张力
- 结构编码:字标 01 02 03 = 第 N 天循环的顺序;琥珀点 = 当前游标
- tabBar 图标:imgGen 生成字形,重着色为信号绿/灰绿双态

## 技术栈

- 前端:微信原生小程序(WXML / WXSS / JS),无 TypeScript / 跨端框架
- 后端:微信云开发 CloudBase(云数据库 + 云存储 + 云函数)
- 测试:Jest(domain、目录、页面级 Page harness、迁移和媒体同步纯函数)

## 目录结构

```
app.js / app.json / app.wxss     应用入口、路由与全局设计规范
pages/
  today/         今天:当前训练日卡片 + 开始训练
  plan/          计划:循环计划管理(增删训练日、排序、切换 active)
  plan-day/      训练日详情:动作列表与统一目标编辑
  library/       动作库:136 条精选目录、关键词(含俗称别名)/器械/10 个部位标签(含热身)筛选、24 条分页 JPEG 缩略图、加练/加入训练日
  training/      训练中:set 录入、增删组、跳过、加练、完成提交
  records/       记录:场次时间线 + 单动作趋势曲线(volume/总次数)
  session-detail/ 训练快照详情(不可变副本)
  me/            我的:偏好设置、待提交队列、授权状态
utils/
  domain.js      ★ domain logic 唯一 seam(游标推进/快照/volume/提交队列,纯函数)
  db.js          CloudBase 数据访问层(仓库模式,失败降级本地缓存)
  queue.js       提交队列执行器(注入真实网络,断网重试)
  format.js      展示格式化
data/               精选白名单、离线动作目录、媒体根与生成分片
images/tabbar/     tabBar 图标(imgGen 生成字形,纯色重着色为双态 81px)
images/tabbar/gen/ 图标原始生成图(1024px,供二次编辑参考)
cloudfunctions/login/  静默 openid 登录
tests/              Jest 外部行为测试（domain、目录、页面分页、迁移、媒体同步）
```

## 本地开发

1. 微信开发者工具导入本目录(appid 已配置,或用测试号)。
2. 开通云开发,把 `app.js` 顶部 `ENV_ID` 替换为真实环境 ID。
3. 右键 `cloudfunctions/login` → 上传并部署(云端安装依赖)。
4. 云数据库建集合 `plans`、`sessions`(权限:仅创建者可读写)。
5. 首次进入自动种入「胸三 / 背二 / 肩腿」演示计划,打开即用。

## 测试

```bash
npm install
npm test
```

## 发布前置阻塞项

- ⚠️ 动作示意图/GIF 版权归 Gym visual,上线前必须取得书面授权、保留 `© Gym visual — https://gymvisual.com/` 署名并遵守 180×180 分辨率限制。图片/GIF 走 CloudBase 云存储按需加载,不进主包。
- 动作库 JSON 体积实测:当前为 136 条精选子集（规格区间约 100–140 条）,需确认是否落进 2MB 主包,超出则走分包。
- ⚠️ `.scratch/catalog-expansion/issues/05-integration-acceptance-and-docs.md` 的真实微信开发者工具端到端行为、CloudBase 最终媒体集合（136 条 × JPEG/GIF = 272 个受管对象）和旧媒体清理仍待人工验收；Node mock、媒体同步 dry-run 和 Jest 不能替代该验收。
