/**
 * 票 01 + 票 02:搜索清空、新建训练日占位文字、卡片快捷加入训练日。
 * 页面行为用 mock db + mock wx 驱动,不依赖 setData 回调。
 */
const fs = require('fs');
const path = require('path');
const catalog = require('../data/exercises');
const labels = require('../data/exercise-labels');

const DRAFT_KEY = 'fitness:trainingDraft';
const WXML = fs.readFileSync(path.join(__dirname, '../pages/library/library.wxml'), 'utf8');
const WXSS = fs.readFileSync(path.join(__dirname, '../pages/library/library.wxss'), 'utf8');
const PLAN_JS = fs.readFileSync(path.join(__dirname, '../pages/plan/plan.js'), 'utf8');

const tapEvent = (key) => ({ currentTarget: { dataset: { key } } });
/** 冲干 Promise 微任务链:fetchPlans → savePlan → setData 需要多个 tick */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const idEvent = (id) => ({ currentTarget: { dataset: { id } } });

describe('票 01:新建训练日占位文字', () => {
  test('占位文字为准确的 胸/背/肩/腿', () => {
    expect(PLAN_JS).toContain("placeholderText: '胸/背/肩/腿'");
    expect(PLAN_JS).not.toContain('例如:推 / 拉 / 腿 / 肩');
  });
});

describe('票 01:搜索清空图标', () => {
  test('清空图标仅关键词非空时渲染,且不冒泡', () => {
    expect(WXML).toContain('wx:if="{{query}}"');
    expect(WXML).toContain('catchtap="onClearSearch"');
    expect(WXML).toContain('onClearSearch');
  });

  test('输入框右侧为清空图标预留触控区', () => {
    expect(WXSS).toMatch(/\.search-clear\s*\{[^}]*position:\s*absolute/);
    expect(WXSS).toMatch(/\.search-input\s*\{[^}]*padding:\s*0\s+84rpx\s+0\s+28rpx/);
  });
});

describe('票 01 + 02:页面行为(入口 / 保存失败 / 清空搜索)', () => {
  let page;
  let setDataCalls;
  let pendingCallbacks;
  let dbMock;
  let toast;

  beforeEach(() => {
    jest.resetModules();
    page = null;
    setDataCalls = [];
    pendingCallbacks = [];
    toast = [];

    dbMock = {
      fetchPlans: jest.fn(() => Promise.resolve([])),
      savePlan: jest.fn(() => Promise.resolve({})),
    };
    jest.doMock('../utils/db', () => dbMock);

    global.Page = (definition) => {
      page = definition;
    };
    global.wx = {
      getStorageSync: () => null,
      setStorageSync: () => {},
      navigateBack: jest.fn(),
      showToast: (options) => toast.push(options),
    };

    require('../pages/library/library');
    page = Object.assign({}, page, { data: JSON.parse(JSON.stringify(page.data)) });
    page.setData = (patch, callback) => {
      setDataCalls.push(patch);
      page.data = Object.assign({}, page.data, patch);
      if (callback) pendingCallbacks.push(callback);
    };
  });

  afterEach(() => {
    delete global.Page;
    delete global.wx;
    jest.dontMock('../utils/db');
  });

  const pill = (row, key) => page.data[row].find((item) => item.key === key);
  const seedPlan = (overrides = {}) =>
    Object.assign(
      {
        id: 'local_plan_1',
        name: '力量循环',
        cursor: 0,
        active: true,
        cycleDays: [
          { dayId: 'day_a', name: '推', exercises: [] },
          { dayId: 'day_b', name: '拉', exercises: [{ exerciseId: '0001', name: 'x', equipment: 'barbell' }] },
        ],
      },
      overrides
    );

  // ===== 清空搜索 =====
  test('清空关键词与筛选条件同一次提交,不依赖 setData 回调,筛选保持不变', () => {
    page.onLoad({});
    page.onBodyPartFilterTap(tapEvent('chest'));
    page.onEquipFilterTap(tapEvent('dumbbell'));
    page.onSearchInput({ detail: { value: '卧推' } });
    expect(page.data.query).toBe('卧推');
    setDataCalls.length = 0;

    page.onClearSearch();

    expect(page.data.query).toBe('');
    expect(setDataCalls).toHaveLength(1);
    const patch = setDataCalls[0];
    expect(patch.query).toBe('');
    // 器械与部位筛选保留,结果按保留后的条件重算
    expect(patch.equipmentKeys).toEqual(['dumbbell']);
    expect(patch.bodyPartKeys).toEqual(['chest']);
    expect(pill('equipmentFilters', 'dumbbell').active).toBe(true);
    expect(pill('bodyPartFilters', 'chest').active).toBe(true);
    const expected = catalog.search('', ['dumbbell'], ['chest']);
    expect(patch.resultCount).toBe(expected.length);
    expect(patch.items.map((item) => item.id)).toEqual(expected.slice(0, 24).map((item) => item.id));
    expect(patch.hasMore).toBe(expected.length > 24);
    // 结果与筛选条件同一次提交,无需回调补检索
    expect(pendingCallbacks).toHaveLength(0);
    expect(page.data.resultCount).toBe(expected.length);
  });

  // ===== 入口 1:指定 planId + dayId 直接加入 =====
  test('指定训练日入口:快捷按钮直接写入该训练日,数据取目录原值,不打开选择器', () => {
    const plan = seedPlan();
    dbMock.fetchPlans.mockResolvedValue([plan]);
    dbMock.savePlan.mockResolvedValue(plan);

    page.onLoad({ planId: plan.id, dayId: 'day_a' });
    const target = page.data.items[0];
    page.onQuickAdd(idEvent(target.id));

    expect(page.data.pickerVisible).toBe(false);
    return flush().then(() => {
      expect(dbMock.savePlan).toHaveBeenCalledTimes(1);
      const saved = dbMock.savePlan.mock.calls[0][0];
      const dayA = saved.cycleDays.find((d) => d.dayId === 'day_a');
      const dayB = saved.cycleDays.find((d) => d.dayId === 'day_b');
      expect(dayA.exercises).toHaveLength(1);
      expect(dayA.exercises[0]).toEqual({
        exerciseId: target.id,
        name: catalog.findById(target.id).nameZh,
        equipment: catalog.findById(target.id).equipment,
        sets: 3,
        targetReps: 10,
        targetWeight: catalog.findById(target.id).equipment === 'body weight' ? 0 : 20,
      });
      // 其他训练日原样保留
      expect(dayB.exercises).toHaveLength(1);
      expect(toast[toast.length - 1].title).toBe('已加入训练日');
    });
  });

  test('连续快捷加入两个动作时串行读取最新计划,不丢失第一次写入', async () => {
    let stored = seedPlan();
    const reads = [];
    dbMock.fetchPlans.mockImplementation(() => new Promise((resolve) => {
      reads.push(() => resolve([stored]));
    }));
    dbMock.savePlan.mockImplementation((plan) => {
      stored = plan;
      return Promise.resolve(plan);
    });

    page.onLoad({ planId: stored.id, dayId: 'day_a' });
    const [first, second] = page.data.items;
    page.onQuickAdd(idEvent(first.id));
    page.onQuickAdd(idEvent(second.id));
    await flush();
    expect(reads).toHaveLength(1);
    reads[0]();
    await flush();
    expect(reads).toHaveLength(2);
    reads[1]();
    await flush();
    expect(stored.cycleDays[0].exercises.map((item) => item.exerciseId)).toEqual([first.id, second.id]);
  });

  // ===== 入口 2:普通浏览 → 选择计划/训练日 =====
  test('普通浏览入口:先打开可滚动选择器,选中训练日后加入该日', () => {
    const plan = seedPlan();
    dbMock.fetchPlans.mockResolvedValue([plan]);
    dbMock.savePlan.mockResolvedValue(plan);

    page.onLoad({});
    const target = page.data.items[0];
    page.onQuickAdd(idEvent(target.id));

    return flush()
      .then(() => {
        expect(page.data.pickerVisible).toBe(true);
        expect(page.data.pendingExerciseId).toBe(target.id);
        expect(page.data.pickerPlanId).toBe(plan.id);
        expect(page.data.pickerDays.map((d) => d.dayId)).toEqual(['day_a', 'day_b']);
        expect(WXML).toContain('class="picker-day-scroll" scroll-y');
        return flush();
      })
      .then(() => {
        page.onPickerDayTap({ currentTarget: { dataset: { dayid: 'day_b' } } });
        return flush();
      })
      .then(() => {
        const saved = dbMock.savePlan.mock.calls[0][0];
        const dayB = saved.cycleDays.find((d) => d.dayId === 'day_b');
        expect(dayB.exercises).toHaveLength(2);
        expect(dayB.exercises[1].exerciseId).toBe(target.id);
        expect(page.data.pickerVisible).toBe(false);
      });
  });

  test('普通浏览无可选训练日时提示先创建,不打开选择器', () => {
    dbMock.fetchPlans.mockResolvedValue([seedPlan({ cycleDays: [] })]);

    page.onLoad({});
    const target = page.data.items[0];
    page.onQuickAdd(idEvent(target.id));

    return flush().then(() => {
      expect(page.data.pickerVisible).toBe(false);
      expect(toast[toast.length - 1].title).toBe('请先创建训练日');
      expect(dbMock.savePlan).not.toHaveBeenCalled();
    });
  });

  // ===== 入口 3:训练中 pick=1 → 训练草稿 =====
  test('pick=1 快捷按钮写入训练草稿并返回,不写计划', () => {
    const stored = {};
    const draft = { id: 'draft_1', exercises: [] };
    global.wx = {
      getStorageSync: (key) => (key === DRAFT_KEY ? draft : null),
      setStorageSync: (key, value) => {
        stored[key] = value;
      },
      navigateBack: jest.fn(),
      showToast: (options) => toast.push(options),
    };

    page.onLoad({ pick: '1' });
    const target = page.data.items[0];
    page.onQuickAdd(idEvent(target.id));

    expect(stored[DRAFT_KEY].exercises).toHaveLength(1);
    expect(stored[DRAFT_KEY].exercises[0].exerciseId).toBe(target.id);
    expect(stored[DRAFT_KEY].exercises[0].equipment).toBe(catalog.findById(target.id).equipment);
    expect(global.wx.navigateBack).toHaveBeenCalled();
    expect(dbMock.fetchPlans).not.toHaveBeenCalled();
    expect(dbMock.savePlan).not.toHaveBeenCalled();
  });

  // ===== 保存失败反馈 =====
  test('指定训练日保存失败给出反馈,不误报成功', () => {
    const plan = seedPlan();
    dbMock.fetchPlans.mockResolvedValue([plan]);
    dbMock.savePlan.mockRejectedValue(new Error('boom'));

    page.onLoad({ planId: plan.id, dayId: 'day_a' });
    page.onQuickAdd(idEvent(page.data.items[0].id));

    return flush().then(() => {
      expect(toast[toast.length - 1].title).toBe('保存失败');
      expect(page.data.detail).toBe(null);
    });
  });

  test('目标训练日已删除时不写计划,读取计划失败时提示失败', async () => {
    const plan = seedPlan({ cycleDays: [] });
    dbMock.fetchPlans.mockResolvedValue([plan]);
    page.onLoad({ planId: plan.id, dayId: 'day_a' });
    page.onQuickAdd(idEvent(page.data.items[0].id));
    await flush();
    expect(dbMock.savePlan).not.toHaveBeenCalled();
    expect(toast[toast.length - 1].title).toBe('训练日不存在');

    dbMock.fetchPlans.mockRejectedValue(new Error('offline'));
    page.onQuickAdd(idEvent(page.data.items[0].id));
    await flush();
    expect(toast[toast.length - 1].title).toBe('保存失败');
  });

  test('快捷按钮不打开详情:卡片详情入口仍在,快捷按钮用 catchtap 独立绑定', () => {
    expect(WXML).toContain('catchtap="onQuickAdd"');
    expect(WXML).toContain('bindtap="onItemTap"');
    // 快捷按钮不依赖详情对象,点击后不设置 detail
    const plan = seedPlan();
    dbMock.fetchPlans.mockResolvedValue([plan]);
    page.onLoad({ planId: plan.id, dayId: 'day_a' });
    page.onQuickAdd(idEvent(page.data.items[0].id));
    expect(page.data.detail).toBe(null);
  });

  // ===== 详情既有流程不退化 =====
  test('详情确认加入仍走同一写入路径,训练中加练仍写草稿', () => {
    const plan = seedPlan();
    dbMock.fetchPlans.mockResolvedValue([plan]);
    dbMock.savePlan.mockResolvedValue(plan);

    page.onLoad({ planId: plan.id, dayId: 'day_a' });
    const target = page.data.items[0];
    page.onItemTap(idEvent(target.id));
    expect(page.data.detail.nameZh).toBe(catalog.findById(target.id).nameZh);
    page.onPickExercise();

    return flush().then(() => {
      const saved = dbMock.savePlan.mock.calls[0][0];
      expect(saved.cycleDays.find((d) => d.dayId === 'day_a').exercises).toHaveLength(1);
      expect(page.data.detail).toBe(null);
    });
  });

  test('选择器计划切换只换训练日列表,不触发写入', () => {
    const p1 = seedPlan({ id: 'local_plan_1', name: 'A' });
    const p2 = seedPlan({ id: 'local_plan_2', name: 'B', cycleDays: [{ dayId: 'day_c', name: '腿', exercises: [] }] });
    dbMock.fetchPlans.mockResolvedValue([p1, p2]);

    page.onLoad({});
    page.onQuickAdd(idEvent(page.data.items[0].id));

    return flush()
      .then(() => {
        page.onPickerPlanTap(idEvent('local_plan_2'));
        expect(page.data.pickerPlanId).toBe('local_plan_2');
        expect(page.data.pickerDays.map((d) => d.dayId)).toEqual(['day_c']);
        expect(dbMock.savePlan).not.toHaveBeenCalled();
      })
      .then(() => {
        page.onClosePicker();
        expect(page.data.pickerVisible).toBe(false);
      });
  });

  test('部位筛选标签仍是七类中文,清空搜索不改变胶囊集合', () => {
    page.onLoad({});
    expect(page.data.bodyPartFilters.map((item) => item.label)).toEqual([
      '全部',
    ].concat(labels.BODY_PART_KEYS.map(labels.bodyPartLabel)));
  });
});
