const domain = require('../utils/domain');
function environment() {
  const storage = {};
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = JSON.parse(JSON.stringify(value)); },
    removeStorageSync: (key) => { delete storage[key]; },
    getNetworkType: ({ success }) => success({ networkType: 'none' }),
    cloud: { database: () => { throw Error('offline'); } },
  };
  jest.resetModules();
  return { storage, queue: require('../utils/queue'), db: require('../utils/db') };
}
function plan(id = 'p') {
  return { id, cursor: 0, active: true, cycleDays: [0, 1, 2].map(i => ({ dayId: String(i), exercises: [{ exerciseId: '0025', equipment: 'barbell', sets: 1, targetWeight: 20, targetReps: 10 }] })) };
}
function finished(p = plan()) {
  let s = domain.snapshotSession(p);
  s = domain.startTrainingSet(s, s.training.currentSetId, 100);
  return domain.completeTrainingSet(s, s.training.currentSetId, 200);
}
test('local completion resolves without network, survives restart and advances once', async () => {
  const { storage, queue, db } = environment();
  storage['fitness:plans'] = [plan()];
  const s = finished();
  storage['fitness:trainingDraft'] = s;
  wx.getNetworkType = () => {}; // network never settles
  const final = await queue.complete(s, 500);
  expect(final.submittedAt).toBe(500);
  expect(final.training).toBeUndefined();
  jest.resetModules();
  const restarted = require('../utils/queue');
  expect(await restarted.complete(s, 900)).toEqual(final);
  expect(restarted.getCompletedSession(s.id)).toEqual(final);
  expect((await db.fetchPlans())[0].cursor).toBe(1);
  expect(await db.fetchSessions()).toEqual([final]);
});
test('first write failure rejects without destroying draft or advancing', async () => {
  const { storage, queue, db } = environment();
  storage['fitness:plans'] = [plan()];
  const s = finished(); storage['fitness:trainingDraft'] = s;
  wx.setStorageSync = () => { throw Error('full'); };
  await expect(queue.complete(s, 500)).rejects.toThrow('full');
  expect(queue.getCompletedSession(s.id)).toBeNull();
  expect(storage['fitness:trainingDraft']).toBe(s);
  expect((await db.fetchPlans())[0].cursor).toBe(0);
});
test('cleanup failures and concurrent calls preserve canonical history and two distinct advances', async () => {
  const { storage, queue, db } = environment();
  storage['fitness:plans'] = [plan()];
  wx.removeStorageSync = () => { throw Error('full'); };
  const a = finished(); storage['fitness:trainingDraft'] = a;
  const [first, duplicate] = await Promise.all([queue.complete(a, 500), queue.complete(a, 900)]);
  expect(duplicate).toEqual(first);
  const b = finished(); b.id = 'other';
  await queue.complete(b, 600);
  expect((await db.fetchPlans())[0].cursor).toBe(2);
  expect(await db.fetchSessions()).toHaveLength(2);
});
test('gate rejects pending and all-skipped, missing plan completes without inventing a plan', async () => {
  const { queue, db } = environment();
  const pending = domain.snapshotSession(plan());
  await expect(queue.complete(pending, 500)).rejects.toThrow();
  await expect(queue.complete(domain.setExerciseSkipped(pending, 0, true), 500)).rejects.toThrow();
  await queue.complete(finished(), 500);
  expect(await db.fetchPlans()).toEqual([]);
});
test('cloud stable-id retries preserve submitted time, ignore zero ack and retain history after sync', async () => {
  const { queue, db } = environment();
  const s = finished();
  const final = await queue.complete(s, 500);
  let ack = { stats: { created: 0, updated: 0 } };
  const set = jest.fn(() => Promise.resolve(ack));
  const doc = jest.fn(() => ({ set }));
  wx.getNetworkType = ({ success }) => success({ networkType: 'wifi' });
  wx.cloud.database = () => ({ collection: () => ({ doc, orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ data: [] }) }) }) }) });
  await queue.flush();
  expect(queue.getQueue()).toHaveLength(1);
  ack = { stats: { created: 1, updated: 0 } };
  await queue.flush();
  expect(queue.getQueue()).toHaveLength(0);
  expect(doc).toHaveBeenLastCalledWith(s.id);
  expect(set.mock.calls.at(-1)[0].data).toEqual(final);
  expect(await db.fetchSessions()).toEqual([final]);
});
test('offline cursor beats old cloud across fetch and seed migration paths', async () => {
  const { storage, queue, db } = environment();
  storage['fitness:plans'] = [plan()];
  await queue.complete(finished(), 500);
  const get = () => Promise.resolve({ data: [Object.assign({}, plan(), { _id: 'p' })] });
  wx.cloud.database = () => ({ collection: () => ({ orderBy: () => ({ get }) }) });
  expect((await db.fetchPlans())[0].cursor).toBe(1);
  expect((await db.ensureSeedPlans())[0].cursor).toBe(1);
});
test('local plan remapping and ack-write failure retry never duplicate advancement or upload', async () => {
  const { storage, queue, db } = environment();
  const p = plan('local_plan_x'); storage['fitness:plans'] = [p];
  const final = await queue.complete(finished(p), 500);
  await queue.flush();
  const remote = {};
  const set = jest.fn(({ data }) => { remote[data.name || data.id || 'plan'] = data; return Promise.resolve({ stats: { created: 1 } }); });
  const ids = [];
  wx.cloud.database = () => ({ collection: () => ({ doc: id => { ids.push(id); return { set, update: set }; }, orderBy: () => ({ get: () => Promise.resolve({ data: Object.values(remote).filter(d => d.cycleDays) }) }) }) });
  wx.getNetworkType = ({ success }) => success({ networkType: 'wifi' });
  const write = wx.setStorageSync;
  let fail = true;
  wx.setStorageSync = (key, value) => { if (fail) { fail = false; throw Error('ack full'); } write(key, value); };
  await queue.flush();
  expect(queue.getQueue()).toHaveLength(1);
  await queue.flush();
  expect(queue.getQueue()).toHaveLength(0);
  expect(queue.getCompletedSession(final.id)).toEqual(final);
  expect((await db.fetchPlans())[0].cursor).toBe(1);
  const localPlans = db.getLocalPlans();
  expect(localPlans).toHaveLength(1);
  expect(localPlans[0].id).not.toBe(p.id);
  expect(ids.filter(id => id === final.id)).toHaveLength(2);
});
test('seed migration syncs a completed local plan through stable mapping, then retry keeps one plan', async () => {
  const { storage, queue, db } = environment();
  const p = plan('local_plan_seed'); storage['fitness:plans'] = [p];
  await queue.complete(finished(p),500); await queue.flush();
  const remote = new Map();
  wx.cloud.database = () => ({collection: name => ({orderBy: () => ({get: () => Promise.resolve({data: name === 'plans' ? [...remote.values()].filter(d => d.cycleDays) : []})}), doc: id => ({set: ({data}) => {remote.set(id,Object.assign({},data,{_id:id}));return Promise.resolve({stats:{created:1}});}})})});
  const seeded = await db.ensureSeedPlans();
  expect(seeded[0].cursor).toBe(1);
  expect(seeded[0].id).not.toBe(p.id);
  wx.getNetworkType = ({success}) => success({networkType:'wifi'});
  await queue.flush();
  expect((await db.fetchPlans())).toHaveLength(1);
  expect((await db.fetchPlans())[0].cursor).toBe(1);
});
test('legacy queue retries remain compatible and cannot enqueue a completed id again', async () => {
  const { storage, queue } = environment();
  const final = await queue.complete(finished(),500); await queue.flush();
  await queue.push(final);
  expect(queue.getQueue()).toHaveLength(1);
  storage['fitness:pendingQueue'] = [{id:'legacy',exercises:[],startedAt:100}];
  wx.getNetworkType = ({success}) => success({networkType:'wifi'});
  let fail = true;
  wx.cloud.database = () => ({collection: () => ({doc: () => ({set: () => fail ? Promise.reject(Error('network')) : Promise.resolve({stats:{created:1}})})})});
  await queue.flush();
  expect(queue.getQueue()).toHaveLength(2);
  fail = false; await queue.flush();
  expect(queue.getQueue()).toHaveLength(0);
});
test('cloud duplicates cannot replace canonical completion and session uploads strip server/runtime fields', async () => {
  const { queue, db } = environment();
  const s = finished(); s._id = 'server'; s._openid = 'owner'; s.attempts = 3;
  const final = await queue.complete(s,500); await queue.flush();
  const set = jest.fn(() => Promise.resolve({stats:{updated:1,created:0}}));
  wx.cloud.database = () => ({collection: () => ({doc: () => ({set}),orderBy: () => ({limit: () => ({get: () => Promise.resolve({data:[{id:s.id,_id:s.id,submittedAt:999,exercises:[]}]})})})})});
  wx.getNetworkType = ({success}) => success({networkType:'wifi'});
  await queue.flush();
  const uploaded = set.mock.calls[0][0].data;
  expect(uploaded._openid).toBeUndefined(); expect(uploaded._id).toBeUndefined(); expect(uploaded.attempts).toBeUndefined();
  expect(uploaded.submittedAt).toBe(500);
  expect(await db.fetchSessions()).toEqual([final]);
});
test.each(['p', 'local_plan_deleted'])('deleting completed plan %s cancels plan work but retains history across retry', async id => {
  const { storage, queue, db } = environment();
  const p = plan(id); storage['fitness:plans'] = [p];
  const final = await queue.complete(finished(p), 500); await queue.flush();
  await db.deletePlan(id);
  expect(db.getLocalPlans()).toEqual([]);
  const writes = [];
  wx.getNetworkType = ({success}) => success({networkType:'wifi'});
  wx.cloud.database = () => ({collection: name => ({doc: docId => ({set: ({data}) => {writes.push([name,docId]); return Promise.resolve({stats:{created:1}});},remove: () => Promise.resolve({})}), orderBy: () => ({get: () => Promise.resolve({data:[Object.assign({},p,{_id:id})]})})})});
  await queue.flush();
  expect(writes).toEqual([['sessions', final.id]]);
  expect(await db.fetchPlans()).toEqual([]);
  expect(queue.getQueue()).toEqual([]);
  expect(queue.getCompletedSession(final.id)).toEqual(final);
});
test.each(['raw', 'alias'])('deletion during inflight completed plan set by %s id never revives it', async mode => {
  const { storage, queue, db } = environment();
  const p = plan('local_plan_race'); storage['fitness:plans'] = [p];
  const final = await queue.complete(finished(p),500); await queue.flush();
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const remote = new Map(); const removed = [];
  wx.cloud.database = () => ({collection: name => ({doc: id => ({
    set: ({data}) => name === 'plans' ? new Promise(resolve => { release = () => {remote.set(id,data); resolve({stats:{created:1}});}; entered(); }) : Promise.resolve({stats:{created:1}}),
    remove: () => {removed.push(id); remote.delete(id); return Promise.resolve({});},
  }), orderBy: () => ({get: () => Promise.resolve({data:[...remote.values()]})})})});
  wx.getNetworkType = ({success}) => success({networkType:'wifi'});
  const syncing = queue.flush(); await waiting;
  await db.deletePlan(mode === 'raw' ? p.id : 'completed_' + p.id);
  release(); await syncing;
  expect(db.getLocalPlans()).toEqual([]);
  expect(await db.fetchPlans()).toEqual([]);
  expect(removed).toEqual(['completed_' + p.id,'completed_' + p.id]);
  await queue.flush();
  expect(queue.getQueue()).toEqual([]);
  expect(queue.getCompletedSession(final.id)).toEqual(final);
});
test('deletion marker failure reports failure and cache cleanup failure recovers from durable cancellation', async () => {
  const {storage, queue, db} = environment(); storage['fitness:plans'] = [plan()];
  const final = await queue.complete(finished(),500); await queue.flush();
  const write = wx.setStorageSync;
  wx.setStorageSync = () => {throw Error('full');};
  expect(() => db.deletePlan('p')).toThrow('full');
  expect(db.getLocalPlans()).toHaveLength(1);
  wx.setStorageSync = (key,value) => {if (key === 'fitness:plans') throw Error('cache full'); write(key,value);};
  expect(() => db.deletePlan('p')).toThrow('cache full');
  jest.resetModules();
  expect(require('../utils/db').getLocalPlans()).toEqual([]);
  expect(require('../utils/queue').getCompletedSession(final.id)).toEqual(final);
});
test('queue head blocks later work on failure and plan-only retries never upload or advance again', async () => {
  const {storage,queue,db} = environment(); storage['fitness:plans'] = [plan()];
  storage['fitness:pendingQueue'] = [{id:'legacy',exercises:[]}];
  const final = await queue.complete(finished(),500); await queue.flush();
  const writes = []; let failSession = true, failPlan = true;
  wx.cloud.database = () => ({collection: name => ({doc: id => ({set: () => {
    writes.push([name,id]);
    if (id === 'legacy' && failSession || name === 'plans' && failPlan) return Promise.reject(Error('offline'));
    return Promise.resolve({stats:{created:1}});
  }})})});
  await queue.flush(); expect(writes).toEqual([]);
  wx.getNetworkType = ({success}) => success({networkType:'wifi'});
  await queue.flush(); expect(writes).toEqual([['sessions','legacy']]);
  failSession = false; await queue.flush();
  expect(writes.slice(1)).toEqual([['sessions','legacy'],['sessions',final.id],['plans','p']]);
  failPlan = false; await queue.flush();
  expect(writes.at(-1)).toEqual(['plans','p']);
  expect(writes.filter(([name,id]) => name === 'sessions' && id === final.id)).toHaveLength(1);
  expect(db.getLocalPlans()[0].cursor).toBe(1);
  expect(queue.getQueue()).toEqual([]);
});
test('original local save callback cannot resurrect a plan deleted after completion', async () => {
  const {storage,queue,db} = environment(); const p = plan('local_plan_save');
  let release;
  const removed = [];
  wx.cloud.database = () => ({collection: () => ({add: () => new Promise(resolve => {release = resolve;}),doc: id => ({remove: () => {removed.push(id);return Promise.resolve({});}})})});
  const saving = db.savePlan(p);
  const final = await queue.complete(finished(p),500); await queue.flush();
  await db.deletePlan(p.id);
  release({_id:'cloud_saved'}); await saving;
  expect(db.getLocalPlans()).toEqual([]);
  expect(removed).toEqual(['cloud_saved']);
  expect(queue.getCompletedSession(final.id)).toEqual(final);
});
