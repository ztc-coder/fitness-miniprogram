/**
 * 动作库:离线浏览发布目录、搜索、官方部位原值 + 器械原值两维胶囊多选
 * 三种打开方式:
 *  - 普通浏览(从计划 tab 入口进入,可加动作到当前训练日)
 *  - pick=1(训练中临时加练,选中后返回训练页)
 *  - planId + dayId(指定加入某训练日)
 */
const lib = require('../../data/exercises');
const labels = require('../../data/exercise-labels');
const media = require('../../data/media-root');
const db = require('../../utils/db');
const domain = require('../../utils/domain');
const paging = require('./library-paging');

const DRAFT_KEY = 'fitness:trainingDraft';
/** 每行首项「全部」的 key:不参与检索,点击即清空该行 */
const ALL_KEY = '全部';

/** 组装一行胶囊:首项「全部」,其余为官方原值;active 由选中集推导,与列表结果同一次提交 */
function filterPills(keys, labelOf, selected) {
  return [{ key: ALL_KEY, label: ALL_KEY, active: selected.length === 0 }].concat(
    keys.map((key) => ({ key, label: labelOf(key), active: selected.indexOf(key) !== -1 }))
  );
}

/** 同一行多选切换:点已选项取消,点未选项加入 */
function toggleKey(selected, key) {
  return selected.indexOf(key) === -1
    ? selected.concat([key])
    : selected.filter((item) => item !== key);
}

Page({
  data: {
    query: '',
    equipmentKeys: [],
    equipmentFilters: [],
    bodyPartKeys: [],
    bodyPartFilters: [],
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
    const equipmentKeys = has('equipmentKeys') ? nextData.equipmentKeys : this.data.equipmentKeys;
    const bodyPartKeys = has('bodyPartKeys') ? nextData.bodyPartKeys : this.data.bodyPartKeys;
    // 选中态直接由选中集推导,与列表结果同一次 setData 提交
    const patch = Object.assign({}, nextData, {
      query,
      equipmentKeys,
      bodyPartKeys,
      equipmentFilters: filterPills(labels.equipmentKeys(lib.EXERCISES), labels.equipmentLabel, equipmentKeys),
      bodyPartFilters: filterPills(labels.BODY_PART_KEYS, labels.bodyPartLabel, bodyPartKeys),
    });

    try {
      this._matchedItems = lib.search(query, equipmentKeys, bodyPartKeys).map((item) => {
        const nameZh = item && item.nameZh ? String(item.nameZh) : '';
        return {
          id: item.id,
          name: nameZh,
          meta: `${lib.targetLabel(item.target)} · ${labels.equipmentLabel(item.equipment)}`,
          glyph: nameZh.slice(0, 1) || '?',
          thumbSrc: media.resolveMedia(item.imagePath),
          isBodyWeight: item.equipment === 'body weight',
        };
      });
      this._page = 1;
      this.renderPage(patch);
    } catch (err) {
      console.error('动作库检索失败', err);
      this._matchedItems = [];
      this._page = 1;
      this.setData(Object.assign({}, patch, {
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
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    this.applySearch({ equipmentKeys: key === ALL_KEY ? [] : toggleKey(this.data.equipmentKeys, key) });
  },

  onBodyPartFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    this.applySearch({ bodyPartKeys: key === ALL_KEY ? [] : toggleKey(this.data.bodyPartKeys, key) });
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
        equipmentZh: labels.equipmentLabel(item.equipment),
        targetZh: lib.targetLabel(item.target),
        bodyPartZh: labels.bodyPartLabel(item.bodyPart),
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
