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
    editing: null,
    restMessage: '',
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
    this.setData({ reloadBlocked: true, canFinish: false, editing: null,
      errorText: '读取或升级保存本机草稿失败，请重试读取草稿。' });
  },

  adoptDraft(draft) {
    const upgraded = domain.upgradeTrainingDraft(draft);
    if (upgraded !== draft) wx.setStorageSync(DRAFT_KEY, upgraded);
    this.setData({ session: upgraded, reloadBlocked: false, errorText: '' }, () => this.renderExercises());
  },

  onHide() {
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
    else this.renderExercises();
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
        sets: ex.sets.map((set, setIndex) => {
          if (set.id === session.training.currentSetId) current = { name: ex.name, num: setIndex + 1, count: ex.sets.length, setId: set.id };
          return {
            setId: set.id,
            status: set.status,
            statusText: set.status === 'completed' ? '已打卡' : set.status === 'skipped' ? '已跳过' : set.id === session.training.currentSetId ? '当前组' : '待练',
            setIndex,
            num: setIndex + 1,
            weight: set.weight === null || set.weight === undefined ? '' : set.weight,
            reps: set.reps === null || set.reps === undefined ? '' : set.reps,
            canRemove: setIndex === ex.sets.length - 1 && ex.sets.length > 1 && set.status !== 'completed' && !(set.id === session.training.currentSetId && (session.training.phase === 'active' || session.training.resumePhase === 'active')),
          };
        }),
      };
    });
    const progress = domain.getTrainingProgress(session);
    const remaining = domain.getRestRemainingSec(session, Date.now());
    this.setData({ exercises, current, progress, progressPct: Math.round(progress.ratio * 100),
      canFinish: domain.canFinishTraining(session), phase: session.training.phase,
      restText: `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`,
      elapsedText: fmt.formatDuration(Math.round((Date.now() - session.startedAt) / 1000)),
      restMessage: session.training.restNotified ? '间歇结束，可以开始下一组' : '',
    });
  },

  onStartSet() {
    if (!this.canEdit()) return;
    this.persistDraft(domain.startTrainingSet(this.data.session, this.data.session.training.currentSetId, Date.now()));
  },

  onCompleteSet() {
    if (!this.canEdit()) return;
    const session = this.data.session;
    const next = domain.completeTrainingSet(session, session.training.currentSetId, Date.now());
    if (session.training.phase === 'active' && next === session) {
      this.setData({ errorText: '请填写合法成绩：次数须为正整数，重量须非负。' });
      return;
    }
    this.persistDraft(next);
  },

  canEdit() {
    return !this.data.reloadBlocked && !this._finishLocked && !this._unloaded && !this.data.showSummary && !!(this.data.session && this.data.session.training);
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
    if (notify && nextSession.training && nextSession.training.restNotified && nextSession.training.undoSetId && previous && previous.training && (!previous.training.restNotified || previous.training.undoSetId !== nextSession.training.undoSetId)) this.notifyRest();
    return true;
  },

  onInputWeight(e) {
    this.inputSet(e, 'weight');
  },

  onInputReps(e) {
    this.inputSet(e, 'reps');
  },

  inputSet(e, field) {
    if (!this.canEdit()) return;
    const ref = this.findSet(e.currentTarget.dataset.setId);
    if (!ref || ref.value.status !== 'pending') return;
    this.persistDraft(domain.updateSessionSet(this.data.session, ref.ex, ref.set, field, e.detail.value));
  },

  /** 行内示意图加载失败:清空该行 thumbSrc,降回 glyph(不写回草稿) */
  onThumbError(e) {
    const { ex } = e.currentTarget.dataset;
    this.setData({ [`exercises[${ex}].thumbSrc`]: '' });
  },

  onAddSet(e) {
    if (!this.canEdit()) return;
    const ref = this.findSet(e.currentTarget.dataset.anchorId);
    if (ref) this.persistDraft(domain.addSessionSet(this.data.session, ref.ex));
  },

  onRemoveSet(e) {
    if (!this.canEdit()) return;
    const ref = this.findSet(e.currentTarget.dataset.setId);
    if (!ref) return;
    const next = domain.removeSessionSet(this.data.session, ref.ex, ref.set);
    if (next === this.data.session) {
      this.setData({ errorText: '只能删除未打卡的末组，至少保留一组；训练中组不可删除。' });
      return;
    }
    this.persistDraft(next);
  },

  onEditSet(e) {
    if (!this.canEdit()) return;
    const ref = this.findSet(e.currentTarget.dataset.setId);
    if (!ref || ref.value.status !== 'completed') return;
    this.setData({ editing: { setId: ref.value.id, weight: ref.value.weight, reps: ref.value.reps } });
  },

  onEditWeight(e) {
    if (!this.canEdit() || !this.data.editing) return;
    this.setData({ editing: { ...this.data.editing, weight: e.detail.value } });
  },

  onEditReps(e) {
    if (!this.canEdit() || !this.data.editing) return;
    this.setData({ editing: { ...this.data.editing, reps: e.detail.value } });
  },

  onCancelEdit() {
    if (!this.canEdit()) return;
    this.setData({ editing: null });
  },

  onSaveEdit() {
    if (!this.canEdit() || !this.data.editing) return;
    const { setId, weight, reps } = this.data.editing;
    const ref = this.findSet(setId);
    if (!ref || !domain.validateTrainingSet(this.data.session.exercises[ref.ex], { weight, reps })) {
      this.setData({ errorText: '成绩无效，请填写非负重量和正整数次数后保存。' });
      return;
    }
    if (this.persistDraft(domain.editTrainingSet(this.data.session, setId, { weight, reps }))) this.setData({ editing: null });
  },

  /** 跳过剩余不抹掉成绩；异步菜单按稳定组引用重新查当前 session */
  onSkipExercise(e) {
    if (!this.canEdit()) return;
    const { anchorId } = e.currentTarget.dataset;
    if (!this.findSet(anchorId)) return;
    wx.showActionSheet({
      itemList: ['跳过剩余组', '恢复跳过组', '移除未练动作'],
      success: (res) => {
        if (!this.canEdit()) return;
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
          if (ex.sets.some((set) => set.status === 'completed' || (set.id === session.training.currentSetId && (session.training.phase === 'active' || session.training.resumePhase === 'active')))) {
            this.setData({ errorText: '已打卡或训练中的动作不可移除，请使用跳过剩余组。' });
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
    if (!this.canEdit()) return;
    wx.navigateTo({ url: '/pages/library/library?pick=1' });
  },

  /** 暂停:草稿已在本地,随时可以回来继续 */
  onPause() {
    if (!this.canEdit()) return;
    this.persistDraft(domain.pauseTraining(this.data.session, Date.now()));
  },

  onResume() {
    if (!this.canEdit()) return;
    this.persistDraft(domain.resumeTraining(this.data.session, Date.now()));
  },

  onAdjustRest(e) {
    if (!this.canEdit()) return;
    this.persistDraft(domain.adjustTrainingRest(this.data.session, Number(e.currentTarget.dataset.delta), Date.now()));
  },

  onSkipRest() {
    if (!this.canEdit()) return;
    this.persistDraft(domain.skipTrainingRest(this.data.session));
  },

  onUndoSet() {
    if (!this.canEdit()) return;
    this.persistDraft(domain.undoLastTrainingSet(this.data.session));
  },

  /** 完成训练并提交:本地成立 → 入队 → 有网提交,无网重试 */
  onFinish() {
    if (!this.canEdit() || this.data.editing) return;
    const { session } = this.data;
    if (!domain.canFinishTraining(session)) {
      this.setData({ errorText: '需至少打卡一组，并处理所有待练组后才能完成训练。' });
      return;
    }
    // 同步实例锁：在 complete 调用之前锁住全部编辑与 onShow。
    this._finishLocked = true;
    this.setData({ submitting: true, errorText: '' });
    let completion;
    try { completion = queue.complete(session, Date.now()); } catch (err) { completion = Promise.reject(err); }
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
      detail: null, editing: null, errorText: '', summary: this.formatSummary(session, []),
    });
    // 固定本地小结先显示；云端历史比较失败/悬挂不影响完成。
    Promise.resolve().then(() => db.fetchSessions(20)).then((previous) => {
      if (this._unloaded || !this.data.showSummary || this.data.session.id !== session.id) return;
      this.setData({ summary: this.formatSummary(session, previous) });
    }).catch(() => { /* 比较是 best effort，不否定本地完成 */ });
  },

  formatSummary(session, previous) {
    const summary = domain.computeSummary(session, previous);
    return {
      exerciseCount: summary.exerciseCount,
      totalVolume: fmt.formatNumber(summary.totalVolume),
      duration: fmt.formatDuration(summary.durationSec),
      comparison: summary.comparison ? {
        volumeDiff: summary.comparison.volumeDiff,
        diffText: `${summary.comparison.volumeDiff >= 0 ? '+' : ''}${fmt.formatNumber(summary.comparison.volumeDiff)} kg`,
        improved: summary.comparison.volumeDiff >= 0,
      } : null,
    };
  },

  onSummaryBackToday() {
    wx.switchTab({ url: '/pages/today/today' });
  },

  onSummaryViewRecords() {
    wx.switchTab({ url: '/pages/records/records' });
  },
});
