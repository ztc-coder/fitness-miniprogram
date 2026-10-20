/**
 * 票 01 生成器闸门验收:非 cardio 可用全量、锁定排除清单、媒体以源文件为准、版本快照。
 * 全部用小夹具目录,不依赖本机常驻的上游媒体(~130MB)。
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { generateCatalog, writeCatalog, parseArgs, CHUNK_SIZE } = require('../scripts/build-exercises');
const lockedExclusions = require('../scripts/catalog-exclusions');
const { slugMap: realSlugMap, aliasesById: realAliases } = require('../scripts/hand-overrides');
const published = require('../data/exercises');

const tempDirs = [];

function makeTempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

/** 一条上游动作:中文名与中文要领默认齐全,媒体文件由 fixture 的 media 列表决定 */
function row(id, overrides = {}) {
  return Object.assign(
    {
      id,
      name: `exercise ${id}`,
      category: 'chest',
      body_part: 'chest',
      equipment: 'barbell',
      target: 'pectorals',
      image: `images/${id}-aaa.jpg`,
      gif_url: `videos/${id}-aaa.gif`,
      instruction_steps: { zh: ['第一步', '第二步'] },
    },
    overrides
  );
}

function mediaFor(id) {
  return [`images/${id}-aaa.jpg`, `videos/${id}-aaa.gif`];
}

function makeFixture({
  rows,
  zhNames = {},
  media = [],
  mediaDirs = ['images', 'videos'],
  extraFiles = [],
  autoZh = true,
}) {
  const dir = makeTempDir('catalog-fixture-');
  const zh = Object.assign({}, zhNames);
  // 默认给每条上游英文名补一个中文名,只有专门验证「缺中文名」的用例才关掉
  if (autoZh) {
    rows.forEach((item) => {
      if (!zh[item.name]) zh[item.name] = `中文 ${item.name}`;
    });
  }
  fs.writeFileSync(path.join(dir, 'exercises.json'), JSON.stringify(rows));
  fs.writeFileSync(path.join(dir, 'name_zh.json'), JSON.stringify(zh));
  mediaDirs.forEach((name) => fs.mkdirSync(path.join(dir, name), { recursive: true }));
  media.concat(extraFiles).forEach((rel) => {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, rel);
  });
  return dir;
}

function sha12(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
}

/** 夹具生成:默认不注入手译覆盖(真实覆盖表由「手译覆盖与别名」用例单独验证) */
const NO_OVERRIDES = { slugMap: {}, aliasesById: {} };
function generate(srcDir, options = {}) {
  return generateCatalog(
    Object.assign({ srcDir, exclusions: {}, overrides: NO_OVERRIDES }, options)
  );
}

describe('生成器:非 cardio 可用全量', () => {
  test('cardio 按 body_part 或 category 排除,其余全量放行(含前臂/颈/肩胛提肌/爆发变式)', () => {
    const rows = [
      row('0001'),
      row('0002', { body_part: 'cardio', name: 'treadmill run' }),
      row('0003', { category: 'cardio', name: 'elliptical' }),
      row('0004', { body_part: 'lower arms', target: 'forearms', name: 'wrist curl' }),
      row('0005', { body_part: 'neck', target: 'levator scapulae', name: 'neck flexion' }),
      row('0006', { body_part: 'back', target: 'traps', name: 'barbell shrug' }),
      row('0007', { body_part: 'chest', target: 'serratus anterior', name: 'scapula push-up' }),
    ];
    const srcDir = makeFixture({
      rows,
      zhNames: { 'treadmill run': '跑步机', elliptical: '椭圆机' },
      media: ['0001', '0004', '0005', '0006', '0007'].flatMap(mediaFor),
    });

    const { catalog } = generate(srcDir);

    expect(catalog.map((item) => item.id)).toEqual(['0001', '0004', '0005', '0006', '0007']);
    // 粗筛与精选白名单已退役:前臂 / 颈 / 肩胛提肌 / 斜方肌动作不再被丢掉
    expect(catalog.map((item) => item.target)).toEqual(
      expect.arrayContaining(['forearms', 'levator scapulae', 'traps', 'serratus anterior'])
    );
  });

  test('每条都有上游英文名、非空中文名与中文要领、唯一 4 位 id 与源媒体路径', () => {
    const rows = [row('0001'), row('0004', { name: 'cable fly', equipment: 'cable' })];
    const srcDir = makeFixture({
      rows,
      zhNames: { 'cable fly': '绳索夹胸' },
      media: ['0001', '0004'].flatMap(mediaFor),
    });

    const { catalog } = generate(srcDir);

    expect(catalog).toHaveLength(2);
    expect(new Set(catalog.map((item) => item.id)).size).toBe(2);
    catalog.forEach((item) => {
      expect(item.id).toMatch(/^\d{4}$/);
      expect(item.name).toBe(item.id === '0004' ? 'cable fly' : `exercise ${item.id}`);
      expect(item.nameZh.trim().length).toBeGreaterThan(0);
      expect(item.instructionSteps.length).toBeGreaterThan(0);
      expect(item.imagePath).toBe(`exercises/images/${item.id}-aaa.jpg`);
      expect(item.gifPath).toBe(`exercises/videos/${item.id}-aaa.gif`);
      // 路径必须对应真实源文件
      expect(fs.lstatSync(path.join(srcDir, item.imagePath.slice('exercises/'.length))).isFile()).toBe(true);
      expect(fs.lstatSync(path.join(srcDir, item.gifPath.slice('exercises/'.length))).isFile()).toBe(true);
    });
    expect(catalog.find((item) => item.id === '0004').name).toBe('cable fly');
    expect(catalog.find((item) => item.id === '0004').nameZh).toBe('绳索夹胸');
  });

  test('不同 id 可以共用同一中文名', () => {
    const rows = [row('0001'), row('0002')];
    const srcDir = makeFixture({
      rows,
      zhNames: { 'exercise 0001': '俯卧撑', 'exercise 0002': '俯卧撑' },
      media: ['0001', '0002'].flatMap(mediaFor),
    });

    const { catalog } = generate(srcDir);

    expect(catalog.map((item) => item.nameZh)).toEqual(['俯卧撑', '俯卧撑']);
  });

  test('id 重复或不是 4 位数字时生成失败', () => {
    const dupDir = makeFixture({
      rows: [row('0001'), row('0001')],
      media: mediaFor('0001'),
    });
    expect(() => generate(dupDir)).toThrow(/动作 id 重复:0001/);

    const badDir = makeFixture({
      rows: [row('1')],
      media: ['images/1-aaa.jpg', 'videos/1-aaa.gif'],
    });
    expect(() => generate(badDir)).toThrow(/不是 4 位数字/);
  });

  test('缺中文名时生成失败,不把英文名当中文名发布', () => {
    const srcDir = makeFixture({ rows: [row('0001')], media: mediaFor('0001'), autoZh: false });
    expect(() => generate(srcDir)).toThrow(/缺中文名 nameZh:0001/);
  });
});

describe('生成器:媒体以源文件为准', () => {
  test('没有 images/ 与 videos/ 源目录时生成失败', () => {
    const srcDir = makeFixture({ rows: [row('0001')], mediaDirs: [] });
    expect(() => generate(srcDir)).toThrow(/缺少源媒体目录/);
  });

  test('只有 images/ 没有 videos/ 时生成失败', () => {
    const srcDir = makeFixture({
      rows: [row('0001')],
      media: ['images/0001-aaa.jpg'],
      mediaDirs: ['images'],
    });
    expect(() => generate(srcDir)).toThrow(/缺少源媒体目录.*videos/);
  });

  test('清单外缺源 JPEG / 源 GIF / 中文要领时生成失败并报出缺口', () => {
    const noJpeg = makeFixture({ rows: [row('0001')], media: ['videos/0001-aaa.gif'] });
    expect(() => generate(noJpeg)).toThrow(/清单外缺失/);
    expect(() => generate(noJpeg)).toThrow(/0001\(缺源 JPEG\)/);

    const noGif = makeFixture({ rows: [row('0001')], media: ['images/0001-aaa.jpg'] });
    expect(() => generate(noGif)).toThrow(/0001\(缺源 GIF\)/);

    const noSteps = makeFixture({
      rows: [row('0001', { instruction_steps: { zh: ['  ', ''] } })],
      media: mediaFor('0001'),
    });
    expect(() => generate(noSteps)).toThrow(/0001\(缺中文要领\)/);
  });

  test('源路径是目录或符号链接都不算可访问', () => {
    const dirInsteadOfFile = makeFixture({
      rows: [row('0001')],
      media: ['videos/0001-aaa.gif'],
      extraFiles: ['images/0001-aaa.jpg/keep'],
    });
    expect(() => generate(dirInsteadOfFile)).toThrow(/缺源 JPEG/);

    const linked = makeFixture({ rows: [row('0001')], media: ['videos/0001-aaa.gif'] });
    fs.mkdirSync(path.join(linked, 'outside'), { recursive: true });
    fs.writeFileSync(path.join(linked, 'outside', 'leaked.jpg'), 'leak');
    fs.symlinkSync(
      path.join(linked, 'outside', 'leaked.jpg'),
      path.join(linked, 'images', '0001-aaa.jpg')
    );
    expect(() => generate(linked)).toThrow(/缺源 JPEG/);
  });

  test('清单内缺口的 id 被剔除且生成成功,缺口原因进快照', () => {
    const srcDir = makeFixture({
      rows: [row('0001'), row('0002')],
      media: ['images/0001-aaa.jpg', 'videos/0001-aaa.gif'],
    });

    const result = generate(srcDir, { exclusions: { '0002': '缺源 GIF' } });

    expect(result.catalog.map((item) => item.id)).toEqual(['0001']);
    expect(result.gaps).toEqual({ '0002': ['缺源 JPEG', '缺源 GIF'] });
    expect(result.excludedIds).toEqual(['0002']);
    expect(result.snapshot.exclusions).toEqual({ count: 1, ids: ['0002'] });
  });

  test('排除清单里的 id 在源文件中没有缺口时生成失败(清单过期)', () => {
    const srcDir = makeFixture({ rows: [row('0001')], media: mediaFor('0001') });
    expect(() => generate(srcDir, { exclusions: { '0001': '曾缺 GIF' } })).toThrow(
      /排除清单已过期:0001/
    );
  });
});

describe('生成器:手译覆盖与别名', () => {
  test('既有手译 nameZh 与俗称别名写进对应动作,未覆盖动作别名为空', () => {
    const overrideNameZhById = {};
    Object.keys(realSlugMap).forEach((slug) => {
      overrideNameZhById[realSlugMap[slug].id] = realSlugMap[slug].nameZh;
    });
    const overrideIdSet = new Set(Object.keys(overrideNameZhById).concat(Object.keys(realAliases)));
    const rows = [];
    overrideIdSet.forEach((id) => {
      rows.push(row(id, { body_part: 'back', name: `upstream ${id}` }));
    });
    rows.push(row('9001', { name: 'brand new move' }));
    rows.push(row('9002', { name: 'another new move' }));

    const media = Array.from(overrideIdSet).concat(['9001', '9002']).flatMap(mediaFor);
    const srcDir = makeFixture({
      rows,
      zhNames: { 'brand new move': '全新动作', 'another new move': '另一个新动作' },
      media,
    });

    // 这一条故意不注入 overrides:走真实 scripts/hand-overrides.js
    const { catalog, slugMap } = generateCatalog({ srcDir, exclusions: {} });

    // 手译覆盖:nameZh 与别名都落地
    Object.keys(realSlugMap).forEach((slug) => {
      const id = realSlugMap[slug].id;
      const item = catalog.find((entry) => entry.id === id);
      expect(item.nameZh).toBe(realSlugMap[slug].nameZh);
      expect(slugMap[slug]).toBe(id);
    });
    Object.keys(realAliases).forEach((id) => {
      expect(catalog.find((entry) => entry.id === id).aliases).toEqual(realAliases[id]);
    });
    // 未覆盖的新动作:别名为空数组
    expect(catalog.find((entry) => entry.id === '9001').aliases).toEqual([]);
    expect(catalog.find((entry) => entry.id === '9001').nameZh).toBe('全新动作');
    expect(catalog.find((entry) => entry.id === '9002').aliases).toEqual([]);
  });

  test('手译覆盖指向 cardio、排除清单或数据集外时生成失败', () => {
    const cardioDir = makeFixture({
      rows: [row('0001'), row('0002', { body_part: 'cardio' })],
      media: mediaFor('0001'),
    });
    expect(() =>
      generateCatalog({
        srcDir: cardioDir,
        exclusions: {},
        overrides: { slugMap: { 'fake-cardio': { id: '0002', nameZh: '有氧动作' } }, aliasesById: {} },
      })
    ).toThrow(/手译覆盖的 id 不在发布目录:0002/);

    const excludedDir = makeFixture({ rows: [row('0001')], media: ['images/0001-aaa.jpg'] });
    expect(() =>
      generateCatalog({
        srcDir: excludedDir,
        exclusions: { '0001': '缺源 GIF' },
        overrides: { slugMap: { 'fake-excluded': { id: '0001', nameZh: '排除动作' } }, aliasesById: {} },
      })
    ).toThrow(/手译覆盖的 id 不在发布目录:0001/);

    const missingDir = makeFixture({ rows: [row('0001')], media: mediaFor('0001') });
    expect(() =>
      generateCatalog({
        srcDir: missingDir,
        exclusions: {},
        overrides: { slugMap: { 'ghost': { id: '8888', nameZh: '不存在' } }, aliasesById: {} },
      })
    ).toThrow(/手译覆盖的 id 不在发布目录:8888/);
  });

  test('手译覆盖缺 id 或 nameZh 时生成失败', () => {
    const srcDir = makeFixture({ rows: [row('0001')], media: mediaFor('0001') });
    expect(() =>
      generateCatalog({
        srcDir,
        exclusions: {},
        overrides: { slugMap: { 'blank': { id: '0001', nameZh: '  ' } }, aliasesById: {} },
      })
    ).toThrow(/手译覆盖缺 id 或 nameZh:blank/);
  });
});

describe('生成器:分片与版本快照', () => {
  function fiveRowFixture() {
    const ids = ['0001', '0002', '0003', '0004', '0005'];
    const rows = ids.map((id) => row(id, { name: `move ${id}` }));
    const zhNames = {};
    ids.forEach((id) => {
      zhNames[`move ${id}`] = `动作 ${id}`;
    });
    return makeFixture({ rows, zhNames, media: ids.flatMap(mediaFor) });
  }

  test('超过分片上限时切多片,loader 顶层 require 全部分片且离线可读', () => {
    const srcDir = fiveRowFixture();
    const result = generate(srcDir, { now: Date.UTC(2026, 8, 21) });
    const outDir = makeTempDir('catalog-out-');

    const written = writeCatalog({
      catalog: result.catalog,
      slugMap: result.slugMap,
      snapshot: result.snapshot,
      outDir,
      chunkSize: 2,
    });

    expect(written.chunks.map((chunk) => chunk.file)).toEqual([
      'exercises-data-1.js',
      'exercises-data-2.js',
      'exercises-data-3.js',
    ]);
    expect(written.chunks.map((chunk) => chunk.count)).toEqual([2, 2, 1]);
    written.chunks.forEach((chunk) => {
      expect(chunk.bytes).toBeLessThan(500 * 1024);
    });

    // 离线可读:直接 require 生成产物即拿到全部分片
    const offline = require(path.join(outDir, 'exercises-data.js'));
    expect(offline.map((item) => item.id)).toEqual(['0001', '0002', '0003', '0004', '0005']);
    expect(require(path.join(outDir, 'slug-map.js'))).toEqual(result.slugMap);
    // 默认分片上限仍是 450,全量约 1295 条会自然切多片
    expect(CHUNK_SIZE).toBe(450);
  });

  test('重新写出会清掉上一轮的分片文件', () => {
    const srcDir = fiveRowFixture();
    const result = generate(srcDir, { now: 0 });
    const outDir = makeTempDir('catalog-out-');

    writeCatalog({ catalog: result.catalog, slugMap: result.slugMap, snapshot: result.snapshot, outDir, chunkSize: 2 });
    expect(fs.existsSync(path.join(outDir, 'exercises-data-3.js'))).toBe(true);

    writeCatalog({
      catalog: result.catalog.slice(0, 1),
      slugMap: {},
      snapshot: result.snapshot,
      outDir,
      chunkSize: 2,
    });
    const chunks = fs.readdirSync(outDir).filter((name) => /^exercises-data-\d+\.js$/.test(name));
    expect(chunks).toEqual(['exercises-data-1.js']);
  });

  test('快照锁定数据集与映射版本、排除清单、生成时间与分片', () => {
    const srcDir = fiveRowFixture();
    const now = Date.UTC(2026, 8, 21, 12, 0, 0);
    const result = generate(srcDir, { now });
    const outDir = makeTempDir('catalog-out-');
    const written = writeCatalog({
      catalog: result.catalog,
      slugMap: result.slugMap,
      snapshot: result.snapshot,
      outDir,
      chunkSize: 2,
    });

    const snapshot = JSON.parse(fs.readFileSync(written.snapshotPath, 'utf8'));
    expect(snapshot.dataset).toEqual({
      file: 'exercises.json',
      sha256_12: sha12(path.join(srcDir, 'exercises.json')),
      rows: 5,
    });
    expect(snapshot.nameZh).toEqual({
      file: 'name_zh.json',
      sha256_12: sha12(path.join(srcDir, 'name_zh.json')),
      keys: 5,
    });
    expect(snapshot.exclusions).toEqual({ count: 0, ids: [] });
    expect(snapshot.counts).toEqual({ candidates: 5, published: 5, excluded: 0 });
    expect(snapshot.generatedAt).toBe(new Date(now).toISOString());
    expect(snapshot.chunkSize).toBe(2);
    expect(snapshot.chunks.map((chunk) => chunk.file)).toEqual([
      'exercises-data-1.js',
      'exercises-data-2.js',
      'exercises-data-3.js',
    ]);
  });

  test('同一输入可复现:目录与快照逐字节一致,只有注入的生成时间变化', () => {
    const srcDir = fiveRowFixture();
    const first = generate(srcDir, { now: 1000 });
    const second = generate(srcDir, { now: 1000 });
    expect(second.catalog).toEqual(first.catalog);
    expect(second.snapshot).toEqual(first.snapshot);

    const outA = makeTempDir('catalog-out-');
    const outB = makeTempDir('catalog-out-');
    writeCatalog({ catalog: first.catalog, slugMap: first.slugMap, snapshot: first.snapshot, outDir: outA, chunkSize: 2 });
    writeCatalog({ catalog: second.catalog, slugMap: second.slugMap, snapshot: second.snapshot, outDir: outB, chunkSize: 2 });
    ['exercises-data-1.js', 'exercises-data-2.js', 'exercises-data-3.js', 'exercises-data.js', 'slug-map.js', 'catalog-snapshot.json'].forEach(
      (name) => {
        expect(fs.readFileSync(path.join(outA, name), 'utf8')).toBe(
          fs.readFileSync(path.join(outB, name), 'utf8')
        );
      }
    );

    const later = generate(srcDir, { now: 2000 });
    expect(later.catalog).toEqual(first.catalog);
    expect(later.snapshot.dataset).toEqual(first.snapshot.dataset);
    expect(later.snapshot.generatedAt).not.toBe(first.snapshot.generatedAt);
  });
});

describe('命令行参数', () => {
  test('--src 指向真实数据集目录,缺省时沿用原有默认', () => {
    expect(parseArgs([])).toEqual({});
    expect(parseArgs(['--src', '/tmp/exercises-dataset'])).toEqual({ srcDir: '/tmp/exercises-dataset' });
    expect(parseArgs(['--src', '/data/set', '--out', '/data/out'])).toEqual({
      srcDir: '/data/set',
      outDir: '/data/out',
    });
  });

  test('--src 缺值或未知参数时报错', () => {
    expect(() => parseArgs(['--src'])).toThrow(/--src 需要一个数据集目录/);
    expect(() => parseArgs(['--unknown'])).toThrow(/未知参数:--unknown/);
  });
});

describe('锁定排除清单与当前发布产物', () => {
  test('排除清单是可审计输入:4 位数字 id + 非空原因', () => {
    const ids = Object.keys(lockedExclusions.EXCLUSIONS);
    ids.forEach((id) => {
      expect(id).toMatch(/^\d{4}$/);
      expect(String(lockedExclusions.EXCLUSIONS[id].reason).trim().length).toBeGreaterThan(0);
    });
  });

  test('当前发布目录不含 cardio,也不含排除清单中的 id', () => {
    expect(published.EXERCISES.length).toBeGreaterThan(0);
    published.EXERCISES.forEach((item) => {
      expect(item.bodyPart).not.toBe('cardio');
    });
    Object.keys(lockedExclusions.EXCLUSIONS).forEach((id) => {
      expect(published.findById(id)).toBeNull();
    });
  });

  test('当前发布目录每条都有唯一 id、非空中文名与中文要领', () => {
    const ids = published.EXERCISES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    published.EXERCISES.forEach((item) => {
      expect(item.id).toMatch(/^\d{4}$/);
      expect(item.name.trim().length).toBeGreaterThan(0);
      expect(item.nameZh.trim().length).toBeGreaterThan(0);
      expect(item.instructionSteps.length).toBeGreaterThan(0);
    });
  });
});
