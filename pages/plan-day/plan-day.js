const { ownerPage } = require('../../utils/owner-page');
/**
 * 训练日详情:管理当天动作列表(统一目标、调顺序、删除),动作库入口
 */
const db = require('../../utils/db');
const library = require('../../data/exercises');
const labels = require('../../data/exercise-labels');
const { resolveMedia } = require('../../data/media-root');

const { themePage } = require('../../utils/theme');

Page(ownerPage(themePage({
  data: {
    planId: '',
    dayId: '',
    dayName: '',
    kicker: '',
    exercises: [],
  },

  onLoad(options) {
    this.setData({ planId: options.planId || '', dayId: options.dayId || '' });
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    db.fetchPlans().then((plans) => {
      const plan = plans.find((p) => p.id === this.data.planId);
      if (!plan) {
        wx.showToast({ title: '计划不存在', icon: 'none' });
        return;
      }
      const day = plan.cycleDays.find((d) => d.dayId === this.data.dayId);
      if (!day) return;
      this.plan = plan;
      this.setData({
        dayName: day.name,
        kicker: `DAY ${String(plan.cycleDays.indexOf(day) + 1).padStart(2, '0')} · ${plan.name}`,
        exercises: (day.exercises || []).map((item, index) => {
          const media = library.findById(item.exerciseId);
          const weight = item.equipment === 'body weight'
            ? item.targetWeight > 0 ? `+${item.targetWeight} kg` : '自重'
            : `${item.targetWeight} kg`;
          return {
            index,
            exerciseId: item.exerciseId,
            name: item.name,
            bodyPartLabel: labels.bodyPartLabel(labels.bodyPartCategory(media)),
            equipmentLabel: labels.equipmentLabel(item.equipment),
            imageSrc: resolveMedia(media && media.imagePath),
            prescription: `${item.sets} 组 × ${item.targetReps} 次 · ${weight}`,
            isFirst: index === 0,
            isLast: index === day.exercises.length - 1,
          };
        }),
      });
    });
  },

  onImageError(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.exercises[index]) return;
    const exercises = this.data.exercises.map((item, i) => i === index ? { ...item, imageSrc: '' } : item);
    this.setData({ exercises });
  },

  persistDay(nextExercises) {
    const plan = this.plan;
    const cycleDays = plan.cycleDays.map((day) =>
      day.dayId === this.data.dayId
        ? Object.assign({}, day, { exercises: nextExercises })
        : day
    );
    return db
      .savePlan(Object.assign({}, plan, { cycleDays }))
      .then(() => this.refresh())
      .catch(() => wx.showToast({ title: '保存失败', icon: 'none' }));
  },

  onMove(e) {
    const { index, dir } = e.currentTarget.dataset;
    const plan = this.plan;
    const day = plan.cycleDays.find((d) => d.dayId === this.data.dayId);
    const list = day.exercises.slice();
    const target = index + (dir === 'up' ? -1 : 1);
    if (target < 0 || target >= list.length) return;
    const temp = list[index];
    list[index] = list[target];
    list[target] = temp;
    this.persistDay(list);
  },

  onEditTarget(e) {
    const { index } = e.currentTarget.dataset;
    const plan = this.plan;
    const day = plan.cycleDays.find((d) => d.dayId === this.data.dayId);
    const item = day.exercises[index];
    wx.showModal({
      ...(this.data.theme === 'light' ? { confirmColor: '#3E5429', cancelColor: '#20262B' } : {}),
      title: `编辑目标 · ${item.name}`,
      editable: true,
      placeholderText: '格式:组数x次数x重量,如 4x8x60',
      content: `${item.sets}x${item.targetReps}x${item.targetWeight}`,
      success: (res) => {
        if (!this.isCurrentOwner()) return;
        if (!res.confirm || !res.content) return;
        const match = String(res.content).match(/(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)/);
        if (!match) {
          wx.showToast({ title: '格式不正确', icon: 'none' });
          return;
        }
        const list = day.exercises.slice();
        list[index] = Object.assign({}, item, {
          sets: Number(match[1]),
          targetReps: Number(match[2]),
          targetWeight: Number(match[3]),
        });
        this.persistDay(list);
      },
    });
  },

  onRemove(e) {
    const { index } = e.currentTarget.dataset;
    const plan = this.plan;
    const day = plan.cycleDays.find((d) => d.dayId === this.data.dayId);
    const list = day.exercises.slice();
    list.splice(index, 1);
    this.persistDay(list);
  },

  onAddExercise() {
    wx.navigateTo({
      url: `/pages/library/library?planId=${this.data.planId}&dayId=${this.data.dayId}`,
    });
  },
})));
