#!/usr/bin/env node
/**
 * 可重复上传动作媒体到 CloudBase 云存储(幂等,可多次执行)。
 *
 * 源目录(按顺序探测,取第一个含 images/ 或 videos/ 的目录):
 *   1. --src <dir> 命令行参数(本地 clone 的 exercises-dataset)
 *   2. 环境变量 EXERCISES_MEDIA_DIR
 *   3. /tmp/exercises-dataset
 *
 * 目标前缀:云存储 `exercises/images/...` 与 `exercises/videos/...`,
 * 与目录数据里的 imagePath / gifPath 一一对应。
 *
 * 凭据(环境变量,二选一组,支持 TCB_ 前缀别名):
 *   CLOUDBASE_SECRET_ID / CLOUDBASE_SECRET_KEY
 *   TCB_SECRET_ID       / TCB_SECRET_KEY
 *
 * 依赖:@cloudbase/manager-node(不默认安装,避免主仓库无谓体积)
 *   npm i -D @cloudbase/manager-node
 *
 * 用法:
 *   node scripts/upload-exercise-media.js [--src /path/to/exercises-dataset]
 *
 * 上传成功后,把 fileID 前缀(形如
 * cloud://<env-id>.<bucket-suffix>/exercises)写入 data/media-root.js 的 MEDIA_ROOT。
 *
 * ⚠️ 媒体版权归 Gym visual(https://gymvisual.com/),仅个人自用;
 * 禁止热链 GitHub / jsDelivr 公开再分发。
 */
const fs = require('fs');
const path = require('path');

const ENV_ID = 'cloud1-d2ga0mned4bbf9b29';
const CLOUD_ROOT = 'exercises';
const DEFAULT_SRC = '/tmp/exercises-dataset';

function parseSrcArg(argv) {
  const idx = argv.indexOf('--src');
  return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : '';
}

function resolveSrcDir(cliArg) {
  const candidates = [cliArg, process.env.EXERCISES_MEDIA_DIR, DEFAULT_SRC].filter(Boolean);
  for (const candidate of candidates) {
    const dir = path.resolve(candidate);
    if (fs.existsSync(path.join(dir, 'images')) || fs.existsSync(path.join(dir, 'videos'))) {
      return dir;
    }
  }
  console.error(`未找到媒体源目录,已探测:${candidates.join(', ')}`);
  console.error('请 clone hasaneyldrm/exercises-dataset 后用 --src 指定,或设置 EXERCISES_MEDIA_DIR。');
  process.exit(1);
}

function getCredentials() {
  return {
    secretId: process.env.TCB_SECRET_ID || process.env.CLOUDBASE_SECRET_ID || '',
    secretKey: process.env.TCB_SECRET_KEY || process.env.CLOUDBASE_SECRET_KEY || '',
  };
}

async function main() {
  const srcDir = resolveSrcDir(parseSrcArg(process.argv));
  console.log(`媒体源目录:${srcDir}`);

  const { secretId, secretKey } = getCredentials();
  if (!secretId || !secretKey) {
    console.error('缺少 CloudBase API 密钥,未执行上传。请先设置环境变量:');
    console.error('  export TCB_SECRET_ID=<your-secret-id>');
    console.error('  export TCB_SECRET_KEY=<your-secret-key>');
    console.error('(或 CLOUDBASE_SECRET_ID / CLOUDBASE_SECRET_KEY,密钥在腾讯云控制台「访问管理 → API 密钥」获取)');
    process.exit(1);
  }

  let CloudBase;
  try {
    // eslint-disable-next-line global-require
    CloudBase = require('@cloudbase/manager-node');
  } catch (err) {
    console.error('缺少依赖 @cloudbase/manager-node,请先执行:npm i -D @cloudbase/manager-node');
    process.exit(1);
  }

  const app = CloudBase.init({ envId: ENV_ID, secretId, secretKey });
  const storage = app.storage;

  const pairs = [
    { local: 'images', cloud: `${CLOUD_ROOT}/images` },
    { local: 'videos', cloud: `${CLOUD_ROOT}/videos` },
  ];
  for (const pair of pairs) {
    const localDir = path.join(srcDir, pair.local);
    if (!fs.existsSync(localDir)) {
      console.warn(`跳过 ${localDir}(不存在)`);
      continue;
    }
    console.log(`上传 ${localDir} → cloud://${ENV_ID}/<bucket>/${pair.cloud}/ ...`);
    await storage.uploadDirectory({ localPath: localDir, cloudPath: pair.cloud });
  }

  console.log('上传完成。请把 fileID 前缀(形如 cloud://' + ENV_ID + '.<bucket-suffix>/exercises)');
  console.log('写入 data/media-root.js 的 MEDIA_ROOT,小程序端即可按需加载媒体。');
}

main().catch((err) => {
  console.error('上传失败:', err && err.message ? err.message : err);
  process.exit(1);
});
