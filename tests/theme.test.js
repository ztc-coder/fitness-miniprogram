function mount(definition) {
  return Object.assign({}, definition, {
    data: { ...definition.data },
    setData(patch) { Object.assign(this.data, patch); },
  });
}

let storage;
function loadPage(path) {
  let definition;
  global.Page = value => { definition = value; };
  require(path);
  return mount(definition);
}
beforeEach(() => {
  jest.resetModules();
  storage = {};
  global.wx = {
    getStorageSync: key => storage[key],
    setStorageSync: jest.fn((key, value) => { storage[key] = value; }),
    showToast: jest.fn(), showModal: jest.fn(),
    getNetworkType: jest.fn(({ success }) => success({ networkType: 'none' })),
    cloud: { database: () => { throw Error('offline'); } },
  };
  global.getApp = () => ({ globalData: {} });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  delete global.wx;
  delete global.Page;
  delete global.getApp;
});

test('我的无偏好默认深色，显示不写入设置', async () => {
  const page = loadPage('../pages/me/me');
  expect(page.data.theme).toBe('dark');
  await page.onShow();
  expect(page.data.theme).toBe('dark');
  expect(wx.setStorageSync).not.toHaveBeenCalled();
});

test('开关立即双向切换，合并已有偏好；重载和离线设置保留主题及业务存储', async () => {
  storage['fitness:settings'] = { unit: 'lb', offlineMode: false };
  storage['fitness:trainingDraft'] = { id: 'draft' };
  storage['fitness:plans'] = [{ id: 'plan', cursor: 2 }];
  storage['fitness:pendingQueue'] = [];
  const before = JSON.stringify(storage);
  const page = loadPage('../pages/me/me');
  await page.onShow();
  page.onToggleTheme({ detail: { value: true } });
  expect(page.data.theme).toBe('light');
  expect(wx.getNetworkType).toHaveBeenCalledTimes(1);
  expect(storage['fitness:settings']).toEqual({ unit: 'lb', offlineMode: false, theme: 'light' });
  jest.resetModules();
  const reopened = loadPage('../pages/me/me');
  await reopened.onShow();
  expect(reopened.data.theme).toBe('light');
  reopened.onToggleOffline();
  expect(wx.showModal).toHaveBeenCalled();
  expect(storage['fitness:settings']).toEqual({ unit: 'lb', offlineMode: false, theme: 'light' });
  reopened.onToggleTheme({ detail: { value: false } });
  expect(reopened.data.theme).toBe('dark');
  expect(wx.getNetworkType).toHaveBeenCalledTimes(2);
  expect(storage['fitness:settings']).toEqual({ unit: 'lb', offlineMode: false, theme: 'dark' });
  delete storage['fitness:settings'].theme;
  storage['fitness:settings'].offlineMode = false;
  expect(JSON.stringify(storage)).toBe(before);
});

test('保存失败时开关恢复原值、提示，不变更原设置或发布原生切换', async () => {
  storage['fitness:settings'] = { unit: 'lb', theme: 'light' };
  const original = storage['fitness:settings'];
  wx.setNavigationBarColor = jest.fn();
  const page = loadPage('../pages/me/me');
  await page.onShow();
  wx.setNavigationBarColor.mockClear();
  wx.setStorageSync.mockImplementation(() => { throw Error('quota'); });
  page.onToggleTheme({ detail: { value: false } });
  expect(page.data.theme).toBe('light');
  expect(storage['fitness:settings']).toBe(original);
  expect(wx.setNavigationBarColor).not.toHaveBeenCalled();
  expect(original).toEqual({ unit: 'lb', theme: 'light' });
  expect(wx.showToast).toHaveBeenCalledWith({ title: '主题保存失败，请重试', icon: 'none' });
});

test('今天加载/往返显示恢复当前主题，仅原业务 onShow 刷新一次', () => {
  storage['fitness:settings'] = { theme: 'light' };
  const page = loadPage('../pages/today/today');
  page.refresh = jest.fn();
  page.onLoad({ source: 'test' });
  expect(page.data.theme).toBe('light');
  expect(page.refresh).not.toHaveBeenCalled();
  page.onShow();
  expect(page.refresh).toHaveBeenCalledTimes(1);
  storage['fitness:settings'].theme = 'dark';
  page.onShow();
  expect(page.data.theme).toBe('dark');
  expect(page.refresh).toHaveBeenCalledTimes(2);
  expect(wx.setStorageSync).not.toHaveBeenCalled();
});

test('装饰器保留钩子的 this、全部参数、同步/异步返回与单次执行，无全局劫持', () => {
  const { themePage, setTheme, getTheme } = require('../utils/theme');
  const originalPage = global.Page;
  const promise = Promise.resolve('business');
  const onLoad = jest.fn(function (...args) { this.loaded = args; return 'loaded'; });
  const onShow = jest.fn(function (...args) { this.shown = args; return promise; });
  const source = { data: { count: 3 }, onLoad, onShow };
  const page = mount(themePage(source));
  const options = { id: 'x' };
  expect(page.onLoad(options, 7)).toBe('loaded');
  expect(page.loaded).toEqual([options, 7]);
  expect(page.onShow('back')).toBe(promise);
  expect(page.shown).toEqual(['back']);
  expect(onLoad).toHaveBeenCalledTimes(1);
  expect(onShow).toHaveBeenCalledTimes(1);
  expect(global.Page).toBe(originalPage);
  expect(source.data).toEqual({ count: 3 });
  expect(setTheme('system')).toBe(false);
  storage['fitness:settings'] = { theme: 'unknown' };
  expect(getTheme()).toBe('dark');
  wx.getStorageSync = () => { throw Error('read'); };
  expect(getTheme()).toBe('dark');
});

test('切换同步导航、窗口与四个 tabBar 图标；深色逐值恢复 app.json', async () => {
  wx.setNavigationBarColor = jest.fn();
  wx.setBackgroundColor = jest.fn();
  wx.setBackgroundTextStyle = jest.fn();
  wx.setTabBarStyle = jest.fn();
  wx.setTabBarItem = jest.fn();
  const page = loadPage('../pages/me/me');
  await page.onShow();
  page.onToggleTheme({ detail: { value: true } });
  expect(wx.setNavigationBarColor).toHaveBeenLastCalledWith(expect.objectContaining({ frontColor: '#000000', backgroundColor: '#F5F6F7' }));
  expect(wx.setBackgroundColor).toHaveBeenLastCalledWith(expect.objectContaining({ backgroundColor: '#F5F6F7', backgroundColorTop: '#F5F6F7', backgroundColorBottom: '#F5F6F7' }));
  expect(wx.setBackgroundTextStyle).toHaveBeenLastCalledWith(expect.objectContaining({ textStyle: 'dark' }));
  expect(wx.setTabBarStyle).toHaveBeenLastCalledWith(expect.objectContaining({ color: '#626D76', selectedColor: '#3E5429', backgroundColor: '#FFFFFF', borderStyle: 'white' }));
  ['today', 'plan', 'records', 'me'].forEach((name, index) => {
    expect(wx.setTabBarItem).toHaveBeenCalledWith(expect.objectContaining({ index, iconPath: `images/tabbar/${name}-light.png`, selectedIconPath: `images/tabbar/${name}-active-light.png` }));
  });
  page.onToggleTheme({ detail: { value: false } });
  const config = require('../app.json');
  expect(wx.setNavigationBarColor).toHaveBeenLastCalledWith(expect.objectContaining({ frontColor: '#ffffff', backgroundColor: config.window.navigationBarBackgroundColor }));
  expect(wx.setBackgroundColor).toHaveBeenLastCalledWith(expect.objectContaining({ backgroundColor: config.window.backgroundColor }));
  expect(wx.setTabBarStyle).toHaveBeenLastCalledWith(expect.objectContaining({ color: config.tabBar.color, selectedColor: config.tabBar.selectedColor, backgroundColor: config.tabBar.backgroundColor, borderStyle: config.tabBar.borderStyle }));
  config.tabBar.list.forEach((item, index) => {
    expect(wx.setTabBarItem).toHaveBeenCalledWith(expect.objectContaining({ index, iconPath: item.iconPath, selectedIconPath: item.selectedIconPath }));
  });
});

test('非 tab 页原生失败和缺失 API 不妨碍生命周期，后续显示可重试', () => {
  const { themePage } = require('../utils/theme');
  storage['fitness:settings'] = { theme: 'light' };
  wx.setTabBarStyle = jest.fn(({ fail }) => fail({ errMsg: 'not TabBar page' }));
  wx.setTabBarItem = jest.fn(() => { throw Error('not TabBar page'); });
  const page = mount(themePage({ onShow() { return 'business'; } }));
  expect(page.onShow()).toBe('business');
  expect(page.data.theme).toBe('light');
  wx.setTabBarStyle = jest.fn();
  expect(page.onShow()).toBe('business');
  expect(wx.setTabBarStyle).toHaveBeenCalled();
});

test('应用启动在云能力缺失时仍恢复本机主题原生栏', () => {
  storage['fitness:settings'] = { theme: 'light' };
  wx.setNavigationBarColor = jest.fn();
  delete wx.cloud;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  let app;
  global.App = value => { app = value; };
  require('../app');
  try {
    app.onLaunch();
    expect(wx.setNavigationBarColor).toHaveBeenCalledWith(expect.objectContaining({ backgroundColor: '#F5F6F7' }));
    expect(wx.setStorageSync).not.toHaveBeenCalled();
  } finally { delete global.App; }
});


test('开关模板在训练偏好内绑定已保存主题，两个页面根节点直接接入主题', () => {
  const fs = require('fs');
  const me = fs.readFileSync('pages/me/me.wxml', 'utf8');
  const today = fs.readFileSync('pages/today/today.wxml', 'utf8');
  expect(me).toContain('class="page theme-{{theme}}"');
  expect(today).toContain('class="page theme-{{theme}}"');
  const preferences = me.slice(me.indexOf('训练偏好'), me.indexOf('存储与离线队列'));
  expect(preferences).toContain('浅色模式');
  expect(preferences).toContain(`checked="{{theme === 'light'}}"`);
  expect(preferences).toContain('bindchange="onToggleTheme"');
});

test('共享浅色色板独立区分状态、按钮与反馈，app 引用且深色按钮仍有原值回退', () => {
  const fs = require('fs');
  const appStyle = fs.readFileSync('app.wxss', 'utf8');
  expect(appStyle).toContain('@import "styles/theme.wxss";');
  const style = fs.readFileSync('styles/theme.wxss', 'utf8');
  expect(style).toContain('.theme-light');
  expect(style).toMatch(/--signal:\s*#3E5429;/);
  expect(style).toMatch(/--energy:\s*#C3ED42;/);
  expect(style).toMatch(/--action-background:\s*#20262B;/);
  expect(style).toMatch(/--action-ink:\s*#C3ED42;/);
  expect(style).toMatch(/--signal-soft:\s*#F2F6E8;/);
  expect(style).toMatch(/--signal-line:\s*#A7B68F;/);
  expect(appStyle).toContain('var(--action-background, var(--signal-gradient))');
});

test('主题共享模块可在仅支持 JS 的小程序加载器中加载', () => {
  const fs = require('fs');
  const vm = require('vm');
  const filename = require.resolve('../utils/theme');
  expect(() => vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module: { exports: {} },
    require(request) { throw Error(`小程序不可 require ${request}`); },
  }, { filename })).not.toThrow();
});

test('我的浅色原生说明弹窗只设置可控按钮色，深色不改变原有参数', async () => {
  wx.showModal = jest.fn();
  const page = loadPage('../pages/me/me');
  storage['fitness:settings'] = { theme: 'light' };
  await page.onShow();
  page.onShowLoginInfo();
  expect(wx.showModal).toHaveBeenLastCalledWith(expect.objectContaining({ confirmColor: '#3E5429', showCancel: false }));
  page.onShowLicense();
  expect(wx.showModal).toHaveBeenLastCalledWith(expect.objectContaining({ confirmColor: '#3E5429', showCancel: false }));
  page.onToggleTheme({ detail: { value: false } });
  page.onShowLicense();
  expect(wx.showModal.mock.calls.at(-1)[0]).not.toHaveProperty('confirmColor');
});

test('今天浅色替换草稿确认框使用可控文字色，取消仍保留草稿和计划', () => {
  const domain = require('../utils/domain');
  const plan = { id: 'p', name: '计划', cursor: 0, cycleDays: [{ dayId: 'd', name: '推日', exercises: [] }] };
  const draft = domain.snapshotSession(plan);
  storage['fitness:trainingDraft'] = draft;
  storage['fitness:settings'] = { theme: 'light' };
  wx.showModal = jest.fn();
  const page = loadPage('../pages/today/today');
  page.onLoad();
  page.setData({ plan });
  page.onStartTraining();
  expect(wx.showModal).toHaveBeenCalledWith(expect.objectContaining({ confirmColor: '#3E5429', cancelColor: '#20262B' }));
  wx.showModal.mock.calls[0][0].success({ confirm: false });
  expect(page.data.starting).toBe(false);
  expect(storage['fitness:trainingDraft']).toBe(draft);
  expect(plan.cursor).toBe(0);
  expect(wx.setStorageSync).not.toHaveBeenCalled();
});

test('浅色真实动作图保留白底且不混色，灰色占位与亮绿进度分离', () => {
  const fs = require('fs');
  const style = fs.readFileSync('pages/today/today.wxss', 'utf8');
  expect(style).toMatch(/\.exercise-image\s*\{[^}]*mix-blend-mode:\s*normal;[^}]*background:\s*#FFFFFF;/);
  expect(style).toMatch(/\.resume-fill\s*\{[^}]*background:\s*var\(--signal-gradient\)/);
  expect(fs.readFileSync('styles/theme.wxss', 'utf8')).toMatch(/--signal-gradient:\s*linear-gradient\(#C3ED42, #C3ED42\)/);
});
