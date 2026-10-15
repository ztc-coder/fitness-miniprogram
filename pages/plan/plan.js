/**
 * 计划 tab:管理循环计划(增删训练日、调顺序、切换 active)、动作库入口
 */
const db = require('../../utils/db');
const domain = require('../../utils/domain');

Page({
  data: {
    plans: [],
    activePlan: null,
    cycleTrack: [],
    dayRows: [],
    nextDay: null,
    editing: false,
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    db.ensureSeedPlans().then((plans) => {
      const activePlan = plans.find((p) => p.active) || plans[0] || null;
      this.setData(
        Object.assign({ plans, activePlan }, this.buildCycleView(activePlan))
      );
    });
  },

  buildCycleView(plan) {
    if (!plan) {
      return { cycleTrack: [], dayRows: [], nextDay: null };
    }
    const cycleTrack = (plan.cycleDays || []).map((day, index) => ({
      dayId: day.dayId,
      num: String(index + 1).padStart(2, '0'),
      name: day.name,
      state: index < plan.cursor ? 'done' : index === plan.cursor ? 'current' : '',
      isLast: index === plan.cycleDays.length - 1,
    }));
    const dayRows = (plan.cycleDays || []).map((day, index) => ({
      dayId: day.dayId,
      num: String(index + 1).padStart(2, '0'),
      name: day.name,
      meta: `${(day.exercises || []).length} 个动作 · ${(day.exercises || []).reduce((total, exercise) => total + (Number(exercise.sets) || 0), 0)} 组`,
      isCurrent: index === plan.cursor,
      isFirst: index === 0,
      isLast: index === plan.cycleDays.length - 1,
    }));
    // NEXT 指向游标当天（尚待训练），不预先推进计划。
    const currentDay = cycleTrack.find((day) => day.state === 'current');
    const nextDay = currentDay ? { num: currentDay.num, name: currentDay.name } : null;
    return { cycleTrack, dayRows, nextDay };
  },

  onToggleEdit() {
    this.setData({ editing: !this.data.editing });
  },

  /** 上移/下移训练日(循环顺序) */
  onMoveDay(e) {
    const { dayid, dir } = e.currentTarget.dataset;
    const plan = this.data.activePlan;
    const days = plan.cycleDays.slice();
    const index = days.findIndex((d) => d.dayId === dayid);
    const target = index + (dir === 'up' ? -1 : 1);
    if (index < 0 || target < 0 || target >= days.length) return;
    const next = days.slice();
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    this.persistPlan(Object.assign({}, plan, { cycleDays: next }));
  },

  onDeleteDay(e) {
    const { dayid } = e.currentTarget.dataset;
    const plan = this.data.activePlan;
    wx.showModal({
      title: '删除训练日',
      content: '删除后不影响已提交的历史记录(快照独立)。',
      confirmColor: '#d96a5b',
      success: (res) => {
        if (!res.confirm) return;
        const cycleDays = plan.cycleDays.filter((d) => d.dayId !== dayid);
        const cursor = plan.cursor >= cycleDays.length ? 0 : plan.cursor;
        this.persistPlan(Object.assign({}, plan, { cycleDays, cursor }));
      },
    });
  },

  onOpenDay(e) {
    const { dayid } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/plan-day/plan-day?planId=${this.data.activePlan.id}&dayId=${dayid}`,
    });
  },

  onAddDay() {
    const plan = this.data.activePlan;
    wx.showModal({
      title: '新建训练日',
      editable: true,
      placeholderText: '胸/背/肩/腿',
      success: (res) => {
        if (!res.confirm || !res.content) return;
        const day = {
          dayId: domain.generateId('day'),
          name: res.content.trim(),
          exercises: [],
        };
        this.persistPlan(
          Object.assign({}, plan, { cycleDays: plan.cycleDays.concat([day]) })
        );
      },
    });
  },

  onNewPlan() {
    wx.showModal({
      title: '新建计划',
      editable: true,
      placeholderText: '计划名称,例如:力量循环',
      success: (res) => {
        if (!res.confirm || !res.content) return;
        const plan = {
          id: domain.generateId('local_plan'),
          name: res.content.trim(),
          cursor: 0,
          active: this.data.plans.length === 0,
          createdAt: Date.now(),
          cycleDays: [],
        };
        db.savePlan(plan)
          .catch(() => plan)
          .then(() => this.refresh());
      },
    });
  },

  /** 切换 active 计划;游标是各计划自己的字段,切回从上次离开处继续 */
  onSwitchActive(e) {
    const { id } = e.currentTarget.dataset;
    if (this.data.activePlan && this.data.activePlan.id === id) return;
    db.setActivePlan(this.data.plans, id).then(() => this.refresh());
  },

  onDeletePlan(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除计划',
      content: '删除后不可恢复;历史记录不受影响。',
      confirmColor: '#d96a5b',
      success: (res) => {
        if (!res.confirm) return;
        const plans = this.data.plans;
        const deletingActive = this.data.activePlan && this.data.activePlan.id === id;
        db.deletePlan(id)
          .then(() => {
            if (!deletingActive) {
              this.refresh();
              return;
            }
            const remainingPlans = plans.filter((plan) => plan.id !== id);
            if (!remainingPlans.length) {
              this.refresh();
              return;
            }
            return db
              .setActivePlan(remainingPlans, remainingPlans[0].id)
              .then(() => this.refresh());
          })
          .catch(() => wx.showToast({ title: '删除失败', icon: 'none' }));
      },
    });
  },

  onGoLibrary() {
    const plan = this.data.activePlan;
    const dayId = plan && plan.cycleDays.length ? plan.cycleDays[plan.cursor % plan.cycleDays.length].dayId : '';
    wx.navigateTo({
      url: `/pages/library/library?planId=${plan ? plan.id : ''}&dayId=${dayId}`,
    });
  },

  persistPlan(plan) {
    db.savePlan(plan)
      .catch((err) => wx.showToast({ title: '保存失败', icon: 'none' }))
      .then(() => this.refresh());
  },
});
