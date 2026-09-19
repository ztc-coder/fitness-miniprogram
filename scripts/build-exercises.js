#!/usr/bin/env node
/**
 * 从 hasaneyldrm/exercises-dataset 生成精选动作库(target 白名单粗筛 + 精选 exerciseId 白名单裁剪)。
 * 默认读 /tmp/exercises-dataset/{exercises,name_zh}.json。
 *
 *   node scripts/build-exercises.js
 */
const fs = require('fs');
const path = require('path');
const { slugMap: slugOverrides, aliasesById } = require('./hand-overrides');
const { CURATED_EXERCISES } = require('../data/curated-catalog');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = process.env.DATASET_DIR || '/tmp/exercises-dataset';
const SRC_JSON = path.join(SRC_DIR, 'exercises.json');
const SRC_ZH = path.join(SRC_DIR, 'name_zh.json');
const OUT_DIR = path.join(ROOT, 'data');
const OUT_SLUG = path.join(OUT_DIR, 'slug-map.js');
const CHUNK_SIZE = 450;

/**
 * target 白名单:排除 cardio 与冷门肌群(forearms、levator scapulae 等)。
 * traps / serratus anterior 只服务肩胛控制与肩胛俯卧撑(0688/3011/3012/3021),
 * 不因此收录耸肩(0095/0406)或前臂专项。
 * 最终目录由 data/curated-catalog.js 的精确 exerciseId 白名单决定,这里只做粗筛。
 */
const TARGET_WHITELIST = [
  'pectorals',
  'triceps',
  'lats',
  'upper back',
  'spine',
  'biceps',
  'delts',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abductors',
  'adductors',
  'abs',
  'traps',
  'serratus anterior',
];

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

function main() {
  if (!fs.existsSync(SRC_JSON) || !fs.existsSync(SRC_ZH)) {
    console.error('缺少源数据。先下载:');
    console.error('  mkdir -p /tmp/exercises-dataset');
    console.error('  curl -L -o /tmp/exercises-dataset/exercises.json https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json');
    console.error('  curl -L -o /tmp/exercises-dataset/name_zh.json https://raw.githubusercontent.com/wangmuerxiao/exercises-dataset-zh/master/data/name_zh.json');
    process.exit(1);
  }

  const source = JSON.parse(fs.readFileSync(SRC_JSON, 'utf8'));
  const nameZhMap = JSON.parse(fs.readFileSync(SRC_ZH, 'utf8'));
  const overrideById = {};
  const slugMap = {};
  Object.keys(slugOverrides).forEach((slug) => {
    const item = slugOverrides[slug];
    overrideById[item.id] = item.nameZh;
    slugMap[slug] = item.id;
  });

  const catalog = [];
  const seen = {};
  source.forEach((row) => {
    if (!row || row.category === 'cardio' || row.body_part === 'cardio') return;
    if (!TARGET_WHITELIST.includes(row.target)) return;
    const id = String(row.id || '');
    if (!id || seen[id]) return;
    if (!CURATED_EXERCISES[id]) return; // 精选白名单外不进目录
    seen[id] = true;
    const name = row.name || '';
    const steps = (row.instruction_steps && row.instruction_steps.zh) || [];
    const image = row.image ? `exercises/${row.image}` : '';
    const gif = row.gif_url ? `exercises/${row.gif_url}` : '';
    catalog.push({
      id,
      name,
      nameZh: overrideById[id] || tidyZh(nameZhMap[name]) || name,
      equipment: row.equipment || '',
      bodyPart: row.body_part || '',
      target: row.target || '',
      imagePath: image,
      gifPath: gif,
      instructionSteps: steps.filter(Boolean).map((step) => String(step).trim()),
      aliases: aliasesById[id] || [],
    });
  });

  catalog.sort((a, b) => a.id.localeCompare(b.id));

  const missing = Object.keys(overrideById).filter((id) => !catalog.some((item) => item.id === id));
  if (missing.length) {
    console.error('手译覆盖的 id 不在数据集里:', missing.join(', '));
    process.exit(1);
  }

  const uncurated = Object.keys(overrideById).filter((id) => !CURATED_EXERCISES[id]);
  if (uncurated.length) {
    console.error('手译覆盖的 id 不在精选白名单里:', uncurated.join(', '));
    process.exit(1);
  }
  const absent = Object.keys(CURATED_EXERCISES).filter((id) => !catalog.some((item) => item.id === id));
  if (absent.length) {
    console.error('精选白名单 id 在数据集中不存在:', absent.join(', '));
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  writeCatalogChunks(catalog);
  fs.writeFileSync(OUT_SLUG, `module.exports = ${JSON.stringify(slugMap)};\n`);
  console.log(`slug-map: ${Object.keys(slugMap).length} → ${path.relative(ROOT, OUT_SLUG)}`);
}

function writeCatalogChunks(catalog) {
  const existing = fs.readdirSync(OUT_DIR).filter((name) => /^exercises-data(-\d+)?\.js$/.test(name));
  existing.forEach((name) => fs.unlinkSync(path.join(OUT_DIR, name)));

  const chunkCount = Math.max(1, Math.ceil(catalog.length / CHUNK_SIZE));
  const requires = [];
  for (let i = 0; i < chunkCount; i += 1) {
    const slice = catalog.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const file = `exercises-data-${i + 1}.js`;
    const full = path.join(OUT_DIR, file);
    fs.writeFileSync(full, `module.exports = ${JSON.stringify(slice)};\n`);
    requires.push(`require('./exercises-data-${i + 1}')`);
    console.log(`chunk ${i + 1}: ${slice.length} 条, ${(fs.statSync(full).size / 1024).toFixed(1)} KB → data/${file}`);
  }

  const loader = path.join(OUT_DIR, 'exercises-data.js');
  const decls = requires.map((req, i) => `const c${i + 1} = ${req};`);
  const names = requires.map((_, i) => `c${i + 1}`).join(', ');
  fs.writeFileSync(loader, `${decls.join('\n')}\nmodule.exports = [].concat(${names});\n`);
  console.log(`exercises: ${catalog.length} 条 → ${path.relative(ROOT, loader)}`);
}

main();
