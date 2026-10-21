const storage = require('./owner-storage');
/**
 * 提交队列执行器
 * 本地完成日志先成立;这里注入真实网络请求,无网自动排队重试。
 */
const domain = require('./domain');
const db = require('./db');
const log = require('./training-log');
const service = require('./cloud-service');
const operations = require('./plan-operations');

const QUEUE_KEY = 'fitness:pendingQueue';
const RETRY_DELAY_MS = 15000;

const feedback = require('./sync-feedback');
let latestFailure = null;
function remember(token, err) { service.assertCurrent(token); latestFailure = { ...token, reason: feedback.reason(err) }; }
let flushing = null;
let flushingToken = null;

function getQueue() {
  const legacy = storage.getStorageSync(QUEUE_KEY) || [];
  return legacy.filter(s => !log.read().some(e => e.session.id === s.id))
    .concat(log.read().filter(e => !e.sessionSynced || !e.planSynced).map(e => e.session));
}

function saveQueue(queue) {
  storage.setStorageSync(QUEUE_KEY, queue);
}

function isOnline() {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: (res) => resolve(res.networkType !== 'none'),
      fail: () => resolve(true), // 拿不到状态时按有网尝试,失败会自然进重试
    });
  });
}

/**
 * 训练结束时调用:先入队(本地记录立即成立),再按网络状态决定提交/等待。
 */
function push(session) {
  if (getCompletedSession(session.id)) return flush();
  const queued = Object.assign({}, session, { syncGeneration: storage.getStorageSync('fitness:syncGeneration') || 0 });
  const queue = domain.enqueueSession(storage.getStorageSync(QUEUE_KEY) || [], queued);
  saveQueue(queue);
  return flush();
}

/**
 * 同步查询已完成快照,供残留草稿恢复。
 */
function getCompletedSession(id) {
  const entry = log.read().find(e => e.session.id === id);
  return entry ? entry.session : null;
}

function complete(session, now = Date.now()) {
  try {
    const existing = getCompletedSession(session.id);
    if (existing) return Promise.resolve(existing);
    const final = domain.finalizeTrainingSession(session, now);
    if (!final) return Promise.reject(new Error('训练尚未完成'));
    const plan = db.getLocalPlans().find(p => p.id === log.resolvePlanId(session.planId));
    log.write(log.read().concat([{
      session: final,
      generation: storage.getStorageSync('fitness:syncGeneration') || 0,
      plan: plan ? domain.advanceCursor(plan, true) : null,
      sessionSynced: false,
      planSynced: !plan,
    }]));
    try { db.getLocalPlans(); } catch (err) { /* completion log repairs staging after restart */ }
    // All subsequent writes are repairable; the log already establishes completion.
    try {
      const draft = storage.getStorageSync('fitness:trainingDraft');
      if (draft && draft.id === final.id) storage.removeStorageSync('fitness:trainingDraft');
    } catch (err) { /* residual draft */ }
    Promise.resolve().then(flush).catch(() => {});
    return Promise.resolve(final);
  } catch (err) { return Promise.reject(err); }
}

function flush() {
  if (!service.ready()) return Promise.resolve(getQueue());
  if (flushing && flushingToken.epoch === service.snapshot().epoch) return flushing;
  const token = service.snapshot();
  flushingToken = token;
  const flight = Promise.resolve().then(() => { service.assertCurrent(token); return isOnline(); }).then(async online => {
    if (online) await require('./personal-cloud').generation();
    service.assertCurrent(token);
    db.preparePlanTasks();
    let blocked = false;
    while (true) {
      service.assertCurrent(token);
      if (!service.ready()) break;
      const pending = getQueue();
      const decision = domain.decideSubmission(pending, online);
      if (decision.action === 'idle' || decision.action === 'queued') break;
      const target = pending.find(session => session.id === decision.sessionId);
      const entry = log.read().find(e => e.session.id === target.id);
      try {
        if (!entry || !entry.sessionSynced) {
          await db.submitSession(target, entry ? (entry.generation || 0) : (target.syncGeneration || 0));
          service.assertCurrent(token);
          if (entry) log.update(target.id, { sessionSynced: true });
          else saveQueue(domain.dequeueSession(storage.getStorageSync(QUEUE_KEY) || [], target.id));
        }
        if (entry && !entry.planSynced && !log.isPlanDeleted(entry.plan.id)) {
          await db.syncCompletedPlan(entry.plan);
          service.assertCurrent(token);
          log.update(target.id, { planSynced: true });
        }
      } catch (err) {
        service.assertCurrent(token);
        remember(token, err);
        if (entry) log.update(target.id, { attempts: (entry.attempts || 0) + 1, lastAttemptAt: Date.now(), error: err.message });
        if (!entry) {
          try { saveQueue(domain.markAttemptFailed(storage.getStorageSync(QUEUE_KEY) || [], target.id)); } catch (writeError) { /* retry original */ }
        }
        blocked = true;
        break;
      }
    }
    service.assertCurrent(token);
    if (!blocked && online && service.ready()) {
      try { await db.flushPlanTasks(); } catch (err) { remember(token, err); }
    }
    service.assertCurrent(token);
    if (online && !getQueue().length && !operations.read().tasks.length) latestFailure = null;
    return getQueue();
  }).catch(err => { remember(token, err); return getQueue(); }).finally(() => {
    if (flushing === flight) { flushing = null; flushingToken = null; }
  });
  flushing = flight;
  return flight;
}

/**
 * 监听网络恢复,自动重试队列。
 */
let watching = false;
function watchNetwork() {
  if (watching || !service.ready() || typeof wx.onNetworkStatusChange !== 'function') return;
  watching = true;
  wx.onNetworkStatusChange((res) => {
    if (res.isConnected) {
      setTimeout(() => flush().catch(() => {}), 500);
    }
  });
  setTimeout(() => flush().catch(() => {}), 0);
  // 兜底定时重试,覆盖网络监听漏报场景
  setInterval(() => flush().catch(() => {}), RETRY_DELAY_MS * 4);
}

module.exports = {
  complete,
  getCompletedSession,
  push,
  flush,
  getQueue,
  watchNetwork,
  getStatus,
};

function getStatus() {
  db.getLocalPlans(); // repair durable completion tasks after interrupted local writes
  const tasks = operations.read().tasks;
  const plans = tasks.concat(db.getLocalPlans().filter(p => p.revision === undefined && !tasks.some(t => t.id === p.id)));
  const sessions = getQueue().filter(s => { const e = log.read().find(e => e.session.id === s.id); return !e || !e.sessionSynced; });
  const token = service.snapshot();
  const syncing = flushing && flushingToken && flushingToken.owner === token.owner && flushingToken.epoch === token.epoch;
  function status(tasks) {
    return { pending: tasks.length, state: !service.ready() ? '仅本地' :
      syncing ? '同步中' : tasks.length ? '待同步 / 失败' : '已同步',
      details: tasks.map(t => ({ id: t.id, attempts: t.attempts || 0, error: t.error || '', lastAttemptAt: t.lastAttemptAt || 0 })) };
  }
  const failure = latestFailure && latestFailure.owner === token.owner && latestFailure.epoch === token.epoch ? latestFailure.reason : '';
  return { reason: failure, plans: status(plans), sessions: status(sessions.map(s => {
    const entry = log.read().find(e => e.session.id === s.id);
    return Object.assign({}, s, entry && { attempts: entry.attempts, error: entry.error, lastAttemptAt: entry.lastAttemptAt });
  })) };
}
