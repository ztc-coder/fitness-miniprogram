/**
 * 动作库离线数据(随主包发布,本地可读)
 * 数据源:hasaneyldrm/exercises-dataset,经 data/curated-catalog.js 精选 exerciseId 白名单裁剪,
 * 只含经审查的健身房常用动作(当前 136 条,规格区间约 100–140 条)。已排除 cardio 与白名单外肌群。
 * 字段精简为:id / name / nameZh / equipment / bodyPart / target / imagePath / gifPath / instructionSteps / aliases。
 * aliases 是健身房俗称(如「倒蹬」「龙门架」),只参与关键词搜索,不参与部位筛选、不改展示名。
 * equipment == "body weight" 是判断自重动作、切换 volume/总次数口径的唯一依据。
 * 部位筛选与复合标记以精选元数据为准,不依赖上游 bodyPart 字段。
 *
 * 图片与 GIF 走 CloudBase 云存储按需加载,不进主包。
 * ⚠️ 媒体版权归 Gym visual,上线前须取得书面授权并保留署名。
 */
// 顶层 require 分片(微信依赖分析扫不到 concat(require()) 参数,会导致分片未打包)
const EXERCISES_PART_1 = require('./exercises-data-1');
const EXERCISES = [].concat(EXERCISES_PART_1);
const SLUG_MAP = require('./slug-map');
const { CURATED_EXERCISES, PART_LABELS, PART_FILTERS } = require('./curated-catalog');

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

/**
 * 部位匹配走精选元数据:compound 标签命中全部复合动作,
 * warm-up 与具体部位标签一样按 tags 命中(热身动作同时带具体部位标签,可重叠命中)。
 */
function matchCuratedPart(id, part) {
  if (!part || part === '全部') return true;
  const meta = CURATED_EXERCISES[id];
  if (!meta) return false;
  if (part === 'compound') return meta.compound;
  return meta.tags.indexOf(part) !== -1;
}

/** 详情展示用:部位标签中文(复合动作追加在末尾),如「胸 · 三头肌 · 复合动作」 */
function partTagsLabel(id) {
  const meta = CURATED_EXERCISES[id];
  if (!meta) return '';
  const labels = meta.tags.map((tag) => PART_LABELS[tag]).filter(Boolean);
  if (meta.compound) labels.push(PART_LABELS.compound);
  return labels.join(' · ');
}

function findById(id) {
  if (!id) return null;
  const numericId = Object.prototype.hasOwnProperty.call(SLUG_MAP, id) ? SLUG_MAP[id] : id;
  return EXERCISES.find((item) => item.id === numericId) || null;
}

/**
 * 搜索 + 器械桶 + 部位标签筛选,离线本地执行,三维 AND。
 * 关键词命中中文名、英文名、目标肌群中文、部位中文、器械中文、别名(俗称)。
 * 部位用精选元数据标签(含 compound 重叠标签),不用上游 bodyPart 字段。
 */
function search(query, equipment, part) {
  if (!Array.isArray(EXERCISES)) return [];
  const q = (query || '').trim().toLowerCase();
  return EXERCISES.filter((item) => {
    const matchQuery =
      !q ||
      item.nameZh.indexOf(q) !== -1 ||
      item.name.toLowerCase().indexOf(q) !== -1 ||
      targetLabel(item.target).indexOf(q) !== -1 ||
      bodyPartLabel(item.bodyPart).indexOf(q) !== -1 ||
      equipmentLabel(item.equipment).indexOf(q) !== -1 ||
      (item.aliases || []).some((alias) => String(alias).toLowerCase().indexOf(q) !== -1);
    const matchEquipment =
      !equipment || equipment === '全部' || equipmentBucket(item.equipment) === equipment;
    const matchPart = matchCuratedPart(item.id, part);
    return matchQuery && matchEquipment && matchPart;
  });
}

module.exports = {
  EXERCISES,
  EQUIPMENT_FILTERS,
  PART_FILTERS,
  PART_LABELS,
  CURATED_EXERCISES,
  equipmentBucket,
  equipmentLabel,
  bodyPartLabel,
  targetLabel,
  partTagsLabel,
  findById,
  search,
};
