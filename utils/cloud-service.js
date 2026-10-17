/** 产品同意独立于平台隐私授权；旧 openid/离线设置不能替代同意。 */
const KEY = 'fitness:cloudConsent';
const ENV_ID = 'cloud1-d2ga0mned4bbf9b29';
let owner = '';
let consent = false;
let epoch = 0;
let status = 'local';
let starting = null;
let initialized = false;
const listeners = new Set();
function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function changed() { listeners.forEach(listener => listener()); }
function consented() { return consent; }
function ready() { return consented() && status === 'ready' && !!owner; }
function snapshot() { return { owner, epoch, status, consent: consented() }; }
function assertCurrent(token) {
  if (token.epoch !== epoch || token.owner !== owner) throw new Error('身份或云服务状态已改变，请重新打开页面');
}
function disable() {
  wx.setStorageSync(KEY, false);
  consent = false;
  epoch += 1;
  status = 'local';
  changed();
  starting = null;
}
async function enable() {
  wx.setStorageSync(KEY, true);
  consent = true;
  if (ready()) return snapshot();
  if (starting) return starting;
  const version = ++epoch;
  status = 'connecting';
  changed();
  starting = (async () => {
    try {
      if (!wx.cloud) throw new Error('当前微信版本不支持云服务');
      if (!initialized) { wx.cloud.init({ env: ENV_ID, traceUser: false }); initialized = true; }
      const res = await wx.cloud.callFunction({ name: 'login' });
      if (version !== epoch || !consented()) throw new Error('云服务已停用');
      const id = res.result && res.result.openid;
      if (typeof id !== 'string' || !id.trim()) throw new Error('未取得可信微信身份');
      owner = id;
      status = 'ready';
      changed();
      require('./queue').watchNetwork();
      return snapshot();
    } catch (err) {
      if (version === epoch) { owner = ''; status = 'failed'; changed(); }
      throw err;
    } finally { if (version === epoch) starting = null; }
  })();
  return starting;
}
function restore() {
  try { consent = wx.getStorageSync(KEY) === true; } catch (err) { consent = false; }
  return consented() ? enable() : Promise.resolve(snapshot());
}
module.exports = { subscribe, ready, snapshot, assertCurrent, enable, disable, restore };
