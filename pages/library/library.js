/**
 * 动作库:离线浏览精选目录、搜索、器械桶 + 部位标签(含复合动作重叠标签)两维筛选
 * 三种打开方式:
 *  - 普通浏览(从计划 tab 入口进入,可加动作到当前训练日)
 *  - pick=1(训练中临时加练,选中后返回训练页)
 *  - planId + dayId(指定加入某训练日)
 */
const lib = require('../../data/exercises');
const media = require('../../data/media-root');
const db = require('../../utils/db');
const domain = require('../../utils/domain');
const paging = require('./library-paging');

const DRAFT_KEY = 'fitness:trainingDraft';

Page({
  data: {
    query: '',
    equipFilter: '全部',
    equipFilters: [],
    partFilter: '全部',
    partFilters: [],
    items: [],
    preheatItems: [],
    resultCount: 0,
    hasMore: false,
    pickMode: false,
    planId: '',
    dayId: '',
    detail: null,
  },

  onLoad(options = {}) {
    this.applySearch({
      equipFilters: lib.EQUIPMENT_FILTERS.map((key) => ({ key, label: key === '全部' ? '全部' : lib.equipmentLabel(key) })),
      partFilters: lib.PART_FILTERS.map((key) => ({ key, label: key === '全部' ? '全部' : lib.PART_LABELS[key] })),
      pickMode: options.pick === '1',
      planId: options.planId || '',
      dayId: options.dayId || '',
    });
  },

  /**
   * 把筛选条件与结果一次提交。不能依赖 setData 回调触发检索：
   * 在部分运行态中，回调晚于下一次事件，导致选中态变更而列表未刷新。
   * 搜索结果保存在页面实例，data.items 只保存当前已展开的分页。
   */
  applySearch(nextData = {}) {
    const has = (key) => Object.prototype.hasOwnProperty.call(nextData, key);
    const query = has('query') ? nextData.query : this.data.query;
    const equipFilter = has('equipFilter') ? nextData.equipFilter : this.data.equipFilter;
    const partFilter = has('partFilter') ? nextData.partFilter : this.data.partFilter;

    try {
      this._matchedItems = lib.search(query, equipFilter, partFilter).map((item) => {
        const nameZh = item && item.nameZh ? String(item.nameZh) : '';
        return {
          id: item.id,
          name: nameZh,
          meta: `${lib.targetLabel(item.target)} · ${lib.equipmentLabel(item.equipment)}`,
          glyph: nameZh.slice(0, 1) || '?',
          thumbSrc: media.resolveMedia(item.imagePath),
          isBodyWeight: item.equipment === 'body weight',
        };
      });
      this._page = 1;
      this.renderPage(nextData);
    } catch (err) {
      console.error('动作库检索失败', err);
      this._matchedItems = [];
      this._page = 1;
      this.setData(Object.assign({}, nextData, {
        items: [],
        preheatItems: [],
        resultCount: 0,
        hasMore: false,
      }));
    }
  },

  /** 当前页及下一页最多预热 48 条,不会把 GIF 放入列表数据。 */
  renderPage(nextData = {}) {
    const page = paging.pageWindow(this._matchedItems, this._page);
    const preheatItems = paging.preheatWindow(this._matchedItems, this._page);
    this.setData(Object.assign({}, nextData, {
      items: page.items,
      preheatItems,
      resultCount: page.resultCount,
      hasMore: page.hasMore,
    }));
  },

  onReachBottom() {
    if (!this._matchedItems || !this.data.hasMore) return;
    this._page += 1;
    this.renderPage();
  },

  onSearchInput(e) {
    this.applySearch({ query: e.detail.value });
  },

  onEquipFilterTap(e) {
    const key = e.currentTarget.dataset.bucket;
    if (!key) return;
    this.applySearch({ equipFilter: key });
  },

  onPartFilterTap(e) {
    const key = e.currentTarget.dataset.bucket;
    if (!key) return;
    this.applySearch({ partFilter: key });
  },

  /** 缩略图失败只影响对应动作,保留动作行并降回 glyph。 */
  onThumbError(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const clearThumb = (item) => item.id === id ? Object.assign({}, item, { thumbSrc: '' }) : item;
    this._matchedItems = (this._matchedItems || []).map(clearThumb);
    this.setData({
      items: (this.data.items || []).map(clearThumb),
      preheatItems: (this.data.preheatItems || []).map(clearThumb),
    });
  },

  onItemTap(e) {
    const item = lib.findById(e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({
      detail: {
        id: item.id,
        nameZh: item.nameZh,
        nameEn: item.name,
        equipmentZh: lib.equipmentLabel(item.equipment),
        targetZh: lib.targetLabel(item.target),
        bodyPartZh: lib.partTagsLabel(item.id),
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

  /** 选中动作:训练中加练 → 写入草稿;否则加入指定训练日 */
  onPickExercise() {
    const { detail, pickMode, planId, dayId } = this.data;
    if (!detail) return;

    if (pickMode) {
      const draft = wx.getStorageSync(DRAFT_KEY);
      if (draft) {
        const next = domain.addSessionExercise(draft, {
          exerciseId: detail.id,
          name: detail.nameZh,
          equipment: this.rawEquipmentOf(detail.id),
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
        const equipment = this.rawEquipmentOf(detail.id);
        const cycleDays = plan.cycleDays.map((day) => {
          if (day.dayId !== dayId) return day;
          return Object.assign({}, day, {
            exercises: day.exercises.concat([
              {
                exerciseId: detail.id,
                name: detail.nameZh,
                equipment,
                sets: 3,
                targetReps: 10,
                targetWeight: equipment === 'body weight' ? 0 : 20,
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

  /** 按数据集 id 取器械原值;assisted 走自重筛选桶但不是自重动作 */
  rawEquipmentOf(id) {
    const item = lib.findById(id);
    return item ? item.equipment : '';
  },
});
