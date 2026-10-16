const domain = require('../utils/domain');
const fs = require('fs');

function setup() {
  jest.resetModules();
  const storage = {};
  global.wx = {
    getStorageSync: k => storage[k],
    setStorageSync: (k, v) => { storage[k] = v; },
    removeStorageSync: k => { delete storage[k]; },
    navigateTo: jest.fn(), showToast: jest.fn(),
    getNetworkType: ({ success }) => success({ networkType: 'none' }),
    cloud: { database: () => { throw Error('offline'); } },
  };
  let definition;
  global.Page = p => { definition = p; };
  require('../pages/records/records');
  const page = Object.assign({}, definition, {
    data: Object.assign({}, definition.data),
    setData(values, cb) { Object.assign(this.data, values); if (cb) cb(); },
  });
  return { page, storage };
}
const settled = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function session(id, at, weight = 20, equipment = 'barbell') {
  return { id, startedAt: at - 60000, submittedAt: at, dayName: '胸 · 推日', exercises: [
    { name: '卧推', equipment, sets: [{ weight, reps: 10 }] },
  ] };
}

afterEach(() => jest.restoreAllMocks());

test('default trend refresh derives domain stats, recent rows, pending status and bars from actual history', async () => {
  const now = new Date(2026, 6, 22, 12).getTime();
  jest.spyOn(Date, 'now').mockReturnValue(now);
  const { page, storage } = setup();
  const sessions = [session('a', now), session('b', now - 86400000), session('c', now - 172800000)];
  storage['fitness:pendingQueue'] = sessions;
  expect(page.data.view).toBe('trend');
  page.refresh(); await settled();
  expect(page.data.stats).toEqual(domain.computeRecordStats(sessions, now));
  expect(page.data.totalVolumeValue).toBe('600');
  expect(page.data.totalVolumeUnit).toBe('kg');
  expect(page.data.pendingCount).toBe(3);
  expect(page.data.recentSessions).toEqual(page.data.sessions.slice(0, 2));
  expect(page.data.bars).toHaveLength(3);
  expect(page.data.bars[0].value).toBe('200');
  expect(page.data.bars[2].label).toBe('07/22');
  page.onSwitchView({ currentTarget: { dataset: { view: 'sessions' } } });
  expect(page.data.view).toBe('sessions');
  expect(page.data.sessions).toHaveLength(3);
});

test('weighted totals convert to one decimal tonnes and chart uses four ticks with conditional last PR', async () => {
  const { page, storage } = setup();
  const now = Date.now();
  storage['fitness:pendingQueue'] = [session('a', now, 100), session('b', now - 86400000, 300)];
  page.refresh(); await settled();
  expect(page.data.totalVolumeValue).toBe('4.0');
  expect(page.data.totalVolumeUnit).toBe('t');
  expect(page.data.yTicks.map(t => t.label)).toEqual(['3.0k', '2.0k', '1.0k', '0']);
  expect(page.data.bars.every(b => !b.isPR)).toBe(true);
  page.allSessions.reverse(); page.renderBars();
  expect(page.data.bars[1].isPR).toBe(true);
  expect(page.data.bars[0].isPR).toBe(false);
});

test('empty refresh resets stats and keeps empty states without inventing sessions', async () => {
  const { page } = setup();
  page.refresh(); await settled();
  expect(page.data.pendingCount).toBe(0);
  expect(page.data.stats.weekSessions).toBe(0);
  expect(page.data.totalVolumeValue).toBe('0');
  expect(page.data.recentSessions).toEqual([]);
  expect(page.data.bars).toEqual([]);
  expect(page.data.trendEmpty).toBe(true);
});

test('bodyweight uses repetitions, not weighted totals', async () => {
  const { page, storage } = setup();
  storage['fitness:pendingQueue'] = [session('a', Date.now(), 0, 'body weight')];
  page.refresh(); await settled();
  expect(page.data.isBodyWeight).toBe(true);
  expect(page.data.bars[0].value).toBe('10');
  expect(page.data.totalVolumeValue).toBe('0');
});

test('board markup binds real sync state, existing interactions and PR condition', () => {
  const wxml = fs.readFileSync(require.resolve('../pages/records/records.wxml'), 'utf8');
  expect(wxml).toContain('训练档案');
  expect(wxml).toContain('条待同步');
  expect(wxml).toContain('已全部云同步');
  expect(wxml).toContain('历史时间线 ({{sessions.length}})');
  expect(wxml).toContain('range="{{exerciseNames}}" bindchange="onSelectExercise"');
  expect(wxml).toContain('bindtap="onOpenMetricSheet"');
  expect(wxml).toContain('wx:if="{{item.isPR}}"');
  expect(wxml).toContain('查看全部 ›');
});

test('选中动作无有效容量时仍保留动作选择器，可切换到其他动作', () => {
  const wxml = fs.readFileSync('pages/records/records.wxml', 'utf8');
  const chartStart = wxml.indexOf('<view class="chart-wrap"');
  expect(wxml).toContain('<view class="chart-wrap" wx:if="{{exerciseNames.length > 0}}">');
  expect(wxml.indexOf('bindchange="onSelectExercise"')).toBeGreaterThan(chartStart);
  expect(wxml).toContain('<view class="chart" wx:if="{{!trendEmpty}}">');
});

test('云查询未返回前同步状态已按本地待提交队列显示', () => {
  const { page, storage } = setup();
  storage['fitness:pendingQueue'] = [session('p', Date.now())];
  page.refresh();
  expect(page.data.pendingCount).toBe(1);
});
