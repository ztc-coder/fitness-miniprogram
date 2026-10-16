const domain = require('../utils/domain');
const { setTheme } = require('../utils/theme');
const DRAFT_KEY = 'fitness:trainingDraft';
let page;
let storage;
const event = dataset => ({ currentTarget: { dataset } });

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers().setSystemTime(1000000);
  storage = new Map();
  global.wx = {
    getStorageSync: jest.fn(key => storage.get(key)),
    setStorageSync: jest.fn((key, value) => storage.set(key, JSON.parse(JSON.stringify(value)))),
    showToast: jest.fn(), showModal: jest.fn(), showActionSheet: jest.fn(),
    setNavigationBarColor: jest.fn(), setBackgroundColor: jest.fn(),
    setBackgroundTextStyle: jest.fn(), setTabBarStyle: jest.fn(), setTabBarItem: jest.fn(),
  };
  global.Page = definition => { page = definition; };
  require('../pages/training/training');
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = (patch, callback) => { Object.assign(page.data, patch); if (callback) callback(); };
});

afterEach(() => {
  page.onUnload();
  jest.useRealTimers();
  delete global.Page;
  delete global.wx;
});

function load() {
  const draft = domain.snapshotSession({ id: 'plan', name: '计划', cursor: 0, cycleDays: [
    { dayId: 'push', name: '推', exercises: [
      { exerciseId: '0025', name: '卧推', equipment: 'barbell', sets: 3, targetWeight: 40, targetReps: 10 },
    ] },
  ] });
  storage.set(DRAFT_KEY, draft);
  page.onLoad();
  page.onShow();
  return page.data.session.exercises[0].sets.map(set => set.id);
}

test.each(['running', 'rest-paused', 'training-paused', 'training-running-paused'])('主题往返恢复%s草稿，成绩、稳定组ID和独立间歇不变且没有额外写入或计时器', state => {
  const ids = load();
  page.onToggleSet(event({ setId: ids[1] }));
  page.onStartRest();
  if (state === 'rest-paused' || state === 'training-paused') page.onPauseRest();
  if (state.startsWith('training-')) page.onPause();
  const draft = JSON.parse(JSON.stringify(storage.get(DRAFT_KEY)));
  expect(draft.exercises[0].sets[1]).toMatchObject({ id: ids[1], status: 'completed', weight: 40, reps: 10 });
  expect(draft.training.restEndsAt).toBe(state === 'running' ? 1090000 : null);
  expect(draft.training.phase).toBe(state.startsWith('training-') ? 'paused' : 'rest');
  expect(page.data.theme).toBe('dark');
  page.onHide();
  expect(jest.getTimerCount()).toBe(0);
  for (const theme of ['light', 'dark', 'light']) {
    setTheme(theme);
    wx.setStorageSync.mockClear();
    page.onShow();
    expect(page.data.theme).toBe(theme);
    expect(page.data.session).toEqual(draft);
    expect(storage.get(DRAFT_KEY)).toEqual(draft);
    expect(wx.setStorageSync).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);
    expect(wx.setNavigationBarColor.mock.calls.at(-1)[0]).toMatchObject({
      backgroundColor: theme === 'light' ? '#F5F6F7' : '#08110e',
    });
    page.onHide();
  }
});

test.each(['dark', 'light'])('%s原生动作菜单与结束确认只覆盖浅色可控文字', theme => {
  setTheme(theme);
  const [first] = load();
  page.onToggleSet(event({ setId: first }));
  page.onSkipExercise(event({ anchorId: first }));
  const sheet = wx.showActionSheet.mock.calls.at(-1)[0];
  expect(sheet.itemList).toEqual(['跳过剩余组', '恢复跳过组', '移除未练动作']);
  expect(sheet.itemColor).toBe(theme === 'light' ? '#20262B' : undefined);
  page.onFinish();
  const modal = wx.showModal.mock.calls.at(-1)[0];
  expect(modal.confirmText).toBe('保存结束');
  expect(modal.confirmColor).toBe(theme === 'light' ? '#3E5429' : undefined);
  expect(modal.cancelColor).toBe(theme === 'light' ? '#20262B' : undefined);
  modal.success({ confirm: false });
  expect(page.data.progress.completed).toBe(1);
  expect(page.data.showSummary).toBe(false);
});

test('训练模板向根节点和隔离动作详情传递主题，浅色样式覆盖本票界面且保持原尺寸', () => {
  const fs = require('fs');
  const wxml = fs.readFileSync('pages/training/training.wxml', 'utf8');
  const css = fs.readFileSync('pages/training/training.wxss', 'utf8');
  expect(wxml.split('\n')[0]).toContain('theme-{{theme}}');
  expect(wxml).toMatch(/<exercise-detail\b[^>]*theme="{{theme}}"/);
  // 仅加载契约，不代替微信原生渲染与 computed style 验收。
  const rules = selector => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(match => match[1].split(',').map(s => s.trim()).includes(selector))
    .map(match => match[2]).join('\n');
  expect(rules('.training-page .primary-button')).toContain('background: var(--action-background, var(--signal-gradient))');
  expect(rules('.training-page .primary-button')).toContain('color: var(--action-ink, var(--signal-ink))');
  expect(rules('.training-page .end-rest')).toContain('background: var(--action-background, var(--signal-gradient))');
  expect(rules('.set-completed')).toContain('background: var(--completed-background, transparent)');
  expect(rules('.set-completed .check-box')).toContain('border-color: var(--energy, var(--signal))');
  for (const selector of ['.theme-light .paused-banner', '.theme-light .save-error']) {
    expect(rules(selector)).toContain('background: #FFF4DF');
    expect(rules(selector)).toContain('color: #805307');
  }
  expect(rules('.theme-light .rest-backdrop')).toContain('background: var(--overlay)');
  for (const selector of ['.theme-light .elapsed', '.theme-light .mini-time', '.theme-light .stat-number']) {
    expect(rules(selector)).toContain('color: var(--ink)');
  }
  for (const selector of ['.theme-light .ex-thumb-img', '.theme-light .preview-image']) {
    expect(rules(selector)).toContain('background: #FFFFFF');
    expect(rules(selector)).toContain('mix-blend-mode: normal');
  }
  expect(rules('.set-row.is-current')).toContain('background: var(--signal-soft)');
  expect(rules('.set-row.is-current')).toContain('border: 1rpx solid var(--signal-line)');
  expect(rules('.progress-fill')).toContain('background: var(--signal-gradient)');
});

test('浅色草稿读取失败仍阻塞编辑，显式重试恢复且主题读取不会吞掉草稿异常', () => {
  setTheme('light');
  const [first] = load();
  const draft = JSON.parse(JSON.stringify(storage.get(DRAFT_KEY)));
  wx.getStorageSync.mockImplementation(key => {
    if (key === DRAFT_KEY) throw Error('draft unavailable');
    return storage.get(key);
  });
  page.onShow();
  expect(page.data.theme).toBe('light');
  expect(page.data.reloadBlocked).toBe(true);
  expect(page.data.errorText).toMatch(/读取/);
  wx.setStorageSync.mockClear();
  page.onToggleSet(event({ setId: first }));
  expect(wx.setStorageSync).not.toHaveBeenCalled();
  wx.getStorageSync.mockImplementation(key => storage.get(key));
  page.onRetryDraft();
  expect(page.data.reloadBlocked).toBe(false);
  expect(page.data.session).toEqual(draft);
});

test('完成小结双向切换不改变本地完成事实、统计与队列且不启动计时器', async () => {
  setTheme('light');
  const ids = load();
  ids.forEach(setId => page.onToggleSet(event({ setId })));
  wx.removeStorageSync = jest.fn(key => storage.delete(key));
  wx.getNetworkType = jest.fn(({ success }) => success({ networkType: 'none' }));
  wx.cloud = { database: () => {
    const query = { orderBy: () => query, limit: () => query, get: () => Promise.resolve({ data: [
      { id: 'previous', planId: 'plan', dayId: 'push', submittedAt: 900000, exercises: [
        { equipment: 'barbell', sets: [{ weight: 30, reps: 10 }] },
      ] },
    ] }) };
    return { collection: () => query };
  } };
  await page.onFinish();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  expect(page.data.showSummary).toBe(true);
  expect(page.data.summary).toMatchObject({ completedSets: 3, exerciseCount: 1, weightedVolume: '1,200', bodyWeightReps: '0', duration: '00:00',
    comparisons: [{ label: '负重容量', diffText: '+900 kg', improved: true }],
  });
  const completed = JSON.parse(JSON.stringify(page.data.session));
  const summary = JSON.parse(JSON.stringify(page.data.summary));
  const businessStorage = [...storage.entries()].filter(([key]) => key !== 'fitness:settings');
  for (const theme of ['dark', 'light']) {
    page.onHide();
    setTheme(theme);
    wx.setStorageSync.mockClear();
    page.onShow();
    expect(page.data.theme).toBe(theme);
    expect(page.data.session).toEqual(completed);
    expect(page.data.summary).toEqual(summary);
    expect([...storage.entries()].filter(([key]) => key !== 'fitness:settings')).toEqual(businessStorage);
    expect(wx.setStorageSync).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  }
});
