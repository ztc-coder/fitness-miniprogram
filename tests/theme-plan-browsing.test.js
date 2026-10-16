const fs = require('fs');
const path = require('path');
let storage;
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function page(name) {
  let definition;
  global.Page = value => { definition = value; };
  require(`../pages/${name}/${name}`);
  return Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch) { Object.assign(this.data, patch); },
  });
}
const event = dataset => ({ currentTarget: { dataset } });
const settle = () => new Promise(resolve => setImmediate(resolve));
beforeEach(() => {
  jest.resetModules();
  storage = { 'fitness:settings': { theme: 'light', unit: 'kg' } };
  global.wx = {
    getStorageSync: key => storage[key],
    setStorageSync: jest.fn((key, value) => { storage[key] = value; }),
    cloud: { database() { throw new Error('offline'); } },
    showToast: jest.fn(), showModal: jest.fn(), navigateTo: jest.fn(),
  };
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); delete global.wx; delete global.Page; });

test('动作库返回时恢复主题而不重置筛选、分页或已打开详情，不写业务存储', () => {
  const library = page('library');
  library.onLoad({ planId: 'local_p', dayId: 'd' });
  library.onBodyPartFilterTap(event({ key: 'chest' }));
  library.onReachBottom();
  library.onItemTap(event({ id: library.data.items[0].id }));
  const before = JSON.parse(JSON.stringify(library.data));
  expect(library.data.theme).toBe('light');
  storage['fitness:settings'].theme = 'dark';
  library.onShow();
  expect(library.data).toEqual({ ...before, theme: 'dark' });
  storage['fitness:settings'].theme = 'light';
  library.onShow();
  expect(library.data).toEqual(before);
  expect(wx.setStorageSync).not.toHaveBeenCalled();
});

test('计划和训练日编辑往返恢复主题，已存目标、顺序与游标保持不变', async () => {
  const exercise = require('../data/exercises').EXERCISES[0];
  const plan = { id: 'local_p', name: '循环', cursor: 1, active: true, cycleDays: [
    { dayId: 'a', name: 'A', exercises: [] },
    { dayId: 'b', name: 'B', exercises: [{ exerciseId: exercise.id, name: exercise.nameZh,
      equipment: exercise.equipment, sets: 4, targetReps: 8, targetWeight: 42 }] },
  ] };
  storage['fitness:plans'] = [plan];
  storage['fitness:seedVersion'] = 3;
  storage['fitness:planMigrationVersion'] = 5;
  storage['fitness:planMigrationCloudSynced'] = 5;
  const before = JSON.stringify(plan);
  const plans = page('plan');
  plans.onShow();
  await settle();
  expect(plans.data.theme).toBe('light');
  plans.onToggleEdit();
  plans.onOpenDay(event({ dayid: 'b' }));
  expect(wx.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/plan-day/plan-day?planId=local_p&dayId=b' });
  const day = page('plan-day');
  day.onLoad({ planId: 'local_p', dayId: 'b' });
  day.onShow();
  await settle();
  expect(day.data.exercises[0].prescription).toContain('4 组 × 8 次');
  day.onAddExercise();
  expect(wx.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/library/library?planId=local_p&dayId=b' });
  storage['fitness:settings'].theme = 'dark';
  day.onShow(); plans.onShow();
  await settle();
  expect(day.data.theme).toBe('dark');
  expect(plans.data.theme).toBe('dark');
  expect(plans.data.editing).toBe(true);
  expect(plans.data.nextDay).toEqual({ num: '02', name: 'B' });
  expect(JSON.stringify(storage['fitness:plans'][0])).toBe(before);
});

test('新建与编辑原生提示浅色按钮可读，危险删除保留红色，深色参数不变', () => {
  const plans = page('plan');
  plans.onLoad();
  plans.onNewPlan();
  expect(wx.showModal.mock.calls.at(-1)[0]).toMatchObject({ confirmColor: '#3E5429', cancelColor: '#20262B' });
  plans.setData({ activePlan: { id: 'p' } });
  plans.onDeletePlan(event({ id: 'p' }));
  expect(wx.showModal.mock.calls.at(-1)[0]).toMatchObject({ confirmColor: '#d96a5b', cancelColor: '#20262B' });
  const day = page('plan-day');
  day.onLoad({ planId: 'p', dayId: 'd' });
  day.plan = { cycleDays: [{ dayId: 'd', exercises: [{ name: '卧推', sets: 4, targetReps: 8, targetWeight: 60 }] }] };
  day.onEditTarget(event({ index: 0 }));
  expect(wx.showModal.mock.calls.at(-1)[0]).toMatchObject({ confirmColor: '#3E5429', cancelColor: '#20262B', content: '4x8x60' });
  storage['fitness:settings'].theme = 'dark';
  plans.onLoad(); day.onLoad({ planId: 'p', dayId: 'd' });
  plans.onNewPlan();
  expect(wx.showModal.mock.calls.at(-1)[0]).not.toHaveProperty('confirmColor');
  day.onEditTarget(event({ index: 0 }));
  expect(wx.showModal.mock.calls.at(-1)[0]).not.toHaveProperty('cancelColor');
});

test('隔离动作详情公开主题属性默认深色，调用方显式传当前主题且模板加载浅色色板', () => {
  let detail;
  global.Component = definition => { detail = definition; };
  require('../components/exercise-detail/exercise-detail');
  delete global.Component;
  expect(detail.properties.theme).toEqual({ type: String, value: 'dark' });
  expect(read('components/exercise-detail/exercise-detail.wxml')).toContain('theme-{{theme}}');
  expect(read('components/exercise-detail/exercise-detail.wxss')).toContain('@import "../../styles/theme.wxss";');
  expect(read('pages/library/library.wxml')).toMatch(/<exercise-detail\s+theme="{{theme}}"/);
  for (const name of ['plan', 'plan-day', 'library']) {
    expect(read(`pages/${name}/${name}.wxml`)).toContain('class="page theme-{{theme}}"');
  }
});

// 仅检查原生渲染前提；不是颜色截图/原生外观证据。
function rule(file, selector) {
  const css = read(file);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped} \\{([^}]+)\\}`, 'm'));
  expect(match).not.toBeNull();
  return match[1];
}
test('局部 important 主按钮使用 action 语义而非状态绿或反馈渐变', () => {
  for (const name of ['plan', 'plan-day']) {
    const button = rule(`pages/${name}/${name}.wxss`, 'button.primary-button');
    expect(button).toContain('background: var(--action-background, var(--signal-gradient)) !important');
    expect(button).toContain('color: var(--action-ink, var(--signal-ink)) !important');
  }
  const primary = rule('components/exercise-detail/exercise-detail.wxss', '.detail-primary');
  expect(primary).toContain('background: var(--action-background, var(--signal-gradient)) !important');
  expect(primary).toContain('color: var(--action-ink, var(--signal-ink)) !important');
});

test('筛选、选择计划与当前循环状态浅色使用浅绿底和深绿字，不使用亮绿主按钮', () => {
  const file = 'pages/library/library.wxss';
  for (const selector of ['.theme-light .filter-pill.active', '.theme-light .picker-plan-pill.active']) {
    const selected = rule(file, selector);
    expect(selected).toContain('background: var(--signal-soft)');
    expect(selected).toContain('border-color: var(--signal-line)');
  }
  expect(rule(file, '.theme-light .filter-pill.active')).toContain('color: var(--signal) !important');
  expect(rule(file, '.theme-light .picker-plan-pill.active .picker-plan-label')).toContain('color: var(--signal)');
  const plan = 'pages/plan/plan.wxss';
  expect(rule(plan, '.theme-light .cycle-node.current')).toContain('background: var(--signal-soft)');
  expect(rule(plan, '.theme-light .status-chip')).toContain('color: var(--signal)');
  expect(rule(plan, '.theme-light .all-plan-badge')).toContain('background: var(--signal-soft)');
});

test('浅深色真实媒体白底不混色，媒体图托与占位分开', () => {
  for (const [file, selector] of [
    ['pages/library/library.wxss', '.library-art-image'],
    ['pages/plan-day/plan-day.wxss', '.exercise-thumb image'],
    ['components/exercise-detail/exercise-detail.wxss', '.detail-media'],
  ]) {
    expect(rule(file, selector)).toContain('background: #FFFFFF');
    expect(rule(file, selector)).toContain('mix-blend-mode: normal');
  }
  expect(rule('pages/library/library.wxss', '.library-art-wrap.has-media')).toContain('background: #FFFFFF');
  expect(rule('components/exercise-detail/exercise-detail.wxss', '.detail-art-wrap.has-media')).toContain('background: #FFFFFF');
  expect(read('pages/library/library.wxml')).toContain("library-art-wrap {{item.thumbSrc ? 'has-media' : ''}}");
  expect(read('components/exercise-detail/exercise-detail.wxml')).toContain("detail-art-wrap {{stageIndex < mediaStages.length ? 'has-media' : ''}}");
});

test('自绘弹层遮罩、NEXT、图标与危险操作浅色去除深色专属字面量', () => {
  expect(rule('pages/library/library.wxss', '.picker-mask')).toContain('var(--overlay, rgba(0, 0, 0, 0.68))');
  expect(rule('components/exercise-detail/exercise-detail.wxss', '.detail-mask')).toContain('var(--overlay, rgba(0, 0, 0, 0.68))');
  expect(rule('pages/plan/plan.wxss', '.plan-next')).toContain('var(--plan-next-background, rgba(8, 17, 14, 0.35))');
  expect(rule('pages/plan/plan.wxss', '.plan-row-icon')).toContain('var(--plan-icon-ink, #b9f3d8)');
  expect(rule('pages/plan/plan.wxss', '.theme-light')).toContain('--danger-soft: rgba(190, 68, 56, 0.08)');
  expect(rule('pages/plan-day/plan-day.wxss', '.theme-light')).toContain('--danger-soft: rgba(190, 68, 56, 0.08)');
});

test('浅色编辑目标、动作库加入后返回，持久化只改变目标与动作列表而不改变游标', async () => {
  wx.cloud.database = () => ({ collection: () => ({
    add: () => Promise.reject(new Error('offline')),
    orderBy: () => ({ get: () => Promise.reject(new Error('offline')) }),
  }) });
  const catalog = require('../data/exercises');
  const first = catalog.findById('0025');
  storage['fitness:plans'] = [{ id: 'local_p', name: '循环', cursor: 1, active: true, createdAt: 123,
    cycleDays: [ { dayId: 'a', name: 'A', exercises: [] }, { dayId: 'b', name: 'B', exercises: [
      { exerciseId: first.id, name: first.nameZh, equipment: first.equipment, sets: 3, targetReps: 10, targetWeight: 20 },
    ] } ] }];
  const day = page('plan-day');
  day.onLoad({ planId: 'local_p', dayId: 'b' }); day.onShow(); await settle();
  day.onEditTarget(event({ index: 0 }));
  wx.showModal.mock.calls.at(-1)[0].success({ confirm: true, content: '4x8x60' });
  await settle();
  const library = page('library');
  library.onLoad({ planId: 'local_p', dayId: 'b' });
  library.onQuickAdd(event({ id: '0251' }));
  await settle();
  storage['fitness:settings'].theme = 'dark';
  day.onShow(); await settle();
  expect(day.data.theme).toBe('dark');
  expect(day.data.exercises.map(item => item.exerciseId)).toEqual(['0025', '0251']);
  expect(day.data.exercises[0].prescription).toBe('4 组 × 8 次 · 60 kg');
  expect(storage['fitness:plans'][0]).toMatchObject({ cursor: 1, active: true, createdAt: 123 });
  expect(storage['fitness:plans'][0].cycleDays[1].exercises[1]).toMatchObject({ exerciseId: '0251', sets: 3, targetReps: 10, targetWeight: 0 });
  expect(storage['fitness:settings']).toEqual({ theme: 'dark', unit: 'kg' });
});
