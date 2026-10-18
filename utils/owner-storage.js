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
  // 不覆盖此身份已有数据。页面应在首次云读取/上传前询问。
  for (const key of KEYS.filter(key => !key.includes('Version'))) {
    if (readOwner(key, owner) !== undefined && readOwner(key, '') !== undefined) throw new Error('当前身份已有本地数据，不能覆盖认领');
  }
  revision++; // claiming changes the scope of any outstanding destructive confirmation
  for (const key of KEYS) {
    const saved = envelope(key);
    if (saved.buckets.some(b => b.owner === owner)) {
      saved.buckets = saved.buckets.filter(b => b.owner !== '');
    } else {
      saved.buckets = saved.buckets.map(b => b.owner === '' ? { owner, value: b.value } : b);
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
