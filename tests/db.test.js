/**
 * 数据访问层「云主本地降级」外部行为测试
 * 重点:云端不可用时,写操作仍通过本地缓存写穿生效(修复"新建计划无反应")
 */

// 内存版本地存储 + 可控的云端,模拟未开通/无网环境
function mockWx({ cloudOk = false } = {}) {
  const storage = {};
  const rejected = () => Promise.reject(new Error('cloud unavailable'));
  const collection = () => ({
    orderBy: () => collection(),
    limit: () => collection(),
    doc: () => collection(),
    get: cloudOk ? () => Promise.resolve({ data: [] }) : rejected,
    add: cloudOk
      ? () => Promise.resolve({ _id: 'cloud_generated_id' })
      : rejected,
    update: cloudOk ? () => Promise.resolve({}) : rejected,
    remove: cloudOk ? () => Promise.resolve({}) : rejected,
  });
  global.wx = {
    getStorageSync: (k) => storage[k],
    setStorageSync: (k, v) => {
      storage[k] = v;
    },
    cloud: { database: () => ({ collection }) },
  };
  return storage;
}

function loadDb() {
  jest.resetModules();
  return require('../utils/db');
}

const buildLocalPlan = (overrides = {}) =>
  Object.assign(
    { id: 'local_plan_1', name: '力量循环', cursor: 0, active: true, cycleDays: [] },
    overrides
  );

describe('savePlan 本地写穿', () => {
  test('云端失败时新建计划仍写入本地缓存并 resolve', () => {
    const storage = mockWx({ cloudOk: false });
    const db = loadDb();
    const plan = buildLocalPlan();
    return db.savePlan(plan).then((saved) => {
      expect(saved.id).toBe('local_plan_1');
      expect(storage['fitness:plans']).toHaveLength(1);
      expect(storage['fitness:plans'][0].name).toBe('力量循环');
    });
  });

  test('再次读取能取回刚保存的计划(fetchPlans 云失败降级本地)', () => {
    mockWx({ cloudOk: false });
    const db = loadDb();
    return db
      .savePlan(buildLocalPlan())
      .then(() => db.fetchPlans())
      .then((plans) => {
        expect(plans).toHaveLength(1);
        expect(plans[0].id).toBe('local_plan_1');
      });
  });

  test('同 id 再次保存为更新而非新增', () => {
    const storage = mockWx({ cloudOk: false });
    const db = loadDb();
    return db
      .savePlan(buildLocalPlan())
      .then(() => db.savePlan(buildLocalPlan({ name: '改名后' })))
      .then(() => {
        expect(storage['fitness:plans']).toHaveLength(1);
        expect(storage['fitness:plans'][0].name).toBe('改名后');
      });
  });

  test('云端成功时用返回的正式 id 替换本地 local_ 记录', () => {
    const storage = mockWx({ cloudOk: true });
    const db = loadDb();
    return db.savePlan(buildLocalPlan()).then((saved) => {
      expect(saved.id).toBe('cloud_generated_id');
      expect(storage['fitness:plans']).toHaveLength(1);
      expect(storage['fitness:plans'][0].id).toBe('cloud_generated_id');
    });
  });
});

describe('deletePlan 本地删除', () => {
  test('云端失败也能从本地移除', () => {
    const storage = mockWx({ cloudOk: false });
    const db = loadDb();
    return db
      .savePlan(buildLocalPlan())
      .then(() => db.deletePlan('local_plan_1'))
      .then(() => {
        expect(storage['fitness:plans']).toHaveLength(0);
      });
  });
});

describe('normalizePlan 旧 slug 计划迁移', () => {
  const buildSlugPlan = () => ({
    id: 'plan_old',
    name: '力量循环',
    cursor: 0,
    active: true,
    cycleDays: [
      {
        dayId: 'push',
        name: '推',
        exercises: [
          { exerciseId: 'bench-press', name: '杠铃卧推', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 60 },
        ],
      },
      {
        dayId: 'legs',
        name: '腿',
        exercises: [
          { exerciseId: 'leg-press', name: '腿举', equipment: 'machine', sets: 3, targetReps: 10, targetWeight: 120 },
          { exerciseId: 'unknown-move', name: '查不到的动作', equipment: 'other', sets: 2, targetReps: 5, targetWeight: 10 },
        ],
      },
    ],
  });

  test('含 slug 的计划读出后 exerciseId 解析为数字 id,name/equipment 与目录对齐,组数目标不变', () => {
    const storage = mockWx({ cloudOk: false });
    storage['fitness:plans'] = [buildSlugPlan()];
    const db = loadDb();
    return db.fetchPlans().then((plans) => {
      expect(plans).toHaveLength(1);
      const push = plans[0].cycleDays[0].exercises[0];
      expect(push.exerciseId).toBe('0025');
      expect(push.name).toBe('杠铃卧推');
      expect(push.equipment).toBe('barbell');
      expect(push.sets).toBe(4);
      expect(push.targetReps).toBe(8);
      expect(push.targetWeight).toBe(60);
      const legPress = plans[0].cycleDays[1].exercises[0];
      expect(legPress.exerciseId).toBe('0739');
      expect(legPress.equipment).toBe('sled machine');
      expect(legPress.sets).toBe(3);
    });
  });

  test('查不到目录的 exerciseId 原样保留', () => {
    const storage = mockWx({ cloudOk: false });
    storage['fitness:plans'] = [buildSlugPlan()];
    const db = loadDb();
    return db.fetchPlans().then((plans) => {
      const unknown = plans[0].cycleDays[1].exercises[1];
      expect(unknown.exerciseId).toBe('unknown-move');
      expect(unknown.name).toBe('查不到的动作');
      expect(unknown.equipment).toBe('other');
    });
  });
});

describe('ensureSeedPlans 数据集 id 种子', () => {
  const catalog = require('../data/exercises');

  test('新种子每条 exerciseId 均为 4 位数字 id,且 name/equipment 与动作库一致', () => {
    mockWx({ cloudOk: false });
    const db = loadDb();
    return db.ensureSeedPlans().then((plans) => {
      expect(plans).toHaveLength(1);
      const exercises = plans[0].cycleDays.reduce(
        (all, day) => all.concat(day.exercises),
        []
      );
      expect(exercises.length).toBe(12);
      exercises.forEach((ex) => {
        expect(ex.exerciseId).toMatch(/^\d{4}$/);
        const found = catalog.findById(ex.exerciseId);
        expect(found).not.toBeNull();
        expect(ex.name).toBe(found.nameZh);
        expect(ex.equipment).toBe(found.equipment);
      });
    });
  });

  test('腿举用数据集原值 sled machine,不是字面 machine', () => {
    mockWx({ cloudOk: false });
    const db = loadDb();
    return db.ensureSeedPlans().then((plans) => {
      const legPress = plans[0].cycleDays
        .reduce((all, day) => all.concat(day.exercises), [])
        .find((ex) => ex.exerciseId === '0739');
      expect(legPress).toBeDefined();
      expect(legPress.equipment).toBe('sled machine');
    });
  });

  test('本地已记过旧 version 且无计划时能重新种入新种子', () => {
    const storage = mockWx({ cloudOk: false });
    storage['fitness:seedVersion'] = 1;
    const db = loadDb();
    return db.ensureSeedPlans().then((plans) => {
      expect(plans).toHaveLength(1);
      expect(plans[0].cycleDays[0].exercises[0].exerciseId).toBe('0025');
      expect(storage['fitness:seedVersion']).toBe(2);
    });
  });

  test('已有旧计划的用户不重种,只靠 normalize 迁移', () => {
    const storage = mockWx({ cloudOk: false });
    storage['fitness:seedVersion'] = 1;
    storage['fitness:plans'] = [buildLocalPlan({ id: 'plan_old' })];
    const db = loadDb();
    return db.ensureSeedPlans().then((plans) => {
      expect(plans).toHaveLength(1);
      expect(plans[0].id).toBe('plan_old');
      expect(storage['fitness:seedVersion']).toBe(1);
    });
  });
});
