#!/usr/bin/env node
/**
 * 从 DATASET_DIR/exercises.json + name_zh.json 生成内置精简索引 tools/exercise-selector/index-data.js。
 * 生成结果确定、按 4 位 ID 排序,浏览器 <script> 直接加载即可用,无需 fetch。
 *
 *   node tools/exercise-selector/build-index.js
 *   node tools/exercise-selector/build-index.js --out /tmp/index-data.js
 */
const fs = require('fs');
const path = require('path');
const { normalizeExercises } = require('./core');

const ROOT = path.join(__dirname, '..', '..');
const SRC_DIR = process.env.DATASET_DIR || '/tmp/exercises-dataset';
const SRC_JSON = path.join(SRC_DIR, 'exercises.json');
const SRC_ZH = path.join(SRC_DIR, 'name_zh.json');
const OUT_FILE = path.join(__dirname, 'index-data.js');
const GLOBAL_NAME = 'EXERCISE_SELECTOR_INDEX';

/** 把精简索引渲染成可直接 <script> 加载、也可 CommonJS require 的 JS 文件内容 */
function renderIndexFile(list) {
  const header = [
    '/* 由 tools/exercise-selector/build-index.js 生成,请勿手改。',
    ` * 来源: hasaneyldrm/exercises-dataset exercises.json(${list.length} 条精简索引,按 4 位 ID 排序)。`,
    ` * 浏览器 <script> 加载后读全局 ${GLOBAL_NAME},Node/Jest 可直接 require。`,
    ' */',
  ].join('\n');
  const body = [
    `(function attachExerciseSelectorIndex(root, data) {`,
    `  if (typeof module === 'object' && module && module.exports) {`,
    `    module.exports = data;`,
    `  } else {`,
    `    root.${GLOBAL_NAME} = data;`,
    `  }`,
    `})(typeof globalThis !== 'undefined' ? globalThis : this, ${JSON.stringify(list)});`,
    '',
  ].join('\n');
  return `${header}\n${body}`;
}

function tidyZh(raw) {
  let text = String(raw || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 4; i += 1) {
    const next = text.replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, '$1$2');
    if (next === text) break;
    text = next;
  }
  return text;
}

/** 读上游数据集与中文名映射并生成索引文件内容;返回 { list, code } */
function buildIndex(options) {
  const srcPath = (options && options.srcPath) || SRC_JSON;
  const zhPath = (options && options.zhPath) || SRC_ZH;
  if (!fs.existsSync(srcPath) || !fs.existsSync(zhPath)) {
    throw new Error(
      `缺少源数据 ${!fs.existsSync(srcPath) ? srcPath : zhPath}。先下载:\n`
      + '  mkdir -p /tmp/exercises-dataset\n'
      + '  curl -L -o /tmp/exercises-dataset/exercises.json https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json\n'
      + '  curl -L -o /tmp/exercises-dataset/name_zh.json https://raw.githubusercontent.com/wangmuerxiao/exercises-dataset-zh/master/data/name_zh.json',
    );
  }

  const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const nameZhMap = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
  const withChineseNames = raw.map((row) => Object.assign({}, row, {
    nameZh: tidyZh(nameZhMap[row.name]),
  }));
  const list = normalizeExercises(withChineseNames);
  return { list, code: renderIndexFile(list) };
}

function parseArgs(argv) {
  const outIndex = argv.indexOf('--out');
  if (outIndex === -1) return { outPath: OUT_FILE };
  const outPath = argv[outIndex + 1];
  if (!outPath) throw new Error('--out 需要一个文件路径');
  return { outPath };
}

function main(argv) {
  const { outPath } = parseArgs(argv);
  const { list, code } = buildIndex();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, code);
  const size = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`index: ${list.length} 条, ${size} KB → ${path.relative(ROOT, outPath)}`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { renderIndexFile, buildIndex, tidyZh, SRC_JSON, SRC_ZH, OUT_FILE, GLOBAL_NAME };
