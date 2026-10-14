/**
 * 动作库官方原值的中文展示词汇(唯一一处定义,动作库页 / 打卡页详情共用)。
 * 只做展示与筛选键:不改 equipment / bodyPart 原值,不参与 volume 口径判定。
 * 未知原值一律回退英文原值——这是明确契约,不追求全量预置。
 */

/** 固定七类部位筛选键(英文内部键),顺序即部位行胶囊顺序:胸 背 肩 手臂 腿 腰腹 臀 */
const BODY_PART_KEYS = ['chest', 'back', 'shoulders', 'arms', 'legs', 'waist', 'glutes'];

const BODY_PART_LABELS = {
  chest: '胸',
  back: '背',
  shoulders: '肩',
  arms: '手臂',
  legs: '腿',
  waist: '腰腹',
  glutes: '臀',
};

/**
 * 上游非 cardio body_part 原值 → 七类键:颈归肩,上/下臂归手臂,上/下腿归腿。
 * 目标肌群 glutes 的动作优先归臀,所以「臀」和「腿」互斥、结果不重复。
 */
const BODY_PART_CATEGORY = {
  chest: 'chest',
  back: 'back',
  shoulders: 'shoulders',
  neck: 'shoulders',
  'upper arms': 'arms',
  'lower arms': 'arms',
  'upper legs': 'legs',
  'lower legs': 'legs',
  waist: 'waist',
};

const EQUIPMENT_LABELS = {
  barbell: '杠铃',
  dumbbell: '哑铃',
  'ez barbell': '曲杆',
  cable: '绳索',
  rope: '绳索',
  machine: '器械',
  'leverage machine': '器械',
  'smith machine': '史密斯机',
  'sled machine': '滑轨机',
  kettlebell: '壶铃',
  band: '弹力带',
  'resistance band': '弹力带',
  'body weight': '自重',
  weighted: '负重',
  assisted: '辅助',
  'medicine ball': '药球',
  'stability ball': '健身球',
  'bosu ball': '波速球',
  'olympic barbell': '奥林匹克杠铃',
  'trap bar': '六角杠铃',
  'wheel roller': '健腹轮',
  roller: '滚轮',
  hammer: '大锤',
  tire: '轮胎',
  'upper body ergometer': '上肢功率车',
  'skierg machine': '滑雪机',
};

/**
 * 器械行的固定序表(只含已知原值)。目录里出现的原值按此顺序排列,
 * 不在表内的未知原值按字母序追加在末尾。
 */
const EQUIPMENT_ORDER = [
  'barbell',
  'dumbbell',
  'ez barbell',
  'cable',
  'rope',
  'machine',
  'leverage machine',
  'smith machine',
  'sled machine',
  'kettlebell',
  'band',
  'resistance band',
  'body weight',
  'weighted',
  'assisted',
  'medicine ball',
  'stability ball',
  'bosu ball',
  'olympic barbell',
  'trap bar',
  'wheel roller',
  'roller',
  'hammer',
  'tire',
  'upper body ergometer',
  'skierg machine',
];

/** 动作条目 → 七类键:target === 'glutes' 优先归臀,未知 body_part 原值原样回退。 */
function bodyPartCategory(item) {
  if (!item) return '';
  if (item.target === 'glutes') return 'glutes';
  const bodyPart = item.bodyPart || '';
  return BODY_PART_CATEGORY[bodyPart] || bodyPart;
}

function bodyPartLabel(bodyPart) {
  return BODY_PART_LABELS[bodyPart] || bodyPart || '';
}

function equipmentLabel(equipment) {
  return EQUIPMENT_LABELS[equipment] || equipment || '';
}

/**
 * 发布目录里实际出现的 equipment 原值,稳定排序:已知原值走固定序表,未知原值按字母序追加。
 * assisted 与 body weight 是两个独立原值,不归并。
 */
function equipmentKeys(items) {
  const present = new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => item && item.equipment)
      .filter(Boolean)
  );
  const known = EQUIPMENT_ORDER.filter((key) => present.has(key));
  const unknown = [...present].filter((key) => EQUIPMENT_ORDER.indexOf(key) === -1).sort();
  return known.concat(unknown);
}

module.exports = {
  BODY_PART_KEYS,
  BODY_PART_LABELS,
  EQUIPMENT_LABELS,
  EQUIPMENT_ORDER,
  bodyPartCategory,
  bodyPartLabel,
  equipmentLabel,
  equipmentKeys,
};
