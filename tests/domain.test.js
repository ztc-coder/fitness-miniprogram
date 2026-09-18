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
    expect(session.exercises[0].sets[0]).toEqual({ weight: 60, reps: 8 });
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
      { weight: 40, reps: 5 },
      { weight: 40, reps: 5 },
    ]);
    expect(session.exercises[1].sets[3]).toEqual({ weight: 0, reps: 12 });
    expect(session.exercises[2].sets[2]).toEqual({ weight: 25, reps: 10 });
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
    expect(session.exercises[0].sets[0]).toEqual({ weight: 0, reps: 8 });
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
