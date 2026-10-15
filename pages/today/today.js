/**
 * 首页(今天):"今天该练什么"卡片 + 开始训练按钮
 * 显示 active 计划当前游标指向的训练日 + 动作清单
 */
const db = require('../../utils/db');
const domain = require('../../utils/domain');
const queue = require('../../utils/queue');
const fmt = require('../../utils/format');
const labels = require('../../data/exercise-labels');
const library = require('../../data/exercises');
const { resolveMedia } = require('../../data/media-root');

const TRAINING_DRAFT_KEY = 'fitness:trainingDraft';

Page({
  data: {
    dateLine: '',
    plan: null,
    day: null,
    exercises: [],
    dayPosition: '',
    exerciseCount: 0,
    totalSets: 0,
    nextDayName: '',
    pendingCount: 0,
    hasDraft: false,
    draftInfo: null,
    starting: false,
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    db.ensureSeedPlans().then((plans) => {
      const plan = plans.find((p) => p.active) || plans[0] || null;
      const draft = this.readDraft();
      const view = this.buildView(plan);
      this.setData(
        Object.assign({}, view, {
          plan,
          dateLine: fmt.formatDateLine(Date.now()).replace(/^\d+年0?/, '').replace(/月0/, '月'),
          pendingCount: queue.getQueue().length,
          hasDraft: !!draft,
          draftInfo: this.buildDraftInfo(draft),
        })
      );
    });
  },

  readDraft() {
    const draft = wx.getStorageSync(TRAINING_DRAFT_KEY);
    if (draft && queue.getCompletedSession(draft.id)) {
      try { wx.removeStorageSync(TRAINING_DRAFT_KEY); } catch (err) { /* retry later */ }
      return null;
    }
    return draft;
  },

  buildDraftInfo(draft) {
    if (!draft) return null;
    const progress = domain.getTrainingProgress(domain.upgradeTrainingDraft(draft));
    return {
      completed: progress.completed,
      total: progress.total,
      planName: draft.planName || '旧训练',
      dayName: draft.dayName || '未命名训练日',
      exerciseCount: (draft.exercises || []).length,
    };
  },

  /** 组装「当前训练日」视图模型 */
  buildView(plan) {
    if (!plan || !plan.cycleDays || plan.cycleDays.length === 0) {
      return { day: null, exercises: [], dayNum: '01', dayTotal: '00', cycleDots: [], dayPosition: '', exerciseCount: 0, totalSets: 0, nextDayName: '' };
    }
    const dayIndex = plan.cursor % plan.cycleDays.length;
    const day = plan.cycleDays[dayIndex];
    const exercises = (day.exercises || []).map((item, index) => {
      const media = library.findById(item.exerciseId);
      return {
        index: String(index + 1).padStart(2, '0'),
        imageSrc: resolveMedia(media && media.imagePath),
        name: item.name,
        equipmentLabel: labels.equipmentLabel(item.equipment),
        bodyPartLabel: media ? labels.bodyPartLabel(labels.bodyPartCategory(media)) : '',
        note: `${media ? labels.bodyPartLabel(labels.bodyPartCategory(media)) : labels.equipmentLabel(item.equipment)} · ${item.equipment === 'body weight' ? '额外负重 ' : ''}${item.targetWeight || 0} kg`,
        prescription: `${item.sets} × ${item.targetReps}`,
      };
    });
    const cycleDots = plan.cycleDays.map((d, i) => ({
      state: i < plan.cursor ? 'done' : i === dayIndex ? 'current' : '',
    }));
    return {
      day,
      exercises,
      dayNum: String(dayIndex + 1).padStart(2, '0'),
      dayTotal: String(plan.cycleDays.length).padStart(2, '0'),
      cycleDots,
      dayPosition: `第 ${dayIndex + 1} 天 · ${plan.name}`,
      exerciseCount: exercises.length,
      totalSets: (day.exercises || []).reduce((sum, item) => sum + (Number(item.sets) || 0), 0),
      nextDayName: plan.cycleDays[(dayIndex + 1) % plan.cycleDays.length].name,
    };
  },

  onImageError(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.exercises[index]) return;
    const exercises = this.data.exercises.map((item, i) => i === index ? { ...item, imageSrc: '' } : item);
    this.setData({ exercises });
  },

  /** 开始训练:快照复制当天计划为独立 session 草稿 */
  onStartTraining() {
    if (this._starting) return;
    const { plan } = this.data;
    if (!plan) {
      wx.showToast({ title: '请先创建计划', icon: 'none' });
      return;
    }
    if (!plan.cycleDays || plan.cycleDays.length === 0) {
      wx.showToast({ title: '当前计划没有训练日', icon: 'none' });
      return;
    }
    let draft;
    try { draft = this.readDraft(); } catch (err) {
      wx.showToast({ title: '草稿读取失败，请重试', icon: 'none' });
      return;
    }
    this._starting = true;
    this.setData({ starting: true });
    if (!draft) {
      this.createTrainingDraft(plan, null);
      return;
    }
    const info = this.buildDraftInfo(draft);
    wx.showModal({
      title: '开始新训练？',
      content: `未完成：${info.planName} · ${info.dayName}。确认后将替换旧草稿及未提交成绩，按“${plan.name}”开始新训练；旧训练不计完成、不推进游标。`,
      confirmText: '新开训练',
      cancelText: '保留草稿',
      success: (res) => {
        if (res.confirm) this.createTrainingDraft(plan, draft.id);
        else this.releaseStart();
      },
      fail: () => this.releaseStart(),
    });
  },

  releaseStart() {
    this._starting = false;
    this.setData({ starting: false });
  },

  createTrainingDraft(plan, replacedDraftId) {
    if (this.data.plan !== plan) {
      this.releaseStart();
      wx.showToast({ title: '计划已更新，请重新确认', icon: 'none' });
      return;
    }
    try {
      const current = this.readDraft();
      if (current && current.id !== replacedDraftId) {
        this.releaseStart();
        wx.showToast({ title: '草稿已更新，请重新确认', icon: 'none' });
        return;
      }
      const session = domain.snapshotSession(plan);
      if (!session) {
        this.releaseStart();
        wx.showToast({ title: '当前计划没有训练日', icon: 'none' });
        return;
      }
      // 单次覆盖写：失败时旧草稿仍在，不先删旧数据，也不提交或推进。
      wx.setStorageSync(TRAINING_DRAFT_KEY, session);
      this.setData({ hasDraft: true, draftInfo: this.buildDraftInfo(session) });
    } catch (err) {
      this.releaseStart();
      wx.showToast({ title: '草稿保存失败，请重试', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/training/training',
      complete: () => this.releaseStart(),
    });
  },

  /** 继续未完成的本地草稿 */
  onResumeDraft() {
    if (this._starting) return;
    let draft;
    try {
      draft = this.readDraft();
      if (!draft) { this.setData({ hasDraft: false, draftInfo: null }); return; }
      const upgraded = domain.upgradeTrainingDraft(draft);
      if (upgraded !== draft) wx.setStorageSync(TRAINING_DRAFT_KEY, upgraded);
    } catch (err) {
      wx.showToast({ title: '草稿保存失败，请重试', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/training/training' });
  },

  onGoPlan() {
    wx.switchTab({ url: '/pages/plan/plan' });
  },
});
