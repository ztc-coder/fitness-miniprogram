/**
 * Domain logic 模块(唯一测试 seam)
 *
 * 与 CloudBase SDK、WXML 渲染层完全解耦的纯逻辑模块:
 * 输入输出均为纯 JS 对象/数组,不依赖网络或小程序运行时 API。
 *
 * 子能力:
 * 1. 游标推进 cursor advance —— 完成打卡才推进,循环到末尾回到开头
 * 2. 打卡快照 session snapshot —— 深拷贝,与 plan 无共享引用
 * 3. volume 计算 —— 常规 Σ(weight×reps),自重动作 Σreps
 * 4. 提交队列 submission queue —— 纯判定逻辑,网络请求由上层注入
 */

// ===== 基础工具 =====

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isBodyWeight(exercise) {
  return !!exercise && exercise.equipment === 'body weight';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// ===== 1. 游标推进 =====

/**
 * 完成驱动推进:打卡完成才推进游标;漏练(未完成)不改变游标。
 * @param plan Plan 对象(含 cycleDays、cursor)
 * @param completed 是否完成打卡
 * @returns 新的 plan(游标 +1,到末尾则回到开头);未完成返回原样
 */
function advanceCursor(plan, completed) {
  if (!plan || !Array.isArray(plan.cycleDays) || plan.cycleDays.length === 0) {
    return plan;
  }
  if (!completed) {
    return plan;
  }
  const nextCursor = (plan.cursor + 1) % plan.cycleDays.length;
  return Object.assign({}, plan, { cursor: nextCursor });
}

// ===== 2. 打卡快照 =====

/**
 * 生成空白 set 列表(预填目标数据,打卡时自由修改)。
 */
function buildSessionSets(planExercise) {
  const count = Math.max(1, planExercise.sets || 1);
  const sets = [];
  for (let i = 0; i < count; i += 1) {
    sets.push({ weight: planExercise.targetWeight, reps: planExercise.targetReps });
  }
  return sets;
}

/**
 * 把 plan 当前游标指向的训练日复制成一条独立 session 草稿。
 * 深拷贝,不与 plan 共享引用;快照允许后续增删动作、编辑每组 {weight, reps}。
 * @param plan Plan 对象
 * @returns session 草稿;无训练日返回 null
 */
function snapshotSession(plan) {
  if (!plan || !Array.isArray(plan.cycleDays) || plan.cycleDays.length === 0) {
    return null;
  }
  const dayIndex = plan.cursor % plan.cycleDays.length;
  const day = plan.cycleDays[dayIndex];
  if (!day) {
    return null;
  }
  return {
    id: generateId('session'),
    planId: plan.id,
    planName: plan.name,
    dayId: day.dayId,
    dayName: day.name,
    dayIndex,
    startedAt: Date.now(),
    submittedAt: null,
    exercises: (day.exercises || []).map((item) => ({
      exerciseId: item.exerciseId,
      name: item.name || '',
      equipment: item.equipment || '',
      skipped: false,
      sets: buildSessionSets(item),
    })),
  };
}

/**
 * 从草稿中移除一个动作(跳过/临时不练)。
 */
function removeSessionExercise(session, index) {
  if (!session || !Array.isArray(session.exercises)) {
    return session;
  }
  const next = clone(session);
  next.exercises.splice(index, 1);
  return next;
}

/**
 * 向草稿追加一个动作(临时加练),预填一组空白 set。
 */
function addSessionExercise(session, exercise) {
  const next = clone(session);
  next.exercises.push({
    exerciseId: exercise.exerciseId,
    name: exercise.name || '',
    equipment: exercise.equipment || '',
    skipped: false,
    sets: [{ weight: null, reps: null }],
  });
  return next;
}

/**
 * 更新草稿中某组数据。field: 'weight' | 'reps';空值保持 null。
 */
function updateSessionSet(session, exIndex, setIndex, field, value) {
  const next = clone(session);
  const ex = next.exercises[exIndex];
  if (!ex || !ex.sets[setIndex]) {
    return next;
  }
  ex.sets[setIndex][field] = value === '' || value === undefined ? null : value;
  return next;
}

function addSessionSet(session, exIndex) {
  const next = clone(session);
  const ex = next.exercises[exIndex];
  if (ex) {
    ex.sets.push({ weight: null, reps: null });
  }
  return next;
}

function removeSessionSet(session, exIndex, setIndex) {
  const next = clone(session);
  const ex = next.exercises[exIndex];
  if (ex && ex.sets.length > 1) {
    ex.sets.splice(setIndex, 1);
  }
  return next;
}

function setExerciseSkipped(session, exIndex, skipped) {
  const next = clone(session);
  const ex = next.exercises[exIndex];
  if (ex) {
    ex.skipped = !!skipped;
  }
  return next;
}

// ===== 3. volume 计算 =====

/**
 * 计算一个动作的训练量:
 * - 常规动作:Σ(weight × reps)
 * - 自重动作(equipment == "body weight"):Σreps
 * 空 set 列表返回 0。此口径同时用于完成小结与记录趋势曲线。
 */
function computeVolume(exercise) {
  if (!exercise || !Array.isArray(exercise.sets) || exercise.sets.length === 0) {
    return 0;
  }
  if (isBodyWeight(exercise)) {
    return exercise.sets.reduce((sum, set) => sum + (Number(set.reps) || 0), 0);
  }
  return exercise.sets.reduce(
    (sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0),
    0
  );
}

/**
 * 计算整场 session 的总容量(跳过/空组不计)。
 */
function computeSessionTotalVolume(session) {
  if (!session || !Array.isArray(session.exercises)) {
    return 0;
  }
  return session.exercises.reduce((sum, ex) => {
    if (ex.skipped) return sum;
    return sum + computeVolume(ex);
  }, 0);
}

/**
 * 有效动作数:跳过且整组为空的不计。
 */
function computeExerciseCount(session) {
  if (!session || !Array.isArray(session.exercises)) {
    return 0;
  }
  return session.exercises.filter((ex) => !ex.skipped).length;
}

/**
 * 完成小结 + 与上次同类型(同 planId + dayId)训练对比。
 * @param session 本次 session
 * @param previousSessions 已提交的历史 session 列表
 */
function computeSummary(session, previousSessions) {
  const totalVolume = computeSessionTotalVolume(session);
  const exerciseCount = computeExerciseCount(session);
  const durationSec = Math.max(0, Math.round((Date.now() - session.startedAt) / 1000));

  const prev = (previousSessions || [])
    .filter(
      (s) =>
        s.planId === session.planId &&
        s.dayId === session.dayId &&
        s.id !== session.id &&
        s.submittedAt
    )
    .sort((a, b) => b.submittedAt - a.submittedAt)[0];

  let comparison = null;
  if (prev) {
    const prevVolume = computeSessionTotalVolume(prev);
    comparison = {
      volumeDiff: totalVolume - prevVolume,
      prevVolume,
      prevDate: prev.submittedAt,
    };
  }

  return {
    exerciseCount,
    totalVolume,
    durationSec,
    comparison,
  };
}

// ===== 4. 提交队列 =====

/**
 * 提交队列纯判定逻辑。不发起真实网络请求,提交函数由上层注入。
 * @param pending 本地已完成但未提交成功的 session 列表
 * @param isOnline 当前网络状态
 * @returns { action, sessionId } action: 'submit-now' | 'retry' | 'queued' | 'idle'
 */
function decideSubmission(pending, isOnline) {
  const queue = pending || [];
  if (queue.length === 0) {
    return { action: 'idle', sessionId: null };
  }
  const head = queue[0];
  if (!isOnline) {
    return { action: 'queued', sessionId: head.id };
  }
  if (head.attempts > 0) {
    return { action: 'retry', sessionId: head.id };
  }
  return { action: 'submit-now', sessionId: head.id };
}

/**
 * 把 session 加入队列尾部(幂等:同 id 不重复加入)。
 */
function enqueueSession(pending, session) {
  const queue = pending || [];
  if (queue.some((s) => s.id === session.id)) {
    return queue;
  }
  return queue.concat([Object.assign({}, clone(session), { attempts: 0 })]);
}

/**
 * 提交成功:从队列移除并返回新队列。
 */
function dequeueSession(pending, sessionId) {
  return (pending || []).filter((s) => s.id !== sessionId);
}

/**
 * 提交失败:attempts +1,保持在队列中等待重试。
 */
function markAttemptFailed(pending, sessionId) {
  return (pending || []).map((s) =>
    s.id === sessionId ? Object.assign({}, s, { attempts: (s.attempts || 0) + 1 }) : s
  );
}

module.exports = {
  generateId,
  isBodyWeight,
  advanceCursor,
  snapshotSession,
  removeSessionExercise,
  addSessionExercise,
  updateSessionSet,
  addSessionSet,
  removeSessionSet,
  setExerciseSkipped,
  computeVolume,
  computeSessionTotalVolume,
  computeExerciseCount,
  computeSummary,
  decideSubmission,
  enqueueSession,
  dequeueSession,
  markAttemptFailed,
};
