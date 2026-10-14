const domain = require('../utils/domain');
const draft = () => domain.snapshotSession({ id: 'p', cursor: 0, cycleDays: [{ dayId: 'd', exercises: [
  { exerciseId: 'bench', equipment: 'barbell', sets: 3, targetWeight: 20, targetReps: 10 },
  { exerciseId: 'pull', equipment: 'body weight', sets: 2, targetWeight: 0, targetReps: 8 },
] }] });
const completed = () => domain.completeTrainingSet(draft(), 'set_3', 1000);
const rest = () => domain.startTrainingRest(completed(), 2000);
const frozen = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
};

test('任意 pending 直接完成，重复勾选 no-op；预填不是成绩且无自动间歇', () => {
  const s = frozen(draft());
  expect(s.flowVersion).toBe(2);
  expect(s.exercises.every(ex => ex.flowVersion === 2)).toBe(true);
  expect(domain.computeSessionMetrics(s)).toEqual({ completedSets: 0, weightedVolume: 0, bodyWeightReps: 0 });
  const done = domain.completeTrainingSet(s, 'set_3', 1000);
  expect(done.exercises[0].sets[2].status).toBe('completed');
  expect(done.training).toEqual(s.training);
  expect(domain.completeTrainingSet(done, 'set_3', 1100)).toBe(done);
  expect(domain.completeTrainingSet(s, 'missing', 1000)).toBe(s);
  expect(domain.completeTrainingSet(s, 'set_1', Infinity)).toBe(s);
  expect(s.exercises[0].sets[2].status).toBe('pending');
});

test.each(['', null, undefined, 0, -1, 1.5, Infinity, NaN, 'abc', true])('非法次数 %p 不产生完成成绩', reps => {
  const s = domain.updateSessionSet(draft(), 0, 2, 'reps', reps);
  expect(domain.completeTrainingSet(s, 'set_3', 1000)).toBe(s);
});
test.each(['', null, undefined, -1, Infinity, NaN, 'abc', true])('非法普通重量 %p 不产生完成成绩', weight => {
  const s = domain.updateSessionSet(draft(), 0, 2, 'weight', weight);
  expect(domain.completeTrainingSet(s, 'set_3', 1000)).toBe(s);
});
test('数字字符串标准化，自重空重量归零，非法自重数值仍拒绝', () => {
  let s = domain.editTrainingSet(draft(), 'set_5', { weight: '', reps: '12' });
  const done = domain.completeTrainingSet(s, 'set_5', 1000);
  expect(done.exercises[1].sets[1]).toMatchObject({ status: 'completed', weight: 0, reps: 12 });
  for (const weight of [Infinity, NaN, 'Infinity']) {
    s = domain.updateSessionSet(s, 1, 1, 'weight', weight);
    expect(domain.completeTrainingSet(s, 'set_5', 1000)).toBe(s);
  }
});

test('编辑 completed 的有效值直接存；半成输入保留旧成绩，撤销任意组保留值和间歇', () => {
  let s = domain.completeTrainingSet(rest(), 'set_1', 3000);
  const timer = { ...s.training };
  s = domain.updateSessionSet(s, 0, 2, 'weight', '25');
  expect(s.exercises[0].sets[2]).toMatchObject({ weight: 25, reps: 10, status: 'completed' });
  expect(s.training).toEqual(timer);
  for (const [field, value] of [['weight', ''], ['weight', Infinity], ['reps', 0], ['reps', 2.5], ['other', 1]]) {
    expect(domain.updateSessionSet(s, 0, 2, field, value)).toBe(s);
  }
  expect(domain.editTrainingSet(s, 'set_3', { weight: 30 })).toBe(s);
  const undo = domain.uncompleteTrainingSet(s, 'set_3');
  expect(undo.exercises[0].sets[2]).toMatchObject({ weight: 25, reps: 10, status: 'pending' });
  expect(undo.training.restEndsAt).toBe(timer.restEndsAt);
  expect(undo.exercises[0].sets[0].status).toBe('completed');
  expect(domain.uncompleteTrainingSet(undo, 'set_3')).toBe(undo);
  expect(domain.uncompleteTrainingSet(undo, 'missing')).toBe(undo);
});

test('删除中间未完成组保留稳定身份，追加沿用上一组，已完成不能删，至少一组', () => {
  const s = rest();
  expect(domain.removeSessionSet(s, 0, 2)).toEqual(s);
  expect(domain.removeSessionExercise(s, 0)).toBe(s);
  const removed = domain.removeSessionSet(s, 0, 1);
  expect(removed.exercises[0].sets.map(set => set.id)).toEqual(['set_1', 'set_3']);
  const added = domain.addSessionSet(removed, 0);
  expect(added.exercises[0].sets[2]).toEqual({ id: 'set_6', status: 'pending', weight: 20, reps: 10 });
  expect(added.training.restEndsAt).toBe(s.training.restEndsAt);
  let one = domain.removeSessionSet(removed, 0, 0);
  one = domain.uncompleteTrainingSet(one, 'set_3');
  expect(domain.removeSessionSet(one, 0, 0)).toEqual(one);
  const skipped = domain.setExerciseSkipped(s, 1, true);
  expect(domain.removeSessionSet(skipped, 1, 0).exercises[1].sets.map(set => set.id)).toEqual(['set_5']);
});

test('跳过/恢复动作保留实际成绩；列表变化不能清除间歇，全部完成仍可手动休息', () => {
  let s = rest();
  s = domain.setExerciseSkipped(s, 0, true);
  s = domain.setExerciseSkipped(s, 1, true);
  expect(s.exercises[0].sets.map(set => set.status)).toEqual(['skipped', 'skipped', 'completed']);
  expect(s.training).toMatchObject({ phase: 'rest', currentSetId: null, restEndsAt: 92000 });
  expect(domain.computeExerciseCount(s)).toBe(1);
  const restored = domain.setExerciseSkipped(s, 0, false);
  expect(restored.exercises[0].sets.map(set => set.status)).toEqual(['pending', 'pending', 'completed']);
  expect(restored.training.restEndsAt).toBe(92000);
  const end = domain.skipTrainingRest(s);
  expect(end.training.phase).toBe('finished');
  expect(domain.startTrainingRest(end, 3000).training).toMatchObject({ phase: 'rest', currentSetId: null, restEndsAt: 93000 });
  expect(domain.addSessionExercise(end, { exerciseId: 'extra' }).training.phase).toBe('ready');
});

test('手动间歇开始和重启；真实时间校准，到时只认领一次；跳过不提醒', () => {
  const empty = draft();
  expect(domain.startTrainingRest(empty, 2000)).toBe(empty);
  const s = rest();
  expect(domain.getRestRemainingSec(s, 52500)).toBe(40);
  expect(domain.tickTrainingRest(s, 91999)).toBe(s);
  const expired = domain.tickTrainingRest(s, 100000);
  expect(expired.training).toMatchObject({ phase: 'ready', restNotified: true, restEndsAt: null });
  expect(domain.tickTrainingRest(expired, 110000)).toBe(expired);
  expect(domain.startTrainingRest(expired, 110000).training).toMatchObject({ phase: 'rest', restEndsAt: 200000, restNotified: false });
  expect(domain.startTrainingRest(s, 3000).training.restEndsAt).toBe(93000);
  const skipped = domain.skipTrainingRest(s);
  expect(skipped.training).toMatchObject({ restNotified: false, restSkipped: true });
  expect(domain.tickTrainingRest(skipped, 100000)).toBe(skipped);
});

test('独立暂停间歇不禁记录；整场暂停/继续保留独立暂停状态', () => {
  const pausedRest = domain.pauseTrainingRest(rest(), 52000);
  expect(pausedRest.training).toMatchObject({ phase: 'rest', restPaused: true, restRemainingSec: 40, restEndsAt: null });
  expect(domain.getRestRemainingSec(pausedRest, 999999)).toBe(40);
  expect(domain.tickTrainingRest(pausedRest, 999999)).toBe(pausedRest);
  const recorded = domain.completeTrainingSet(pausedRest, 'set_1', 60000);
  expect(recorded.exercises[0].sets[0].status).toBe('completed');
  expect(recorded.training).toEqual({ ...pausedRest.training, currentSetId: 'set_2' });
  const whole = domain.pauseTraining(recorded, 60000);
  const resumed = domain.resumeTraining(whole, 100000);
  expect(resumed.training).toEqual(recorded.training);
  const running = domain.resumeTrainingRest(resumed, 110000);
  expect(running.training).toMatchObject({ restPaused: false, restEndsAt: 150000, restRemainingSec: null });
  expect(domain.skipTrainingRest(pausedRest).training).toMatchObject({ phase: 'ready', restPaused: false, restNotified: false });
  expect(domain.pauseTrainingRest(pausedRest, 60000)).toBe(pausedRest);
  expect(domain.pauseTrainingRest(rest(), 100000).training.restNotified).toBe(true);
});

test('整场暂停冻结运行计时且拒绝全部记录/增删/跳过/移除和结束；继续从剩余开始', () => {
  const s = frozen(domain.pauseTraining(rest(), 52000));
  expect(domain.getRestRemainingSec(s, 100000)).toBe(40);
  const calls = [
    () => domain.completeTrainingSet(s, 'set_1', 60000),
    () => domain.uncompleteTrainingSet(s, 'set_3'),
    () => domain.editTrainingSet(s, 'set_3', { weight: 30, reps: 5 }),
    () => domain.updateSessionSet(s, 0, 0, 'weight', 30),
    () => domain.addSessionSet(s, 0), () => domain.removeSessionSet(s, 0, 0),
    () => domain.addSessionExercise(s, { exerciseId: 'extra' }),
    () => domain.removeSessionExercise(s, 1), () => domain.setExerciseSkipped(s, 1, true),
    () => domain.startTrainingRest(s, 60000), () => domain.pauseTrainingRest(s, 60000),
    () => domain.resumeTrainingRest(s, 60000), () => domain.skipTrainingRest(s),
  ];
  calls.forEach(call => expect(call()).toBe(s));
  expect(domain.canFinishTraining(s)).toBe(false);
  expect(domain.prepareTrainingCompletion(s)).toBeNull();
  expect(domain.finalizeTrainingSession(s, 60000)).toBeNull();
  expect(domain.resumeTraining(s, 100000).training).toMatchObject({ phase: 'rest', restEndsAt: 140000 });
  const ready = domain.pauseTraining(completed(), 60000);
  expect(domain.resumeTraining(ready, 100000).training.phase).toBe('ready');
});

test('快捷时长严格枚举，运行中重新设剩余；独立/整场暂停维持冻结', () => {
  for (const seconds of [60, 90, 120, 180]) {
    const s = domain.setTrainingRestSeconds(rest(), seconds, 52000);
    expect(s.training.restSeconds).toBe(seconds);
    expect(domain.getRestRemainingSec(s, 52000)).toBe(seconds);
  }
  const s = rest();
  for (const seconds of [0, 15, 61, '90', Infinity]) expect(domain.setTrainingRestSeconds(s, seconds, 52000)).toBe(s);
  const paused = domain.setTrainingRestSeconds(domain.pauseTrainingRest(s, 52000), 120, 100000);
  expect(paused.training).toMatchObject({ restPaused: true, restRemainingSec: 120, restEndsAt: null });
  const whole = domain.setTrainingRestSeconds(domain.pauseTraining(s, 52000), 60, 100000);
  expect(whole.training).toMatchObject({ phase: 'paused', resumePhase: 'rest', restRemainingSec: 60, restEndsAt: null });
  const ready = domain.setTrainingRestSeconds(completed(), 180, 2000);
  expect(domain.startTrainingRest(ready, 3000).training.restEndsAt).toBe(183000);
});

test('±15 调默认和当前剩余，允许减到0单次提醒，过期后加时不能重启', () => {
  const longer = domain.adjustTrainingRest(rest(), 15, 52000);
  expect(longer.training.restSeconds).toBe(105);
  expect(domain.getRestRemainingSec(longer, 52000)).toBe(55);
  const paused = domain.adjustTrainingRest(domain.pauseTrainingRest(longer, 52000), -15, 100000);
  expect(paused.training).toMatchObject({ restSeconds: 90, restRemainingSec: 40, restPaused: true });
  let zero = rest();
  for (let i = 0; i < 6; i++) zero = domain.adjustTrainingRest(zero, -15, 2000);
  expect(zero.training).toMatchObject({ phase: 'ready', restSeconds: 0, restNotified: true });
  expect(domain.adjustTrainingRest(zero, -15, 2000).training.restSeconds).toBe(0);
  expect(domain.startTrainingRest(zero, 3000).training).toMatchObject({ phase: 'ready', restNotified: true });
  const expired = domain.adjustTrainingRest(rest(), 15, 100000);
  expect(expired.training).toMatchObject({ phase: 'ready', restSeconds: 105, restEndsAt: null });
  let frozenRest = domain.pauseTraining(rest(), 82000);
  frozenRest = domain.adjustTrainingRest(frozenRest, -15, 100000);
  expect(frozenRest.training).toMatchObject({ phase: 'paused', resumePhase: 'ready', restNotified: true });
  for (const delta of [NaN, Infinity, 14, '15']) expect(domain.adjustTrainingRest(longer, delta, 52000)).toBe(longer);
});

test('部分完成 gate 可用，finalize 仍拒绝 pending，确认 prepare 后才保存；纯函数不触存储', () => {
  global.wx = { setStorageSync: jest.fn() };
  const s = frozen(rest());
  expect(domain.canFinishTraining(s)).toBe(true);
  expect(domain.finalizeTrainingSession(s, 61000)).toBeNull();
  const prepared = domain.prepareTrainingCompletion(s);
  expect(domain.getTrainingProgress(prepared)).toMatchObject({ completed: 1, pending: 0, skipped: 4 });
  expect(prepared.training).toMatchObject({ phase: 'finished', restEndsAt: null, restRemainingSec: null, restNotified: false });
  expect(prepared.exercises[0].sets[2]).toEqual(s.exercises[0].sets[2]);
  const final = domain.finalizeTrainingSession(prepared, 61000);
  expect(final.submittedAt).toBe(61000);
  expect(final.training).toBeUndefined();
  expect(final.nextSetId).toBeUndefined();
  expect(final.flowVersion).toBe(2);
  expect(domain.finalizeTrainingSession(final, 62000)).toBeNull();
  expect(domain.prepareTrainingCompletion(final)).toBeNull();
  expect(domain.prepareTrainingCompletion(draft())).toBeNull();
  expect(domain.finalizeTrainingSession(prepared, Infinity)).toBeNull();
  expect(domain.canFinishTraining(domain.addSessionSet(prepared, 0))).toBe(true);
  expect(domain.finalizeTrainingSession(domain.addSessionSet(prepared, 0), 61000)).toBeNull();
  expect(wx.setStorageSync).not.toHaveBeenCalled();
  delete global.wx;
});

test('无 status 老草稿目标仍 pending，保留值和 skipped；历史不升级', () => {
  const legacy = frozen({ id: 'old', submittedAt: null, exercises: [
    { sets: [{ weight: 40, reps: 5 }, { weight: '', reps: null }] },
    { skipped: true, sets: [{ weight: 0, reps: 12 }] },
  ] });
  const s = domain.upgradeTrainingDraft(legacy);
  expect(s.exercises[0].sets).toEqual([
    { id: 'set_1', status: 'pending', weight: 40, reps: 5 },
    { id: 'set_2', status: 'pending', weight: '', reps: null },
  ]);
  expect(s.exercises[1].sets[0].status).toBe('skipped');
  expect(domain.canFinishTraining(s)).toBe(false);
  expect(domain.upgradeTrainingDraft(s)).toBe(s);
  const history = { ...legacy, submittedAt: 5000 };
  expect(domain.upgradeTrainingDraft(history)).toBe(history);
  expect(domain.upgradeTrainingDraft(null)).toBeNull();
});

test.each(['rest', 'active', 'paused'])('v1 %s 草稿升级保留完成/ID/暂停/间歇，active 只转换 ready', phase => {
  const old = rest();
  old.flowVersion = 1;
  old.exercises.forEach(ex => { ex.flowVersion = 1; });
  old.exercises[0].sets[2].id = 'stable-custom';
  old.training.phase = phase;
  old.training.undoSetId = 'stable-custom';
  if (phase === 'paused') Object.assign(old.training, { resumePhase: 'rest', restEndsAt: null, restRemainingSec: 40 });
  const before = JSON.parse(JSON.stringify(old));
  const s = domain.upgradeTrainingDraft(frozen(old));
  expect(old).toEqual(before);
  expect(s.exercises[0].sets[2]).toEqual(before.exercises[0].sets[2]);
  expect(s.training.phase).toBe(phase === 'active' ? 'ready' : phase);
  expect(s.training.restEndsAt).toBe(before.training.restEndsAt);
  expect(s.training.restRemainingSec).toBe(before.training.restRemainingSec);
  expect(s.training.restPaused).toBe(false);
  expect(domain.addSessionSet(s, 0).exercises[0].sets.map(set => set.id)).toEqual(phase === 'paused'
    ? ['set_1', 'set_2', 'stable-custom'] : ['set_1', 'set_2', 'stable-custom', 'set_6']);
  const activePause = { ...before, training: { ...before.training, phase: 'paused', resumePhase: 'active' } };
  expect(domain.upgradeTrainingDraft(activePause).training).toMatchObject({ phase: 'paused', resumePhase: 'ready' });
});

test('迁移混合缺身份组不与已存在 ID 冲突；未练新组仍不计，历史口径不改', () => {
  const s = domain.upgradeTrainingDraft({ exercises: [{ flowVersion: 1, sets: [
    { id: 'set_10', status: 'completed', weight: 20, reps: 5 }, { weight: 20, reps: 10 },
  ] }] });
  expect(s.exercises[0].sets.map(set => set.id)).toEqual(['set_10', 'set_11']);
  expect(domain.addSessionSet(s, 0).exercises[0].sets[2].id).toBe('set_12');
  const ex = { flowVersion: 2, equipment: 'body weight', skipped: true, sets: [
    { status: 'completed', weight: 10, reps: 12 }, { status: 'pending', weight: 10, reps: 20 },
    { status: 'skipped', weight: 10, reps: 30 }, { weight: 10, reps: 40 },
  ] };
  expect(domain.computeVolume(ex)).toBe(12);
  expect(domain.computeSessionTotalVolume({ exercises: [ex] })).toBe(12);
  expect(domain.computeExerciseCount({ exercises: [ex] })).toBe(1);
  const legacy = { skipped: true, equipment: 'barbell', sets: [{ weight: 20, reps: 5 }] };
  expect(domain.computeVolume(legacy)).toBe(100);
  expect(domain.computeSessionTotalVolume({ exercises: [legacy] })).toBe(0);
});

test('混合单位指标和同 plan/day 历史对比独立；兼容旧 summary 字段', () => {
  let s = domain.completeTrainingSet(completed(), 'set_5', 1100);
  s = domain.updateSessionSet(s, 1, 1, 'weight', 10); // 额外负重不混入自重次数
  s = domain.setExerciseSkipped(s, 0, true);
  s = domain.finalizeTrainingSession(domain.prepareTrainingCompletion(s), 61000);
  s.startedAt = 1000;
  const prev = { id: 'old', planId: 'p', dayId: 'd', submittedAt: 500, exercises: [
    { equipment: 'barbell', sets: [{ weight: 10, reps: 10 }, { weight: 10, reps: 5 }] },
    { equipment: 'body weight', sets: [{ weight: 0, reps: 6 }] },
    { skipped: true, equipment: 'barbell', sets: [{ weight: 100, reps: 100 }] },
  ] };
  expect(domain.computeSessionMetrics(prev)).toEqual({ completedSets: 3, weightedVolume: 150, bodyWeightReps: 6 });
  const summary = domain.computeSummary(s, [prev, { ...prev, id: 'other', dayId: 'other', submittedAt: 1000 }]);
  expect(summary).toMatchObject({ completedSets: 2, weightedVolume: 200, bodyWeightReps: 8, exerciseCount: 2,
    totalVolume: 208, durationSec: 60, comparison: { volumeDiff: 52, prevVolume: 156, prevDate: 500 },
    metricComparison: { weightedVolumeDiff: 50, bodyWeightRepsDiff: 2, prevWeightedVolume: 150, prevBodyWeightReps: 6, prevDate: 500 },
  });
  expect(domain.computeSummary(s, []).metricComparison).toBeNull();
  expect(domain.computeSessionMetrics(null)).toEqual({ completedSets: 0, weightedVolume: 0, bodyWeightReps: 0 });
});

test('非法索引与空草稿公开编辑返回原值，不借负下标删除末项', () => {
  const s = draft();
  for (const value of [null, undefined]) {
    expect(domain.addSessionExercise(value, { exerciseId: 'x' })).toBe(value);
    expect(domain.updateSessionSet(value, 0, 0, 'weight', 1)).toBe(value);
    expect(domain.addSessionSet(value, 0)).toBe(value);
    expect(domain.removeSessionSet(value, 0, 0)).toBe(value);
    expect(domain.setExerciseSkipped(value, 0, true)).toBe(value);
  }
  for (const index of [-1, 0.5, '0', 99]) {
    expect(domain.removeSessionExercise(s, index)).toBe(s);
    expect(domain.addSessionSet(s, index)).toBe(s);
    expect(domain.setExerciseSkipped(s, index, true)).toBe(s);
    expect(domain.updateSessionSet(s, index, 0, 'weight', 1)).toBe(s);
    expect(domain.removeSessionSet(s, 0, index)).toBe(s);
  }
});
