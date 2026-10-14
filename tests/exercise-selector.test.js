/**
 * 全量动作选择器核心(票 02):内置索引、生成器确定性、导入规范化、筛选/分组/分页/选择/导出。
 * 覆盖成功路径、空结果、错误输入与选择边界;纯函数,无 DOM。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const core = require('../tools/exercise-selector/core');
const index = require('../tools/exercise-selector/index-data');
const buildIndex = require('../tools/exercise-selector/build-index');

const ROOT = path.join(__dirname, '..');
const CORE_FILE = path.join(ROOT, 'tools/exercise-selector/core.js');
const INDEX_FILE = path.join(ROOT, 'tools/exercise-selector/index-data.js');
const BUILD_FILE = path.join(ROOT, 'tools/exercise-selector/build-index.js');
const HAS_DATASET = fs.existsSync(buildIndex.SRC_JSON);

/** 上游 snake_case 行(默认是一条合法数据) */
function rawRow(overrides) {
  return Object.assign({
    id: '0001',
    name: '3/4 sit-up',
    name_zh: '3/4 仰卧起坐',
    category: 'waist',
    body_part: 'waist',
    equipment: 'body weight',
    target: 'abs',
    image: 'images/0001-2gPfomN.jpg',
    gif_url: 'videos/0001-2gPfomN.gif',
  }, overrides || {});
}

/** 内置 camelCase 行 */
function builtInRow(overrides) {
  const row = rawRow(overrides);
  return {
    id: row.id,
    name: row.name,
    nameZh: row.name_zh || row.nameZh,
    category: row.category,
    bodyPart: row.body_part,
    equipment: row.equipment,
    target: row.target,
    imagePath: row.image,
    gifPath: row.gif_url,
  };
}

/** 在无 module 的 vm 上下文里按浏览器 <script> 方式加载文件 */
function loadAsBrowserScript(file) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return sandbox;
}

describe('内置精简索引(1324 条)', () => {
  test('是 1324 条,按 4 位 ID 升序且 ID 唯一', () => {
    expect(index).toHaveLength(1324);
    expect(new Set(index.map((item) => item.id)).size).toBe(1324);
    expect(index.every((item) => /^[0-9]{4}$/.test(item.id))).toBe(true);
    const ids = index.map((item) => item.id);
    expect(ids).toEqual([...ids].sort());
  });

  test('每条严格只含 9 个字段、中文名与上游相对媒体路径', () => {
    expect(core.INDEX_FIELDS).toEqual([
      'id', 'name', 'nameZh', 'category', 'bodyPart', 'equipment', 'target', 'imagePath', 'gifPath',
    ]);
    index.forEach((item) => {
      expect(Object.keys(item)).toEqual(core.INDEX_FIELDS);
      expect(item.imagePath).toMatch(/^images\/[0-9]{4}-.+\.jpg$/);
      expect(item.gifPath).toMatch(/^videos\/[0-9]{4}-.+\.gif$/);
      expect(item.imagePath.split('/')[1].split('-')[0]).toBe(item.id);
      expect(item.gifPath.split('/')[1].split('-')[0]).toBe(item.id);
      expect(item.name.trim()).toBe(item.name);
      expect(item.name).not.toBe('');
      expect(item.nameZh).toMatch(/[\u4e00-\u9fff]/);
    });
  });

  test('内置索引已是规范化结果,重复规范化幂等', () => {
    expect(core.normalizeExercises(index)).toEqual(index);
  });

  test('包含 cardio 与全部上游变式,覆盖 10 个部位与 28 种器械', () => {
    expect(index.filter((item) => item.category === 'cardio')).toHaveLength(29);
    expect(new Set(index.map((item) => item.bodyPart)).size).toBe(10);
    expect(new Set(index.map((item) => item.equipment)).size).toBe(28);
  });

  (HAS_DATASET ? test : test.skip)('与上游 exercises.json 逐条一致(字段映射无丢失)', () => {
    const raw = JSON.parse(fs.readFileSync(buildIndex.SRC_JSON, 'utf8'));
    const nameZhMap = JSON.parse(fs.readFileSync(buildIndex.SRC_ZH, 'utf8'));
    expect(raw).toHaveLength(1324);
    const expected = raw
      .map((row) => ({
        id: row.id,
        name: row.name,
        nameZh: buildIndex.tidyZh(nameZhMap[row.name]),
        category: row.category,
        bodyPart: row.body_part,
        equipment: row.equipment,
        target: row.target,
        imagePath: row.image,
        gifPath: row.gif_url,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    expect(index).toEqual(expected);
  });
});

describe('生成器确定性', () => {
  test('renderIndexFile 对同一输入输出完全一致且带来源注释', () => {
    const list = core.normalizeExercises([rawRow({ id: '0002' }), rawRow({ id: '0001' })]);
    const first = buildIndex.renderIndexFile(list);
    const second = buildIndex.renderIndexFile(list);
    expect(first).toBe(second);
    expect(first).toContain('build-index.js 生成');
    expect(first).toContain('hasaneyldrm/exercises-dataset');
    expect(first).toContain('EXERCISE_SELECTOR_INDEX');
  });

  test('生成器拒绝缺失的源数据并给出可读提示', () => {
    expect(() => buildIndex.buildIndex({ srcPath: '/tmp/definitely-missing-exercises.json' }))
      .toThrow(/缺少源数据[\s\S]*curl/);
  });

  (HAS_DATASET ? test : test.skip)('连续两次生成的字节完全一致', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exercise-index-'));
    const firstOut = path.join(outDir, 'first.js');
    const secondOut = path.join(outDir, 'second.js');
    execFileSync('node', [BUILD_FILE, '--out', firstOut]);
    execFileSync('node', [BUILD_FILE, '--out', secondOut]);
    const first = fs.readFileSync(firstOut);
    const second = fs.readFileSync(secondOut);
    expect(first.equals(second)).toBe(true);
    expect(first.toString('utf8')).toContain('1324 条精简索引');
  });

  (HAS_DATASET ? test : test.skip)('磁盘内置索引与当前数据集生成结果一致,且为 1324 条', () => {
    const { list, code } = buildIndex.buildIndex();
    expect(list).toHaveLength(1324);
    expect(fs.readFileSync(INDEX_FILE, 'utf8')).toBe(code);
  });
});

describe('导入规范化', () => {
  test('接受上游 snake_case 对象并映射为 camelCase 字段', () => {
    expect(core.normalizeExercises([rawRow()])).toEqual([builtInRow()]);
  });

  test('接受内置 camelCase 对象', () => {
    expect(core.normalizeExercises([builtInRow()])).toEqual([builtInRow()]);
  });

  test('输出按 4 位 ID 升序,与输入顺序无关', () => {
    const result = core.normalizeExercises([
      rawRow({ id: '0100' }), rawRow({ id: '0002' }), rawRow({ id: '0099' }),
    ]);
    expect(result.map((item) => item.id)).toEqual(['0002', '0099', '0100']);
  });

  test('顶层不是数组时报错', () => {
    expect(() => core.normalizeExercises({ id: '0001' }))
      .toThrow(core.ExerciseSelectorError);
    expect(() => core.normalizeExercises({ id: '0001' })).toThrow(/数据集必须是数组,收到 object/);
    expect(() => core.normalizeExercises(null)).toThrow(/收到 null/);
  });

  test('条目不是对象时报错并指出位置', () => {
    expect(() => core.normalizeExercises([rawRow(), 'nope'])).toThrow(/第 2 条: 必须是对象,收到 string/);
  });

  test('id 不是 4 位数字字符串时报错(数字/短 id/带字母)', () => {
    [25, '025', 'abcd', '', undefined].forEach((badId) => {
      expect(() => core.normalizeExercises([rawRow({ id: badId })]))
        .toThrow(/第 1 条: id 必须是 4 位数字字符串/);
    });
  });

  test('重复 id 报出两条位置且不返回部分结果', () => {
    let error = null;
    try {
      core.normalizeExercises([rawRow(), rawRow()]);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(core.ExerciseSelectorError);
    expect(error.message).toContain('第 2 条: id 0001 与第 1 条重复');
    expect(error.issues).toEqual(['第 2 条: id 0001 与第 1 条重复']);
  });

  test('缺必需文本字段时列出字段名', () => {
    expect(() => core.normalizeExercises([rawRow({ name: '', target: undefined })]))
      .toThrow(/id 0001\): 缺少必需字段 name、target/);
  });

  test('缺媒体路径或路径为空白时报错', () => {
    expect(() => core.normalizeExercises([rawRow({ image: undefined })]))
      .toThrow(/缺少必需字段 imagePath/);
    expect(() => core.normalizeExercises([rawRow({ gif_url: '   ' })]))
      .toThrow(/缺少必需字段 gifPath/);
  });

  test('一次报出全部问题,错误信息含行号、id 与问题总数', () => {
    let error = null;
    try {
      core.normalizeExercises([
        rawRow(),
        rawRow({ id: '0001' }),
        rawRow({ id: '2', name: '' }),
        rawRow({ id: '0003', name: '' }),
        null,
      ]);
    } catch (caught) {
      error = caught;
    }
    expect(error.issues).toHaveLength(4);
    expect(error.message).toContain('数据集校验失败(4 条问题)');
    expect(error.message).toContain('第 2 条');
    expect(error.message).toContain('第 3 条');
    expect(error.message).toContain('第 4 条');
    expect(error.message).toContain('第 5 条: 必须是对象,收到 null');
  });

  test('问题过多时截断展示但保留完整 issues', () => {
    const rows = Array.from({ length: 30 }, (_, i) => rawRow({ id: String(i + 1) }));
    let error = null;
    try {
      core.normalizeExercises(rows);
    } catch (caught) {
      error = caught;
    }
    expect(error.issues).toHaveLength(30);
    expect(error.message).toContain('…还有 10 条问题');
  });

  test('空数组是合法输入,返回空索引', () => {
    expect(core.normalizeExercises([])).toEqual([]);
  });
});

describe('筛选(关键词 + 部位 + 器械 AND)', () => {
  test('关键词大小写不敏感地命中英文名', () => {
    const lower = core.filterExercises(index, { keyword: 'bench' });
    expect(lower).toHaveLength(73);
    expect(core.filterExercises(index, { keyword: 'BENCH' })).toEqual(lower);
    expect(core.filterExercises(index, { keyword: '  BeNcH  ' })).toEqual(lower);
  });

  test('关键词命中中文展示名', () => {
    expect(core.filterExercises(index, { keyword: '杠铃卧推' }).map((item) => item.id)).toContain('0025');
    expect(core.filterExercises(index, { keyword: '仰卧起坐' }).some((item) => item.id === '0001')).toBe(true);
  });

  test('关键词命中 id / target / bodyPart / equipment', () => {
    expect(core.filterExercises(index, { keyword: '0025' }).map((item) => item.id)).toEqual(['0025']);

    const pectorals = core.filterExercises(index, { keyword: 'pectorals' });
    expect(pectorals).toHaveLength(158);
    expect(pectorals.some((item) => item.target === 'pectorals' && !item.name.toLowerCase().includes('pectorals'))).toBe(true);

    const upperLegs = core.filterExercises(index, { keyword: 'upper legs' });
    expect(upperLegs).toHaveLength(228);
    expect(upperLegs.filter((item) => item.bodyPart === 'upper legs')).toHaveLength(227);
    expect(upperLegs.some((item) => item.bodyPart === 'upper legs' && !item.name.toLowerCase().includes('upper legs'))).toBe(true);

    const kettlebell = core.filterExercises(index, { keyword: 'kettlebell' });
    expect(kettlebell).toHaveLength(41);
    expect(kettlebell.every((item) => item.equipment === 'kettlebell')).toBe(true);
    expect(core.filterExercises(index, { keyword: 'stepmill machine' }))
      .toEqual(index.filter((item) => item.equipment === 'stepmill machine'));
  });

  test('bodyPart 与 equipment 是 AND 关系', () => {
    const result = core.filterExercises(index, { bodyPart: 'chest', equipment: 'barbell' });
    expect(result).toHaveLength(13);
    expect(result.every((item) => item.bodyPart === 'chest' && item.equipment === 'barbell')).toBe(true);
    expect(result.map((item) => item.id)).toEqual([...result.map((item) => item.id)].sort());
  });

  test('三个维度组合仍是 AND', () => {
    const result = core.filterExercises(index, { keyword: 'press', bodyPart: 'chest', equipment: 'barbell' });
    expect(result).toHaveLength(9);
    expect(result.every((item) => item.bodyPart === 'chest' && item.equipment === 'barbell' && item.name.includes('press'))).toBe(true);
  });

  test('无匹配时返回空数组', () => {
    expect(core.filterExercises(index, { keyword: 'zzzz-not-an-exercise' })).toEqual([]);
    expect(core.filterExercises(index, { bodyPart: 'chest', equipment: 'skierg machine' })).toEqual([]);
  });

  test('无筛选条件返回全部且不修改输入', () => {
    const before = index.length;
    expect(core.filterExercises(index, {})).toHaveLength(before);
    expect(core.filterExercises(index)).toHaveLength(before);
    expect(core.filterExercises(index, { keyword: '', bodyPart: '', equipment: '' })).toHaveLength(before);
    expect(index).toHaveLength(before);
  });

  test('输入不是数组时报错', () => {
    expect(() => core.filterExercises(null, {})).toThrow(/动作列表必须是数组,收到 null/);
  });
});

describe('分组(部位 / 器械)', () => {
  test('按 bodyPart 分组:组顺序为首次出现顺序,组内保持 ID 升序,总数守恒', () => {
    const groups = core.groupExercises(index, 'bodyPart');
    expect(groups.map((group) => group.key)).toEqual([
      'waist', 'back', 'chest', 'upper legs', 'upper arms',
      'shoulders', 'lower arms', 'lower legs', 'cardio', 'neck',
    ]);
    expect(groups.reduce((sum, group) => sum + group.count, 0)).toBe(1324);
    groups.forEach((group) => {
      expect(group.items).toHaveLength(group.count);
      expect(group.items.every((item) => item.bodyPart === group.key)).toBe(true);
      const ids = group.items.map((item) => item.id);
      expect(ids).toEqual([...ids].sort());
    });
    expect(groups.find((group) => group.key === 'waist').count).toBe(169);
  });

  test('按 equipment 分组覆盖 28 种器械且是稳定顺序', () => {
    const first = core.groupExercises(index, 'equipment');
    const second = core.groupExercises(index, 'equipment');
    expect(first).toHaveLength(28);
    expect(first.map((group) => group.key)).toEqual(second.map((group) => group.key));
    expect(first.reduce((sum, group) => sum + group.count, 0)).toBe(1324);
    expect(first[0].key).toBe(index[0].equipment);
  });

  test('筛选结果可以继续分组', () => {
    const groups = core.groupExercises(core.filterExercises(index, { bodyPart: 'chest' }), 'equipment');
    expect(groups.reduce((sum, group) => sum + group.count, 0)).toBe(163);
  });

  test('空列表分组返回空数组', () => {
    expect(core.groupExercises([], 'bodyPart')).toEqual([]);
  });

  test('非法分组字段与非数组输入报错', () => {
    expect(() => core.groupExercises(index, 'category')).toThrow(/分组字段只能是 bodyPart 或 equipment/);
    expect(() => core.groupExercises('nope', 'bodyPart')).toThrow(/动作列表必须是数组/);
  });
});

describe('分页(每页 48 条)', () => {
  test('PAGE_SIZE 为 48,1324 条共 28 页,末页 28 条', () => {
    expect(core.PAGE_SIZE).toBe(48);
    const first = core.paginate(index, 1);
    const last = core.paginate(index, 28);
    expect(first.items).toHaveLength(48);
    expect(first.pageCount).toBe(28);
    expect(first.total).toBe(1324);
    expect(first.hasPrev).toBe(false);
    expect(first.hasNext).toBe(true);
    expect(last.items).toHaveLength(28);
    expect(last.hasNext).toBe(false);
    expect(last.hasPrev).toBe(true);
  });

  test('所有页合起来不重不漏且保持 ID 升序', () => {
    const collected = [];
    for (let page = 1; page <= 28; page += 1) {
      collected.push(...core.paginate(index, page).items.map((item) => item.id));
    }
    expect(collected).toHaveLength(1324);
    expect(new Set(collected).size).toBe(1324);
    expect(collected).toEqual([...collected].sort());
  });

  test('越界页码收敛到有效范围', () => {
    expect(core.paginate(index, 0).page).toBe(1);
    expect(core.paginate(index, -5).page).toBe(1);
    expect(core.paginate(index, 999).page).toBe(28);
    expect(core.paginate(index, 999).items).toHaveLength(28);
  });

  test('空结果页码为 1、页数为 0、无上下页', () => {
    expect(core.paginate([], 3)).toEqual({
      items: [], page: 1, pageCount: 0, pageSize: 48, total: 0, hasPrev: false, hasNext: false,
    });
  });

  test('筛选后的结果独立分页', () => {
    const filtered = core.filterExercises(index, { bodyPart: 'chest', equipment: 'barbell' });
    const paged = core.paginate(filtered, 1);
    expect(paged.total).toBe(13);
    expect(paged.pageCount).toBe(1);
    expect(paged.items).toHaveLength(13);
  });

  test('非数组输入报错', () => {
    expect(() => core.paginate(undefined, 1)).toThrow(/动作列表必须是数组/);
  });
});

describe('选择集合', () => {
  test('toggle 添加与移除,且不修改原集合', () => {
    const empty = core.createSelection();
    const added = core.toggleSelection(empty, '0025');
    expect(empty.size).toBe(0);
    expect(core.isSelected(added, '0025')).toBe(true);
    expect(core.selectedIds(added)).toEqual(['0025']);
    const removed = core.toggleSelection(added, '0025');
    expect(core.isSelected(removed, '0025')).toBe(false);
    expect(core.selectedIds(added)).toEqual(['0025']);
  });

  test('selectAll 选择当前结果并与已有选择求并集', () => {
    const page1 = core.paginate(index, 1).items;
    const page28 = core.paginate(index, 28).items;
    let selection = core.selectAll(core.createSelection(), page1);
    selection = core.selectAll(selection, page28);
    expect(selection.size).toBe(76);
    expect(core.selectedIds(selection)).toEqual([...page1, ...page28].map((item) => item.id).sort());
  });

  test('选择跨筛选、分组与分页保持', () => {
    const chest = core.filterExercises(index, { bodyPart: 'chest' });
    const barbell = core.filterExercises(index, { equipment: 'barbell' });
    const barbellPage1 = core.paginate(barbell, 1).items;
    let selection = core.toggleSelection(core.createSelection(), chest[0].id);
    selection = core.selectAll(selection, barbellPage1);
    selection = core.toggleSelection(selection, index[0].id);

    const expected = [...new Set([chest[0].id, ...barbellPage1.map((item) => item.id), index[0].id])].sort();
    expect(expected.length).toBeGreaterThan(48);
    expect(core.selectedIds(selection)).toEqual(expected);

    // 后续换筛选、换分组、翻页都不影响已选集合
    const squats = core.filterExercises(index, { keyword: 'squat' });
    core.paginate(core.groupExercises(squats, 'equipment')[0].items, 2);
    expect(core.selectedIds(selection)).toEqual(expected);
  });

  test('removeSelection 与 clearSelection', () => {
    const selection = core.selectAll(core.createSelection(), core.paginate(index, 1).items);
    expect(core.removeSelection(selection, '0001').size).toBe(47);
    expect(core.removeSelection(selection, '9999').size).toBe(48);
    expect(core.clearSelection().size).toBe(0);
    expect(selection.size).toBe(48);
  });

  test('选择边界:空集合、重复选择、未知 id 移除', () => {
    expect(core.selectedIds(core.createSelection())).toEqual([]);
    expect(core.selectedIds(core.clearSelection())).toEqual([]);
    let selection = core.createSelection(['0025', '0001']);
    selection = core.selectAll(selection, [{ id: '0025' }, { id: '0100' }]);
    expect(core.selectedIds(selection)).toEqual(['0001', '0025', '0100']);
    expect(core.selectedIds(core.removeSelection(selection, '0404'))).toEqual(['0001', '0025', '0100']);
  });

  test('接受数组形式的选择集合,非法输入报错', () => {
    expect(core.selectedIds(['0100', '0001'])).toEqual(['0001', '0100']);
    expect(() => core.selectedIds('0001')).toThrow(/选择集合必须是 Set 或数组,收到 string/);
    expect(() => core.selectAll(core.createSelection(), null)).toThrow(/动作列表必须是数组/);
  });
});

describe('导出 payload', () => {
  test('schemaVersion 1、字段与 spec 一致、selected 按 ID 排序', () => {
    const selection = core.createSelection(['0100', '0001', '0025']);
    const payload = core.buildExportPayload(selection, index);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.source).toBe('hasaneyldrm/exercises-dataset');
    expect(payload.selectedCount).toBe(3);
    expect(payload.selected.map((item) => item.id)).toEqual(['0001', '0025', '0100']);
    expect(core.EXPORT_FIELDS).toEqual([
      'id', 'name', 'nameZh', 'bodyPart', 'equipment', 'target', 'imagePath', 'gifPath',
    ]);
    payload.selected.forEach((item) => {
      expect(Object.keys(item)).toEqual(core.EXPORT_FIELDS);
    });
    expect(Object.keys(payload)).toEqual(['schemaVersion', 'source', 'selectedCount', 'selected']);
  });

  test('与 spec 示例(0025)逐字段一致', () => {
    const payload = core.buildExportPayload(core.createSelection(['0025']), index);
    expect(payload).toEqual({
      schemaVersion: 1,
      source: 'hasaneyldrm/exercises-dataset',
      selectedCount: 1,
      selected: [{
        id: '0025',
        name: 'barbell bench press',
        nameZh: '杠铃卧推',
        bodyPart: 'chest',
        equipment: 'barbell',
        target: 'pectorals',
        imagePath: 'images/0025-EIeI8Vf.jpg',
        gifPath: 'videos/0025-EIeI8Vf.gif',
      }],
    });
  });

  test('空选择导出空 selected,不导出筛选 UI 状态与伪造字段', () => {
    const payload = core.buildExportPayload(core.clearSelection(), index);
    expect(payload.selected).toEqual([]);
    expect(payload.selectedCount).toBe(0);
    expect(JSON.stringify(payload)).not.toContain('mode');
    expect(JSON.stringify(payload)).not.toContain('nameZh');
    expect(JSON.stringify(payload)).not.toContain('tags');
    expect(JSON.stringify(payload)).not.toContain('compound');
  });

  test('选中 ID 不在当前索引时报错而不是静默丢弃', () => {
    expect(() => core.buildExportPayload(core.createSelection(['0001', '9999']), index))
      .toThrow(/选中的动作不在当前索引中: 9999/);
  });

  test('导出只返回 payload,不改写精选白名单', () => {
    const catalogFile = path.join(ROOT, 'data/curated-catalog.js');
    const before = fs.readFileSync(catalogFile, 'utf8');
    const selection = core.selectAll(core.createSelection(), core.paginate(index, 1).items);
    core.buildExportPayload(selection, index);
    expect(fs.readFileSync(catalogFile, 'utf8')).toBe(before);
  });
});

describe('浏览器普通 <script> 直接加载', () => {
  test('core.js 无 module 时挂全局 ExerciseSelectorCore 且函数可用', () => {
    const sandbox = loadAsBrowserScript(CORE_FILE);
    const api = sandbox.ExerciseSelectorCore;
    expect(typeof api).toBe('object');
    expect(typeof api.normalizeExercises).toBe('function');
    expect(typeof api.filterExercises).toBe('function');
    expect(typeof api.groupExercises).toBe('function');
    expect(typeof api.paginate).toBe('function');
    expect(typeof api.toggleSelection).toBe('function');
    expect(typeof api.selectAll).toBe('function');
    expect(typeof api.clearSelection).toBe('function');
    expect(typeof api.removeSelection).toBe('function');
    expect(typeof api.buildExportPayload).toBe('function');
    expect(api.PAGE_SIZE).toBe(48);
    expect(api.normalizeExercises([rawRow()])).toEqual([builtInRow()]);
  });

  test('index-data.js 无 module 时挂全局 EXERCISE_SELECTOR_INDEX(1324 条,无需 fetch)', () => {
    const sandbox = loadAsBrowserScript(INDEX_FILE);
    const data = sandbox.EXERCISE_SELECTOR_INDEX;
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1324);
    expect(data).toEqual(index);
  });
});
