/**
 * 训练中:单次训练全程本地缓存,结束时整体提交
 * 逐组确认与时间戳间歇；本地完成后云端异步重试
 */
const db = require('../../utils/db');
const domain = require('../../utils/domain');
const queue = require('../../utils/queue');
const fmt = require('../../utils/format');
const lib = require('../../data/exercises');
const labels = require('../../data/exercise-labels');
const media = require('../../data/media-root');

const DRAFT_KEY = 'fitness:trainingDraft';
const clockText = seconds => {
  const value = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};

Page({
  data: {
    session: null,
    reloadBlocked: true,
    exercises: [],
    progressPct: 0,
    elapsedText: '0m',
    showSummary: false,
    summary: null,
    submitting: false,
    detail: null,
    canFinish: false,
    progress: { completed: 0, pending: 0, skipped: 0, total: 0 },
    current: null,
    phase: 'ready',
    restText: '00:00',
    errorText: '',
    restMessage: '',
    restExpanded: false,
    restActive: false,
    restPaused: false,
    restSeconds: 90,
    restPresets: [60, 90, 120, 180],
    ringRight: 0,
    ringLeft: 0,
    confirming: false,
  },

  onLoad() {
    try {
      const draft = wx.getStorageSync(DRAFT_KEY);
      if (!draft) {
        this.blockReload();
        wx.showToast({ title: '没有进行中的训练', icon: 'none' });
        return;
      }
      const completed = queue.getCompletedSession(draft.id);
      if (completed) {
        this.showCompleted(completed);
        return;
      }
      this.adoptDraft(draft);
    } catch (err) {
      this.blockReload();
    }
  },

  /** 从动作库返回时,重新渲染可能已更新的草稿 */
  onShow() {
    this._visible = true;
    if (this._finishLocked || this._unloaded || this.data.showSummary) return;
    if (!this.data.session || this.data.reloadBlocked) return;
    try {
      const draft = wx.getStorageSync(DRAFT_KEY);
      if (draft && draft.id === this.data.session.id) {
        const completed = queue.getCompletedSession(draft.id);
        if (completed) {
          this.showCompleted(completed);
          return;
        }
        this.adoptDraft(draft);
      } else {
        this.blockReload();
        return;
      }
      this.updateClock();
      clearInterval(this.timer);
      this.timer = setInterval(() => this.updateClock(), 1000);
    } catch (err) {
      this.blockReload();
    }
  },

  onRetryDraft() {
    if (this._finishLocked || this._unloaded || this.data.showSummary) return;
    this.onLoad();
    this.onShow();
  },

  blockReload() {
    this.clearResources();
    this.setData({ reloadBlocked: true, canFinish: false,
      errorText: '读取或升级保存本机草稿失败，请重试读取草稿。' });
  },

  adoptDraft(draft) {
    const upgraded = domain.upgradeTrainingDraft(draft);
    if (upgraded !== draft) wx.setStorageSync(DRAFT_KEY, upgraded);
    this._inputEdits = {};
    this.setData({ session: upgraded, reloadBlocked: false, errorText: '' }, () => this.renderExercises());
  },

  onHide() {
    if (this.canRecord()) this.flushInputEdits();
    this._visible = false;
    this.clearResources();
  },

  onUnload() {
    this._unloaded = true;
    this._visible = false;
    this.clearResources();
  },

  clearResources() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.audio) {
      try { this.audio.destroy(); } catch (err) { /* 提醒资源失败不影响训练 */ }
      this.audio = null;
    }
  },

  updateClock() {
    if (!this._visible || !this.canEdit()) return;
    const session = this.data.session;
    const next = domain.tickTrainingRest(session, Date.now());
    if (next !== session) this.persistDraft(next);
    else this.renderClock();
  },

  renderClock() {
    const session = this.data.session;
    if (!session || !session.training) return;
    const t = session.training;
    const remaining = domain.getRestRemainingSec(session, Date.now());
    const restActive = t.phase === 'rest' || (t.phase === 'paused' && t.resumePhase === 'rest');
    const angle = Math.min(1, remaining / Math.max(1, t.restSeconds)) * 360;
    this.setData({
      phase: t.phase, restActive, restPaused: !!t.restPaused || t.phase === 'paused',
      restText: clockText(remaining), restSeconds: t.restSeconds,
      ringRight: Math.min(180, angle), ringLeft: Math.max(0, angle - 180),
      elapsedText: clockText((Date.now() - session.startedAt) / 1000),
      restMessage: t.restNotified ? '间歇结束，准备好再开始下一组' : '',
      ...(!restActive ? { restExpanded: false } : {}),
    });
  },

  notifyRest() {
    if (!this._visible || this._unloaded || this._finishLocked) return;
    try {
      if (!this.audio) {
        this.audio = wx.createInnerAudioContext();
        this.audio.src = '/assets/audio/rest.wav';
        this.audio.autoplay = false;
        this.audio.loop = false;
        this.audio.onError(() => { /* 页面提示保留，不重播 */ });
      }
      this.audio.play();
    } catch (err) { /* 保持默认静音策略；失败仅降级 */ }
    try { wx.vibrateShort({ type: 'light', fail() {} }); } catch (err) { /* 不阻塞 */ }
  },

  /** 渲染动作列表(含每组输入值) */
  renderExercises() {
    const { session } = this.data;
    if (!session || !session.training) return;
    let current = null;
    const exercises = session.exercises.map((ex, exIndex) => {
      const item = lib.findById(ex.exerciseId);
      // 行内缩略图只用 JPEG 示意图,不自动播 GIF(避免一行多 GIF 同播)
      const thumbSrc = media.resolveMedia(item && item.imagePath);
      return {
        exIndex,
        anchorId: ex.sets[0].id,
        name: ex.name,
        glyph: (ex.name || '').slice(0, 1),
        thumbSrc,
        isBodyWeight: domain.isBodyWeight(ex),
        skipped: ex.sets.every((set) => set.status === 'skipped'),
        volume: domain.computeVolume(ex),
        completedCount: ex.sets.filter(set => set.status === 'completed').length,
        bodyPart: item ? labels.bodyPartLabel(labels.bodyPartCategory(item)) : labels.equipmentLabel(ex.equipment),
        sets: ex.sets.map((set, setIndex) => {
          if (set.id === session.training.currentSetId) current = { name: ex.name, num: setIndex + 1, count: ex.sets.length, setId: set.id };
          return {
            setId: set.id,
            status: set.status,
            statusText: set.status === 'completed' ? '已完成' : set.status === 'skipped' ? '已跳过' : '待练',
            setIndex,
            num: setIndex + 1,
            weight: this._inputEdits && this._inputEdits[set.id] ? this._inputEdits[set.id].weight : set.weight === null || set.weight === undefined ? '' : set.weight,
            reps: this._inputEdits && this._inputEdits[set.id] ? this._inputEdits[set.id].reps : set.reps === null || set.reps === undefined ? '' : set.reps,
            canRemove: ex.sets.length > 1 && set.status !== 'completed',
          };
        }),
      };
    });
    const progress = domain.getTrainingProgress(session);
    this.setData({ exercises, current, progress, progressPct: Math.round(progress.ratio * 100),
      canFinish: domain.canFinishTraining(session),
    });
    this.renderClock();
  },

  onToggleSet(e) {
    if (!this.canRecord()) return;
    const setId = e.currentTarget.dataset.setId;
    const ref = this.findSet(setId);
    if (!ref || ref.value.status === 'skipped') return;
    if (ref.value.status === 'completed') {
      let next = domain.uncompleteTrainingSet(this.data.session, setId);
      const edits = this._inputEdits && this._inputEdits[setId];
      if (edits) next = domain.editTrainingSet(next, setId, edits);
      if (this.persistDraft(next)) {
        if (this._inputEdits) delete this._inputEdits[setId];
        this.renderExercises();
      }
      return;
    }
    if (!this.flushInputEdits()) return;
    const session = this.data.session;
    const next = domain.completeTrainingSet(session, setId, Date.now());
    if (next === session) {
      this.setData({ errorText: '请填写合法成绩：次数须为正整数，重量须非负。' });
      return;
    }
    this.persistDraft(next);
  },

  canEdit() {
    return !this.data.reloadBlocked && !this._confirming && !this._finishLocked && !this._unloaded && !this.data.showSummary && !!(this.data.session && this.data.session.training);
  },

  canRecord() {
    return this.canEdit() && this.data.session.training.phase !== 'paused';
  },

  findSet(setId) {
    const session = this.data.session;
    if (!session) return null;
    for (let ex = 0; ex < session.exercises.length; ex += 1) {
      const set = session.exercises[ex].sets.findIndex((item) => item.id === setId);
      if (set >= 0) return { ex, set, value: session.exercises[ex].sets[set] };
    }
    return null;
  },

  /** 所有编辑都写回草稿 + 本地缓存(全程离线) */
  persistDraft(nextSession, notify = true) {
    if (!this.canEdit()) return false;
    const previous = this.data.session;
    try {
      wx.setStorageSync(DRAFT_KEY, nextSession);
    } catch (err) {
      this.setData({ errorText: '本机保存失败，未应用本次操作。请释放存储空间后重试。' });
      this.renderExercises();
      return false;
    }
    this.setData({ session: nextSession, errorText: '' }, () => this.renderExercises());
    if (notify && nextSession.training && nextSession.training.restNotified && previous && previous.training && !previous.training.restNotified) this.notifyRest();
    return true;
  },

  onInputWeight(e) {
    this.inputSet(e, 'weight');
  },

  onInputReps(e) {
    this.inputSet(e, 'reps');
  },

  inputSet(e, field) {
    if (!this.canRecord()) return;
    const ref = this.findSet(e.currentTarget.dataset.setId);
    if (!ref || ref.value.status === 'skipped') return;
    if (ref.value.status === 'completed') {
      this._inputEdits = this._inputEdits || {};
      const values = this._inputEdits[ref.value.id] || { weight: ref.value.weight, reps: ref.value.reps };
      this._inputEdits[ref.value.id] = { ...values, [field]: e.detail.value };
      return;
    }
    this.persistDraft(domain.updateSessionSet(this.data.session, ref.ex, ref.set, field, e.detail.value));
  },

  onInputBlur() {
    if (this.canRecord()) this.flushInputEdits();
  },

  flushInputEdits() {
    let next = this.data.session;
    const edits = this._inputEdits || {};
    const ids = Object.keys(edits);
    if (!ids.length) return true;
    for (const setId of ids) {
      const ref = this.findSet(setId);
      if (!ref) continue;
      if (ref.value.status === 'completed' && !domain.validateTrainingSet(next.exercises[ref.ex], edits[setId])) {
        this.setData({ errorText: '已完成组的成绩无效，请填写非负重量和正整数次数，或取消该组勾选。' });
        return false;
      }
      next = domain.editTrainingSet(next, setId, edits[setId]);
    }
    if (!this.persistDraft(next)) return false;
    this._inputEdits = {};
    this.renderExercises();
    return true;
  },

  /** 行内示意图加载失败:清空该行 thumbSrc,降回 glyph(不写回草稿) */
  onThumbError(e) {
    const { ex } = e.currentTarget.dataset;
    this.setData({ [`exercises[${ex}].thumbSrc`]: '' });
  },

  onAddSet(e) {
    if (!this.canRecord() || !this.flushInputEdits()) return;
    const ref = this.findSet(e.currentTarget.dataset.anchorId);
    if (ref) this.persistDraft(domain.addSessionSet(this.data.session, ref.ex));
  },

  onRemoveSet(e) {
    if (!this.canRecord() || !this.flushInputEdits()) return;
    const ref = this.findSet(e.currentTarget.dataset.setId);
    if (!ref) return;
    const next = domain.removeSessionSet(this.data.session, ref.ex, ref.set);
    if (next === this.data.session) {
      this.setData({ errorText: '已完成组请先取消勾选，每个动作至少保留一组。' });
      return;
    }
    this.persistDraft(next);
  },

  /** 跳过剩余不抹掉成绩；异步菜单按稳定组引用重新查当前 session */
  onSkipExercise(e) {
    if (!this.canRecord() || !this.flushInputEdits()) return;
    const { anchorId } = e.currentTarget.dataset;
    if (!this.findSet(anchorId)) return;
    wx.showActionSheet({
      itemList: ['跳过剩余组', '恢复跳过组', '移除未练动作'],
      success: (res) => {
        if (!this.canRecord()) return;
        const ref = this.findSet(anchorId);
        if (!ref) return;
        const session = this.data.session;
        const ex = session.exercises[ref.ex];
        if (res.tapIndex === 0) {
          if (!ex.sets.some((set) => set.status === 'pending')) {
            this.setData({ errorText: '没有待练组可跳过，已打卡成绩保留。' });
            return;
          }
          this.persistDraft(domain.setExerciseSkipped(session, ref.ex, true));
        } else if (res.tapIndex === 1) {
          if (!ex.sets.some((set) => set.status === 'skipped')) {
            this.setData({ errorText: '没有跳过组可恢复。' });
            return;
          }
          this.persistDraft(domain.setExerciseSkipped(session, ref.ex, false));
        } else if (res.tapIndex === 2) {
          if (ex.sets.some((set) => set.status === 'completed')) {
            this.setData({ errorText: '已完成的动作不可移除，请使用跳过剩余组。' });
            return;
          }
          this.persistDraft(domain.removeSessionExercise(session, ref.ex));
        }
      },
    });
  },

  /** 点动作行缩略图:用 exerciseId 反查动作库,打开同一套详情弹层(只读) */
  onExerciseTap(e) {
    if (this._finishLocked || this._unloaded || this.data.showSummary) return;
    const { ex, anchorId } = e.currentTarget.dataset;
    const ref = anchorId ? this.findSet(anchorId) : null;
    const sessionExercise = this.data.session.exercises[ref ? ref.ex : ex];
    if (!sessionExercise) return;
    const item = lib.findById(sessionExercise.exerciseId);
    // 查不到目录(旧 slug 等)时安静降级:行内仍显示 session.name + glyph,不弹层不提示
    if (!item) return;
    this.setData({
      detail: {
        id: item.id,
        nameZh: item.nameZh,
        // 器械与部位显示中文译名(部位按七类归类,缺译名回退原值)
        equipmentZh: labels.equipmentLabel(item.equipment),
        targetZh: lib.targetLabel(item.target),
        bodyPartZh: labels.bodyPartLabel(labels.bodyPartCategory(item)),
        steps: item.instructionSteps || [],
        glyph: item.nameZh.slice(0, 1),
        gifSrc: media.resolveMedia(item.gifPath),
        imageSrc: media.resolveMedia(item.imagePath),
        isBodyWeight: item.equipment === 'body weight',
      },
    });
  },

  onCloseDetail() {
    this.setData({ detail: null });
  },

  /** 临时加练:从动作库选 */
  onAddExercise() {
    if (!this.canRecord() || !this.flushInputEdits()) return;
    wx.navigateTo({ url: '/pages/library/library?pick=1' });
  },

  /** 暂停:草稿已在本地,随时可以回来继续 */
  onPause() {
    if (!this.canRecord() || !this.flushInputEdits()) return;
    this.persistDraft(domain.pauseTraining(this.data.session, Date.now()));
  },

  onResume() {
    if (!this.canEdit()) return;
    this.persistDraft(domain.resumeTraining(this.data.session, Date.now()));
  },

  onAdjustRest(e) {
    if (!this.canRecord()) return;
    this.persistDraft(domain.adjustTrainingRest(this.data.session, Number(e.currentTarget.dataset.delta), Date.now()));
  },

  onSkipRest() {
    if (!this.canRecord()) return;
    this.persistDraft(domain.skipTrainingRest(this.data.session));
  },

  onStartRest() {
    if (!this.canRecord() || !this.flushInputEdits()) return;
    const session = this.data.session;
    const next = domain.startTrainingRest(session, Date.now());
    if (next === session) return;
    if (this.persistDraft(next, false)) {
      this.setData({ restExpanded: next.training.phase === 'rest' });
      if (next.training.restNotified) this.notifyRest();
    }
  },

  onExpandRest() {
    if (this.canEdit() && this.data.restActive) this.setData({ restExpanded: true });
  },

  onCollapseRest() {
    this.setData({ restExpanded: false });
  },

  onRestPreset(e) {
    if (!this.canRecord()) return;
    this.persistDraft(domain.setTrainingRestSeconds(this.data.session, Number(e.currentTarget.dataset.seconds), Date.now()));
  },

  onPauseRest() {
    if (!this.canRecord()) return;
    this.persistDraft(domain.pauseTrainingRest(this.data.session, Date.now()));
  },

  onResumeRest() {
    if (!this.canRecord()) return;
    this.persistDraft(domain.resumeTrainingRest(this.data.session, Date.now()));
  },

  onBlockTouch() {},

  releaseConfirmation() {
    this._confirming = false;
    if (!this._unloaded) this.setData({ confirming: false });
  },

  /** 完成训练并提交:本地成立 → 入队 → 有网提交,无网重试 */
  onFinish() {
    if (!this.canRecord() || !this.flushInputEdits()) return;
    const { session } = this.data;
    if (!domain.canFinishTraining(session)) {
      this.setData({ errorText: '至少完成一组后才能结束训练。' });
      return;
    }
    const progress = domain.getTrainingProgress(session);
    if (!progress.pending) return this.completeSession(session);
    this._confirming = true;
    this.setData({ confirming: true });
    return new Promise(resolve => {
      wx.showModal({
        title: '结束本次训练？',
        content: `已完成 ${progress.completed} 组，剩余 ${progress.pending} 组将跳过。保存实际成绩后，计划进入下一训练日。`,
        confirmText: '保存结束', cancelText: '继续记录',
        success: result => {
          this.releaseConfirmation();
          if (!result.confirm || !this.canRecord()) { resolve(); return; }
          // 系统弹窗期间可能切后台或从其他入口更新草稿，确认只对眼前版本生效。
          try {
            const latest = wx.getStorageSync(DRAFT_KEY);
            if (!latest || JSON.stringify(latest) !== JSON.stringify(session)) {
              this.setData({ errorText: '训练记录已变化，请重新读取后确认结束。' });
              this.onShow();
              resolve(); return;
            }
          } catch (err) { this.blockReload(); resolve(); return; }
          resolve(this.completeSession(session));
        },
        fail: () => {
          this.releaseConfirmation();
          if (!this._unloaded) {
            this.setData({ errorText: '结束确认打开失败，请重试。训练记录仍保留在本机。' });
            wx.showToast({ title: '结束确认失败，请重试', icon: 'none' });
          }
          resolve();
        },
      });
    });
  },

  completeSession(session) {
    if (!this.canRecord()) return;
    const prepared = domain.prepareTrainingCompletion(session);
    if (!prepared) return;
    // 同步实例锁：在 complete 调用之前锁住全部编辑与 onShow。
    this._finishLocked = true;
    this.setData({ submitting: true, errorText: '' });
    let completion;
    try { completion = queue.complete(prepared, Date.now()); } catch (err) { completion = Promise.reject(err); }
    return Promise.resolve(completion).then((completed) => {
      this.clearResources();
      if (this._unloaded) return;
      this.showCompleted(completed);
    }).catch(() => {
      if (this._unloaded) return;
      this._finishLocked = false;
      this.setData({ submitting: false, errorText: '本机完成保存失败，训练仍为草稿。请释放存储空间后重新完成。' });
    });
  },

  showCompleted(session) {
    this._finishLocked = true;
    this.clearResources();
    this.setData({ session, submitting: false, showSummary: true, canFinish: false,
      detail: null, restExpanded: false, restActive: false, errorText: '', summary: this.formatSummary(session, []),
    });
    // 固定本地小结先显示；云端历史比较失败/悬挂不影响完成。
    Promise.resolve().then(() => db.fetchSessions(20)).then((previous) => {
      if (this._unloaded || !this.data.showSummary || this.data.session.id !== session.id) return;
      this.setData({ summary: this.formatSummary(session, previous) });
    }).catch(() => { /* 比较是 best effort，不否定本地完成 */ });
  },

  formatSummary(session, previous) {
    const summary = domain.computeSummary(session, previous);
    const comparison = summary.metricComparison;
    const comparisons = [];
    if (comparison) {
      if (summary.weightedVolume > 0 || comparison.prevWeightedVolume > 0) comparisons.push({
        label: '负重容量', diffText: `${comparison.weightedVolumeDiff >= 0 ? '+' : ''}${fmt.formatNumber(comparison.weightedVolumeDiff)} kg`,
        improved: comparison.weightedVolumeDiff >= 0,
      });
      if (summary.bodyWeightReps > 0 || comparison.prevBodyWeightReps > 0) comparisons.push({
        label: '自重次数', diffText: `${comparison.bodyWeightRepsDiff >= 0 ? '+' : ''}${fmt.formatNumber(comparison.bodyWeightRepsDiff)} 次`,
        improved: comparison.bodyWeightRepsDiff >= 0,
      });
    }
    return {
      exerciseCount: summary.exerciseCount,
      totalVolume: fmt.formatNumber(summary.totalVolume),
      completedSets: summary.completedSets,
      weightedVolume: fmt.formatNumber(summary.weightedVolume),
      bodyWeightReps: fmt.formatNumber(summary.bodyWeightReps),
      hasBodyWeight: session.exercises.some(ex => domain.isBodyWeight(ex) && domain.actualSets(ex).length),
      duration: clockText(summary.durationSec),
      date: fmt.formatDateLine(session.submittedAt),
      comparisons,
      exercises: session.exercises.filter(ex => domain.actualSets(ex).length).map((ex, index) => ({
        key: index, name: ex.name, completed: domain.actualSets(ex).length,
        volumeText: `${fmt.formatNumber(domain.computeVolume(ex))} ${domain.isBodyWeight(ex) ? '次' : 'kg'}`,
      })),
    };
  },

  onSummaryBackToday() {
    wx.switchTab({ url: '/pages/today/today' });
  },

  onSummaryViewRecords() {
    wx.switchTab({ url: '/pages/records/records' });
  },
});
