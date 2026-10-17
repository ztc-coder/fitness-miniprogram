const storage = require('./owner-storage');
const domain = require('./domain');
const KEY = 'fitness:planSync';
function read() { return JSON.parse(JSON.stringify(storage.getStorageSync(KEY) || { tasks: [], deleted: [], completed: [] })); }
function write(state) { storage.setStorageSync(KEY, state); }
function enqueue(plan, action = 'set', key) {
  const state = read();
  if (key && (state.completed.includes(key) || state.tasks.some(t => t.key === key))) return;
  const previous = state.tasks.filter(t => t.id === plan.id).slice(-1)[0];
  const expectedRevision = previous ? previous.data.revision : (plan.revision || 0);
  const data = Object.assign({}, plan, { revision: expectedRevision + 1 });
  const storedGeneration = storage.getStorageSync('fitness:syncGeneration');
  const generation = Number.isSafeInteger(storedGeneration) ? storedGeneration : 0;
  state.tasks.push({ generation, id: plan.id, action, data, expectedRevision, key: key || domain.generateId('plan_op'), attempts: 0 });
  if (action === 'remove' && !state.deleted.includes(plan.id)) state.deleted.push(plan.id);
  write(state);
  return data;
}
function overlay(plans) {
  const state = read();
  const result = new Map(plans.filter(p => !state.deleted.includes(p.id)).map(p => [p.id, p]));
  state.tasks.forEach(t => { if (!state.deleted.includes(t.id)) result.set(t.id, t.data); });
  return [...result.values()];
}
function acknowledge(key) {
  const state = read();
  state.tasks = state.tasks.filter(t => t.key !== key);
  if (!state.completed.includes(key)) state.completed.push(key);
  write(state);
}
function failed(key, err) {
  const state = read();
  state.tasks = state.tasks.map(t => t.key === key ? Object.assign({}, t, {
    attempts: t.attempts + 1, lastAttemptAt: Date.now(), error: err.message,
  }) : t);
  write(state);
}
module.exports = { read, write, enqueue, overlay, acknowledge, failed };
