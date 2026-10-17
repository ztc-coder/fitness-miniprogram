const storage = require('./owner-storage');
/**
 * CloudBase 数据访问层(仓库模式)
 * UI 与 domain logic 之上的薄封装,统一处理云数据库读写与本地存储降级。
 */
const domain = require('./domain');
const service = require('./cloud-service');
const log = require('./training-log');
const catalog = require('../data/exercises');
const operations = require('./plan-operations');

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
let reads = { epoch: -1, plans: '未读取', sessions: '未读取' };
function getReadStatus() {
  if (reads.epoch !== service.snapshot().epoch) reads = { epoch: service.snapshot().epoch, plans: '未读取', sessions: '未读取' };
  return { plans: reads.plans, sessions: reads.sessions };
}
function markRead(type, value) { getReadStatus(); reads[type] = value; }


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
  if (!service.ready()) throw new Error('仅本地模式，尚未启用本人云服务');
  return require('./personal-cloud').database();
}

function isCloudError(err) {
  return !!err;
}

// ===== 计划读写 =====

/** 只读取云端计划;不写本地缓存,供迁移在合并 local_ 计划前安全使用。 */
async function readCloudPlans() {
  const token = service.snapshot();
  const plans = [];
  while (true) {
    service.assertCurrent(token);
    const res = await db().collection(COLLECTIONS.PLANS).orderBy('createdAt', 'asc')
      .skip(plans.length).limit(20).get();
    service.assertCurrent(token);
    const page = res.data || [];
    plans.push(...page);
    if (page.length < 20) break;
  }
  markRead('plans', '完整');
  return plans.map(normalizePlan);
}

function fetchCloudPlans() {
  const token = service.snapshot();
  return readCloudPlans().then((plans) => {
    service.assertCurrent(token);
    const local = readLocalPlans();
    const localById = new Map(local.map(p => [p.id, p]));
    const cloudIds = new Set(plans.map(p => p.id));
    // A read may predate a write acknowledgement that already removed its task.
    // Keep that newer local snapshot; pending edits still overlay below, without rebasing conflicts.
    const monotonic = plans.map(p => {
      const cached = localById.get(p.id);
      return cached && cached.revision > p.revision ? cached : p;
    });
    const merged = operations.overlay(monotonic.filter(p => !p.deleted)
      .concat(local.filter(p => !cloudIds.has(p.id))));
    storage.setStorageSync(LOCAL_KEYS.PLANS, merged);
    return merged;
  });
}

/**
 * 读取当前用户全部计划;云失败降级到本地缓存。
 */
function fetchPlans() {
  const token = service.snapshot();
  return fetchCloudPlans().catch((err) => {
    service.assertCurrent(token);
    markRead('plans', service.ready() ? '读取未完整，请重试' : '仅本地');
    console.warn('云端计划读取失败,使用本地缓存', err);
    return readLocalPlans().map(normalizePlan);
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
    id: raw.revision ? (raw.id || raw._id) : (raw._id || raw.id),
    revision: raw.revision || 0,
    deleted: !!raw.deleted,
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
  reconcileCompletions();
  return operations.overlay(log.overlayPlans(storage.getStorageSync(LOCAL_KEYS.PLANS) || []));
}

function upsertLocalPlan(plan) {
  const plans = readLocalPlans();
  const index = plans.findIndex((p) => p.id === plan.id);
  const next =
    index >= 0
      ? plans.map((p) => (p.id === plan.id ? plan : p))
      : plans.concat([plan]);
  storage.setStorageSync(LOCAL_KEYS.PLANS, next);
}

function removeLocalPlan(planId) {
  storage.setStorageSync(
    LOCAL_KEYS.PLANS,
    readLocalPlans().filter((p) => p.id !== planId)
  );
}

/**
 * 保存计划:持久日志先成立，本地立即生效，云端单飞重试。
 * 云端失败不抛出,以本地为准返回,避免 UI 无反馈或数据丢失。
 */
function savePlan(plan) {
  reconcileCompletions();
  const finalPlan = operations.enqueue(Object.assign({}, plan, {
    createdAt: plan.createdAt || Date.now(),
  }));
  upsertLocalPlan(finalPlan);
  // The persistent journal, not a best-effort request, establishes the edit.
  Promise.resolve().then(() => require('./queue').flush()).catch(() => {});
  return Promise.resolve(finalPlan);
}

function reconcileCompletions() {
  log.read().forEach(entry => {
    if (!entry.plan || entry.planSynced || entry.planQueued || log.isPlanDeleted(entry.plan.id)) return;
    const id = log.resolvePlanId(entry.plan.id);
    operations.enqueue(Object.assign({}, entry.plan, { id }), 'set', 'completion_' + entry.session.id);
    log.update(entry.session.id, { planQueued: true });
  });
}

function syncCompletedPlan(plan) {
  reconcileCompletions();
  return flushPlanTasks().then(() => {
    if (operations.read().tasks.some(t => t.id === plan.id)) throw new Error('计划仍待同步');
    return readLocalPlans().find(p => p.id === plan.id) || null;
  });
}

function preparePlanTasks() {
  reconcileCompletions();
  const state = operations.read();
  (storage.getStorageSync(LOCAL_KEYS.PLANS) || []).forEach(plan => {
    if (plan.revision === undefined && !state.deleted.includes(plan.id) && !operations.read().tasks.some(t => t.id === plan.id)) operations.enqueue(plan);
  });
}

async function flushPlanTasks() {
  const token = service.snapshot();
  reconcileCompletions();
  while (operations.read().tasks.length) {
    service.assertCurrent(token);
    const task = operations.read().tasks[0];
    try {
      await require('./personal-cloud').generation();
      service.assertCurrent(token);
      if (task.generation === undefined) {
        const state = operations.read();
        state.tasks = state.tasks.map(t => t.key === task.key ? Object.assign({}, t, { generation: 0 }) : t);
        operations.write(state); // bind before sending; response loss never rebinds an old task
        task.generation = 0;
      }
      const payload = { data: task.data, operationId: task.key, expectedRevision: task.expectedRevision, generation: task.generation };
      const res = await db().collection(COLLECTIONS.PLANS).doc(task.id)[task.action](payload);
      service.assertCurrent(token);
      if (res.stats && res.stats.created === 0 && res.stats.updated === 0 && task.action !== 'remove') throw new Error('计划未确认');
      if (task.action !== 'remove') upsertLocalPlan(task.data);
      operations.acknowledge(task.key);
    } catch (err) {
      service.assertCurrent(token);
      operations.failed(task.key, err);
      throw err;
    }
  }
}

function deletePlan(planId) {
  const plan = readLocalPlans().find(p => p.id === planId) || { id: planId };
  operations.enqueue(plan, 'remove'); // tombstone persists even after acknowledgement
  log.deletePlan(planId);
  removeLocalPlan(planId);
  Promise.resolve().then(() => require('./queue').flush()).catch(() => {});
  return Promise.resolve();
}

/**
 * 完成打卡后推进指定计划的游标(完成驱动:+1,循环到末尾回到开头)。
 * 本地缓存立即生效(离线也能推进),云端持久重试,失败不回滚本地。
 * @param planId 要推进的计划 id
 * @returns 推进后的 plan;计划不存在返回 null
 */
function advancePlanCursor(planId) {
  const token = service.snapshot();
  return fetchPlans().then((plans) => {
    service.assertCurrent(token);
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      return null;
    }
    const advanced = domain.advanceCursor(plan, true);
    const nextPlans = plans.map((p) => (p.id === planId ? advanced : p));
    storage.setStorageSync(LOCAL_KEYS.PLANS, nextPlans);
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
async function submitSession(session, taskGeneration) {
  const token = service.snapshot();
  const currentGeneration = await require('./personal-cloud').generation();
  const generation = taskGeneration === undefined ? currentGeneration : taskGeneration;
  service.assertCurrent(token);
  const doc = Object.assign({}, session, { submittedAt: session.submittedAt == null ? Date.now() : session.submittedAt });
  ['_id', '_openid', 'training', 'nextSetId', 'attempts', 'syncGeneration'].forEach(key => delete doc[key]);
  return db()
    .collection(COLLECTIONS.SESSIONS)
    .doc(String(session.id))
    .set({ data: doc, operationId: 'session_' + session.id, expectedRevision: 0, generation })
    .then(res => {
      if (res.stats && res.stats.created === 0 && res.stats.updated === 0) throw new Error('场次未写入');
      return doc;
    });
}

/**
 * 拉取已提交 session(时间线倒序)。
 */
function fetchSessions(limit = 50) {
  return Promise.resolve().then(() => db()
    .collection(COLLECTIONS.SESSIONS)
    .orderBy('submittedAt', 'desc')
    .limit(limit)
    .get()
    .then((res) => mergeSessions(res.data || [])))
    .catch((err) => {
      console.warn('云端记录读取失败', err);
      return mergeSessions([]);
    });
}

/** 汇总页按小程序端每页 20 条读取历史，再合并本地未同步记录。 */
async function fetchAllSessions() {
  const token = service.snapshot();
  const cloud = [];
  try {
    const sessions = db().collection(COLLECTIONS.SESSIONS);
    const pageSize = 20;
    while (true) {
      const res = await sessions.orderBy('submittedAt', 'desc')
        .skip(cloud.length).limit(pageSize).get();
      service.assertCurrent(token);
      const page = res.data || [];
      cloud.push(...page);
      if (page.length < pageSize) { markRead('sessions', '完整'); break; }
    }
  } catch (err) {
    service.assertCurrent(token);
    markRead('sessions', service.ready() ? '读取未完整，请重试' : '仅本地');
    console.warn('云端完整历史读取失败，保留已读取和本地记录', err);
  }
  return mergeSessions(cloud);
}

function mergeSessions(cloud) {
  const byId = new Map();
  cloud.concat(storage.getStorageSync('fitness:pendingQueue') || [], log.read().map(e => e.session))
    .forEach(s => byId.set(String(s.id || s._id), s));
  return Array.from(byId.values()).sort((a, b) => (b.submittedAt || b.startedAt) - (a.submittedAt || a.startedAt));
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
      if (entry.day.exercises.length === 0 && (originalDays[entry.originalIndex].exercises || []).length > 0) {
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
 * - PLAN_MIGRATION_CLOUD:仅在完整读取且持久任务均确认后落定;
 *   云端失败保留持久任务，后续迁移优先沿用待同步快照，不反复删除用户故意留空的计划/日。
 */
async function migratePlansForCatalog() {
  const plans = await fetchPlans();
  const cloudComplete = getReadStatus().plans === '完整';
  const localMigrated = storage.getStorageSync(LOCAL_KEYS.PLAN_MIGRATION) === PLAN_MIGRATION_VERSION;
  const cloudMigrated = storage.getStorageSync(LOCAL_KEYS.PLAN_MIGRATION_CLOUD) === PLAN_MIGRATION_VERSION;
  if (localMigrated && (!cloudComplete || cloudMigrated)) return plans;
  for (const plan of plans) {
    const { changed, cycleDays, cursor } = prunePlanCycleDays(plan);
    // Deliberately empty new plans/days are valid; only prune emptied legacy days.
    if (!changed) continue;
    if (!cycleDays.length && (plan.cycleDays || []).some(d => (d.exercises || []).length)) await deletePlan(plan.id);
    else await savePlan(Object.assign({}, plan, { cycleDays, cursor }));
  }
  storage.setStorageSync(LOCAL_KEYS.PLAN_MIGRATION, PLAN_MIGRATION_VERSION);
  if (cloudComplete && !operations.read().tasks.length) storage.setStorageSync(LOCAL_KEYS.PLAN_MIGRATION_CLOUD, PLAN_MIGRATION_VERSION);
  return readLocalPlans();
}

// ===== 种子数据(首次使用兜底) =====

/**
 * 首次进入若无任何计划,种入「胸三 / 背二 / 肩腿」演示计划,保证打开即用。
 * 先执行目录裁剪迁移(版本化、幂等),再判断是否需要种子。
 */
function ensureSeedPlans() {
  const token = service.snapshot();
  return migratePlansForCatalog().then((plans) => {
    service.assertCurrent(token);
    const seeded = storage.getStorageSync(LOCAL_KEYS.SEED_VERSION);
    if (plans.length > 0 || seeded === SEED_VERSION) {
      return plans;
    }
    const seed = buildSeedPlan();
    storage.setStorageSync(LOCAL_KEYS.SEED_VERSION, SEED_VERSION);
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
  getReadStatus,
  getLocalPlans: readLocalPlans,
  flushPlanTasks,
  preparePlanTasks,
  syncCompletedPlan,
  fetchPlans,
  savePlan,
  deletePlan,
  advancePlanCursor,
  setActivePlan,
  submitSession,
  fetchSessions,
  fetchAllSessions,
  ensureSeedPlans,
  migratePlansForCatalog,
  isCloudError,
};

// 每个异步公共边界拒绝旧身份结果，包括云失败后的本地降级路径。
Object.keys(module.exports).forEach(name => {
  if (['preparePlanTasks', 'getReadStatus', 'getLocalPlans', 'isCloudError'].includes(name)) return;
  const fn = module.exports[name];
  module.exports[name] = function (...args) {
    const token = service.snapshot();
    service.assertCurrent(token);
    return Promise.resolve(fn(...args))
      .then(value => { service.assertCurrent(token); return value; }, err => {
        service.assertCurrent(token); throw err;
      });
  };
});
