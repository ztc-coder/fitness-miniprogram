function setup(now = new Date(2026, 9, 14, 20).getTime()) {
  jest.resetModules();
  jest.spyOn(Date, 'now').mockReturnValue(now);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const storage = {};
  global.wx = {
    getStorageSync: key => storage[key],
    setStorageSync: jest.fn((key, value) => { storage[key] = value; }),
    getNetworkType: ({ success }) => success({ networkType: 'none' }),
    showToast: jest.fn(),
    showModal: jest.fn(),
    cloud: { database: () => { throw Error('offline'); } },
  };
  global.getApp = () => ({ globalData: { openid: 'test-openid' } });
  let definition;
  global.Page = page => { definition = page; };
  const db = require('../utils/db');
  const fetch = jest.spyOn(db, 'fetchAllSessions');
  require('../pages/me/me');
  const page = Object.assign({}, definition, {
    data: Object.assign({}, definition.data),
    setData(values) { Object.assign(this.data, values); },
  });
  return { page, storage, fetch };
}

function session(id, at, hours = 0.5) {
  return { id, submittedAt: at, startedAt: at - hours * 3600000, exercises: [] };
}

afterEach(() => {
  jest.restoreAllMocks();
  delete global.wx;
  delete global.Page;
  delete global.getApp;
});

test('offline month fields use domain stats from merged local history without writes', async () => {
  const { page, storage, fetch } = setup();
  const today = session('today', new Date(2026, 9, 14, 12).getTime());
  storage['fitness:pendingQueue'] = [today];
  storage['fitness:completedTraining'] = [
    { session: today, sessionSynced: false, planSynced: true },
    { session: session('earlier', new Date(2026, 9, 2, 12).getTime(), 1), sessionSynced: true, planSynced: true },
    { session: session('last-month', new Date(2026, 8, 30, 12).getTime(), 20), sessionSynced: true, planSynced: true },
  ];
  const original = JSON.stringify(storage);
  await page.onShow();
  expect(fetch).toHaveBeenCalledWith();
  expect(page.data.monthSessions).toBe(2);
  expect(page.data.monthHours).toBe('1.5');
  expect(page.data.monthProgress).toBeCloseTo(2 / 31 * 100);
  expect(page.data.pendingCount).toBe(1);
  expect(page.data.openid).toBe('');
  expect(page.data.networkStatus).toContain('无网络');
  expect(JSON.stringify(storage)).toBe(original);
  expect(wx.setStorageSync).not.toHaveBeenCalled();
});

test('empty month has zero fields and subsequent onShow refreshes them', async () => {
  const { page, storage } = setup();
  await page.onShow();
  expect(page.data).toMatchObject({ monthSessions: 0, monthHours: '0.0', monthProgress: 0 });
  storage['fitness:pendingQueue'] = [session('new', Date.now(), 0.25)];
  await page.onShow();
  expect(page.data).toMatchObject({ monthSessions: 1, monthHours: '0.3' });
});

test('leap February uses 29 days and caps ring without capping actual sessions', async () => {
  const { page, storage } = setup(new Date(2024, 1, 29, 20).getTime());
  storage['fitness:pendingQueue'] = [session('first', Date.now(), 12)];
  await page.onShow();
  expect(page.data.monthProgress).toBeCloseTo(100 / 29);
  expect(page.data.monthHours).toBe('12');
  storage['fitness:pendingQueue'] = Array.from({ length: 30 }, (_, i) => session(String(i), Date.now()));
  await page.onShow();
  expect(page.data).toMatchObject({ monthSessions: 30, monthHours: '15', monthProgress: 100 });
});

test('settings, offline flush and informational handlers retain existing behavior', async () => {
  const { page, storage } = setup();
  storage['fitness:settings'] = { unit: 'lb', offlineMode: false };
  storage['fitness:pendingQueue'] = [session('pending', Date.now())];
  await page.onShow();
  expect(page.data).toMatchObject({ unit: 'lb', offlineMode: true, pendingCount: 1 });
  page.onToggleOffline();
  expect(storage['fitness:settings']).toEqual({ unit: 'lb', offlineMode: false });
  expect(wx.showModal).toHaveBeenCalled();
  page.onFlushQueue();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(page.data.pendingCount).toBe(1);
  expect(wx.showToast).toHaveBeenCalledWith({ title: '仅本地保存；请先启用或重试本人云服务', icon: 'none' });
  page.onShowLoginInfo();
  expect(wx.showModal).toHaveBeenLastCalledWith(expect.objectContaining({ title: '登录状态' }));
});

test('connected network note reports network type rather than claiming cloud connectivity', async () => {
  const { page } = setup();
  wx.getNetworkType = ({ success }) => success({ networkType: 'wifi' });
  await page.onShow();
  expect(page.data.networkStatus).toBe('当前网络：wifi');
  wx.getNetworkType = ({ fail }) => fail();
  await page.onShow();
  expect(page.data.networkStatus).toBe('网络状态未知');
});
