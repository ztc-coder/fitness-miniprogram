/**
 * 动作库分页与缩略图预热的纯函数。
 * 页面保留完整匹配集，渲染层只展开当前页；预热窗口始终限制为当前页与下一页。
 */
const PAGE_SIZE = 24;
const PREHEAT_PAGE_COUNT = 2;

function uniqueItems(items) {
  const seen = Object.create(null);
  return (Array.isArray(items) ? items : []).filter((item, index) => {
    const key = item && item.id ? String(item.id) : `__index_${index}`;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function normalizePage(page) {
  const value = Number(page);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
}

/**
 * 返回从首项开始、截至指定页的已渲染动作。
 * resultCount 永远是完整匹配集的数量，不受当前页影响。
 */
function pageWindow(items, page = 1, pageSize = PAGE_SIZE) {
  const list = uniqueItems(items);
  const size = Number(pageSize) > 0 ? Math.floor(Number(pageSize)) : PAGE_SIZE;
  const currentPage = normalizePage(page);
  const end = Math.min(list.length, currentPage * size);
  return {
    items: list.slice(0, end),
    resultCount: list.length,
    page: currentPage,
    hasMore: end < list.length,
  };
}

/**
 * 预热当前页与下一页，最多 pageSize * 2 条，且只返回列表动作对象。
 */
function preheatWindow(items, page = 1, pageSize = PAGE_SIZE) {
  const list = uniqueItems(items);
  const size = Number(pageSize) > 0 ? Math.floor(Number(pageSize)) : PAGE_SIZE;
  const currentPage = normalizePage(page);
  const start = Math.min(list.length, (currentPage - 1) * size);
  const end = Math.min(list.length, start + PREHEAT_PAGE_COUNT * size);
  return list.slice(start, end);
}

module.exports = {
  PAGE_SIZE,
  PREHEAT_PAGE_COUNT,
  uniqueItems,
  pageWindow,
  preheatWindow,
};
