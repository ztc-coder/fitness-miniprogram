function setup() {
  jest.resetModules();
  const storage = {};
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    removeStorageSync: (key) => { delete storage[key]; },
    navigateTo: jest.fn(),
    showToast: jest.fn(),
    getNetworkType: ({ success }) => success({ networkType: 'none' }),
    cloud: { database: () => { throw Error('offline'); } },
  };
  let definition;
  global.Page = (page) => { definition = page; };
  require('../pages/plan/plan');
  return Object.assign({}, definition, {
    data: Object.assign({}, definition.data),
    setData(values) { Object.assign(this.data, values); },
  });
}

const plan = () => ({
  id: 'plan',
  name: '力量循环',
  active: true,
  cursor: 1,
  cycleDays: [
    { dayId: 'push', name: '推日 · 胸肩三头', exercises: [{ sets: 4 }, { sets: 3 }] },
    { dayId: 'pull', name: '拉日 · 背部二头', exercises: [{ sets: 5 }, { sets: 3 }, { sets: 4 }] },
    { dayId: 'legs', name: '腿日 · 臀腿核心', exercises: [] },
  ],
});

afterEach(() => {
  delete global.wx;
  delete global.Page;
});

test('NEXT is the current untrained day, with matching current row and rail states', () => {
  const page = setup();
  const source = plan();
  const before = JSON.stringify(source);
  const view = page.buildCycleView(source);
  expect(view.nextDay).toEqual({ num: '02', name: source.cycleDays[1].name });
  expect(view.cycleTrack.map((day) => day.state)).toEqual(['done', 'current', '']);
  expect(view.dayRows.map((day) => day.isCurrent)).toEqual([false, true, false]);
  expect(view.dayRows.map((day) => day.meta)).toEqual([
    '2 个动作 · 7 组', '3 个动作 · 12 组', '0 个动作 · 0 组',
  ]);
  expect(JSON.stringify(source)).toBe(before);
});

test.each([0, 2])('cursor %i stays on its own day rather than advancing or wrapping', (cursor) => {
  const page = setup();
  const source = plan();
  source.cursor = cursor;
  const view = page.buildCycleView(source);
  expect(view.nextDay).toEqual({ num: String(cursor + 1).padStart(2, '0'), name: source.cycleDays[cursor].name });
  expect(view.dayRows.filter((day) => day.isCurrent).map((day) => day.dayId)).toEqual([source.cycleDays[cursor].dayId]);
});

test('empty and missing plans clear all derived display fields', () => {
  const page = setup();
  const empty = { cursor: 0, cycleDays: [] };
  expect(page.buildCycleView(empty)).toEqual({ cycleTrack: [], dayRows: [], nextDay: null });
  expect(page.buildCycleView(null)).toEqual({ cycleTrack: [], dayRows: [], nextDay: null });
  expect(page.buildCycleView({ cursor: 0 })).toEqual({ cycleTrack: [], dayRows: [], nextDay: null });
});

test('missing exercises and set targets display zero rather than NaN', () => {
  const page = setup();
  const view = page.buildCycleView({ cursor: 0, cycleDays: [
    { dayId: 'a', name: '空训练日' },
    { dayId: 'b', name: '目标待填', exercises: [{}, { sets: 0 }, { sets: 3 }] },
  ] });
  expect(view.dayRows.map((day) => day.meta)).toEqual(['0 个动作 · 0 组', '3 个动作 · 3 组']);
});

test('offline refresh populates derived fields without writing or advancing the stored plan', async () => {
  const page = setup();
  const source = plan();
  wx.setStorageSync('fitness:plans', [source]);
  const db = require('../utils/db');
  const seed = jest.spyOn(db, 'ensureSeedPlans').mockResolvedValue([source]);
  page.refresh();
  await Promise.resolve();
  expect(page.data.nextDay).toEqual({ num: '02', name: source.cycleDays[1].name });
  expect(page.data.dayRows[1].isCurrent).toBe(true);
  expect(source.cursor).toBe(1);
  seed.mockRestore();
});
