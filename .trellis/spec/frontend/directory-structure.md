# 目录结构

> 本项目前端代码的组织方式。

---

## 概览

微信原生小程序标准目录布局,按「页面」和「共享工具」两层组织,无 features/modules 目录,无 src 包裹层。

```
app.js / app.json / app.wxss     应用入口、路由与全局样式变量
pages/
  today/           今天:当前训练日卡片 + 开始训练
  plan/            计划:循环计划管理(增删训练日、排序、切换 active)
  plan-day/        训练日详情:动作列表与统一目标编辑
  library/         动作库:离线浏览、搜索、器械筛选、加练/加入训练日
  training/        训练中:set 录入、增删组、跳过、加练、完成提交
  records/         记录:场次时间线 + 单动作趋势曲线
  session-detail/  训练快照详情(不可变副本)
  me/              我的:偏好设置、待提交队列、授权状态
utils/
  domain.js        ★ domain logic 唯一 seam(纯函数,唯一被测试的模块)
  db.js            CloudBase 数据访问层(仓库模式,失败降级本地缓存)
  queue.js         提交队列执行器(注入真实网络请求,断网重试)
  format.js        展示层格式化(日期/数字/时长)
data/
  exercises.js     动作库离线数据(排除 cardio,文本随主包)
images/tabbar/     tabBar 图标
cloudfunctions/
  login/           静默 openid 登录云函数
tests/
  domain.test.js   domain 外部行为测试
  db.test.js       db 云降级本地行为测试
```

## 页面目录规范

每个页面目录下四个同名文件,一一对应,不拆子目录:

```
pages/<page-name>/
  <page-name>.js     Page 逻辑
  <page-name>.json    页面配置(如 navigationBarTitleText)
  <page-name>.wxml    页面结构
  <page-name>.wxss    页面样式(仅本页专属样式,通用样式放 app.wxss)
```

参考:`pages/today/today.js` + `.json` + `.wxml` + `.wxss`。

## utils 分层原则

- `domain.js`:纯逻辑,不依赖 `wx.*` API、不依赖网络,输入输出均为纯 JS 对象/数组。这是唯一的可测试 seam,新增业务规则优先往这里加。
- `db.js`:依赖 `wx.cloud`,做云数据库读写 + 本地缓存降级,内部调用 `domain.js` 做数据变换(如 `advancePlanCursor` 调 `domain.advanceCursor`)。
- `queue.js`:依赖 `wx.getStorageSync` / 网络状态,负责把 `domain.decideSubmission` 的纯判定接到真实提交动作上。
- `format.js`:纯函数,只做展示格式化(日期行、数字千分位、时长),不含业务规则。

新增工具函数先判断:不碰 `wx.*`/网络 → 放 `domain.js` 或 `format.js`;需要云端/本地存储 → 放 `db.js` 或 `queue.js`。

## 禁止事项

- 不要在 `pages/**/*.js` 里直接写业务规则(游标推进、volume 计算等),必须下沉到 `utils/domain.js`,否则无法被 Jest 覆盖。
- 不要新建 `components/` 自定义组件目录——目前全部用 Page 级 WXML,尚无跨页复用组件的先例;如需引入自定义组件,先跟用户确认。
