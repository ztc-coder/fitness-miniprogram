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
 * 已配置为实际 CloudBase 环境(Region ap-shanghai)的 fileID 桶根,
 * 目录相对路径拼上即得 cloud:// fileID(小程序端直接用 <image>/<video> 加载)。
 *
 * ⚠️ 媒体版权归 Gym visual(https://gymvisual.com/),个人自用,
 * 禁止热链 GitHub / jsDelivr 公开再分发。
 */
const MEDIA_ROOT = 'cloud://cloud1-d2ga0mned4bbf9b29.636c-cloud1-d2ga0mned4bbf9b29-1456520720';

/**
 * 拼接媒体地址;前缀未配置或路径为空时返回空串(调用方据此降级 glyph)。
 * root 参数仅供测试注入,业务代码一律用默认 MEDIA_ROOT。
 */
function resolveMedia(path, root = MEDIA_ROOT) {
  if (!root || !path) return '';
  return root.replace(/\/+$/, '') + '/' + String(path).replace(/^\/+/, '');
}

module.exports = { MEDIA_ROOT, resolveMedia };
