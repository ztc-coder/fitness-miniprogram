/**
 * 提交队列执行器
 * domain.decideSubmission 只做纯判定;这里注入真实网络请求,
 * 负责「训练结束提交那一刻联网,无网自动排队重试」。
 */
const domain = require('./domain');
const db = require('./db');

const QUEUE_KEY = 'fitness:pendingQueue';
const RETRY_DELAY_MS = 15000;

let flushing = false;

function getQueue() {
  return wx.getStorageSync(QUEUE_KEY) || [];
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
  const queue = domain.enqueueSession(getQueue(), session);
  saveQueue(queue);
  return flush();
}

/**
 * 冲刷队列:按 domain 判定逐个提交,失败标记 attempts 等待下轮重试。
 */
function flush() {
  if (flushing) {
    return Promise.resolve(getQueue());
  }
  flushing = true;
  return isOnline()
    .then((online) => {
      const step = () => {
        const queue = getQueue();
        const decision = domain.decideSubmission(queue, online);
        if (decision.action === 'idle' || decision.action === 'queued') {
          flushing = false;
          return queue;
        }
        const target = queue.find((s) => s.id === decision.sessionId);
        return db
          .submitSession(target)
          .then(() => {
            saveQueue(domain.dequeueSession(getQueue(), target.id));
            return step();
          })
          .catch((err) => {
            console.warn('session 提交失败,进入重试队列', err);
            saveQueue(domain.markAttemptFailed(getQueue(), target.id));
            flushing = false;
            return getQueue();
          });
      };
      return step();
    })
    .catch(() => {
      flushing = false;
      return getQueue();
    });
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
  push,
  flush,
  getQueue,
  watchNetwork,
};
