/**
 * 动作库:离线浏览(文本在包内)、搜索、器械筛选
 * 三种打开方式:
 *  - 普通浏览(从计划 tab 入口进入,可加动作到当前训练日)
 *  - pick=1(训练中临时加练,选中后返回训练页)
 *  - planId + dayId(指定加入某训练日)
 */
const lib = require('../../data/exercises');
const db = require('../../utils/db');
const domain = require('../../utils/domain');

const DRAFT_KEY = 'fitness:trainingDraft';

Page({
  data: {
    query: '',
    filter: '全部',
    filters: [],
    items: [],
    pickMode: false,
    planId: '',
    dayId: '',
    detail: null,
  },

  onLoad(options) {
    this.setData({
      filters: lib.EQUIPMENT_FILTERS.map((f) => ({ key: f, label: f === '全部' ? '全部' : lib.equipmentLabel(f) })),
      pickMode: options.pick === '1',
      planId: options.planId || '',
      dayId: options.dayId || '',
    });
    this.applySearch();
  },

  applySearch() {
    const items = lib.search(this.data.query, this.data.filter).map((item) => ({
      id: item.id,
      name: item.nameZh,
      meta: `${item.target} · ${lib.equipmentLabel(item.equipment)}`,
      glyph: item.nameZh.slice(0, 1),
      isBodyWeight: item.equipment === 'body weight',
    }));
    this.setData({ items });
  },

  onSearchInput(e) {
    this.setData({ query: e.detail.value }, () => this.applySearch());
  },

  onFilterTap(e) {
    this.setData({ filter: e.currentTarget.dataset.key }, () => this.applySearch());
  },

  onItemTap(e) {
    const item = lib.findById(e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({
      detail: {
        id: item.id,
        name: item.nameZh,
        equipment: lib.equipmentLabel(item.equipment),
        rawEquipment: item.equipment,
        bodyPart: item.bodyPart,
        target: item.target,
        glyph: item.nameZh.slice(0, 1),
        isBodyWeight: item.equipment === 'body weight',
      },
    });
  },

  onCloseDetail() {
    this.setData({ detail: null });
  },

  noop() {},

  /** 选中动作:训练中加练 → 写入草稿;否则加入指定训练日 */
  onPickExercise() {
    const { detail, pickMode, planId, dayId } = this.data;
    if (!detail) return;

    if (pickMode) {
      const draft = wx.getStorageSync(DRAFT_KEY);
      if (draft) {
        const next = domain.addSessionExercise(draft, {
          exerciseId: detail.id,
          name: detail.name,
          equipment: detail.rawEquipment,
        });
        wx.setStorageSync(DRAFT_KEY, next);
      }
      wx.navigateBack();
      return;
    }

    if (planId && dayId) {
      db.fetchPlans().then((plans) => {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) {
          wx.showToast({ title: '计划不存在', icon: 'none' });
          return;
        }
        const cycleDays = plan.cycleDays.map((day) => {
          if (day.dayId !== dayId) return day;
          return Object.assign({}, day, {
            exercises: day.exercises.concat([
              {
                exerciseId: detail.id,
                name: detail.name,
                equipment: detail.rawEquipment,
                sets: 3,
                targetReps: 10,
                targetWeight: detail.isBodyWeight ? 0 : 20,
              },
            ]),
          });
        });
        db.savePlan(Object.assign({}, plan, { cycleDays }))
          .then(() => {
            wx.showToast({ title: '已加入训练日', icon: 'success' });
            this.setData({ detail: null });
          })
          .catch(() => wx.showToast({ title: '保存失败', icon: 'none' }));
      });
      return;
    }

    wx.showToast({ title: '请从计划页进入以加入训练日', icon: 'none' });
  },
});
