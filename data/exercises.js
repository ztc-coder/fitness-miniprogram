/**
 * 动作库离线数据(随主包发布,本地可读)
 * 历史精选元数据保留作迁移兼容，不再控制发布目录；当前发布目录由生成器产出的非 cardio 可用全量分片提供。
 * 字段精简为:id / name / nameZh / equipment / bodyPart / target / imagePath / gifPath / instructionSteps / aliases。
 * aliases 是健身房俗称(如「倒蹬」「龙门架」),只参与关键词搜索,不参与筛选、不改展示名。
 * equipment == "body weight" 是判断自重动作、切换 volume/总次数口径的唯一依据。
 * 检索只认官方原值:关键词命中 id / name / nameZh / target / bodyPart / equipment 与 aliases,
 * 器械、部位按目录里实际出现的原值多选筛选(组内 OR、维度间 AND);
 * 不再提供器械归并桶,也不再用精选部位标签 / 热身 / 复合 / 模式参与筛选。
 *
 * 图片与 GIF 走 CloudBase 云存储按需加载,不进主包。
 * ⚠️ 媒体版权归 Gym visual,上线前须取得书面授权并保留署名。
 */
// 顶层显式 require 分片，兼容当前 125 条目录与全量生成后的 3 个分片。
// 空的后续分片由仓库占位，生成器重跑时会覆盖为真实目录。
const EXERCISES_PART_1 = require('./exercises-data-1');
const EXERCISES_PART_2 = require('./exercises-data-2');
const EXERCISES_PART_3 = require('./exercises-data-3');
const EXERCISES = [].concat(EXERCISES_PART_1, EXERCISES_PART_2, EXERCISES_PART_3);
const SLUG_MAP = require('./slug-map');
const CURATED_EXERCISES = require('./curated-catalog').CURATED_EXERCISES; // 历史兼容导出，不参与发布目录筛选。

if (!Array.isArray(EXERCISES) || EXERCISES.length === 0) {
  console.error('动作目录加载失败');
}

/** 非 cardio 的 18 个目标肌群枚举,固定中文表(详情展示用,不参与筛选) */
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

function targetLabel(target) {
  return TARGET_LABELS[target] || target || '';
}

function findById(id) {
  if (!id) return null;
  const numericId = Object.prototype.hasOwnProperty.call(SLUG_MAP, id) ? SLUG_MAP[id] : id;
  return EXERCISES.find((item) => item.id === numericId) || null;
}

/** 统一小写比较,缺失字段按空串处理,避免把 undefined 当字符串命中。 */
function lower(value) {
  return value === undefined || value === null ? '' : String(value).toLowerCase();
}

/**
 * 关键词命中:英文名、中文名、id、目标肌群、部位、器械原值(均为数据集原值)与俗称别名。
 * 全部统一小写比较,避免中文名里的拉丁字母(如「绳索 V 杆划船」)大小写不一致漏命中。
 */
function matchKeyword(item, q) {
  return (
    lower(item.id).indexOf(q) !== -1 ||
    lower(item.name).indexOf(q) !== -1 ||
    lower(item.nameZh).indexOf(q) !== -1 ||
    lower(item.target).indexOf(q) !== -1 ||
    lower(item.bodyPart).indexOf(q) !== -1 ||
    lower(item.equipment).indexOf(q) !== -1 ||
    (item.aliases || []).some((alias) => lower(alias).indexOf(q) !== -1)
  );
}

/**
 * 离线本地检索:关键词 ∧ 器械原值组 ∧ 部位原值组,三维 AND。
 *  - query:关键词,不区分大小写
 *  - equipmentKeys:器械原值数组(如 ['barbell', 'ez barbell']);空数组或 undefined 表示该维无约束
 *  - bodyPartKeys:官方 bodyPart 原值数组(如 ['chest', 'shoulders']);空数组或 undefined 表示该维无约束
 * 同一维多选为并集(OR),维度之间为交集(AND)。
 * 返回 EXERCISES 中命中的条目原引用,不复制。
 */
function search(query, equipmentKeys, bodyPartKeys) {
  if (!Array.isArray(EXERCISES)) return [];
  const q = lower(query).trim();
  const equipKeys = Array.isArray(equipmentKeys) ? equipmentKeys : [];
  const partKeys = Array.isArray(bodyPartKeys) ? bodyPartKeys : [];
  return EXERCISES.filter((item) => {
    const matchQuery = !q || matchKeyword(item, q);
    const matchEquipment = equipKeys.length === 0 || equipKeys.indexOf(item.equipment) !== -1;
    const matchPart = partKeys.length === 0 || partKeys.indexOf(item.bodyPart) !== -1;
    return matchQuery && matchEquipment && matchPart;
  });
}

module.exports = {
  EXERCISES,
  CURATED_EXERCISES,
  targetLabel,
  findById,
  search,
};
