/**
 * Domain logic 外部行为测试(只断言输入/输出,不断言内部实现)
 * 覆盖 spec 要求的四个子能力:游标推进 / 打卡快照 / volume 计算 / 提交队列
 */
const domain = require('../utils/domain');

const buildPlan = (overrides = {}) =>
  Object.assign(
    {
      id: 'plan_1',
      name: '力量循环',
      cursor: 0,
      active: true,
      cycleDays: [
        {
          dayId: 'd1',
          name: '推',
          exercises: [
            { exerciseId: 'bench', name: '杠铃卧推', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 60 },
            { exerciseId: 'dip', name: '双杠臂屈伸', equipment: 'body weight', sets: 3, targetReps: 8, targetWeight: 0 },
          ],
        },
        { dayId: 'd2', name: '拉', exercises: [] },
        { dayId: 'd3', name: '腿', exercises: [] },
      ],
    },
    overrides
  );

describe('游标推进 advanceCursor', () => {
  test('完成打卡后游标 +1', () => {
    const plan = buildPlan({ cursor: 0 });
    const next = domain.advanceCursor(plan, true);
    expect(next.cursor).toBe(1);
  });

  test('循环到末尾后回到开头', () => {
    const plan = buildPlan({ cursor: 2 });
    const next = domain.advanceCursor(plan, true);
    expect(next.cursor).toBe(0);
  });

  test('漏练(未完成)不改变游标', () => {
    const plan = buildPlan({ cursor: 1 });
    const next = domain.advanceCursor(plan, false);
    expect(next.cursor).toBe(1);
  });

  test('推进返回新对象,不修改原 plan', () => {
    const plan = buildPlan({ cursor: 0 });
    domain.advanceCursor(plan, true);
    expect(plan.cursor).toBe(0);
  });

  test('空计划安全返回', () => {
    expect(domain.advanceCursor(null, true)).toBeNull();
    expect(domain.advanceCursor(buildPlan({ cycleDays: [] }), true).cursor).toBe(0);
  });
});

describe('打卡快照 snapshotSession', () => {
  test('快照复制当前游标指向的训练日,预填统一目标', () => {
    const session = domain.snapshotSession(buildPlan({ cursor: 0 }));
    expect(session.planId).toBe('plan_1');
    expect(session.dayId).toBe('d1');
    expect(session.exercises).toHaveLength(2);
    expect(session.exercises[0].sets).toHaveLength(4);
    expect(session.exercises[0].sets[0]).toEqual({ id: 'set_1', status: 'pending', weight: 60, reps: 8 });
  });

  test('快照完整保留动作顺序以及每个动作的组数/目标值', () => {
    const plan = buildPlan({
      cycleDays: [{
        dayId: 'd1',
        name: '全身',
        exercises: [
          { exerciseId: 'a', name: '动作 A', equipment: 'barbell', sets: 2, targetReps: 5, targetWeight: 40 },
          { exerciseId: 'b', name: '动作 B', equipment: 'body weight', sets: 4, targetReps: 12, targetWeight: 0 },
          { exerciseId: 'c', name: '动作 C', equipment: 'cable', sets: 3, targetReps: 10, targetWeight: 25 },
        ],
      }],
    });
    const session = domain.snapshotSession(plan);

    expect(session.exercises.map((exercise) => exercise.exerciseId)).toEqual(['a', 'b', 'c']);
    expect(session.exercises.map((exercise) => exercise.sets.length)).toEqual([2, 4, 3]);
    expect(session.exercises[0].sets).toEqual([
      { id: 'set_1', status: 'pending', weight: 40, reps: 5 },
      { id: 'set_2', status: 'pending', weight: 40, reps: 5 },
    ]);
    expect(session.exercises[1].sets[3]).toEqual({ id: 'set_6', status: 'pending', weight: 0, reps: 12 });
    expect(session.exercises[2].sets[2]).toEqual({ id: 'set_9', status: 'pending', weight: 25, reps: 10 });
  });

  test('快照与 plan 无共享引用:修改快照不影响 plan', () => {
    const plan = buildPlan({ cursor: 0 });
    const session = domain.snapshotSession(plan);
    session.exercises[0].sets[0].weight = 999;
    session.exercises[0].name = '改名';
    expect(plan.cycleDays[0].exercises[0].targetWeight).toBe(60);
    expect(plan.cycleDays[0].exercises[0].name).toBe('杠铃卧推');
  });

  test('修改 plan 不影响已生成的快照', () => {
    const plan = buildPlan({ cursor: 0 });
    const session = domain.snapshotSession(plan);
    plan.cycleDays[0].exercises[0].targetWeight = 100;
    expect(session.exercises[0].sets[0].weight).toBe(60);
  });

  test('快照允许增删动作', () => {
    let session = domain.snapshotSession(buildPlan({ cursor: 0 }));
    session = domain.removeSessionExercise(session, 0);
    expect(session.exercises).toHaveLength(1);
    session = domain.addSessionExercise(session, { exerciseId: 'fly', name: '绳索夹胸', equipment: 'cable' });
    expect(session.exercises).toHaveLength(2);
    expect(session.exercises[0].exerciseId).toBe('dip');
    expect(session.exercises[0].sets[0]).toEqual({ id: 'set_5', status: 'pending', weight: 0, reps: 8 });
    expect(session.exercises[1].exerciseId).toBe('fly');
    expect(session.exercises[1].sets).toHaveLength(1);
  });

  test('游标指向哪个训练日就快照哪个', () => {
    const session = domain.snapshotSession(buildPlan({ cursor: 1 }));
    expect(session.dayId).toBe('d2');
  });

  test('空计划返回 null', () => {
    expect(domain.snapshotSession(buildPlan({ cycleDays: [] }))).toBeNull();
  });
});

describe('set 编辑操作', () => {
  test('updateSessionSet 更新指定组数据,空值保持 null', () => {
    let session = domain.snapshotSession(buildPlan({ cursor: 0 }));
    session = domain.updateSessionSet(session, 0, 1, 'weight', 65);
    expect(session.exercises[0].sets[1].weight).toBe(65);
    session = domain.updateSessionSet(session, 0, 1, 'weight', '');
    expect(session.exercises[0].sets[1].weight).toBeNull();
  });

  test('addSessionSet / removeSessionSet 增删组,至少保留一组', () => {
    let session = domain.snapshotSession(buildPlan({ cursor: 0 }));
    session = domain.addSessionSet(session, 0);
    expect(session.exercises[0].sets).toHaveLength(5);
    session = domain.removeSessionSet(session, 0, 4);
    expect(session.exercises[0].sets).toHaveLength(4);
    let one = domain.removeSessionExercise(session, 1);
    one = domain.removeSessionSet(one, 0, 0);
    expect(one.exercises[0].sets.length).toBeGreaterThanOrEqual(1);
  });

  test('setExerciseSkipped 标记跳过', () => {
    let session = domain.snapshotSession(buildPlan({ cursor: 0 }));
    session = domain.setExerciseSkipped(session, 0, true);
    expect(session.exercises[0].skipped).toBe(true);
  });

  test('非法索引安全返回,不抛错', () => {
    const session = domain.snapshotSession(buildPlan({ cursor: 0 }));
    expect(domain.updateSessionSet(session, 99, 0, 'weight', 1).exercises).toHaveLength(2);
    expect(domain.updateSessionSet(session, 0, 99, 'weight', 1).exercises[0].sets).toHaveLength(4);
    expect(domain.addSessionSet(session, 99)).toEqual(session);
    expect(domain.removeSessionSet(session, 99, 0)).toEqual(session);
    expect(domain.setExerciseSkipped(session, 99, true)).toEqual(session);
    expect(domain.removeSessionExercise(null, 0)).toBeNull();
  });

  test('updateSessionSet undefined 值保持 null', () => {
    let session = domain.snapshotSession(buildPlan({ cursor: 0 }));
    session = domain.updateSessionSet(session, 0, 0, 'reps', undefined);
    expect(session.exercises[0].sets[0].reps).toBeNull();
  });

  test('空 set 动作快照至少预填一组', () => {
    const plan = buildPlan({ cursor: 0 });
    plan.cycleDays[0].exercises[0].sets = 0;
    const session = domain.snapshotSession(plan);
    expect(session.exercises[0].sets).toHaveLength(1);
  });
});

describe('volume 计算 computeVolume', () => {
  test('常规动作 = Σ(weight × reps)', () => {
    const ex = { equipment: 'barbell', sets: [{ weight: 60, reps: 8 }, { weight: 60, reps: 6 }] };
    expect(domain.computeVolume(ex)).toBe(60 * 8 + 60 * 6);
  });

  test('自重动作 = Σreps', () => {
    const ex = { equipment: 'body weight', sets: [{ weight: 5, reps: 8 }, { weight: 0, reps: 10 }] };
    expect(domain.computeVolume(ex)).toBe(18);
  });

  test('非 body weight 原值(assisted / sled machine)仍按重量×次数,不算自重', () => {
    const assisted = { equipment: 'assisted', sets: [{ weight: 20, reps: 8 }] };
    expect(domain.computeVolume(assisted)).toBe(160);
    const sled = { equipment: 'sled machine', sets: [{ weight: 60, reps: 10 }] };
    expect(domain.computeVolume(sled)).toBe(600);
  });

  test('空 set 列表返回 0', () => {
    expect(domain.computeVolume({ equipment: 'barbell', sets: [] })).toBe(0);
    expect(domain.computeVolume(null)).toBe(0);
  });

  test('null/空字符串字段按 0 处理', () => {
    const ex = { equipment: 'barbell', sets: [{ weight: null, reps: 8 }, { weight: 60, reps: null }] };
    expect(domain.computeVolume(ex)).toBe(0);
  });

  test('session 总容量跳过 skipped 动作', () => {
    const session = {
      exercises: [
        { equipment: 'barbell', skipped: false, sets: [{ weight: 60, reps: 10 }] },
        { equipment: 'barbell', skipped: true, sets: [{ weight: 100, reps: 10 }] },
      ],
    };
    expect(domain.computeSessionTotalVolume(session)).toBe(600);
  });
});

describe('完成小结 computeSummary', () => {
  test('输出动作数/总容量/时长', () => {
    const session = {
      id: 's1',
      planId: 'p1',
      dayId: 'd1',
      startedAt: Date.now() - 60 * 1000,
      exercises: [{ equipment: 'barbell', skipped: false, sets: [{ weight: 60, reps: 10 }] }],
    };
    const summary = domain.computeSummary(session, []);
    expect(summary.exerciseCount).toBe(1);
    expect(summary.totalVolume).toBe(600);
    expect(summary.durationSec).toBeGreaterThan(0);
    expect(summary.comparison).toBeNull();
  });

  test('与上次同 planId + dayId 的训练对比容量差', () => {
    const prev = {
      id: 's0',
      planId: 'p1',
      dayId: 'd1',
      submittedAt: 1000,
      exercises: [{ equipment: 'barbell', sets: [{ weight: 50, reps: 10 }] }],
    };
    const session = {
      id: 's1',
      planId: 'p1',
      dayId: 'd1',
      startedAt: Date.now(),
      exercises: [{ equipment: 'barbell', sets: [{ weight: 60, reps: 10 }] }],
    };
    const summary = domain.computeSummary(session, [prev]);
    expect(summary.comparison.volumeDiff).toBe(100);
    expect(summary.comparison.prevVolume).toBe(500);
  });

  test('不同训练日不参与对比', () => {
    const other = {
      id: 's0',
      planId: 'p1',
      dayId: 'd2',
      submittedAt: 1000,
      exercises: [{ equipment: 'barbell', sets: [{ weight: 50, reps: 10 }] }],
    };
    const session = {
      id: 's1',
      planId: 'p1',
      dayId: 'd1',
      startedAt: Date.now(),
      exercises: [{ equipment: 'barbell', sets: [{ weight: 60, reps: 10 }] }],
    };
    expect(domain.computeSummary(session, [other]).comparison).toBeNull();
  });
});

describe('提交队列', () => {
  const s = (id, attempts = 0) => ({ id, attempts });

  test('有网络且未尝试过 → 立即提交', () => {
    expect(domain.decideSubmission([s('a')], true)).toEqual({ action: 'submit-now', sessionId: 'a' });
  });

  test('无网络 → 保持队列等待', () => {
    expect(domain.decideSubmission([s('a')], false)).toEqual({ action: 'queued', sessionId: 'a' });
  });

  test('失败过后重试', () => {
    expect(domain.decideSubmission([s('a', 2)], true)).toEqual({ action: 'retry', sessionId: 'a' });
  });

  test('空队列 → idle', () => {
    expect(domain.decideSubmission([], true)).toEqual({ action: 'idle', sessionId: null });
    expect(domain.decideSubmission(null, true)).toEqual({ action: 'idle', sessionId: null });
  });

  test('enqueue 幂等,同 id 不重复', () => {
    let queue = domain.enqueueSession([], s('a'));
    queue = domain.enqueueSession(queue, s('a'));
    expect(queue).toHaveLength(1);
  });

  test('dequeue 提交成功后移除', () => {
    const queue = domain.enqueueSession([], s('a'));
    expect(domain.dequeueSession(queue, 'a')).toHaveLength(0);
  });

  test('markAttemptFailed 失败计数 +1 且留在队列', () => {
    let queue = domain.enqueueSession([], s('a'));
    queue = domain.markAttemptFailed(queue, 'a');
    expect(queue[0].attempts).toBe(1);
    expect(queue).toHaveLength(1);
  });

  test('markAttemptFailed 无 attempts 字段时从 0 计', () => {
    const queue = domain.markAttemptFailed([{ id: 'a' }], 'a');
    expect(queue[0].attempts).toBe(1);
  });

  test('完整流程:无网入队 → 有网重试 → 成功出队', () => {
    let queue = domain.enqueueSession([], s('a'));
    expect(domain.decideSubmission(queue, false).action).toBe('queued');
    queue = domain.markAttemptFailed(queue, 'a');
    expect(domain.decideSubmission(queue, true).action).toBe('retry');
    queue = domain.dequeueSession(queue, 'a');
    expect(domain.decideSubmission(queue, true).action).toBe('idle');
  });
});

// 逐组训练：只经由公开 domain API 观察纯输入输出。
describe('逐组训练', () => {
  const draft = () => domain.snapshotSession(buildPlan());
  test('预填和追加共用 pending 初始化，稳定 ID 不重复，完成禁用', () => {
    let s = draft();
    expect(s.training.phase).toBe('ready');
    expect(s.training.currentSetId).toBe('set_1');
    expect(domain.canFinishTraining(s)).toBe(false);
    s = domain.addSessionSet(s, 0);
    s = domain.addSessionExercise(s, { exerciseId: 'extra' });
    const sets = s.exercises.flatMap(ex => ex.sets);
    expect(sets.every(set => set.status === 'pending')).toBe(true);
    expect(new Set(sets.map(set => set.id)).size).toBe(9);
    expect(domain.computeVolume(s.exercises[0])).toBe(0);
  });
});

const trainingDraft = () => domain.snapshotSession(buildPlan());
const startFirst = () => domain.startTrainingSet(trainingDraft(), 'set_1', 1000);
test('只能开始顺序当前组；完成需先开始；双击不重复计入或重建间歇', () => {
  const s = trainingDraft();
  expect(domain.completeTrainingSet(s, 'set_1', 1000)).toEqual(s);
  expect(domain.startTrainingSet(s, 'set_2', 1000)).toEqual(s);
  const active = startFirst();
  expect(active.training.phase).toBe('active');
  expect(domain.startTrainingSet(active, 'set_2', 1000)).toEqual(active);
  const done = domain.completeTrainingSet(active, 'set_1', 2000);
  expect(done.exercises[0].sets[0].status).toBe('completed');
  expect(done.training).toMatchObject({ phase: 'rest', currentSetId: 'set_2', restEndsAt: 92000, undoSetId: 'set_1' });
  expect(domain.completeTrainingSet(done, 'set_1', 3000)).toEqual(done);
  expect(s.exercises[0].sets[0].status).toBe('pending');
});

test.each(['', null, undefined, 0, -1, 1.5, Infinity, NaN, 'abc', true])('次数 %p 拒绝打卡且不创建间歇', reps => {
  const s = startFirst();
  s.exercises[0].sets[0].reps = reps;
  expect(domain.completeTrainingSet(s, 'set_1', 2000)).toEqual(s);
});
test.each(['', null, undefined, -1, Infinity, NaN, 'abc', true])('普通重量 %p 拒绝打卡', weight => {
  const s = startFirst();
  s.exercises[0].sets[0].weight = weight;
  expect(domain.completeTrainingSet(s, 'set_1', 2000)).toEqual(s);
});
test('自重空重量归零，但非有限值不得经 clone 误归零；有效数字字符串允许', () => {
  let s = domain.setExerciseSkipped(trainingDraft(), 0, true);
  s = domain.updateSessionSet(s, 1, 0, 'weight', '');
  s = domain.updateSessionSet(s, 1, 0, 'reps', '12');
  s = domain.startTrainingSet(s, 'set_5', 1000);
  const done = domain.completeTrainingSet(s, 'set_5', 2000);
  expect(done.exercises[1].sets[0]).toMatchObject({ weight: 0, reps: 12, status: 'completed' });
  for (const weight of [Infinity, NaN, 'Infinity']) {
    s.exercises[1].sets[0].weight = weight;
    expect(domain.completeTrainingSet(s, 'set_5', 2000)).toEqual(s);
  }
});

const firstRest = () => domain.completeTrainingSet(startFirst(), 'set_1', 2000);
test('间歇由绝对时间校准，到时提醒状态一次且不自动开练，跳过不提醒', () => {
  const s = firstRest();
  expect(domain.getRestRemainingSec(s, 52500)).toBe(40);
  expect(domain.tickTrainingRest(s, 91999).training.phase).toBe('rest');
  const expired = domain.tickTrainingRest(s, 100000);
  expect(expired.training).toMatchObject({ phase: 'ready', restNotified: true, currentSetId: 'set_2', restEndsAt: null });
  expect(domain.tickTrainingRest(expired, 110000)).toEqual(expired);
  expect(domain.startTrainingSet(expired, 'set_2', 110000).training.phase).toBe('active');
  const skipped = domain.skipTrainingRest(s);
  expect(skipped.training).toMatchObject({ phase: 'ready', restNotified: false, restSkipped: true });
  expect(domain.tickTrainingRest(skipped, 100000)).toEqual(skipped);
});

test('暂停冻结间歇，继续重建截止；暂停 active 保留同组，暂停禁止提交与迁移', () => {
  const paused = domain.pauseTraining(firstRest(), 52000);
  expect(paused.training).toMatchObject({ phase: 'paused', resumePhase: 'rest', restRemainingSec: 40, restEndsAt: null });
  expect(domain.getRestRemainingSec(paused, 112000)).toBe(40);
  expect(domain.tickTrainingRest(paused, 112000)).toEqual(paused);
  expect(domain.resumeTraining(paused, 112000).training).toMatchObject({ phase: 'rest', restEndsAt: 152000 });
  expect(domain.pauseTraining(paused, 112000)).toEqual(paused);
  const active = domain.pauseTraining(startFirst(), 2000);
  expect(domain.completeTrainingSet(active, 'set_1', 3000)).toEqual(active);
  expect(domain.resumeTraining(active, 100000).training).toMatchObject({ phase: 'active', currentSetId: 'set_1' });
  expect(domain.canFinishTraining(active)).toBe(false);
});

test('±15 秒调整当前和后续时长，暂停时也可调，最小 0 触发单次到时', () => {
  const longer = domain.adjustTrainingRest(firstRest(), 15, 52000);
  expect(longer.training.restSeconds).toBe(105);
  expect(domain.getRestRemainingSec(longer, 52000)).toBe(55);
  const nextActive = domain.startTrainingSet(domain.skipTrainingRest(longer), 'set_2', 53000);
  expect(domain.completeTrainingSet(nextActive, 'set_2', 54000).training.restEndsAt).toBe(159000);
  const paused = domain.pauseTraining(longer, 52000);
  const shorter = domain.adjustTrainingRest(paused, -15, 100000);
  expect(shorter.training).toMatchObject({ restSeconds: 90, restRemainingSec: 40, restEndsAt: null });
  let zero = firstRest();
  for (let i = 0; i < 6; i++) zero = domain.adjustTrainingRest(zero, -15, 2000);
  expect(zero.training).toMatchObject({ phase: 'ready', restSeconds: 0, restNotified: true });
  expect(domain.adjustTrainingRest(zero, -15, 2000).training.restSeconds).toBe(0);
  for (const delta of [NaN, Infinity, 14, '15']) expect(domain.adjustTrainingRest(longer, delta, 52000)).toEqual(longer);
});

test('撤销在下一组开始前有效，取消间歇保留成绩回 active；下一组开始即截止', () => {
  const rest = firstRest();
  const undone = domain.undoLastTrainingSet(rest);
  expect(undone.exercises[0].sets[0]).toMatchObject({ status: 'pending', weight: 60, reps: 8 });
  expect(undone.training).toMatchObject({ phase: 'active', currentSetId: 'set_1', restEndsAt: null, undoSetId: null });
  expect(domain.undoLastTrainingSet(undone)).toEqual(undone);
  expect(domain.undoLastTrainingSet(domain.tickTrainingRest(rest, 100000)).training.phase).toBe('active');
  expect(domain.undoLastTrainingSet(domain.skipTrainingRest(rest)).training.phase).toBe('active');
  const nextActive = domain.startTrainingSet(domain.skipTrainingRest(rest), 'set_2', 3000);
  expect(domain.undoLastTrainingSet(nextActive)).toEqual(nextActive);
  const paused = domain.pauseTraining(rest, 3000);
  expect(domain.undoLastTrainingSet(paused)).toEqual(paused);
});

test('已完成/active 组不可删除，末组删除至少留一组；练过动作不可整项移除', () => {
  const active = startFirst();
  expect(domain.removeSessionSet(active, 0, 0)).toEqual(active);
  const done = firstRest();
  expect(domain.removeSessionSet(done, 0, 0)).toEqual(done);
  expect(domain.removeSessionExercise(done, 0)).toEqual(done);
  expect(domain.removeSessionSet(done, 0, 1)).toEqual(done);
  const shorter = domain.removeSessionSet(done, 0, 3);
  expect(shorter.exercises[0].sets).toHaveLength(3);
  expect(shorter.training.currentSetId).toBe('set_2');
  let one = domain.removeSessionExercise(trainingDraft(), 0);
  one = domain.removeSessionSet(one, 0, 2);
  one = domain.removeSessionSet(one, 0, 1);
  expect(domain.removeSessionSet(one, 0, 0)).toEqual(one);
});
test('列表变动重核稳定引用，active 动作可显式跳过/移除；恢复不抢占 active', () => {
  let s = domain.removeSessionExercise(trainingDraft(), 0);
  expect(s.training.currentSetId).toBe('set_5');
  s = domain.addSessionSet(s, 0);
  expect(s.exercises[0].sets[3].id).toBe('set_8');
  s = domain.startTrainingSet(s, 'set_5', 1000);
  s = domain.setExerciseSkipped(s, 0, true);
  expect(s.training).toMatchObject({ phase: 'finished', currentSetId: null });
  s = domain.setExerciseSkipped(s, 0, false);
  expect(s.training).toMatchObject({ phase: 'ready', currentSetId: 'set_5' });
  let both = domain.setExerciseSkipped(trainingDraft(), 0, true);
  both = domain.startTrainingSet(both, 'set_5', 1000);
  both = domain.setExerciseSkipped(both, 0, false);
  expect(both.training).toMatchObject({ phase: 'active', currentSetId: 'set_5' });
  both = domain.removeSessionExercise(both, 1);
  expect(both.training).toMatchObject({ phase: 'ready', currentSetId: 'set_1' });
});

test('completed 编辑必须整组合法，且不新建间歇；pending 可留空；未知字段拒绝', () => {
  const done = firstRest();
  for (const [field, value] of [['weight', ''], ['weight', Infinity], ['reps', 0], ['reps', 2.5], ['other', 1]]) {
    expect(domain.updateSessionSet(done, 0, 0, field, value)).toEqual(done);
  }
  const edited = domain.updateSessionSet(done, 0, 0, 'weight', '65');
  expect(edited.exercises[0].sets[0]).toMatchObject({ status: 'completed', weight: 65, reps: 8 });
  expect(edited.training).toEqual(done.training);
  const pair = domain.editTrainingSet(done, 'set_1', { weight: 70, reps: 5 });
  expect(pair.exercises[0].sets[0]).toMatchObject({ status: 'completed', weight: 70, reps: 5 });
  expect(pair.training).toEqual(done.training);
  expect(domain.editTrainingSet(done, 'set_1', { weight: 70 })).toEqual(done);
  const pending = domain.updateSessionSet(trainingDraft(), 0, 0, 'reps', '');
  expect(pending.exercises[0].sets[0].reps).toBeNull();
  expect(domain.updateSessionSet(pending, 0, 0, 'status', 'completed')).toEqual(pending);
});

test('部分跳过保留 completed 容量/动作数，恢复不改 completed；进度不把跳过当完成', () => {
  let s = firstRest();
  s = domain.skipTrainingRest(s);
  s = domain.startTrainingSet(s, 'set_2', 3000);
  s = domain.completeTrainingSet(s, 'set_2', 4000);
  s = domain.setExerciseSkipped(s, 0, true);
  expect(s.exercises[0].sets.map(set => set.status)).toEqual(['completed', 'completed', 'skipped', 'skipped']);
  expect(domain.computeVolume(s.exercises[0])).toBe(960);
  expect(domain.computeSessionTotalVolume(s)).toBe(960);
  expect(domain.computeExerciseCount(s)).toBe(1);
  expect(domain.getTrainingProgress(s)).toEqual({ completed: 2, pending: 3, skipped: 2, total: 5, ratio: 0.4 });
  const restored = domain.setExerciseSkipped(s, 0, false);
  expect(restored.exercises[0].sets.map(set => set.status)).toEqual(['completed', 'completed', 'pending', 'pending']);
  expect(restored.training.currentSetId).toBe('set_3');
});
test('跨动作也间歇，末组无间歇；至少完成一组且无 pending 才能结束；加练重新禁用', () => {
  let s = domain.removeSessionSet(trainingDraft(), 0, 3);
  s = domain.removeSessionSet(s, 0, 2);
  s = domain.removeSessionSet(s, 0, 1);
  s = domain.startTrainingSet(s, 'set_1', 1000);
  s = domain.completeTrainingSet(s, 'set_1', 2000);
  expect(s.training).toMatchObject({ phase: 'rest', currentSetId: 'set_5' });
  s = domain.setExerciseSkipped(s, 1, true);
  expect(s.training).toMatchObject({ phase: 'finished', restEndsAt: null });
  expect(domain.canFinishTraining(s)).toBe(true);
  expect(domain.canFinishTraining(domain.pauseTraining(s, 3000))).toBe(false);
  expect(domain.canFinishTraining(domain.addSessionSet(s, 0))).toBe(false);
  expect(domain.addSessionSet(s, 0).training.phase).toBe('ready');
  expect(domain.canFinishTraining(domain.addSessionExercise(s, { exerciseId: 'extra' }))).toBe(false);
  expect(domain.canFinishTraining(domain.setExerciseSkipped(s, 1, false))).toBe(false);
  let all = domain.setExerciseSkipped(trainingDraft(), 0, true);
  all = domain.setExerciseSkipped(all, 1, true);
  expect(domain.canFinishTraining(all)).toBe(false);
  expect(domain.getTrainingProgress(all)).toEqual({ completed: 0, pending: 0, skipped: 7, total: 0, ratio: 0 });
  let last = domain.removeSessionExercise(trainingDraft(), 1);
  for (let i = 3; i > 0; i--) last = domain.removeSessionSet(last, 0, i);
  last = domain.completeTrainingSet(domain.startTrainingSet(last, 'set_1', 1000), 'set_1', 2000);
  expect(last.training).toMatchObject({ phase: 'finished', restEndsAt: null, undoSetId: 'set_1' });
  expect(domain.undoLastTrainingSet(last).training.phase).toBe('active');
  const empty = domain.snapshotSession(buildPlan({ cursor: 1 }));
  expect(domain.canFinishTraining(empty)).toBe(false);
});

test('仅显式升级旧草稿，保留值和旧 skipped；二次升级保留打卡、暂停和间歇', () => {
  const legacy = { id: 'old', startedAt: 1000, submittedAt: null, exercises: [
    { equipment: 'barbell', skipped: false, sets: [{ weight: 40, reps: 5 }, { weight: '', reps: null }] },
    { equipment: 'body weight', skipped: true, sets: [{ weight: 0, reps: 12 }] },
  ] };
  const oldCopy = JSON.parse(JSON.stringify(legacy));
  const upgraded = domain.upgradeTrainingDraft(legacy);
  expect(legacy).toEqual(oldCopy);
  expect(upgraded.exercises[0].sets).toEqual([
    { id: 'set_1', status: 'pending', weight: 40, reps: 5 },
    { id: 'set_2', status: 'pending', weight: '', reps: null },
  ]);
  expect(upgraded.exercises[1].sets[0]).toMatchObject({ status: 'skipped', weight: 0, reps: 12 });
  expect(upgraded.training).toMatchObject({ phase: 'ready', currentSetId: 'set_1' });
  const active = domain.startTrainingSet(upgraded, 'set_1', 2000);
  const rest = domain.completeTrainingSet(active, 'set_1', 3000);
  expect(domain.upgradeTrainingDraft(rest)).toEqual(rest);
  const paused = domain.pauseTraining(rest, 4000);
  expect(domain.upgradeTrainingDraft(paused)).toEqual(paused);
  expect(domain.upgradeTrainingDraft(null)).toBeNull();
  const history = { ...legacy, submittedAt: 5000 };
  expect(domain.upgradeTrainingDraft(history)).toBe(history);
  expect(domain.computeSessionTotalVolume(history)).toBe(200);
  expect(domain.computeExerciseCount(history)).toBe(1);
});

test('新旧统计独立：单动作无 session 参数也能判断，缺状态新组不冒充完成，自重仅计 completed', () => {
  const ex = { flowVersion: 1, equipment: 'body weight', skipped: true, sets: [
    { status: 'completed', weight: 10, reps: 12 },
    { status: 'pending', weight: 10, reps: 20 },
    { status: 'skipped', weight: 10, reps: 30 },
    { weight: 10, reps: 40 },
  ] };
  expect(domain.computeVolume(ex)).toBe(12);
  expect(domain.computeExerciseCount({ exercises: [ex] })).toBe(1);
  expect(domain.computeSessionTotalVolume({ exercises: [ex] })).toBe(12);
  expect(domain.computeVolume({ equipment: 'barbell', sets: [{ status: 'completed', weight: 20, reps: 5 }, { weight: 20, reps: 10 }] })).toBe(100);
  expect(domain.computeVolume({ equipment: 'barbell', sets: [{ weight: 20, reps: 5 }] })).toBe(100);
});
test('整场纯 finalize 经 gate 拒绝未完成/paused，清理控制态且固定提交时间，不推进或入队', () => {
  expect(domain.finalizeTrainingSession(trainingDraft(), 6000)).toBeNull();
  let s = domain.setExerciseSkipped(firstRest(), 0, true);
  s = domain.setExerciseSkipped(s, 1, true);
  s.startedAt = 1000;
  expect(domain.finalizeTrainingSession(domain.pauseTraining(s, 5000), 6000)).toBeNull();
  expect(domain.finalizeTrainingSession(s, Infinity)).toBeNull();
  const final = domain.finalizeTrainingSession(s, 61000);
  expect(final.submittedAt).toBe(61000);
  expect(final.training).toBeUndefined();
  expect(final.nextSetId).toBeUndefined();
  expect(final.flowVersion).toBe(1);
  expect(final.exercises[0].sets[0].status).toBe('completed');
  expect(s.submittedAt).toBeNull();
  expect(s.training.phase).toBe('finished');
  expect(domain.computeSummary(final, []).durationSec).toBe(60);
  expect(domain.finalizeTrainingSession(final, 70000)).toBeNull();
});

test('旧历史单动作容量保持原始计算口径，整场仍排除旧 skipped', () => {
  const old = { equipment: 'barbell', skipped: true, sets: [{ weight: 20, reps: 5 }] };
  expect(domain.computeVolume(old)).toBe(100);
  expect(domain.computeSessionTotalVolume({ exercises: [old] })).toBe(0);
  expect(domain.computeExerciseCount({ exercises: [old] })).toBe(0);
});

test('零秒后续间歇立即待开始，空场不能开始；恢复和过期不会重开间歇', () => {
  let s = firstRest();
  for (let i = 0; i < 6; i++) s = domain.adjustTrainingRest(s, -15, 2000);
  s = domain.startTrainingSet(s, 'set_2', 3000);
  s = domain.completeTrainingSet(s, 'set_2', 4000);
  expect(s.training).toMatchObject({ phase: 'ready', restEndsAt: null, restNotified: true });
  const expiredPlus = domain.adjustTrainingRest(firstRest(), 15, 100000);
  expect(expiredPlus.training).toMatchObject({ phase: 'ready', restSeconds: 105, restEndsAt: null });
  const empty = domain.snapshotSession(buildPlan({ cursor: 1 }));
  expect(domain.startTrainingSet(empty, null, 1000)).toEqual(empty);
  const invalid = startFirst();
  invalid.exercises[0].equipment = 'body weight';
  invalid.exercises[0].sets[0].weight = Infinity;
  const paused = domain.pauseTraining(invalid, 2000);
  expect(paused.exercises[0].sets[0].weight).toBe(Infinity);
  expect(domain.completeTrainingSet(domain.resumeTraining(paused, 3000), 'set_1', 4000)).toEqual(invalid);
});

test('公开编辑对空草稿/非法索引统一 no-op，不抛错、不借负下标删最后项', () => {
  const s = trainingDraft();
  for (const value of [null, undefined]) {
    expect(domain.addSessionExercise(value, { exerciseId: 'x' })).toBe(value);
    expect(domain.updateSessionSet(value, 0, 0, 'weight', 1)).toBe(value);
    expect(domain.addSessionSet(value, 0)).toBe(value);
    expect(domain.removeSessionSet(value, 0, 0)).toBe(value);
    expect(domain.setExerciseSkipped(value, 0, true)).toBe(value);
  }
  expect(domain.addSessionExercise(s, null)).toEqual(s);
  for (const index of [-1, 0.5, '0', 99]) {
    expect(domain.removeSessionExercise(s, index)).toEqual(s);
    expect(domain.addSessionSet(s, index)).toEqual(s);
    expect(domain.setExerciseSkipped(s, index, true)).toEqual(s);
    expect(domain.updateSessionSet(s, index, 0, 'weight', 1)).toEqual(s);
    expect(domain.removeSessionSet(s, 0, index)).toEqual(s);
  }
});

test('逐组 status 也是新流程标记，编辑保护不依赖 session 版本字段', () => {
  const s = firstRest();
  delete s.flowVersion;
  expect(domain.removeSessionSet(s, 0, 0)).toEqual(s);
  const skipped = domain.setExerciseSkipped(s, 0, true);
  expect(skipped.exercises[0].sets.map(set => set.status)).toEqual(['completed', 'skipped', 'skipped', 'skipped']);
});
