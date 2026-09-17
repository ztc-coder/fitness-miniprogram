#!/usr/bin/env node
/**
 * 从 hasaneyldrm/exercises-dataset 生成精简动作库。
 * 默认读 /tmp/exercises-dataset/{exercises,name_zh}.json。
 *
 *   node scripts/build-exercises.js
 */
const fs = require('fs');
const path = require('path');
const overrides = require('./hand-overrides');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = process.env.DATASET_DIR || '/tmp/exercises-dataset';
const SRC_JSON = path.join(SRC_DIR, 'exercises.json');
const SRC_ZH = path.join(SRC_DIR, 'name_zh.json');
const OUT_JSON = path.join(ROOT, 'data/exercises.json');
const OUT_SLUG = path.join(ROOT, 'data/slug-map.json');

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
  Object.keys(overrides).forEach((slug) => {
    const item = overrides[slug];
    overrideById[item.id] = item.nameZh;
    slugMap[slug] = item.id;
  });

  const catalog = [];
  const seen = {};
  source.forEach((row) => {
    if (!row || row.category === 'cardio' || row.body_part === 'cardio') return;
    const id = String(row.id || '');
    if (!id || seen[id]) return;
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
    });
  });

  catalog.sort((a, b) => a.id.localeCompare(b.id));

  const missing = Object.keys(overrideById).filter((id) => !catalog.some((item) => item.id === id));
  if (missing.length) {
    console.error('手译覆盖的 id 不在数据集里:', missing.join(', '));
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(catalog)}\n`);
  fs.writeFileSync(OUT_SLUG, `${JSON.stringify(slugMap, null, 2)}\n`);

  const bytes = fs.statSync(OUT_JSON).size;
  console.log(`exercises: ${catalog.length} 条, ${(bytes / 1024).toFixed(1)} KB → ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`slug-map: ${Object.keys(slugMap).length} → ${path.relative(ROOT, OUT_SLUG)}`);
}

main();
