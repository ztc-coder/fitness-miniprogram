const domain = require('../utils/domain');

const DRAFT_KEY = 'fitness:trainingDraft';
let page;
let storage;

function currentPlan() {
  return {
    id: 'current-plan', name: '力量循环', cursor: 0, active: true,
    cycleDays: [{ dayId: 'chest', name: '胸', exercises: [
      { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', sets: 3, targetWeight: 40, targetReps: 10 },
    ] }],
  };
}

function oldDraft() {
  const session = domain.snapshotSession({
    id: 'old-plan', name: '力量训练', cursor: 0,
    cycleDays: [{ dayId: 'back', name: '背+二头肌', exercises: [
      { exerciseId: '0652', name: '引体向上', equipment: 'body weight', sets: 2, targetWeight: 20, targetReps: 10 },
    ] }],
  });
  // 草稿恢复场景只依赖实际完成状态，不绑定已被新流程替代的开始本组 API。
  session.exercises[0].sets[0].status = 'completed';
  return session;
}

beforeEach(() => {
  jest.resetModules();
  storage = {};
  global.wx = {
    getStorageSync: key => storage[key],
    setStorageSync: jest.fn((key, value) => { storage[key] = JSON.parse(JSON.stringify(value)); }),
    removeStorageSync: key => { delete storage[key]; },
    navigateTo: jest.fn(options => { if (options.complete) options.complete(); }),
    showToast: jest.fn(), showModal: jest.fn(),
    cloud: { database: () => { throw new Error('offline'); } },
    getNetworkType: ({ success }) => success({ networkType: 'none' }),
  };
  global.Page = definition => { page = definition; };
  require('../pages/today/today');
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = (patch, callback) => { Object.assign(page.data, patch); if (callback) callback(); };
  page.data.plan = currentPlan();
});

afterEach(() => {
  delete global.Page;
  delete global.wx;
});

test('新开先确认，确认后计划名、训练日与全部动作来自当前计划，不继续旧草稿', () => {
  const old = oldDraft();
  storage[DRAFT_KEY] = old;
  const plan = currentPlan();
  storage['fitness:plans'] = [plan];

  page.onStartTraining();

  expect(wx.showModal).toHaveBeenCalledTimes(1);
  expect(storage[DRAFT_KEY]).toEqual(old);
  expect(wx.navigateTo).not.toHaveBeenCalled();
  const modal = wx.showModal.mock.calls[0][0];
  expect(modal.content).toContain('力量训练');
  expect(modal.content).toContain('背+二头肌');
  modal.success({ confirm: true });

  const next = storage[DRAFT_KEY];
  expect(next).toMatchObject({ planId: 'current-plan', planName: '力量循环', dayId: 'chest', dayName: '胸' });
  expect(next.id).not.toBe(old.id);
  expect(next.exercises.map(ex => ex.name)).toEqual(['杠铃卧推']);
  expect(next.exercises[0].sets).toHaveLength(3);
  expect(next.exercises[0].sets.every(set => set.status === 'pending')).toBe(true);
  expect(next.training.phase).toBe('ready');
  expect(storage['fitness:plans']).toEqual([plan]);
  expect(storage['fitness:completedTraining']).toBeUndefined();
  expect(storage['fitness:pendingQueue']).toBeUndefined();
  expect(wx.navigateTo).toHaveBeenCalledTimes(1);
});

test('取消新开保留旧草稿和已打卡成绩；继续入口仍恢复旧训练', () => {
  const old = oldDraft();
  storage[DRAFT_KEY] = old;
  page.onStartTraining();
  wx.showModal.mock.calls[0][0].success({ confirm: false });
  expect(storage[DRAFT_KEY]).toEqual(old);
  expect(wx.navigateTo).not.toHaveBeenCalled();
  page.onResumeDraft();
  expect(storage[DRAFT_KEY]).toMatchObject({ id: old.id, planId: old.planId, dayName: old.dayName });
  expect(storage[DRAFT_KEY].exercises[0].sets).toEqual(old.exercises[0].sets);
  expect(storage[DRAFT_KEY].exercises[0].sets[0].status).toBe('completed');
  expect(wx.navigateTo).toHaveBeenCalledTimes(1);
});

test('同一计划修改训练日和动作后，新开也重建快照而不是复用原计划草稿', () => {
  const old = { ...oldDraft(), planId: 'current-plan' };
  storage[DRAFT_KEY] = old;
  page.onStartTraining();
  wx.showModal.mock.calls[0][0].success({ confirm: true });
  expect(storage[DRAFT_KEY].dayName).toBe('胸');
  expect(storage[DRAFT_KEY].exercises[0]).toMatchObject({ exerciseId: '0025', name: '杠铃卧推' });
  expect(storage[DRAFT_KEY].exercises[0].sets[0]).toMatchObject({ weight: 40, reps: 10, status: 'pending' });
  expect(storage[DRAFT_KEY].id).not.toBe(old.id);
});

test('覆盖写失败不删旧草稿、不导航；再次确认可按当前计划新开', () => {
  const old = oldDraft();
  storage[DRAFT_KEY] = old;
  page.onStartTraining();
  wx.setStorageSync.mockImplementationOnce(() => { throw new Error('full'); });
  wx.showModal.mock.calls[0][0].success({ confirm: true });
  expect(storage[DRAFT_KEY]).toEqual(old);
  expect(wx.navigateTo).not.toHaveBeenCalled();
  expect(wx.showToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: '草稿保存失败，请重试' }));
  page.onStartTraining();
  wx.showModal.mock.calls[1][0].success({ confirm: true });
  expect(storage[DRAFT_KEY].planId).toBe('current-plan');
  expect(wx.navigateTo).toHaveBeenCalledTimes(1);
});

test('确认期间不重复打开弹窗或继续旧训练；草稿身份变更必须重新确认', () => {
  storage[DRAFT_KEY] = oldDraft();
  page.onStartTraining();
  page.onStartTraining();
  page.onResumeDraft();
  expect(wx.showModal).toHaveBeenCalledTimes(1);
  expect(wx.navigateTo).not.toHaveBeenCalled();
  const updated = { ...oldDraft(), id: 'newer-draft' };
  storage[DRAFT_KEY] = updated;
  wx.showModal.mock.calls[0][0].success({ confirm: true });
  expect(storage[DRAFT_KEY]).toEqual(updated);
  expect(wx.navigateTo).not.toHaveBeenCalled();
  expect(wx.showToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: '草稿已更新，请重新确认' }));
});

test('确认期间当前计划改变时不创建过期计划快照，重新确认采用最新计划', () => {
  const old = oldDraft();
  storage[DRAFT_KEY] = old;
  page.onStartTraining();
  page.data.plan = { ...currentPlan(), name: '新计划名' };
  wx.showModal.mock.calls[0][0].success({ confirm: true });
  expect(storage[DRAFT_KEY]).toEqual(old);
  expect(wx.navigateTo).not.toHaveBeenCalled();
  expect(wx.showToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: '计划已更新，请重新确认' }));
  page.onStartTraining();
  wx.showModal.mock.calls[1][0].success({ confirm: true });
  expect(storage[DRAFT_KEY].planName).toBe('新计划名');
});

test('没有旧草稿直接新开；没有计划或训练日时不替换旧草稿', () => {
  page.onStartTraining();
  expect(storage[DRAFT_KEY].planId).toBe('current-plan');
  expect(wx.showModal).not.toHaveBeenCalled();
  const saved = storage[DRAFT_KEY];
  page.data.plan = null;
  page.onStartTraining();
  page.data.plan = { ...currentPlan(), cycleDays: [] };
  page.onStartTraining();
  expect(storage[DRAFT_KEY]).toEqual(saved);
  expect(wx.showModal).not.toHaveBeenCalled();
  expect(wx.navigateTo).toHaveBeenCalledTimes(1);
});

test('草稿读取或弹窗失败不替换数据、不锁死新开入口', () => {
  const old = oldDraft();
  storage[DRAFT_KEY] = old;
  const read = wx.getStorageSync;
  wx.getStorageSync = () => { throw new Error('storage'); };
  expect(() => page.onStartTraining()).not.toThrow();
  expect(wx.showModal).not.toHaveBeenCalled();
  wx.getStorageSync = read;
  page.onStartTraining();
  wx.showModal.mock.calls[0][0].fail({ errMsg: 'fail' });
  page.onStartTraining();
  expect(wx.showModal).toHaveBeenCalledTimes(2);
  expect(storage[DRAFT_KEY]).toEqual(old);
});

test('首页当前计划与旧草稿来源分开展示，动作列表仍属于当前计划', async () => {
  storage['fitness:plans'] = [currentPlan()];
  storage['fitness:seedVersion'] = 3;
  storage['fitness:planMigrationVersion'] = 5;
  storage['fitness:planMigrationCloudSynced'] = 5;
  storage[DRAFT_KEY] = oldDraft();
  page.onShow();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  expect(page.data.plan.name).toBe('力量循环');
  expect(page.data.day.name).toBe('胸');
  expect(page.data.exercises.map(ex => ex.name)).toEqual(['杠铃卧推']);
  expect(page.data.hasDraft).toBe(true);
  expect(page.data.draftInfo).toEqual({ planName: '力量训练', dayName: '背+二头肌', exerciseCount: 1, completed: 1, total: 2 });
});