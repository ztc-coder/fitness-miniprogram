/**
 * 全量动作选择器核心(票 02):导入规范化、AND 筛选、双分组、分页、选择集合、导出 payload。
 * 无 DOM、无打包依赖:浏览器用普通 <script> 加载后读全局 ExerciseSelectorCore,Node/Jest 直接 require。
 */
(function attachExerciseSelectorCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.ExerciseSelectorCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createExerciseSelectorCore() {
  'use strict';

  /** 内置精简索引的字段与顺序 */
  const INDEX_FIELDS = ['id', 'name', 'nameZh', 'category', 'bodyPart', 'equipment', 'target', 'imagePath', 'gifPath'];

  /** 导出 payload 的 selected 条目字段(中英文名都保留,不含 category) */
  const EXPORT_FIELDS = ['id', 'name', 'nameZh', 'bodyPart', 'equipment', 'target', 'imagePath', 'gifPath'];

  /** 必需文本字段 */
  const TEXT_FIELDS = ['name', 'nameZh', 'category', 'bodyPart', 'equipment', 'target'];

  /** 必需媒体路径字段 */
  const MEDIA_FIELDS = ['imagePath', 'gifPath'];

  /** 关键词命中的字段 */
  const KEYWORD_FIELDS = ['id', 'name', 'nameZh', 'target', 'bodyPart', 'equipment'];

  /** 上游 snake_case 字段名 → 内置 camelCase 字段名 */
  const FIELD_SOURCES = {
    nameZh: ['nameZh', 'name_zh'],
    bodyPart: ['bodyPart', 'body_part'],
    imagePath: ['imagePath', 'image'],
    gifPath: ['gifPath', 'gif_url'],
  };

  const PAGE_SIZE = 48;
  const SCHEMA_VERSION = 1;
  const SOURCE = 'hasaneyldrm/exercises-dataset';

  /** 错误信息最多列出多少条问题,其余只报数量 */
  const MAX_REPORTED_ISSUES = 20;

  class ExerciseSelectorError extends Error {
    constructor(message, issues) {
      super(message);
      this.name = 'ExerciseSelectorError';
      this.issues = issues || [];
    }
  }

  function describeType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
  }

  function readField(row, field) {
    const sources = FIELD_SOURCES[field] || [field];
    for (let i = 0; i < sources.length; i += 1) {
      const value = row[sources[i]];
      if (value !== undefined && value !== null) return value;
    }
    return undefined;
  }

  function compareById(a, b) {
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  }

  function assertList(list, label) {
    if (!Array.isArray(list)) {
      throw new ExerciseSelectorError(`${label}必须是数组,收到 ${describeType(list)}`);
    }
  }

  /**
   * 把原始上游 snake_case 对象或内置 camelCase 对象规范化为精简索引条目。
   * 顶层非数组、id 非 4 位、id 重复、必需字段缺失都会报错;一次报出全部问题,不静默丢行。
   */
  function normalizeExercises(input) {
    if (!Array.isArray(input)) {
      throw new ExerciseSelectorError(`数据集必须是数组,收到 ${describeType(input)}`);
    }

    const issues = [];
    const firstSeenAt = {};
    const normalized = [];

    input.forEach((row, index) => {
      const position = `第 ${index + 1} 条`;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        issues.push(`${position}: 必须是对象,收到 ${describeType(row)}`);
        return;
      }

      const id = row.id;
      if (typeof id !== 'string' || !/^[0-9]{4}$/.test(id)) {
        issues.push(`${position}: id 必须是 4 位数字字符串,收到 ${JSON.stringify(id)}`);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(firstSeenAt, id)) {
        issues.push(`${position}: id ${id} 与第 ${firstSeenAt[id]} 条重复`);
        return;
      }
      firstSeenAt[id] = index + 1;

      const missing = TEXT_FIELDS.concat(MEDIA_FIELDS).filter((field) => !isNonEmptyString(readField(row, field)));
      if (missing.length) {
        issues.push(`${position} (id ${id}): 缺少必需字段 ${missing.join('、')}`);
        return;
      }

      const item = { id };
      INDEX_FIELDS.slice(1).forEach((field) => {
        item[field] = String(readField(row, field)).trim();
      });
      normalized.push(item);
    });

    if (issues.length) {
      const reported = issues.slice(0, MAX_REPORTED_ISSUES);
      const rest = issues.length - reported.length;
      const tail = rest > 0 ? `\n…还有 ${rest} 条问题` : '';
      throw new ExerciseSelectorError(
        `数据集校验失败(${issues.length} 条问题):\n${reported.join('\n')}${tail}`,
        issues,
      );
    }

    return normalized.sort(compareById);
  }

  function normalizeKeyword(value) {
    return String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  }

  /** 关键词(中英文名/id/target/bodyPart/equipment,大小写不敏感)+ bodyPart + equipment,三者 AND */
  function filterExercises(list, filters) {
    assertList(list, '动作列表');
    const options = filters || {};
    const keyword = normalizeKeyword(options.keyword);
    const bodyPart = options.bodyPart || '';
    const equipment = options.equipment || '';

    return list.filter((item) => {
      if (bodyPart && item.bodyPart !== bodyPart) return false;
      if (equipment && item.equipment !== equipment) return false;
      if (!keyword) return true;
      return KEYWORD_FIELDS.some((field) => normalizeKeyword(item[field]).indexOf(keyword) !== -1);
    });
  }

  /** 按 bodyPart / equipment 分组:组顺序为首次出现顺序,组内保持输入顺序 */
  function groupExercises(list, field) {
    assertList(list, '动作列表');
    if (field !== 'bodyPart' && field !== 'equipment') {
      throw new ExerciseSelectorError(`分组字段只能是 bodyPart 或 equipment,收到 ${JSON.stringify(field)}`);
    }

    const groups = new Map();
    list.forEach((item) => {
      const key = String(item[field] === undefined || item[field] === null ? '' : item[field]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    return Array.from(groups, (entry) => ({ key: entry[0], count: entry[1].length, items: entry[1] }));
  }

  /** 每页 48 条的窗口;越界页码收敛到有效范围,空结果页码为 1、页数为 0 */
  function paginate(list, page, pageSize) {
    assertList(list, '动作列表');
    const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : PAGE_SIZE;
    const total = list.length;
    const pageCount = Math.ceil(total / size);
    const requested = Number.isFinite(page) ? Math.trunc(page) : 1;
    const current = Math.min(Math.max(requested, 1), Math.max(pageCount, 1));
    const start = (current - 1) * size;

    return {
      items: list.slice(start, start + size),
      page: current,
      pageCount,
      pageSize: size,
      total,
      hasPrev: current > 1,
      hasNext: current < pageCount,
    };
  }

  function toSelection(selection) {
    if (selection instanceof Set) return selection;
    if (Array.isArray(selection)) return new Set(selection);
    throw new ExerciseSelectorError(`选择集合必须是 Set 或数组,收到 ${describeType(selection)}`);
  }

  function createSelection(ids) {
    return new Set(ids || []);
  }

  function isSelected(selection, id) {
    return toSelection(selection).has(id);
  }

  function toggleSelection(selection, id) {
    const next = new Set(toSelection(selection));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  /** 选择当前筛选结果(或任意动作列表)里的全部 id */
  function selectAll(selection, items) {
    assertList(items, '动作列表');
    const next = new Set(toSelection(selection));
    items.forEach((item) => next.add(item.id));
    return next;
  }

  function removeSelection(selection, id) {
    const next = new Set(toSelection(selection));
    next.delete(id);
    return next;
  }

  function clearSelection() {
    return new Set();
  }

  /** 已选 id,按 4 位 id 升序 */
  function selectedIds(selection) {
    return Array.from(toSelection(selection)).sort();
  }

  /** 导出 payload:schemaVersion 1,selected 按 id 排序且只含 spec 字段 */
  function buildExportPayload(selection, exercises) {
    assertList(exercises, '动作列表');
    const ids = selectedIds(selection);
    const byId = new Map(exercises.map((item) => [item.id, item]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) {
      throw new ExerciseSelectorError(`选中的动作不在当前索引中: ${missing.join('、')}`);
    }

    const selected = ids.map((id) => {
      const item = byId.get(id);
      const entry = {};
      EXPORT_FIELDS.forEach((field) => {
        entry[field] = item[field];
      });
      return entry;
    });

    return {
      schemaVersion: SCHEMA_VERSION,
      source: SOURCE,
      selectedCount: selected.length,
      selected,
    };
  }

  return {
    INDEX_FIELDS,
    EXPORT_FIELDS,
    PAGE_SIZE,
    SCHEMA_VERSION,
    SOURCE,
    ExerciseSelectorError,
    normalizeExercises,
    filterExercises,
    groupExercises,
    paginate,
    createSelection,
    isSelected,
    toggleSelection,
    selectAll,
    removeSelection,
    clearSelection,
    selectedIds,
    buildExportPayload,
  };
});
