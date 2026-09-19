const paging = require('../pages/library/library-paging');

function buildItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1).padStart(4, '0'),
    name: `动作${index + 1}`,
  }));
}

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

describe('动作库页面分页、缩略图与详情媒体', () => {
  let page;

  test('WXML 绑定列表 JPEG 懒加载、失败降级和详情组件入口', () => {
    const fs = require('fs');
    const path = require('path');
    const wxml = fs.readFileSync(path.join(__dirname, '../pages/library/library.wxml'), 'utf8');
    expect(wxml).toContain('src="{{item.thumbSrc}}"');
    expect(wxml).toContain('lazy-load="{{true}}"');
    expect(wxml).toContain('binderror="onThumbError"');
    expect(wxml).toContain('<exercise-detail');
    expect(wxml).toContain('preheatItems');
  });

  beforeEach(() => {
    jest.resetModules();
    global.Page = (definition) => {
      page = definition;
    };
    global.wx = {};
    require('../pages/library/library');
    page = Object.assign({}, page, {
      data: JSON.parse(JSON.stringify(page.data)),
    });
    page.setData = (patch, callback) => {
      page.data = Object.assign({}, page.data, patch);
      if (callback) callback();
    };
  });

  afterEach(() => {
    delete global.Page;
    delete global.wx;
  });

  test('首屏显示 24 条 JPEG fileID,完整结果数为精选目录总数,不携带 GIF', () => {
    page.onLoad({});

    expect(page.data.items).toHaveLength(24);
    expect(page.data.resultCount).toBe(136);
    expect(page.data.preheatItems).toHaveLength(48);
    expect(page.data.items.every((item) => item.thumbSrc.indexOf('cloud://') === 0)).toBe(true);
    expect(page.data.items.every((item) => /\.jpg$/.test(item.thumbSrc))).toBe(true);
    expect(page.data.items.every((item) => !Object.prototype.hasOwnProperty.call(item, 'gifSrc'))).toBe(true);
  });

  test('滚动追加下一页且筛选重置到首屏', () => {
    page.onLoad({});
    const firstIds = page.data.items.map((item) => item.id);

    page.onReachBottom();
    expect(page.data.items).toHaveLength(48);
    expect(new Set(page.data.items.map((item) => item.id)).size).toBe(48);
    expect(page.data.items.slice(0, 24).map((item) => item.id)).toEqual(firstIds);

    page.onPartFilterTap({ currentTarget: { dataset: { bucket: 'legs' } } });
    expect(page.data.resultCount).toBe(38);
    expect(page.data.items).toHaveLength(24);
    expect(page.data.hasMore).toBe(true);

    page.onSearchInput({ detail: { value: '杠铃深蹲' } });
    expect(page.data.resultCount).toBe(1);
    expect(page.data.items).toHaveLength(1);
    expect(page.data.hasMore).toBe(false);

    // 俗称搜索也走同一页面检索路径
    page.onSearchInput({ detail: { value: '倒蹬' } });
    expect(page.data.resultCount).toBe(1);
    expect(page.data.items.map((item) => item.id)).toEqual(['0739']);
  });

  test('页面级筛选暴露六个器械桶、10 个产品标签(含热身)和复合动作重叠结果', () => {
    const catalog = require('../data/exercises');
    const partKeys = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'waist', 'glutes', 'warm-up', 'compound'];
    page.onLoad({});
    expect(page.data.equipFilters.map((item) => item.label)).toEqual([
      '全部', '杠铃', '哑铃', '绳索', '器械', '自重', '其他',
    ]);
    expect(page.data.partFilters).toHaveLength(11);
    expect(page.data.partFilters.map((item) => item.key)).toEqual(['全部'].concat(partKeys));
    expect(page.data.partFilters.map((item) => item.label)).toEqual([
      '全部', '胸', '背', '肩', '二头肌', '三头肌', '腿', '腰腹', '臀', '热身', '复合动作',
    ]);

    const compoundIds = new Set();
    partKeys.forEach((key) => {
      page.onPartFilterTap({ currentTarget: { dataset: { bucket: key } } });
      const expected = catalog.search('', '全部', key);
      expect(page.data.resultCount).toBe(expected.length);
      expect(page.data.items.map((item) => item.id)).toEqual(expected.slice(0, 24).map((item) => item.id));
      expect(page.data.items.length).toBe(Math.min(24, expected.length));
      if (key === 'compound') {
        page.data.items.forEach((item) => compoundIds.add(item.id));
        expect(page.data.hasMore).toBe(expected.length > 24);
      }
    });

    page.onPartFilterTap({ currentTarget: { dataset: { bucket: 'chest' } } });
    expect(page.data.items.some((item) => compoundIds.has(item.id))).toBe(true);

    page.onEquipFilterTap({ currentTarget: { dataset: { bucket: 'cable' } } });
    const cableChest = catalog.search('', 'cable', 'chest');
    expect(page.data.resultCount).toBe(cableChest.length);
    expect(page.data.items.map((item) => item.id)).toEqual(cableChest.slice(0, 24).map((item) => item.id));
    expect(page.data.items.every((item) => item.meta.includes('绳索'))).toBe(true);
  });

  test('页面级热身筛选命中 18 条且每条都能从具体部位筛到', () => {
    const catalog = require('../data/exercises');
    page.onLoad({});

    page.onPartFilterTap({ currentTarget: { dataset: { bucket: 'warm-up' } } });
    expect(page.data.partFilter).toBe('warm-up');
    expect(page.data.resultCount).toBe(18);
    expect(page.data.items).toHaveLength(18);
    expect(page.data.hasMore).toBe(false);
    expect(page.data.preheatItems).toHaveLength(18);
    expect(page.data.items.every((item) => item.thumbSrc.indexOf('cloud://') === 0)).toBe(true);

    const concreteTags = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'waist', 'glutes'];
    page.data.items.forEach((item) => {
      const meta = catalog.CURATED_EXERCISES[item.id];
      expect(meta.tags).toContain('warm-up');
      const concrete = meta.tags.filter((tag) => concreteTags.indexOf(tag) !== -1);
      expect(concrete.length).toBeGreaterThan(0);
      concrete.forEach((tag) => {
        expect(catalog.search('', '全部', tag).some((x) => x.id === item.id)).toBe(true);
      });
    });

    // 同一批动作也能从具体部位筛选里进入列表
    page.onPartFilterTap({ currentTarget: { dataset: { bucket: 'glutes' } } });
    expect(page.data.resultCount).toBe(31);
    expect(page.data.items.map((item) => item.id)).toEqual(
      catalog.search('', '全部', 'glutes').slice(0, 24).map((item) => item.id)
    );
    expect(page.data.items.some((item) => item.id === '0628')).toBe(true);
  });

  test('到达末页后不再追加,缩略图失败降回 glyph,详情仍为 GIF 优先', () => {
    page.onLoad({});
    page.onReachBottom();
    page.onReachBottom();
    page.onReachBottom();
    page.onReachBottom();
    page.onReachBottom();
    expect(page.data.items).toHaveLength(136);
    expect(page.data.hasMore).toBe(false);
    page.onReachBottom();
    expect(page.data.items).toHaveLength(136);

    const failedId = page.data.items[0].id;
    page.onThumbError({ currentTarget: { dataset: { id: failedId } } });
    expect(page.data.items[0].thumbSrc).toBe('');
    expect(page.data.items[0].name).toBeTruthy();

    page.onItemTap({ currentTarget: { dataset: { id: failedId } } });
    expect(page.data.detail.gifSrc).toMatch(/\.gif$/);
    expect(page.data.detail.imageSrc).toMatch(/\.jpg$/);
  });
});
