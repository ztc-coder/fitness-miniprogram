/**
 * 展示层格式化工具(纯函数)
 */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 2026年07月21日 · 周二 */
function formatDateLine(timestamp) {
  const d = new Date(timestamp || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}年${m}月${day}日 · 周${WEEKDAYS[d.getDay()]}`;
}

/** { date: '21', month: '07月' } */
function formatDateParts(timestamp) {
  const d = new Date(timestamp);
  return {
    date: String(d.getDate()).padStart(2, '0'),
    month: `${String(d.getMonth() + 1).padStart(2, '0')}月`,
  };
}

/** 12345 → "12,345" */
function formatNumber(n) {
  const num = Math.round(Number(n) || 0);
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 秒 → "46m" / "1h12m" */
function formatDuration(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}

/** HH:MM */
function formatTime(timestamp) {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

module.exports = {
  formatDateLine,
  formatDateParts,
  formatNumber,
  formatDuration,
  formatTime,
};
