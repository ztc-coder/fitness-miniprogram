let mockStore;
jest.mock('wx-server-sdk', () => ({
  init: (...args) => mockStore.sdk.init(...args), getWXContext: () => mockStore.sdk.getWXContext(), database: () => mockStore.sdk.database(),
}), { virtual: true });
const { createCloudStore } = require('./helpers/deletion-cloud-store');
beforeEach(() => { jest.resetModules(); mockStore = createCloudStore(); });
const write = (id, generation = 0) => ({ action: 'set', collection: 'plans', id, generation, operationId: 'create_' + id, expectedRevision: 0, data: { name: id, cycleDays: [] } });
test('删除本人计划和历史，保留 B；响应丢失重试确认同一屏障，新同意后新数据可写，旧版本拒绝', async () => {
  const { main } = require('../cloudfunctions/personalData');
  await main(write('a'));
  await main({ ...write('s'), collection: 'sessions', data: { submittedAt: 12, exercises: [] } });
  mockStore.identity = 'B'; await main(write('b')); mockStore.identity = 'A';
  expect(await main({ action: 'deleteAll', operationId: 'delete-a', generation: 0 })).toMatchObject({ deleted: true, generation: 1 });
  expect(await main({ action: 'state' })).toMatchObject({ generation: 1, deleting: false });
  expect((await main({ action: 'list', collection: 'plans', generation: 1 })).data).toEqual([]);
  expect((await main({ action: 'list', collection: 'sessions', generation: 1 })).data).toEqual([]);
  await expect(main(write('stale'))).rejects.toThrow('代际');
  await expect(main({ action: 'add', collection: 'plans', data: {} })).rejects.toThrow('版本');
  await expect(main({ action: 'list', collection: 'plans' })).rejects.toThrow('代际');
  await main(write('new', 1));
  expect(await main({ action: 'deleteAll', operationId: 'delete-a', generation: 0 })).toMatchObject({ deleted: true, generation: 1 });
  expect((await main({ action: 'list', collection: 'plans', generation: 1 })).data.map(p => p.name)).toEqual(['new']);
  mockStore.identity = 'B'; expect((await main({ action: 'list', collection: 'plans' })).data.map(p => p.name)).toEqual(['b']);
});
function runtime() {
  const saved = new Map();
  const platform = { lose: false, pauseDelete: null, writeFailure: false, network: null };
  global.wx = {
    getStorageSync: key => saved.get(key), setStorageSync: (key,value) => {
      if (platform.writeFailure && key.includes('fitness:plans')) throw Error('本机存储失败');
      saved.set(key, JSON.parse(JSON.stringify(value)));
    }, removeStorageSync: key => saved.delete(key),
    getNetworkType: opts => opts.success({ networkType: 'wifi' }),
    cloud: { init() {}, callFunction: async ({ name, data }) => {
      const result = await require(`../cloudfunctions/${name}`).main(data);
      if (data && data.action === 'deleteAll') {
        if (platform.pauseDelete) await platform.pauseDelete();
        if (platform.lose) throw Error('响应丢失');
      }
      return { result };
    } },
  };
  return { saved, platform };
}
afterEach(() => { delete global.wx; });
test('撤回后的专用删除不启用同步，响应丢失/重启重试先云确认再清当前 owner，保留外国桶/偏好和新代际', async () => {
  const { saved, platform } = runtime();
  let service = require('../utils/cloud-service'); await service.enable();
  let db = require('../utils/db'); await db.savePlan({ id: 'a', name: '本人', cycleDays: [] });
  await require('../utils/queue').flush();
  const local = require('../utils/owner-storage'); local.setStorageSync('fitness:trainingDraft', { id: 'draft-a' });
  saved.set('fitness:settings', { theme: 'light', unit: 'lb' });
  const envelope = saved.get('fitness:owned:fitness:plans'); envelope.buckets.push({ owner: 'B', value: [{ id: 'foreign', name: 'B' }] });
  service.disable();
  let management = require('../utils/data-management'); platform.lose = true;
  expect((await management.deleteAll()).status).toBe('retry');
  expect(local.getStorageSync('fitness:trainingDraft')).toEqual({ id: 'draft-a' });
  expect(service.snapshot().consent).toBe(false);
  jest.resetModules(); platform.lose = false;
  service = require('../utils/cloud-service'); await service.restore();
  management = require('../utils/data-management');
  expect((await management.deleteAll()).status).toBe('deleted');
  expect(service.snapshot().consent).toBe(false);
  expect(require('../utils/owner-storage').getStorageSync('fitness:syncGeneration')).toBe(1);
  expect(saved.get('fitness:owned:fitness:plans').buckets).toEqual([{ owner: 'B', value: [{ id: 'foreign', name: 'B' }] }]);
  expect(saved.get('fitness:settings')).toEqual({ theme: 'light', unit: 'lb' });
  expect(require('../utils/queue').getQueue()).toEqual([]);
  await service.enable(); db = require('../utils/db');
  await db.savePlan({ id: 'new', name: '重新使用', cycleDays: [] }); await require('../utils/queue').flush();
  expect(require('../utils/queue').getStatus().plans.pending).toBe(0);
  expect((await db.fetchPlans()).map(p => p.name)).toEqual(['重新使用']);
});
test('旧设备再次读取/重试前识别新屏障，清过期缓存/草稿/队列，显式协调后新数据可同步', async () => {
  runtime(); const service = require('../utils/cloud-service'); await service.enable();
  const db = require('../utils/db'), queue = require('../utils/queue'), local = require('../utils/owner-storage');
  await db.savePlan({ id: 'old', name: '过期缓存', cycleDays: [] }); await queue.flush();
  local.setStorageSync('fitness:trainingDraft', { id: 'old-draft' });
  await db.savePlan({ id: 'pending', name: '不得改绑', cycleDays: [] }); await queue.flush();
  local.setStorageSync('fitness:pendingQueue', [{ id: 'stale-session', syncGeneration: 0 }]);
  const { main } = require('../cloudfunctions/personalData');
  await main({ action: 'deleteAll', operationId: 'other-device-delete', generation: 0 });
  await expect(db.fetchPlans()).rejects.toThrow('身份或云服务');
  expect(db.getLocalPlans()).toEqual([]); expect(queue.getQueue()).toEqual([]);
  expect(local.getStorageSync('fitness:trainingDraft')).toBeUndefined();
  expect(queue.getStatus().plans.pending).toBe(0);
  await expect(require('../utils/personal-cloud').generation()).rejects.toThrow('确认');
  await require('../utils/data-management').reconcile();
  await db.savePlan({ id: 'new-use', name: '主动新建', cycleDays: [] }); await queue.flush();
  expect(queue.getStatus().plans.pending).toBe(0);
  expect((await db.fetchPlans()).map(p => p.name)).toEqual(['主动新建']);
});
test('我的清本机二次确认展示全部身份损失/草稿/待同步，离线清理不请求云，偏好保留并撤回', async () => {
  const { saved } = runtime();
  saved.set('fitness:plans', [{ id: 'anonymous' }]); saved.set('fitness:trainingDraft', { id: 'draft' });
  saved.set('fitness:pendingQueue', [{ id: 'offline-session' }]);
  saved.set('fitness:owned:fitness:plans', { version: 1, buckets: [{ owner: 'A', value: [{ id: 'a' }] }, { owner: 'B', value: [{ id: 'b' }] }] });
  saved.set('fitness:settings', { theme: 'light', unit: 'lb' });
  wx.cloud.callFunction = jest.fn(() => { throw Error('离线不应联网'); });
  wx.showModal = jest.fn(); wx.showToast = jest.fn();
  let definition; global.Page = p => { definition = p; }; require('../pages/data-management/data-management');
  const page = { ...definition, data: { ...definition.data }, setData(p) { Object.assign(this.data, p); } };
  page.onClearLocal();
  expect(wx.showModal.mock.calls[0][0].content).toContain('全部身份');
  expect(wx.showModal.mock.calls[0][0].content).toContain('1 份进行中草稿');
  expect(wx.showModal.mock.calls[0][0].content).toContain('3 项待同步');
  wx.showModal.mock.calls[0][0].success({ confirm: true });
  expect(saved.has('fitness:trainingDraft')).toBe(true);
  wx.showModal.mock.calls[1][0].success({ confirm: true });
  expect(saved.has('fitness:plans')).toBe(false); expect(saved.has('fitness:owned:fitness:plans')).toBe(false);
  expect(saved.has('fitness:trainingDraft')).toBe(false); expect(saved.has('fitness:pendingQueue')).toBe(false);
  expect(saved.get('fitness:settings')).toEqual({ theme: 'light', unit: 'lb' });
  expect(require('../utils/cloud-service').snapshot().consent).toBe(false);
  expect(wx.cloud.callFunction).not.toHaveBeenCalled(); expect(page.data.serviceLabel).toBe('仅本地');
});
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
test.each(['write', 'delete'])('事务冲突必须重读 owner 锁：暂停 %s commit 后交错，不允许删除后旧写复活', async first => {
  const { main } = require('../cloudfunctions/personalData');
  await main(write('existing'));
  const entered = deferred(), release = deferred();
  mockStore.beforeCommit = async () => { mockStore.beforeCommit = null; entered.resolve(); await release.promise; };
  const deletion = { action: 'deleteAll', operationId: 'racing-delete', generation: 0 };
  const pending = first === 'write' ? main(write('delayed')) : main(deletion);
  const observed = pending.then(value => ({ value }), error => ({ error }));
  await entered.promise;
  if (first === 'write') await main(deletion); else await main(write('delayed'));
  release.resolve(); const result = await observed;
  if (first === 'write') expect(result.error.message).toContain('代际'); else expect(result.value.deleted).toBe(true);
  expect(mockStore.conflicts).toBeGreaterThan(0);
  expect((await main({ action: 'list', collection: 'plans', generation: 1 })).data).toEqual([]);
});
test('分页删除中断持续 deleting，拒绝读取部分列表/常规写；同 job 重试清理剩余数据', async () => {
  const { main } = require('../cloudfunctions/personalData');
  for (let i = 0; i < 45; i++) await main(write('p' + i));
  let pages = 0;
  mockStore.afterQuery = async () => { if (++pages === 2) throw Error('删除分页断网'); };
  const deletion = { action: 'deleteAll', operationId: 'interrupted', generation: 0 };
  await expect(main(deletion)).rejects.toThrow('断网');
  expect(await main({ action: 'state' })).toMatchObject({ generation: 1, deleting: true, deletion: { id: 'interrupted' } });
  await expect(main({ action: 'list', collection: 'plans', generation: 1 })).rejects.toThrow('正在删除');
  await expect(main(write('new', 1))).rejects.toThrow('正在删除');
  mockStore.afterQuery = null;
  expect(await main(deletion)).toMatchObject({ deleted: true, generation: 1 });
  expect((await main({ action: 'list', collection: 'plans', generation: 1 })).data).toEqual([]);
});
test('迟到重复 worker 的物理删除与完成确认都核对 active job，不能删后来新数据', async () => {
  const { main } = require('../cloudfunctions/personalData');
  await main(write('same-id'));
  const captured = deferred(), release = deferred();
  mockStore.afterQuery = async () => { mockStore.afterQuery = null; captured.resolve(); await release.promise; };
  const request = { action: 'deleteAll', operationId: 'worker', generation: 0 };
  const delayed = main(request); await captured.promise;
  expect(await main(request)).toMatchObject({ deleted: true });
  await main(write('same-id', 1));
  release.resolve(); expect(await delayed).toMatchObject({ deleted: false, stale: true });
  expect((await main({ action: 'list', collection: 'plans', generation: 1 })).data.map(p => p.name)).toEqual(['same-id']);
  // A deletion ID older than the retained last job cannot start a new job with its old expected generation.
  await main({ action: 'deleteAll', operationId: 'second', generation: 1 });
  await main(write('after-second', 2));
  await expect(main(request)).rejects.toThrow('代际');
  expect((await main({ action: 'list', collection: 'plans', generation: 2 })).data.map(p => p.name)).toEqual(['after-second']);
});
test('本机清理失败仍保存同一删除 ID；重试 ack 不再增加代际', async () => {
  const { platform } = runtime(); const service = require('../utils/cloud-service'); await service.enable();
  const db = require('../utils/db'); await db.savePlan({ id: 'a', cycleDays: [] }); await require('../utils/queue').flush();
  const management = require('../utils/data-management'); platform.writeFailure = true;
  const failed = await management.deleteAll(); expect(failed).toMatchObject({ status: 'retry' });
  expect(management.getDeletion()).toMatchObject({ state: 'cloud-confirmed', resultGeneration: 1 });
  platform.writeFailure = false;
  expect(await management.deleteAll()).toMatchObject({ status: 'deleted', generation: 1 });
  expect(await require('../cloudfunctions/personalData').main({ action: 'state' })).toMatchObject({ generation: 1 });
});
test.each(['owner', 'local'])('迟到删除响应不会擦除期间变化的 %s 数据', async change => {
  const { platform } = runtime(); const service = require('../utils/cloud-service'); await service.enable();
  const local = require('../utils/owner-storage'), management = require('../utils/data-management');
  local.setStorageSync('fitness:trainingDraft', { id: 'before' });
  const captured = deferred(), release = deferred();
  platform.pauseDelete = async () => { captured.resolve(); await release.promise; };
  const pending = management.deleteAll(); await captured.promise;
  if (change === 'owner') { mockStore.identity = 'B'; await service.enable(); }
  local.setStorageSync('fitness:trainingDraft', { id: 'new-draft' });
  release.resolve();
  expect((await pending).status).toBe(change === 'owner' ? 'stale' : 'local-changed');
  expect(local.getStorageSync('fitness:trainingDraft')).toEqual({ id: 'new-draft' });
});
test('明确撤回后网络恢复和定时重试不发新增身份/同步/媒体请求，本地数据保留', async () => {
  jest.useFakeTimers();
  try {
    runtime(); let reconnect;
    wx.onNetworkStatusChange = listener => { reconnect = listener; };
    const call = wx.cloud.callFunction; wx.cloud.callFunction = jest.fn(call);
    const service = require('../utils/cloud-service'); await service.enable();
    require('../utils/owner-storage').setStorageSync('fitness:trainingDraft', { id: 'continue-local' });
    require('../utils/data-management').withdraw();
    wx.cloud.callFunction.mockClear(); reconnect({ isConnected: true }); jest.advanceTimersByTime(120000);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(wx.cloud.callFunction).not.toHaveBeenCalled();
    expect(require('../data/media-root').resolveMedia('exercises/a.jpg')).toBe('');
    expect(require('../utils/owner-storage').getStorageSync('fitness:trainingDraft')).toEqual({ id: 'continue-local' });
    expect(service.snapshot().consent).toBe(false);
  } finally { jest.clearAllTimers(); jest.useRealTimers(); }
});
test('清本机失效迟到列表和我的统计回调，不回填已清计划、队列或计数', async () => {
  runtime(); const service = require('../utils/cloud-service'); await service.enable();
  const db = require('../utils/db'); await db.savePlan({ id: 'old', cycleDays: [] }); await require('../utils/queue').flush();
  const captured = deferred(), release = deferred(); const call = wx.cloud.callFunction;
  wx.cloud.callFunction = async args => {
    const result = await call(args);
    if (args.data && args.data.action === 'list') { captured.resolve(); await release.promise; }
    return result;
  };
  let definition; global.Page = p => { definition = p; }; require('../pages/me/me');
  const page = { ...definition, data: { ...definition.data, monthSessions: 42 }, setData(p) { Object.assign(this.data, p); } };
  const showing = page.onShow(); const reading = db.fetchPlans().catch(error => error);
  await captured.promise; require('../utils/data-management').clearLocal(); release.resolve();
  await showing; expect(await reading).toBeInstanceOf(Error);
  expect(page.data.monthSessions).toBe(0); expect(page.data.monthProgress).toBe(0); expect(page.data.pendingCount).toBe(0);
  expect(db.getLocalPlans()).toEqual([]); expect(require('../utils/queue').getQueue()).toEqual([]);
  expect(db.getReadStatus()).toEqual({ plans: '未读取', sessions: '未读取' });
});
test('我的全部删除二次确认本人身份和损失，失败不清本机不报成功，显式重试可完成', async () => {
  runtime(); const service = require('../utils/cloud-service'); await service.enable();
  const local = require('../utils/owner-storage'); local.setStorageSync('fitness:trainingDraft', { id: 'keep-until-confirmed' });
  wx.showModal = jest.fn(); wx.showToast = jest.fn();
  const call = wx.cloud.callFunction; let fail = true;
  wx.cloud.callFunction = async args => { if (fail && args.data && args.data.action === 'deleteAll') throw Error('断网'); return call(args); };
  let definition; global.Page = p => { definition = p; }; require('../pages/data-management/data-management');
  const page = { ...definition, data: { ...definition.data }, setData(p) { Object.assign(this.data, p); } };
  await page.onDeleteAll();
  const first = wx.showModal.mock.calls[0][0]; expect(first.content).toContain('当前本人身份：A');
  expect(first.content).toContain('1 份进行中草稿'); expect(first.content).toContain('不会清除其他身份或匿名区');
  first.success({ confirm: true });
  await wx.showModal.mock.calls[1][0].success({ confirm: true });
  expect(page.data.dataResult).toContain('断网'); expect(page.data.dataResult).not.toContain('已确认');
  expect(local.getStorageSync('fitness:trainingDraft')).toEqual({ id: 'keep-until-confirmed' });
  expect(service.snapshot().consent).toBe(false);
  fail = false; await page.onDeleteAll(); wx.showModal.mock.calls[2][0].success({ confirm: true });
  await wx.showModal.mock.calls[3][0].success({ confirm: true });
  expect(page.data.dataResult).toContain('本人云端删除已确认'); expect(local.getStorageSync('fitness:trainingDraft')).toBeUndefined();
});
test('待确认删除任务必须先重试完成，不能先协调/上传新数据再复用旧 ack 冒充新一轮删除', async () => {
  const { platform } = runtime(); const service = require('../utils/cloud-service'); await service.enable();
  const management = require('../utils/data-management'); platform.lose = true;
  expect((await management.deleteAll()).status).toBe('retry');
  await service.enable();
  await expect(management.reconcile()).rejects.toThrow('重试删除');
  platform.lose = false;
  expect((await management.deleteAll()).status).toBe('deleted');
  await service.enable();
  const db = require('../utils/db'); await db.savePlan({ id: 'new-after-confirmed', name: '新数据', cycleDays: [] }); await require('../utils/queue').flush();
  expect((await db.fetchPlans()).map(p => p.name)).toEqual(['新数据']);
  expect((await management.deleteAll()).status).toBe('deleted');
  expect(await require('../cloudfunctions/personalData').main({ action: 'state' })).toMatchObject({ generation: 2 });
});
test('删除后不把保留的旧匿名缓存认领并隐式绑定为新代际任务', async () => {
  const { saved } = runtime(); saved.set('fitness:plans', [{ id: 'anonymous-old', name: '匿名旧数据', cycleDays: [] }]);
  const service = require('../utils/cloud-service'); await service.enable();
  expect((await require('../utils/data-management').deleteAll()).status).toBe('deleted');
  await service.enable();
  const local = require('../utils/owner-storage');
  expect(() => local.claimAnonymous('A')).toThrow('旧代际');
  expect(local.claimPreview().plans).toBe(1);
  expect(require('../utils/db').getLocalPlans()).toEqual([]);
});
test('危险操作损失预览按当前可见队列去重，不把同场旧队列和完成日志重复计数', () => {
  runtime(); const local = require('../utils/owner-storage');
  local.setStorageSync('fitness:pendingQueue', [{ id: 'same-session' }]);
  local.setStorageSync('fitness:completedTraining', [{ session: { id: 'same-session' }, sessionSynced: false, planSynced: true }]);
  expect(require('../utils/data-management').preview(true)).toMatchObject({ pending: 1 });
});
test('迟到的启用同意确认不能覆盖稍后的撤回或清本机决定', async () => {
  runtime(); wx.showModal = jest.fn(); wx.showToast = jest.fn();
  let definition; global.Page = p => { definition = p; }; require('../pages/me/me');
  const page = { ...definition, data: { ...definition.data }, setData(p) { Object.assign(this.data, p); } };
  page.onToggleOffline();
  const modal = wx.showModal.mock.calls[0][0];
  require('../pages/data-management/data-management');
  const managementPage = { ...definition, data: { ...definition.data }, setData(p) { Object.assign(this.data, p); } };
  managementPage.onWithdrawConsent();
  const call = wx.cloud.callFunction; wx.cloud.callFunction = jest.fn(call);
  await modal.success({ confirm: true });
  expect(require('../utils/cloud-service').snapshot().consent).toBe(false);
  expect(wx.cloud.callFunction).not.toHaveBeenCalled();
});
test('同一 owner 重新启用后的旧认领确认不能认领后来改变的匿名数据', async () => {
  const { saved } = runtime(); saved.set('fitness:plans', [{ id: 'old-anonymous', cycleDays: [] }]);
  const service = require('../utils/cloud-service'); await service.enable();
  wx.showModal = jest.fn(); wx.showToast = jest.fn();
  let definition; global.Page = p => { definition = p; }; require('../pages/me/me');
  const page = { ...definition, data: { ...definition.data }, setData(p) { Object.assign(this.data, p); } };
  page.onClaimLocalData(); const modal = wx.showModal.mock.calls[0][0];
  service.disable(); await service.enable();
  saved.set('fitness:plans', [{ id: 'new-anonymous', cycleDays: [] }]);
  await modal.success({ confirm: true });
  expect(require('../utils/owner-storage').claimPreview().plans).toBe(1);
  expect(require('../utils/db').getLocalPlans()).toEqual([]);
});
test('尚未获知云端删除代际时确认认领，先识别屏障且保留旧匿名数据，不移入后清掉', async () => {
  const { saved } = runtime(); saved.set('fitness:plans', [{ id: 'anonymous-before-delete', cycleDays: [] }]);
  const service = require('../utils/cloud-service'); await service.enable();
  await require('../cloudfunctions/personalData').main({ action: 'deleteAll', operationId: 'another-device', generation: 0 });
  wx.showModal = jest.fn(); wx.showToast = jest.fn();
  let definition; global.Page = p => { definition = p; }; require('../pages/me/me');
  const page = { ...definition, data: { ...definition.data }, setData(p) { Object.assign(this.data, p); } };
  page.onClaimLocalData();
  await wx.showModal.mock.calls[0][0].success({ confirm: true });
  expect(require('../utils/owner-storage').claimPreview().plans).toBe(1);
  expect(require('../utils/db').getLocalPlans()).toEqual([]);
});
test('协调新代际等待云状态期间新建的本机数据不被迟到响应清除', async () => {
  runtime(); const service = require('../utils/cloud-service'); await service.enable();
  const captured = deferred(), release = deferred(); const call = wx.cloud.callFunction;
  wx.cloud.callFunction = async args => {
    const result = await call(args);
    if (args.data && args.data.action === 'state') { captured.resolve(); await release.promise; }
    return result;
  };
  const local = require('../utils/owner-storage');
  const pending = require('../utils/data-management').reconcile();
  await captured.promise;
  local.setStorageSync('fitness:trainingDraft', { id: 'new-during-reconcile' });
  release.resolve();
  await expect(pending).rejects.toThrow('本机数据');
  expect(local.getStorageSync('fitness:trainingDraft')).toEqual({ id: 'new-during-reconcile' });
});
test('删除授权期间打开页面的旧编辑确认，在删除成功清本机后也失效', async () => {
  runtime(); const service = require('../utils/cloud-service'); await service.enable();
  const db = require('../utils/db');
  const plan = { id: 'old-plan', name: '旧计划', cycleDays: [{ dayId: 'one', exercises: [] }, { dayId: 'two', exercises: [] }] };
  await db.savePlan(plan); await require('../utils/queue').flush();
  const management = require('../utils/data-management'), token = await management.authorizeDeletion();
  wx.showModal = jest.fn(); wx.showToast = jest.fn();
  let definition; global.Page = p => { definition = p; }; require('../pages/plan/plan');
  const page = { ...definition, data: { ...definition.data, activePlan: plan }, setData(p) { Object.assign(this.data, p); } };
  page.onDeleteDay({ currentTarget: { dataset: { dayid: 'one' } } });
  const modal = wx.showModal.mock.calls[0][0];
  expect((await management.deleteAll(token)).status).toBe('deleted');
  await modal.success({ confirm: true });
  expect(db.getLocalPlans()).toEqual([]);
  expect(require('../utils/queue').getStatus().plans.pending).toBe(0);
});
test('清本机确认后同身份认领改变损失范围，旧二次确认不能清掉刚认领的数据', async () => {
  const { saved } = runtime(); saved.set('fitness:plans', [{ id: 'anonymous', cycleDays: [] }]);
  const service = require('../utils/cloud-service'); await service.enable();
  wx.showModal = jest.fn(); wx.showToast = jest.fn();
  let definition; global.Page = p => { definition = p; }; require('../pages/data-management/data-management');
  const page = { ...definition, data: { ...definition.data }, setData(p) { Object.assign(this.data, p); } };
  page.onClearLocal(); wx.showModal.mock.calls[0][0].success({ confirm: true });
  require('../utils/owner-storage').claimAnonymous('A');
  await wx.showModal.mock.calls[1][0].success({ confirm: true });
  expect(require('../utils/db').getLocalPlans().map(p => p.id)).toEqual(['anonymous']);
  expect(page.data.dataResult).toContain('重新查看范围');
});
test('删除初始状态请求期间新增的本机数据也要求重新确认，不能被后续云确认清除', async () => {
  runtime(); const service = require('../utils/cloud-service'); await service.enable();
  const management = require('../utils/data-management'), token = await management.authorizeDeletion();
  const captured = deferred(), release = deferred(); const call = wx.cloud.callFunction;
  wx.cloud.callFunction = async args => {
    const result = await call(args);
    if (args.data && args.data.action === 'state') { captured.resolve(); await release.promise; }
    return result;
  };
  const pending = management.deleteAll(token); await captured.promise;
  const local = require('../utils/owner-storage'); local.setStorageSync('fitness:trainingDraft', { id: 'new-during-state' });
  release.resolve();
  expect((await pending).status).toBe('local-changed');
  expect(local.getStorageSync('fitness:trainingDraft')).toEqual({ id: 'new-during-state' });
});
test('超过100条删除未完成后重新启用及网络冲刷，保留本人本机全部待确认数据直到显式重试', async () => {
  jest.useFakeTimers();
  try {
    runtime(); let reconnect;
    wx.onNetworkStatusChange = listener => { reconnect = listener; };
    const service = require('../utils/cloud-service'); await service.enable();
    const db = require('../utils/db'), local = require('../utils/owner-storage'), queue = require('../utils/queue');
    for (let i = 0; i < 101; i++) await db.savePlan({ id: 'many' + i, name: 'plan', cycleDays: [] });
    await queue.flush();
    local.setStorageSync('fitness:trainingDraft', { id: 'keep-draft' });
    local.setStorageSync('fitness:pendingQueue', [{ id: 'keep-session', syncGeneration: 0 }]);
    const management = require('../utils/data-management');
    expect((await management.deleteAll()).status).toBe('retry');
    const operation = management.getDeletion();
    await service.enable(); reconnect({ isConnected: true }); jest.advanceTimersByTime(1000);
    await queue.flush();
    await expect(require('../utils/personal-cloud').generation()).rejects.toThrow('重试删除');
    expect(await db.fetchPlans()).toHaveLength(101);
    expect(db.getLocalPlans()).toHaveLength(101);
    expect(local.getStorageSync('fitness:trainingDraft')).toEqual({ id: 'keep-draft' });
    expect(queue.getQueue()).toEqual([{ id: 'keep-session', syncGeneration: 0 }]);
    expect(management.getDeletion()).toEqual(operation);
    expect((await management.deleteAll()).status).toBe('deleted');
    expect(db.getLocalPlans()).toEqual([]);
  } finally { jest.clearAllTimers(); jest.useRealTimers(); }
});
// Two independent wx storage areas, one trusted cloud owner; module resets model device restarts.
test.each(['unexecuted', 'lost-response'])('双设备：A 的 %s 任务被 B 的新删除替代，只能检查并双确认协调当前身份', async mode => {
  const a = runtime(), wxA = wx;
  let service = require('../utils/cloud-service'); await service.enable();
  let db = require('../utils/db'); await db.savePlan({ id: 'a-local', name: '旧本机', cycleDays: [] }); await require('../utils/queue').flush();
  require('../utils/owner-storage').setStorageSync('fitness:trainingDraft', { id: 'a-draft' });
  a.saved.get('fitness:owned:fitness:plans').buckets.push({ owner: '', value: [{ id: 'anonymous' }] });
  a.saved.get('fitness:owned:fitness:plans').buckets.push({ owner: 'foreign', value: [{ id: 'foreign-plan' }] });
  const callA = wx.cloud.callFunction;
  wx.cloud.callFunction = async args => {
    if (args.data && args.data.action === 'deleteAll' && mode === 'unexecuted') throw Error('发送前断网');
    const result = await callA(args);
    if (args.data && args.data.action === 'deleteAll') throw Error('响应丢失');
    return result;
  };
  let management = require('../utils/data-management'); expect((await management.deleteAll()).status).toBe('retry');
  const original = management.getDeletion();
  jest.resetModules(); runtime();
  service = require('../utils/cloud-service'); await service.enable();
  expect((await require('../utils/data-management').deleteAll()).status).toBe('deleted');
  // New data after B's completion must not be erased by A reusing an old completion/job.
  await service.enable(); db = require('../utils/db');
  await db.savePlan({ id: 'b-new', name: '删除后新数据', cycleDays: [] }); await require('../utils/queue').flush();
  jest.resetModules(); global.wx = wxA; wx.cloud.callFunction = callA;
  management = require('../utils/data-management');
  expect((await management.deleteAll()).status).toBe('retry');
  expect(management.getDeletion()).toEqual(original);
  wx.showModal = jest.fn(); wx.showToast = jest.fn();
  let definition; global.Page = p => { definition = p; }; require('../pages/data-management/data-management');
  const page = { ...definition, data: { ...definition.data }, setData(p) { Object.assign(this.data, p); } };
  await page.onRecoverDeletion();
  expect(management.getDeletion()).toMatchObject({ id: original.id, generation: original.generation, state: 'superseded' });
  const first = wx.showModal.mock.calls[0][0];
  expect(first.content).toContain('当前本人身份：A'); expect(first.content).toContain('另一设备已完成删除，本机旧数据');
  expect(first.content).not.toContain(original.id);
  expect(first.content).toContain('1 份进行中草稿'); expect(first.content).toContain('不会删除当前云端新数据');
  expect(require('../utils/owner-storage').getStorageSync('fitness:trainingDraft')).toEqual({ id: 'a-draft' });
  first.success({ confirm: true });
  expect(require('../utils/db').getLocalPlans()).toHaveLength(1);
  await wx.showModal.mock.calls[1][0].success({ confirm: true });
  expect(page.data.dataResult).toContain('已协调当前身份本机');
  expect(management.getDeletion()).toBeNull();
  expect(require('../utils/db').getLocalPlans()).toEqual([]);
  expect(a.saved.has('fitness:plans')).toBe(false);
  expect(a.saved.get('fitness:owned:fitness:plans').buckets).toEqual([
    { owner: '', value: [{ id: 'anonymous' }] }, { owner: 'foreign', value: [{ id: 'foreign-plan' }] },
  ]);
  expect(require('../utils/cloud-service').snapshot().consent).toBe(false);
  await require('../utils/cloud-service').enable();
  expect((await require('../utils/db').fetchPlans()).map(p => p.id)).toEqual(['b-new']);
});
async function supersededRecovery() {
  const a = runtime(), wxA = wx;
  await require('../utils/cloud-service').enable();
  await require('../utils/db').savePlan({ id: 'retain', cycleDays: [] });
  require('../utils/owner-storage').setStorageSync('fitness:trainingDraft', { id: 'retain-draft' });
  const call = wx.cloud.callFunction;
  wx.cloud.callFunction = async args => {
    if (args.data && args.data.action === 'deleteAll') throw Error('发送前断网');
    return call(args);
  };
  expect((await require('../utils/data-management').deleteAll()).status).toBe('retry');
  jest.resetModules(); runtime();
  expect((await require('../utils/data-management').deleteAll()).status).toBe('deleted');
  jest.resetModules(); global.wx = wxA; wx.cloud.callFunction = call;
  const management = require('../utils/data-management');
  const token = await management.authorizeDeletion();
  const inspection = await management.inspectDeletion(token);
  return { ...a, management, inspection, call };
}
test.each(['network', 'local', 'epoch', 'cloud-job'])('替代任务的协调再次核实 %s，变化或失败不清本机也不报成功', async change => {
  const { management, inspection, call } = await supersededRecovery();
  const local = require('../utils/owner-storage');
  if (change === 'network') wx.cloud.callFunction = async () => { throw Error('核实断网'); };
  if (change === 'local') local.setStorageSync('fitness:trainingDraft', { id: 'new-draft' });
  if (change === 'epoch') require('../utils/cloud-service').disable();
  if (change === 'cloud-job') {
    // Another real client deletes again while A's confirmation is open.
    const wxA = wx; jest.resetModules(); runtime();
    expect((await require('../utils/data-management').deleteAll()).status).toBe('deleted');
    global.wx = wxA; wx.cloud.callFunction = call;
  }
  expect((await management.recoverDeletion(inspection)).status).toBe('retry');
  expect(local.getStorageSync('fitness:trainingDraft')).toEqual({ id: change === 'local' ? 'new-draft' : 'retain-draft' });
  expect(management.getDeletion()).toMatchObject({ state: 'superseded', generation: 0 });
});
test('替代任务协调的部分本机写失败保留原 ID，重新检查确认可完成而不重删云端', async () => {
  const { management, inspection } = await supersededRecovery();
  const set = wx.setStorageSync;
  wx.setStorageSync = (key, value) => {
    if (key.includes('fitness:completedTraining')) throw Error('部分清理存储失败');
    set(key, value);
  };
  expect(await management.recoverDeletion(inspection)).toMatchObject({ status: 'retry', message: '部分清理存储失败' });
  expect(management.getDeletion()).toMatchObject({ id: inspection.operationId, generation: 0, state: 'superseded' });
  wx.setStorageSync = set;
  const token = await management.authorizeDeletion();
  expect(await management.recoverDeletion(await management.inspectDeletion(token))).toMatchObject({ status: 'recovered', generation: 1 });
  expect(management.getDeletion()).toBeNull();
});
test('其他设备的新任务仍 deleting 时只标记替代、不协调放弃本机；完成后才能再次检查确认', async () => {
  const { management, inspection } = await supersededRecovery();
  const { main } = require('../cloudfunctions/personalData');
  for (let i = 0; i < 101; i++) await main(write('later' + i, 1));
  expect(await main({ action: 'deleteAll', operationId: 'peer-incomplete', generation: 1 })).toMatchObject({ deleting: true, deleted: false });
  await expect(management.inspectDeletion(inspection.token)).rejects.toThrow('尚未完成');
  expect(management.getDeletion()).toMatchObject({ id: inspection.operationId, generation: 0, state: 'superseded', supersededBy: { id: 'peer-incomplete', generation: 2 } });
  expect(require('../utils/owner-storage').getStorageSync('fitness:trainingDraft')).toEqual({ id: 'retain-draft' });
  expect((await management.recoverDeletion(inspection)).status).toBe('retry');
  expect(await main({ action: 'deleteAll', operationId: 'peer-incomplete', generation: 1 })).toMatchObject({ deleted: true });
  expect((await management.recoverDeletion(await management.inspectDeletion(inspection.token))).status).toBe('recovered');
});
test.each(['first-cancel', 'second-cancel', 'local-change'])('恢复 UI 的 %s 不放弃本机或替代任务记录', async choice => {
  const { management } = await supersededRecovery();
  wx.showModal = jest.fn(); wx.showToast = jest.fn();
  let definition; global.Page = p => { definition = p; }; require('../pages/data-management/data-management');
  const page = { ...definition, data: { ...definition.data }, setData(p) { Object.assign(this.data, p); } };
  await page.onRecoverDeletion();
  wx.showModal.mock.calls[0][0].success({ confirm: choice !== 'first-cancel' });
  if (choice === 'local-change') require('../utils/owner-storage').setStorageSync('fitness:trainingDraft', { id: 'new-after-confirmation' });
  if (choice !== 'first-cancel') await wx.showModal.mock.calls[1][0].success({ confirm: choice !== 'second-cancel' });
  expect(management.getDeletion()).toMatchObject({ state: 'superseded', generation: 0 });
  expect(require('../utils/db').getLocalPlans()).toHaveLength(1);
  expect(require('../utils/owner-storage').getStorageSync('fitness:trainingDraft')).toEqual({ id: choice === 'local-change' ? 'new-after-confirmation' : 'retain-draft' });
});
test('恢复 UI 的部分本机清理失败如实报告未完成，原任务可再次检查，不挂在处理中', async () => {
  const { management } = await supersededRecovery();
  wx.showModal = jest.fn(); wx.showToast = jest.fn();
  let definition; global.Page = p => { definition = p; }; require('../pages/data-management/data-management');
  const page = { ...definition, data: { ...definition.data }, setData(p) { Object.assign(this.data, p); } };
  await page.onRecoverDeletion(); wx.showModal.mock.calls[0][0].success({ confirm: true });
  const set = wx.setStorageSync;
  wx.setStorageSync = (key, value) => { if (key.includes('fitness:completedTraining')) throw Error('部分清理失败'); set(key, value); };
  await wx.showModal.mock.calls[1][0].success({ confirm: true });
  expect(page.data.dataResult).toContain('协调未完成'); expect(page.data.dataResult).toContain('部分清理失败');
  expect(page.data.deleting).toBe(false);
  expect(management.getDeletion()).toMatchObject({ state: 'superseded' });
});

test('匿名创建完成后显式认领并全量删除：平台裸键和 owner 桶均不遗留完整个人快照', async () => {
  const { saved } = runtime();
  const db = require('../utils/db'), domain = require('../utils/domain'), local = require('../utils/owner-storage');
  const plan = { id: 'anonymous-plan', name: '匿名训练', cursor: 0, cycleDays: [{ dayId: 'push', exercises: [{ exerciseId: '0025', equipment: 'barbell', sets: 1, targetWeight: 20, targetReps: 10 }] }] };
  await db.savePlan(plan);
  let draft = domain.snapshotSession(plan);
  draft = domain.completeTrainingSet(draft, draft.exercises[0].sets[0].id, 200);
  local.setStorageSync('fitness:trainingDraft', draft);
  const final = await require('../utils/queue').complete(draft, 500);
  expect(saved.has('fitness:completedTraining')).toBe(true);
  const service = require('../utils/cloud-service'); await service.enable();
  expect(db.getLocalPlans()).toEqual([]); // enabling is not permission to claim
  local.claimAnonymous('A');
  expect((await db.fetchAllSessions()).some(s => s.id === final.id)).toBe(true);
  service.disable();
  expect(await require('../utils/data-management').deleteAll()).toMatchObject({ status: 'deleted' });
  for (const key of ['plans', 'trainingDraft', 'pendingQueue', 'completedTraining', 'planSync']) {
    expect(saved.has('fitness:' + key)).toBe(false);
    expect(saved.get('fitness:owned:fitness:' + key).buckets).toEqual([]);
  }
  expect(JSON.stringify([...saved])).not.toContain('anonymous-plan');
});

test('认领在信封提交后移除裸键失败：重启保留权威信封，显式重试补清而不重复认领', async () => {
  const { saved } = runtime();
  saved.set('fitness:plans', [{ id: 'claimed' }]);
  saved.set('fitness:trainingDraft', { id: 'not-yet-claimed' });
  await require('../utils/cloud-service').enable();
  const remove = wx.removeStorageSync;
  wx.removeStorageSync = key => { if (key === 'fitness:plans') throw Error('remove failed'); return remove(key); };
  expect(() => require('../utils/owner-storage').claimAnonymous('A')).toThrow('remove failed');
  expect(saved.get('fitness:owned:fitness:plans')).toEqual({ version: 1, buckets: [{ owner: 'A', value: [{ id: 'claimed' }] }] });
  expect(saved.get('fitness:plans')).toEqual([{ id: 'claimed' }]);
  expect(saved.has('fitness:owned:fitness:trainingDraft')).toBe(false);
  jest.resetModules(); wx.removeStorageSync = remove;
  await require('../utils/cloud-service').restore();
  const local = require('../utils/owner-storage');
  expect(local.claimPreview()).toMatchObject({ plans: 0, drafts: 1 });
  local.claimAnonymous('A');
  expect(saved.has('fitness:plans')).toBe(false);
  expect(saved.has('fitness:trainingDraft')).toBe(false);
  expect(local.getStorageSync('fitness:plans')).toEqual([{ id: 'claimed' }]);
  expect(local.getStorageSync('fitness:trainingDraft')).toEqual({ id: 'not-yet-claimed' });
});

test('旧安装已认领信封与裸副本：全部删除须等裸键清理成功，重启重试保留匿名和外来桶', async () => {
  const { saved } = runtime();
  saved.set('fitness:plans', [{ id: 'obsolete-claimed' }]);
  saved.set('fitness:owned:fitness:plans', { version: 1, buckets: [
    { owner: 'A', value: [{ id: 'obsolete-claimed' }] },
    { owner: 'B', value: [{ id: 'foreign' }] },
    { owner: '', value: [{ id: 'real-anonymous' }] },
  ] });
  saved.set('fitness:trainingDraft', { id: 'unclaimed-raw' }); // no envelope, genuinely anonymous
  const remove = wx.removeStorageSync;
  wx.removeStorageSync = key => { if (key === 'fitness:plans') throw Error('remove failed'); return remove(key); };
  const management = require('../utils/data-management');
  expect(await management.deleteAll()).toMatchObject({ status: 'retry', message: 'remove failed' });
  expect(management.getDeletion()).toMatchObject({ state: 'cloud-confirmed' });
  expect(saved.get('fitness:owned:fitness:plans').buckets).toEqual([
    { owner: 'B', value: [{ id: 'foreign' }] }, { owner: '', value: [{ id: 'real-anonymous' }] },
  ]);
  jest.resetModules(); wx.removeStorageSync = remove;
  expect(await require('../utils/data-management').deleteAll()).toMatchObject({ status: 'deleted' });
  expect(saved.has('fitness:plans')).toBe(false);
  expect(saved.get('fitness:owned:fitness:trainingDraft').buckets).toEqual([{ owner: '', value: { id: 'unclaimed-raw' } }]);
  expect(saved.get('fitness:owned:fitness:plans').buckets).toHaveLength(2);
});

test.each(['get', 'set'])('认领平台 %s 失败不能移除唯一裸值，重试后仍可恢复', async failure => {
  const { saved } = runtime(); saved.set('fitness:plans', [{ id: 'only-copy' }]);
  await require('../utils/cloud-service').enable();
  const method = failure + 'StorageSync', original = wx[method];
  wx[method] = (key, ...args) => {
    if (key === 'fitness:owned:fitness:plans') throw Error('storage failed');
    return original(key, ...args);
  };
  expect(() => require('../utils/owner-storage').claimAnonymous('A')).toThrow('storage failed');
  expect(saved.get('fitness:plans')).toEqual([{ id: 'only-copy' }]);
  expect(saved.has('fitness:owned:fitness:plans')).toBe(false);
  wx[method] = original;
  require('../utils/owner-storage').claimAnonymous('A');
  expect(require('../utils/db').getLocalPlans()).toEqual([{ id: 'only-copy' }]);
  expect(saved.has('fitness:plans')).toBe(false);
});

test.each(['set', 'remove'])('首次 owner %s 将真正匿名裸值保存到匿名桶，不认领也不留裸副本', async action => {
  const { saved } = runtime(); saved.set('fitness:trainingDraft', { id: 'anonymous-draft' });
  await require('../utils/cloud-service').enable();
  const local = require('../utils/owner-storage');
  if (action === 'set') local.setStorageSync('fitness:trainingDraft', { id: 'owner-draft' });
  else local.removeStorageSync('fitness:trainingDraft');
  expect(saved.has('fitness:trainingDraft')).toBe(false);
  expect(local.claimPreview().drafts).toBe(1);
  local.clearPrivate({ owner: 'A' });
  expect(saved.get('fitness:owned:fitness:trainingDraft').buckets).toEqual([{ owner: '', value: { id: 'anonymous-draft' } }]);
});

test('清全部本机裸键移除失败不先丢弃信封归属，重试才清所有身份', () => {
  const { saved } = runtime();
  saved.set('fitness:plans', [{ id: 'old-copy' }]);
  saved.set('fitness:owned:fitness:plans', { version: 1, buckets: [{ owner: 'B', value: [{ id: 'foreign' }] }] });
  const remove = wx.removeStorageSync;
  wx.removeStorageSync = key => { if (key === 'fitness:plans') throw Error('remove failed'); return remove(key); };
  const management = require('../utils/data-management');
  expect(() => management.clearLocal()).toThrow('remove failed');
  expect(saved.get('fitness:owned:fitness:plans').buckets[0].owner).toBe('B');
  wx.removeStorageSync = remove;
  expect(management.clearLocal().status).toBe('local-cleared');
  expect(saved.has('fitness:plans')).toBe(false);
  expect(saved.has('fitness:owned:fitness:plans')).toBe(false);
});
