const fs = require('fs');
const domain = require('../utils/domain');

function setup() {
  jest.resetModules();
  let page;
  global.Page = definition => { page = definition; };
  global.wx = {};
  require('../pages/training/training');
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = patch => Object.assign(page.data, patch);
  return page;
}

function draft() {
  return domain.snapshotSession({ id: 'plan', name: '真实计划', cursor: 1, cycleDays: [
    { dayId: 'rest', name: '休息', exercises: [] },
    { dayId: 'push', name: '胸 · 推日', exercises: [
      { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', sets: 3, targetWeight: 62.5, targetReps: 8 },
      { exerciseId: 'missing', name: '自定义动作', sets: 1, targetWeight: 0, targetReps: 12 },
    ] },
  ] });
}

afterEach(() => { delete global.Page; delete global.wx; });

test('real cursor drives active row, progress hint and next-set preview without changing session', () => {
  const page = setup();
  let session = draft();
  session = domain.completeTrainingSet(session, session.training.currentSetId, Date.now());
  session = domain.startTrainingRest(session, Date.now());
  const before = JSON.stringify(session);
  page.data.session = session;
  page.renderExercises();
  expect(page.data.session.dayIndex).toBe(1);
  expect(page.data.current.num).toBe(2);
  expect(page.data.progress).toMatchObject({ completed: 1, total: 4 });
  expect(page.data.exercises[0].sets.map(set => [set.isCurrent, set.isFuture])).toEqual([
    [false, false], [true, false], [false, true],
  ]);
  expect(page.data.nextSetPreview).toMatchObject({ name: '杠铃卧推', num: 2, prescription: '62.5 kg × 8' });
  expect(page.data.exercises[0]).toMatchObject({ equipmentText: '杠铃', muscleText: '胸大肌' });
  expect(JSON.stringify(session)).toBe(before);
});

test('preview follows cursor across exercises and clears when all pending sets are gone', () => {
  const page = setup();
  let session = domain.setExerciseSkipped(draft(), 0, true);
  page.data.session = session;
  page.renderExercises();
  expect(page.data.current).toMatchObject({ exIndex: 1, num: 1 });
  expect(page.data.nextSetPreview).toMatchObject({ name: '自定义动作', prescription: '0 kg × 12' });
  expect(page.data.nextSetPreview.thumbSrc).toBeFalsy();
  session = domain.setExerciseSkipped(session, 1, true);
  page.data.session = session;
  page.renderExercises();
  expect(page.data.current).toBeNull();
  expect(page.data.nextSetPreview).toBeNull();
});

test.each(['', null, -1, 'bad'])('missing or invalid preview weight %p does not fabricate a prescription', weight => {
  const page = setup();
  const session = draft();
  session.exercises[0].sets[0].weight = weight;
  page.data.session = session;
  page.renderExercises();
  expect(page.data.nextSetPreview.prescription).toBe('');
});

test('zero load and untouched future targets remain real read-only display values', () => {
  const page = setup();
  const session = draft();
  session.exercises[0].sets[0].weight = 0;
  page.data.session = session;
  page.renderExercises();
  expect(page.data.nextSetPreview.prescription).toBe('0 kg × 8');
  expect(page.data.exercises[0].sets[2].weight).toBe(62.5);
  expect(page.data.restTicks).toHaveLength(60);
  expect(page.data.restTicks[59]).toBe(354);
});

test('paused rest keeps the same cursor preview and valid target edits refresh it', () => {
  const page = setup();
  let session = draft();
  session = domain.completeTrainingSet(session, session.training.currentSetId, Date.now());
  session = domain.startTrainingRest(session, Date.now());
  session = domain.pauseTrainingRest(session, Date.now());
  session = domain.editTrainingSet(session, session.training.currentSetId, { weight: 65, reps: 6 });
  page.data.session = session;
  page.renderExercises();
  expect(page.data.restPaused).toBe(true);
  expect(page.data.nextSetPreview).toMatchObject({ num: 2, prescription: '65 kg × 6' });
});

test('board template keeps existing ring and editing bindings with accessible controls', () => {
  const wxml = fs.readFileSync('pages/training/training.wxml', 'utf8');
  const wxss = fs.readFileSync('pages/training/training.wxss', 'utf8');
  const json = JSON.parse(fs.readFileSync('pages/training/training.json', 'utf8'));
  expect(json.navigationBarTitleText).toBe('训练中');
  ['ringRight', 'ringLeft', 'onInputWeight', 'onInputReps', 'onToggleSet', 'onPauseRest', 'onResumeRest', 'onStartRest', 'onCollapseRest', 'aria-checked', 'nextSetPreview.prescription'].forEach(value => expect(wxml).toContain(value));
  expect(wxml).toContain('调整呼吸，恢复力量迎接下一组');
  expect(wxml).not.toContain('上次 60');
  ['pause-button', 'btn-more', 'set-input', 'preset', 'delete-button', 'add-set', 'rest-launch', 'collapse-button'].forEach(className => {
    const rules = [...wxss.matchAll(new RegExp(`[^{}]*\\.${className}[^{}]*\\{([^}]+)\\}`, 'g'))];
    expect(rules.some(rule => /min-height: (?:88|9\d|1\d\d)rpx/.test(rule[1]))).toBe(true);
  });
});

test('未来组不隐藏真实输入值，仅弱化样式', () => {
  const fs = require('fs');
  const wxml = fs.readFileSync('pages/training/training.wxml', 'utf8');
  const wxss = fs.readFileSync('pages/training/training.wxss', 'utf8');
  expect(wxml).not.toContain('future-dash');
  expect(wxss).not.toMatch(/\.is-future \.set-input\s*\{[^}]*opacity:\s*0/);
});

test('休息弹层内容独立滚动，继续按钮固定在滚动区外且保留禁用条件', () => {
  const wxml = fs.readFileSync('pages/training/training.wxml', 'utf8');
  const bodyStart = wxml.indexOf('<scroll-view class="rest-body"');
  const bodyEnd = wxml.indexOf('</scroll-view>', bodyStart);
  const footer = wxml.indexOf('<view class="rest-footer">', bodyEnd);
  expect(bodyStart).toBeGreaterThan(-1);
  expect(footer).toBeGreaterThan(bodyEnd);
  expect(wxml.indexOf('class="primary-button end-rest"', footer)).toBeGreaterThan(footer);
  expect(wxml).toContain('bindtap="onSkipRest" disabled="{{reloadBlocked || submitting || confirming || phase === \'paused\'}}"');
});

test('真实缩略图白底且占位保留薄荷底，只有聚焦输入高亮而不同时强调整行两列', () => {
  const wxss = fs.readFileSync('pages/training/training.wxss', 'utf8');
  expect(wxss).toMatch(/\.ex-thumb-img\s*\{[^}]*mix-blend-mode:\s*normal;[^}]*background:\s*#FFFFFF;/);
  expect(wxss).toMatch(/\.preview-image\s*\{[^}]*mix-blend-mode:\s*normal;[^}]*background:\s*#FFFFFF;/);
  expect(wxss).not.toContain('.is-current .set-input,');
});
