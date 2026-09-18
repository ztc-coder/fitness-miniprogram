/**
 * 动作库离线数据(随主包发布,本地可读)
 * 数据源:hasaneyldrm/exercises-dataset,已排除 cardio。
 * 字段精简为:id / nameZh / equipment / bodyPart / target / imagePath。
 * equipment == "body weight" 是判断自重动作、切换 volume/总次数口径的唯一依据。
 *
 * 图片与 GIF 走 CloudBase 云存储按需加载,不进主包。
 * ⚠️ 媒体版权归 Gym visual,上线前须取得书面授权并保留署名。
 */
// 顶层 require 分片(微信依赖分析扫不到 concat(require()) 参数,会导致分片未打包)
const EXERCISES_PART_1 = require('./exercises-data-1');
const EXERCISES_PART_2 = require('./exercises-data-2');
const EXERCISES_PART_3 = require('./exercises-data-3');
const EXERCISES = [].concat(EXERCISES_PART_1, EXERCISES_PART_2, EXERCISES_PART_3);
const SLUG_MAP = require('./slug-map');

if (!Array.isArray(EXERCISES) || EXERCISES.length === 0) {
  console.error('动作目录加载失败');
}

const EQUIPMENT_FILTERS = ['全部', 'barbell', 'dumbbell', 'cable', 'machine', 'body weight', 'other'];

const EQUIPMENT_LABELS = {
  barbell: '杠铃',
  dumbbell: '哑铃',
  cable: '绳索',
  machine: '器械',
  'body weight': '自重',
  other: '其他',
};

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

const BODY_PART_FILTERS = ['全部'].concat(Object.keys(BODY_PART_LABELS));

/** 非 cardio 的 18 个目标肌群枚举,固定中文表 */
const TARGET_LABELS = {
  abs: '腹部',
  abductors: '外展肌',
  adductors: '内收肌',
  biceps: '肱二头肌',
  calves: '小腿肌',
  delts: '三角肌',
  forearms: '前臂肌群',
  glutes: '臀肌',
  hamstrings: '腘绳肌',
  'levator scapulae': '肩胛提肌',
  lats: '背阔肌',
  pectorals: '胸大肌',
  quads: '股四头肌',
  'serratus anterior': '前锯肌',
  spine: '竖脊肌',
  traps: '斜方肌',
  triceps: '肱三头肌',
  'upper back': '上背',
};

function bodyPartLabel(bodyPart) {
  return BODY_PART_LABELS[bodyPart] || bodyPart || '';
}

function targetLabel(target) {
  return TARGET_LABELS[target] || target || '';
}

/**
 * 器械筛选桶语义归并:曲杠/奥杠/六角杠→杠铃,史密斯/杠杆/腿举→器械,
 * 绳→绳索,assisted→自重桶,其余(壶铃/弹力带/药球等)→其他。
 * 只影响筛选,不改变 equipment 原值、不影响 volume 口径(body weight 原值判定)。
 */
function equipmentBucket(equipment) {
  switch (equipment) {
    case 'barbell':
    case 'ez barbell':
    case 'olympic barbell':
    case 'trap bar':
      return 'barbell';
    case 'dumbbell':
      return 'dumbbell';
    case 'cable':
    case 'rope':
      return 'cable';
    case 'leverage machine':
    case 'smith machine':
    case 'sled machine':
      return 'machine';
    case 'body weight':
    case 'assisted':
      return 'body weight';
    default:
      return 'other';
  }
}

function equipmentLabel(equipment) {
  return EQUIPMENT_LABELS[equipment] || EQUIPMENT_LABELS[equipmentBucket(equipment)] || '其他';
}

function findById(id) {
  if (!id) return null;
  const numericId = Object.prototype.hasOwnProperty.call(SLUG_MAP, id) ? SLUG_MAP[id] : id;
  return EXERCISES.find((item) => item.id === numericId) || null;
}

/**
 * 搜索 + 器械桶 + 部位筛选,离线本地执行,三维 AND。
 * 关键词命中中文名、英文名、目标肌群中文、部位中文、器械中文。
 */
function search(query, equipment, bodyPart) {
  if (!Array.isArray(EXERCISES)) return [];
  const q = (query || '').trim().toLowerCase();
  return EXERCISES.filter((item) => {
    const matchQuery =
      !q ||
      item.nameZh.indexOf(q) !== -1 ||
      item.name.toLowerCase().indexOf(q) !== -1 ||
      targetLabel(item.target).indexOf(q) !== -1 ||
      bodyPartLabel(item.bodyPart).indexOf(q) !== -1 ||
      equipmentLabel(item.equipment).indexOf(q) !== -1;
    const matchEquipment =
      !equipment || equipment === '全部' || equipmentBucket(item.equipment) === equipment;
    const matchBodyPart = !bodyPart || bodyPart === '全部' || item.bodyPart === bodyPart;
    return matchQuery && matchEquipment && matchBodyPart;
  });
}

module.exports = {
  EXERCISES,
  EQUIPMENT_FILTERS,
  BODY_PART_FILTERS,
  BODY_PART_LABELS,
  equipmentBucket,
  equipmentLabel,
  bodyPartLabel,
  targetLabel,
  findById,
  search,
};
