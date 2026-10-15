const fs = require('fs');
const domain = require('../utils/domain');

let page;
let db;
beforeEach(() => {
  jest.resetModules();
  global.wx = { getStorageSync: jest.fn(), setStorageSync: jest.fn(), switchTab: jest.fn() };
  global.Page = definition => { page = definition; };
  require('../pages/today/today');
  db = require('../utils/db');
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = patch => Object.assign(page.data, patch);
});
afterEach(() => {
  jest.restoreAllMocks();
  delete global.wx;
  delete global.Page;
});

const plan = {
  id: 'plan', name: '真实循环', active: true, cursor: 1,
  cycleDays: [
    { name: '背 · 拉日', exercises: [] },
    { name: '胸 · 推日', exercises: [
      { exerciseId: '0025', name: '原动作', equipment: 'barbell', sets: 3, targetReps: 10 },
      { exerciseId: 'missing', name: '自定义动作', equipment: 'body weight', sets: 2, targetReps: 8 },
    ] },
    { name: '腿日', exercises: [] },
  ],
};

test.each([
  [new Date(2026, 9, 14, 12).getTime(), '10月14日 · 周三'],
  [new Date(2026, 0, 3, 12).getTime(), '1月3日 · 周六'],
])('刷新使用当前本地日期而不是设计稿常量', async (now, expected) => {
  jest.spyOn(Date, 'now').mockReturnValue(now);
  jest.spyOn(db, 'ensureSeedPlans').mockResolvedValue([plan]);
  page.refresh();
  await Promise.resolve();
  expect(page.data.dateLine).toBe(expected);
  expect(page.data.day.name).toBe('胸 · 推日');
  expect(page.data.plan.name).toBe('真实循环');
  expect(wx.setStorageSync).not.toHaveBeenCalled();
});

test('器械和部位标签只派生展示，不改处方、循环状态或源计划', () => {
  const before = JSON.stringify(plan);
  const view = page.buildView(plan);
  expect(view.dayNum).toBe('02');
  expect(view.cycleDots.map(dot => dot.state)).toEqual(['done', 'current', '']);
  expect(view.exercises[0]).toMatchObject({ equipmentLabel: '杠铃', prescription: '3 × 10' });
  expect(view.exercises[0].bodyPartLabel).toBeTruthy();
  expect(view.exercises[1]).toMatchObject({ equipmentLabel: '自重', bodyPartLabel: '', prescription: '2 × 8' });
  expect(JSON.stringify(plan)).toBe(before);
  expect(page.buildView(null).cycleDots).toEqual([]);
});

test('草稿继续使用领域进度，跳过的组不算已完成，不改写草稿', () => {
  const draft = domain.snapshotSession(plan);
  draft.exercises[0].sets[0].status = 'completed';
  draft.exercises[0].sets[1].status = 'skipped';
  const before = JSON.stringify(draft);
  expect(page.buildDraftInfo(draft)).toMatchObject({ dayName: '胸 · 推日', completed: 1, total: 4 });
  expect(JSON.stringify(draft)).toBe(before);
  expect(wx.setStorageSync).not.toHaveBeenCalled();
});

test('计划入口复用既有导航，展示模板保留草稿和启动条件', () => {
  page.onGoPlan();
  expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/plan/plan' });
  const template = fs.readFileSync('pages/today/today.wxml', 'utf8');
  expect(template).toContain('训练进行中 · {{draftInfo.dayName}}');
  expect(template).toContain('{{draftInfo.completed}} / {{draftInfo.total}} 组');
  expect(template).toContain('查看完整计划');
  expect(template).toContain('按当前计划重新开始');
  expect(template).toContain('wx:elif="{{day}}"');
  expect(template).toContain('bindtap="onResumeDraft" disabled="{{starting}}"');
  expect(template).toContain('bindtap="onStartTraining" disabled="{{starting}}"');
  expect(template).toContain('data-index="{{index}}" binderror="onImageError"');
  expect(JSON.parse(fs.readFileSync('pages/today/today.json', 'utf8')).navigationBarTitleText).toBe('FORGE');
});

test('加载后的动作图片沿用动作库的混合模式，保留薄荷图托', () => {
  const style = fs.readFileSync('pages/today/today.wxss', 'utf8');
  expect(style).toMatch(/\.exercise-image\s*\{[^}]*mix-blend-mode:\s*multiply/);
});

test('同名训练日保留草稿所属计划，并展示当前动作数、总组数和目标重量', () => {
  const otherPlan = { ...plan, name: '旧计划' };
  const draft = domain.snapshotSession(otherPlan);
  const info = page.buildDraftInfo(draft);
  expect(info).toMatchObject({ planName: '旧计划', dayName: plan.cycleDays[1].name });
  const view = page.buildView(plan);
  expect(view).toMatchObject({ exerciseCount: 2, totalSets: 5 });
  expect(view.exercises[0].note).toContain('kg');
  expect(view.exercises[1].note).toContain('额外负重');
  const template = fs.readFileSync('pages/today/today.wxml', 'utf8');
  expect(template).toContain('{{draftInfo.planName}} · {{draftInfo.dayName}}');
  ['{{exerciseCount}}', '{{totalSets}}', '{{item.note}}'].forEach(value => expect(template).toContain(value));
});
