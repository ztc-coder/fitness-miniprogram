const fs = require('fs');
const path = require('path');
const catalog = require('../data/exercises');
const labels = require('../data/exercise-labels');
const wxml = fs.readFileSync(path.join(__dirname, '../pages/library/library.wxml'), 'utf8');
const wxss = fs.readFileSync(path.join(__dirname, '../pages/library/library.wxss'), 'utf8');

describe('board1 动作库展示', () => {
  let page;

  beforeEach(() => {
    jest.resetModules();
    global.Page = (definition) => { page = definition; };
    require('../pages/library/library');
    page.data = JSON.parse(JSON.stringify(page.data));
    page.setData = (patch) => { page.data = Object.assign({}, page.data, patch); };
    page.onLoad({});
  });

  afterEach(() => { delete global.Page; });

  test('器械标签和肌群只取目录真实译名，不增加不存在的次要肌群', () => {
    const checkItems = () => page.data.items.forEach((item) => {
      const raw = catalog.findById(item.id);
      expect(item.equipmentText).toBe(labels.equipmentLabel(raw.equipment));
      expect(item.muscleText).toBe(catalog.targetLabel(raw.target));
      expect(item.meta).toBe(`${item.muscleText} · ${item.equipmentText}`);
    });
    checkItems();
    page.onReachBottom();
    checkItems();
    const first = page.data.items[0];
    page.onThumbError({ currentTarget: { dataset: { id: first.id } } });
    expect(page.data.items[0].equipmentText).toBe(first.equipmentText);
    expect(page.data.items[0].muscleText).toBe(first.muscleText);
    expect(page.data.resultCount).toBe(catalog.EXERCISES.length);
  });

  test('标题计数、搜索、模式提示与两条安全滚动轨保留', () => {
    expect(wxml).toContain('{{resultCount}} 动作');
    expect(wxml).toContain('搜索动作名称、目标肌群或器械...');
    expect(wxml).toContain('{{item.equipmentText}}');
    expect(wxml).toContain('{{item.muscleText}}');
    expect(wxml).toContain('wx:if="{{pickMode}}" class="library-hint"');
    expect(wxml).toContain('快速加入本次训练');
    expect(wxml).toContain('快速加入计划');
    expect(wxml).toContain("{{item.key === '全部' ? '全部器械' : item.label}}");
    expect(wxml).toContain("{{item.key === '全部' ? '全部部位' : item.label}}");
    expect(wxml.match(/class="filter-track-end"/g)).toHaveLength(2);
    expect(wxss).toMatch(/\.filter-bar\s*\{[^}]*position: sticky/);
    expect(wxss).toMatch(/\.filter-pill\.active\s*\{[^}]*var\(--signal-gradient\)/);
    expect(wxss).toMatch(/\.library-quick-btn\s*\{[^}]*width: 88rpx;[^}]*height: 88rpx/);
  });
});
