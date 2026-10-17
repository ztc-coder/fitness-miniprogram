let mockIdentity = 'A';
const mockDocs = { plans: new Map(), sessions: new Map() };
let mockSerial = 0;
jest.mock('wx-server-sdk', () => ({
  DYNAMIC_CURRENT_ENV: 'test', init: jest.fn(), getWXContext: () => ({ OPENID: mockIdentity }),
  database: () => ({ collection: name => {
    function query(filter = {}, offset = 0, size = 20) {
      return {
        where: f => query(f, offset, size), orderBy() { return this; },
        skip: n => query(filter, n, size), limit: n => query(filter, offset, n),
        get: async () => ({ data: [...mockDocs[name].values()].filter(d => Object.entries(filter).every(([k, v]) => d[k] === v)).slice(offset, offset + size) }),
        add: async ({ data }) => { const _id = 'generated_' + ++mockSerial; mockDocs[name].set(_id, { ...data, _id }); return { _id }; },
        doc: id => ({
          get: async () => ({ data: mockDocs[name].get(id) }),
          set: async ({ data }) => { mockDocs[name].set(id, { ...data, _id: id }); return { stats: { created: 1 } }; },
          update: async ({ data }) => { mockDocs[name].set(id, { ...mockDocs[name].get(id), ...data }); return { stats: { updated: 1 } }; },
          remove: async () => { mockDocs[name].delete(id); return {}; },
        }),
      };
    }
    return query();
  } }),
}), { virtual: true });
beforeEach(() => { mockIdentity = 'A'; mockDocs.plans.clear(); mockDocs.sessions.clear(); });
test('可信入口忽略伪造所有者，隔离查询/猜测 ID/修改/删除且拒绝无身份', async () => {
  const { main } = require('../cloudfunctions/personalData');
  const saved = await main({ collection: 'plans', action: 'add', data: { name: 'A计划', _openid: 'B', owner: 'B' } });
  expect((await main({ collection: 'plans', action: 'list' })).data[0].name).toBe('A计划');
  mockIdentity = 'B';
  expect((await main({ collection: 'plans', action: 'list', owner: 'A' })).data).toEqual([]);
  for (const action of ['update', 'set', 'remove']) {
    await expect(main({ collection: 'plans', action, id: saved._id, data: { name: '篡改' } })).rejects.toThrow('无权');
  }
  mockIdentity = '';
  await expect(main({ collection: 'sessions', action: 'list' })).rejects.toThrow('身份');
  const login = require('../cloudfunctions/login');
  await expect(login.main()).rejects.toThrow('身份');
  mockIdentity = 'A';
  expect((await main({ collection: 'plans', action: 'list' })).data[0].name).toBe('A计划');
});
test('本人逻辑 ID 幂等写与删除使用同一隔离命名空间', async () => {
  const { main } = require('../cloudfunctions/personalData');
  const request = { collection: 'plans', action: 'set', id: 'completed_local_1', data: { id: 'completed_local_1', name: '推进计划' } };
  const saved = await main(request);
  expect(saved._id).toMatch(/^owned_/);
  await main(request);
  expect((await main({ collection: 'plans', action: 'list' })).data).toHaveLength(1);
  await main({ collection: 'plans', action: 'remove', id: request.id });
  expect((await main({ collection: 'plans', action: 'list' })).data).toEqual([]);
});
test('真实数据 API 经可信入口完成本地计划：实际云 ID 回填且重试只有一份计划/历史', async () => {
  jest.resetModules();
  const storage = new Map();
  global.wx = {
    getStorageSync: k => storage.get(k), setStorageSync: (k, v) => storage.set(k, JSON.parse(JSON.stringify(v))),
    removeStorageSync: k => storage.delete(k),
    getNetworkType: o => o.success({ networkType: 'wifi' }),
    cloud: { init() {}, callFunction: async ({ name, data }) => ({ result: await require(`../cloudfunctions/${name}`).main(data) }) },
  };
  const db = require('../utils/db');
  const domain = require('../utils/domain');
  const p = { id: 'local_test', name: '本人计划', cursor: 0, cycleDays: [{ dayId: 'day', exercises: [{ exerciseId: '0025', equipment: 'barbell', sets: 1, targetWeight: 20, targetReps: 10 }] }] };
  await db.savePlan(p);
  await require('../utils/cloud-service').enable();
  require('../utils/owner-storage').claimAnonymous('A');
  let session = domain.snapshotSession(p);
  session = domain.completeTrainingSet(session, session.exercises[0].sets[0].id, 200);
  const queue = require('../utils/queue');
  await queue.complete(session, 500);
  await queue.flush(); await queue.flush();
  expect(queue.getQueue()).toEqual([]);
  const plans = await db.fetchPlans();
  expect(plans).toHaveLength(1);
  expect(plans[0].id).toMatch(/^owned_/);
  expect(await db.fetchAllSessions()).toHaveLength(1);
  delete global.wx;
});
