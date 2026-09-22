/**
 * 动作库官方原值的中文展示词汇(唯一一处定义,动作库页 / 打卡页详情共用)。
 * 只做展示与筛选键:不改 equipment / bodyPart 原值,不参与 volume 口径判定。
 * 未知原值一律回退英文原值——这是明确契约,不追求全量预置。
 */

/** 官方非 cardio 的 9 个 body_part 原值,顺序即部位行胶囊顺序 */
const BODY_PART_KEYS = [
  'back',
  'chest',
  'lower arms',
  'lower legs',
  'neck',
  'shoulders',
  'upper arms',
  'upper legs',
  'waist',
];

const BODY_PART_LABELS = {
  back: '背',
  chest: '胸',
  'lower arms': '前臂',
  'lower legs': '小腿',
  neck: '颈',
  shoulders: '肩',
  'upper arms': '上臂',
  'upper legs': '大腿',
  waist: '腰腹',
};

const EQUIPMENT_LABELS = {
  barbell: '杠铃',
  dumbbell: '哑铃',
  'ez barbell': 'EZ杆',
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
];

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
  bodyPartLabel,
  equipmentLabel,
  equipmentKeys,
};
