const fs = require('fs');
const os = require('os');
const path = require('path');

const { EXERCISES } = require('../data/exercises.js');
const { CURATED_EXERCISES } = require('../data/curated-catalog.js');
const { MEDIA_ROOT } = require('../data/media-root.js');
const {
  buildUploadTargets,
  planUploads,
  parseManagedCloudPath,
  isManagedCloudPath,
  buildCatalogMediaFileIds,
  findUnresolvableMedia,
  buildSyncPlan,
  assertDeletionScope,
  verifyFinalSet,
  runSync,
  createStorageAdapter,
} = require('../scripts/upload-exercise-media.js');

/** 内存版存储适配层,记录调用并可按路径注入失败 */
function makeFakeStorage({ remoteKeys = [], failUploads = [], failDeletes = [], failList = null } = {}) {
  const state = new Set(remoteKeys);
  const calls = { uploads: [], deletes: [], lists: 0 };
  return {
    state,
    calls,
    async listManagedCloudPaths() {
      calls.lists += 1;
      if (failList) throw new Error(failList);
      return [...state];
    },
    async uploadFile({ cloudPath }) {
      calls.uploads.push(cloudPath);
      if (failUploads.includes(cloudPath)) throw new Error('upload boom');
      state.add(cloudPath);
    },
    async deleteFile(cloudPath) {
      calls.deletes.push(cloudPath);
      if (failDeletes.includes(cloudPath)) throw new Error('delete boom');
      state.delete(cloudPath);
    },
  };
}

function target(cloudPath) {
  const kind = cloudPath.startsWith('exercises/images/') ? 'jpeg' : 'gif';
  return { cloudPath, localRel: cloudPath.slice('exercises/'.length), kind, localPath: `/tmp/${cloudPath}` };
}

/** 冻结的 34 条新增动作 ID(issue B.1 的 28 条 + B.2 的 6 条) */
const NEW_EXERCISE_IDS = [
  '0009', '0017', '0216', '0223', '0226', '0235', '0246', '0336', '0381', '0407', '0437', '0475',
  '0575', '0710', '0864', '0979', '0993', '1361', '1604', '1757', '2133', '2188', '2616', '3006',
  '3012', '3021', '3561', '3699', '2143', '1017', '3011', '0688', '0624', '0659',
];

/**
 * 冻结的 11 条不在最终目录的动作 ID(删除 2 条 + 严格排除 9 条)及其上游媒体路径。
 * 路径取自上游 hasaneyldrm/exercises-dataset(与旧 104 条目录一致),
 * 用于断言「不得进入目标集合,只能作为受管前缀内的陈旧候选」。
 */
const EXCLUDED_MEDIA = {
  '0200': ['exercises/images/0200-dU605di.jpg', 'exercises/videos/0200-dU605di.gif'],
  '0673': ['exercises/images/0673-ecpY0rH.jpg', 'exercises/videos/0673-ecpY0rH.gif'],
  '1015': ['exercises/images/1015-G7PXMlT.jpg', 'exercises/videos/1015-G7PXMlT.gif'],
  '0222': ['exercises/images/0222-wPypxFY.jpg', 'exercises/videos/0222-wPypxFY.gif'],
  '2399': ['exercises/images/2399-UEjSrKI.jpg', 'exercises/videos/2399-UEjSrKI.gif'],
  '3697': ['exercises/images/3697-G61cXLk.jpg', 'exercises/videos/3697-G61cXLk.gif'],
  '0549': ['exercises/images/0549-UHJlbu3.jpg', 'exercises/videos/0549-UHJlbu3.gif'],
  '2571': ['exercises/images/2571-2Dk4xQV.jpg', 'exercises/videos/2571-2Dk4xQV.gif'],
  '1419': ['exercises/images/1419-pZwUsKB.jpg', 'exercises/videos/1419-pZwUsKB.gif'],
  '1314': ['exercises/images/1314-qLpO4vV.jpg', 'exercises/videos/1314-qLpO4vV.gif'],
  '0241': ['exercises/images/0241-gAwDzB3.jpg', 'exercises/videos/0241-gAwDzB3.gif'],
};

function makeTempSrcDir(files) {
  const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-media-'));
  for (const rel of Object.keys(files)) {
    const abs = path.join(srcDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, files[rel]);
  }
  return srcDir;
}

describe('上传白名单(scripts/upload-exercise-media)', () => {
  test('以最终目录为白名单:imagePath/gifPath 一一对应,不整目录', () => {
    const targets = buildUploadTargets(EXERCISES);

    const expected = new Set();
    for (const exercise of EXERCISES) {
      expected.add(exercise.imagePath);
      expected.add(exercise.gifPath);
    }
    expect(EXERCISES.length).toBe(Object.keys(CURATED_EXERCISES).length);
    expect(EXERCISES.length).toBe(136);
    expect(targets.length).toBe(expected.size);
    // 136 条 × (JPEG + GIF) = 272 个受管对象
    expect(targets.length).toBe(272);

    const cloudPaths = new Set(targets.map((t) => t.cloudPath));
    for (const cloudPath of expected) {
      expect(cloudPaths.has(cloudPath)).toBe(true);
    }
    // 云端路径只允许 exercises/images|videos 前缀
    for (const target of targets) {
      expect(
        target.cloudPath.startsWith('exercises/images/') ||
          target.cloudPath.startsWith('exercises/videos/')
      ).toBe(true);
    }
  });

  test('34 条新增动作的 JPEG/GIF 全部进入目标集合', () => {
    const cloudPaths = new Set(buildUploadTargets(EXERCISES).map((t) => t.cloudPath));

    expect(NEW_EXERCISE_IDS.length).toBe(34);
    for (const id of NEW_EXERCISE_IDS) {
      const exercise = EXERCISES.find((e) => e.id === id);
      expect(exercise).toBeDefined();
      expect(cloudPaths.has(exercise.imagePath)).toBe(true);
      expect(cloudPaths.has(exercise.gifPath)).toBe(true);
    }
  });

  test('0200/0673 与 9 条严格排除 ID 的媒体不在目标集合中', () => {
    const cloudPaths = new Set(buildUploadTargets(EXERCISES).map((t) => t.cloudPath));

    expect(Object.keys(EXCLUDED_MEDIA).length).toBe(11);
    for (const [id, media] of Object.entries(EXCLUDED_MEDIA)) {
      expect(EXERCISES.some((e) => e.id === id)).toBe(false);
      for (const cloudPath of media) {
        expect(cloudPaths.has(cloudPath)).toBe(false);
        // 形状仍是受管的,所以远端若存在只能作为陈旧候选,不会成为上传目标
        expect(isManagedCloudPath(cloudPath)).toBe(true);
      }
      // 目标集合里不得出现这些 ID 的任何媒体文件名
      expect([...cloudPaths].filter((p) => path.posix.basename(p).startsWith(`${id}-`))).toEqual([]);
    }
  });

  test('JPEG / GIF 分类与本地相对路径映射(images/ 与 videos/ 一一对应)', () => {
    const targets = buildUploadTargets(EXERCISES);
    const jpegs = targets.filter((t) => t.kind === 'jpeg');
    const gifs = targets.filter((t) => t.kind === 'gif');

    expect(jpegs.length).toBe(EXERCISES.length);
    expect(gifs.length).toBe(EXERCISES.length);
    for (const target of jpegs) {
      expect(target.localRel).toMatch(/^images\/[^/]+\.jpg$/);
      expect(target.localRel.slice('images/'.length)).toBe(
        target.cloudPath.slice('exercises/images/'.length)
      );
    }
    for (const target of gifs) {
      expect(target.localRel).toMatch(/^videos\/[^/]+\.gif$/);
      expect(target.localRel.slice('videos/'.length)).toBe(
        target.cloudPath.slice('exercises/videos/'.length)
      );
    }
  });

  test('重复媒体路径去重;缺路径或前缀异常时抛错', () => {
    const dup = [
      { id: 'a', imagePath: 'exercises/images/a.jpg', gifPath: 'exercises/videos/a.gif' },
      { id: 'b', imagePath: 'exercises/images/a.jpg', gifPath: 'exercises/videos/b.gif' },
    ];
    expect(buildUploadTargets(dup).length).toBe(3);

    expect(() => buildUploadTargets([{ id: 'c', gifPath: 'exercises/videos/c.gif' }])).toThrow(
      /缺少媒体路径/
    );
    expect(() =>
      buildUploadTargets([
        { id: 'd', imagePath: 'other/images/d.jpg', gifPath: 'exercises/videos/d.gif' },
      ])
    ).toThrow(/前缀/);
  });

  test('路径遍历、空段/./..、反斜杠与错误扩展名均拒收(traversal 不得送入 planUploads)', () => {
    const badPaths = [
      'exercises/images/../secret.jpg', // 上跳遍历
      'exercises/images/./a.jpg', // 当前目录段
      'exercises/images//a.jpg', // 空段
      'exercises/images/a/b.jpg', // 多级子目录
      'exercises/images/a\\b.jpg', // 反斜杠分隔符
      'exercises/images/a.gif', // 扩展名与 images/ 不符
      'exercises/videos/a.jpg', // 扩展名与 videos/ 不符
      'exercises/videos/a', // 无扩展名
      'exercises/images/', // 空文件名
    ];
    for (const bad of badPaths) {
      expect(() =>
        buildUploadTargets([{ id: 'x', imagePath: bad, gifPath: 'exercises/videos/ok.gif' }])
      ).toThrow(/不合法/);
    }
  });

  test('符号链接源文件一律拒收,按缺失报告(不跟随链接上传白名单外内容)', () => {
    const targets = [
      { cloudPath: 'exercises/images/ok.jpg', localRel: 'images/ok.jpg', kind: 'jpeg' },
      { cloudPath: 'exercises/images/link.jpg', localRel: 'images/link.jpg', kind: 'jpeg' },
    ];
    const srcDir = makeTempSrcDir({ 'images/ok.jpg': 'ok' });
    // 白名单外内容放在链接目标处,验证不会被上传
    fs.mkdirSync(path.join(srcDir, 'outside'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'outside', 'leaked.jpg'), 'leak');
    fs.symlinkSync(
      path.join(srcDir, 'outside', 'leaked.jpg'),
      path.join(srcDir, 'images', 'link.jpg')
    );

    const plan = planUploads(srcDir, targets);
    expect(plan.missing).toEqual(['exercises/images/link.jpg']);
    expect(plan.jpegCount).toBe(1);
    expect(plan.present[0].localPath).toBe(path.join(srcDir, 'images', 'ok.jpg'));
  });

  test('媒体根目录本身是符号链接时,预检直接拒绝(防叶子 lstat 被中间链接绕过)', () => {
    const targets = [
      { cloudPath: 'exercises/images/ok.jpg', localRel: 'images/ok.jpg', kind: 'jpeg' },
      { cloudPath: 'exercises/videos/ok.gif', localRel: 'videos/ok.gif', kind: 'gif' },
    ];
    // images 根指向白名单外的真实目录,叶子即使存在也应被拒
    const srcDir = makeTempSrcDir({
      'outside/ok.jpg': 'leak',
      'videos/ok.gif': 'gif',
    });
    fs.symlinkSync(
      path.join(srcDir, 'outside'),
      path.join(srcDir, 'images')
    );

    expect(() => planUploads(srcDir, targets)).toThrow(/媒体根目录是符号链接/);

    // videos 根被替换成符号链接时同样拒绝
    const srcDir2 = makeTempSrcDir({
      'images/ok.jpg': 'jpg',
      'outside/ok.gif': 'leak',
    });
    fs.symlinkSync(path.join(srcDir2, 'outside'), path.join(srcDir2, 'videos'));
    expect(() => planUploads(srcDir2, targets)).toThrow(/媒体根目录是符号链接/);

    // 真实目录不受影响
    const srcDir3 = makeTempSrcDir({ 'images/ok.jpg': 'jpg', 'videos/ok.gif': 'gif' });
    const plan = planUploads(srcDir3, targets);
    expect(plan.missing).toEqual([]);
  });

  test('预检:统计 JPEG/GIF 个数与源总字节数,目标字节与源一致', () => {
    const targets = [
      { cloudPath: 'exercises/images/a.jpg', localRel: 'images/a.jpg', kind: 'jpeg' },
      { cloudPath: 'exercises/videos/a.gif', localRel: 'videos/a.gif', kind: 'gif' },
    ];
    const srcDir = makeTempSrcDir({
      'images/a.jpg': '12345',
      'videos/a.gif': '123456789',
    });

    const plan = planUploads(srcDir, targets);
    expect(plan.jpegCount).toBe(1);
    expect(plan.gifCount).toBe(1);
    expect(plan.missing).toEqual([]);
    expect(plan.totalBytes).toBe(5 + 9);
    expect(plan.present.map((p) => p.cloudPath).sort()).toEqual([
      'exercises/images/a.jpg',
      'exercises/videos/a.gif',
    ]);
  });

  test('缺失源媒体进入 missing 并带路径,可用于中止上传', () => {
    const targets = [
      { cloudPath: 'exercises/images/ok.jpg', localRel: 'images/ok.jpg', kind: 'jpeg' },
      { cloudPath: 'exercises/images/gone.jpg', localRel: 'images/gone.jpg', kind: 'jpeg' },
      { cloudPath: 'exercises/videos/gone.gif', localRel: 'videos/gone.gif', kind: 'gif' },
    ];
    const srcDir = makeTempSrcDir({ 'images/ok.jpg': 'ok' });

    const plan = planUploads(srcDir, targets);
    expect(plan.missing).toEqual([
      'exercises/images/gone.jpg',
      'exercises/videos/gone.gif',
    ]);
    expect(plan.jpegCount).toBe(1);
    expect(plan.gifCount).toBe(0);
    expect(plan.totalBytes).toBe(2);
  });

  test('非文件项(目录)也算缺失', () => {
    const targets = [
      { cloudPath: 'exercises/images/dir.jpg', localRel: 'images/dir.jpg', kind: 'jpeg' },
    ];
    const srcDir = makeTempSrcDir({ 'images/dir.jpg/keep': 'x' });

    const plan = planUploads(srcDir, targets);
    expect(plan.missing).toEqual(['exercises/images/dir.jpg']);
  });
});

describe('受管云端路径判定', () => {
  test('只有 exercises/images|videos 下单层、扩展名匹配的文件名才算受管', () => {
    expect(isManagedCloudPath('exercises/images/a.jpg')).toBe(true);
    expect(isManagedCloudPath('exercises/videos/a.gif')).toBe(true);
    expect(parseManagedCloudPath('exercises/images/a.jpg')).toEqual({
      prefix: 'exercises/images/',
      kind: 'jpeg',
      ext: '.jpg',
    });

    const rejected = [
      'exercises/images/sub/a.jpg', // 多级
      'exercises/images/../a.jpg', // 遍历
      'exercises/images/./a.jpg',
      'exercises/images/a.gif', // 扩展名不符
      'exercises/videos/a.jpg',
      'exercises/images/a.txt',
      'exercises/images/',
      'exercises/images',
      'exercises/other/a.jpg', // 前缀外
      'other/exercises/images/a.jpg',
      'exercises/images\\a.jpg',
      '',
    ];
    for (const bad of rejected) {
      expect(isManagedCloudPath(bad)).toBe(false);
      expect(parseManagedCloudPath(bad)).toBe(null);
    }
    expect(isManagedCloudPath(null)).toBe(false);
    expect(isManagedCloudPath(undefined)).toBe(false);
  });
});

describe('最终目录媒体 fileID 解析', () => {
  test('每条动作的 JPEG / GIF 都能由 MEDIA_ROOT 解析出非空 cloud:// fileID', () => {
    const items = buildCatalogMediaFileIds(EXERCISES);
    expect(items.length).toBe(EXERCISES.length);
    for (const item of items) {
      expect(item.imageFileId.startsWith(MEDIA_ROOT + '/')).toBe(true);
      expect(item.gifFileId.startsWith(MEDIA_ROOT + '/')).toBe(true);
      expect(item.imageFileId.endsWith('.jpg')).toBe(true);
      expect(item.gifFileId.endsWith('.gif')).toBe(true);
    }
    expect(findUnresolvableMedia(EXERCISES)).toEqual([]);
  });

  test('mediaRoot 未配置或路径缺失时报告不可解析', () => {
    expect(findUnresolvableMedia(EXERCISES, '')).toEqual(EXERCISES.map((e) => e.id));
    expect(
      findUnresolvableMedia([{ id: 'x', imagePath: '', gifPath: 'exercises/videos/x.gif' }])
    ).toEqual(['x']);
  });
});

describe('远端差异与最终集合校验(纯函数)', () => {
  test('目标中远端缺失的进 toUpload,已存在的进 alreadyPresent', () => {
    const targets = [
      target('exercises/images/a.jpg'),
      target('exercises/videos/a.gif'),
      target('exercises/images/b.jpg'),
    ];
    const plan = buildSyncPlan(targets, ['exercises/images/a.jpg', 'exercises/videos/a.gif']);

    expect(plan.toUpload.map((t) => t.cloudPath)).toEqual(['exercises/images/b.jpg']);
    expect(plan.alreadyPresent.map((t) => t.cloudPath)).toEqual([
      'exercises/images/a.jpg',
      'exercises/videos/a.gif',
    ]);
    expect(plan.staleCandidates).toEqual([]);
    expect(plan.outOfScope).toEqual([]);
  });

  test('陈旧候选只包含受管前缀下的单层合法文件,且不含仍被目标引用的对象', () => {
    const targets = [target('exercises/images/keep.jpg')];
    const remote = [
      'exercises/images/keep.jpg', // 仍被引用,不是候选
      'exercises/images/old.jpg', // 候选
      'exercises/videos/old.gif', // 候选
      'exercises/images/sub/deep.jpg', // 形状不合法,不删
      'exercises/images/old.gif', // 扩展名不符,不删
      'exercises/other/old.jpg', // 前缀外,不删
      'other/images/old.jpg', // 前缀外,不删
      'exercises/images/old.txt', // 扩展名不符,不删
      'exercises/videos', // 目录本身
      'backups/db.sql',
    ];

    const plan = buildSyncPlan(targets, remote);
    expect(plan.staleCandidates).toEqual([
      'exercises/images/old.jpg',
      'exercises/videos/old.gif',
    ]);
    expect(plan.outOfScope).toEqual([
      'backups/db.sql',
      'exercises/images/old.gif',
      'exercises/images/old.txt',
      'exercises/images/sub/deep.jpg',
      'exercises/other/old.jpg',
      'exercises/videos',
      'other/images/old.jpg',
    ]);
  });

  test('远端对象支持字符串或 { Key } / { key } / { cloudPath } 形式,并去重', () => {
    const plan = buildSyncPlan([], [
      'exercises/images/a.jpg',
      { Key: 'exercises/images/a.jpg' },
      { key: 'exercises/images/b.jpg' },
      { cloudPath: 'exercises/images/c.jpg' },
      null,
      {},
    ]);
    expect(plan.staleCandidates).toEqual([
      'exercises/images/a.jpg',
      'exercises/images/b.jpg',
      'exercises/images/c.jpg',
    ]);
  });

  test('verifyFinalSet 报告最终集合中仍缺失的对象', () => {
    const targets = [
      target('exercises/images/a.jpg'),
      target('exercises/videos/a.gif'),
    ];
    expect(verifyFinalSet(targets, ['exercises/images/a.jpg', 'exercises/videos/a.gif'])).toEqual({
      ok: true,
      missing: [],
    });
    expect(verifyFinalSet(targets, ['exercises/images/a.jpg'])).toEqual({
      ok: false,
      missing: ['exercises/videos/a.gif'],
    });
  });

  test('assertDeletionScope 拒绝任何受管前缀之外的路径', () => {
    expect(() => assertDeletionScope(['exercises/images/a.jpg'])).not.toThrow();
    expect(() => assertDeletionScope(['exercises/images/sub/a.jpg'])).toThrow(/拒绝删除/);
    expect(() => assertDeletionScope(['backups/db.sql'])).toThrow(/拒绝删除/);
    expect(() => assertDeletionScope(['exercises/other/a.jpg'])).toThrow(/拒绝删除/);
  });

  test('旧目录受管媒体(0200/0673 等)只作为陈旧候选,无关路径永不删除', () => {
    const targets = buildUploadTargets(EXERCISES);
    const legacy = Object.values(EXCLUDED_MEDIA).flat();
    const unrelated = [
      'backups/db.sql',
      'config/app.json',
      'exercises/images/sub/deep.jpg', // 受管前缀下但形状不合法,不删
      'exercises/other/legacy.jpg', // 受管前缀外,不删
    ];

    const plan = buildSyncPlan(targets, targets.map((t) => t.cloudPath).concat(legacy, unrelated));

    expect(plan.toUpload).toEqual([]);
    expect(plan.alreadyPresent.length).toBe(272);
    expect(plan.staleCandidates).toEqual([...legacy].sort());
    expect(plan.outOfScope).toEqual([...unrelated].sort());
    for (const cloudPath of plan.outOfScope) {
      expect(isManagedCloudPath(cloudPath)).toBe(false);
    }
  });

  test('真实最终目录:全部目标都在受管前缀内,陈旧候选严格限两个前缀', () => {
    const targets = buildUploadTargets(EXERCISES);
    const remote = targets.map((t) => t.cloudPath).concat([
      'exercises/images/legacy-removed.jpg',
      'exercises/videos/legacy-removed.gif',
      'config/app.json',
    ]);
    const plan = buildSyncPlan(targets, remote);

    expect(plan.toUpload).toEqual([]);
    expect(plan.alreadyPresent.length).toBe(targets.length);
    expect(plan.staleCandidates).toEqual([
      'exercises/images/legacy-removed.jpg',
      'exercises/videos/legacy-removed.gif',
    ]);
    expect(plan.outOfScope).toEqual(['config/app.json']);
    for (const cloudPath of plan.staleCandidates) {
      expect(cloudPath).toMatch(/^exercises\/(images|videos)\/[^/]+\.(jpg|gif)$/);
    }
  });
});

describe('同步编排(dry-run / 执行 / 失败可重试)', () => {
  test('dry-run 只列举与计算差异,不上传不删除', async () => {
    const storage = makeFakeStorage({
      remoteKeys: ['exercises/images/old.jpg', 'exercises/videos/a.gif'],
    });
    const targets = [target('exercises/images/a.jpg'), target('exercises/videos/a.gif')];

    const report = await runSync({ storage, targets, dryRun: true, log: () => {} });

    expect(report.dryRun).toBe(true);
    expect(report.plan.toUpload.map((t) => t.cloudPath)).toEqual(['exercises/images/a.jpg']);
    expect(report.plan.staleCandidates).toEqual(['exercises/images/old.jpg']);
    expect(storage.calls.uploads).toEqual([]);
    expect(storage.calls.deletes).toEqual([]);
    expect(storage.state.has('exercises/images/old.jpg')).toBe(true);
  });

  test('执行:上传缺失、校验最终集合、删除陈旧对象', async () => {
    const storage = makeFakeStorage({
      remoteKeys: ['exercises/videos/a.gif', 'exercises/images/old.jpg', 'config/app.json'],
    });
    const targets = [target('exercises/images/a.jpg'), target('exercises/videos/a.gif')];

    const report = await runSync({ storage, targets, dryRun: false, log: () => {} });

    expect(storage.calls.uploads).toEqual(['exercises/images/a.jpg']);
    expect(storage.calls.deletes).toEqual(['exercises/images/old.jpg']);
    expect(report.uploaded).toEqual(['exercises/images/a.jpg']);
    expect(report.deleted).toEqual(['exercises/images/old.jpg']);
    expect(report.failures.verification.ok).toBe(true);
    expect(storage.state.has('exercises/images/old.jpg')).toBe(false);
    expect(storage.state.has('config/app.json')).toBe(true); // 范围外对象不受影响
    expect([...storage.state].sort()).toEqual(
      ['config/app.json', 'exercises/images/a.jpg', 'exercises/videos/a.gif'].sort()
    );
  });

  test('上传失败:进入失败清单,且校验不过时不删除任何对象', async () => {
    const storage = makeFakeStorage({
      remoteKeys: ['exercises/images/old.jpg'],
      failUploads: ['exercises/images/a.jpg'],
    });
    const targets = [target('exercises/images/a.jpg')];

    const report = await runSync({ storage, targets, dryRun: false, log: () => {} });

    expect(report.failures.uploads).toEqual([
      { cloudPath: 'exercises/images/a.jpg', message: 'upload boom' },
    ]);
    expect(report.failures.verification).toEqual({
      ok: false,
      missing: ['exercises/images/a.jpg'],
    });
    expect(storage.calls.deletes).toEqual([]);
    expect(storage.state.has('exercises/images/old.jpg')).toBe(true);
  });

  test('上传失败后重跑只补缺失项并完成删除(可安全重试)', async () => {
    const targets = [target('exercises/images/a.jpg')];
    const first = makeFakeStorage({
      remoteKeys: ['exercises/images/old.jpg'],
      failUploads: ['exercises/images/a.jpg'],
    });
    const firstReport = await runSync({ storage: first, targets, dryRun: false, log: () => {} });
    expect(firstReport.failures.uploads.length).toBe(1);

    // 重跑:同一远端状态(上次上传未生效),这次成功
    const second = makeFakeStorage({ remoteKeys: [...first.state] });
    const secondReport = await runSync({ storage: second, targets, dryRun: false, log: () => {} });
    expect(secondReport.failures.uploads).toEqual([]);
    expect(secondReport.failures.verification.ok).toBe(true);
    expect(secondReport.uploaded).toEqual(['exercises/images/a.jpg']);
    expect(secondReport.deleted).toEqual(['exercises/images/old.jpg']);
    expect([...second.state]).toEqual(['exercises/images/a.jpg']);
  });

  test('删除失败:进入失败清单,重跑清掉剩余陈旧对象', async () => {
    const targets = [target('exercises/images/a.jpg')];
    const first = makeFakeStorage({
      remoteKeys: ['exercises/images/a.jpg', 'exercises/images/old.jpg'],
      failDeletes: ['exercises/images/old.jpg'],
    });
    const firstReport = await runSync({ storage: first, targets, dryRun: false, log: () => {} });

    expect(firstReport.failures.deletions).toEqual([
      { cloudPath: 'exercises/images/old.jpg', message: 'delete boom' },
    ]);
    expect(firstReport.failures.verification.ok).toBe(true);
    expect(first.state.has('exercises/images/old.jpg')).toBe(true);

    const second = makeFakeStorage({ remoteKeys: [...first.state] });
    const secondReport = await runSync({ storage: second, targets, dryRun: false, log: () => {} });
    expect(secondReport.failures.deletions).toEqual([]);
    expect(secondReport.deleted).toEqual(['exercises/images/old.jpg']);
    expect(second.state.has('exercises/images/old.jpg')).toBe(false);
  });

  test('执行:只删除陈旧受管媒体(含 0200/0673 旧媒体),范围外对象保留', async () => {
    const targets = buildUploadTargets(EXERCISES);
    const legacy = Object.values(EXCLUDED_MEDIA).flat();
    const unrelated = ['config/app.json', 'exercises/images/sub/deep.jpg'];
    const storage = makeFakeStorage({
      remoteKeys: targets.map((t) => t.cloudPath).concat(legacy, unrelated),
    });

    const report = await runSync({ storage, targets, dryRun: false, log: () => {} });

    expect(report.failures.uploads).toEqual([]);
    expect(report.failures.verification.ok).toBe(true);
    expect(report.deleted).toEqual([...legacy].sort());
    expect([...storage.state].sort()).toEqual(
      targets.map((t) => t.cloudPath).concat(unrelated).sort()
    );
  });

  test('列举远端失败:记录错误、不写不删', async () => {
    const storage = makeFakeStorage({ failList: 'network down' });
    const report = await runSync({
      storage,
      targets: [target('exercises/images/a.jpg')],
      dryRun: false,
      log: () => {},
    });

    expect(report.plan).toBe(null);
    expect(report.failures.listing).toBe('network down');
    expect(storage.calls.uploads).toEqual([]);
    expect(storage.calls.deletes).toEqual([]);
  });

  test('目标已是远端超集时,执行只做校验,无上传无删除', async () => {
    const targets = [target('exercises/images/a.jpg'), target('exercises/videos/a.gif')];
    const storage = makeFakeStorage({
      remoteKeys: ['exercises/images/a.jpg', 'exercises/videos/a.gif'],
    });
    const report = await runSync({ storage, targets, dryRun: false, log: () => {} });

    expect(report.uploaded).toEqual([]);
    expect(report.deleted).toEqual([]);
    expect(storage.calls.uploads).toEqual([]);
    expect(storage.calls.deletes).toEqual([]);
    expect(report.failures.verification.ok).toBe(true);
  });
});

describe('CloudBase 适配层(按 manager-node@5.8.8 已核对签名)', () => {
  test('列举用 listDirectoryFiles(Key 字段),返回两个前缀下全部非空 key(形状过滤留给 buildSyncPlan);删除传 cloudPath 数组', async () => {
    const calls = { listed: [], deleted: [], uploaded: [] };
    const app = {
      storage: {
        async listDirectoryFiles(prefix) {
          calls.listed.push(prefix);
          if (prefix === 'exercises/images/') {
            return [
              { Key: 'exercises/images/a.jpg', Size: '1' },
              { Key: 'exercises/images/sub/deep.jpg' }, // 嵌套对象照样返回
              { Key: 'exercises/images/b.gif' }, // 扩展名不符照样返回
              { Key: '' }, // 空 key,跳过
              { Size: '1' }, // 无 Key,跳过
            ];
          }
          return [{ Key: 'exercises/videos/a.gif' }];
        },
        async uploadFile(options) {
          calls.uploaded.push(options);
          return { statusCode: 200 };
        },
        async deleteFile(cloudPathList) {
          calls.deleted.push(cloudPathList);
          return undefined;
        },
      },
    };

    const adapter = createStorageAdapter(app);
    expect(await adapter.listManagedCloudPaths()).toEqual([
      'exercises/images/a.jpg',
      'exercises/images/sub/deep.jpg',
      'exercises/images/b.gif',
      'exercises/videos/a.gif',
    ]);
    // 只列举两个专用前缀,范围外的其他顶级前缀不触碰
    expect(calls.listed).toEqual(['exercises/images/', 'exercises/videos/']);

    await adapter.uploadFile({ localPath: '/tmp/a.jpg', cloudPath: 'exercises/images/a.jpg' });
    expect(calls.uploaded).toEqual([
      { localPath: '/tmp/a.jpg', cloudPath: 'exercises/images/a.jpg', onProgress: expect.any(Function) },
    ]);

    await adapter.deleteFile('exercises/images/old.jpg');
    expect(calls.deleted).toEqual([['exercises/images/old.jpg']]);
  });

  test('适配层列举的形状异常对象归入 outOfScope 并报告,绝不经 deleteFile 删除', async () => {
    const state = new Set([
      'exercises/images/keep.jpg',
      'exercises/images/old.jpg',
      'exercises/images/sub/deep.jpg', // 嵌套
      'exercises/images/old.gif', // 扩展名不符
      'exercises/videos/old.txt', // 扩展名不符
      'config/app.json', // 范围外顶级前缀,不应被列举
    ]);
    const calls = { listed: [], deleted: [] };
    const app = {
      storage: {
        async listDirectoryFiles(prefix) {
          calls.listed.push(prefix);
          return [...state].filter((key) => key.startsWith(prefix)).map((Key) => ({ Key }));
        },
        async uploadFile({ cloudPath }) {
          state.add(cloudPath);
        },
        async deleteFile(cloudPathList) {
          calls.deleted.push(...cloudPathList);
          for (const cloudPath of cloudPathList) state.delete(cloudPath);
        },
      },
    };
    const adapter = createStorageAdapter(app);
    const targets = [target('exercises/images/keep.jpg')];

    const report = await runSync({ storage: adapter, targets, dryRun: false, log: () => {} });

    expect(report.failures.verification.ok).toBe(true);
    expect(report.plan.staleCandidates).toEqual(['exercises/images/old.jpg']);
    expect(report.plan.outOfScope).toEqual([
      'exercises/images/old.gif',
      'exercises/images/sub/deep.jpg',
      'exercises/videos/old.txt',
    ]);
    // runSync 会列举两次(上传前/上传后),任何一次都只触碰两个专用前缀
    expect([...new Set(calls.listed)]).toEqual(['exercises/images/', 'exercises/videos/']);
    expect(calls.deleted).toEqual(['exercises/images/old.jpg']);
    expect(report.deleted).toEqual(['exercises/images/old.jpg']);
    expect([...state].sort()).toEqual(
      [
        'config/app.json',
        'exercises/images/keep.jpg',
        'exercises/images/old.gif',
        'exercises/images/sub/deep.jpg',
        'exercises/videos/old.txt',
      ].sort()
    );
  });

  test('适配层可与 runSync 串联完成一次完整同步', async () => {
    const state = new Set(['exercises/images/old.jpg', 'config/app.json']);
    const app = {
      storage: {
        async listDirectoryFiles(prefix) {
          return [...state]
            .filter((key) => key.startsWith(prefix))
            .map((Key) => ({ Key }));
        },
        async uploadFile({ cloudPath }) {
          state.add(cloudPath);
        },
        async deleteFile(cloudPathList) {
          for (const cloudPath of cloudPathList) state.delete(cloudPath);
        },
      },
    };
    const adapter = createStorageAdapter(app);
    const targets = [target('exercises/images/a.jpg')];

    const report = await runSync({ storage: adapter, targets, dryRun: false, log: () => {} });

    expect(report.failures.verification.ok).toBe(true);
    expect(report.uploaded).toEqual(['exercises/images/a.jpg']);
    expect(report.deleted).toEqual(['exercises/images/old.jpg']);
    expect([...state].sort()).toEqual(['config/app.json', 'exercises/images/a.jpg']);
  });
});

describe('未安装 CloudBase SDK 时的可导入性', () => {
  test('顶层不 require @cloudbase/manager-node,纯函数可独立导入', () => {
    jest.isolateModules(() => {
      jest.doMock(
        '@cloudbase/manager-node',
        () => {
          throw new Error('SDK 不应在模块导入期被 require');
        },
        { virtual: true }
      );
      // eslint-disable-next-line global-require
      const mod = require('../scripts/upload-exercise-media.js');
      expect(typeof mod.buildSyncPlan).toBe('function');
      expect(typeof mod.runSync).toBe('function');
      expect(typeof mod.verifyFinalSet).toBe('function');
    });
  });
});
