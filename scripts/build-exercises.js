#!/usr/bin/env node
/** 生成非 cardio 可用动作目录。 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { slugMap: defaultSlugMap, aliasesById: defaultAliases } = require('./hand-overrides');
const { EXCLUSIONS: LOCKED_EXCLUSIONS } = require('./catalog-exclusions');

const ROOT = path.join(__dirname, '..');
const DEFAULT_SRC_DIR = process.env.DATASET_DIR || '/tmp/exercises-dataset';
const DEFAULT_OUT_DIR = path.join(ROOT, 'data');
const CHUNK_SIZE = 450;

function tidyZh(raw) {
  if (!raw) return '';
  let text = String(raw).replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 4; i += 1) {
    const next = text.replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, '$1$2');
    if (next === text) break;
    text = next;
  }
  return text;
}
function sha12(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12); }
function asReason(value) { return value && typeof value === 'object' ? value.reason : value; }
function normalizeOverrides(overrides) {
  const source = overrides || { slugMap: defaultSlugMap, aliasesById: defaultAliases };
  return { slugMap: source.slugMap || {}, aliasesById: source.aliasesById || {} };
}
function normalizeExclusions(exclusions) { return exclusions || LOCKED_EXCLUSIONS; }
function fileExists(srcDir, rel) {
  if (!rel) return false;
  try { const stat = fs.lstatSync(path.join(srcDir, rel)); return stat.isFile() && !stat.isSymbolicLink(); } catch (_) { return false; }
}
function sourcePaths(row) {
  return {
    image: row.image ? String(row.image) : '',
    gif: row.gif_url ? String(row.gif_url) : '',
  };
}

function generateCatalog(options = {}) {
  const srcDir = options.srcDir || DEFAULT_SRC_DIR;
  const srcJson = path.join(srcDir, 'exercises.json');
  const srcZh = path.join(srcDir, 'name_zh.json');
  if (!fs.existsSync(srcJson) || !fs.existsSync(srcZh)) throw new Error('缺少源数据：需 exercises.json 与 name_zh.json');
  if (!fs.existsSync(path.join(srcDir, 'images'))) throw new Error('缺少源媒体目录:images');
  if (!fs.existsSync(path.join(srcDir, 'videos'))) throw new Error('缺少源媒体目录:videos');
  const source = JSON.parse(fs.readFileSync(srcJson, 'utf8'));
  const nameZhMap = JSON.parse(fs.readFileSync(srcZh, 'utf8'));
  const exclusions = normalizeExclusions(options.exclusions);
  const overrides = normalizeOverrides(options.overrides);
  const slugMap = {};
  const overrideNames = {};
  Object.entries(overrides.slugMap).forEach(([slug, item]) => {
    if (!item || !item.id || !String(item.nameZh || '').trim()) throw new Error(`手译覆盖缺 id 或 nameZh:${slug}`);
    slugMap[slug] = item.id;
    overrideNames[item.id] = item.nameZh;
  });

  const rowsById = new Map();
  source.forEach((row) => {
    if (!row || row.category === 'cardio' || row.body_part === 'cardio') return;
    const id = String(row.id || '');
    if (rowsById.has(id)) throw new Error(`动作 id 重复:${id}`);
    if (!/^\d{4}$/.test(id)) throw new Error(`动作 id 不是 4 位数字:${id}`);
    rowsById.set(id, row);
  });

  const catalog = [];
  const gaps = {};
  const excludedIds = [];
  rowsById.forEach((row, id) => {
    const media = sourcePaths(row);
    const missing = [];
    if (!fileExists(srcDir, media.image)) missing.push('缺源 JPEG');
    if (!fileExists(srcDir, media.gif)) missing.push('缺源 GIF');
    const steps = row.instruction_steps && row.instruction_steps.zh;
    const instructionSteps = Array.isArray(steps) ? steps.filter(Boolean).map((item) => String(item).trim()).filter(Boolean) : [];
    if (!instructionSteps.length) missing.push('缺中文要领');
    if (missing.length) {
      gaps[id] = missing;
      if (Object.prototype.hasOwnProperty.call(exclusions, id)) excludedIds.push(id);
      else throw new Error(`清单外缺失:${id}(${missing.join('、')})`);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(exclusions, id)) throw new Error(`排除清单已过期:${id}`);
    const nameZh = String(overrideNames[id] || tidyZh(nameZhMap[row.name]) || '').trim();
    if (!nameZh) throw new Error(`缺中文名 nameZh:${id}`);
    catalog.push({
      id, name: String(row.name || ''), nameZh,
      equipment: row.equipment || '', bodyPart: row.body_part || '', target: row.target || '',
      imagePath: `exercises/${media.image}`, gifPath: `exercises/${media.gif}`,
      instructionSteps, aliases: overrides.aliasesById[id] || [],
    });
  });

  Object.entries(overrides.slugMap).forEach(([slug, item]) => {
    if (!rowsById.has(String(item.id)) || excludedIds.includes(String(item.id))) throw new Error(`手译覆盖的 id 不在发布目录:${item.id}`);
  });
  catalog.sort((a, b) => a.id.localeCompare(b.id));
  const now = options.now === undefined ? Date.now() : options.now;
  const snapshot = {
    datasetCommit: '7455efae41b330c265e7cd4b78dfa848e7ce5ebd',
    dataset: { file: 'exercises.json', sha256_12: sha12(srcJson), rows: source.length },
    nameZh: { file: 'name_zh.json', sha256_12: sha12(srcZh), keys: Object.keys(nameZhMap).length },
    exclusions: { count: excludedIds.length, ids: excludedIds.slice().sort() },
    counts: { candidates: rowsById.size, published: catalog.length, excluded: excludedIds.length },
    generatedAt: new Date(now).toISOString(), chunkSize: CHUNK_SIZE,
  };
  return { catalog, slugMap, gaps, excludedIds: excludedIds.sort(), snapshot, datasetSha: snapshot.dataset.sha256_12, zhSha: snapshot.nameZh.sha256_12 };
}

function writeCatalog(options) {
  const { catalog, slugMap, snapshot } = options;
  const outDir = options.outDir || DEFAULT_OUT_DIR;
  const chunkSize = options.chunkSize || CHUNK_SIZE;
  fs.mkdirSync(outDir, { recursive: true });
  fs.readdirSync(outDir).filter((name) => /^exercises-data(-\d+)?\.js$/.test(name)).forEach((name) => fs.unlinkSync(path.join(outDir, name)));
  const chunks = [];
  for (let i = 0; i < Math.max(1, Math.ceil(catalog.length / chunkSize)); i += 1) {
    const slice = catalog.slice(i * chunkSize, (i + 1) * chunkSize);
    const file = `exercises-data-${i + 1}.js`;
    const full = path.join(outDir, file);
    fs.writeFileSync(full, `module.exports = ${JSON.stringify(slice)};\n`);
    chunks.push({ file, count: slice.length, bytes: fs.statSync(full).size });
  }
  const requires = chunks.map((chunk, i) => `const c${i + 1} = require('./${chunk.file}');`).join('\n');
  fs.writeFileSync(path.join(outDir, 'exercises-data.js'), `${requires}\nmodule.exports = [].concat(${chunks.map((_, i) => `c${i + 1}`).join(', ')});\n`);
  fs.writeFileSync(path.join(outDir, 'slug-map.js'), `module.exports = ${JSON.stringify(slugMap)};\n`);
  const snapshotPath = path.join(outDir, 'catalog-snapshot.json');
  fs.writeFileSync(snapshotPath, JSON.stringify({ ...snapshot, chunkSize, chunks }, null, 2) + '\n');
  return { chunks, snapshotPath };
}

/** 解析 --src <数据集目录> / --out <输出目录>;缺省时行为与以往完全一致。 */
function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--src') {
      if (!argv[i + 1]) throw new Error('--src 需要一个数据集目录,该目录须含 exercises.json 与 name_zh.json');
      options.srcDir = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--out') {
      if (!argv[i + 1]) throw new Error('--out 需要一个输出目录');
      options.outDir = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`未知参数:${argv[i]}(可用:--src <数据集目录> --out <输出目录>)`);
    }
  }
  return options;
}

function main(argv = []) {
  const options = parseArgs(argv);
  const result = generateCatalog({ srcDir: options.srcDir });
  writeCatalog({ ...result, outDir: options.outDir });
  console.log(`catalog: ${result.catalog.length} 条`);
}

module.exports = { generateCatalog, buildCatalog: generateCatalog, writeCatalog, writeCatalogChunks: writeCatalog, parseArgs, CHUNK_SIZE };
if (require.main === module) main(process.argv.slice(2));
