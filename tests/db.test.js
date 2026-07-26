/**
 * 数据访问层「云主本地降级」外部行为测试
 * 重点:云端不可用时,写操作仍通过本地缓存写穿生效(修复"新建计划无反应")
 */

// 内存版本地存储 + 始终失败的云端,模拟未开通/无网环境
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
