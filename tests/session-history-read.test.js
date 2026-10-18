const domain = require('../utils/domain');

function setup({ failAt } = {}) {
  jest.resetModules();
  const now = new Date(2026, 9, 14, 12).getTime();
  const sessions = Array.from({ length: 61 }, (_, i) => ({
    id: `session-${i}`,
    startedAt: now - i * 3600000 - 60000,
    submittedAt: now - i * 3600000,
    exercises: [{ name: '卧推', equipment: 'barbell', sets: [{ weight: 20, reps: 10 }] }],
  }));
  const storage = {};
  const requests = [];
  const collection = {
    orderBy() {
      let offset = 0;
      let count = 0;
      const query = {
        skip(value) { offset = value; return query; },
        limit(value) { count = value; return query; },
        get() {
          requests.push({ offset, count });
          return offset === failAt
            ? Promise.reject(new Error('offline'))
            : Promise.resolve({ data: sessions.slice(offset, offset + count) });
        },
      };
      return query;
    },
  };
  global.wx = {
    getStorageSync: key => storage[key],
    cloud: { database: () => ({ collection: () => collection }) },
  };
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  return { db: require('../utils/db'), storage, sessions, requests, now };
}

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete global.wx;
  delete global.Page;
  delete global.getApp;
});

test('超过 50 场且无本地历史时，读取完整云端历史供累计和本月统计', async () => {
  const { db, sessions, requests, now } = setup();
  await require('./helpers/cloud-runtime').enableCloud();
  const result = await db.fetchAllSessions();
  expect(result).toEqual(sessions);
  expect(requests).toEqual([0, 20, 40, 60].map(offset => ({ offset, count: 20 })));
  expect(domain.computeRecordStats(result, now)).toMatchObject({ totalWeightedVolume: 12200, monthSessions: 61 });
});

test('汇总页面使用完整云端历史，月度环封顶但不截断真实场次和容量', async () => {
  const { now } = setup();
  await require('./helpers/cloud-runtime').enableCloud();
  jest.spyOn(Date, 'now').mockReturnValue(now);
  let definition;
  global.Page = value => { definition = value; };
  global.getApp = () => ({ globalData: {} });
  wx.getNetworkType = ({ success }) => success({ networkType: 'wifi' });
  for (const name of ['records', 'me']) {
    require(`../pages/${name}/${name}`);
    const page = { ...definition, data: { ...definition.data },
      setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback(); } };
    if (name === 'records') {
      await page.refresh();
      expect(page.data.stats.totalWeightedVolume).toBe(12200);
      expect(page.data.totalVolumeValue).toBe('12.2');
    } else {
      await page.onShow();
      expect(page.data.monthSessions).toBe(61);
      expect(page.data.monthProgress).toBe(100);
    }
  }
});

test('云端、本地完成日志和队列同 id 去重，本地新成绩优先且不写入存储', async () => {
  const { db, storage, sessions } = setup();
  await require('./helpers/cloud-runtime').enableCloud();
  const local = { ...sessions[0], dayName: '本地版本' };
  const pending = { ...sessions[0], id: 'pending-only' };
  storage['fitness:completedTraining'] = [{ session: local, sessionSynced: false, planSynced: true }];
  storage['fitness:pendingQueue'] = [local, pending];
  const before = JSON.stringify(storage);
  const result = await db.fetchAllSessions();
  expect(result).toHaveLength(62);
  expect(result.find(s => s.id === local.id).dayName).toBe('本地版本');
  expect(JSON.stringify(storage)).toBe(before);
});

test.each([0, 20])('第 %i 条开始断网时仍返回已读取与本地记录', async failAt => {
  const { db, storage } = setup({ failAt });
  await require('./helpers/cloud-runtime').enableCloud();
  storage['fitness:pendingQueue'] = [{ id: 'offline', startedAt: 1, submittedAt: 2 }];
  const result = await db.fetchAllSessions();
  expect(result).toHaveLength(failAt + 1);
  expect(result.some(s => s.id === 'offline')).toBe(true);
});

function detailPage() {
  let definition;
  global.Page = value => { definition = value; };
  require('../pages/session-detail/session-detail');
  return { ...definition, data: { ...definition.data },
    setData(patch) { Object.assign(this.data, patch); } };
}

test('新设备无本地日志：真实详情 Page.onLoad 能打开第 61 场并保留快照容量及完整历史统计', async () => {
  jest.useFakeTimers();
  const { sessions, requests, now } = setup();
  await require('./helpers/cloud-runtime').enableCloud();
  wx.showToast = jest.fn(); wx.navigateBack = jest.fn();
  const page = detailPage();
  await page.onLoad({ id: 'session-60' });
  expect(page.data.session).toEqual(sessions[60]);
  expect(page.data.totalVolume).toBe('200');
  expect(page.data.duration).toBe('1m');
  expect(page.data.exercises[0]).toMatchObject({ name: '卧推', volume: 200, sets: [{ num: 1, text: '20 kg × 10' }] });
  expect(requests).toEqual([0, 20, 40, 60].map(offset => ({ offset, count: 20 })));
  expect(wx.showToast).not.toHaveBeenCalled();
  expect(domain.computeRecordStats(await require('../utils/db').fetchAllSessions(), now)).toMatchObject({ totalWeightedVolume: 12200, monthSessions: 61 });
  page.onUnload();
});

test.each(['identity', 'deletion'])('详情分页响应迟到时 %s 已失效，旧快照不能恢复渲染', async change => {
  const { storage, sessions } = setup();
  let release, captured;
  const entered = new Promise(resolve => { captured = resolve; });
  const paused = new Promise(resolve => { release = resolve; });
  wx.setStorageSync = (key, value) => { storage[key] = JSON.parse(JSON.stringify(value)); };
  wx.removeStorageSync = key => { delete storage[key]; };
  wx.showToast = jest.fn(); wx.navigateBack = jest.fn();
  wx.cloud.init = () => {};
  wx.cloud.callFunction = async ({ name, data }) => {
    if (name === 'login') return { result: { openid: 'A' } };
    if (data.action === 'state') return { result: { generation: 0 } };
    if (data.action === 'list') {
      if (data.skip === 60) { captured(); await paused; }
      return { result: { data: sessions.slice(data.skip, data.skip + data.limit) } };
    }
    throw Error('unexpected cloud action');
  };
  const service = require('../utils/cloud-service'); await service.enable();
  const page = detailPage(), pending = page.onLoad({ id: 'session-60' });
  await entered;
  if (change === 'identity') {
    service.disable();
    wx.cloud.callFunction = async () => ({ result: { openid: 'B' } });
    await service.enable();
  } else require('../utils/data-management').clearLocal();
  release(); await pending;
  expect(page.data.session).toBeNull();
  expect(page.data.exercises).toEqual([]);
  expect(page.data.totalVolume).toBe('');
  expect(wx.showToast).not.toHaveBeenCalled();
  page.onUnload();
});
