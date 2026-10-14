/** 单键同步写是本地完成提交点;云成功后也保留历史。 */
const KEY = 'fitness:completedTraining';
function read() { return wx.getStorageSync(KEY) || []; }
function write(entries) { wx.setStorageSync(KEY, entries); }
function update(id, changes) {
  write(read().map(entry => entry.session.id === id ? Object.assign({}, entry, changes) : entry));
}
function resolvePlanId(id) {
  const entry = read().find(item => item.plan && item.plan.id === id && item.cloudPlanId);
  return entry ? entry.cloudPlanId : id;
}
function overlayPlans(plans) {
  const result = plans.slice();
  read().forEach(entry => {
    if (!entry.plan || entry.planSynced) return;
    const id = resolvePlanId(entry.plan.id);
    const index = result.findIndex(p => p.id === id || p.id === entry.plan.id);
    if (index < 0) result.push(Object.assign({}, entry.plan, { id }));
    else result[index] = Object.assign({}, result[index], { id, cursor: entry.plan.cursor });
  });
  return result;
}
module.exports = { read, write, update, resolvePlanId, overlayPlans };
