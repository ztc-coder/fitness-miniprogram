/**
 * 精选常用动作目录:精确 exerciseId 白名单 + 人工策展元数据(可审计)。
 * 不做英文名关键词猜测;调整白名单后需重跑 scripts/build-exercises.js 重新生成 data/exercises-data-*。
 *
 * 最终 136 条(104 − 2 + 34),按 ID 升序排列便于逐行比对。
 * 本文件即白名单与逐条策展元数据的唯一权威;与 data/exercises.js 必须一一对应(136 = 136)。
 *
 * 每条元数据:
 *  - mode     规范动作模式(受控词表,如 horizontal-push / squat / elbow-flexion)
 *  - tags     产品面向标签,取值见 PART_LABELS;warm-up(中文「热身」)是第 10 个产品标签
 *  - compound 是否复合动作(多关节)。复合是重叠标签:选中「复合动作」命中全部标记动作,
 *             选中具体部位仍命中该部位下标记了 compound 的动作。
 */
const CURATED_EXERCISES = {
  '0009': { mode: 'dip', tags: ['chest', 'triceps'], compound: true }, // 辅助双杠臂屈伸
  '0017': { mode: 'vertical-pull', tags: ['back'], compound: true }, // 辅助引体向上
  '0019': { mode: 'dip', tags: ['triceps'], compound: true }, // 辅助肱三头肌臂屈伸 (跪姿)
  '0025': { mode: 'horizontal-push', tags: ['chest'], compound: true }, // 杠铃卧推
  '0027': { mode: 'horizontal-pull', tags: ['back'], compound: true }, // 杠铃俯身划船
  '0030': { mode: 'horizontal-push', tags: ['triceps', 'chest'], compound: true }, // 杠铃窄距卧推
  '0031': { mode: 'elbow-flexion', tags: ['biceps'], compound: false }, // 杠铃弯举
  '0032': { mode: 'hip-hinge', tags: ['legs', 'back', 'glutes'], compound: true }, // 杠铃硬拉
  '0042': { mode: 'squat', tags: ['legs', 'glutes'], compound: true }, // 杠铃前蹲
  '0043': { mode: 'squat', tags: ['legs', 'glutes'], compound: true }, // 杠铃深蹲
  '0046': { mode: 'squat', tags: ['legs', 'glutes'], compound: true }, // 杠铃哈克深蹲
  '0047': { mode: 'incline-push', tags: ['chest'], compound: true }, // 杠铃上斜卧推
  '0060': { mode: 'elbow-extension', tags: ['triceps'], compound: false }, // 仰卧臂屈伸
  '0085': { mode: 'hip-hinge', tags: ['legs', 'glutes'], compound: true }, // 罗马尼亚硬拉
  '0088': { mode: 'plantar-flexion', tags: ['legs'], compound: false }, // 杠铃坐姿提踵
  '0091': { mode: 'vertical-push', tags: ['shoulders'], compound: true }, // 杠铃坐姿过头推举
  '0092': { mode: 'elbow-extension', tags: ['triceps'], compound: false }, // 杠铃过头臂屈伸
  '0117': { mode: 'hip-hinge', tags: ['legs', 'glutes'], compound: true }, // 杠铃相扑硬拉
  '0120': { mode: 'upright-row', tags: ['shoulders'], compound: true }, // 杠铃直立划船
  '0165': { mode: 'elbow-flexion', tags: ['biceps'], compound: false }, // 绳索锤式弯举
  '0171': { mode: 'chest-fly', tags: ['chest'], compound: false }, // 绳索上斜飞鸟
  '0175': { mode: 'trunk-flexion', tags: ['waist'], compound: false }, // 绳索卷腹
  '0178': { mode: 'shoulder-abduction', tags: ['shoulders'], compound: false }, // 绳索侧平举
  '0188': { mode: 'chest-fly', tags: ['chest'], compound: false }, // 绳索夹胸
  '0194': { mode: 'elbow-extension', tags: ['triceps'], compound: false }, // 绳索过头臂屈伸
  '0196': { mode: 'hip-hinge', tags: ['glutes', 'legs'], compound: true }, // 绳索穿腿后拉
  '0198': { mode: 'vertical-pull', tags: ['back'], compound: true }, // 高位下拉
  '0201': { mode: 'elbow-extension', tags: ['triceps'], compound: false }, // 绳索下压
  '0213': { mode: 'horizontal-pull', tags: ['back'], compound: true }, // 绳索 V 杆划船
  '0216': { mode: 'shoulder-internal-rotation', tags: ['shoulders', 'warm-up'], compound: false }, // 绳索坐姿肩内旋
  '0223': { mode: 'trunk-lateral-flexion', tags: ['waist'], compound: false }, // 绳索侧卷腹
  '0226': { mode: 'trunk-flexion', tags: ['waist'], compound: false }, // 站姿绳索卷腹
  '0227': { mode: 'chest-fly', tags: ['chest'], compound: false }, // 绳索站姿飞鸟
  '0228': { mode: 'hip-extension', tags: ['glutes', 'legs'], compound: false }, // 绳索后踢腿
  '0233': { mode: 'shoulder-horizontal-abduction', tags: ['shoulders', 'back', 'warm-up'], compound: false }, // 绳索面拉
  '0235': { mode: 'shoulder-external-rotation', tags: ['shoulders', 'warm-up'], compound: false }, // 绳索站姿肩外旋
  '0238': { mode: 'shoulder-extension', tags: ['back'], compound: false }, // 绳索直臂下拉
  '0243': { mode: 'trunk-rotation', tags: ['waist'], compound: false }, // 绳索转体
  '0246': { mode: 'upright-row', tags: ['shoulders'], compound: true }, // 绳索直立划船
  '0251': { mode: 'dip', tags: ['chest', 'triceps'], compound: true }, // 双杠臂屈伸
  '0274': { mode: 'trunk-flexion', tags: ['waist'], compound: false }, // 卷腹
  '0276': { mode: 'anti-extension', tags: ['waist', 'warm-up'], compound: false }, // 死虫式
  '0289': { mode: 'horizontal-push', tags: ['chest'], compound: true }, // 哑铃卧推
  '0293': { mode: 'horizontal-pull', tags: ['back'], compound: true }, // 哑铃俯身划船
  '0294': { mode: 'elbow-flexion', tags: ['biceps'], compound: false }, // 哑铃弯举
  '0297': { mode: 'elbow-flexion', tags: ['biceps'], compound: false }, // 哑铃集中弯举
  '0308': { mode: 'chest-fly', tags: ['chest'], compound: false }, // 哑铃飞鸟
  '0310': { mode: 'shoulder-flexion', tags: ['shoulders'], compound: false }, // 哑铃前平举
  '0313': { mode: 'elbow-flexion', tags: ['biceps'], compound: false }, // 锤式弯举
  '0314': { mode: 'incline-push', tags: ['chest'], compound: true }, // 上斜哑铃卧推
  '0315': { mode: 'elbow-flexion', tags: ['biceps'], compound: false }, // 哑铃上斜弯举
  '0319': { mode: 'chest-fly', tags: ['chest'], compound: false }, // 哑铃上斜飞鸟
  '0333': { mode: 'elbow-extension', tags: ['triceps'], compound: false }, // 哑铃后摆臂屈伸
  '0334': { mode: 'shoulder-abduction', tags: ['shoulders'], compound: false }, // 哑铃侧平举
  '0336': { mode: 'lunge', tags: ['legs', 'glutes'], compound: true }, // 哑铃箭步蹲
  '0372': { mode: 'elbow-flexion', tags: ['biceps'], compound: false }, // 哑铃牧师凳弯举
  '0381': { mode: 'lunge', tags: ['legs', 'glutes'], compound: true }, // 反向箭步蹲
  '0405': { mode: 'vertical-push', tags: ['shoulders'], compound: true }, // 哑铃推举
  '0407': { mode: 'trunk-lateral-flexion', tags: ['waist'], compound: false }, // 站姿哑铃侧屈
  '0417': { mode: 'plantar-flexion', tags: ['legs'], compound: false }, // 哑铃站姿提踵
  '0431': { mode: 'step-up', tags: ['legs', 'glutes'], compound: true }, // 哑铃登阶
  '0432': { mode: 'hip-hinge', tags: ['legs', 'glutes'], compound: true }, // 哑铃直腿硬拉
  '0437': { mode: 'upright-row', tags: ['shoulders'], compound: true }, // 哑铃直立划船
  '0447': { mode: 'elbow-flexion', tags: ['biceps'], compound: false }, // 曲杠弯举
  '0464': { mode: 'trunk-rotation', tags: ['waist'], compound: false }, // 平板支撑带转体
  '0472': { mode: 'hip-flexion', tags: ['waist'], compound: false }, // 悬垂举腿
  '0475': { mode: 'hip-flexion', tags: ['waist'], compound: false }, // 悬垂直腿举腿
  '0489': { mode: 'trunk-extension', tags: ['back', 'glutes', 'legs'], compound: false }, // 山羊挺身
  '0493': { mode: 'incline-push', tags: ['chest', 'triceps'], compound: true }, // 上斜俯卧撑
  '0499': { mode: 'horizontal-pull', tags: ['back'], compound: true }, // 反向划船
  '0507': { mode: 'trunk-flexion', tags: ['waist'], compound: false }, // 折刀式仰卧起坐
  '0573': { mode: 'trunk-extension', tags: ['back', 'glutes', 'legs'], compound: false }, // 器械山羊挺身
  '0575': { mode: 'elbow-flexion', tags: ['biceps'], compound: false }, // 器械弯举
  '0576': { mode: 'horizontal-push', tags: ['chest'], compound: true }, // 器械推胸
  '0584': { mode: 'shoulder-abduction', tags: ['shoulders'], compound: false }, // 器械侧平举
  '0585': { mode: 'knee-extension', tags: ['legs'], compound: false }, // 器械腿屈伸
  '0586': { mode: 'knee-flexion', tags: ['legs'], compound: false }, // 俯卧腿弯举
  '0592': { mode: 'elbow-flexion', tags: ['biceps'], compound: false }, // 器械牧师凳弯举
  '0596': { mode: 'chest-fly', tags: ['chest'], compound: false }, // 器械夹胸
  '0597': { mode: 'hip-abduction', tags: ['glutes', 'legs'], compound: false }, // 器械髋外展
  '0598': { mode: 'hip-adduction', tags: ['legs'], compound: false }, // 器械髋内收
  '0599': { mode: 'knee-flexion', tags: ['legs'], compound: false }, // 器械坐姿腿弯举
  '0602': { mode: 'shoulder-horizontal-abduction', tags: ['shoulders'], compound: false }, // 器械反向飞鸟
  '0603': { mode: 'vertical-push', tags: ['shoulders'], compound: true }, // 器械肩推
  '0605': { mode: 'plantar-flexion', tags: ['legs'], compound: false }, // 站姿提踵
  '0606': { mode: 'horizontal-pull', tags: ['back'], compound: true }, // T 杆划船
  '0607': { mode: 'elbow-extension', tags: ['triceps'], compound: false }, // 器械臂屈伸
  '0620': { mode: 'hip-flexion', tags: ['waist'], compound: false }, // 仰卧举腿
  '0624': { mode: 'squat', tags: ['legs', 'glutes'], compound: true }, // 靠墙坐姿行军
  '0628': { mode: 'hip-abduction', tags: ['glutes', 'legs', 'warm-up'], compound: false }, // 怪物行走
  '0652': { mode: 'vertical-pull', tags: ['back'], compound: true }, // 引体向上
  '0659': { mode: 'horizontal-push', tags: ['chest', 'shoulders'], compound: true }, // 靠墙俯卧撑
  '0662': { mode: 'horizontal-push', tags: ['chest', 'triceps'], compound: true }, // 俯卧撑
  '0687': { mode: 'trunk-rotation', tags: ['waist'], compound: false }, // 俄罗斯转体
  '0688': { mode: 'scapular-retraction', tags: ['back', 'shoulders', 'warm-up'], compound: true }, // 肩胛引体
  '0705': { mode: 'anti-extension', tags: ['waist', 'warm-up'], compound: false }, // 侧平板支撑
  '0710': { mode: 'hip-abduction', tags: ['glutes', 'legs', 'warm-up'], compound: false }, // 站姿髋外展
  '0735': { mode: 'trunk-flexion', tags: ['waist'], compound: false }, // 仰卧起坐
  '0739': { mode: 'squat', tags: ['legs', 'glutes'], compound: true }, // 腿举
  '0743': { mode: 'squat', tags: ['legs', 'glutes'], compound: true }, // 雪橇机哈克深蹲
  '0748': { mode: 'horizontal-push', tags: ['chest'], compound: true }, // 史密斯卧推
  '0757': { mode: 'incline-push', tags: ['chest'], compound: true }, // 史密斯上斜卧推
  '0766': { mode: 'vertical-push', tags: ['shoulders'], compound: true }, // 史密斯肩推
  '0770': { mode: 'squat', tags: ['legs', 'glutes'], compound: true }, // 史密斯深蹲
  '0814': { mode: 'dip', tags: ['triceps'], compound: true }, // 肱三头肌臂屈伸
  '0861': { mode: 'horizontal-pull', tags: ['back'], compound: true }, // 坐姿划船
  '0864': { mode: 'shoulder-external-rotation', tags: ['shoulders', 'warm-up'], compound: false }, // 哑铃站姿肩外旋
  '0868': { mode: 'elbow-flexion', tags: ['biceps'], compound: false }, // 绳索弯举
  '0872': { mode: 'trunk-flexion', tags: ['waist'], compound: false }, // 反向卷腹
  '0979': { mode: 'anti-rotation', tags: ['waist'], compound: false }, // 水平弹力带 Pallof 推
  '0993': { mode: 'shoulder-horizontal-abduction', tags: ['shoulders', 'back', 'warm-up'], compound: false }, // 弹力带拉开
  '1017': { mode: 'shoulder-abduction', tags: ['shoulders', 'back', 'warm-up'], compound: false }, // 弹力带 Y 字举
  '1299': { mode: 'incline-push', tags: ['chest'], compound: true }, // 器械上斜推胸
  '1326': { mode: 'vertical-pull', tags: ['back'], compound: true }, // 反握引体向上
  '1350': { mode: 'horizontal-pull', tags: ['back'], compound: true }, // 器械坐姿划船
  '1361': { mode: 'horizontal-pull', tags: ['back'], compound: true }, // 史密斯反手划船
  '1409': { mode: 'hip-thrust', tags: ['glutes', 'legs'], compound: true }, // 杠铃臀桥
  '1457': { mode: 'vertical-push', tags: ['shoulders'], compound: true }, // 杠铃推举
  '1460': { mode: 'lunge', tags: ['legs', 'glutes'], compound: true }, // 弓步蹲
  '1604': { mode: 'mobility-flow', tags: ['legs', 'glutes', 'warm-up'], compound: false }, // 世界最伟大拉伸
  '1757': { mode: 'hip-hinge', tags: ['legs', 'glutes'], compound: true }, // 单腿硬拉
  '1760': { mode: 'squat', tags: ['legs', 'glutes'], compound: true }, // 哑铃高脚杯深蹲
  '2133': { mode: 'carry', tags: ['legs', 'back', 'waist', 'glutes'], compound: true }, // 农夫行走
  '2137': { mode: 'vertical-push', tags: ['shoulders'], compound: true }, // 哑铃阿诺德推举
  '2143': { mode: 'shoulder-circumduction', tags: ['shoulders', 'warm-up'], compound: false }, // 哑铃肩绕环
  '2188': { mode: 'elbow-extension', tags: ['triceps'], compound: false }, // 哑铃颈后臂屈伸
  '2292': { mode: 'shoulder-horizontal-abduction', tags: ['shoulders'], compound: false }, // 俯身哑铃飞鸟
  '2368': { mode: 'lunge', tags: ['legs', 'glutes'], compound: true }, // 保加利亚分腿蹲
  '2616': { mode: 'vertical-pull', tags: ['back'], compound: true }, // V 杆窄距高位下拉
  '3006': { mode: 'hip-abduction', tags: ['glutes', 'legs', 'warm-up'], compound: false }, // 弹力带坐姿髋外展
  '3011': { mode: 'scapular-protraction', tags: ['chest', 'shoulders', 'warm-up'], compound: false }, // 上斜肩胛俯卧撑
  '3012': { mode: 'scapular-retraction', tags: ['back', 'shoulders', 'warm-up'], compound: false }, // 站姿肩胛后缩撑起
  '3013': { mode: 'hip-thrust', tags: ['glutes', 'legs'], compound: true }, // 臀桥
  '3021': { mode: 'scapular-protraction', tags: ['chest', 'shoulders', 'warm-up'], compound: false }, // 肩胛俯卧撑
  '3561': { mode: 'hip-thrust', tags: ['glutes', 'legs', 'warm-up'], compound: true }, // 臀桥行军
  '3699': { mode: 'anti-extension', tags: ['waist'], compound: false }, // 交替触肩
};

/**
 * 产品面向标签(用户可见契约),顺序即筛选顺序,共 11 项(含「全部」):
 * 全部 / 胸 / 背 / 肩 / 二头肌 / 三头肌 / 腿 / 腰腹 / 臀 / 热身 / 复合动作。
 * warm-up 与 compound 都是重叠标签:warm-up 命中带该 tag 的热身动作,这些动作同时保留具体部位标签。
 */
const PART_LABELS = {
  chest: '胸',
  back: '背',
  shoulders: '肩',
  biceps: '二头肌',
  triceps: '三头肌',
  legs: '腿',
  waist: '腰腹',
  glutes: '臀',
  'warm-up': '热身',
  compound: '复合动作',
};

const PART_FILTERS = ['全部'].concat(Object.keys(PART_LABELS));

module.exports = { CURATED_EXERCISES, PART_LABELS, PART_FILTERS };
