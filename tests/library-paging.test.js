const paging = require('../pages/library/library-paging');
const catalog = require('../data/exercises');
const labels = require('../data/exercise-labels');

const DRAFT_KEY = 'fitness:trainingDraft';

function buildItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1).padStart(4, '0'),
    name: `动作${index + 1}`,
  }));
}

const tapEvent = (key) => ({ currentTarget: { dataset: { key } } });
const ids = (items) => items.map((item) => item.id);

describe('动作库分页 helper', () => {
  test('首屏 24 条,完整结果数独立于当前页,下一页预热最多 48 条', () => {
    const items = buildItems(70);
    const first = paging.pageWindow(items, 1);
    const next = paging.preheatWindow(items, 1);

    expect(first.items).toHaveLength(24);
    expect(first.resultCount).toBe(70);
    expect(first.hasMore).toBe(true);
    expect(next).toHaveLength(48);
    expect(next.map((item) => item.id)).toEqual(items.slice(0, 48).map((item) => item.id));
  });

  test('追加页不重复且最后一页只包含剩余动作', () => {
    const duplicateItems = buildItems(49).concat([{ id: '0025', name: '重复动作' }]);
    const first = paging.pageWindow(duplicateItems, 1);
    const second = paging.pageWindow(duplicateItems, 2);
    const last = paging.pageWindow(duplicateItems, 3);

    expect(first.items).toHaveLength(24);
    expect(second.items).toHaveLength(48);
    expect(last.items).toHaveLength(49);
    expect(last.resultCount).toBe(49);
    expect(new Set(last.items.map((item) => item.id)).size).toBe(49);
    expect(last.hasMore).toBe(false);
    expect(paging.preheatWindow(duplicateItems, 4)).toHaveLength(0);
  });
});

describe('动作库页面 WXML 绑定(不依赖页面检索实现)', () => {
  const fs = require('fs');
  const path = require('path');
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/library/library.wxml'), 'utf8');

  test('WXML 绑定列表 JPEG 懒加载、失败降级和详情组件入口', () => {
    expect(wxml).toContain('src="{{item.thumbSrc}}"');
    expect(wxml).toContain('lazy-load="{{true}}"');
    expect(wxml).toContain('binderror="onThumbError"');
    expect(wxml).toContain('<exercise-detail');
    expect(wxml).toContain('preheatItems');
  });

  test('列表与页头只展示中文:动作名绑中文名,无英文副标题与装饰文案', () => {
    expect(wxml).toContain('<view class="library-name">{{item.name}}</view>');
    expect(wxml).not.toContain('item.nameEn');
    expect(wxml).not.toContain('EXERCISE DOSSIER');
    // 页头文案与全量目录 + 中文展示一致,不再写「精选」或英文缩略图字样
    expect(wxml).toContain('全量动作目录 · {{resultCount}} 条');
    expect(wxml).not.toContain('精选动作目录');
    expect(wxml).not.toContain('JPEG 缩略图');
  });
});

describe('动作库页面:原值胶囊多选、一次提交与分页预热', () => {
  let page;
  let setDataCalls;
  let pendingCallbacks;

  beforeEach(() => {
    jest.resetModules();
    page = null;
    setDataCalls = [];
    pendingCallbacks = [];
    global.Page = (definition) => {
      page = definition;
    };
    global.wx = {
      getStorageSync: () => null,
      setStorageSync: () => {},
      navigateBack: () => {},
    };
    require('../pages/library/library');
    page = Object.assign({}, page, {
      data: JSON.parse(JSON.stringify(page.data)),
    });
    // 回调只记录不执行:页面必须在同一次 setData 里提交条件与结果,不能靠回调再检索
    page.setData = (patch, callback) => {
      setDataCalls.push(patch);
      page.data = Object.assign({}, page.data, patch);
      if (callback) pendingCallbacks.push(callback);
    };
  });

  afterEach(() => {
    delete global.Page;
    delete global.wx;
  });

  const pill = (row, key) => page.data[row].find((item) => item.key === key);

  test('两行胶囊来自固定筛选键:7 个部位中文标签 + 目录实际器械原值', () => {
    page.onLoad({});

    expect(page.data.bodyPartFilters.map((item) => item.key)).toEqual(['全部'].concat(labels.BODY_PART_KEYS));
    expect(page.data.bodyPartFilters.map((item) => item.label)).toEqual([
      '全部', '胸', '背', '肩', '手臂', '腿', '腰腹', '臀',
    ]);

    const rawKeys = [...new Set(catalog.EXERCISES.map((item) => item.equipment))];
    expect(page.data.equipmentFilters[0]).toEqual({ key: '全部', label: '全部', active: true });
    expect(page.data.equipmentFilters.slice(1).map((item) => item.key).sort()).toEqual(rawKeys.sort());
    expect(page.data.equipmentFilters.every((item) => item.label && item.label !== '')).toBe(true);
    // 当前目录每个器械标签都是中文展示,不是回退的英文原值
    expect(page.data.equipmentFilters.slice(1).every((item) => item.label !== item.key)).toBe(true);
    // 器械行按固定序表排,未知原值才追加;barbell / dumbbell / body weight 是独立胶囊
    const ordered = page.data.equipmentFilters.slice(1).map((item) => item.key);
    expect(ordered).toContain('body weight');
    expect(ordered.indexOf('barbell')).toBeLessThan(ordered.indexOf('dumbbell'));
    const knownPresent = ordered.filter((key) => labels.EQUIPMENT_ORDER.indexOf(key) !== -1);
    expect(knownPresent).toEqual(labels.EQUIPMENT_ORDER.filter((key) => ordered.indexOf(key) !== -1));
  });

  test('首屏 24 条 JPEG fileID、预热 48 条、完整匹配数为全量目录数,列表不携带 GIF', () => {
    const total = catalog.search('', [], []).length;
    page.onLoad({});

    expect(page.data.items).toHaveLength(Math.min(24, total));
    expect(page.data.resultCount).toBe(total);
    expect(page.data.preheatItems).toHaveLength(Math.min(48, total));
    expect(page.data.items.every((item) => item.thumbSrc.indexOf('cloud://') === 0)).toBe(true);
    expect(page.data.items.every((item) => /\.jpg$/.test(item.thumbSrc))).toBe(true);
    expect(page.data.items.every((item) => !Object.prototype.hasOwnProperty.call(item, 'gifSrc'))).toBe(true);
    // 列表主名是中文展示名,不携带英文副标题
    expect(page.data.items.every((item) => item.name === catalog.findById(item.id).nameZh)).toBe(true);
  });

  test('同行多选:点选加入、再点取消,列表与完整匹配数跟着变', () => {
    page.onLoad({});

    page.onEquipFilterTap(tapEvent('barbell'));
    expect(page.data.equipmentKeys).toEqual(['barbell']);
    expect(pill('equipmentFilters', 'barbell').active).toBe(true);
    expect(pill('equipmentFilters', '全部').active).toBe(false);
    const barbell = catalog.search('', ['barbell'], []);
    expect(page.data.resultCount).toBe(barbell.length);
    expect(ids(page.data.items)).toEqual(ids(barbell.slice(0, 24)));

    page.onEquipFilterTap(tapEvent('dumbbell'));
    const union = catalog.search('', ['barbell', 'dumbbell'], []);
    expect(page.data.equipmentKeys).toEqual(['barbell', 'dumbbell']);
    expect(pill('equipmentFilters', 'barbell').active).toBe(true);
    expect(pill('equipmentFilters', 'dumbbell').active).toBe(true);
    expect(page.data.resultCount).toBe(union.length);
    expect(page.data.resultCount).toBeGreaterThan(barbell.length);
    expect(ids(page.data.items)).toEqual(ids(union.slice(0, 24)));

    // 再点已选项即取消
    page.onEquipFilterTap(tapEvent('barbell'));
    expect(page.data.equipmentKeys).toEqual(['dumbbell']);
    expect(pill('equipmentFilters', 'barbell').active).toBe(false);
    expect(page.data.resultCount).toBe(catalog.search('', ['dumbbell'], []).length);
  });

  test('部位行独立多选(七类键),与器械行、搜索词取交集', () => {
    page.onLoad({});

    page.onBodyPartFilterTap(tapEvent('chest'));
    page.onBodyPartFilterTap(tapEvent('shoulders'));
    expect(page.data.bodyPartKeys).toEqual(['chest', 'shoulders']);
    expect(pill('bodyPartFilters', 'chest').active).toBe(true);
    expect(pill('bodyPartFilters', 'shoulders').active).toBe(true);
    const parts = catalog.search('', [], ['chest', 'shoulders']);
    expect(page.data.resultCount).toBe(parts.length);

    page.onEquipFilterTap(tapEvent('dumbbell'));
    const crossed = catalog.search('', ['dumbbell'], ['chest', 'shoulders']);
    expect(page.data.resultCount).toBe(crossed.length);
    expect(page.data.resultCount).toBeLessThan(parts.length);
    expect(ids(page.data.items)).toEqual(ids(crossed.slice(0, 24)));

    page.onSearchInput({ detail: { value: '卧推' } });
    const searched = catalog.search('卧推', ['dumbbell'], ['chest', 'shoulders']);
    expect(page.data.query).toBe('卧推');
    expect(page.data.resultCount).toBe(searched.length);
    expect(ids(page.data.items)).toEqual(ids(searched.slice(0, 24)));
    // 俗称走同一页面检索路径;先清空两行,否则被上一条的交集条件挡掉
    page.onSearchInput({ detail: { value: '倒蹬' } });
    expect(page.data.resultCount).toBe(0);
    page.onEquipFilterTap(tapEvent('全部'));
    page.onBodyPartFilterTap(tapEvent('全部'));
    expect(ids(page.data.items)).toEqual(['0739']);
  });

  test('臀与腿互斥:选臀不出现腿分类动作,并集条数等于两类之和', () => {
    page.onLoad({});

    page.onBodyPartFilterTap(tapEvent('glutes'));
    const glutes = catalog.search('', [], ['glutes']);
    expect(glutes.length).toBeGreaterThan(0);
    expect(page.data.resultCount).toBe(glutes.length);
    expect(ids(page.data.items)).toEqual(ids(glutes.slice(0, 24)));
    expect(glutes.every((item) => item.target === 'glutes')).toBe(true);

    page.onBodyPartFilterTap(tapEvent('legs'));
    const both = catalog.search('', [], ['glutes', 'legs']);
    expect(page.data.resultCount).toBe(both.length);
    expect(both.length).toBe(glutes.length + catalog.search('', [], ['legs']).length);
    expect(new Set(ids(both)).size).toBe(both.length);
  });

  test('点「全部」清空该行,另一行与搜索词不受影响', () => {
    page.onLoad({});

    page.onBodyPartFilterTap(tapEvent('chest'));
    page.onEquipFilterTap(tapEvent('barbell'));
    page.onEquipFilterTap(tapEvent('dumbbell'));
    page.onSearchInput({ detail: { value: '卧推' } });

    page.onEquipFilterTap(tapEvent('全部'));
    expect(page.data.equipmentKeys).toEqual([]);
    expect(pill('equipmentFilters', '全部').active).toBe(true);
    expect(page.data.equipmentFilters.slice(1).every((item) => !item.active)).toBe(true);
    expect(page.data.bodyPartKeys).toEqual(['chest']);
    expect(page.data.query).toBe('卧推');
    expect(page.data.resultCount).toBe(catalog.search('卧推', [], ['chest']).length);

    page.onBodyPartFilterTap(tapEvent('全部'));
    expect(page.data.bodyPartKeys).toEqual([]);
    expect(pill('bodyPartFilters', '全部').active).toBe(true);
    expect(page.data.resultCount).toBe(catalog.search('卧推', [], []).length);
  });

  test('筛选条件与 items/resultCount 一次 setData 提交,且不依赖 setData 回调', () => {
    page.onLoad({});
    setDataCalls.length = 0;

    page.onEquipFilterTap(tapEvent('barbell'));

    expect(setDataCalls).toHaveLength(1);
    const patch = setDataCalls[0];
    expect(patch.equipmentKeys).toEqual(['barbell']);
    expect(patch.items).toHaveLength(Math.min(24, catalog.search('', ['barbell'], []).length));
    expect(patch.resultCount).toBe(catalog.search('', ['barbell'], []).length);
    expect(patch.hasMore).toBe(catalog.search('', ['barbell'], []).length > 24);
    expect(patch.equipmentFilters.find((item) => item.key === 'barbell').active).toBe(true);
    expect(patch.bodyPartFilters.find((item) => item.key === '全部').active).toBe(true);
    expect(pendingCallbacks).toHaveLength(0);
    // 选中态与列表结果已在同一次提交里落地,无需回调补检索
    expect(pill('equipmentFilters', 'barbell').active).toBe(true);
    expect(page.data.resultCount).toBe(patch.resultCount);
  });

  test('滚动追加下一页并重置到首屏,缩略图失败降回 glyph,详情仍 GIF 优先', () => {
    const total = catalog.search('', [], []).length;
    page.onLoad({});
    const firstIds = ids(page.data.items);
    const callsBeforePaging = setDataCalls.length;

    page.onReachBottom();
    expect(page.data.items).toHaveLength(Math.min(48, total));
    expect(new Set(ids(page.data.items)).size).toBe(page.data.items.length);
    expect(ids(page.data.items).slice(0, firstIds.length)).toEqual(firstIds);
    // 追加只提交一次新窗口,不重复提交筛选条件或加载首屏
    const pagingCalls = setDataCalls.slice(callsBeforePaging);
    expect(pagingCalls).toHaveLength(1);
    expect(Object.keys(pagingCalls[0]).sort()).toEqual(['hasMore', 'items', 'preheatItems', 'resultCount']);
    expect(ids(pagingCalls[0].items)).toEqual(ids(catalog.search('', [], []).slice(0, 48)));
    expect(pagingCalls[0].resultCount).toBe(total);

    page.onEquipFilterTap(tapEvent('barbell'));
    expect(page.data.items).toHaveLength(Math.min(24, catalog.search('', ['barbell'], []).length));

    const failedId = page.data.items[0].id;
    page.onThumbError({ currentTarget: { dataset: { id: failedId } } });
    expect(page.data.items[0].thumbSrc).toBe('');
    expect(page.data.items[0].name).toBeTruthy();

    page.onItemTap({ currentTarget: { dataset: { id: failedId } } });
    expect(page.data.detail.gifSrc).toMatch(/\.gif$/);
    expect(page.data.detail.imageSrc).toMatch(/\.jpg$/);
    expect(page.data.detail.equipmentZh).toBe(labels.equipmentLabel(catalog.findById(failedId).equipment));
    expect(page.data.detail.bodyPartZh).toBe(labels.bodyPartLabel(labels.bodyPartCategory(catalog.findById(failedId))));
    // 详情不携带英文副标题,器械值走中文标签
    expect(page.data.detail.nameEn).toBeUndefined();
    expect(/[^\x00-\x7F]/.test(page.data.detail.equipmentZh)).toBe(true);
  });

  test('pick=1 加练入口不变:选中后写入训练草稿并返回', () => {
    const draft = { exercises: [] };
    const stored = {};
    global.wx = {
      getStorageSync: (key) => (key === DRAFT_KEY ? draft : null),
      setStorageSync: (key, value) => {
        stored[key] = value;
      },
      navigateBack: jest.fn(),
    };

    page.onLoad({ pick: '1' });
    expect(page.data.pickMode).toBe(true);

    const target = page.data.items[0];
    page.onItemTap({ currentTarget: { dataset: { id: target.id } } });
    page.onPickExercise();

    expect(stored[DRAFT_KEY].exercises).toHaveLength(1);
    expect(stored[DRAFT_KEY].exercises[0].exerciseId).toBe(target.id);
    expect(stored[DRAFT_KEY].exercises[0].equipment).toBe(catalog.findById(target.id).equipment);
    expect(global.wx.navigateBack).toHaveBeenCalled();
  });
});
