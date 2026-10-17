#!/usr/bin/env node
/**
 * 同步发布目录的动作媒体到 CloudBase 云存储（幂等、可重复执行）。
 *
 * 目标集合严格取 data/exercises.js 的最终发布目录：每条动作一个 JPEG 与一个 GIF。
 * 目录由非 cardio 可用全量生成器产出并减去锁定媒体排除清单，不再依赖精选白名单。
 * 清理只允许 exercises/images/、exercises/videos/ 两个受管前缀；其他对象只报告不删除。
 *
 * 源目录与执行模式、版权约束见下方说明。默认 dry-run；真实上传/删除必须显式 --execute。
 */
const fs = require('fs');
const path = require('path');
const { EXERCISES } = require('../data/exercises.js');
const { MEDIA_ROOT, resolveAsset: resolveMedia } = require('../data/media-root.js');

const ENV_ID = 'cloud1-d2ga0mned4bbf9b29';
const CLOUD_ROOT = 'exercises';
const DEFAULT_SRC = '/tmp/exercises-dataset';

/** 允许同步(上传 + 清理)的云端前缀白名单,顺序即匹配顺序 */
const MANAGED_PREFIXES = [`${CLOUD_ROOT}/images/`, `${CLOUD_ROOT}/videos/`];

/** 云端路径前缀 → 源目录内相对前缀与唯一允许的扩展名 */
const KIND_BY_PREFIX = {
  [`${CLOUD_ROOT}/images/`]: { kind: 'jpeg', localPrefix: 'images/', ext: '.jpg' },
  [`${CLOUD_ROOT}/videos/`]: { kind: 'gif', localPrefix: 'videos/', ext: '.gif' },
};

/**
 * 解析受管云端路径。只有满足全部条件才返回 { prefix, kind, ext }:
 *  - 落在 MANAGED_PREFIXES 之一;
 *  - 前缀后是单个安全文件名(无 / 反斜杠、非 . / ..、非空);
 *  - 扩展名与该前缀唯一允许的扩展名一致。
 * 其余一律返回 null(既不作为删除候选,也不作为目标)。
 */
function parseManagedCloudPath(cloudPath) {
  if (typeof cloudPath !== 'string') return null;
  for (const prefix of MANAGED_PREFIXES) {
    if (!cloudPath.startsWith(prefix)) continue;
    const rest = cloudPath.slice(prefix.length);
    const { kind, ext } = KIND_BY_PREFIX[prefix];
    if (
      !rest ||
      rest.includes('/') ||
      rest.includes('\\') ||
      rest === '.' ||
      rest === '..' ||
      path.posix.extname(rest).toLowerCase() !== ext
    ) {
      return null;
    }
    return { prefix, kind, ext };
  }
  return null;
}

/** 是否属于受管的动作媒体对象(可上传、可作为删除候选) */
function isManagedCloudPath(cloudPath) {
  return parseManagedCloudPath(cloudPath) !== null;
}

/**
 * 校验前缀后的剩余段:必须是单个安全文件名(无 / . .. 空段、反斜杠),
 * 且扩展名与媒体类型一致(images/ → .jpg,videos/ → .gif)。不合法抛错。
 */
function assertSafeBasename(exerciseId, cloudPath, rest, expectedExt) {
  if (
    !rest ||
    rest.includes('/') ||
    rest.includes('\\') ||
    rest === '.' ||
    rest === '..' ||
    path.posix.extname(rest).toLowerCase() !== expectedExt
  ) {
    throw new Error(
      `动作 ${exerciseId} 媒体路径不合法(须为 ${CLOUD_ROOT}/images|videos 下的单个文件名,` +
        `扩展名 ${expectedExt}):${cloudPath}`
    );
  }
}

/**
 * 从动作目录提取上传白名单:每条动作的 imagePath + gifPath 各一项。
 * 返回 [{ cloudPath, localRel, kind }];路径不含预期前缀时抛错(防止脏数据跑偏)。
 */
function buildUploadTargets(exercises) {
  const targets = [];
  const seen = new Set();
  for (const exercise of exercises) {
    for (const cloudPath of [exercise.imagePath, exercise.gifPath]) {
      if (!cloudPath) {
        throw new Error(`动作 ${exercise.id} 缺少媒体路径(imagePath/gifPath)`);
      }
      if (seen.has(cloudPath)) continue;
      seen.add(cloudPath);
      const prefix = Object.keys(KIND_BY_PREFIX).find((key) => cloudPath.startsWith(key));
      if (!prefix) {
        throw new Error(`动作 ${exercise.id} 媒体路径不在 ${CLOUD_ROOT}/images|videos 前缀下:${cloudPath}`);
      }
      const { kind, localPrefix, ext } = KIND_BY_PREFIX[prefix];
      assertSafeBasename(exercise.id, cloudPath, cloudPath.slice(prefix.length), ext);
      targets.push({ cloudPath, localRel: localPrefix + cloudPath.slice(prefix.length), kind });
    }
  }
  return targets;
}

/**
 * 最终目录每条动作的媒体 fileID(JPEG 缩略图 + GIF 详情),用 data/media-root.js 解析。
 * 路径缺失或 mediaRoot 未配置时 fileId 为空串,供调用方判定「不可解析」。
 */
function buildCatalogMediaFileIds(exercises, mediaRoot = MEDIA_ROOT) {
  return exercises.map((exercise) => ({
    id: exercise.id,
    imagePath: exercise.imagePath || '',
    gifPath: exercise.gifPath || '',
    imageFileId: resolveMedia(exercise.imagePath, mediaRoot),
    gifFileId: resolveMedia(exercise.gifPath, mediaRoot),
  }));
}

/** 校验最终目录每条动作的 JPEG/GIF 都能解析出非空 fileID;返回不可解析的 id 列表 */
function findUnresolvableMedia(exercises, mediaRoot = MEDIA_ROOT) {
  return buildCatalogMediaFileIds(exercises, mediaRoot)
    .filter((item) => !item.imageFileId || !item.gifFileId)
    .map((item) => item.id);
}

/** 把远端列举结果(字符串或含 Key/key/cloudPath 的对象)规范化为去重后的云端路径数组 */
function normalizeRemoteKeys(entries) {
  const keys = [];
  const seen = new Set();
  for (const entry of entries || []) {
    const key =
      typeof entry === 'string'
        ? entry
        : entry && (entry.Key || entry.key || entry.cloudPath || entry.fileId);
    if (typeof key !== 'string' || !key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/**
 * 远端差异纯函数:对比「最终目录目标集合」与「远端实际对象集合」。
 * 返回:
 *  - toUpload        目标中远端不存在、需要上传的 target
 *  - alreadyPresent  目标中远端已存在的 target
 *  - staleCandidates 远端存在、不再被目标引用、且严格属于受管前缀的云端路径(删除候选)
 *  - outOfScope      远端存在但不在受管前缀内(或受管前缀下形状不合法的)对象,只报告不删除
 */
function buildSyncPlan(targets, remoteEntries) {
  const remoteKeys = normalizeRemoteKeys(remoteEntries);
  const targetByPath = new Map(targets.map((target) => [target.cloudPath, target]));
  const remoteSet = new Set(remoteKeys);

  const toUpload = [];
  const alreadyPresent = [];
  for (const target of targets) {
    (remoteSet.has(target.cloudPath) ? alreadyPresent : toUpload).push(target);
  }

  const staleCandidates = [];
  const outOfScope = [];
  for (const cloudPath of remoteKeys) {
    if (targetByPath.has(cloudPath)) continue;
    (isManagedCloudPath(cloudPath) ? staleCandidates : outOfScope).push(cloudPath);
  }
  staleCandidates.sort();
  outOfScope.sort();

  return { toUpload, alreadyPresent, staleCandidates, outOfScope };
}

/**
 * 删除前最后一道防线:任一候选不属于受管动作媒体前缀即抛错。
 * 保证任何调用路径都无法把无关云存储对象送进删除流程。
 */
function assertDeletionScope(candidates) {
  for (const cloudPath of candidates) {
    if (!isManagedCloudPath(cloudPath)) {
      throw new Error(`拒绝删除受管前缀之外的对象:${cloudPath}`);
    }
  }
  return candidates;
}

/** 最终集合校验:目标里哪些云端路径在远端仍缺失 */
function verifyFinalSet(targets, remoteEntries) {
  const remoteSet = new Set(normalizeRemoteKeys(remoteEntries));
  const missing = targets
    .filter((target) => !remoteSet.has(target.cloudPath))
    .map((target) => target.cloudPath);
  return { ok: missing.length === 0, missing };
}

/**
 * 校验媒体根目录(images/、videos/)本身不是符号链接;
 * 叶子 lstat 会跟随中间路径链接,根目录若被替换成链接会绕过拒收,故预检前先拒。
 * 根目录不存在时静默放行,由逐文件预检按缺失报告。
 */
function assertRealMediaRoots(srcDir, targets) {
  const roots = new Set(targets.map((target) => target.localRel.split('/')[0]));
  for (const root of roots) {
    const rootPath = path.join(srcDir, root);
    let stat;
    try {
      stat = fs.lstatSync(rootPath);
    } catch (err) {
      continue;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`媒体根目录是符号链接,已拒绝:${rootPath}`);
    }
  }
}

/**
 * 预检:逐个 lstat 源文件(符号链接一律拒收),统计 JPEG/GIF 个数、缺失路径、总字节数。
 * 返回 { jpegCount, gifCount, missing, present, totalBytes }。
 * present 元素为 { cloudPath, localPath, kind, size };目标字节与源一致(原样上传)。
 */
function planUploads(srcDir, targets) {
  assertRealMediaRoots(srcDir, targets);
  const present = [];
  const missing = [];
  let jpegCount = 0;
  let gifCount = 0;
  for (const target of targets) {
    const localPath = path.join(srcDir, target.localRel);
    let stat;
    try {
      // lstat 不跟随符号链接,防止白名单外的文件经链接混入上传集合
      stat = fs.lstatSync(localPath);
    } catch (err) {
      missing.push(target.cloudPath);
      continue;
    }
    if (stat.isSymbolicLink() || !stat.isFile()) {
      missing.push(target.cloudPath);
      continue;
    }
    if (target.kind === 'jpeg') jpegCount += 1;
    else gifCount += 1;
    present.push({ ...target, localPath, size: stat.size });
  }
  const totalBytes = present.reduce((sum, item) => sum + item.size, 0);
  return { jpegCount, gifCount, missing, present, totalBytes };
}

function printPlan(srcDir, plan, targetCount) {
  console.log(`媒体源目录:${srcDir}`);
  console.log(
    `预检:动作 ${targetCount} 条,JPEG ${plan.jpegCount} 个,GIF ${plan.gifCount} 个,` +
      `缺失 ${plan.missing.length} 个`
  );
  console.log(
    `总字节数:源 ${plan.totalBytes} B,目标 ${plan.totalBytes} B(逐文件原样上传,字节数一致)`
  );
  if (plan.missing.length > 0) {
    console.error('以下源媒体缺失,已中止(不上传不完整集合):');
    for (const cloudPath of plan.missing) {
      console.error(`  - ${cloudPath}`);
    }
  }
}

function printRemoteDiff(plan) {
  console.log(
    `远端差异:已存在 ${plan.alreadyPresent.length} 个,待上传 ${plan.toUpload.length} 个,` +
      `待删除 ${plan.staleCandidates.length} 个,范围外(不处理)${plan.outOfScope.length} 个`
  );
  for (const cloudPath of plan.staleCandidates) {
    console.log(`  - 待删除 ${cloudPath}`);
  }
  for (const cloudPath of plan.outOfScope) {
    console.log(`  - 范围外,仅报告 ${cloudPath}`);
  }
}

/** 打印失败清单;返回是否存在失败,供退出码判定 */
function reportFailures(failures) {
  const { uploads, deletions, listing, verification } = failures;
  let failed = false;
  if (listing) {
    failed = true;
    console.error(`列举远端对象失败:${listing}`);
  }
  for (const item of uploads) {
    failed = true;
    console.error(`上传失败 ${item.cloudPath}:${item.message}`);
  }
  if (verification && !verification.ok) {
    failed = true;
    console.error(`最终集合校验未通过,缺失 ${verification.missing.length} 个,已跳过删除:`);
    for (const cloudPath of verification.missing) {
      console.error(`  - ${cloudPath}`);
    }
  }
  for (const item of deletions) {
    failed = true;
    console.error(`删除失败 ${item.cloudPath}:${item.message}`);
  }
  if (failed) {
    console.error('同步未完整完成。重跑本脚本会重新拉取远端状态,只补缺失项,可安全重试。');
  }
  return failed;
}

/**
 * 同步编排:列举远端 → 差异 → 上传缺失 → 校验最终集合 → 删除陈旧。
 * storage 为适配层,须实现:
 *   listManagedCloudPaths()  返回两个受管前缀下列举到的全部非空云端路径
 *                            (不做形状过滤,异常对象交由 buildSyncPlan 归入 outOfScope)
 *   uploadFile({ localPath, cloudPath })
 *   deleteFile(cloudPath)
 * dryRun 为 true 时只返回计划,不写不删。
 * 上传或校验失败时绝不再删除(避免「删了新集合还没传上去的媒体」)。
 */
async function runSync({ storage, targets, dryRun, log = console.log }) {
  const failures = { uploads: [], deletions: [], listing: null, verification: null };
  let remoteKeys;
  try {
    remoteKeys = await storage.listManagedCloudPaths();
  } catch (err) {
    failures.listing = err && err.message ? err.message : String(err);
    return { dryRun, plan: null, uploaded: [], deleted: [], failures };
  }

  const plan = buildSyncPlan(targets, remoteKeys);
  log(
    `远端:受管对象 ${remoteKeys.length} 个;待上传 ${plan.toUpload.length} 个,` +
      `待删除 ${plan.staleCandidates.length} 个`
  );

  if (dryRun) {
    return { dryRun: true, plan, uploaded: [], deleted: [], failures };
  }

  const uploaded = [];
  for (const item of plan.toUpload) {
    try {
      await storage.uploadFile({ localPath: item.localPath, cloudPath: item.cloudPath });
      uploaded.push(item.cloudPath);
    } catch (err) {
      failures.uploads.push({
        cloudPath: item.cloudPath,
        message: err && err.message ? err.message : String(err),
      });
    }
  }
  log(`上传完成 ${uploaded.length}/${plan.toUpload.length}`);

  let afterKeys;
  try {
    afterKeys = await storage.listManagedCloudPaths();
  } catch (err) {
    failures.listing = err && err.message ? err.message : String(err);
    return { dryRun: false, plan, uploaded, deleted: [], failures };
  }
  failures.verification = verifyFinalSet(targets, afterKeys);
  if (!failures.verification.ok) {
    return { dryRun: false, plan, uploaded, deleted: [], failures };
  }

  // 删除候选已经过受管前缀白名单过滤,这里再断言一次,双保险。
  assertDeletionScope(plan.staleCandidates);
  const deleted = [];
  for (const cloudPath of plan.staleCandidates) {
    try {
      await storage.deleteFile(cloudPath);
      deleted.push(cloudPath);
    } catch (err) {
      failures.deletions.push({
        cloudPath,
        message: err && err.message ? err.message : String(err),
      });
    }
  }
  log(`删除完成 ${deleted.length}/${plan.staleCandidates.length}`);
  return { dryRun: false, plan, uploaded, deleted, failures };
}

function parseSrcArg(argv) {
  const idx = argv.indexOf('--src');
  return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : '';
}

function hasFlag(argv, flag) {
  return argv.indexOf(flag) !== -1;
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

/**
 * 真实 CloudBase 适配层:把 manager-node 的存储 API 收敛到这里,
 * 纯函数与编排逻辑不直接依赖 SDK,便于测试与后续 API 调整。
 *
 * 已核对的 @cloudbase/manager-node@5.8.8 API:
 *  - app.storage 是 getter,不是方法;
 *  - storage.listDirectoryFiles(cloudPath) 返回 IListFileInfo[],字段 Key 即 cloudPath,
 *    内部已自动翻页(单次调用取完该前缀,无需手写分页);
 *  - storage.deleteFile(cloudPathList: string[]) 接收 cloudPath 数组(非 fileID、非对象),
 *    内部转 fileID,部分失败抛 CloudBaseError;官方未声明单次上限,这里逐条调用以便逐项归因;
 *  - storage.uploadFile({ localPath, cloudPath, onProgress }) 返回 COS 响应,不是 fileID。
 * 未安装 SDK 时本函数不会被调用(require 在 main 内惰性执行)。
 */
function createStorageAdapter(app) {
  const storage = app.storage;
  return {
    async listManagedCloudPaths() {
      const keys = [];
      for (const prefix of MANAGED_PREFIXES) {
        // eslint-disable-next-line no-await-in-loop
        const files = await storage.listDirectoryFiles(prefix);
        for (const file of files || []) {
          const key = file && (file.Key || file.key || file.cloudPath);
          // 只保留非空 key,不提前做形状过滤:异常扩展名/嵌套对象由 buildSyncPlan
          // 归入 outOfScope 并报告,否则它们既不可见也永远不会被上报。
          if (typeof key === 'string' && key) keys.push(key);
        }
      }
      return keys;
    },
    async uploadFile({ localPath, cloudPath }) {
      return storage.uploadFile({ localPath, cloudPath, onProgress: () => {} });
    },
    async deleteFile(cloudPath) {
      return storage.deleteFile([cloudPath]);
    },
  };
}

async function main() {
  const argv = process.argv;
  const srcDir = resolveSrcDir(parseSrcArg(argv));
  const execute = hasFlag(argv, '--execute');
  const dryRun = !execute;

  const targets = buildUploadTargets(EXERCISES);
  const plan = planUploads(srcDir, targets);
  printPlan(srcDir, plan, EXERCISES.length);
  if (plan.missing.length > 0) {
    process.exit(1);
  }

  const unresolvable = findUnresolvableMedia(EXERCISES);
  if (unresolvable.length > 0) {
    console.error(`以下动作的媒体路径无法解析成 fileID(检查 data/media-root.js):${unresolvable.join(', ')}`);
    process.exit(1);
  }

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
  const storage = createStorageAdapter(app);

  if (dryRun) {
    console.log('dry-run:只列出差异,不上传不删除(加 --execute 才会写入)');
  }

  const report = await runSync({ storage, targets: plan.present, dryRun, log: console.log });
  if (report.plan) printRemoteDiff(report.plan);

  if (dryRun) {
    console.log('dry-run 结束。确认无误后加 --execute 执行。');
    if (report.failures.listing) {
      reportFailures(report.failures);
      process.exit(1);
    }
    return;
  }

  if (reportFailures(report.failures)) {
    process.exit(1);
  }

  console.log('同步完成:远端受管对象与最终目录一致。');
  console.log('请确认 data/media-root.js 的 MEDIA_ROOT 为桶根(形如 cloud://' + ENV_ID + '.<bucket-suffix>,不要 /exercises)。');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('同步失败:', err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = {
  MANAGED_PREFIXES,
  buildUploadTargets,
  planUploads,
  parseManagedCloudPath,
  isManagedCloudPath,
  buildCatalogMediaFileIds,
  findUnresolvableMedia,
  normalizeRemoteKeys,
  buildSyncPlan,
  assertDeletionScope,
  verifyFinalSet,
  reportFailures,
  runSync,
  createStorageAdapter,
};
