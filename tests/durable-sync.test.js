const { enableCloud } = require('./helpers/cloud-runtime');
let saved;
function runtime() {
  const docs = new Map();
  let fail = true;
  let stale = null;
  global.wx = {
    getStorageSync: k => saved.get(k), setStorageSync: (k,v) => saved.set(k, JSON.parse(JSON.stringify(v))),
    removeStorageSync: k => saved.delete(k), getNetworkType: o => o.success({networkType:'wifi'}),
    cloud: { database: () => ({ collection: () => {
      const query = { orderBy() {return this;}, skip() {return this;}, limit() {return this;}, get: async () => ({data:stale || [...docs.values()]}) };
      query.doc = id => ({ set: async ({data}) => { if(fail) throw Error('offline'); docs.set(id,data); return {revision:data.revision}; }, remove: async () => {if(fail) throw Error('offline'); docs.delete(id); return {};}});
      return query;
    }}) },
  };
  return { online: () => {fail=false;}, stale: plans => {stale=plans;} };
}
beforeEach(() => { jest.resetModules(); saved = new Map(); });
afterEach(() => { delete global.wx; });
test('计划修改失败后重启保留待同步内容，手动重试才确认', async () => {
  const cloud = runtime(); await enableCloud();
  let db = require('../utils/db');
  await db.savePlan({id:'local_p',name:'离线修改',cycleDays:[],cursor:0});
  expect(require('../utils/queue').getStatus().plans.pending).toBe(1);
  jest.resetModules(); await require('../utils/cloud-service').enable();
  db = require('../utils/db');
  expect(db.getLocalPlans()[0].name).toBe('离线修改');
  cloud.online();
  await require('../utils/queue').flush();
  expect(require('../utils/queue').getStatus().plans.pending).toBe(0);
  expect((await db.fetchPlans())[0].id).toBe('local_p');
});
test('我的区分计划和训练的本地状态，手动失败不会提示成功', async () => {
  runtime(); wx.showToast = jest.fn();
  let definition; global.Page = p => {definition=p;};
  require('../pages/me/me');
  const page = {...definition,data:{...definition.data},setData(p){Object.assign(this.data,p);}};
  const db = require('../utils/db'); await db.savePlan({id:'local_p',name:'待同步',cycleDays:[]});
  await page.onShow();
  expect(page.data.syncStatus.plans.state).toBe('仅本地');
  await enableCloud(); require('../utils/owner-storage').claimAnonymous('fixture-user');
  await page.onFlushQueue();
  expect(page.data.syncStatus.plans.pending).toBe(1);
  expect(wx.showToast.mock.calls.at(-1)[0].title).toContain('待处理');
  delete global.Page;
});
test('停用发生于网络检测之前：旧单飞失败且不执行网络请求或确认任务', async () => {
  runtime(); await enableCloud();
  const db = require('../utils/db'); const queue = require('../utils/queue');
  await db.savePlan({id:'local_guard',name:'保留',cycleDays:[]}); await queue.flush();
  wx.getNetworkType = jest.fn(o => o.success({networkType:'wifi'}));
  const flushing = queue.flush();
  require('../utils/cloud-service').disable();
  await expect(flushing).rejects.toThrow('身份或云服务');
  expect(wx.getNetworkType).not.toHaveBeenCalled();
  expect(queue.getStatus().plans.pending).toBe(1);
});
test('离线删除任务重启后仍隐藏计划；确认删除后旧云列表也不能复活', async () => {
  const cloud=runtime(); await enableCloud();
  let db=require('../utils/db'), queue=require('../utils/queue');
  await db.savePlan({id:'local_deleted',name:'删除前',cycleDays:[]}); await queue.flush();
  await db.deletePlan('local_deleted'); await queue.flush();
  expect(db.getLocalPlans()).toEqual([]);
  expect(queue.getStatus().plans.pending).toBe(2);
  jest.resetModules(); await require('../utils/cloud-service').enable();
  db=require('../utils/db'); queue=require('../utils/queue'); cloud.online();
  await queue.flush(); expect(queue.getStatus().plans.pending).toBe(0);
  cloud.stale([{id:'local_deleted',name:'旧响应',revision:1,cycleDays:[]}]);
  expect(await db.fetchPlans()).toEqual([]);
});
