let mockIdentity = 'A';
const mockDocs = { plans: new Map(), sessions: new Map(), personalDataMeta: new Map() };
let mockSerial = 0;
let mockReadError = null;
jest.mock('wx-server-sdk', () => ({
  DYNAMIC_CURRENT_ENV: 'test', init: jest.fn(), getWXContext: () => ({ OPENID: mockIdentity }),
  database: () => mockDatabase(),
}), { virtual: true });
function mockDatabase(docs = mockDocs) { return {
  startTransaction: async () => {
    const staged = Object.fromEntries(Object.entries(docs).map(([k,v]) => [k,new Map(v)]));
    return { ...mockDatabase(staged), commit: async () => { Object.keys(docs).forEach(k => { docs[k] = staged[k]; }); }, rollback: async () => {} };
  },
  collection: name => {
    function query(filter = {}, offset = 0, size = 20) {
      return {
        where: f => query(f, offset, size), orderBy() { return this; },
        skip: n => query(filter, n, size), limit: n => query(filter, offset, n),
        get: async () => ({ data: [...docs[name].values()].filter(d => Object.entries(filter).every(([k, v]) => d[k] === v)).slice(offset, offset + size) }),
        add: async ({ data }) => { const _id = 'generated_' + ++mockSerial; docs[name].set(_id, { ...data, _id }); return { _id }; },
        doc: id => ({
          get: async () => { if (mockReadError) throw mockReadError; return { data: docs[name].get(id) || null }; },
          set: async ({ data }) => { docs[name].set(id, { ...data, _id: id }); return { stats: { created: 1 } }; },
          update: async ({ data }) => { docs[name].set(id, { ...docs[name].get(id), ...data }); return { stats: { updated: 1 } }; },
          remove: async () => { docs[name].delete(id); return {}; },
        }),
      };
    }
    return query();
  } }; }
beforeEach(() => { mockReadError = null; mockIdentity = 'A'; mockDocs.plans.clear(); mockDocs.sessions.clear(); mockDocs.personalDataMeta.clear(); });
test('可信入口忽略伪造所有者，隔离查询/猜测 ID/修改/删除且拒绝无身份', async () => {
  const { main } = require('../cloudfunctions/personalData');
  const saved = await main({ collection: 'plans', action: 'set', id:'local_a', generation:0, expectedRevision:0, operationId:'create', data: { name: 'A计划', _openid: 'B', owner: 'B' } });
  expect((await main({ collection: 'plans', action: 'list' })).data[0].name).toBe('A计划');
  mockIdentity = 'B';
  expect((await main({ collection: 'plans', action: 'list', owner: 'A' })).data).toEqual([]);
  for (const action of ['set', 'remove']) {
    await expect(main({ collection: 'plans', action, generation:0, expectedRevision:1, operationId:'attack', id: saved._id, data: { name: '篡改' } })).rejects.toThrow('无权');
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
  const request = { collection: 'plans', action: 'set', generation:0, expectedRevision:0, operationId:'create', id: 'completed_local_1', data: { id: 'completed_local_1', name: '推进计划' } };
  const saved = await main(request);
  expect(saved._id).toMatch(/^owned_/);
  await main(request);
  expect((await main({ collection: 'plans', action: 'list' })).data).toHaveLength(1);
  await main({ collection: 'plans', action: 'remove', id: request.id, generation:0, expectedRevision:1, operationId:'delete' });
  expect((await main({ collection: 'plans', action: 'list' })).data[0].deleted).toBe(true);
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
  expect(plans[0].id).toBe('local_test');
  expect(await db.fetchAllSessions()).toHaveLength(1);
  delete global.wx;
});
test('版本写入响应丢失可重试，墓碑拒绝旧写入，代际过期不写入', async () => {
  const { main } = require('../cloudfunctions/personalData');
  expect(await main({ action: 'state' })).toEqual({ generation: 0 });
  const request = { collection:'plans', action:'set', id:'p', expectedRevision:0, generation:0, operationId:'edit1', data:{id:'p',name:'第一版'} };
  await main(request); await main(request);
  expect((await main({collection:'plans',action:'list'})).data).toHaveLength(1);
  await main({...request, action:'remove', expectedRevision:1, operationId:'delete1'});
  await expect(main(request)).rejects.toThrow('过期');
  await expect(main({...request, generation:1, operationId:'new'})).rejects.toThrow('代际');
  const result = await main({collection:'plans',action:'list'});
  expect(result.data[0].deleted).toBe(true);
});
test('真实数据边界：响应丢失和重启重试、完整计划分页、旧读不盖修改、删除不复活', async () => {
  jest.resetModules();
  const storage = new Map();
  let loseResponse = false;
  let interrupt = false;
  global.wx = {
    getStorageSync: k => storage.get(k), setStorageSync: (k,v) => storage.set(k,JSON.parse(JSON.stringify(v))),
    removeStorageSync: k => storage.delete(k), getNetworkType: o => o.success({networkType:'wifi'}),
    cloud: { init() {}, callFunction: async ({name,data}) => {
      if (interrupt && data && data.action === 'list' && data.skip >= 20) throw Error('分页中断');
      const result = await require(`../cloudfunctions/${name}`).main(data);
      if (loseResponse && data && data.action === 'set') throw Error('响应丢失');
      return {result};
    } },
  };
  let service = require('../utils/cloud-service'); await service.enable();
  let db = require('../utils/db'); let queue = require('../utils/queue');
  loseResponse = true;
  await db.savePlan({id:'p',name:'本地成绩',cycleDays:[]}); await queue.flush();
  expect(queue.getStatus().plans.pending).toBe(1);
  jest.resetModules(); service = require('../utils/cloud-service'); await service.enable();
  db = require('../utils/db'); queue = require('../utils/queue'); loseResponse = false;
  await queue.flush();
  expect(queue.getStatus().plans.pending).toBe(0);
  expect((await db.fetchPlans()).map(p => p.name)).toEqual(['本地成绩']);
  const { main } = require('../cloudfunctions/personalData');
  for (let i=0;i<44;i++) await main({collection:'plans',action:'set',id:'extra'+i,generation:0,expectedRevision:0,operationId:'extra'+i,data:{name:'额外'+i,createdAt:i}});
  expect(await db.fetchPlans()).toHaveLength(45);
  loseResponse = true;
  await db.savePlan({...db.getLocalPlans().find(p => p.id==='p'),name:'未确认的新编辑'}); await queue.flush();
  interrupt = true;
  expect((await db.fetchPlans()).find(p => p.id==='p').name).toBe('未确认的新编辑');
  expect(db.getLocalPlans()).toHaveLength(45);
  interrupt = false; loseResponse = false; await queue.flush();
  await db.deletePlan('p'); await queue.flush();
  expect((await db.fetchPlans()).some(p => p.id==='p')).toBe(false);
  expect(queue.getStatus().plans.pending).toBe(0);
  delete global.wx;
});
test('训练成绩先成立，响应丢失后重启只保留一场且游标只推进一次', async () => {
  jest.resetModules(); const storage = new Map(); let lose = true;
  global.wx = {
    getStorageSync:k=>storage.get(k), setStorageSync:(k,v)=>storage.set(k,JSON.parse(JSON.stringify(v))), removeStorageSync:k=>storage.delete(k),
    getNetworkType:o=>o.success({networkType:'wifi'}), cloud:{init(){},callFunction:async ({name,data})=>{
      const result = await require(`../cloudfunctions/${name}`).main(data);
      if(lose && data && data.collection==='sessions' && data.action==='set') throw Error('响应丢失');
      return {result};
    }},
  };
  await require('../utils/cloud-service').enable();
  let db=require('../utils/db'), queue=require('../utils/queue'); const domain=require('../utils/domain');
  const p={id:'local_session_plan',cursor:0,cycleDays:[{dayId:'a',exercises:[{exerciseId:'0025',equipment:'barbell',sets:1,targetWeight:20,targetReps:10}]},{dayId:'b',exercises:[]}]};
  await db.savePlan(p); await queue.flush();
  let session=domain.snapshotSession(p); session=domain.completeTrainingSet(session,session.exercises[0].sets[0].id,200);
  const final=await queue.complete(session,500); await queue.flush();
  expect(queue.getCompletedSession(session.id).exercises[0].sets[0].weight).toBe(20);
  expect(db.getLocalPlans()[0].cursor).toBe(1);
  expect(queue.getStatus().sessions.details[0]).toMatchObject({attempts:1,error:'响应丢失'});
  jest.resetModules(); lose=false; await require('../utils/cloud-service').enable();
  db=require('../utils/db'); queue=require('../utils/queue');
  expect(await queue.complete(session,900)).toEqual(final);
  await Promise.all([queue.flush(),queue.flush()]);
  expect(await db.fetchAllSessions()).toHaveLength(1);
  expect(db.getLocalPlans()[0].cursor).toBe(1);
  expect(queue.getStatus().sessions.pending).toBe(0);
  expect(queue.getStatus().plans.pending).toBe(0);
  delete global.wx;
});
test('过期本地编辑被拒绝后仍保留原修改和可见失败，不抬版本强写', async () => {
  jest.resetModules(); const storage = new Map();
  global.wx = {
    getStorageSync:k=>storage.get(k), setStorageSync:(k,v)=>storage.set(k,JSON.parse(JSON.stringify(v))), removeStorageSync:k=>storage.delete(k),
    getNetworkType:o=>o.success({networkType:'wifi'}), cloud:{init(){},callFunction:async ({name,data})=>({result:await require(`../cloudfunctions/${name}`).main(data)})},
  };
  await require('../utils/cloud-service').enable();
  const db=require('../utils/db'), queue=require('../utils/queue'), {main}=require('../cloudfunctions/personalData');
  await db.savePlan({id:'stale',name:'第一版',cycleDays:[]}); await queue.flush();
  const cached=db.getLocalPlans()[0];
  await main({collection:'plans',action:'set',id:'stale',expectedRevision:1,generation:0,operationId:'other-edit',data:{name:'较新云版本',cycleDays:[]}});
  await db.savePlan({...cached,name:'必须保留的本地修改'}); await queue.flush();
  expect((await db.fetchPlans())[0].name).toBe('必须保留的本地修改');
  expect(queue.getStatus().plans.pending).toBe(1);
  expect(queue.getStatus().plans.details[0].error).toContain('版本已过期');
  await queue.flush();
  expect((await main({collection:'plans',action:'list'})).data[0].name).toBe('较新云版本');
  expect(db.getLocalPlans()[0].name).toBe('必须保留的本地修改');
  delete global.wx;
});
test('事务读取错误（泛码-1）直接失败，不能当作文档不存在创建覆盖', async () => {
  const {main}=require('../cloudfunctions/personalData');
  mockReadError=Object.assign(Error('document.get:fail transport unavailable'),{errCode:-1});
  await expect(main({collection:'plans',action:'set',id:'missing',generation:0,expectedRevision:0,operationId:'read-failure',data:{name:'不应写入'}})).rejects.toThrow('transport unavailable');
  mockReadError=null;
  expect((await main({collection:'plans',action:'list'})).data).toEqual([]);
});
