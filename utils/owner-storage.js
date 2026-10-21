/** 每个私人存储键的单次写入信封；旧裸值仅属于匿名区，绝不推断为旧 openid。 */
const service = require('./cloud-service');
const KEYS = ['fitness:plans', 'fitness:trainingDraft', 'fitness:pendingQueue',
  'fitness:completedTraining', 'fitness:seedVersion', 'fitness:planMigrationVersion',
  'fitness:planMigrationCloudSynced', 'fitness:planSync', 'fitness:syncGeneration', 'fitness:syncBarrier', 'fitness:deletionOperation'];
let revision = 0;
function version() { return revision; }
function envelope(key) {
  const saved = wx.getStorageSync('fitness:owned:' + key);
  if (saved && saved.version === 1 && Array.isArray(saved.buckets)) return JSON.parse(JSON.stringify(saved));
  const legacy = wx.getStorageSync(key);
  return { version: 1, buckets: legacy === undefined || legacy === '' ? [] : [{ owner: '', value: legacy }] };
}
// A durable envelope is authoritative, including any still-unclaimed anonymous bucket.
// Keep it even when empty: it also proves a remaining bare key is an obsolete backup.
// If removal fails, propagate the error; retry/restart can repair from this same envelope.
function persistEnvelope(key, saved) {
  wx.setStorageSync('fitness:owned:' + key, saved);
  wx.removeStorageSync(key);
}
function readOwner(key, owner) {
  const bucket = envelope(key).buckets.find(b => b.owner === owner);
  return bucket && bucket.value;
}
function getStorageSync(key) { return readOwner(key, service.snapshot().owner); }
function setStorageSync(key, value) {
  if (key !== 'fitness:deletionOperation') revision++;
  const owner = service.snapshot().owner;
  if (!owner && !wx.getStorageSync('fitness:owned:' + key)) {
    wx.setStorageSync(key, value);
    return;
  }
  const saved = envelope(key);
  saved.buckets = saved.buckets.filter(b => b.owner !== owner).concat([{ owner, value }]);
  persistEnvelope(key, saved);
}
function removeStorageSync(key) {
  if (key !== 'fitness:deletionOperation') revision++;
  if (!service.snapshot().owner && !wx.getStorageSync('fitness:owned:' + key)) return wx.removeStorageSync(key);
  const saved = envelope(key);
  saved.buckets = saved.buckets.filter(b => b.owner !== service.snapshot().owner);
  persistEnvelope(key, saved);
}
function claimPreview() {
  const entries = readOwner('fitness:completedTraining', '') || [];
  const ids = new Set(entries.map(e => e.session.id));
  (readOwner('fitness:pendingQueue', '') || []).forEach(s => ids.add(s.id));
  return { owner: service.snapshot().owner, plans: (readOwner('fitness:plans', '') || []).length,
    sessions: ids.size, drafts: readOwner('fitness:trainingDraft', '') ? 1 : 0 };
}
function claimAnonymous(owner) {
  if (!service.ready() || owner !== service.snapshot().owner) throw new Error('认领身份已改变');
  const currentGeneration = readOwner('fitness:syncGeneration', owner) || 0;
  const anonymousGeneration = readOwner('fitness:syncGeneration', '') || 0;
  if (currentGeneration !== anonymousGeneration && ['fitness:plans', 'fitness:trainingDraft', 'fitness:pendingQueue', 'fitness:completedTraining', 'fitness:planSync']
    .some(key => readOwner(key, '') !== undefined)) throw new Error('匿名数据属于旧代际，不能认领到删除后的新代际；请保留本地或明确清本机后新建');
  const protectedKeys = ['fitness:syncGeneration', 'fitness:syncBarrier', 'fitness:deletionOperation'];
  if (readOwner('fitness:deletionOperation', owner)) throw new Error('有未完成的删除，请到数据管理继续');
  if (readOwner('fitness:syncBarrier', owner)) throw new Error('删除后的本机数据需确认，请到数据管理查看');
  function empty(key, value) {
    if (value === undefined || value === null) return true;
    if (['fitness:plans', 'fitness:pendingQueue', 'fitness:completedTraining'].includes(key)) return Array.isArray(value) && !value.length;
    if (key === 'fitness:planSync') return Object.keys(value).every(k => ['tasks', 'deleted', 'completed'].includes(k) && Array.isArray(value[k]) && !value[k].length);
    return false;
  }
  const keys = KEYS.filter(key => !protectedKeys.includes(key));
  // Preflight every key before writing. Only empty/equivalent fields can coexist;
  // distinct business data (including task/tombstone state) requires future merge support.
  for (const key of keys.filter(key => !key.includes('Version') && key !== 'fitness:planMigrationCloudSynced')) {
    const own = readOwner(key, owner), anonymous = readOwner(key, '');
    if (!empty(key, own) && !empty(key, anonymous) && JSON.stringify(own) !== JSON.stringify(anonymous)) {
      throw new Error('当前微信已有记录，不能直接加入；两份记录均已保留');
    }
  }
  revision++;
  for (const key of keys) {
    const saved = envelope(key);
    const own = readOwner(key, owner), anonymous = readOwner(key, '');
    if (own !== undefined && (!empty(key, own) || empty(key, anonymous))) {
      saved.buckets = saved.buckets.filter(b => b.owner !== '');
    } else {
      saved.buckets = saved.buckets.filter(b => b.owner !== owner).map(b => b.owner === '' ? { owner, value: b.value } : b);
    }
    persistEnvelope(key, saved);
  }
}
function clearPrivate({ all = false, owner = service.snapshot().owner, keepOperation = false } = {}) {
  revision++;
  for (const key of KEYS) {
    if (keepOperation && key === 'fitness:deletionOperation') continue;
    if (all) {
      wx.removeStorageSync(key);
      wx.removeStorageSync('fitness:owned:' + key);
    } else {
      const saved = envelope(key);
      saved.buckets = saved.buckets.filter(b => b.owner !== owner);
      persistEnvelope(key, saved);
    }
  }
}
function lossPreview(all = false) {
  const owners = all ? new Set(KEYS.flatMap(key => envelope(key).buckets.map(b => b.owner))) : new Set([service.snapshot().owner]);
  const result = { plans: 0, drafts: 0, pending: 0 };
  owners.forEach(owner => {
    const plans = readOwner('fitness:plans', owner) || [];
    const state = readOwner('fitness:planSync', owner) || { tasks: [], deleted: [], completed: [] };
    const entries = readOwner('fitness:completedTraining', owner) || [];
    // Completed logs supersede legacy queue entries, just as queue.getQueue does.
    const sessions = new Set((readOwner('fitness:pendingQueue', owner) || [])
      .filter(s => !entries.some(e => e.session.id === s.id)).map(s => s.id));
    entries.filter(e => !e.sessionSynced).forEach(e => sessions.add(e.session.id));
    result.plans += plans.length;
    result.drafts += readOwner('fitness:trainingDraft', owner) ? 1 : 0;
    result.pending += sessions.size + state.tasks.length + plans.filter(p => p.revision === undefined &&
      !state.tasks.some(t => t.id === p.id) && !(state.deleted || []).includes(p.id)).length;
    result.pending += entries.filter(e => e.plan && !e.planSynced && !e.planDeleted && !e.planQueued &&
      !state.tasks.some(t => t.key === 'completion_' + e.session.id) && !(state.completed || []).includes('completion_' + e.session.id)).length;
  });
  return result;
}
module.exports = { getStorageSync, setStorageSync, removeStorageSync, claimPreview, claimAnonymous, clearPrivate, lossPreview, version };
