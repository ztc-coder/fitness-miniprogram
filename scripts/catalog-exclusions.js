/**
 * 锁定媒体排除清单:生成时确认源 JPEG/GIF 或中文要领缺失的动作 id。
 * 当前上游快照 7455efae 中全部非 cardio 媒体完整，清单为空。
 * 新增排除项必须记录原因，并由生成器对照源文件验证。
 */
const EXCLUSIONS = {};

function isExcluded(id) {
  return Object.prototype.hasOwnProperty.call(EXCLUSIONS, String(id));
}

function getExclusion(id) {
  return EXCLUSIONS[String(id)] || null;
}

module.exports = { EXCLUSIONS, isExcluded, getExclusion };
