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
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }
  return value;
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
function pendingSet(id, weight = null, reps = null) {
  return { id: `set_${id}`, status: 'pending', weight, reps };
}

function allocatePendingSet(session) {
  if (!Number.isInteger(session.nextSetId)) {
    session.nextSetId = trainingSets(session).reduce((max, set) => {
      const number = Number(String(set.id || '').replace(/^set_/, ''));
      return Number.isInteger(number) ? Math.max(max, number + 1) : max;
    }, 1);
  }
  return pendingSet(session.nextSetId++);
}

function buildSessionSets(planExercise, firstId = 1) {
  const count = Math.max(1, planExercise.sets || 1);
  const sets = [];
  for (let i = 0; i < count; i += 1) {
    sets.push(pendingSet(firstId + i, planExercise.targetWeight, planExercise.targetReps));
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
  let nextSetId = 1;
  const session = {
    id: generateId('session'),
    planId: plan.id,
    planName: plan.name,
    dayId: day.dayId,
    dayName: day.name,
    dayIndex,
    startedAt: Date.now(),
    submittedAt: null,
    exercises: (day.exercises || []).map((item) => {
      const sets = buildSessionSets(item, nextSetId);
      nextSetId += sets.length;
      return {
        exerciseId: item.exerciseId,
        name: item.name || '',
        equipment: item.equipment || '',
        skipped: false,
        flowVersion: 2,
        sets,
      };
    }),
  };
  return initializeTraining(session, nextSetId);
}

/**
 * 从草稿中移除一个动作(跳过/临时不练)。
 */
function removeSessionExercise(session, index) {
  if (session && session.training && session.training.phase === 'paused') return session;
  if (!session || !Array.isArray(session.exercises)) {
    return session;
  }
  if (!Number.isInteger(index) || index < 0 || index >= session.exercises.length ||
      (session.exercises[index].sets || []).some(set => set.status === 'completed')) return session;
  const next = clone(session);
  next.exercises.splice(index, 1);
  return reconcileTraining(next);
}

/**
 * 向草稿追加一个动作(临时加练),预填一组空白 set。
 */
function addSessionExercise(session, exercise) {
  if (session && session.training && session.training.phase === 'paused') return session;
  if (!session || !Array.isArray(session.exercises) || !exercise) return session;
  const next = clone(session);
  next.exercises.push({
    exerciseId: exercise.exerciseId,
    name: exercise.name || '',
    equipment: exercise.equipment || '',
    skipped: false,
    flowVersion: 2,
    sets: [allocatePendingSet(next)],
  });
  return reconcileTraining(next);
}

/**
 * 更新草稿中某组数据。field: 'weight' | 'reps';空值保持 null。
 */
function updateSessionSet(session, exIndex, setIndex, field, value) {
  if (session && session.training && session.training.phase === 'paused') return session;
  if (!session || !Array.isArray(session.exercises) || !['weight', 'reps'].includes(field)) return session;
  if (!Number.isInteger(exIndex) || exIndex < 0 || !Number.isInteger(setIndex) || setIndex < 0) return session;
  const ex = session.exercises[exIndex];
  const set = ex && ex.sets && ex.sets[setIndex];
  if (!set) return session;
  const values = { weight: set.weight, reps: set.reps };
  values[field] = value === '' || value === undefined ? null : value;
  if (set.status === 'completed') return editTrainingSet(session, set.id, values);
  const next = clone(session);
  next.exercises[exIndex].sets[setIndex][field] = values[field];
  return next;
}

function addSessionSet(session, exIndex) {
  if (session && session.training && session.training.phase === 'paused') return session;
  if (!session || !Array.isArray(session.exercises) || !Number.isInteger(exIndex) ||
      exIndex < 0 || exIndex >= session.exercises.length) return session;
  const next = clone(session);
  const ex = next.exercises[exIndex];
  if (ex) {
    const last = ex.sets[ex.sets.length - 1];
    const set = allocatePendingSet(next);
    if (last) Object.assign(set, { weight: last.weight, reps: last.reps });
    ex.sets.push(set);
  }
  return reconcileTraining(next);
}

function removeSessionSet(session, exIndex, setIndex) {
  if (session && session.training && session.training.phase === 'paused') return session;
  if (!session || !Array.isArray(session.exercises) || !Number.isInteger(exIndex) ||
      exIndex < 0 || exIndex >= session.exercises.length) return session;
  if (!Number.isInteger(setIndex) || setIndex < 0) return session;
  const next = clone(session);
  const ex = next.exercises[exIndex];
  if (ex && ex.sets.length > 1 && Number.isInteger(setIndex) && setIndex >= 0) {
    const set = ex.sets[setIndex];
    if (!set) return session;
    if (set.status === 'completed') return session;
    ex.sets.splice(setIndex, 1);
  }
  return reconcileTraining(next);
}

function setExerciseSkipped(session, exIndex, skipped) {
  if (session && session.training && session.training.phase === 'paused') return session;
  if (!session || !Array.isArray(session.exercises) || !Number.isInteger(exIndex) ||
      exIndex < 0 || exIndex >= session.exercises.length) return session;
  const next = clone(session);
  const ex = next.exercises[exIndex];
  if (ex) {
    ex.skipped = !!skipped;
    if (isTrainingExercise(ex)) {
      ex.sets.forEach(set => {
        if (set.status !== 'completed') set.status = skipped ? 'skipped' : 'pending';
      });
    }
  }
  return reconcileTraining(next);
}

// ===== 逐组草稿控制（状态迁移不读取真实时间） =====
/** 只升级本地未提交旧草稿，历史 records 永不改写。 */
function upgradeTrainingDraft(session) {
  if (!session || (session.submittedAt !== null && session.submittedAt !== undefined) || session.flowVersion === 2) return session;
  const next = clone(session);
  next.flowVersion = 2;
  // 保留已有稳定身份；只给缺 ID 的旧组分配新身份。
  const usedIds = new Set(trainingSets(next).map(set => set.id).filter(Boolean));
  let nextSetId = Math.max(1, Number.isInteger(next.nextSetId) ? next.nextSetId : 1);
  usedIds.forEach(id => {
    const number = Number(String(id).replace(/^set_/, ''));
    if (Number.isInteger(number)) nextSetId = Math.max(nextSetId, number + 1);
  });
  next.exercises = (next.exercises || []).map(ex => ({ ...ex, flowVersion: 2,
    sets: (ex.sets && ex.sets.length ? ex.sets : [{}]).map(set => {
      const id = set.id || `set_${nextSetId++}`;
      return { ...set, id, status: set.status || (ex.skipped ? 'skipped' : 'pending') };
    }),
  }));
  const previousTraining = next.training;
  initializeTraining(next, nextSetId);
  if (previousTraining) {
    Object.assign(next.training, previousTraining, {
      phase: previousTraining.phase === 'active' ? 'ready' : previousTraining.phase,
      resumePhase: previousTraining.resumePhase === 'active' ? 'ready' : previousTraining.resumePhase,
      restPaused: !!previousTraining.restPaused,
    });
    delete next.training.undoSetId;
  }
  return reconcileTraining(next);
}

function initializeTraining(session, nextSetId) {
  session.flowVersion = 2;
  session.nextSetId = nextSetId;
  session.training = { phase: 'ready', currentSetId: null, restSeconds: 90,
    restEndsAt: null, restRemainingSec: null, restPaused: false, restNotified: false,
    restSkipped: false, resumePhase: null };
  return reconcileTraining(session);
}

function trainingSets(session) {
  return (session.exercises || []).flatMap(ex => ex.sets || []);
}

function reconcileTraining(session) {
  if (!session.training) return session;
  const t = session.training;
  const pending = trainingSets(session).filter(set => set.status === 'pending');
  t.currentSetId = pending.length ? pending[0].id : null;
  const phase = t.phase === 'paused' ? t.resumePhase : t.phase;
  // 记录变更不触碰间歇，即使最后一个 pending 被完成/跳过/删除。
  const nextPhase = phase === 'rest' ? 'rest' : (pending.length ? 'ready' : 'finished');
  if (t.phase === 'paused') t.resumePhase = nextPhase;
  else t.phase = nextPhase;
  return session;
}

function canFinishTraining(session) {
  return !!session && !!session.training && session.training.phase !== 'paused' &&
    trainingSets(session).some(set => set.status === 'completed');
}

function findTrainingSet(session, setId) {
  for (const exercise of session.exercises || []) {
    const set = (exercise.sets || []).find(item => item.id === setId);
    if (set) return { exercise, set };
  }
  return null;
}

function validateTrainingSet(exercise, set) {
  const numeric = value => (typeof value === 'number' ||
    (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value));
  if (!set || !numeric(set.reps) || !Number.isInteger(Number(set.reps)) || Number(set.reps) <= 0) return null;
  const emptyWeight = set.weight === null || set.weight === undefined ||
    (typeof set.weight === 'string' && set.weight.trim() === '');
  const weight = emptyWeight && isBodyWeight(exercise) ? 0 : set.weight;
  if (!numeric(weight) || Number(weight) < 0) return null;
  return { weight: Number(weight), reps: Number(set.reps) };
}

function completeTrainingSet(session, setId, now) {
  if (!session || !session.training || !Number.isFinite(now) || session.training.phase === 'paused') return session;
  const current = findTrainingSet(session, setId);
  const values = current && validateTrainingSet(current.exercise, current.set);
  if (!values || current.set.status !== 'pending') return session;
  const next = clone(session);
  Object.assign(findTrainingSet(next, setId).set, values, { status: 'completed' });
  return reconcileTraining(next);
}

function uncompleteTrainingSet(session, setId) {
  if (!session || !session.training || session.training.phase === 'paused') return session;
  const current = findTrainingSet(session, setId);
  if (!current || current.set.status !== 'completed') return session;
  const next = clone(session);
  findTrainingSet(next, setId).set.status = 'pending';
  return reconcileTraining(next);
}

function getRestRemainingSec(session, now) {
  const t = session && session.training;
  if (!t || (t.phase !== 'rest' && !(t.phase === 'paused' && t.resumePhase === 'rest'))) return 0;
  if (t.phase === 'paused' || t.restPaused) return Math.max(0, t.restRemainingSec || 0);
  if (!Number.isFinite(now)) return 0;
  return Math.max(0, Math.ceil((t.restEndsAt - now) / 1000));
}

function clearTrainingRest(session, notified, skipped = false) {
  const t = session.training;
  if (t.phase === 'paused') t.resumePhase = 'ready';
  else t.phase = 'ready';
  Object.assign(t, { restEndsAt: null, restRemainingSec: null, restPaused: false,
    restNotified: notified, restSkipped: skipped });
  return reconcileTraining(session);
}

function tickTrainingRest(session, now) {
  if (!session || !session.training || !Number.isFinite(now) ||
      session.training.phase !== 'rest' || session.training.restPaused ||
      getRestRemainingSec(session, now) > 0) return session;
  return clearTrainingRest(clone(session), true);
}

function startTrainingRest(session, now) {
  if (!Number.isFinite(now) || !canFinishTraining(session)) return session;
  const next = clone(session);
  Object.assign(next.training, { phase: 'rest', restEndsAt: now + next.training.restSeconds * 1000,
    restRemainingSec: null, restPaused: false, restNotified: false, restSkipped: false });
  return tickTrainingRest(next, now);
}

function pauseTrainingRest(session, now) {
  if (!session || !session.training || !Number.isFinite(now) ||
      session.training.phase !== 'rest' || session.training.restPaused) return session;
  const settled = tickTrainingRest(session, now);
  if (settled.training.phase !== 'rest') return settled;
  const next = clone(settled);
  Object.assign(next.training, { restPaused: true,
    restRemainingSec: getRestRemainingSec(settled, now), restEndsAt: null });
  return next;
}

function resumeTrainingRest(session, now) {
  if (!session || !session.training || !Number.isFinite(now) ||
      session.training.phase !== 'rest' || !session.training.restPaused) return session;
  const next = clone(session);
  Object.assign(next.training, { restPaused: false,
    restEndsAt: now + next.training.restRemainingSec * 1000, restRemainingSec: null });
  return tickTrainingRest(next, now);
}

function skipTrainingRest(session) {
  if (!session || !session.training || session.training.phase !== 'rest') return session;
  return clearTrainingRest(clone(session), false, true);
}

function pauseTraining(session, now) {
  if (!session || !session.training || !Number.isFinite(now) || session.training.phase === 'paused') return session;
  const next = clone(session);
  const t = next.training;
  t.resumePhase = t.phase;
  if (t.phase === 'rest') {
    t.restRemainingSec = getRestRemainingSec(session, now);
    t.restEndsAt = null;
  }
  t.phase = 'paused';
  return next;
}

function resumeTraining(session, now) {
  if (!session || !session.training || !Number.isFinite(now) || session.training.phase !== 'paused') return session;
  const next = clone(session);
  const t = next.training;
  t.phase = t.resumePhase;
  t.resumePhase = null;
  if (t.phase === 'rest' && !t.restPaused) {
    t.restEndsAt = now + t.restRemainingSec * 1000;
    t.restRemainingSec = null;
  }
  return tickTrainingRest(reconcileTraining(next), now);
}

function setTrainingRestSeconds(session, seconds, now) {
  if (!session || !session.training || !Number.isFinite(now) ||
      ![60, 90, 120, 180].includes(seconds)) return session;
  const next = clone(tickTrainingRest(session, now));
  const t = next.training;
  t.restSeconds = seconds;
  if (t.phase === 'rest' || (t.phase === 'paused' && t.resumePhase === 'rest')) {
    if (t.phase === 'paused' || t.restPaused) t.restRemainingSec = seconds;
    else t.restEndsAt = now + seconds * 1000;
  }
  return next;
}

function adjustTrainingRest(session, deltaSec, now) {
  if (!session || !session.training || !Number.isFinite(now) ||
      (deltaSec !== 15 && deltaSec !== -15)) return session;
  // 已经过期的间歇不能被 +15 悄悄重新开启。
  const next = clone(tickTrainingRest(session, now));
  const t = next.training;
  t.restSeconds = Math.max(0, t.restSeconds + deltaSec);
  if (t.phase === 'rest' || (t.phase === 'paused' && t.resumePhase === 'rest')) {
    const remaining = Math.max(0, getRestRemainingSec(next, now) + deltaSec);
    if (t.phase === 'paused' || t.restPaused) {
      t.restRemainingSec = remaining;
      if (remaining === 0) return clearTrainingRest(next, true);
    } else t.restEndsAt = now + remaining * 1000;
  }
  return tickTrainingRest(next, now);
}

function editTrainingSet(session, setId, values) {
  if (session && session.training && session.training.phase === 'paused') return session;
  if (!session || !values || !Object.prototype.hasOwnProperty.call(values, 'weight') || !Object.prototype.hasOwnProperty.call(values, 'reps')) return session;
  const current = findTrainingSet(session, setId);
  if (!current) return session;
  const normalized = current.set.status === 'completed' ? validateTrainingSet(current.exercise, values) : values;
  if (!normalized) return session;
  const next = clone(session);
  Object.assign(findTrainingSet(next, setId).set, { weight: normalized.weight, reps: normalized.reps });
  return next;
}

function getTrainingProgress(session) {
  const sets = session ? trainingSets(session) : [];
  const completed = sets.filter(set => set.status === 'completed').length;
  const pending = sets.filter(set => set.status === 'pending').length;
  const skipped = sets.filter(set => set.status === 'skipped').length;
  const total = completed + pending;
  return { completed, pending, skipped, total, ratio: total ? completed / total : 0 };
}

/** 页面确认部分完成后调用；零成绩/整场暂停返回 null。不保存、不入队。 */
function prepareTrainingCompletion(session) {
  if (!canFinishTraining(session) || (session.submittedAt !== null && session.submittedAt !== undefined)) return null;
  const next = clone(session);
  trainingSets(next).forEach(set => {
    if (set.status === 'pending') set.status = 'skipped';
  });
  return clearTrainingRest(next, false);
}

/** 整场可提交快照；不存储、不入队、不推进游标。拒绝返回 null。 */
function finalizeTrainingSession(session, now) {
  if (!Number.isFinite(now) || !canFinishTraining(session) ||
      trainingSets(session).some(set => set.status === 'pending') ||
      (session.submittedAt !== null && session.submittedAt !== undefined)) return null;
  const next = clone(session);
  next.submittedAt = now;
  delete next.training;
  delete next.nextSetId;
  return next;
}

function isTrainingExercise(exercise) {
  return !!exercise && (exercise.flowVersion === 1 || exercise.flowVersion === 2 || (exercise.sets || []).some(set => set.status !== undefined));
}

function actualSets(exercise) {
  const sets = (exercise && exercise.sets) || [];
  return isTrainingExercise(exercise) ? sets.filter(set => set.status === 'completed') : sets;
}

// ===== 3. volume 计算 =====

/**
 * 计算一个动作的训练量:
 * - 常规动作:Σ(weight × reps)
 * - 自重动作(equipment == "body weight"):Σreps
 * 新流程（动作 flowVersion 或逐组 status）只计 completed；旧无标记动作保留原口径。
 * 空 set 列表返回 0。此口径同时用于完成小结与记录趋势曲线。
 */
function computeVolume(exercise) {
  if (!exercise || !Array.isArray(exercise.sets) || exercise.sets.length === 0) {
    return 0;
  }
  if (isBodyWeight(exercise)) {
    return actualSets(exercise).reduce((sum, set) => sum + (Number(set.reps) || 0), 0);
  }
  return actualSets(exercise).reduce(
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
    if (!isTrainingExercise(ex) && ex.skipped) return sum;
    return sum + computeVolume(ex);
  }, 0);
}

/** 单位分离的小结指标；旧历史依原成绩读取，跳过 legacy skipped。 */
function computeSessionMetrics(session) {
  const metrics = { completedSets: 0, weightedVolume: 0, bodyWeightReps: 0 };
  for (const ex of (session && session.exercises) || []) {
    if (!isTrainingExercise(ex) && ex.skipped) continue;
    const sets = actualSets(ex);
    metrics.completedSets += sets.length;
    if (isBodyWeight(ex)) metrics.bodyWeightReps += computeVolume(ex);
    else metrics.weightedVolume += computeVolume(ex);
  }
  return metrics;
}

/**
 * 新流程仅计含 completed 的动作；旧历史保持非 skipped 动作数口径。
 */
function computeExerciseCount(session) {
  if (!session || !Array.isArray(session.exercises)) {
    return 0;
  }
  return session.exercises.filter((ex) => isTrainingExercise(ex)
    ? actualSets(ex).length > 0 : !ex.skipped).length;
}

/**
 * 完成小结 + 与上次同类型(同 planId + dayId)训练对比。
 * @param session 本次 session
 * @param previousSessions 已提交的历史 session 列表
 */
function computeSummary(session, previousSessions) {
  const totalVolume = computeSessionTotalVolume(session);
  const exerciseCount = computeExerciseCount(session);
  const endedAt = session.submittedAt === null || session.submittedAt === undefined ? Date.now() : session.submittedAt;
  const durationSec = Math.max(0, Math.round((endedAt - session.startedAt) / 1000));

  const prev = (previousSessions || [])
    .filter(
      (s) =>
        s.planId === session.planId &&
        s.dayId === session.dayId &&
        s.id !== session.id &&
        s.submittedAt
    )
    .sort((a, b) => b.submittedAt - a.submittedAt)[0];

  const metrics = computeSessionMetrics(session);
  let metricComparison = null;
  let comparison = null;
  if (prev) {
    const prevMetrics = computeSessionMetrics(prev);
    metricComparison = {
      weightedVolumeDiff: metrics.weightedVolume - prevMetrics.weightedVolume,
      bodyWeightRepsDiff: metrics.bodyWeightReps - prevMetrics.bodyWeightReps,
      prevWeightedVolume: prevMetrics.weightedVolume,
      prevBodyWeightReps: prevMetrics.bodyWeightReps,
      prevDate: prev.submittedAt,
    };
    const prevVolume = computeSessionTotalVolume(prev);
    comparison = {
      volumeDiff: totalVolume - prevVolume,
      prevVolume,
      prevDate: prev.submittedAt,
    };
  }

  return {
    ...metrics,
    metricComparison,
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
  finalizeTrainingSession,
  upgradeTrainingDraft,
  getTrainingProgress,
  editTrainingSet,
  uncompleteTrainingSet,
  startTrainingRest,
  pauseTrainingRest,
  resumeTrainingRest,
  setTrainingRestSeconds,
  prepareTrainingCompletion,
  computeSessionMetrics,
  adjustTrainingRest,
  pauseTraining,
  resumeTraining,
  getRestRemainingSec,
  tickTrainingRest,
  skipTrainingRest,
  validateTrainingSet,
  completeTrainingSet,
  buildSessionSets,
  canFinishTraining,
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
  isTrainingExercise,
  actualSets,
  computeVolume,
  computeSessionTotalVolume,
  computeExerciseCount,
  computeSummary,
  decideSubmission,
  enqueueSession,
  dequeueSession,
  markAttemptFailed,
};
