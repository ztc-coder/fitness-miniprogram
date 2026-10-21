/**
 * 部署配置的纯校验逻辑：不读写 wx、不发网络请求，页面/云服务/脚本共用。
 * 只做字符串比对，便于单测，也能在 Node 脚本里复用同一套判断。
 *
 * 定位：个人项目（自己开发、自己发布，供自己与其他使用者使用），不面向"他人 clone 后改造部署"。
 * 因此这里没有"谁的 AppID / 谁的云环境"之分——填了本项目的值就放行，只有"没填"才禁云。
 */
const APP_ID_PATTERN = /^wx[0-9a-f]{16}$/;
const TOURIST_APP_ID = 'touristappid';

function text(value) { return typeof value === 'string' ? value.trim() : ''; }

function isTouristAppId(value) { return text(value) === TOURIST_APP_ID; }
function isAppIdLike(value) { return APP_ID_PATTERN.test(text(value)); }

/**
 * 云能力阻断项：返回空数组才允许 wx.cloud.init 与产品同意启用云。
 * detected.appId 来自 wx.getAccountInfoSync().miniProgram.appId；Node 脚本里用 project.config.json 的 appid。
 */
function getCloudIssues(config, detected) {
  const issues = [];
  const envId = text(config && config.envId);
  const seenAppId = text(detected && detected.appId);
  if (!envId) {
    issues.push('envId：未配置云开发环境 ID（config/cloud-env.js）');
  }
  if (isTouristAppId(seenAppId)) {
    issues.push('appId：当前是游客模式（touristappid），云能力不可用');
  }
  return issues;
}

/**
 * 媒体根提示：未配置时媒体降级为占位，不影响本地训练，也不阻断启动。
 * 返回的是提示文案，是否阻断由发布检查脚本决定。
 */
function getMediaNotices(config) {
  const mediaRoot = text(config && config.mediaRoot);
  if (!mediaRoot) return ['mediaRoot：未配置，动作媒体会降级为占位'];
  return [];
}

module.exports = {
  getCloudIssues,
  getMediaNotices,
  isAppIdLike,
  isTouristAppId,
  text,
};
