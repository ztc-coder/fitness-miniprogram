/**
 * CloudBase 数据访问层(仓库模式)
 * UI 与 domain logic 之上的薄封装,统一处理云数据库读写与本地存储降级。
 */
const domain = require('./domain');
const catalog = require('../data/exercises');

const COLLECTIONS = {
  PLANS: 'plans',
  SESSIONS: 'sessions',
};

const LOCAL_KEYS = {
  PLANS: 'fitness:plans',
  SEED_VERSION: 'fitness:seedVersion',
};

const SEED_VERSION = 2;

// ===== 数据库句柄 =====

function db() {
  return wx.cloud.database();
}

function isCloudError(err) {
  return !!err;
}

// ===== 计划读写 =====

/**
 * 读取当前用户全部计划;云失败降级到本地缓存。
 */
function fetchPlans() {
  return db()
    .collection(COLLECTIONS.PLANS)
    .orderBy('createdAt', 'asc')
    .get()
    .then((res) => {
      const plans = (res.data || []).map(normalizePlan);
      wx.setStorageSync(LOCAL_KEYS.PLANS, plans);
      return plans;
    })
    .catch((err) => {
      console.warn('云端计划读取失败,使用本地缓存', err);
      return (wx.getStorageSync(LOCAL_KEYS.PLANS) || []).map(normalizePlan);
    });
}

/**
 * 旧 slug 计划迁移:slug → 数据集数字 id,并用 findById 回填 name/equipment 与目录对齐。
 * 解析不到目录的 exerciseId 原样保留;sets/targetReps/targetWeight 不动。
 */
function migrateExercise(rawExercise) {
  const found = catalog.findById(rawExercise.exerciseId);
  if (!found) {
    return rawExercise;
  }
  return Object.assign({}, rawExercise, {
    exerciseId: found.id,
    name: found.nameZh,
    equipment: found.equipment,
  });
}

function normalizePlan(raw) {
  return {
    id: raw._id || raw.id,
    name: raw.name,
    cursor: raw.cursor || 0,
    active: !!raw.active,
    cycleDays: (raw.cycleDays || []).map((day) =>
      Object.assign({}, day, {
        exercises: (day.exercises || []).map(migrateExercise),
      })
    ),
    createdAt: raw.createdAt || Date.now(),
  };
}

// ===== 本地缓存(写穿真相来源,无网/未开通云时保证可用) =====

function readLocalPlans() {
  return wx.getStorageSync(LOCAL_KEYS.PLANS) || [];
}

function upsertLocalPlan(plan) {
  const plans = readLocalPlans();
  const index = plans.findIndex((p) => p.id === plan.id);
  const next =
    index >= 0
      ? plans.map((p) => (p.id === plan.id ? plan : p))
      : plans.concat([plan]);
  wx.setStorageSync(LOCAL_KEYS.PLANS, next);
}

function removeLocalPlan(planId) {
  wx.setStorageSync(
    LOCAL_KEYS.PLANS,
    readLocalPlans().filter((p) => p.id !== planId)
  );
}

/**
 * 保存计划:本地写穿立即生效,云端 best-effort 同步。
 * 云端失败不抛出,以本地为准返回,避免 UI 无反馈或数据丢失。
 */
function savePlan(plan) {
  const finalPlan = Object.assign({}, plan, {
    createdAt: plan.createdAt || Date.now(),
  });
  upsertLocalPlan(finalPlan);
  return syncPlanToCloud(finalPlan).catch((err) => {
    console.warn('计划云端同步失败,已本地生效', err);
    return finalPlan;
  });
}

function syncPlanToCloud(plan) {
  const doc = {
    name: plan.name,
    cursor: plan.cursor,
    active: plan.active,
    cycleDays: plan.cycleDays,
    createdAt: plan.createdAt,
    updatedAt: Date.now(),
  };
  if (plan.id && plan.id.indexOf('local_') !== 0) {
    return db()
      .collection(COLLECTIONS.PLANS)
      .doc(plan.id)
      .update({ data: doc })
      .then(() => plan);
  }
  return db()
    .collection(COLLECTIONS.PLANS)
    .add({ data: doc })
    .then((res) => {
      // 云端分配了正式 _id,本地记录用新 id 替换旧的 local_ 记录
      const saved = Object.assign({}, plan, { id: res._id });
      removeLocalPlan(plan.id);
      upsertLocalPlan(saved);
      return saved;
    });
}

/**
 * 删除计划:本地立即删除,云端 best-effort 删除(local_ 计划从未上云,跳过)。
 */
function deletePlan(planId) {
  removeLocalPlan(planId);
  if (planId && planId.indexOf('local_') !== 0) {
    return db()
      .collection(COLLECTIONS.PLANS)
      .doc(planId)
      .remove()
      .catch((err) => {
        console.warn('计划云端删除失败,已本地删除', err);
      });
  }
  return Promise.resolve();
}

/**
 * 完成打卡后推进指定计划的游标(完成驱动:+1,循环到末尾回到开头)。
 * 本地缓存立即生效(离线也能推进),云端 best-effort 同步,失败不回滚本地。
 * @param planId 要推进的计划 id
 * @returns 推进后的 plan;计划不存在返回 null
 */
function advancePlanCursor(planId) {
  return fetchPlans().then((plans) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      return null;
    }
    const advanced = domain.advanceCursor(plan, true);
    const nextPlans = plans.map((p) => (p.id === planId ? advanced : p));
    wx.setStorageSync(LOCAL_KEYS.PLANS, nextPlans);
    return savePlan(advanced).catch((err) => {
      console.warn('游标推进云端保存失败,已本地生效', err);
      return advanced;
    });
  });
}

/**
 * 切换 active:关闭其余,激活指定计划。游标是每个计划自己的字段,互不影响。
 */
function setActivePlan(plans, activeId) {
  const updates = plans.map((p) =>
    savePlan(Object.assign({}, p, { active: p.id === activeId }))
  );
  return Promise.all(updates).then(() =>
    plans.map((p) => Object.assign({}, p, { active: p.id === activeId }))
  );
}

// ===== Session 读写 =====

/**
 * 提交一条完成的 session 到云端。
 */
function submitSession(session) {
  const doc = Object.assign({}, session, { submittedAt: Date.now() });
  return db()
    .collection(COLLECTIONS.SESSIONS)
    .add({ data: doc })
    .then(() => doc);
}

/**
 * 拉取已提交 session(时间线倒序)。
 */
function fetchSessions(limit = 50) {
  return db()
    .collection(COLLECTIONS.SESSIONS)
    .orderBy('submittedAt', 'desc')
    .limit(limit)
    .get()
    .then((res) => res.data || [])
    .catch((err) => {
      console.warn('云端记录读取失败', err);
      return [];
    });
}

// ===== 种子数据(首次使用兜底) =====

/**
 * 首次进入若无任何计划,种入一份「推 / 拉 / 腿」演示计划,保证打开即用。
 * 数据写入本地缓存;有网时同步到云端。
 */
function ensureSeedPlans() {
  const seeded = wx.getStorageSync(LOCAL_KEYS.SEED_VERSION);
  return fetchPlans().then((plans) => {
    if (plans.length > 0 || seeded === SEED_VERSION) {
      return plans;
    }
    const seed = buildSeedPlan();
    wx.setStorageSync(LOCAL_KEYS.SEED_VERSION, SEED_VERSION);
    return savePlan(seed)
      .then((saved) => [saved])
      .catch(() => [seed]); // 无网也能用本地种子
  });
}

function buildSeedPlan() {
  return {
    id: domain.generateId('local_plan'),
    name: '力量循环',
    cursor: 0,
    active: true,
    createdAt: Date.now(),
    cycleDays: [
      {
        dayId: 'push',
        name: '推',
        exercises: [
          { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 60 },
          { exerciseId: '0314', name: '上斜哑铃推举', equipment: 'dumbbell', sets: 3, targetReps: 10, targetWeight: 22 },
          { exerciseId: '0251', name: '双杠臂屈伸', equipment: 'body weight', sets: 3, targetReps: 8, targetWeight: 0 },
          { exerciseId: '0188', name: '绳索夹胸', equipment: 'cable', sets: 3, targetReps: 12, targetWeight: 18 },
        ],
      },
      {
        dayId: 'pull',
        name: '拉',
        exercises: [
          { exerciseId: '0861', name: '坐姿划船', equipment: 'cable', sets: 4, targetReps: 10, targetWeight: 52 },
          { exerciseId: '0652', name: '引体向上', equipment: 'body weight', sets: 4, targetReps: 6, targetWeight: 0 },
          { exerciseId: '0027', name: '杠铃俯身划船', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 50 },
          { exerciseId: '0233', name: '绳索面拉', equipment: 'cable', sets: 3, targetReps: 15, targetWeight: 15 },
        ],
      },
      {
        dayId: 'legs',
        name: '腿',
        exercises: [
          { exerciseId: '0043', name: '杠铃深蹲', equipment: 'barbell', sets: 4, targetReps: 6, targetWeight: 80 },
          { exerciseId: '0085', name: '罗马尼亚硬拉', equipment: 'barbell', sets: 3, targetReps: 8, targetWeight: 70 },
          { exerciseId: '0739', name: '腿举', equipment: 'sled machine', sets: 3, targetReps: 10, targetWeight: 120 },
          { exerciseId: '0605', name: '站姿提踵', equipment: 'leverage machine', sets: 4, targetReps: 12, targetWeight: 40 },
        ],
      },
    ],
  };
}

module.exports = {
  fetchPlans,
  savePlan,
  deletePlan,
  advancePlanCursor,
  setActivePlan,
  submitSession,
  fetchSessions,
  ensureSeedPlans,
  isCloudError,
};
