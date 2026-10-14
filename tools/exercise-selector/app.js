/**
 * 全量动作选择器界面(票 03):无构建、无依赖的静态工作台,file:// 直接打开可用。
 * 脚本加载顺序 core.js → index-data.js → app.js;纯逻辑在此导出,Node/Jest 可直接 require。
 */
(function attachExerciseSelectorApp(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.ExerciseSelectorApp = api;
    if (typeof document !== 'undefined' && document.getElementById) api.init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createExerciseSelectorApp(root) {
  'use strict';

  const core = (typeof module === 'object' && module && module.exports)
    ? require('./core')
    : root.ExerciseSelectorCore;
  if (!core) throw new Error('app.js 需要先加载 core.js(顺序 core.js → index-data.js → app.js)');

  /** 上游媒体官方 raw 前缀:用相对路径拼 URL,不复制媒体文件 */
  const MEDIA_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';
  const EXPORT_FILENAME = 'exercise-selection.json';
  /** 上游 exercises.json 当前约 17.4 MB;32 MiB 给版本增长和 JSON 解析留余量,避免主线程无界读入。 */
  const MAX_IMPORT_BYTES = 32 * 1024 * 1024;
  const BODY_PART_LABELS = {
    back: '背部',
    cardio: '有氧',
    chest: '胸部',
    'lower arms': '前臂',
    'lower legs': '小腿',
    neck: '颈部',
    shoulders: '肩部',
    'upper arms': '上臂',
    'upper legs': '大腿',
    waist: '腰腹',
  };

  const GROUP_FIELDS = ['bodyPart', 'equipment'];
  const LOADING_TEXT = '加载中';

  const EQUIPMENT_LABELS = {
    assisted: '辅助器械',
    band: '弹力带',
    barbell: '杠铃',
    'body weight': '自重',
    'bosu ball': 'BOSU 球',
    cable: '绳索',
    dumbbell: '哑铃',
    'elliptical machine': '椭圆机',
    'ez barbell': '曲杆杠铃',
    hammer: '锤式器械',
    kettlebell: '壶铃',
    'leverage machine': '杠杆器械',
    'medicine ball': '药球',
    'olympic barbell': '奥林匹克杠铃',
    'resistance band': '阻力带',
    roller: '滚轮',
    rope: '绳索',
    'skierg machine': '滑雪机',
    'sled machine': '雪橇机',
    'smith machine': '史密斯机',
    'stability ball': '健身球',
    'stationary bike': '动感单车',
    'stepmill machine': '登阶机',
    tire: '轮胎',
    'trap bar': '六角杠',
    'upper body ergometer': '上肢功率车',
    weighted: '负重',
    'wheel roller': '腹肌轮',
  };
  const FAILED_TEXT = 'GIF 不可用';

  const state = {
    items: [],
    keyword: '',
    bodyPart: '',
    equipment: '',
    groupField: 'bodyPart',
    page: 1,
    selection: new Set(),
  };

  function mediaUrl(relativePath) {
    return MEDIA_BASE + String(relativePath || '').replace(/^\/+/, '');
  }

  function toCard(item, selection) {
    return {
      id: item.id,
      name: item.name,
      nameZh: item.nameZh,
      bodyPart: item.bodyPart,
      equipment: item.equipment,
      target: item.target,
      gifUrl: mediaUrl(item.gifPath),
      imageUrl: mediaUrl(item.imagePath),
      selected: selection.has(item.id),
    };
  }

  /**
   * 把当前页按分组字段切分:组标题用筛选后的整组条数,组内只保留当前页条目。
   * 返回的卡片总数恒等于分页 items 数(≤ PAGE_SIZE),不会为整份索引创建媒体元素。
   */
  function buildGroups(filtered, page, field, selection) {
    const pageIds = new Set(((page && page.items) || []).map((item) => item.id));
    const selected = selection instanceof Set ? selection : new Set(selection || []);
    return core.groupExercises(filtered, field)
      .map((group) => ({
        key: group.key,
        count: group.count,
        items: group.items.filter((item) => pageIds.has(item.id)).map((item) => toCard(item, selected)),
      }))
      .filter((group) => group.items.length > 0);
  }

  /** 筛选下拉选项:去重后按字母序 */
  function buildOptions(items, field) {
    const values = new Set();
    items.forEach((item) => {
      if (item[field]) values.add(item[field]);
    });
    return Array.from(values).sort();
  }

  /** 导入文本 → 精简索引;原始上游行用内置索引的英文名映射补齐中文名 */
  function parseDataset(text, referenceItems) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      throw new Error(`JSON 解析失败:${error.message}`);
    }
    if (!Array.isArray(raw)) return core.normalizeExercises(raw);
    const nameZhByName = new Map((referenceItems || []).map((item) => [item.name, item.nameZh]));
    const enriched = raw.map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row) || row.nameZh || row.name_zh) return row;
      return Object.assign({}, row, { nameZh: nameZhByName.get(row.name) || '' });
    });
    return core.normalizeExercises(enriched);
  }

  /** 数据集替换后清理已不存在的选择,返回新集合与清理条数 */
  function pruneSelection(selection, items) {
    const ids = new Set(items.map((item) => item.id));
    const next = new Set();
    let removed = 0;
    selection.forEach((id) => {
      if (ids.has(id)) next.add(id);
      else removed += 1;
    });
    return { selection: next, removed };
  }

  /** 导出文件正文 */
  function serializeExport(payload) {
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  function filteredItems() {
    return core.filterExercises(state.items, {
      keyword: state.keyword,
      bodyPart: state.bodyPart,
      equipment: state.equipment,
    });
  }

  function init() {
    const cardsEl = document.getElementById('cards');
    const pageInfoEl = document.getElementById('page-info');
    const prevButton = document.getElementById('page-prev');
    const nextButton = document.getElementById('page-next');
    const keywordInput = document.getElementById('keyword');
    const bodyPartSelect = document.getElementById('body-part');
    const equipmentSelect = document.getElementById('equipment');
    const selectFilteredButton = document.getElementById('select-filtered');
    const clearButton = document.getElementById('clear-selection');
    const exportButton = document.getElementById('export');
    const importInput = document.getElementById('import-file');
    const selectionListEl = document.getElementById('selection-list');
    const countResultEl = document.getElementById('count-result');
    const countTotalEl = document.getElementById('count-total');
    const countSelectedEl = document.getElementById('count-selected');
    const okEl = document.getElementById('status-ok');
    const errorEl = document.getElementById('status-error');
    const groupInputs = document.querySelectorAll('input[name="group-field"]');

    const builtInItems = Array.isArray(root.EXERCISE_SELECTOR_INDEX) ? root.EXERCISE_SELECTOR_INDEX : [];
    state.items = builtInItems;

    function showOk(message) {
      errorEl.textContent = '';
      okEl.textContent = message;
    }

    function showError(message) {
      okEl.textContent = '';
      errorEl.textContent = message;
    }

    function currentPage() {
      const filtered = filteredItems();
      const page = core.paginate(filtered, state.page);
      state.page = page.page;
      return { filtered, page };
    }

    function renderCounts(filtered, page) {
      countResultEl.textContent = String(filtered.length);
      countTotalEl.textContent = String(state.items.length);
      countSelectedEl.textContent = String(state.selection.size);
      pageInfoEl.textContent = page.pageCount ? `第 ${page.page} / ${page.pageCount} 页` : '无结果';
      prevButton.disabled = !page.hasPrev;
      nextButton.disabled = !page.hasNext;
      exportButton.disabled = state.selection.size === 0;
    }

    function renderSummary() {
      const byId = new Map(state.items.map((item) => [item.id, item]));
      const rows = core.selectedIds(state.selection).map((id) => {
        const item = byId.get(id);
        const row = document.createElement('li');
        const code = document.createElement('span');
        code.className = 'sel-id';
        code.textContent = id;
        const name = document.createElement('span');
        name.className = 'sel-name';
        name.textContent = item ? item.nameZh : '';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'sel-remove';
        remove.textContent = '移除';
        remove.setAttribute('aria-label', `移除 ${id} ${item ? item.nameZh : ''}`.trim());
        remove.addEventListener('click', () => {
          state.selection = core.removeSelection(state.selection, id);
          syncSelection();
        });
        row.append(code, name, remove);
        return row;
      });
      selectionListEl.replaceChildren(...rows);
    }

    function buildCard(card) {
      const label = document.createElement('label');
      label.className = card.selected ? 'card is-selected' : 'card';
      label.dataset.id = card.id;

      const head = document.createElement('span');
      head.className = 'card-head';
      const code = document.createElement('span');
      code.className = 'card-id';
      code.textContent = card.id;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'card-check';
      checkbox.checked = card.selected;
      checkbox.setAttribute('aria-label', `${card.id} ${card.nameZh}`);
      checkbox.addEventListener('change', () => {
        state.selection = core.toggleSelection(state.selection, card.id);
        syncSelection();
      });
      head.append(code, checkbox);

      const thumb = document.createElement('span');
      thumb.className = 'thumb';
      const placeholder = document.createElement('span');
      placeholder.className = 'thumb-state';
      placeholder.textContent = LOADING_TEXT;
      const image = document.createElement('img');
      image.loading = 'lazy';
      image.decoding = 'async';
      image.alt = `${card.nameZh} 动作演示`;
      image.dataset.stage = 'gif';
      image.addEventListener('load', () => {
        placeholder.hidden = true;
      });
      image.addEventListener('error', () => {
        if (image.dataset.stage === 'gif') {
          image.dataset.stage = 'image';
          image.src = card.imageUrl;
          return;
        }
        image.dataset.stage = 'failed';
        image.remove();
        placeholder.classList.add('is-failed');
        placeholder.textContent = FAILED_TEXT;
        placeholder.hidden = false;
      });
      image.src = card.gifUrl;
      thumb.append(placeholder, image);

      const body = document.createElement('span');
      body.className = 'card-body';
      const name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = card.nameZh;
      const nameEn = document.createElement('span');
      nameEn.className = 'card-name-en';
      nameEn.textContent = card.name;
      const meta = document.createElement('span');
      meta.className = 'card-meta';
      meta.textContent = `${card.bodyPart} · ${card.equipment}`;
      const target = document.createElement('span');
      target.className = 'card-target';
      target.textContent = `目标 ${card.target}`;
      body.append(name, nameEn, meta, target);

      label.append(head, thumb, body);
      return label;
    }

    /** 选择变化就地更新已渲染卡片,避免重建 DOM 丢焦点或重发媒体请求 */
    function updateCardStates() {
      cardsEl.querySelectorAll('.card').forEach((node) => {
        const selected = state.selection.has(node.dataset.id);
        node.classList.toggle('is-selected', selected);
        const checkbox = node.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = selected;
      });
    }

    function syncSelection() {
      updateCardStates();
      const { filtered, page } = currentPage();
      renderCounts(filtered, page);
      renderSummary();
    }

    function render() {
      const { filtered, page } = currentPage();
      const groups = buildGroups(filtered, page, state.groupField, state.selection);

      if (!groups.length) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = '没有符合条件的动作';
        cardsEl.replaceChildren(empty);
      } else {
        cardsEl.replaceChildren(...groups.map((group) => {
          const section = document.createElement('section');
          section.className = 'group';
          const title = document.createElement('h2');
          title.className = 'group-title';
          title.textContent = group.key;
          const count = document.createElement('span');
          count.className = 'group-count';
          count.textContent = `${group.count} 条 · 本页 ${group.items.length}`;
          title.append(count);
          const grid = document.createElement('div');
          grid.className = 'grid';
          grid.append(...group.items.map(buildCard));
          section.append(title, grid);
          return section;
        }));
      }

      renderCounts(filtered, page);
      renderSummary();
    }

    function fillSelect(select, values, allLabel) {
      const all = document.createElement('option');
      all.value = '';
      all.textContent = allLabel;
      const options = values.map((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = (select.id === 'body-part' ? BODY_PART_LABELS : EQUIPMENT_LABELS)[value] || value;
        return option;
      });
      select.replaceChildren(all, ...options);
    }

    function fillFilters() {
      fillSelect(bodyPartSelect, buildOptions(state.items, 'bodyPart'), '全部身体部位');
      fillSelect(equipmentSelect, buildOptions(state.items, 'equipment'), '全部器械');
    }

    function markGroupField() {
      groupInputs.forEach((input) => {
        const active = input.value === state.groupField;
        input.checked = active;
        if (input.parentElement) input.parentElement.classList.toggle('is-active', active);
      });
    }

    keywordInput.addEventListener('input', () => {
      state.keyword = keywordInput.value;
      state.page = 1;
      render();
    });

    bodyPartSelect.addEventListener('change', () => {
      state.bodyPart = bodyPartSelect.value;
      state.page = 1;
      render();
    });

    equipmentSelect.addEventListener('change', () => {
      state.equipment = equipmentSelect.value;
      state.page = 1;
      render();
    });

    groupInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked || GROUP_FIELDS.indexOf(input.value) === -1) return;
        state.groupField = input.value;
        markGroupField();
        render();
      });
    });

    prevButton.addEventListener('click', () => {
      state.page -= 1;
      render();
    });

    nextButton.addEventListener('click', () => {
      state.page += 1;
      render();
    });

    selectFilteredButton.addEventListener('click', () => {
      const filtered = filteredItems();
      state.selection = core.selectAll(state.selection, filtered);
      render();
      showOk(`已选择当前筛选结果 ${filtered.length} 条`);
    });

    clearButton.addEventListener('click', () => {
      state.selection = core.clearSelection();
      render();
      showOk('已清空选择');
    });

    exportButton.addEventListener('click', () => {
      if (!state.selection.size) return;
      let payload;
      try {
        payload = core.buildExportPayload(state.selection, state.items);
      } catch (error) {
        showError(error.message);
        return;
      }
      const blob = new Blob([serializeExport(payload)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = EXPORT_FILENAME;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showOk(`已导出 ${payload.selectedCount} 条动作到 ${EXPORT_FILENAME}`);
    });

    importInput.addEventListener('change', () => {
      const file = importInput.files && importInput.files[0];
      importInput.value = '';
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) {
        showError(`导入失败:文件过大(${Math.ceil(file.size / 1024 / 1024)} MB),上限 ${MAX_IMPORT_BYTES / 1024 / 1024} MB`);
        return;
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        try {
          const items = parseDataset(String(reader.result), builtInItems);
          const pruned = pruneSelection(state.selection, items);
          state.items = items;
          state.selection = pruned.selection;
          state.keyword = '';
          state.bodyPart = '';
          state.equipment = '';
          state.page = 1;
          keywordInput.value = '';
          fillFilters();
          render();
          const tail = pruned.removed ? `,已清理 ${pruned.removed} 条不存在的选择` : '';
          showOk(`已导入 ${items.length} 条动作${tail}`);
        } catch (error) {
          showError(`导入失败:${error.message}`);
        }
      });
      reader.addEventListener('error', () => {
        showError('导入失败:读取本地文件出错');
      });
      reader.readAsText(file);
    });

    fillFilters();
    markGroupField();
    if (!state.items.length) {
      showError('内置索引为空:确认脚本顺序 core.js → index-data.js → app.js');
    }
    render();
  }

  return {
    MEDIA_BASE,
    EXPORT_FILENAME,
    MAX_IMPORT_BYTES,
    GROUP_FIELDS,
    LOADING_TEXT,
    FAILED_TEXT,
    mediaUrl,
    buildGroups,
    buildOptions,
    parseDataset,
    pruneSelection,
    serializeExport,
    init,
  };
});
