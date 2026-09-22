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
  PLAN_MIGRATION: 'fitness:planMigrationVersion',
  PLAN_MIGRATION_CLOUD: 'fitness:planMigrationCloudSynced',
};

const SEED_VERSION = 3;

/**
 * 目录裁剪的一次性计划迁移版本:目录变更时 +1。
 * 1 = 三分化 target 白名单裁剪;2 = 精选常用动作目录(data/curated-catalog.js)裁剪;
 * 3 = 136 条目录可用性裁剪(0200/0673 等非最终白名单动作直接移除,无 replacement);
 * 4 = 最终 127 条目录可用性裁剪(0499/0573/0603/0606/0659/0688/2133/2137/3012 直接移除,无 replacement);
 * 5 = 最终 125 条目录可用性裁剪(3011/3021 无可用 GIF,直接移除,无 replacement)。
 */
const PLAN_MIGRATION_VERSION = 5;

// ===== 数据库句柄 =====

function db() {
  return wx.cloud.database();
}

function isCloudError(err) {
  return !!err;
}

/** local_ 前缀是本地未上云的临时 id,其余视为云端正式 _id */
function isCloudPlanId(id) {
  return !!id && id.indexOf('local_') !== 0;
}

// ===== 计划读写 =====

/** 只读取云端计划;不写本地缓存,供迁移在合并 local_ 计划前安全使用。 */
function readCloudPlans() {
  return db()
    .collection(COLLECTIONS.PLANS)
    .orderBy('createdAt', 'asc')
    .get()
    .then((res) => (res.data || []).map(normalizePlan));
}

/** 拉取云端计划并写穿本地缓存;云失败时抛出,由调用方决定降级。 */
function fetchCloudPlans() {
  return readCloudPlans().then((plans) => {
    wx.setStorageSync(LOCAL_KEYS.PLANS, plans);
    return plans;
  });
}

/**
 * 读取当前用户全部计划;云失败降级到本地缓存。
 */
function fetchPlans() {
  return fetchCloudPlans().catch((err) => {
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
  if (isCloudPlanId(plan.id)) {
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

function removePlanFromCloud(planId) {
  return db()
    .collection(COLLECTIONS.PLANS)
    .doc(planId)
    .remove();
}

/**
 * 删除计划:本地立即删除,云端 best-effort 删除(local_ 计划从未上云,跳过)。
 */
function deletePlan(planId) {
  removeLocalPlan(planId);
  if (isCloudPlanId(planId)) {
    return removePlanFromCloud(planId).catch((err) => {
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

// ===== 目录裁剪迁移(版本化、幂等,一次性) =====

/**
 * 删除计划中不在当前目录的动作,再删掉因此变空的训练日。
 * 返回 { plan 是否被修改, 裁剪后的 cycleDays }。
 */
function prunePlanCycleDays(plan) {
  let changed = false;
  const originalDays = plan.cycleDays || [];
  const rawCursor = Number(plan.cursor);
  const originalCursor = originalDays.length > 0 && Number.isFinite(rawCursor)
    ? ((Math.floor(rawCursor) % originalDays.length) + originalDays.length) % originalDays.length
    : 0;
  const retained = originalDays
    .map((day, originalIndex) => {
      const exercises = (day.exercises || []).filter((ex) => !!catalog.findById(ex.exerciseId));
      if (exercises.length !== (day.exercises || []).length) {
        changed = true;
      }
      return { day: Object.assign({}, day, { exercises }), originalIndex };
    })
    .filter((entry) => {
      if (entry.day.exercises.length === 0) {
        changed = true;
        return false;
      }
      return true;
    });

  let cursor = 0;
  if (retained.length > 0) {
    const currentIndex = retained.findIndex((entry) => entry.originalIndex === originalCursor);
    if (currentIndex >= 0) {
      cursor = currentIndex;
    } else {
      // 当前日被删除时,沿原循环选择下一个仍保留的训练日;末尾会自然环回。
      for (let offset = 1; offset <= originalDays.length; offset += 1) {
        const nextOriginalIndex = (originalCursor + offset) % originalDays.length;
        const nextIndex = retained.findIndex((entry) => entry.originalIndex === nextOriginalIndex);
        if (nextIndex >= 0) {
          cursor = nextIndex;
          break;
        }
      }
    }
  }
  if (cursor !== plan.cursor) {
    changed = true;
  }
  return { changed, cycleDays: retained.map((entry) => entry.day), cursor };
}

/**
 * 目录裁剪后的一次性计划迁移:删除不可用动作 → 删空训练日 → 无训练日删除整份计划。
 * 只按最终目录可查性裁剪,不建立旧 id → 新 id 的 replacement 映射,新增动作也不注入既有计划。
 * 历史 session 不动。本地迁移与云端同步分开记版本:
 * - PLAN_MIGRATION:本地写穿必然成功,完成后立即落定;
 * - PLAN_MIGRATION_CLOUD:仅在确认云端可达且本轮云端写全部成功后落定;
 *   云端写失败(含离线)不落定,联网后重试直至云端计划全部裁剪,成功后不再重复写。
 */
function migratePlansForCatalog() {
  const localMigrated =
    wx.getStorageSync(LOCAL_KEYS.PLAN_MIGRATION) === PLAN_MIGRATION_VERSION;
  const cloudMigrated =
    wx.getStorageSync(LOCAL_KEYS.PLAN_MIGRATION_CLOUD) === PLAN_MIGRATION_VERSION;
  if (localMigrated && cloudMigrated) {
    return fetchPlans();
  }
  const localPlans = readLocalPlans().map(normalizePlan);
  let cloudReachable = true;
  return readCloudPlans()
    .catch((err) => {
      cloudReachable = false;
      console.warn('云端计划读取失败,迁移仅本地生效', err);
      return [];
    })
    .then((cloudPlans) => {
      // 云端正式 id 以云端为真相;尚未上云的 local_ 计划必须合并保留,不能被云列表覆盖。
      const cloudIds = new Set(cloudPlans.map((plan) => plan.id));
      const pendingLocalPlans = localPlans.filter(
        (plan) => !isCloudPlanId(plan.id) && !cloudIds.has(plan.id)
      );
      const plans = cloudReachable ? cloudPlans.concat(pendingLocalPlans) : localPlans;
      let cloudFailed = false;
      let kept = [];
      const writes = [];

      plans.forEach((plan) => {
        const { changed, cycleDays, cursor } = prunePlanCycleDays(plan);
        if (cycleDays.length === 0) {
          if (cloudReachable && isCloudPlanId(plan.id)) {
            writes.push(() =>
              removePlanFromCloud(plan.id).catch((err) => {
                cloudFailed = true;
                console.warn('迁移云端计划删除失败,联网后重试', err);
              })
            );
          }
          return;
        }

        const pruned = changed ? Object.assign({}, plan, { cycleDays, cursor }) : plan;
        kept.push(pruned);
        // 在线时:已改变的云计划需更新;local_ 计划无论是否改变都需补上云。
        if (cloudReachable && (changed || !isCloudPlanId(plan.id))) {
          writes.push(() =>
            syncPlanToCloud(pruned)
              .then((saved) => {
                if (saved.id !== pruned.id) {
                  kept = kept.map((item) => (item.id === pruned.id ? saved : item));
                }
              })
              .catch((err) => {
                cloudFailed = true;
                console.warn('迁移云端计划保存失败,联网后重试', err);
              })
          );
        }
      });

      // 本地裁剪先落定。在线同步 local_ 时 syncPlanToCloud 会把临时 id 替换成正式 id。
      wx.setStorageSync(LOCAL_KEYS.PLANS, kept);
      return writes
        .reduce((chain, run) => chain.then(run), Promise.resolve())
        .then(() => {
          wx.setStorageSync(LOCAL_KEYS.PLANS, kept);
          if (!localMigrated) {
            wx.setStorageSync(LOCAL_KEYS.PLAN_MIGRATION, PLAN_MIGRATION_VERSION);
          }
          if (cloudReachable && !cloudFailed) {
            wx.setStorageSync(
              LOCAL_KEYS.PLAN_MIGRATION_CLOUD,
              PLAN_MIGRATION_VERSION
            );
          }
          return kept;
        });
    });
}

// ===== 种子数据(首次使用兜底) =====

/**
 * 首次进入若无任何计划,种入「胸三 / 背二 / 肩腿」演示计划,保证打开即用。
 * 先执行目录裁剪迁移(版本化、幂等),再判断是否需要种子。
 */
function ensureSeedPlans() {
  return migratePlansForCatalog().then((plans) => {
    const seeded = wx.getStorageSync(LOCAL_KEYS.SEED_VERSION);
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
        dayId: 'chest',
        name: '胸三',
        exercises: [
          { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 60 },
          { exerciseId: '0314', name: '上斜哑铃卧推', equipment: 'dumbbell', sets: 3, targetReps: 10, targetWeight: 22 },
          { exerciseId: '0251', name: '双杠臂屈伸', equipment: 'body weight', sets: 3, targetReps: 8, targetWeight: 0 },
          { exerciseId: '0188', name: '绳索夹胸', equipment: 'cable', sets: 3, targetReps: 12, targetWeight: 18 },
        ],
      },
      {
        dayId: 'back',
        name: '背二',
        exercises: [
          { exerciseId: '0652', name: '引体向上', equipment: 'body weight', sets: 4, targetReps: 6, targetWeight: 0 },
          { exerciseId: '0027', name: '杠铃俯身划船', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 50 },
          { exerciseId: '0861', name: '坐姿划船', equipment: 'cable', sets: 4, targetReps: 10, targetWeight: 52 },
          { exerciseId: '0031', name: '杠铃弯举', equipment: 'barbell', sets: 3, targetReps: 10, targetWeight: 20 },
        ],
      },
      {
        dayId: 'legs',
        name: '肩腿',
        exercises: [
          { exerciseId: '0091', name: '杠铃坐姿过头推举', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 40 },
          { exerciseId: '0233', name: '绳索面拉', equipment: 'cable', sets: 3, targetReps: 15, targetWeight: 15 },
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
  migratePlansForCatalog,
  isCloudError,
};
