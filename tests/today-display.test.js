const domain = require('../utils/domain');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let page;
let storage;
beforeEach(() => {
  jest.resetModules();
  storage = {};
  global.wx = {
    getStorageSync: key => storage[key],
    setStorageSync: jest.fn((key, value) => { storage[key] = value; }),
    removeStorageSync: jest.fn(key => { delete storage[key]; }),
    navigateTo: jest.fn(), setTabBarStyle: jest.fn(), showToast: jest.fn(),
  };
  global.Page = value => { page = value; };
  require('../pages/today/today');
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = patch => Object.assign(page.data, patch);
});
afterEach(() => { delete global.wx; delete global.Page; });

const plan = {
  id: 'plan', name: '真实计划', cursor: 1,
  cycleDays: [
    { dayId: 'a', name: '背部', exercises: [] },
    { dayId: 'b', name: '今天的胸部', exercises: [
      { exerciseId: '0025', name: '原计划动作名', equipment: 'barbell', sets: 4, targetWeight: 45, targetReps: 8 },
      { exerciseId: 'missing-id', name: '旧动作', equipment: 'body weight', sets: 2, targetWeight: 0, targetReps: 12 },
    ] },
  ],
};

test('首页在仅支持 JS 模块的小程序加载器下可注册，不依赖 Node 的 JSON require', () => {
  const filename = path.resolve(__dirname, '../pages/today/today.js');
  const register = jest.fn();
  const loadModule = request => {
    if (request.endsWith('.json')) {
      throw new Error(`module '${path.basename(request)}.js' is not defined, require args is '${request}'`);
    }
    return require(path.resolve(path.dirname(filename), request));
  };
  expect(() => vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: loadModule, Page: register,
  }, { filename })).not.toThrow();
  expect(register).toHaveBeenCalledTimes(1);
  expect(register.mock.calls[0][0].onShow).toEqual(expect.any(Function));
});

test('动作数量、组数、循环位置和下次训练使用当前计划真实数据', () => {
  const view = page.buildView(plan);
  expect(view).toMatchObject({ exerciseCount: 2, totalSets: 6, dayNum: '02', dayTotal: '02', nextDayName: '背部' });
  expect(view.exercises[0]).toMatchObject({ name: '原计划动作名', prescription: '4 × 8' });
  expect(view.exercises[0].note).toContain('45 kg');
  expect(view.exercises[0].imageSrc).toBe('');
  expect(view.exercises[1]).toMatchObject({ imageSrc: '', note: '自重 · 额外负重 0 kg' });
  expect(plan.cycleDays[1].exercises[0].imageSrc).toBeUndefined();
});

test('媒体加载失败清除对应缩略图以展示 glyph，不改变其他动作', () => {
  page.setData(page.buildView(plan));
  const second = page.data.exercises[1];
  page.onImageError({ currentTarget: { dataset: { index: 0 } } });
  expect(page.data.exercises[0].imageSrc).toBe('');
  expect(page.data.exercises[1]).toBe(second);
});

test('旧无 status 预填草稿显示零完成且不写回；新草稿只算实际完成', () => {
  const legacy = { planName: '旧计划', dayName: '旧训练日', exercises: [
    { sets: [{ weight: 40, reps: 10 }, { weight: 40, reps: 10 }] },
  ] };
  const before = JSON.stringify(legacy);
  expect(page.buildDraftInfo(legacy)).toMatchObject({ completed: 0, total: 2 });
  expect(JSON.stringify(legacy)).toBe(before);
  expect(wx.setStorageSync).not.toHaveBeenCalled();
  const draft = domain.snapshotSession(plan);
  draft.exercises[0].sets[0].status = 'completed';
  draft.exercises[0].sets[1].status = 'skipped';
  expect(page.buildDraftInfo(draft)).toMatchObject({ completed: 1, total: 5, planName: '真实计划', dayName: '今天的胸部' });
});

test('没有当前计划仍可恢复独立草稿，模板不把草稿放入 day 条件块', () => {
  const draft = domain.snapshotSession(plan);
  storage['fitness:trainingDraft'] = draft;
  page.setData(page.buildView(null));
  expect(page.data.day).toBeNull();
  page.onResumeDraft();
  expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/training/training' });
  expect(storage['fitness:trainingDraft'].id).toBe(draft.id);
  const template = fs.readFileSync('pages/today/today.wxml', 'utf8');
  expect(template).toMatch(/<\/block>\s*<!--[^]*?-->\s*<view wx:if="\{\{hasDraft\}\}"/);
});

test('已本地完成的残留草稿不能继续，即使清除存储失败也不导航', () => {
  const draft = domain.snapshotSession(plan);
  storage['fitness:trainingDraft'] = draft;
  storage['fitness:completedTraining'] = [draft];
  wx.removeStorageSync.mockImplementation(() => { throw new Error('full'); });
  page.onResumeDraft();
  expect(page.data.hasDraft).toBe(false);
  expect(wx.navigateTo).not.toHaveBeenCalled();
});

test('首页显示应用共享深色 tabBar，仍只刷新一次业务', () => {
  page.refresh = jest.fn();
  page.onShow();
  expect(page.refresh).toHaveBeenCalledTimes(1);
  expect(wx.setTabBarStyle).toHaveBeenCalledWith(expect.objectContaining({
    color: '#9aad9f', selectedColor: '#3ee6a0', backgroundColor: '#0b1612', borderStyle: 'black',
  }));
});
