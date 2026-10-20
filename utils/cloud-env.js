/**
 * 部署配置的纯校验逻辑：不读写 wx、不发网络请求，页面/云服务/脚本共用。
 * 只做字符串比对，便于单测，也能在 Node 脚本里复用同一套判断。
 */
const LEGACY = {
  appId: 'wxa884033ad71b4514',
  envId: 'cloud1-d2ga0mned4bbf9b29',
  mediaRootPrefix: 'cloud://cloud1-d2ga0mned4bbf9b29.',
};
const APP_ID_PATTERN = /^wx[0-9a-f]{16}$/;

function text(value) { return typeof value === 'string' ? value.trim() : ''; }

function isLegacyAppId(value) { return text(value) === LEGACY.appId; }
function isLegacyEnvId(value) { return text(value) === LEGACY.envId; }
function isLegacyMediaRoot(value) { return text(value).indexOf(LEGACY.mediaRootPrefix) === 0; }
function isTouristAppId(value) { return text(value) === 'touristappid'; }
function isAppIdLike(value) { return APP_ID_PATTERN.test(text(value)); }

/**
 * 云能力阻断项：返回空数组才允许 wx.cloud.init 与产品同意启用云。
 * detected.appId 来自 wx.getAccountInfoSync().miniProgram.appId；Node 脚本里用 project.config.json 的 appid。
 */
function getCloudIssues(config, detected) {
  const issues = [];
  const envId = text(config && config.envId);
  const appId = text(config && config.appId);
  const seenAppId = text(detected && detected.appId);
  if (!envId) {
    issues.push('envId：未配置自己的云开发环境 ID（config/cloud-env.js）');
  } else if (isLegacyEnvId(envId)) {
    issues.push('envId：仍是原运营者环境 ' + LEGACY.envId + '，会连到他人云环境');
  }
  if (isLegacyAppId(appId)) issues.push('appId：配置里仍是原运营者 AppID ' + LEGACY.appId);
  if (isLegacyAppId(seenAppId)) {
    issues.push('appId：当前编译的小程序仍是原运营者 AppID ' + LEGACY.appId);
  } else if (isTouristAppId(seenAppId)) {
    issues.push('appId：当前是游客模式（touristappid），云能力不可用');
  }
  return issues;
}

/**
 * 媒体根提示：不阻断本地训练，但指向原运营者存储桶会误连他人存储，按未配置处理。
 * 返回的是提示文案，是否阻断由发布检查脚本决定。
 */
function getMediaNotices(config) {
  const mediaRoot = text(config && config.mediaRoot);
  if (!mediaRoot) return ['mediaRoot：未配置，动作媒体会降级为占位（阶段一可接受）'];
  if (isLegacyMediaRoot(mediaRoot)) return ['mediaRoot：仍是原运营者存储桶，已按未配置处理，不会加载他人媒体'];
  return [];
}

module.exports = {
  LEGACY,
  getCloudIssues,
  getMediaNotices,
  isAppIdLike,
  isLegacyAppId,
  isLegacyEnvId,
  isLegacyMediaRoot,
  isTouristAppId,
  text,
};
