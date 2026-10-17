const storage = require('./owner-storage');
/** 单键同步写是本地完成提交点;云成功后也保留历史。 */
const KEY = 'fitness:completedTraining';
function read() { return storage.getStorageSync(KEY) || []; }
function write(entries) { storage.setStorageSync(KEY, entries); }
function update(id, changes) {
  write(read().map(entry => entry.session.id === id ? Object.assign({}, entry, changes) : entry));
}
function resolvePlanId(id) {
  const entry = read().find(item => item.plan && item.plan.id === id && item.cloudPlanId);
  return entry ? entry.cloudPlanId : id;
}
function isPlanDeleted(id) {
  const resolved = resolvePlanId(id);
  return read().some(entry => entry.planDeleted && entry.plan &&
    (entry.plan.id === id || entry.cloudPlanId === id || resolvePlanId(entry.plan.id) === resolved));
}
function deletePlan(id) {
  const resolved = resolvePlanId(id);
  const entries = read();
  if (entries.some(entry => entry.plan && (entry.plan.id === id || resolvePlanId(entry.plan.id) === resolved))) {
    write(entries.map(entry => entry.plan && (entry.plan.id === id || resolvePlanId(entry.plan.id) === resolved)
      ? Object.assign({}, entry, { planDeleted: true, planSynced: true }) : entry));
  }
}
function overlayPlans(plans) {
  const result = plans.filter(plan => !isPlanDeleted(plan.id));
  read().forEach(entry => {
    if (!entry.plan || entry.planSynced || isPlanDeleted(entry.plan.id)) return;
    const id = resolvePlanId(entry.plan.id);
    const index = result.findIndex(p => p.id === id || p.id === entry.plan.id);
    if (index < 0) result.push(Object.assign({}, entry.plan, { id }));
    else result[index] = Object.assign({}, result[index], { id, cursor: entry.plan.cursor });
  });
  return result;
}
module.exports = { read, write, update, resolvePlanId, isPlanDeleted, deletePlan, overlayPlans };
