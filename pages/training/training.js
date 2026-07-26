/**
 * 训练中:单次训练全程本地缓存,结束时整体提交
 * 无组间休息计时器(MVP 不做);无网提交自动进入重试队列
 */
const db = require('../../utils/db');
const domain = require('../../utils/domain');
const queue = require('../../utils/queue');
const fmt = require('../../utils/format');

const DRAFT_KEY = 'fitness:trainingDraft';

Page({
  data: {
    session: null,
    exercises: [],
    progressPct: 0,
    elapsedText: '0m',
    showSummary: false,
    summary: null,
    submitting: false,
  },

  onLoad() {
    const draft = wx.getStorageSync(DRAFT_KEY);
    if (!draft) {
      wx.showToast({ title: '没有进行中的训练', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    this.setData({ session: draft }, () => this.renderExercises());
    this.timer = setInterval(() => {
      const sec = Math.round((Date.now() - this.data.session.startedAt) / 1000);
      this.setData({ elapsedText: fmt.formatDuration(sec) });
    }, 10000);
  },

  /** 从动作库返回时,重新渲染可能已更新的草稿 */
  onShow() {
    if (!this.data.session) return;
    const draft = wx.getStorageSync(DRAFT_KEY);
    if (!draft || draft.id !== this.data.session.id) return;
    this.setData({ session: draft }, () => this.renderExercises());
  },

  onUnload() {
    clearInterval(this.timer);
  },

  /** 渲染动作列表(含每组输入值) */
  renderExercises() {
    const { session } = this.data;
    const exercises = session.exercises.map((ex, exIndex) => ({
      exIndex,
      name: ex.name,
      isBodyWeight: domain.isBodyWeight(ex),
      skipped: !!ex.skipped,
      volume: domain.computeVolume(ex),
      sets: ex.sets.map((set, setIndex) => ({
        setIndex,
        num: setIndex + 1,
        weight: set.weight === null || set.weight === undefined ? '' : set.weight,
        reps: set.reps === null || set.reps === undefined ? '' : set.reps,
        canRemove: setIndex === ex.sets.length - 1 && ex.sets.length > 1,
      })),
    }));
    // 完成进度:已填全 weight+reps 的组数 / 总组数
    let filled = 0;
    let total = 0;
    session.exercises.forEach((ex) => {
      if (ex.skipped) return;
      ex.sets.forEach((set) => {
        total += 1;
        if (set.weight !== null && set.weight !== undefined && set.weight !== ''
          && set.reps !== null && set.reps !== undefined && set.reps !== '') {
          filled += 1;
        }
      });
    });
    this.setData({ exercises, progressPct: total > 0 ? Math.round((filled / total) * 100) : 0 });
  },

  /** 所有编辑都写回草稿 + 本地缓存(全程离线) */
  persistDraft(nextSession) {
    wx.setStorageSync(DRAFT_KEY, nextSession);
    this.setData({ session: nextSession }, () => this.renderExercises());
  },

  onInputWeight(e) {
    const { ex, set } = e.currentTarget.dataset;
    const next = domain.updateSessionSet(this.data.session, ex, set, 'weight', e.detail.value);
    this.persistDraft(next);
  },

  onInputReps(e) {
    const { ex, set } = e.currentTarget.dataset;
    const next = domain.updateSessionSet(this.data.session, ex, set, 'reps', e.detail.value);
    this.persistDraft(next);
  },

  onAddSet(e) {
    const { ex } = e.currentTarget.dataset;
    this.persistDraft(domain.addSessionSet(this.data.session, ex));
  },

  onRemoveSet(e) {
    const { ex, set } = e.currentTarget.dataset;
    this.persistDraft(domain.removeSessionSet(this.data.session, ex, set));
  },

  /** 跳过这个动作(保留在快照里但不计容量) */
  onSkipExercise(e) {
    const { ex } = e.currentTarget.dataset;
    const current = this.data.session.exercises[ex];
    wx.showActionSheet({
      itemList: current.skipped ? ['恢复这个动作', '从本次训练中移除'] : ['跳过这个动作', '从本次训练中移除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.persistDraft(domain.setExerciseSkipped(this.data.session, ex, !current.skipped));
        } else if (res.tapIndex === 1) {
          this.persistDraft(domain.removeSessionExercise(this.data.session, ex));
        }
      },
    });
  },

  /** 临时加练:从动作库选 */
  onAddExercise() {
    wx.navigateTo({ url: '/pages/library/library?pick=1' });
  },

  /** 暂停:草稿已在本地,随时可以回来继续 */
  onPause() {
    wx.showModal({
      title: '暂停训练',
      content: '草稿已保存在本机,回到首页可继续。',
      confirmText: '回到首页',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({ url: '/pages/today/today' });
        }
      },
    });
  },

  /** 完成训练并提交:本地成立 → 入队 → 有网提交,无网重试 */
  onFinish() {
    const { session } = this.data;
    if (domain.computeExerciseCount(session) === 0) {
      wx.showToast({ title: '本场没有有效动作', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    db.fetchSessions(20)
      .then((previous) => {
        const summary = domain.computeSummary(session, previous);
        return queue.push(session).then(() => {
          wx.removeStorageSync(DRAFT_KEY);
          // 完成打卡才推进游标:下次「今天」指向循环里的下一个训练日
          if (session.planId) {
            db.advancePlanCursor(session.planId).catch((err) =>
              console.warn('游标推进失败', err)
            );
          }
          this.setData({
            submitting: false,
            showSummary: true,
            summary: {
              exerciseCount: summary.exerciseCount,
              totalVolume: fmt.formatNumber(summary.totalVolume),
              duration: fmt.formatDuration(summary.durationSec),
              comparison: summary.comparison
                ? {
                    volumeDiff: summary.comparison.volumeDiff,
                    diffText: `${summary.comparison.volumeDiff >= 0 ? '+' : ''}${fmt.formatNumber(summary.comparison.volumeDiff)} kg`,
                    improved: summary.comparison.volumeDiff >= 0,
                  }
                : null,
            },
          });
        });
      })
      .catch(() => {
        this.setData({ submitting: false });
        wx.showToast({ title: '提交失败,已加入重试队列', icon: 'none' });
      });
  },

  onSummaryBackToday() {
    wx.switchTab({ url: '/pages/today/today' });
  },

  onSummaryViewRecords() {
    wx.switchTab({ url: '/pages/records/records' });
  },
});
