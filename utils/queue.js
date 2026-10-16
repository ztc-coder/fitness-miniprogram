/**
 * 提交队列执行器
 * 本地完成日志先成立;这里注入真实网络请求,无网自动排队重试。
 */
const domain = require('./domain');
const db = require('./db');
const log = require('./training-log');

const QUEUE_KEY = 'fitness:pendingQueue';
const RETRY_DELAY_MS = 15000;

let flushing = null;

function getQueue() {
  const legacy = wx.getStorageSync(QUEUE_KEY) || [];
  return legacy.filter(s => !log.read().some(e => e.session.id === s.id))
    .concat(log.read().filter(e => !e.sessionSynced || !e.planSynced).map(e => e.session));
}

function saveQueue(queue) {
  wx.setStorageSync(QUEUE_KEY, queue);
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
  const queue = domain.enqueueSession(wx.getStorageSync(QUEUE_KEY) || [], session);
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
      plan: plan ? domain.advanceCursor(plan, true) : null,
      sessionSynced: false,
      planSynced: !plan,
    }]));
    // All subsequent writes are repairable; the log already establishes completion.
    try {
      const draft = wx.getStorageSync('fitness:trainingDraft');
      if (draft && draft.id === final.id) wx.removeStorageSync('fitness:trainingDraft');
    } catch (err) { /* residual draft */ }
    Promise.resolve().then(flush).catch(() => {});
    return Promise.resolve(final);
  } catch (err) { return Promise.reject(err); }
}

function flush() {
  if (flushing) return flushing;
  flushing = Promise.resolve().then(isOnline).then(async online => {
    while (true) {
      const pending = getQueue();
      const decision = domain.decideSubmission(pending, online);
      if (decision.action === 'idle' || decision.action === 'queued') break;
      const target = pending.find(session => session.id === decision.sessionId);
      const entry = log.read().find(e => e.session.id === target.id);
      try {
        if (!entry || !entry.sessionSynced) {
          await db.submitSession(target);
          if (entry) log.update(target.id, { sessionSynced: true });
          else saveQueue(domain.dequeueSession(wx.getStorageSync(QUEUE_KEY) || [], target.id));
        }
        if (entry && !entry.planSynced && !log.isPlanDeleted(entry.plan.id)) {
          await db.syncCompletedPlan(entry.plan);
          log.update(target.id, { planSynced: true });
        }
      } catch (err) {
        console.warn('session 提交失败,进入重试队列', err);
        if (!entry) {
          try { saveQueue(domain.markAttemptFailed(wx.getStorageSync(QUEUE_KEY) || [], target.id)); } catch (writeError) { /* retry original */ }
        }
        break;
      }
    }
    return getQueue();
  }).catch(() => getQueue()).finally(() => { flushing = null; });
  return flushing;
}

/**
 * 监听网络恢复,自动重试队列。
 */
function watchNetwork() {
  wx.onNetworkStatusChange((res) => {
    if (res.isConnected) {
      setTimeout(flush, 500);
    }
  });
  // 兜底定时重试,覆盖网络监听漏报场景
  setInterval(flush, RETRY_DELAY_MS * 4);
}

module.exports = {
  complete,
  getCompletedSession,
  push,
  flush,
  getQueue,
  watchNetwork,
};
