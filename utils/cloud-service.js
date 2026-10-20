/** 产品同意独立于平台隐私授权；旧 openid/离线设置不能替代同意。 */
const cloudEnv = require('../config/cloud-env');
const { getCloudIssues, text } = require('./cloud-env');

const KEY = 'fitness:cloudConsent';
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
function invalidate() {
  epoch += 1;
  changed();
}
/** 当前编译出的 AppID：未配置/旧基础库/游客模式都拿不到可信值时返回空串。 */
function detectedAppId() {
  try {
    const info = typeof wx.getAccountInfoSync === 'function' ? wx.getAccountInfoSync() : null;
    return text(info && info.miniProgram && info.miniProgram.appId);
  } catch (err) {
    return '';
  }
}
/** 部署配置阻断项；非空表示不允许启云（见 config/cloud-env.js）。 */
function configIssues() { return getCloudIssues(cloudEnv, { appId: detectedAppId() }); }
function configured() { return configIssues().length === 0; }
function assertConfigured() {
  const issues = configIssues();
  if (issues.length) throw new Error('云能力未配置，已禁用：' + issues.join('；'));
}
function disable() {
  consent = false;
  status = 'local';
  starting = null;
  invalidate();
  wx.setStorageSync(KEY, false);
}
function initialize() {
  if (!wx.cloud) throw new Error('当前微信版本不支持云服务');
  // 硬校验在 init 之前：未配置自己的环境时绝不初始化云，避免连到原运营者环境。
  assertConfigured();
  if (!initialized) { wx.cloud.init({ env: text(cloudEnv.envId), traceUser: false }); initialized = true; }
}
/** Purpose-specific authorization: never sets product consent or starts queue/media service. */
async function authorizeDeletion() {
  disable();
  const version = epoch;
  initialize();
  const res = await wx.cloud.callFunction({ name: 'login' });
  if (version !== epoch || consent) throw new Error('删除授权已失效，请重新确认');
  const id = res.result && res.result.openid;
  if (typeof id !== 'string' || !id.trim()) throw new Error('未取得可信微信身份');
  owner = id;
  changed();
  return snapshot();
}
async function enable() {
  const issues = configIssues();
  if (issues.length) {
    // 未配置自己的云环境：不写同意、不初始化云，保持与"未同意"一致的本地能力。
    consent = false;
    status = 'local';
    starting = null;
    changed();
    throw new Error('云能力未配置，保持本地模式：' + issues.join('；'));
  }
  wx.setStorageSync(KEY, true);
  consent = true;
  if (ready()) return snapshot();
  if (starting) return starting;
  const version = ++epoch;
  status = 'connecting';
  changed();
  starting = (async () => {
    try {
      initialize();
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
  if (!configured()) {
    // 启动即拦截：不读旧同意、不初始化云；本地训练照常可用。
    consent = false;
    status = 'local';
    return Promise.resolve(snapshot());
  }
  try { consent = wx.getStorageSync(KEY) === true; } catch (err) { consent = false; }
  return consented() ? enable() : Promise.resolve(snapshot());
}
module.exports = {
  subscribe,
  ready,
  snapshot,
  assertCurrent,
  enable,
  disable,
  restore,
  invalidate,
  authorizeDeletion,
  configured,
  configIssues,
};
