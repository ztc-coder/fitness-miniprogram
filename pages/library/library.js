/**
 * 动作库:离线浏览发布目录、搜索、七类部位键 + 器械原值两维胶囊多选
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
const queue = require('../../utils/queue');
const paging = require('./library-paging');

const DRAFT_KEY = 'fitness:trainingDraft';
/** 每行首项「全部」的 key:不参与检索,点击即清空该行 */
const ALL_KEY = '全部';

/** 组装一行胶囊:首项「全部」,其余为筛选键;active 由选中集推导,与列表结果同一次提交 */
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
    // 普通浏览快捷加入:选择计划/训练日的弹层状态
    pickerVisible: false,
    pickerPlans: [],
    pickerPlanId: '',
    pickerDays: [],
    pendingExerciseId: '',
    pickerSaving: false,
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
          equipmentText: labels.equipmentLabel(item.equipment),
          muscleText: lib.targetLabel(item.target),
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

  /** 清空关键词:与筛选条件同一次提交,器械/部位选中集不变 */
  onClearSearch() {
    this.applySearch({ query: '' });
  },

  noop() {},

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

  /** 详情确认:训练中加练 → 写入草稿;否则加入指定训练日 */
  onPickExercise() {
    const { detail, pickMode, planId, dayId } = this.data;
    if (!detail) return;

    if (pickMode) {
      if (this.addToDraft(detail.id)) wx.navigateBack();
      return;
    }

    if (planId && dayId) {
      this.addToPlanDay(planId, dayId, detail.id);
      return;
    }

    wx.showToast({ title: '请从计划页进入以加入训练日', icon: 'none' });
  },

  /**
   * 卡片快捷按钮:不打开详情直接加入。
   * catchtap 绑定,不冒泡到卡片的 onItemTap。
   */
  onQuickAdd(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || !lib.findById(id)) return;

    if (this.data.pickMode) {
      if (this.addToDraft(id)) wx.navigateBack();
      return;
    }

    const { planId, dayId } = this.data;
    if (planId && dayId) {
      this.addToPlanDay(planId, dayId, id);
      return;
    }

    this.openDayPicker(id);
  },

  /** 训练中加练:只写训练草稿,不写计划 */
  addToDraft(exerciseId) {
    const draft = wx.getStorageSync(DRAFT_KEY);
    const item = lib.findById(exerciseId);
    if (!draft || !item) return false;
    if (queue.getCompletedSession(draft.id)) {
      wx.showToast({ title: '本场训练已完成', icon: 'none' });
      return false;
    }
    try {
      wx.setStorageSync(
        DRAFT_KEY,
        domain.addSessionExercise(domain.upgradeTrainingDraft(draft), {
          exerciseId: item.id,
          name: item.nameZh,
          equipment: item.equipment,
        })
      );
      return true;
    } catch (err) {
      wx.showToast({ title: '草稿保存失败，请重试', icon: 'none' });
      return false;
    }
  },

  /** 目录动作 → 计划里的默认处方(3 组 10 次;自重 0 负重,其余 20) */
  buildPlanExercise(exerciseId) {
    const item = lib.findById(exerciseId);
    if (!item) return null;
    return {
      exerciseId: item.id,
      name: item.nameZh,
      equipment: item.equipment,
      sets: 3,
      targetReps: 10,
      targetWeight: item.equipment === 'body weight' ? 0 : 20,
    };
  },

  /** 加入指定训练日:详情确认与卡片快捷按钮共用同一条写入路径 */
  addToPlanDay(planId, dayId, exerciseId) {
    const exercise = this.buildPlanExercise(exerciseId);
    if (!exercise) return Promise.resolve();

    // 每次保存完成后重新读取计划，避免连续点击基于同一旧快照相互覆盖。
    const save = () => db.fetchPlans().then((plans) => {
      const plan = (plans || []).find((p) => p.id === planId);
      if (!plan) {
        wx.showToast({ title: '计划不存在', icon: 'none' });
        return;
      }
      if (!(plan.cycleDays || []).some((day) => day.dayId === dayId)) {
        wx.showToast({ title: '训练日不存在', icon: 'none' });
        return;
      }
      const cycleDays = (plan.cycleDays || []).map((day) => {
        if (day.dayId !== dayId) return day;
        return Object.assign({}, day, {
          exercises: (day.exercises || []).concat([exercise]),
        });
      });
      return db.savePlan(Object.assign({}, plan, { cycleDays })).then(() => {
        wx.showToast({ title: '已加入训练日', icon: 'success' });
        this.setData({ detail: null, pickerVisible: false });
      });
    }).catch(() => wx.showToast({ title: '保存失败', icon: 'none' }));
    this._planAddQueue = (this._planAddQueue || Promise.resolve()).then(save);
    return this._planAddQueue;
  },

  /** 计划 → 选择器行;只保留有训练日的计划 */
  buildPickerPlans(plans) {
    return (plans || [])
      .map((plan) => ({
        id: plan.id,
        name: plan.name,
        days: (plan.cycleDays || []).map((day) => ({
          dayId: day.dayId,
          name: day.name,
          meta: `${(day.exercises || []).length} 个动作`,
        })),
      }))
      .filter((plan) => plan.days.length > 0);
  },

  /** 普通浏览:没有指定训练日时先选计划和训练日;无训练日则提示先创建 */
  openDayPicker(exerciseId) {
    return db
      .fetchPlans()
      .then((plans) => {
        const pickerPlans = this.buildPickerPlans(plans);
        if (!pickerPlans.length) {
          wx.showToast({ title: '请先创建训练日', icon: 'none' });
          return;
        }
        const current = pickerPlans.find((p) => p.id === this.data.planId) || pickerPlans[0];
        this.setData({
          pickerVisible: true,
          pendingExerciseId: exerciseId,
          pickerPlans,
          pickerPlanId: current.id,
          pickerDays: current.days,
        });
      })
      .catch(() => wx.showToast({ title: '计划读取失败', icon: 'none' }));
  },

  onPickerPlanTap(e) {
    const id = e.currentTarget.dataset.id;
    const plan = (this.data.pickerPlans || []).find((p) => p.id === id);
    if (!plan) return;
    this.setData({ pickerPlanId: plan.id, pickerDays: plan.days });
  },

  onPickerDayTap(e) {
    const dayId = e.currentTarget.dataset.dayid;
    const { pickerPlanId, pendingExerciseId } = this.data;
    if (this.data.pickerSaving || !dayId || !pickerPlanId || !pendingExerciseId) return;
    this.setData({ pickerSaving: true });
    this.addToPlanDay(pickerPlanId, dayId, pendingExerciseId).then(() => {
      this.setData({ pickerSaving: false });
    });
  },

  onClosePicker() {
    this.setData({ pickerVisible: false });
  },
});
