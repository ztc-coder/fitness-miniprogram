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
    showActionSheet: jest.fn(), createInnerAudioContext: jest.fn(() => audio), vibrateShort: jest.fn(),
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

test('预填不是打卡，旧草稿显式升级保存；必须手动开始和完成当前组', () => {
  const old = draft();
  delete old.flowVersion;
  delete old.training;
  old.exercises.forEach((ex) => { delete ex.flowVersion; ex.sets.forEach((s) => { delete s.id; delete s.status; }); });
  load(old);
  expect(page.data.progressPct).toBe(0);
  expect(page.data.canFinish).toBe(false);
  expect(storage.get(DRAFT_KEY).flowVersion).toBe(1);
  page.onCompleteSet();
  expect(page.data.progressPct).toBe(0);
  page.onStartSet();
  expect(page.data.session.training.phase).toBe('active');
  page.onCompleteSet();
  const deadline = page.data.session.training.restEndsAt;
  expect(page.data.progressPct).toBe(50);
  expect(page.data.restText).toBe('01:30');
  page.onCompleteSet();
  expect(page.data.session.training.restEndsAt).toBe(deadline);
});

test('完成或输入本地保存失败不假报成功，保留已保存状态并可重试', () => {
  load(draft());
  page.onStartSet();
  wx.setStorageSync.mockImplementationOnce(() => { throw new Error('full'); });
  expect(() => page.onCompleteSet()).not.toThrow();
  expect(page.data.session.training.phase).toBe('active');
  expect(page.data.progressPct).toBe(0);
  expect(page.data.errorText).toMatch(/保存/);
  page.onCompleteSet();
  expect(page.data.progressPct).toBe(50);
  const setId = page.data.session.exercises[0].sets[1].id;
  wx.setStorageSync.mockImplementationOnce(() => { throw new Error('full'); });
  page.onInputWeight(event({ setId }, '55'));
  expect(page.data.session.exercises[0].sets[1].weight).toBe(40);
  expect(page.data.errorText).toMatch(/保存/);
  page.onInputWeight(event({ setId }, '55'));
  expect(page.data.session.exercises[0].sets[1].weight).toBe('55');
});

test('隐藏不改截止，返回读取加练并校准；到时先保存再提醒一次，重复show只有一个timer', () => {
  load(draft());
  page.onStartSet(); page.onCompleteSet();
  const deadline = page.data.session.training.restEndsAt;
  page.onHide();
  expect(jest.getTimerCount()).toBe(0);
  expect(storage.get(DRAFT_KEY).training.restEndsAt).toBe(deadline);
  storage.set(DRAFT_KEY, domain.addSessionExercise(storage.get(DRAFT_KEY), { exerciseId: '0026', name: '加练', equipment: 'barbell' }));
  jest.setSystemTime(deadline + 1000);
  audio.play.mockImplementation(() => expect(storage.get(DRAFT_KEY).training.restNotified).toBe(true));
  page.onShow();
  expect(page.data.exercises).toHaveLength(2);
  expect(page.data.session.training.phase).toBe('ready');
  expect(page.data.restMessage).toMatch(/间歇结束/);
  expect(storage.get(DRAFT_KEY).training.restNotified).toBe(true);
  expect(audio.play).toHaveBeenCalledTimes(1);
  expect(wx.vibrateShort).toHaveBeenCalledTimes(1);
  page.onShow(); page.onShow();
  expect(jest.getTimerCount()).toBe(1);
  expect(audio.play).toHaveBeenCalledTimes(1);
  page.onHide();
  expect(audio.destroy).toHaveBeenCalledTimes(1);
});

test('暂停冻结同组/剩余，重进仍需显式继续；±15调整与跳过不发到时音，最后组无间歇', () => {
  load(draft());
  page.onStartSet();
  const activeId = page.data.session.training.currentSetId;
  page.onPause();
  page.onHide(); jest.advanceTimersByTime(30000); page.onShow();
  expect(page.data.phase).toBe('paused');
  expect(page.data.session.training.currentSetId).toBe(activeId);
  page.onResume(); page.onCompleteSet();
  jest.advanceTimersByTime(50000);
  page.onPause();
  expect(page.data.restText).toBe('00:40');
  page.onHide(); jest.advanceTimersByTime(60000); page.onShow();
  expect(page.data.restText).toBe('00:40');
  expect(page.data.phase).toBe('paused');
  page.onAdjustRest(event({ delta: 15 }));
  expect(page.data.restText).toBe('00:55');
  page.onAdjustRest(event({ delta: -15 }));
  page.onResume(); page.onSkipRest();
  expect(page.data.phase).toBe('ready');
  expect(audio.play).not.toHaveBeenCalled();
  page.onStartSet(); page.onCompleteSet();
  expect(page.data.phase).toBe('finished');
  expect(page.data.canFinish).toBe(true);
});

test('已完成组原子纠错，非法半成输入不覆盖成绩；撤销窗口与删除保护', () => {
  load(draft(3));
  const setId = page.data.session.exercises[0].sets[0].id;
  page.onStartSet(); page.onCompleteSet();
  const deadline = page.data.session.training.restEndsAt;
  page.onEditSet(event({ setId }));
  page.onEditWeight(event({}, ''));
  page.onSaveEdit();
  expect(page.data.session.exercises[0].sets[0].weight).toBe(40);
  expect(page.data.editing).not.toBeNull();
  page.onEditWeight(event({}, '52.5'));
  page.onEditReps(event({}, '8'));
  page.onSaveEdit();
  expect(page.data.session.exercises[0].sets[0]).toMatchObject({ weight: 52.5, reps: 8, status: 'completed' });
  expect(page.data.session.training.restEndsAt).toBe(deadline);
  page.onRemoveSet(event({ setId }));
  expect(page.data.session.exercises[0].sets).toHaveLength(3);
  page.onUndoSet();
  expect(page.data.phase).toBe('active');
  expect(page.data.progressPct).toBe(0);
  page.onCompleteSet(); page.onSkipRest(); page.onStartSet(); page.onUndoSet();
  expect(page.data.progressPct).toBe(33);
  expect(page.data.session.training.currentSetId).not.toBe(setId);
  page.onRemoveSet(event({ setId: page.data.session.training.currentSetId }));
  expect(page.data.session.exercises[0].sets).toHaveLength(3);
});

test('部分跳过保留实际成绩，恢复/加组重新禁整场；菜单实时引用且不能移除练过动作', () => {
  load(draft(3));
  const anchorId = page.data.session.exercises[0].sets[0].id;
  page.onStartSet(); page.onCompleteSet();
  page.onSkipExercise(event({ anchorId }));
  wx.showActionSheet.mock.calls.at(-1)[0].success({ tapIndex: 0 });
  expect(page.data.progress).toMatchObject({ completed: 1, skipped: 2, total: 1 });
  expect(page.data.exercises[0].volume).toBe(400);
  expect(page.data.exercises[0].sets).toHaveLength(3);
  expect(page.data.canFinish).toBe(true);
  page.onSkipExercise(event({ anchorId }));
  wx.showActionSheet.mock.calls.at(-1)[0].success({ tapIndex: 2 });
  expect(page.data.exercises).toHaveLength(1);
  expect(page.data.errorText).toMatch(/移除/);
  page.onSkipExercise(event({ anchorId }));
  wx.showActionSheet.mock.calls.at(-1)[0].success({ tapIndex: 1 });
  expect(page.data.progress).toMatchObject({ completed: 1, pending: 2, skipped: 0 });
  expect(page.data.canFinish).toBe(false);
  page.onAddSet(event({ anchorId }));
  expect(page.data.progress.pending).toBe(3);
});

test('tick保存失败不认领到时，重试后提醒；声音与振动异常不阻塞且不重响', () => {
  load(draft()); page.onStartSet(); page.onCompleteSet();
  wx.setStorageSync.mockImplementationOnce(() => { throw new Error('full'); });
  audio.play.mockImplementation(() => { throw new Error('audio'); });
  wx.vibrateShort.mockImplementation(() => { throw new Error('unsupported'); });
  jest.advanceTimersByTime(90000);
  expect(page.data.phase).toBe('rest');
  expect(page.data.errorText).toMatch(/保存/);
  expect(page.data.restMessage).toBe('');
  expect(audio.play).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1000);
  expect(page.data.phase).toBe('ready');
  expect(page.data.restMessage).toMatch(/间歇结束/);
  expect(audio.play).toHaveBeenCalledTimes(1);
  audio.onError.mock.calls[0][0]({ errCode: 10003 });
  jest.advanceTimersByTime(5000);
  expect(audio.play).toHaveBeenCalledTimes(1);
  page.onStartSet();
  expect(page.data.phase).toBe('active');
});

test('有pending或全跳过不能整场完成，不创建小结', () => {
  load(draft());
  page.onStartSet(); page.onCompleteSet();
  page.onFinish();
  expect(page.data.submitting).toBe(false);
  expect(page.data.showSummary).toBe(false);
  page.onUndoSet();
  const anchorId = page.data.session.exercises[0].sets[0].id;
  page.onSkipExercise(event({ anchorId }));
  wx.showActionSheet.mock.calls.at(-1)[0].success({ tapIndex: 0 });
  page.onFinish();
  expect(page.data.submitting).toBe(false);
  expect(page.data.showSummary).toBe(false);
});

test('真实queue本地完成立即显示固定小结，不等云；双击与所有编辑被锁，重进残留草稿显示原小结', async () => {
  storage.set('fitness:plans', [{ id: 'plan', cursor: 0, cycleDays: [{ dayId: 'day' }, { dayId: 'next' }] }]);
  load(draft(1));
  page.onStartSet(); page.onCompleteSet();
  const saved = page.data.session;
  const anchorId = saved.exercises[0].sets[0].id;
  wx.removeStorageSync.mockImplementation(() => { throw new Error('residual'); });
  const completion = page.onFinish();
  page.onFinish();
  page.onAddSet(event({ anchorId })); page.onAddExercise(); page.onPause(); page.onUndoSet();
  page.onInputWeight(event({ setId: anchorId }, '99')); page.onEditSet(event({ setId: anchorId }));
  page.onSkipExercise(event({ anchorId })); page.onShow();
  await completion;
  expect(page.data.showSummary).toBe(true);
  expect(page.data.summary).toMatchObject({ exerciseCount: 1, totalVolume: '400', duration: '0m' });
  expect(page.data.editing).toBeNull();
  expect(wx.navigateTo).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  const queue = require('../utils/queue');
  const completed = queue.getCompletedSession(saved.id);
  expect(completed.exercises[0].sets).toHaveLength(1);
  expect(completed.submittedAt).toBe(1000000);
  expect(queue.getQueue()).toHaveLength(1);
  jest.advanceTimersByTime(60000);
  global.Page = (definition) => { page = definition; };
  jest.isolateModules(() => require('../pages/training/training'));
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = (patch, cb) => { Object.assign(page.data, patch); if (cb) cb(); };
  page.onLoad(); page.onShow(); page.onStartSet(); page.onFinish();
  expect(page.data.showSummary).toBe(true);
  expect(page.data.session.submittedAt).toBe(1000000);
  expect(page.data.summary.duration).toBe('0m');
  expect(jest.getTimerCount()).toBe(0);
});

test('真实queue首次完成写入失败不显示完成、不删除草稿，允许再试', async () => {
  load(draft(1)); page.onStartSet(); page.onCompleteSet();
  const id = page.data.session.id;
  wx.setStorageSync.mockImplementationOnce(() => { throw new Error('full'); });
  await page.onFinish();
  expect(page.data.showSummary).toBe(false);
  expect(page.data.submitting).toBe(false);
  expect(page.data.session.training.phase).toBe('finished');
  expect(page.data.errorText).toMatch(/训练仍为草稿/);
  expect(require('../utils/queue').getCompletedSession(id)).toBeNull();
  expect(storage.get(DRAFT_KEY).id).toBe(id);
  await page.onFinish();
  expect(page.data.showSummary).toBe(true);
});

test('卸载后异步完成仍在本地成立，但不能重开小结、timer或音频', async () => {
  load(draft(1)); page.onStartSet(); page.onCompleteSet();
  const id = page.data.session.id;
  const finishing = page.onFinish();
  page.onUnload();
  await finishing;
  page.onShow(); page.onStartSet();
  expect(page.data.showSummary).toBe(false);
  expect(require('../utils/queue').getCompletedSession(id)).not.toBeNull();
  expect(jest.getTimerCount()).toBe(0);
  expect(wx.createInnerAudioContext).not.toHaveBeenCalled();
});

test.each([
  ['weight', ''], ['weight', '-1'], ['weight', 'Infinity'], ['weight', 'foo'],
  ['reps', ''], ['reps', '0'], ['reps', '-2'], ['reps', '2.5'],
])('当前组非法%s=%s不能打卡或启动间歇', (field, value) => {
  load(draft());
  const setId = page.data.session.training.currentSetId;
  if (field === 'weight') page.onInputWeight(event({ setId }, value));
  else page.onInputReps(event({ setId }, value));
  page.onStartSet(); page.onCompleteSet();
  expect(page.data.phase).toBe('active');
  expect(page.data.progress.completed).toBe(0);
  expect(page.data.errorText).toMatch(/合法成绩/);
  expect(page.data.session.training.restEndsAt).toBeNull();
});

test('自重空重量允许归零打卡；新加末组仍pending，全部完成后加组重新禁整场', () => {
  const body = draft(1);
  body.exercises[0].equipment = 'body weight';
  load(body);
  const setId = page.data.session.training.currentSetId;
  page.onInputWeight(event({ setId }, ''));
  page.onStartSet(); page.onCompleteSet();
  expect(page.data.session.exercises[0].sets[0].weight).toBe(0);
  expect(page.data.canFinish).toBe(true);
  page.onAddSet(event({ anchorId: setId }));
  expect(page.data.canFinish).toBe(false);
  expect(page.data.phase).toBe('ready');
  expect(page.data.progress).toMatchObject({ completed: 1, pending: 1 });
});

test('首次升级保存失败可显式重试，不开放未保存草稿；读取失败给可恢复错误', () => {
  storage.set(DRAFT_KEY, draft());
  wx.setStorageSync.mockImplementationOnce(() => { throw new Error('full'); });
  page.onLoad(); page.onShow();
  expect(page.data.session).toBeNull();
  expect(page.data.errorText).toMatch(/保存/);
  page.onRetryDraft();
  expect(page.data.phase).toBe('ready');
  expect(page.data.session.flowVersion).toBe(1);
  wx.getStorageSync.mockImplementationOnce(() => { throw new Error('storage'); });
  page.onShow();
  expect(page.data.errorText).toMatch(/读取/);
  expect(page.data.session.flowVersion).toBe(1);
});

test('重进已认领提醒草稿只保留提示不再响', () => {
  let session = draft();
  session = domain.startTrainingSet(session, session.training.currentSetId, Date.now());
  session = domain.completeTrainingSet(session, session.training.currentSetId, Date.now());
  session = domain.tickTrainingRest(session, Date.now() + 90000);
  load(session);
  expect(page.data.restMessage).toMatch(/间歇结束/);
  expect(audio.play).not.toHaveBeenCalled();
  page.onStartSet(); page.onCompleteSet();
  expect(page.data.canFinish).toBe(true);
});

test('菜单打开后列表变更仍按稳定引用操作，输入不受原下标漂移影响', () => {
  const session = domain.addSessionExercise(draft(1), { exerciseId: '0043', name: '第二个动作', equipment: 'barbell' });
  load(session);
  const first = page.data.exercises[0].anchorId;
  const second = page.data.exercises[1].anchorId;
  page.onSkipExercise(event({ anchorId: second }));
  const secondMenu = wx.showActionSheet.mock.calls.at(-1)[0];
  page.onSkipExercise(event({ anchorId: first }));
  wx.showActionSheet.mock.calls.at(-1)[0].success({ tapIndex: 2 });
  secondMenu.success({ tapIndex: 0 });
  expect(page.data.exercises).toHaveLength(1);
  expect(page.data.exercises[0].sets[0].status).toBe('skipped');
  page.onSkipExercise(event({ anchorId: second }));
  wx.showActionSheet.mock.calls.at(-1)[0].success({ tapIndex: 1 });
  page.onInputWeight(event({ setId: second }, '25'));
  page.onInputReps(event({ setId: second }, '12'));
  expect(page.data.session.exercises[0].sets[0]).toMatchObject({ weight: '25', reps: '12' });
});

test('减至零到时并更新本场默认间歇，振动fail与音频onError只降级', () => {
  load(draft()); page.onStartSet(); page.onCompleteSet();
  wx.vibrateShort.mockImplementation(({ fail }) => fail({ errMsg: 'style is not support' }));
  for (let i = 0; i < 6; i += 1) page.onAdjustRest(event({ delta: -15 }));
  expect(page.data.phase).toBe('ready');
  expect(page.data.session.training.restSeconds).toBe(0);
  expect(page.data.restText).toBe('00:00');
  expect(page.data.restMessage).toMatch(/间歇结束/);
  expect(audio.play).toHaveBeenCalledTimes(1);
  audio.onError.mock.calls[0][0]({ errCode: 10004 });
  page.onShow(); page.onShow();
  expect(audio.play).toHaveBeenCalledTimes(1);
  page.onStartSet(); page.onCompleteSet();
  expect(page.data.canFinish).toBe(true);
});

test('冷启动暂停间歇保持冻结值，不可通过开始/完成绕过显式继续', () => {
  let session = draft();
  session = domain.startTrainingSet(session, session.training.currentSetId, Date.now());
  session = domain.completeTrainingSet(session, session.training.currentSetId, Date.now());
  session = domain.pauseTraining(session, Date.now() + 50000);
  jest.advanceTimersByTime(180000);
  load(session);
  expect(page.data.phase).toBe('paused');
  expect(page.data.restText).toBe('00:40');
  expect(audio.play).not.toHaveBeenCalled();
  page.onCompleteSet(); page.onStartSet();
  expect(page.data.phase).toBe('paused');
  page.onResume();
  expect(page.data.phase).toBe('rest');
  expect(page.data.restText).toBe('00:40');
});

test('跨动作也休息，返回到待开始而不自动开练；历史比较异步不改变本地固定小结', async () => {
  load(domain.addSessionExercise(draft(1), { exerciseId: '0043', name: '第二个动作', equipment: 'barbell' }));
  page.onStartSet(); page.onCompleteSet();
  expect(page.data.phase).toBe('rest');
  expect(page.data.current.name).toBe('第二个动作');
  jest.advanceTimersByTime(90000);
  expect(page.data.phase).toBe('ready');
  const second = page.data.session.training.currentSetId;
  page.onInputWeight(event({ setId: second }, '20'));
  page.onInputReps(event({ setId: second }, '5'));
  page.onStartSet(); page.onCompleteSet();
  wx.cloud.database.mockImplementation(() => {
    const query = { orderBy: () => query, limit: () => query, get: () => Promise.resolve({ data: [
      { id: 'previous', planId: 'plan', dayId: 'day', submittedAt: 999000,
        exercises: [{ equipment: 'barbell', sets: [{ weight: 30, reps: 10 }] }] },
    ] }) };
    return { collection: () => query };
  });
  await page.onFinish();
  expect(page.data.summary).toMatchObject({ totalVolume: '500', duration: '2m' });
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  expect(page.data.summary.comparison).toMatchObject({ volumeDiff: 200, improved: true });
  jest.advanceTimersByTime(60000);
  expect(page.data.summary.duration).toBe('2m');
});