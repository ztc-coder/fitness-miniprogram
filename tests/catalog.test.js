/**
 * 目录契约测试:非 cardio 可用全量、排除清单、生成器行为。
 * 规模与筛选契约见 .scratch/full-catalog/issue.md。
 */
const { EXERCISES, search, findById } = require('../data/exercises');
const { buildCatalog } = require('../scripts/build-exercises');
const { EXCLUSIONS, isExcluded } = require('../scripts/catalog-exclusions');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('目录契约', () => {
  test('目录无 cardio', () => {
    expect(EXERCISES.every((item) => item.bodyPart !== 'cardio')).toBe(true);
  });
  test('排除清单中的 id 不在目录', () => {
    for (const id of Object.keys(EXCLUSIONS)) {
      expect(findById(id)).toBeNull();
    }
  });
  test('其余非 cardio 动作均可 findById', () => {
    const ids = new Set(EXERCISES.map((item) => item.id));
    expect(ids.size).toBe(EXERCISES.length); // id 唯一
  });
  test('每条 nameZh 非空', () => {
    expect(EXERCISES.every((item) => item.nameZh)).toBe(true);
  });
  test('每条 instructionSteps 非空', () => {
    expect(EXERCISES.every((item) => item.instructionSteps && item.instructionSteps.length)).toBe(true);
  });
  test('id 唯一', () => {
    const ids = EXERCISES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test('生成器 buildCatalog 可用夹具目录跑通', () => {
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-contract-'));
    try {
      fs.mkdirSync(path.join(srcDir, 'images'));
      fs.mkdirSync(path.join(srcDir, 'videos'));
      fs.writeFileSync(path.join(srcDir, 'exercises.json'), JSON.stringify([{
        id: '9001', name: 'fixture press', body_part: 'chest', equipment: 'barbell',
        target: 'pectorals', image: 'images/9001.jpg', gif_url: 'videos/9001.gif',
        instruction_steps: { zh: ['平稳推起'] },
      }]));
      fs.writeFileSync(path.join(srcDir, 'name_zh.json'), JSON.stringify({ 'fixture press': '夹具推举' }));
      // 生成器只检查源文件存在；夹具不下载、复制或分发真实动作媒体。
      fs.writeFileSync(path.join(srcDir, 'images/9001.jpg'), 'fixture');
      fs.writeFileSync(path.join(srcDir, 'videos/9001.gif'), 'fixture');
      const result = buildCatalog({ srcDir, exclusions: {}, overrides: { slugMap: {}, aliasesById: {} } });
      expect(result.catalog).toEqual([expect.objectContaining({ id: '9001', nameZh: '夹具推举' })]);
    } finally {
      fs.rmSync(srcDir, { recursive: true, force: true });
    }
  });
  test('排除清单可审计', () => {
    for (const [id, { reason }] of Object.entries(EXCLUSIONS)) {
      expect(isExcluded(id)).toBe(true);
      expect(reason).toBeTruthy();
    }
  });
});
