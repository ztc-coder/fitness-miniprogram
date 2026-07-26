/**
 * 动作库离线数据(随主包发布,本地可读)
 * 数据源:hasaneyldrm/exercises-dataset,已排除 cardio。
 * 字段精简为:id / nameZh / equipment / bodyPart / target / imagePath。
 * equipment == "body weight" 是判断自重动作、切换 volume/总次数口径的唯一依据。
 *
 * 图片与 GIF 走 CloudBase 云存储按需加载,不进主包。
 * ⚠️ 媒体版权归 Gym visual,上线前须取得书面授权并保留署名。
 */
const EXERCISES = [
  // ===== 胸部 =====
  { id: 'bench-press', nameZh: '杠铃卧推', equipment: 'barbell', bodyPart: '胸部', target: '胸大肌 · 三头肌', imagePath: 'exercises/bench-press.png' },
  { id: 'incline-dumbbell-press', nameZh: '上斜哑铃推举', equipment: 'dumbbell', bodyPart: '胸部', target: '胸大肌上束', imagePath: 'exercises/incline-dumbbell-press.png' },
  { id: 'chest-dip', nameZh: '双杠臂屈伸', equipment: 'body weight', bodyPart: '胸部', target: '胸大肌 · 三头肌', imagePath: 'exercises/chest-dip.png' },
  { id: 'cable-fly', nameZh: '绳索夹胸', equipment: 'cable', bodyPart: '胸部', target: '胸大肌', imagePath: 'exercises/cable-fly.png' },
  { id: 'push-up', nameZh: '俯卧撑', equipment: 'body weight', bodyPart: '胸部', target: '胸大肌 · 三头肌', imagePath: 'exercises/push-up.png' },
  { id: 'dumbbell-fly', nameZh: '哑铃飞鸟', equipment: 'dumbbell', bodyPart: '胸部', target: '胸大肌', imagePath: 'exercises/dumbbell-fly.png' },
  // ===== 背部 =====
  { id: 'pull-up', nameZh: '引体向上', equipment: 'body weight', bodyPart: '背部', target: '背阔肌 · 肱二头肌', imagePath: 'exercises/pull-up.png' },
  { id: 'seated-cable-row', nameZh: '坐姿划船', equipment: 'cable', bodyPart: '背部', target: '背阔肌 · 菱形肌', imagePath: 'exercises/seated-cable-row.png' },
  { id: 'barbell-row', nameZh: '杠铃俯身划船', equipment: 'barbell', bodyPart: '背部', target: '背阔肌 · 斜方肌', imagePath: 'exercises/barbell-row.png' },
  { id: 'lat-pulldown', nameZh: '高位下拉', equipment: 'cable', bodyPart: '背部', target: '背阔肌', imagePath: 'exercises/lat-pulldown.png' },
  { id: 'face-pull', nameZh: '绳索面拉', equipment: 'cable', bodyPart: '背部', target: '三角肌后束 · 斜方肌', imagePath: 'exercises/face-pull.png' },
  { id: 'deadlift', nameZh: '杠铃硬拉', equipment: 'barbell', bodyPart: '背部', target: '竖脊肌 · 臀肌 · 腘绳肌', imagePath: 'exercises/deadlift.png' },
  // ===== 肩部 =====
  { id: 'overhead-press', nameZh: '杠铃推举', equipment: 'barbell', bodyPart: '肩部', target: '三角肌 · 三头肌', imagePath: 'exercises/overhead-press.png' },
  { id: 'dumbbell-shoulder-press', nameZh: '哑铃推举', equipment: 'dumbbell', bodyPart: '肩部', target: '三角肌', imagePath: 'exercises/dumbbell-shoulder-press.png' },
  { id: 'lateral-raise', nameZh: '哑铃侧平举', equipment: 'dumbbell', bodyPart: '肩部', target: '三角肌中束', imagePath: 'exercises/lateral-raise.png' },
  { id: 'rear-delt-fly', nameZh: '俯身哑铃飞鸟', equipment: 'dumbbell', bodyPart: '肩部', target: '三角肌后束', imagePath: 'exercises/rear-delt-fly.png' },
  // ===== 腿部 =====
  { id: 'barbell-squat', nameZh: '杠铃深蹲', equipment: 'barbell', bodyPart: '腿部', target: '股四头肌 · 臀肌', imagePath: 'exercises/barbell-squat.png' },
  { id: 'romanian-deadlift', nameZh: '罗马尼亚硬拉', equipment: 'barbell', bodyPart: '腿部', target: '腘绳肌 · 臀肌', imagePath: 'exercises/romanian-deadlift.png' },
  { id: 'leg-press', nameZh: '腿举', equipment: 'machine', bodyPart: '腿部', target: '股四头肌', imagePath: 'exercises/leg-press.png' },
  { id: 'walking-lunge', nameZh: '弓步蹲', equipment: 'dumbbell', bodyPart: '腿部', target: '股四头肌 · 臀肌', imagePath: 'exercises/walking-lunge.png' },
  { id: 'leg-curl', nameZh: '俯卧腿弯举', equipment: 'machine', bodyPart: '腿部', target: '腘绳肌', imagePath: 'exercises/leg-curl.png' },
  { id: 'standing-calf-raise', nameZh: '站姿提踵', equipment: 'machine', bodyPart: '腿部', target: '小腿三头肌', imagePath: 'exercises/standing-calf-raise.png' },
  { id: 'bulgarian-split-squat', nameZh: '保加利亚分腿蹲', equipment: 'body weight', bodyPart: '腿部', target: '股四头肌 · 臀肌', imagePath: 'exercises/bulgarian-split-squat.png' },
  // ===== 手臂 =====
  { id: 'barbell-curl', nameZh: '杠铃弯举', equipment: 'barbell', bodyPart: '手臂', target: '肱二头肌', imagePath: 'exercises/barbell-curl.png' },
  { id: 'hammer-curl', nameZh: '锤式弯举', equipment: 'dumbbell', bodyPart: '手臂', target: '肱二头肌 · 肱肌', imagePath: 'exercises/hammer-curl.png' },
  { id: 'tricep-pushdown', nameZh: '绳索下压', equipment: 'cable', bodyPart: '手臂', target: '肱三头肌', imagePath: 'exercises/tricep-pushdown.png' },
  { id: 'skull-crusher', nameZh: '仰卧臂屈伸', equipment: 'barbell', bodyPart: '手臂', target: '肱三头肌', imagePath: 'exercises/skull-crusher.png' },
  // ===== 核心 =====
  { id: 'plank', nameZh: '平板支撑', equipment: 'body weight', bodyPart: '核心', target: '腹直肌 · 核心稳定', imagePath: 'exercises/plank.png' },
  { id: 'hanging-leg-raise', nameZh: '悬垂举腿', equipment: 'body weight', bodyPart: '核心', target: '腹直肌下部', imagePath: 'exercises/hanging-leg-raise.png' },
  { id: 'cable-crunch', nameZh: '绳索卷腹', equipment: 'cable', bodyPart: '核心', target: '腹直肌', imagePath: 'exercises/cable-crunch.png' },
];

const EQUIPMENT_FILTERS = ['全部', 'barbell', 'dumbbell', 'cable', 'machine', 'body weight'];

const EQUIPMENT_LABELS = {
  barbell: '杠铃',
  dumbbell: '哑铃',
  cable: '绳索',
  machine: '器械',
  'body weight': '自重',
  band: '弹力带',
  kettlebell: '壶铃',
};

function equipmentLabel(equipment) {
  return EQUIPMENT_LABELS[equipment] || equipment || '其他';
}

function findById(id) {
  return EXERCISES.find((item) => item.id === id) || null;
}

/**
 * 搜索 + 器械筛选,离线本地执行。
 */
function search(query, equipment) {
  const q = (query || '').trim();
  return EXERCISES.filter((item) => {
    const matchQuery =
      !q ||
      item.nameZh.indexOf(q) !== -1 ||
      item.target.indexOf(q) !== -1 ||
      item.bodyPart.indexOf(q) !== -1 ||
      equipmentLabel(item.equipment).indexOf(q) !== -1;
    const matchEquipment = !equipment || equipment === '全部' || item.equipment === equipment;
    return matchQuery && matchEquipment;
  });
}

module.exports = {
  EXERCISES,
  EQUIPMENT_FILTERS,
  equipmentLabel,
  findById,
  search,
};
