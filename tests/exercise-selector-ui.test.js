/**
 * 静态选择器界面(票 03)契约:脚本加载顺序、关键控件、媒体只由分页 items 渲染、导入/下载入口、样式约束。
 * 源级 + 纯函数契约,无新依赖;真实 DOM 交互与截图见票内 agent-browser 验收记录。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const core = require('../tools/exercise-selector/core');
const index = require('../tools/exercise-selector/index-data');
const app = require('../tools/exercise-selector/app');

const DIR = path.join(__dirname, '..', 'tools', 'exercise-selector');
const read = (name) => fs.readFileSync(path.join(DIR, name), 'utf8');
const HTML = read('index.html');
const APP = read('app.js');
const CSS = read('styles.css');

const RAW_PREFIX = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';
const PAGE_COUNT = core.paginate(index, 1).pageCount;

/** app.js 里所有字面量 document.getElementById('x') 的目标 id */
function wiredIds() {
  return Array.from(APP.matchAll(/document\.getElementById\(['"]([^'"]+)['"]\)/g), (match) => match[1]);
}

/** 按 <script src> 顺序返回脚本名 */
function scriptSrcs(html) {
  return Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g), (match) => match[1]);
}

/** 在无 module 的 vm 上下文里按浏览器 <script> 顺序加载文件 */
function loadSandbox(files) {
  const sandbox = {};
  vm.createContext(sandbox);
  files.forEach((file) => vm.runInContext(read(file), sandbox, { filename: file }));
  return sandbox;
}

/** 分页卡片(按分组切分后的扁平结果) */
function pageCards(filtered, page, field, selection) {
  return app.buildGroups(filtered, page, field, selection || new Set()).flatMap((group) => group.items);
}

describe('脚本加载顺序与离线可用(file://)', () => {
  test('按 core.js → index-data.js → app.js 顺序用普通 <script> 加载', () => {
    expect(scriptSrcs(HTML)).toEqual(['core.js', 'index-data.js', 'app.js']);
  });

  test('没有 module 脚本、内联脚本、fetch/XHR 或 ESM 依赖', () => {
    expect(HTML).not.toMatch(/type=["']module["']/);
    expect(HTML).not.toMatch(/<script(?![^>]*\bsrc=)/);
    expect(APP).not.toMatch(/\bfetch\s*\(/);
    expect(APP).not.toMatch(/XMLHttpRequest/);
    expect(APP).not.toMatch(/^\s*(import|export)\s/m);
  });

  test('页面本身不预置媒体元素,1324 条索引只在 JS 里按页渲染', () => {
    expect(HTML).not.toMatch(/<img/);
    expect(APP).toMatch(/EXERCISE_SELECTOR_INDEX/);
  });

  test('app.js 引用的每个 getElementById id 都存在于 index.html', () => {
    const ids = wiredIds();
    expect(ids.length).toBeGreaterThanOrEqual(17);
    ids.forEach((id) => {
      expect(HTML).toContain(`id="${id}"`);
    });
  });
});

describe('关键控件与可访问性', () => {
  const REQUIRED_IDS = [
    'cards',
    'page-info',
    'page-prev',
    'page-next',
    'keyword',
    'body-part',
    'equipment',
    'select-filtered',
    'clear-selection',
    'export',
    'import-file',
    'selection-list',
    'count-result',
    'count-total',
    'count-selected',
    'status-ok',
    'status-error',
  ];

  test('筛选、浏览、分页、摘要、计数控件都在页面里', () => {
    REQUIRED_IDS.forEach((id) => {
      expect(HTML).toContain(`id="${id}"`);
    });
    REQUIRED_IDS.forEach((id) => {
      expect(wiredIds()).toContain(id);
    });
  });

  test('分组切换是原生 radio(按身体部位/按器械)', () => {
    expect(HTML).toMatch(/<input type="radio" name="group-field" value="bodyPart"/);
    expect(HTML).toMatch(/<input type="radio" name="group-field" value="equipment"/);
    expect(APP).toMatch(/input\[name="group-field"\]/);
    expect(app.GROUP_FIELDS).toEqual(['bodyPart', 'equipment']);
  });

  test('筛选控件用原生 input/select 且有 label', () => {
    expect(HTML).toMatch(/<input type="search" id="keyword"/);
    expect(HTML).toMatch(/<select id="body-part">/);
    expect(HTML).toMatch(/<select id="equipment">/);
    expect(HTML).toMatch(/<label for="keyword">/);
    expect(HTML).toMatch(/<label for="body-part">/);
    expect(HTML).toMatch(/<label for="equipment">/);
  });

  test('成功与错误反馈分区,错误用 role=alert + assertive', () => {
    expect(HTML).toMatch(/id="status-ok"[^>]*role="status"[^>]*aria-live="polite"/);
    expect(HTML).toMatch(/id="status-error"[^>]*role="alert"[^>]*aria-live="assertive"/);
    expect(APP).toMatch(/errorEl\.textContent = ''/);
    expect(APP).toMatch(/okEl\.textContent = ''/);
  });

  test('计数展示结果/总数/已选,并显示分组标题与页码', () => {
    expect(HTML).toMatch(/结果 <strong id="count-result"/);
    expect(HTML).toMatch(/总数 <strong id="count-total"/);
    expect(HTML).toMatch(/已选 <strong id="count-selected"/);
    expect(APP).toMatch(/group-title/);
    expect(APP).toMatch(/第 \$\{page\.page\} \/ \$\{page\.pageCount\} 页/);
  });
});

describe('媒体只由分页 items 渲染', () => {
  test(`每页卡片数不超过 ${core.PAGE_SIZE} 条,${PAGE_COUNT} 页合起来正好 ${index.length} 条`, () => {
    let total = 0;
    for (let pageNumber = 1; pageNumber <= PAGE_COUNT; pageNumber += 1) {
      const page = core.paginate(index, pageNumber);
      const cards = pageCards(index, page, 'bodyPart');
      expect(cards.length).toBe(page.items.length);
      expect(cards.length).toBeLessThanOrEqual(core.PAGE_SIZE);
      total += cards.length;
    }
    expect(total).toBe(index.length);
    expect(total).toBe(1324);
  });

  test('当前页每条动作在分组结果里恰好出现一次,组标题计数不小于本页条数', () => {
    const page = core.paginate(index, 5);
    const groups = app.buildGroups(index, page, 'equipment', new Set());
    const ids = groups.flatMap((group) => group.items.map((card) => card.id));
    expect(ids.slice().sort()).toEqual(page.items.map((item) => item.id).slice().sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(groups.length).toBeGreaterThan(1);
    groups.forEach((group) => {
      expect(group.count).toBeGreaterThanOrEqual(group.items.length);
      expect(group.key).not.toBe('');
    });
  });

  test('筛选后仍只渲染当前页条目,组标题计数基于筛选结果', () => {
    const filtered = core.filterExercises(index, { bodyPart: 'chest' });
    const page = core.paginate(filtered, 1);
    const groups = app.buildGroups(filtered, page, 'equipment', new Set());
    expect(page.items).toHaveLength(48);
    expect(groups.flatMap((group) => group.items)).toHaveLength(48);
    groups.forEach((group) => {
      expect(group.count).toBeLessThanOrEqual(filtered.length);
      expect(group.items.length).toBeLessThanOrEqual(group.count);
    });
  });

  test('关键词/部位/器械组合筛选后卡片数等于结果数(上限 48)', () => {
    const filtered = core.filterExercises(index, { keyword: 'press', bodyPart: 'chest', equipment: 'barbell' });
    expect(filtered.length).toBeGreaterThan(0);
    const page = core.paginate(filtered, 1);
    expect(pageCards(filtered, page, 'bodyPart').length).toBe(Math.min(filtered.length, 48));
  });

  test('媒体 URL 用官方 GitHub raw 前缀拼相对路径,不复制媒体文件', () => {
    expect(app.MEDIA_BASE).toBe(RAW_PREFIX);
    const cards = pageCards(index, core.paginate(index, 1), 'bodyPart');
    const source = index.find((item) => item.id === cards[0].id);
    expect(cards[0].gifUrl).toBe(`${RAW_PREFIX}${source.gifPath}`);
    expect(cards[0].imageUrl).toBe(`${RAW_PREFIX}${source.imagePath}`);
    cards.forEach((card) => {
      expect(card.gifUrl).toMatch(/^https:\/\/raw\.githubusercontent\.com\/hasaneyldrm\/exercises-dataset\/main\/videos\/[0-9]{4}-.+\.gif$/);
      expect(card.imageUrl).toMatch(/^https:\/\/raw\.githubusercontent\.com\/hasaneyldrm\/exercises-dataset\/main\/images\/[0-9]{4}-.+\.jpg$/);
    });
  });

  test('卡片模型带 4 位 ID、英文名、部位、器械与目标肌群', () => {
    const page = core.paginate(index, 1);
    const byId = new Map(page.items.map((item) => [item.id, item]));
    pageCards(index, page, 'bodyPart').forEach((card) => {
      const source = byId.get(card.id);
      expect(source).toBeDefined();
      expect(card.id).toMatch(/^[0-9]{4}$/);
      expect(card.name).not.toBe('');
      expect(card.nameZh).toMatch(/[\u4e00-\u9fff]/);
      expect(card.id).toBe(source.id);
      expect(card.name).toBe(source.name);
      expect(card.nameZh).toBe(source.nameZh);
      expect(card.bodyPart).toBe(source.bodyPart);
      expect(card.equipment).toBe(source.equipment);
      expect(card.target).toBe(source.target);
    });
  });

  test('卡片与已选摘要使用中文主名,英文名保留为副标题', () => {
    expect(APP).toMatch(/name\.textContent = card\.nameZh/);
    expect(APP).toMatch(/nameEn\.textContent = card\.name/);
    expect(APP).toMatch(/name\.textContent = item \? item\.nameZh/);
    expect(APP).toMatch(/image\.alt = `\$\{card\.nameZh\} 动作演示`/);
  });

  test('选择态由传入集合决定,跨分页/分组保持而不被重置', () => {
    const selection = core.selectAll(core.createSelection(), core.paginate(index, 3).items);
    const onPage3 = pageCards(index, core.paginate(index, 3), 'bodyPart', selection);
    const onPage4 = pageCards(index, core.paginate(index, 4), 'equipment', selection);
    expect(onPage3.every((card) => card.selected)).toBe(true);
    expect(onPage4.some((card) => card.selected)).toBe(false);
    expect(core.selectedIds(selection)).toHaveLength(48);
  });
});

describe('导入与导出入口', () => {
  test('导出按钮生成 exercise-selection.json 并通过 Blob 下载', () => {
    expect(app.EXPORT_FILENAME).toBe('exercise-selection.json');
    expect(APP).toMatch(/core\.buildExportPayload\(/);
    expect(APP).toMatch(/new Blob\(/);
    expect(APP).toMatch(/URL\.createObjectURL\(/);
    expect(APP).toMatch(/URL\.revokeObjectURL\(/);
    expect(APP).toMatch(/link\.download = EXPORT_FILENAME/);
    expect(APP).toMatch(/link\.click\(\)/);
  });

  test('导出正文符合 spec schema 且 selected 按 ID 排序', () => {
    const selection = core.createSelection(['0025', '0001']);
    const text = app.serializeExport(core.buildExportPayload(selection, index));
    expect(text.endsWith('\n')).toBe(true);
    const payload = JSON.parse(text);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.source).toBe('hasaneyldrm/exercises-dataset');
    expect(payload.selectedCount).toBe(2);
    expect(payload.selected.map((item) => item.id)).toEqual(['0001', '0025']);
    expect(Object.keys(payload.selected[0])).toEqual(core.EXPORT_FIELDS);
  });

  test('无选择时导出按钮禁用', () => {
    expect(HTML).toMatch(/id="export"[^>]*disabled/);
    expect(APP).toMatch(/exportButton\.disabled = state\.selection\.size === 0/);
  });

  test('导入入口是本地 file input,走 FileReader 与 core.normalizeExercises,不上传', () => {
    expect(HTML).toMatch(/<input type="file" id="import-file" accept="\.json,application\/json">/);
    expect(APP).toMatch(/new FileReader\(/);
    expect(APP).toMatch(/reader\.readAsText\(file\)/);
    expect(APP).toMatch(/core\.normalizeExercises\(/);
    expect(APP).toMatch(/file\.size > MAX_IMPORT_BYTES/);
    expect(APP).toMatch(/导入失败:文件过大/);
    expect(app.MAX_IMPORT_BYTES).toBe(32 * 1024 * 1024);
    expect(APP).not.toMatch(/\bfetch\s*\(/);
    expect(APP).not.toMatch(/FormData/);
  });

  test('parseDataset 成功返回规范化索引,语法与字段错误给出可读错误', () => {
    const raw = JSON.stringify([{
      id: '0002',
      name: 'barbell bench press',
      name_zh: '杠铃卧推',
      category: 'chest',
      body_part: 'chest',
      equipment: 'barbell',
      target: 'pectorals',
      image: 'images/0002-abc.jpg',
      gif_url: 'videos/0002-abc.gif',
    }]);
    expect(app.parseDataset(raw)).toEqual([{
      id: '0002',
      name: 'barbell bench press',
      nameZh: '杠铃卧推',
      category: 'chest',
      bodyPart: 'chest',
      equipment: 'barbell',
      target: 'pectorals',
      imagePath: 'images/0002-abc.jpg',
      gifPath: 'videos/0002-abc.gif',
    }]);
    expect(() => app.parseDataset('{oops')).toThrow(/JSON 解析失败/);
    expect(() => app.parseDataset('{"exercises":[]}')).toThrow(/数据集必须是数组/);
    expect(() => app.parseDataset('[{"id":"0001"}]')).toThrow(/缺少必需字段/);
    expect(() => app.parseDataset('[{"id":"0001"},{"id":"0001"}]')).toThrow(/重复/);
  });

  test('原始 exercises.json 导入按内置英文名映射补中文,未知名称拒绝', () => {
    const row = {
      id: '0002',
      name: 'barbell bench press',
      category: 'chest',
      body_part: 'chest',
      equipment: 'barbell',
      target: 'pectorals',
      image: 'images/0002-abc.jpg',
      gif_url: 'videos/0002-abc.gif',
    };
    expect(app.parseDataset(JSON.stringify([row]), index)[0].nameZh).toBe('杠铃卧推');
    expect(() => app.parseDataset(JSON.stringify([{ ...row, name: 'brand new exercise' }]), index))
      .toThrow(/缺少必需字段 nameZh/);
  });

  test('导入成功后清理已不存在的选择并报出清理条数', () => {
    const pruned = app.pruneSelection(core.createSelection(['0001', '9999']), index);
    expect(core.selectedIds(pruned.selection)).toEqual(['0001']);
    expect(pruned.removed).toBe(1);
    const kept = app.pruneSelection(core.createSelection(['0001']), index);
    expect(kept.removed).toBe(0);
  });

  test('导入替换数据集后会重建筛选选项并回到第一页', () => {
    expect(APP).toMatch(/state\.items = items/);
    expect(APP).toMatch(/fillFilters\(\)/);
    expect(APP).toMatch(/buildOptions\(state\.items, 'bodyPart'\)/);
    expect(APP).toMatch(/buildOptions\(state\.items, 'equipment'\)/);
  });
});

describe('加载状态与媒体失败兜底', () => {
  test('图片使用原生 lazy 加载并带替代文本', () => {
    expect(APP).toMatch(/image\.loading = 'lazy'/);
    expect(APP).toMatch(/image\.alt = /);
  });

  test('GIF 失败先退到 JPEG,再失败显示文字占位且不再重试', () => {
    expect(app.LOADING_TEXT).toBe('加载中');
    expect(app.FAILED_TEXT).toBe('GIF 不可用');
    expect(APP).toMatch(/image\.dataset\.stage = 'gif'/);
    expect(APP).toMatch(/if \(image\.dataset\.stage === 'gif'\)/);
    expect(APP).toMatch(/image\.dataset\.stage = 'image'/);
    expect(APP).toMatch(/image\.dataset\.stage = 'failed'/);
    expect(APP).toMatch(/image\.remove\(\)/);
    expect(APP).toMatch(/image\.addEventListener\('error'/);
    expect(APP).toMatch(/image\.addEventListener\('load'/);
    expect(APP).toMatch(/image\.src = card\.imageUrl/);
  });

  test('显示 Gym visual 署名与本地策展用途,不含使用教程文案', () => {
    expect(HTML).toMatch(/Gym visual/);
    expect(HTML).toMatch(/class="local-use">仅用于本地策展<\/span>/);
    expect(CSS).toMatch(/\.local-use\s*\{[\s\S]*white-space:\s*nowrap/);
    expect(HTML).not.toMatch(/使用说明|使用教程|教程|使用步骤|帮助文档/);
  });
});

describe('样式约束(高密度工作台)', () => {
  const rootVars = {};
  Array.from(CSS.matchAll(/(--[a-z-]+):\s*([^;]+);/g)).forEach((match) => {
    rootVars[match[1]] = match[2].trim();
  });

  function resolveRadius(value) {
    return value.replace(/var\((--[a-z-]+)\)/g, (whole, name) => rootVars[name] || whole).trim();
  }

  test('不用渐变或装饰性图形', () => {
    expect(CSS).not.toMatch(/gradient\(/);
    expect(CSS).not.toMatch(/border-image/);
  });

  test('圆角不超过 8px', () => {
    const values = Array.from(CSS.matchAll(/border-radius:\s*([^;]+);/g), (match) => resolveRadius(match[1]));
    expect(values.length).toBeGreaterThan(0);
    values.forEach((value) => {
      expect(value).not.toMatch(/%|em|vw/);
      value.split(/\s+/).forEach((part) => {
        const pixels = Number(part.replace('px', ''));
        expect(Number.isFinite(pixels)).toBe(true);
        expect(pixels).toBeLessThanOrEqual(8);
      });
    });
  });

  test('浅灰工作台底色 + 墨绿主文字 + 琥珀选择态', () => {
    expect(CSS).toMatch(/--bg:\s*#[0-9a-f]{6};/i);
    expect(CSS).toMatch(/--ink:\s*#[0-9a-f]{6};/i);
    expect(CSS).toMatch(/--accent:\s*#[0-9a-f]{6};/i);
    expect(CSS).toMatch(/background:\s*var\(--bg\)/);
    expect(CSS).toMatch(/color:\s*var\(--ink\)/);
    expect(CSS).toMatch(/\.card\.is-selected\s*\{[^}]*border-color:\s*var\(--accent\)/);
  });

  test('可见焦点与原生控件强调色', () => {
    expect(CSS).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accent\)/);
    expect(CSS).toMatch(/accent-color:\s*var\(--accent\)/);
  });

  test('字体不缩放:没有 clamp/vw 字号或 transform scale', () => {
    expect(CSS).not.toMatch(/clamp\(/);
    expect(CSS).not.toMatch(/font-size:[^;]*vw/);
    expect(CSS).not.toMatch(/transform:\s*scale/);
  });

  test('桌面三栏(筛选 + 浏览 + 摘要),窄屏单列', () => {
    expect(CSS).toMatch(/grid-template-columns:\s*216px minmax\(0, 1fr\) 264px;/);
    expect(CSS).toMatch(/@media \(max-width: 900px\)/);
    expect(CSS).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(CSS).toMatch(/\.browser\s*\{[^}]*min-width:\s*0/);
  });
});

describe('浏览器 <script> 加载(core → index-data → app)', () => {
  test('按脚本顺序加载后挂全局,并直接用内置索引生成当前页卡片', () => {
    const sandbox = loadSandbox(['core.js', 'index-data.js', 'app.js']);
    const api = sandbox.ExerciseSelectorApp;
    expect(typeof api).toBe('object');
    expect(sandbox.EXERCISE_SELECTOR_INDEX).toHaveLength(1324);

    const page = sandbox.ExerciseSelectorCore.paginate(sandbox.EXERCISE_SELECTOR_INDEX, 1);
    const cards = api.buildGroups(sandbox.EXERCISE_SELECTOR_INDEX, page, 'bodyPart', new Set())
      .flatMap((group) => group.items);
    expect(cards).toHaveLength(48);
    expect(cards[0].gifUrl.startsWith(RAW_PREFIX)).toBe(true);
    expect(api.MEDIA_BASE).toBe(RAW_PREFIX);
  });

  test('缺少 core.js 时抛可读错误,不静默降级', () => {
    expect(() => loadSandbox(['index-data.js', 'app.js'])).toThrow(/core\.js/);
  });
});
