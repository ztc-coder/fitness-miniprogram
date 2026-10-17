/** 每个私人存储键的单次写入信封；旧裸值仅属于匿名区，绝不推断为旧 openid。 */
const service = require('./cloud-service');
const KEYS = ['fitness:plans', 'fitness:trainingDraft', 'fitness:pendingQueue',
  'fitness:completedTraining', 'fitness:seedVersion', 'fitness:planMigrationVersion',
  'fitness:planMigrationCloudSynced'];
function envelope(key) {
  const saved = wx.getStorageSync('fitness:owned:' + key);
  if (saved && saved.version === 1 && Array.isArray(saved.buckets)) return saved;
  const legacy = wx.getStorageSync(key);
  return { version: 1, buckets: legacy === undefined || legacy === '' ? [] : [{ owner: '', value: legacy }] };
}
function readOwner(key, owner) {
  const bucket = envelope(key).buckets.find(b => b.owner === owner);
  return bucket && bucket.value;
}
function getStorageSync(key) { return readOwner(key, service.snapshot().owner); }
function setStorageSync(key, value) {
  const owner = service.snapshot().owner;
  if (!owner && !wx.getStorageSync('fitness:owned:' + key)) {
    wx.setStorageSync(key, value);
    return;
  }
  const saved = envelope(key);
  saved.buckets = saved.buckets.filter(b => b.owner !== owner).concat([{ owner, value }]);
  wx.setStorageSync('fitness:owned:' + key, saved);
}
function removeStorageSync(key) {
  if (!service.snapshot().owner && !wx.getStorageSync('fitness:owned:' + key)) return wx.removeStorageSync(key);
  const saved = envelope(key);
  saved.buckets = saved.buckets.filter(b => b.owner !== service.snapshot().owner);
  wx.setStorageSync('fitness:owned:' + key, saved);
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
  // 不覆盖此身份已有数据。页面应在首次云读取/上传前询问。
  for (const key of KEYS.slice(0, 4)) {
    if (readOwner(key, owner) !== undefined && readOwner(key, '') !== undefined) throw new Error('当前身份已有本地数据，不能覆盖认领');
  }
  for (const key of KEYS) {
    const saved = envelope(key);
    if (saved.buckets.some(b => b.owner === owner)) {
      saved.buckets = saved.buckets.filter(b => b.owner !== '');
    } else {
      saved.buckets = saved.buckets.map(b => b.owner === '' ? { owner, value: b.value } : b);
    }
    wx.setStorageSync('fitness:owned:' + key, saved);
  }
}
module.exports = { getStorageSync, setStorageSync, removeStorageSync, claimPreview, claimAnonymous };
