/**
 * CloudBase 媒体根(fileID / HTTPS 前缀)——单一配置点。
 *
 * scripts/upload-exercise-media.js 把示意图与分解 GIF 传到云存储
 * `exercises/images/`、`exercises/videos/` 前缀下;目录里的 imagePath / gifPath
 * (如 `exercises/images/0025-EIeI8Vf.jpg`)拼上 MEDIA_ROOT 即为可加载地址。
 *
 * MEDIA_ROOT 是云存储桶根,不要再带 /exercises(目录路径里已经有):
 *  - cloud:// fileID 前缀(推荐):
 *      'cloud://<env-id>.<bucket-suffix>'
 *  - HTTPS:
 *      'https://<your-domain>'
 *
 * 部署配置在 config/cloud-env.js 的 mediaRoot(默认空 = 未配置);这里派生 MEDIA_ROOT。
 * 未配置时媒体地址解析为空串,界面逐级降级为占位,不影响训练流程。
 * 仍指向原运营者存储桶的值按未配置处理,避免误连他人存储。
 *
 * ⚠️ 媒体版权归 Gym visual(https://gymvisual.com/),个人自用,
 * 禁止热链 GitHub / jsDelivr 公开再分发。
 */
const cloudEnv = require('../config/cloud-env');
const { isLegacyMediaRoot } = require('../utils/cloud-env');

const configuredRoot = typeof cloudEnv.mediaRoot === 'string' ? cloudEnv.mediaRoot.trim() : '';
const MEDIA_ROOT = isLegacyMediaRoot(configuredRoot) ? '' : configuredRoot;

/**
 * 拼接媒体地址;前缀未配置或路径为空时返回空串(调用方据此降级 glyph)。
 * root 参数仅供测试注入,业务代码一律用默认 MEDIA_ROOT。
 */
function resolveAsset(path, root = MEDIA_ROOT) {
  if (!root || !path) return '';
  return root.replace(/\/+$/, '') + '/' + String(path).replace(/^\/+/, '');
}

function resolveMedia(path, root = MEDIA_ROOT) {
  if (!require('../utils/cloud-service').ready()) return '';
  return resolveAsset(path, root);
}

module.exports = { MEDIA_ROOT, resolveMedia, resolveAsset };
