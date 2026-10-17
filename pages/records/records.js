const { ownerPage } = require('../../utils/owner-page');
/**
 * 记录 tab:
 *  视图一(先做):按训练场次 session 时间线倒序回看
 *  视图二(后做):单动作进步曲线,纵轴默认 volume;自重动作用总次数
 */
const db = require('../../utils/db');
const queue = require('../../utils/queue');
const domain = require('../../utils/domain');
const fmt = require('../../utils/format');
const { themePage } = require('../../utils/theme');

const METRICS = [
  { key: 'volume', label: 'volume' },
  { key: 'topWeight', label: 'top weight · 预留' },
  { key: 'e1rm', label: '估算 1RM · 预留' },
];

Page(ownerPage(themePage({
  data: {
    view: 'trend',
    sessions: [],
    recentSessions: [],
    stats: { weekSessions: 0, streakDays: 0 },
    totalVolumeValue: '0',
    totalVolumeUnit: 'kg',
    yTicks: [],
    pendingCount: 0,
    exerciseNames: [],
    selectedExercise: '',
    metric: 'volume',
    metricLabel: 'volume',
    showMetricSheet: false,
    metricOptions: METRICS,
    bars: [],
    isBodyWeight: false,
    trendEmpty: false,
  },

  onShow() {
    return this.refresh();
  },

  refresh() {
    // 待提交队列在本地，先同步读取，避免云查询期间误显示「已全部云同步」。
    this.setData({ pendingCount: queue.getQueue().length });
    return db.fetchAllSessions().then((sessions) => {
      if (!this.isCurrentOwner()) return;
      this.allSessions = sessions;
      const stats = domain.computeRecordStats(this.allSessions, Date.now());
      const rows = sessions.map((s) => this.toSessionRow(s));
      this.setData({
        stats,
        totalVolumeValue: stats.totalWeightedVolume < 1000 ? fmt.formatNumber(stats.totalWeightedVolume) : (stats.totalWeightedVolume / 1000).toFixed(1),
        totalVolumeUnit: stats.totalWeightedVolume < 1000 ? 'kg' : 't',
        recentSessions: rows.slice(0, 2),
        pendingCount: queue.getQueue().length,
        sessions: rows,
      });
      this.buildTrend();
    }).catch(() => {}); // owner epoch invalidation rejects stale reads instead of rendering deleted history
  },

  toSessionRow(s) {
    const parts = fmt.formatDateParts(s.submittedAt || s.startedAt);
    const durationSec = Math.max(
      0,
      Math.round(((s.submittedAt || Date.now()) - s.startedAt) / 1000)
    );
    return {
      id: s.id || s._id,
      date: parts.date,
      month: parts.month,
      name: s.dayName || '训练',
      meta: `${domain.computeExerciseCount(s)} 个动作 · ${fmt.formatDuration(durationSec)}`,
      volume: `${fmt.formatNumber(domain.computeSessionTotalVolume(s))} kg`,
    };
  },

  onSwitchView(e) {
    this.setData({ view: e.currentTarget.dataset.view }, () => this.buildTrend());
  },

  onOpenSession(e) {
    wx.navigateTo({ url: `/pages/session-detail/session-detail?id=${e.currentTarget.dataset.id}` });
  },

  /** 汇总出现过的动作名,供趋势选择 */
  buildTrend() {
    if (this.data.view !== 'trend') return;
    const sessions = this.allSessions || [];
    const names = [];
    sessions.forEach((s) => {
      (s.exercises || []).forEach((ex) => {
        if (domain.computeExerciseCount({ exercises: [ex] }) && ex.name && names.indexOf(ex.name) === -1) names.push(ex.name);
      });
    });
    const selected = this.data.selectedExercise && names.indexOf(this.data.selectedExercise) !== -1
      ? this.data.selectedExercise
      : names[0] || '';
    this.setData({ exerciseNames: names, selectedExercise: selected }, () => this.renderBars());
  },

  onSelectExercise(e) {
    this.setData({ selectedExercise: e.detail.value ? this.data.exerciseNames[e.detail.value] : this.data.selectedExercise }, () => this.renderBars());
  },

  /** 单动作按场次聚合 volume(自重动作为总次数),正序成柱状图 */
  renderBars() {
    const { selectedExercise } = this.data;
    const sessions = (this.allSessions || []).slice().reverse(); // 时间正序
    const points = [];
    let isBodyWeight = false;
    sessions.forEach((s) => {
      (s.exercises || []).forEach((ex) => {
        if (ex.name !== selectedExercise || !domain.computeExerciseCount({ exercises: [ex] })) return;
        isBodyWeight = domain.isBodyWeight(ex);
        const value = domain.computeVolume(ex);
        if (value > 0) {
          const parts = fmt.formatDateParts(s.submittedAt || s.startedAt);
          points.push({ label: `${parts.month.slice(0, -1)}/${parts.date}`, value });
        }
      });
    });
    const max = points.reduce((m, p) => Math.max(m, p.value), 0);
    const bars = points.slice(-8).map((p, i, arr) => ({
      label: p.label,
      value: fmt.formatNumber(p.value),
      height: max > 0 ? Math.max(8, Math.round((p.value / max) * 100)) : 8,
      last: i === arr.length - 1,
      isPR: i === arr.length - 1 && p.value === max,
    }));
    this.setData({
      bars,
      yTicks: [3, 2, 1, 0].map((step) => {
        const value = max * step / 3;
        return { label: value >= 1000 ? `${(value / 1000).toFixed(1)}k` : fmt.formatNumber(value), position: step * 100 / 3 };
      }),
      isBodyWeight,
      trendEmpty: points.length === 0,
    });
  },

  onOpenMetricSheet() {
    this.setData({ showMetricSheet: true });
  },

  onCloseMetricSheet() {
    this.setData({ showMetricSheet: false });
  },

  onPickMetric(e) {
    const { key, label } = e.currentTarget.dataset;
    if (key !== 'volume') {
      wx.showToast({ title: '该指标为预留,后续版本开放', icon: 'none' });
      return;
    }
    this.setData({ metric: key, metricLabel: label, showMetricSheet: false });
  },
})));
