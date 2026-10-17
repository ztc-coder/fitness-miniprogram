const fs = require('fs');

const NOW = new Date(2026, 9, 14, 12).getTime();
const settled = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const event = dataset => ({ currentTarget: { dataset } });
function session(id, at, weight = 20) {
  return { id, dayName: '推日', planName: '旧计划', startedAt: at - 60000, submittedAt: at,
    exercises: [
      { exerciseId: 'old-slug', name: '旧卧推', equipment: 'barbell', sets: [{ weight, reps: 10 }] },
      { name: '引体', equipment: 'body weight', sets: [{ weight: 0, reps: 8 }] },
    ] };
}
function setup(cloudSessions = []) {
  jest.resetModules();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const storage = {};
  const reads = [];
  const writes = jest.fn((key, value) => { storage[key] = value; });
  const cloudWrite = jest.fn(() => { throw Error('history must be read only'); });
  const collection = {
    orderBy() {
      let offset = 0; let count = 50;
      const query = {
        skip(n) { offset = n; return query; },
        limit(n) { count = n; return query; },
        get() { reads.push({ offset, count }); return Promise.resolve({ data: cloudSessions.slice(offset, offset + count) }); },
      };
      return query;
    },
    add: cloudWrite, doc: () => ({ set: cloudWrite, update: cloudWrite, remove: cloudWrite }),
  };
  global.wx = {
    getStorageSync: key => storage[key], setStorageSync: writes, removeStorageSync: jest.fn(),
    cloud: { database: () => ({ collection: () => collection }) },
    navigateTo: jest.fn(), navigateBack: jest.fn(), showToast: jest.fn(),
    setNavigationBarColor: jest.fn(), setBackgroundColor: jest.fn(), setBackgroundTextStyle: jest.fn(),
    setTabBarStyle: jest.fn(), setTabBarItem: jest.fn(),
  };
  function open(name) {
    let definition;
    global.Page = value => { definition = value; };
    require(`../pages/${name}/${name}`);
    return { ...definition, data: JSON.parse(JSON.stringify(definition.data)),
      setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback(); } };
  }
  return { storage, writes, cloudWrite, reads, open, theme: require('../utils/theme') };
}
afterEach(() => {
  jest.restoreAllMocks();
  delete global.wx; delete global.Page;
});

test('记录再次显示恢复双向主题，保留页签、动作与指标弹层，原刷新每次仅读取一次且历史不写', async () => {
  const { storage, writes, cloudWrite, reads, open, theme } = setup([session('old', NOW)]);
  await require('./helpers/cloud-runtime').enableCloud();
  writes.mockClear();
  storage['fitness:pendingQueue'] = [session('local', NOW - 86400000, 30)];
  storage['fitness:trainingDraft'] = { id: 'untouched' };
  const page = open('records');
  expect(page.data.theme).toBe('dark');
  page.onShow(); await settled();
  expect(page.data.stats).toMatchObject({ weekSessions: 2, streakDays: 2, totalWeightedVolume: 500 });
  page.onSelectExercise({ detail: { value: '1' } });
  page.onOpenMetricSheet();
  page.onSwitchView(event({ view: 'sessions' }));
  const before = JSON.stringify(storage);
  expect(theme.setTheme('light')).toBe(true);
  writes.mockClear();
  page.onShow(); await settled();
  expect(page.data).toMatchObject({ theme: 'light', view: 'sessions', selectedExercise: '引体', showMetricSheet: true });
  page.onSwitchView(event({ view: 'trend' }));
  expect(page.data.bars.map(b => b.value)).toEqual(['8', '8']);
  expect(page.data.isBodyWeight).toBe(true);
  expect(theme.setTheme('dark')).toBe(true);
  writes.mockClear();
  page.onShow(); await settled();
  expect(page.data).toMatchObject({ theme: 'dark', view: 'trend', selectedExercise: '引体', showMetricSheet: true });
  expect(reads).toEqual(Array(3).fill({ offset: 0, count: 20 }));
  expect(writes).not.toHaveBeenCalled();
  expect(wx.removeStorageSync).not.toHaveBeenCalled();
  expect(cloudWrite).not.toHaveBeenCalled();
  expect(JSON.stringify({ ...storage, 'fitness:settings': undefined })).toBe(before);
});

test('从时间线打开旧详情读取本机浅色，往返改主题不重载详情或改写历史和现有选择', async () => {
  const legacy = session('legacy', NOW, 30);
  const { storage, writes, cloudWrite, reads, open, theme } = setup([legacy]);
  await require('./helpers/cloud-runtime').enableCloud();
  writes.mockClear();
  storage['fitness:settings'] = { theme: 'light', unit: 'kg' };
  const before = JSON.stringify(legacy);
  const records = open('records');
  records.onShow(); await settled();
  records.onSelectExercise({ detail: { value: '1' } });
  records.onSwitchView(event({ view: 'sessions' }));
  records.onOpenSession(event({ id: 'legacy' }));
  expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/session-detail/session-detail?id=legacy' });
  const detail = open('session-detail');
  detail.onLoad({ id: 'legacy' }); await settled();
  expect(detail.data).toMatchObject({ theme: 'light', totalVolume: '308', exerciseCount: 2, duration: '1m' });
  expect(detail.data.exercises).toMatchObject([
    { name: '旧卧推', volume: 300, sets: [{ text: '30 kg × 10' }] },
    { name: '引体', isBodyWeight: true, volume: 8, sets: [{ text: '0 kg × 8' }] },
  ]);
  const displayed = detail.data.exercises;
  theme.setTheme('dark'); writes.mockClear();
  const readCount = reads.length;
  detail.onShow(); await settled();
  expect(detail.data.theme).toBe('dark');
  expect(detail.data.exercises).toBe(displayed);
  expect(reads).toHaveLength(readCount);
  records.onShow(); await settled();
  expect(records.data).toMatchObject({ theme: 'dark', view: 'sessions', selectedExercise: '引体' });
  expect(JSON.stringify(legacy)).toBe(before);
  expect(writes).not.toHaveBeenCalled();
  expect(cloudWrite).not.toHaveBeenCalled();
});

// 模板契约只确认主题到可见根节点的接线，不冒充原生渲染证据。
test('两页可见根节点接收 Page 的主题类', () => {
  for (const name of ['records', 'session-detail']) {
    const template = fs.readFileSync(`pages/${name}/${name}.wxml`, 'utf8');
    expect(template).toMatch(/^<view class="page theme-\{\{theme\}\}"/);
  }
});

// 浅色局部样式契约：固定设计色与移除透明度/辉光；实际颜色仍待原生量测。
function declarations(name, selector) {
  const css = fs.readFileSync(`pages/${name}/${name}.wxss`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const result = {};
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.trim().split(/,\s*/).includes(selector)) continue;
    for (const declaration of body.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon >= 0) result[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
    }
  }
  return result;
}
test('浅色历史柱无半透明和辉光，最新柱亮绿且深绿内描边，PR仍由业务条件决定', () => {
  expect(declarations('records', '.theme-light .chart-bar')).toMatchObject({
    background: 'var(--chart-history)', opacity: '1', 'box-shadow': 'none',
  });
  expect(declarations('records', '.theme-light .chart-bar.last')).toMatchObject({
    background: 'var(--energy)', 'border-color': 'var(--signal)', 'box-shadow': 'inset 0 0 0 2rpx var(--signal)',
  });
  expect(fs.readFileSync('pages/records/records.wxml', 'utf8')).toContain('wx:if="{{item.isPR}}"');
});

test('浅色统计与时间线炭黑数值、深绿火焰、自有弹层遮罩和详情数值适配', () => {
  expect(declarations('records', '.theme-light .stat-number').color).toBe('var(--ink)');
  expect(declarations('records', '.theme-light .record-volume').color).toBe('var(--ink)');
  expect(declarations('records', '.theme-light .icon-flame').background).toBe('var(--signal)');
  expect(declarations('records', '.theme-light .sheet-mask').background).toBe('var(--overlay)');
  expect(declarations('records', '.theme-light .sync-status:not(.pending)').color).toBe('var(--ink-dim)');
  expect(declarations('records', '.theme-light .chart-bar:not(.last) .bar-value').color).toBe('var(--ink-dim)');
  expect(declarations('session-detail', '.theme-light .metric-num').color).toBe('var(--ink)');
});

test('空记录恢复浅色且不补写历史，指标预留提示和关闭行为保持原样', async () => {
  const { storage, open, writes, cloudWrite } = setup();
  await require('./helpers/cloud-runtime').enableCloud();
  writes.mockClear();
  storage['fitness:settings'] = { theme: 'light' };
  const page = open('records');
  page.onLoad(); page.onShow(); await settled();
  expect(page.data).toMatchObject({ theme: 'light', sessions: [], recentSessions: [], bars: [], trendEmpty: true, totalVolumeValue: '0', pendingCount: 0 });
  page.onOpenMetricSheet();
  page.onPickMetric(event({ key: 'topWeight', label: 'top weight · 预留' }));
  expect(wx.showToast).toHaveBeenCalledWith({ title: '该指标为预留,后续版本开放', icon: 'none' });
  expect(page.data).toMatchObject({ metric: 'volume', showMetricSheet: true });
  page.onPickMetric(event({ key: 'volume', label: 'volume' }));
  expect(page.data).toMatchObject({ metric: 'volume', metricLabel: 'volume', showMetricSheet: false });
  page.onOpenMetricSheet(); page.onCloseMetricSheet();
  expect(page.data.showMetricSheet).toBe(false);
  expect(writes).not.toHaveBeenCalled();
  expect(cloudWrite).not.toHaveBeenCalled();
});

test('浅色详情仍显示新历史的完成、未打卡和跳过组，不修改保存成绩', async () => {
  const actual = {
    id: 'actual', startedAt: NOW - 60000, submittedAt: NOW, flowVersion: 2,
    exercises: [{ name: '卧推', equipment: 'barbell', flowVersion: 2, sets: [
      { id: 'a', status: 'completed', weight: 20, reps: 10 },
      { id: 'b', status: 'pending', weight: 50, reps: 10 },
      { id: 'c', status: 'skipped', weight: 50, reps: 10 },
    ] }],
  };
  const { storage, open, writes, cloudWrite } = setup([actual]);
  await require('./helpers/cloud-runtime').enableCloud();
  writes.mockClear();
  storage['fitness:settings'] = { theme: 'light' };
  const before = JSON.stringify(actual);
  const page = open('session-detail');
  page.onLoad({ id: 'actual' }); await settled();
  expect(page.data).toMatchObject({ theme: 'light', totalVolume: '200', exerciseCount: 1 });
  expect(page.data.exercises[0].sets.map(s => s.text)).toEqual(['20 kg × 10', '未打卡', '已跳过']);
  expect(JSON.stringify(actual)).toBe(before);
  expect(writes).not.toHaveBeenCalled();
  expect(cloudWrite).not.toHaveBeenCalled();
});

test('不存在的历史仍提示并按原延时返回，不因主题变更重试查询或补数据', async () => {
  jest.useFakeTimers();
  try {
    const { storage, open, writes, reads } = setup();
  await require('./helpers/cloud-runtime').enableCloud();
  writes.mockClear();
    storage['fitness:settings'] = { theme: 'light' };
    const page = open('session-detail');
    page.onLoad({ id: 'missing' }); await settled();
    expect(page.data).toMatchObject({ theme: 'light', session: null });
    expect(wx.showToast).toHaveBeenCalledWith({ title: '记录不存在', icon: 'none' });
    page.onShow(); await settled();
    expect(reads).toEqual([{ offset: 0, count: 50 }]);
    jest.advanceTimersByTime(599);
    expect(wx.navigateBack).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(wx.navigateBack).toHaveBeenCalledTimes(1);
    expect(writes).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});

test('主题往返仍读取超过50场完整历史并按旧优先级合并本地，统计与历史全程只读', async () => {
  const cloud = Array.from({ length: 61 }, (_, i) => session(`s${i}`, NOW - i * 3600000));
  const { storage, open, writes, cloudWrite, theme, reads } = setup(cloud);
  await require('./helpers/cloud-runtime').enableCloud();
  writes.mockClear();
  storage['fitness:pendingQueue'] = [session('s0', NOW, 30)];
  storage['fitness:completedTraining'] = [{ session: session('s0', NOW, 40), sessionSynced: false, planSynced: true }];
  const before = JSON.stringify(storage);
  const page = open('records');
  page.onShow(); await settled();
  expect(page.data.sessions).toHaveLength(61);
  expect(page.data.stats.totalWeightedVolume).toBe(12400);
  expect(page.data.totalVolumeValue).toBe('12.4');
  expect(page.data.sessions[0].volume).toBe('408 kg');
  const rows = JSON.stringify(page.data.sessions);
  theme.setTheme('light'); writes.mockClear();
  page.onShow(); await settled();
  expect(page.data.theme).toBe('light');
  expect(page.data.stats.totalWeightedVolume).toBe(12400);
  expect(JSON.stringify(page.data.sessions)).toBe(rows);
  expect(reads).toEqual([0, 20, 40, 60, 0, 20, 40, 60].map(offset => ({ offset, count: 20 })));
  expect(writes).not.toHaveBeenCalled();
  expect(cloudWrite).not.toHaveBeenCalled();
  expect(JSON.stringify({ ...storage, 'fitness:settings': undefined })).toBe(before);
});
