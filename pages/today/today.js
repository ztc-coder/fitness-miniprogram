/**
 * 首页(今天):"今天该练什么"卡片 + 开始训练按钮
 * 显示 active 计划当前游标指向的训练日 + 动作清单
 */
const db = require('../../utils/db');
const domain = require('../../utils/domain');
const queue = require('../../utils/queue');
const fmt = require('../../utils/format');
const labels = require('../../data/exercise-labels');

const TRAINING_DRAFT_KEY = 'fitness:trainingDraft';

Page({
  data: {
    dateLine: '',
    plan: null,
    day: null,
    exercises: [],
    dayPosition: '',
    exerciseCount: 0,
    pendingCount: 0,
    hasDraft: false,
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    db.ensureSeedPlans().then((plans) => {
      const plan = plans.find((p) => p.active) || plans[0] || null;
      const draft = wx.getStorageSync(TRAINING_DRAFT_KEY);
      const view = this.buildView(plan);
      this.setData(
        Object.assign({}, view, {
          plan,
          dateLine: fmt.formatDateLine(Date.now()),
          pendingCount: queue.getQueue().length,
          hasDraft: !!draft,
        })
      );
    });
  },

  /** 组装「当前训练日」视图模型 */
  buildView(plan) {
    if (!plan || !plan.cycleDays || plan.cycleDays.length === 0) {
      return { day: null, exercises: [], dayNum: '01', dayTotal: '00', cycleDots: [], dayPosition: '', exerciseCount: 0 };
    }
    const dayIndex = plan.cursor % plan.cycleDays.length;
    const day = plan.cycleDays[dayIndex];
    const exercises = (day.exercises || []).map((item, index) => ({
      index: String(index + 1).padStart(2, '0'),
      name: item.name,
      // 器械显示中文译名(缺译名回退原值);自重动作另加 weight 口径提示
      note: item.equipment === 'body weight' ? '自重 · weight 记额外负重' : labels.equipmentLabel(item.equipment),
      prescription: `${item.sets}×${item.targetReps}${
        item.equipment === 'body weight'
          ? item.targetWeight > 0
            ? ` · +${item.targetWeight}kg`
            : ''
          : ` · ${item.targetWeight}kg`
      }`,
    }));
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
    };
  },

  /** 开始训练:快照复制当天计划为独立 session 草稿 */
  onStartTraining() {
    const { plan } = this.data;
    if (!plan) {
      wx.showToast({ title: '请先创建计划', icon: 'none' });
      return;
    }
    const session = domain.snapshotSession(plan);
    if (!session) {
      wx.showToast({ title: '当前计划没有训练日', icon: 'none' });
      return;
    }
    wx.setStorageSync(TRAINING_DRAFT_KEY, session);
    wx.navigateTo({ url: '/pages/training/training' });
  },

  /** 继续未完成的本地草稿 */
  onResumeDraft() {
    wx.navigateTo({ url: '/pages/training/training' });
  },

  onGoPlan() {
    wx.switchTab({ url: '/pages/plan/plan' });
  },
});
