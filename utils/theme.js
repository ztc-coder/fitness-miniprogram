// 本机手动主题：不订阅业务事件，不改写全局 Page。
// 与 app.json 深色配置逐值一致；小程序 require 只加载 JS，不能 require JSON。
const DARK_NATIVE = {
  navigation: '#08110e', background: '#08110e', backgroundTextStyle: 'light',
  color: '#9aad9f', selectedColor: '#3ee6a0', tabBackground: '#0b1612', borderStyle: 'black',
};
const TAB_NAMES = ['today', 'plan', 'records', 'me'];

const SETTINGS_KEY = 'fitness:settings';

function getTheme() {
  try {
    const settings = wx.getStorageSync(SETTINGS_KEY);
    return settings && settings.theme === 'light' ? 'light' : 'dark';
  } catch (err) {
    return 'dark';
  }
}

function setTheme(next) {
  if (next !== 'dark' && next !== 'light') return false;
  try {
    const settings = wx.getStorageSync(SETTINGS_KEY) || {};
    wx.setStorageSync(SETTINGS_KEY, { ...settings, theme: next });
    return true;
  } catch (err) {
    if (typeof wx.showToast === 'function') wx.showToast({ title: '主题保存失败，请重试', icon: 'none' });
    return false;
  }
}

// 原生调用在非 tab 页/旧基础库可能失败；失败不阻塞页面业务或持久化。
function nativeCall(name, options) {
  if (typeof wx[name] !== 'function') return;
  try { wx[name]({ ...options, fail() {} }); } catch (err) { /* 原生能力边界 */ }
}

function applyTheme(page) {
  const theme = getTheme();
  if (page) page.setData({ theme });
  const light = theme === 'light';
  const backgroundColor = light ? '#F5F6F7' : DARK_NATIVE.background;
  nativeCall('setNavigationBarColor', {
    frontColor: light ? '#000000' : '#ffffff',
    backgroundColor: light ? '#F5F6F7' : DARK_NATIVE.navigation,
  });
  nativeCall('setBackgroundColor', { backgroundColor, backgroundColorTop: backgroundColor, backgroundColorBottom: backgroundColor });
  nativeCall('setBackgroundTextStyle', { textStyle: light ? 'dark' : DARK_NATIVE.backgroundTextStyle });
  nativeCall('setTabBarStyle', {
    color: light ? '#626D76' : DARK_NATIVE.color,
    selectedColor: light ? '#3E5429' : DARK_NATIVE.selectedColor,
    backgroundColor: light ? '#FFFFFF' : DARK_NATIVE.tabBackground,
    borderStyle: light ? 'white' : DARK_NATIVE.borderStyle,
  });
  TAB_NAMES.forEach((name, index) => {
    nativeCall('setTabBarItem', {
      index,
      iconPath: `images/tabbar/${name}${light ? '-light' : ''}.png`,
      selectedIconPath: `images/tabbar/${name}-active${light ? '-light' : ''}.png`,
    });
  });
  return theme;
}

function themePage(definition) {
  const decorated = { ...definition, data: { ...definition.data, theme: 'dark' } };
  ['onLoad', 'onShow'].forEach(hook => {
    decorated[hook] = function (...args) {
      applyTheme(this);
      if (definition[hook]) return definition[hook].apply(this, args);
    };
  });
  return decorated;
}

module.exports = { getTheme, setTheme, applyTheme, themePage };
