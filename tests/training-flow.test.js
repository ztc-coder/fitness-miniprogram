const domain = require('../utils/domain');
const DRAFT_KEY = 'fitness:trainingDraft';
let page;
let storage;
let audio;
const event = (dataset, value) => ({ currentTarget: { dataset }, detail: { value } });

function load(draft) {
  storage.set(DRAFT_KEY, draft);
  page.onLoad();
  page.onShow();
}

function draft(sets = 2) {
  return domain.snapshotSession({ id: 'plan', name: '计划', cursor: 0, cycleDays: [
    { dayId: 'day', name: '推', exercises: [
      { exerciseId: '0025', name: '卧推', equipment: 'barbell', sets, targetWeight: 40, targetReps: 10 },
    ] },
  ] });
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers().setSystemTime(1000000);
  storage = new Map();
  audio = { play: jest.fn(), destroy: jest.fn(), onError: jest.fn() };
  global.wx = {
    getStorageSync: jest.fn((key) => storage.get(key)),
    setStorageSync: jest.fn((key, value) => storage.set(key, JSON.parse(JSON.stringify(value)))),
    removeStorageSync: jest.fn((key) => storage.delete(key)),
    showToast: jest.fn(), navigateBack: jest.fn(), navigateTo: jest.fn(), switchTab: jest.fn(),
    showActionSheet: jest.fn(), showModal: jest.fn(), createInnerAudioContext: jest.fn(() => audio), vibrateShort: jest.fn(),
    getNetworkType: jest.fn(({ success }) => success({ networkType: 'none' })),
    cloud: { database: jest.fn(() => {
      return { collection: (name) => {
        const query = { orderBy: () => query, limit: () => query,
          get: () => name === 'sessions' ? new Promise(() => {}) : Promise.reject(new Error('offline')) };
        return query;
      } };
    }) },
  };
  global.Page = (definition) => { page = definition; };
  require('../pages/training/training');
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = (patch, callback) => {
    Object.assign(page.data, patch);
    if (callback) callback();
  };
});

afterEach(() => {
  if (page.onUnload) page.onUnload();
  jest.useRealTimers();
  delete global.Page;
  delete global.wx;
});

const setIds = () => page.data.session.exercises.flatMap(ex => ex.sets.map(set => set.id));
const toggle = setId => page.onToggleSet(event({ setId }));
const modal = () => wx.showModal.mock.calls.at(-1)[0];
const queue = () => require('../utils/queue');

function reloadPage() {
  global.Page = definition => { page = definition; };
  jest.isolateModules(() => require('../pages/training/training'));
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = (patch, callback) => { Object.assign(page.data, patch); if (callback) callback(); };
  page.onLoad(); page.onShow();
}

test('预填不是打卡，旧无状态草稿显式升级为v2；直接勾选不自动间歇', () => {
  const old = draft();
  delete old.flowVersion; delete old.training;
  old.exercises.forEach(ex => { delete ex.flowVersion; ex.sets.forEach(set => { delete set.id; delete set.status; }); });
  load(old);
  expect(page.data.progressPct).toBe(0);
  expect(page.data.canFinish).toBe(false);
  expect(storage.get(DRAFT_KEY).flowVersion).toBe(2);
  toggle(setIds()[1]);
  expect(page.data.progressPct).toBe(50);
  expect(page.data.canFinish).toBe(true);
  expect(page.data.restActive).toBe(false);
  expect(page.data.session.training.restEndsAt).toBeNull();
});

test('任意动作任意顺序完成和取消，取消非最近组保留成绩，不自动开始间歇', () => {
  load(domain.addSessionExercise(draft(3), { exerciseId: '0043', name: '第二动作', equipment: 'barbell' }));
  const [first, middle, last, second] = setIds();
  page.onInputWeight(event({ setId: second }, '20'));
  page.onInputReps(event({ setId: second }, '5'));
  toggle(second); toggle(last); toggle(first);
  expect(page.data.progress.completed).toBe(3);
  toggle(second); toggle(first);
  expect(page.data.progress.completed).toBe(1);
  expect(page.data.session.exercises[0].sets[0]).toMatchObject({ status: 'pending', weight: 40, reps: 10 });
  expect(page.data.session.exercises[0].sets[2].status).toBe('completed');
  toggle(middle);
  expect(page.data.restActive).toBe(false);
  expect(audio.play).not.toHaveBeenCalled();
});

test('完成或待练输入本地保存失败不假报成功，保留已保存状态并可重试', () => {
  load(draft());
  const [first, second] = setIds();
  wx.setStorageSync.mockImplementationOnce(() => { throw new Error('full'); });
  expect(() => toggle(first)).not.toThrow();
  expect(page.data.progressPct).toBe(0);
  expect(page.data.errorText).toMatch(/保存/);
  expect(storage.get(DRAFT_KEY).exercises[0].sets[0].status).toBe('pending');
  toggle(first);
  expect(page.data.progressPct).toBe(50);
  wx.setStorageSync.mockImplementationOnce(() => { throw new Error('full'); });
  page.onInputWeight(event({ setId: second }, '55'));
  expect(page.data.session.exercises[0].sets[1].weight).toBe(40);
  expect(page.data.errorText).toMatch(/保存/);
  page.onInputWeight(event({ setId: second }, '55'));
  expect(page.data.session.exercises[0].sets[1].weight).toBe('55');
});

test('已完成组行内原子纠错，无效临时输入拒绝保存；取消勾选可保留临时输入', () => {
  load(draft(3));
  const [first, second] = setIds();
  toggle(first); page.onStartRest();
  const deadline = page.data.session.training.restEndsAt;
  page.onInputWeight(event({ setId: first }, ''));
  page.onInputReps(event({ setId: first }, '8'));
  page.onInputBlur();
  expect(page.data.session.exercises[0].sets[0]).toMatchObject({ weight: 40, reps: 10, status: 'completed' });
  expect(storage.get(DRAFT_KEY).exercises[0].sets[0]).toMatchObject({ weight: 40, reps: 10 });
  expect(page.data.errorText).toMatch(/无效/);
  page.onInputWeight(event({ setId: first }, '52.5'));
  page.onInputBlur();
  expect(page.data.session.exercises[0].sets[0]).toMatchObject({ weight: 52.5, reps: 8, status: 'completed' });
  page.onRemoveSet(event({ setId: first }));
  expect(page.data.session.exercises[0].sets).toHaveLength(3);
  toggle(second);
  page.onInputWeight(event({ setId: first }, ''));
  toggle(first);
  expect(page.data.session.exercises[0].sets[0]).toMatchObject({ weight: '', reps: 8, status: 'pending' });
  expect(page.data.session.training.restEndsAt).toBe(deadline);
  expect(page.data.progress.completed).toBe(1);
});

test('多组临时编辑flush原子校验，一组无效不能部分保存另一组；修正后一起保存', () => {
  load(draft());
  const [first, second] = setIds(); toggle(first); toggle(second);
  page.onInputWeight(event({ setId: first }, '50'));
  page.onInputReps(event({ setId: second }, '0'));
  expect(page.flushInputEdits()).toBe(false);
  expect(page.data.session.exercises[0].sets.map(set => set.weight)).toEqual([40, 40]);
  expect(page.data.session.exercises[0].sets[1].reps).toBe(10);
  page.onInputReps(event({ setId: second }, '12'));
  expect(page.flushInputEdits()).toBe(true);
  expect(storage.get(DRAFT_KEY).exercises[0].sets[0].weight).toBe(50);
  expect(storage.get(DRAFT_KEY).exercises[0].sets[1].reps).toBe(12);
});

test('已完成输入保存失败保留原成绩和临时编辑，重试blur保存；隐藏时flush合法编辑', () => {
  load(draft()); const [first] = setIds(); toggle(first);
  page.onInputWeight(event({ setId: first }, '55'));
  wx.setStorageSync.mockImplementationOnce(() => { throw Error('full'); });
  page.onInputBlur();
  expect(page.data.session.exercises[0].sets[0].weight).toBe(40);
  expect(page.data.errorText).toMatch(/保存/);
  page.onInputBlur();
  expect(page.data.session.exercises[0].sets[0].weight).toBe(55);
  page.onInputReps(event({ setId: first }, '8')); page.onHide();
  expect(storage.get(DRAFT_KEY).exercises[0].sets[0].reps).toBe(8);
});

test('删中间组不漂移成绩引用，新加组沿用末组数值，至少保留一组', () => {
  load(draft(3)); const [first, middle, last] = setIds();
  page.onInputWeight(event({ setId: last }, '60')); page.onInputReps(event({ setId: last }, '6'));
  toggle(last); page.onRemoveSet(event({ setId: middle }));
  expect(setIds()).toEqual([first, last]);
  page.onAddSet(event({ anchorId: first }));
  expect(page.data.session.exercises[0].sets[2]).toMatchObject({ status: 'pending', weight: 60, reps: 6 });
  expect(setIds()[2]).not.toBe(middle);
  page.onRemoveSet(event({ setId: first }));
  page.onRemoveSet(event({ setId: setIds()[1] }));
  expect(setIds()).toEqual([last]);
  toggle(last); page.onRemoveSet(event({ setId: last }));
  expect(setIds()).toEqual([last]);
});

test('部分跳过保留成绩，恢复和加组增加pending但仍可确认结束；菜单不能移除练过动作', () => {
  load(draft(3)); const [anchorId] = setIds(); toggle(anchorId);
  page.onSkipExercise(event({ anchorId }));
  wx.showActionSheet.mock.calls.at(-1)[0].success({ tapIndex: 0 });
  expect(page.data.progress).toMatchObject({ completed: 1, skipped: 2, total: 1 });
  expect(page.data.exercises[0].volume).toBe(400);
  expect(page.data.canFinish).toBe(true);
  page.onSkipExercise(event({ anchorId }));
  wx.showActionSheet.mock.calls.at(-1)[0].success({ tapIndex: 2 });
  expect(page.data.exercises).toHaveLength(1);
  expect(page.data.errorText).toMatch(/移除/);
  page.onSkipExercise(event({ anchorId }));
  wx.showActionSheet.mock.calls.at(-1)[0].success({ tapIndex: 1 });
  expect(page.data.progress).toMatchObject({ completed: 1, pending: 2, skipped: 0 });
  expect(page.data.canFinish).toBe(true);
  page.onAddSet(event({ anchorId }));
  expect(page.data.progress.pending).toBe(3);
});

test('菜单打开后列表变更仍按稳定引用操作，输入不受原下标漂移影响', () => {
  load(domain.addSessionExercise(draft(1), { exerciseId: '0043', name: '第二个动作', equipment: 'barbell' }));
  const [first, second] = page.data.exercises.map(ex => ex.anchorId);
  page.onSkipExercise(event({ anchorId: second }));
  const secondMenu = wx.showActionSheet.mock.calls.at(-1)[0];
  page.onSkipExercise(event({ anchorId: first }));
  wx.showActionSheet.mock.calls.at(-1)[0].success({ tapIndex: 2 });
  secondMenu.success({ tapIndex: 0 });
  expect(page.data.exercises).toHaveLength(1);
  expect(page.data.exercises[0].sets[0].status).toBe('skipped');
  page.onSkipExercise(event({ anchorId: second }));
  wx.showActionSheet.mock.calls.at(-1)[0].success({ tapIndex: 1 });
  page.onInputWeight(event({ setId: second }, '25')); page.onInputReps(event({ setId: second }, '12'));
  expect(page.data.session.exercises[0].sets[0]).toMatchObject({ weight: '25', reps: '12' });
});

test.each([
  ['weight', ''], ['weight', '-1'], ['weight', 'Infinity'], ['weight', 'foo'],
  ['reps', ''], ['reps', '0'], ['reps', '-2'], ['reps', '2.5'],
])('待练非法%s=%s不能打卡，预填不计成绩', (field, value) => {
  load(draft()); const setId = setIds()[1];
  if (field === 'weight') page.onInputWeight(event({ setId }, value));
  else page.onInputReps(event({ setId }, value));
  toggle(setId);
  expect(page.data.progress.completed).toBe(0);
  expect(page.data.errorText).toMatch(/合法成绩/);
  expect(page.data.session.training.restEndsAt).toBeNull();
  expect(page.data.canFinish).toBe(false);
});

test('自重空重量归零打卡；全部完成后加组pending，新增组不计成绩', () => {
  const body = draft(1); body.exercises[0].equipment = 'body weight'; load(body);
  const [setId] = setIds(); page.onInputWeight(event({ setId }, '')); toggle(setId);
  expect(page.data.session.exercises[0].sets[0].weight).toBe(0);
  page.onAddSet(event({ anchorId: setId }));
  expect(page.data.canFinish).toBe(true);
  expect(page.data.phase).toBe('ready');
  expect(page.data.progress).toMatchObject({ completed: 1, pending: 1 });
  expect(page.data.exercises[0].volume).toBe(10);
});

test('手动间歇展开/收起，记录操作不改变截止；最后组完成后仍可开始间歇', () => {
  load(draft()); const [first, second] = setIds(); toggle(first);
  expect(page.data.restActive).toBe(false);
  page.onStartRest();
  expect(page.data.restExpanded).toBe(true);
  expect(page.data.restText).toBe('01:30');
  const deadline = page.data.session.training.restEndsAt;
  page.onCollapseRest(); expect(page.data.restExpanded).toBe(false);
  page.onExpandRest(); expect(page.data.restExpanded).toBe(true);
  page.onInputWeight(event({ setId: second }, '50')); toggle(second);
  page.onInputReps(event({ setId: first }, '8')); page.onInputBlur();
  toggle(first);
  expect(page.data.session.training.restEndsAt).toBe(deadline);
  toggle(first); page.onSkipRest();
  expect(page.data.phase).toBe('finished');
  expect(audio.play).not.toHaveBeenCalled();
  jest.advanceTimersByTime(10000); page.onStartRest();
  expect(page.data.restActive).toBe(true);
  expect(page.data.session.training.restEndsAt).toBe(Date.now() + 90000);
  expect(page.data.canFinish).toBe(true);
});

test('手动重启按本场基准计时，preset/±15保存基准，下场默认90秒', () => {
  load(draft()); toggle(setIds()[0]);
  page.onRestPreset(event({ seconds: 120 })); page.onStartRest();
  jest.advanceTimersByTime(20000);
  expect(page.data.restText).toBe('01:40');
  page.onAdjustRest(event({ delta: 15 }));
  expect(page.data.restText).toBe('01:55');
  expect(page.data.restSeconds).toBe(135);
  page.onStartRest(); expect(page.data.restText).toBe('02:15');
  page.onRestPreset(event({ seconds: 60 })); expect(page.data.restText).toBe('01:00');
  expect(storage.get(DRAFT_KEY).training.restSeconds).toBe(60);
  page.onHide(); load(draft()); expect(page.data.restSeconds).toBe(90);
});

test('独立暂停仍允许记录；整场暂停恢复不误启动原本独立暂停的间歇', () => {
  load(draft(3)); const [first, second, third] = setIds(); toggle(first); page.onStartRest();
  jest.advanceTimersByTime(50000); page.onPauseRest();
  expect(page.data.restText).toBe('00:40');
  expect(page.data.restPaused).toBe(true);
  toggle(third); page.onInputWeight(event({ setId: second }, '50'));
  expect(page.data.progress.completed).toBe(2);
  page.onPause();
  toggle(second); page.onInputWeight(event({ setId: second }, '99')); page.onStartRest(); page.onResumeRest();
  expect(page.data.progress.completed).toBe(2);
  expect(page.data.session.exercises[0].sets[1].weight).toBe('50');
  page.onHide(); jest.advanceTimersByTime(60000); page.onShow(); page.onResume();
  expect(page.data.restPaused).toBe(true);
  expect(page.data.restText).toBe('00:40');
  expect(page.data.session.training.restEndsAt).toBeNull();
  jest.advanceTimersByTime(30000); expect(page.data.restText).toBe('00:40');
  page.onResumeRest(); jest.advanceTimersByTime(10000);
  expect(page.data.restText).toBe('00:30');
  expect(audio.play).not.toHaveBeenCalled();
});

test('整场暂停运行中的间歇冻结，继续整场才恢复；冷启动仍需显式继续', () => {
  load(draft()); const [first, second] = setIds(); toggle(first); page.onStartRest();
  jest.advanceTimersByTime(50000); page.onPause(); page.onHide();
  jest.advanceTimersByTime(180000); reloadPage();
  expect(page.data.phase).toBe('paused'); expect(page.data.restText).toBe('00:40');
  toggle(second); page.onStartRest();
  expect(page.data.progress.completed).toBe(1); expect(page.data.phase).toBe('paused');
  page.onResume();
  expect(page.data.phase).toBe('rest'); expect(page.data.restText).toBe('00:40');
  expect(page.data.restPaused).toBe(false);
  jest.advanceTimersByTime(10000); expect(page.data.restText).toBe('00:30');
});

test('隐藏不改截止，返回读取加练并校准；到时先保存再提醒一次，重复show只有一个timer', () => {
  load(draft()); toggle(setIds()[0]); page.onStartRest();
  const deadline = page.data.session.training.restEndsAt; page.onHide();
  expect(jest.getTimerCount()).toBe(0);
  expect(storage.get(DRAFT_KEY).training.restEndsAt).toBe(deadline);
  storage.set(DRAFT_KEY, domain.addSessionExercise(storage.get(DRAFT_KEY), { exerciseId: '0026', name: '加练', equipment: 'barbell' }));
  jest.setSystemTime(deadline + 1000);
  audio.play.mockImplementation(() => expect(storage.get(DRAFT_KEY).training.restNotified).toBe(true));
  page.onShow();
  expect(page.data.exercises).toHaveLength(2); expect(page.data.phase).toBe('ready');
  expect(page.data.restMessage).toMatch(/间歇结束/);
  expect(audio.play).toHaveBeenCalledTimes(1); expect(wx.vibrateShort).toHaveBeenCalledTimes(1);
  page.onShow(); page.onShow();
  expect(jest.getTimerCount()).toBe(1); expect(audio.play).toHaveBeenCalledTimes(1);
  page.onHide(); expect(audio.destroy).toHaveBeenCalledTimes(1);
});

test('tick保存失败不认领到时，重试后提醒；声音与振动异常不阻塞且不重响', () => {
  load(draft()); toggle(setIds()[0]); page.onStartRest();
  wx.setStorageSync.mockImplementationOnce(() => { throw Error('full'); });
  audio.play.mockImplementation(() => { throw Error('audio'); });
  wx.vibrateShort.mockImplementation(() => { throw Error('unsupported'); });
  jest.advanceTimersByTime(90000);
  expect(page.data.phase).toBe('rest'); expect(page.data.errorText).toMatch(/保存/);
  expect(page.data.restMessage).toBe(''); expect(audio.play).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1000);
  expect(page.data.phase).toBe('ready'); expect(page.data.restMessage).toMatch(/间歇结束/);
  expect(audio.play).toHaveBeenCalledTimes(1);
  audio.onError.mock.calls[0][0]({ errCode: 10003 }); jest.advanceTimersByTime(5000);
  expect(audio.play).toHaveBeenCalledTimes(1);
  toggle(setIds()[1]); expect(page.data.progress.completed).toBe(2);
});

test('重进已认领提醒草稿保留提示不再响，完成下一组不自动提醒', () => {
  let session = draft(); const first = session.exercises[0].sets[0].id;
  session = domain.completeTrainingSet(session, first, Date.now());
  session = domain.startTrainingRest(session, Date.now());
  session = domain.tickTrainingRest(session, Date.now() + 90000);
  load(session);
  expect(page.data.restMessage).toMatch(/间歇结束/); expect(audio.play).not.toHaveBeenCalled();
  toggle(setIds()[1]); expect(page.data.canFinish).toBe(true); expect(audio.play).not.toHaveBeenCalled();
});

test('减至零到时更新本场默认间歇，振动fail与音频onError只降级', () => {
  load(draft()); toggle(setIds()[0]); page.onStartRest();
  wx.vibrateShort.mockImplementation(({ fail }) => fail({ errMsg: 'style is not support' }));
  for (let i = 0; i < 6; i += 1) page.onAdjustRest(event({ delta: -15 }));
  expect(page.data.phase).toBe('ready'); expect(page.data.restSeconds).toBe(0);
  expect(page.data.restText).toBe('00:00'); expect(page.data.restMessage).toMatch(/间歇结束/);
  expect(audio.play).toHaveBeenCalledTimes(1);
  audio.onError.mock.calls[0][0]({ errCode: 10004 }); page.onShow(); page.onShow();
  expect(audio.play).toHaveBeenCalledTimes(1);
  toggle(setIds()[1]); expect(audio.play).toHaveBeenCalledTimes(1);
});

test('连续零秒手动间歇各提醒一次，记录与重复show不提醒，保存失败不认领', () => {
  load(draft(3)); toggle(setIds()[0]);
  for (let i = 0; i < 6; i += 1) page.onAdjustRest(event({ delta: -15 }));
  page.onStartRest(); expect(audio.play).toHaveBeenCalledTimes(1);
  toggle(setIds()[1]); toggle(setIds()[0]); page.onShow();
  expect(audio.play).toHaveBeenCalledTimes(1);
  page.onStartRest(); expect(audio.play).toHaveBeenCalledTimes(2);
  wx.setStorageSync.mockImplementationOnce(() => { throw Error('full'); });
  page.onStartRest(); expect(audio.play).toHaveBeenCalledTimes(2);
  page.onStartRest(); page.onShow(); jest.advanceTimersByTime(2000);
  expect(audio.play).toHaveBeenCalledTimes(3); expect(wx.vibrateShort).toHaveBeenCalledTimes(3);
});

test('零完成或全跳过不能结束，不弹确认也不创建空小结', () => {
  load(draft()); page.onFinish();
  expect(wx.showModal).not.toHaveBeenCalled(); expect(page.data.errorText).toMatch(/至少完成一组/);
  const [anchorId] = setIds(); page.onSkipExercise(event({ anchorId }));
  wx.showActionSheet.mock.calls.at(-1)[0].success({ tapIndex: 0 }); page.onFinish();
  expect(page.data.submitting).toBe(false); expect(page.data.showSummary).toBe(false);
  expect(queue().getQueue()).toHaveLength(0);
});

test('部分结束取消不改变草稿、间歇或入队，确认期间重复点击与编辑被阻止', async () => {
  load(draft(3)); const [first, second] = setIds(); toggle(first); page.onStartRest();
  const saved = JSON.parse(JSON.stringify(storage.get(DRAFT_KEY)));
  const finishing = page.onFinish();
  expect(modal().content).toMatch(/已完成 1 组.*剩余 2 组/);
  expect(page.data.confirming).toBe(true);
  page.onFinish(); toggle(second); page.onAddSet(event({ anchorId: first }));
  page.onInputWeight(event({ setId: second }, '99')); page.onPause(); page.onStartRest();
  expect(wx.showModal).toHaveBeenCalledTimes(1);
  modal().success({ confirm: false, cancel: true }); await finishing;
  expect(page.data.confirming).toBe(false); expect(page.data.showSummary).toBe(false);
  expect(storage.get(DRAFT_KEY)).toEqual(saved); expect(page.data.session).toEqual(saved);
  expect(queue().getCompletedSession(saved.id)).toBeNull(); expect(queue().getQueue()).toHaveLength(0);
  toggle(second); expect(page.data.progress.completed).toBe(2);
});

test('部分结束确认统一跳过pending，只提交实际成绩，重复回调/点击只完成一次', async () => {
  storage.set('fitness:plans', [{ id: 'plan', cursor: 0, cycleDays: [{ dayId: 'day' }, { dayId: 'next' }] }]);
  load(draft(3)); const [first] = setIds(); toggle(first); page.onStartRest();
  const id = page.data.session.id;
  const finishing = page.onFinish(); const confirmation = modal();
  confirmation.success({ confirm: true }); confirmation.success({ confirm: true }); page.onFinish();
  await finishing;
  expect(page.data.showSummary).toBe(true);
  expect(page.data.summary).toMatchObject({ completedSets: 1, exerciseCount: 1, weightedVolume: '400', bodyWeightReps: '0' });
  const completed = queue().getCompletedSession(id);
  expect(completed.exercises[0].sets.map(set => set.status)).toEqual(['completed', 'skipped', 'skipped']);
  expect(completed.training).toBeUndefined(); expect(queue().getQueue()).toHaveLength(1);
  expect(require('../utils/db').getLocalPlans()[0].cursor).toBe(1);
  expect(jest.getTimerCount()).toBe(0); expect(audio.play).not.toHaveBeenCalled();
});

test.each(['changed', 'missing', 'read-error'])('确认时草稿%s拒绝旧快照完成，不丢外部修改', async mode => {
  load(draft()); toggle(setIds()[0]); const id = page.data.session.id;
  const finishing = page.onFinish();
  if (mode === 'changed') storage.set(DRAFT_KEY, domain.addSessionExercise(storage.get(DRAFT_KEY), { exerciseId: '0043', name: '加练', equipment: 'barbell' }));
  if (mode === 'missing') storage.delete(DRAFT_KEY);
  if (mode === 'read-error') wx.getStorageSync.mockImplementationOnce(() => { throw Error('read'); });
  modal().success({ confirm: true }); await finishing;
  expect(page.data.showSummary).toBe(false); expect(page.data.confirming).toBe(false);
  expect(queue().getCompletedSession(id)).toBeNull(); expect(queue().getQueue()).toHaveLength(0);
  if (mode === 'changed') {
    expect(storage.get(DRAFT_KEY).exercises).toHaveLength(2);
    expect(page.data.exercises).toHaveLength(2);
    expect(page.data.progress.pending).toBeGreaterThan(1);
  } else expect(page.data.reloadBlocked).toBe(true);
});

test('弹窗fail解除锁可再次确认，卸载后确认回调不能完成', async () => {
  load(draft()); toggle(setIds()[0]); const id = page.data.session.id;
  const failed = page.onFinish(); modal().fail({ errMsg: 'cancelled' }); await failed;
  expect(page.data.confirming).toBe(false);
  const finishing = page.onFinish(); page.onUnload(); modal().success({ confirm: true }); await finishing;
  expect(queue().getCompletedSession(id)).toBeNull(); expect(jest.getTimerCount()).toBe(0);
});

test('部分结束本地完成失败不丢pending/间歇，重新确认可重试', async () => {
  load(draft(3)); toggle(setIds()[0]); page.onStartRest();
  const saved = JSON.parse(JSON.stringify(storage.get(DRAFT_KEY)));
  const finishing = page.onFinish();
  wx.setStorageSync.mockImplementationOnce(() => { throw Error('full'); });
  modal().success({ confirm: true }); await finishing;
  expect(page.data.showSummary).toBe(false); expect(page.data.submitting).toBe(false);
  expect(page.data.errorText).toMatch(/训练仍为草稿/);
  expect(page.data.session).toEqual(saved); expect(storage.get(DRAFT_KEY)).toEqual(saved);
  expect(page.data.progress).toMatchObject({ completed: 1, pending: 2 });
  expect(queue().getCompletedSession(saved.id)).toBeNull();
  const retry = page.onFinish(); modal().success({ confirm: true }); await retry;
  expect(page.data.showSummary).toBe(true); expect(queue().getQueue()).toHaveLength(1);
});

test('无pending真实queue立即显示固定小结，不等云；双击与编辑被锁，残留草稿重进显示原小结', async () => {
  storage.set('fitness:plans', [{ id: 'plan', cursor: 0, cycleDays: [{ dayId: 'day' }, { dayId: 'next' }] }]);
  load(draft(1)); const [anchorId] = setIds(); toggle(anchorId);
  const saved = page.data.session;
  wx.removeStorageSync.mockImplementation(() => { throw Error('residual'); });
  const completion = page.onFinish(); page.onFinish();
  page.onAddSet(event({ anchorId })); page.onAddExercise(); page.onPause(); toggle(anchorId);
  page.onInputWeight(event({ setId: anchorId }, '99')); page.onInputBlur();
  page.onSkipExercise(event({ anchorId })); page.onStartRest(); page.onShow(); await completion;
  expect(wx.showModal).not.toHaveBeenCalled(); expect(page.data.showSummary).toBe(true);
  expect(page.data.summary).toMatchObject({ exerciseCount: 1, weightedVolume: '400', completedSets: 1, duration: '00:00' });
  expect(wx.navigateTo).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
  const completed = queue().getCompletedSession(saved.id);
  expect(completed.exercises[0].sets).toHaveLength(1); expect(completed.submittedAt).toBe(1000000);
  expect(queue().getQueue()).toHaveLength(1); expect(require('../utils/db').getLocalPlans()[0].cursor).toBe(1);
  jest.advanceTimersByTime(60000); reloadPage(); toggle(anchorId); page.onFinish();
  expect(page.data.showSummary).toBe(true); expect(page.data.session.submittedAt).toBe(1000000);
  expect(page.data.summary.duration).toBe('00:00'); expect(jest.getTimerCount()).toBe(0);
  expect(queue().getQueue()).toHaveLength(1); expect(require('../utils/db').getLocalPlans()[0].cursor).toBe(1);
});

test('无pending首次完成写入失败不显示完成、不删除草稿，允许再试', async () => {
  load(draft(1)); toggle(setIds()[0]); const id = page.data.session.id;
  wx.setStorageSync.mockImplementationOnce(() => { throw Error('full'); }); await page.onFinish();
  expect(page.data.showSummary).toBe(false); expect(page.data.submitting).toBe(false);
  expect(page.data.phase).toBe('finished'); expect(page.data.errorText).toMatch(/训练仍为草稿/);
  expect(queue().getCompletedSession(id)).toBeNull(); expect(storage.get(DRAFT_KEY).id).toBe(id);
  await page.onFinish(); expect(page.data.showSummary).toBe(true);
});

test('卸载后异步完成仍在本地成立，但不能重开小结、timer或音频', async () => {
  load(draft(1)); const [first] = setIds(); toggle(first); const id = page.data.session.id;
  const finishing = page.onFinish(); page.onUnload(); await finishing; page.onShow(); toggle(first);
  expect(page.data.showSummary).toBe(false); expect(queue().getCompletedSession(id)).not.toBeNull();
  expect(jest.getTimerCount()).toBe(0); expect(wx.createInnerAudioContext).not.toHaveBeenCalled();
});

test('小结负重容量与自重次数分开，排除pending；同计划同日历史分别比较，时长包含暂停且固定', async () => {
  load(domain.addSessionExercise(draft(1), { exerciseId: '0001', name: '自重动作', equipment: 'body weight' }));
  const [weighted, body] = setIds(); toggle(weighted);
  page.onInputWeight(event({ setId: body }, '0')); page.onInputReps(event({ setId: body }, '15')); toggle(body);
  page.onPause(); jest.advanceTimersByTime(90000); page.onResume();
  page.onAddSet(event({ anchorId: body }));
  wx.cloud.database.mockImplementation(() => {
    const query = { orderBy: () => query, limit: () => query, get: () => Promise.resolve({ data: [
      { id: 'other-day', planId: 'plan', dayId: 'different', submittedAt: 999900, exercises: [{ equipment: 'barbell', sets: [{ weight: 100, reps: 10 }] }] },
      { id: 'other-plan', planId: 'different', dayId: 'day', submittedAt: 999800, exercises: [{ equipment: 'barbell', sets: [{ weight: 100, reps: 10 }] }] },
      { id: 'previous', planId: 'plan', dayId: 'day', submittedAt: 999000, exercises: [
        { equipment: 'barbell', sets: [{ weight: 30, reps: 10 }] },
        { equipment: 'body weight', sets: [{ weight: 0, reps: 10 }] },
      ] },
    ] }) };
    return { collection: () => query };
  });
  const finishing = page.onFinish(); modal().success({ confirm: true }); await finishing;
  expect(page.data.summary).toMatchObject({ weightedVolume: '400', bodyWeightReps: '15', completedSets: 2, exerciseCount: 2, duration: '01:30' });
  expect(page.data.summary.exercises.map(ex => ex.volumeText)).toEqual(['400 kg', '15 次']);
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  expect(page.data.summary.comparisons).toEqual([
    { label: '负重容量', diffText: '+100 kg', improved: true },
    { label: '自重次数', diffText: '+5 次', improved: true },
  ]);
  jest.advanceTimersByTime(60000); expect(page.data.summary.duration).toBe('01:30');
  page.onSummaryBackToday(); page.onSummaryViewRecords();
  expect(wx.switchTab.mock.calls.map(([options]) => options.url)).toEqual(['/pages/today/today', '/pages/records/records']);
});

test('首次升级保存失败可显式重试，不开放未保存草稿；读取失败给可恢复错误', () => {
  const legacy = draft(); delete legacy.flowVersion; delete legacy.training; storage.set(DRAFT_KEY, legacy);
  wx.setStorageSync.mockImplementationOnce(() => { throw Error('full'); }); page.onLoad(); page.onShow();
  expect(page.data.session).toBeNull(); expect(page.data.errorText).toMatch(/保存/);
  page.onRetryDraft(); expect(page.data.phase).toBe('ready'); expect(page.data.session.flowVersion).toBe(2);
  wx.getStorageSync.mockImplementation((key) => {
    if (key === DRAFT_KEY) {
      wx.getStorageSync.mockImplementation((nextKey) => storage.get(nextKey));
      throw Error('storage');
    }
    return storage.get(key);
  }); page.onShow();
  expect(page.data.errorText).toMatch(/读取/); expect(page.data.session.flowVersion).toBe(2);
});

test.each(['active', 'rest', 'paused'])('v1 %s草稿重载迁移保留组身份、成绩和剩余间歇，不自动完成', phase => {
  const old = draft(3); const [first, second] = old.exercises[0].sets.map(set => set.id);
  old.flowVersion = 1; old.exercises[0].flowVersion = 1;
  old.exercises[0].sets[0] = { ...old.exercises[0].sets[0], weight: 52.5, reps: 8, status: 'completed' };
  old.training = { phase, currentSetId: second, restSeconds: 120,
    restEndsAt: phase === 'rest' ? Date.now() + 40000 : null,
    restRemainingSec: phase === 'paused' ? 40 : null,
    restNotified: false, restSkipped: false, undoSetId: first,
    resumePhase: phase === 'paused' ? 'rest' : null };
  load(old);
  expect(storage.get(DRAFT_KEY).flowVersion).toBe(2);
  expect(setIds().slice(0, 2)).toEqual([first, second]);
  expect(page.data.session.exercises[0].sets[0]).toMatchObject({ weight: 52.5, reps: 8, status: 'completed' });
  expect(page.data.session.exercises[0].sets[1].status).toBe('pending');
  expect(page.data.progress.completed).toBe(1);
  expect(page.data.phase).toBe(phase === 'active' ? 'ready' : phase);
  expect(audio.play).not.toHaveBeenCalled();
  if (phase !== 'active') expect(page.data.restText).toBe('00:40');
  if (phase === 'paused') {
    jest.advanceTimersByTime(60000); expect(page.data.restText).toBe('00:40');
    page.onResume(); expect(page.data.restText).toBe('00:40');
  }
});

test('已升级重载采纳本地加练，无冗余存储写入', () => {
  load(draft()); storage.set(DRAFT_KEY, domain.addSessionExercise(storage.get(DRAFT_KEY), { exerciseId: '0001', name: '加练', equipment: 'body weight' }));
  wx.setStorageSync.mockClear(); page.onShow();
  expect(page.data.session.exercises).toHaveLength(2); expect(wx.setStorageSync).not.toHaveBeenCalled();
});

test.each(['read', 'upgrade-write'])('reload %s失败阻塞陈旧写入，显式重试采纳加练', mode => {
  load(draft()); toggle(setIds()[0]); page.onStartRest();
  const deadline = page.data.session.training.restEndsAt; page.onHide();
  const added = domain.addSessionExercise(storage.get(DRAFT_KEY), { exerciseId: '0001', name: '加练', equipment: 'body weight' });
  if (mode === 'upgrade-write') { delete added.flowVersion; delete added.training; }
  storage.set(DRAFT_KEY, added);
  if (mode === 'read') wx.getStorageSync.mockImplementation((key) => {
    if (key === DRAFT_KEY) {
      wx.getStorageSync.mockImplementation((nextKey) => storage.get(nextKey));
      throw Error('read');
    }
    return storage.get(key);
  });
  else wx.setStorageSync.mockImplementationOnce(() => { throw Error('full'); });
  page.onShow(); expect(page.data.reloadBlocked).toBe(true); expect(page.data.canFinish).toBe(false);
  wx.setStorageSync.mockClear(); const [first, second] = setIds();
  page.onInputWeight(event({ setId: second }, '99')); page.onAddSet(event({ anchorId: first }));
  page.onRemoveSet(event({ setId: second })); toggle(first); toggle(second); page.onPause(); page.onResume();
  page.onAdjustRest(event({ delta: -15 })); page.onRestPreset(event({ seconds: 60 }));
  page.onStartRest(); page.onPauseRest(); page.onResumeRest(); page.onSkipRest(); page.onInputBlur();
  page.onSkipExercise(event({ anchorId: first })); page.onAddExercise(); page.onFinish();
  jest.advanceTimersByTime(1000); page.onShow();
  expect(wx.setStorageSync).not.toHaveBeenCalled(); expect(storage.get(DRAFT_KEY).exercises).toHaveLength(2);
  expect(wx.navigateTo).not.toHaveBeenCalled(); expect(wx.showModal).not.toHaveBeenCalled();
  page.onRetryDraft(); expect(page.data.reloadBlocked).toBe(false); expect(page.data.session.exercises).toHaveLength(2);
  if (mode === 'read') expect(page.data.session.training.restEndsAt).toBe(deadline);
  page.onAddSet(event({ anchorId: first })); expect(storage.get(DRAFT_KEY).exercises[0].sets).toHaveLength(3);
});

test('setData同步更新数据但异步callback时，首次开始间歇立即展开，不依赖旧restActive', () => {
  load(draft()); toggle(setIds()[0]);
  expect(page.data.restActive).toBe(false); expect(page.data.restExpanded).toBe(false);
  const callbacks = [];
  page.setData = (patch, callback) => {
    Object.assign(page.data, patch);
    if (callback) callbacks.push(callback);
  };
  page.onStartRest();
  // persistDraft的渲染callback尚未运行，restActive仍是旧值。
  expect(callbacks).toHaveLength(1);
  expect(page.data.restActive).toBe(false);
  expect(page.data.session.training.phase).toBe('rest');
  expect(page.data.restExpanded).toBe(true);
  callbacks.shift()();
  expect(page.data.restActive).toBe(true); expect(page.data.restExpanded).toBe(true);
  expect(page.data.restText).toBe('01:30');
});

test('已完成非法临时输入阻止结束及间歇，不覆盖成绩；修正后结束flush实际新成绩', async () => {
  load(draft(1)); const [first] = setIds(); toggle(first);
  page.onInputReps(event({ setId: first }, '0')); page.onFinish(); page.onStartRest();
  expect(page.data.showSummary).toBe(false); expect(page.data.submitting).toBe(false);
  expect(page.data.restActive).toBe(false); expect(wx.showModal).not.toHaveBeenCalled();
  expect(page.data.errorText).toMatch(/无效/);
  expect(storage.get(DRAFT_KEY).exercises[0].sets[0].reps).toBe(10);
  page.onInputReps(event({ setId: first }, '8')); await page.onFinish();
  expect(page.data.showSummary).toBe(true); expect(page.data.summary.weightedVolume).toBe('320');
});

test('取消完成保存失败保留已完成状态及临时输入，重试取消保留数值', () => {
  load(draft()); const [first] = setIds(); toggle(first);
  page.onInputReps(event({ setId: first }, '0'));
  wx.setStorageSync.mockImplementationOnce(() => { throw Error('full'); }); toggle(first);
  expect(page.data.session.exercises[0].sets[0]).toMatchObject({ status: 'completed', reps: 10 });
  expect(page.data.errorText).toMatch(/保存/);
  toggle(first);
  expect(storage.get(DRAFT_KEY).exercises[0].sets[0]).toMatchObject({ status: 'pending', reps: '0' });
});

test('独立暂停间歇冷启动保留冻结值，仍允许勾选，显式继续后才倒计时', () => {
  load(draft()); const [first, second] = setIds(); toggle(first); page.onStartRest();
  jest.advanceTimersByTime(50000); page.onPauseRest(); page.onHide();
  jest.advanceTimersByTime(180000); reloadPage();
  expect(page.data.phase).toBe('rest'); expect(page.data.restPaused).toBe(true);
  expect(page.data.restText).toBe('00:40'); expect(audio.play).not.toHaveBeenCalled();
  toggle(second); expect(page.data.progress.completed).toBe(2);
  jest.advanceTimersByTime(10000); expect(page.data.restText).toBe('00:40');
  page.onResumeRest(); jest.advanceTimersByTime(10000); expect(page.data.restText).toBe('00:30');
});

test('结束确认符合原生按钮文案长度限制，弹窗不会因参数无效而静默失败', async () => {
  load(draft()); toggle(setIds()[0]);
  const before = JSON.stringify(storage.get(DRAFT_KEY));
  let opened = false;
  wx.showModal.mockImplementation(options => {
    if (options.confirmText.length > 4 || options.cancelText.length > 4) {
      options.fail({ errMsg: 'showModal:fail confirmText length should not larger than 4 Chinese characters' });
    } else opened = true;
  });
  const completion = page.onFinish();
  expect(opened).toBe(true);
  expect(page.data.confirming).toBe(true);
  modal().success({ confirm: false, cancel: true });
  await completion;
  expect(page.data.confirming).toBe(false);
  expect(JSON.stringify(storage.get(DRAFT_KEY))).toBe(before);
  expect(page.data.showSummary).toBe(false);
});

test('结束确认弹窗失败明确提示并解锁，不改变草稿，允许再次确认', async () => {
  load(draft()); toggle(setIds()[0]);
  const before = JSON.stringify(storage.get(DRAFT_KEY));
  wx.showModal.mockImplementationOnce(options => options.fail({ errMsg: 'showModal:fail unavailable' }));
  await page.onFinish();
  expect(page.data.confirming).toBe(false);
  expect(page.data.errorText).toMatch(/确认.*重试/);
  expect(JSON.stringify(storage.get(DRAFT_KEY))).toBe(before);
  expect(queue().getCompletedSession(page.data.session.id)).toBeNull();
  const retried = page.onFinish();
  expect(wx.showModal).toHaveBeenCalledTimes(2);
  modal().success({ confirm: false, cancel: true });
  await retried;
  expect(page.data.submitting).toBe(false);
});
