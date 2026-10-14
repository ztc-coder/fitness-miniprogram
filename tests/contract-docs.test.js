/** 集成验收：领域文档与非 cardio 可用全量目录契约一致。 */
const fs = require('fs');
const path = require('path');
const catalog = require('../data/exercises');
const labels = require('../data/exercise-labels');
const exclusions = require('../scripts/catalog-exclusions');
const { buildUploadTargets } = require('../scripts/upload-exercise-media');

const ROOT = path.join(__dirname, '..');
const readDoc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const DOCS = ['CONTEXT.md', 'docs/spec.md', 'docs/adr/0007-exercises-dataset-as-catalog.md', 'docs/adr/0008-full-non-cardio-catalog.md', 'README.md'];

describe('领域文档与最终目录契约一致', () => {
  test('运行时加载全部生成分片并排除 cardio/锁定 id', () => {
    const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog-snapshot.json'), 'utf8'));
    expect(catalog.EXERCISES).toHaveLength(snapshot.counts.published);
    expect(catalog.EXERCISES.every((item) => item.bodyPart !== 'cardio')).toBe(true);
    Object.keys(exclusions.EXCLUSIONS).forEach((id) => expect(catalog.findById(id)).toBeNull());
  });

  test('每条目录项具备发布所需字段且 id 唯一', () => {
    const ids = catalog.EXERCISES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    catalog.EXERCISES.forEach((item) => {
      expect(item.id).toMatch(/^\d{4}$/);
      expect(item.name).toBeTruthy();
      expect(item.nameZh).toBeTruthy();
      expect(item.instructionSteps.length).toBeGreaterThan(0);
      expect(item.imagePath).toMatch(/^exercises\/images\/.+\.jpg$/);
      expect(item.gifPath).toMatch(/^exercises\/videos\/.+\.gif$/);
    });
  });

  test('媒体目标为每条动作两个受管对象', () => {
    const targets = buildUploadTargets(catalog.EXERCISES);
    expect(targets).toHaveLength(catalog.EXERCISES.length * 2);
    expect(targets.every((item) => /^exercises\/(images|videos)\//.test(item.cloudPath))).toBe(true);
  });

  test('筛选选项从七类部位键和实际目录器械推导', () => {
    // 七类部位键覆盖整个发布目录:每条动作恰好归入一类
    expect(labels.BODY_PART_KEYS).toHaveLength(7);
    catalog.EXERCISES.forEach((item) => {
      expect(labels.BODY_PART_KEYS).toContain(labels.bodyPartCategory(item));
    });
    labels.BODY_PART_KEYS.forEach((key) => {
      expect(labels.bodyPartLabel(key)).not.toBe(key);
      expect(catalog.search('', [], [key]).length).toBeGreaterThan(0);
    });
    const equipment = labels.equipmentKeys(catalog.EXERCISES);
    expect(equipment).toEqual(expect.arrayContaining([...new Set(catalog.EXERCISES.map((item) => item.equipment))]));
  });

  test('扩容不升迁移版本，volume 仍只认 body weight 原值', () => {
    expect(readDoc('CONTEXT.md')).toContain('equipment` 是判定自重动作的**唯一依据**');
    expect(readDoc('docs/spec.md')).toContain('v5');
    expect(readDoc('docs/spec.md')).toContain('body weight');
  });

  test('当前文档指向七类筛选并保留人工验收声明', () => {
    DOCS.forEach((rel) => {
      const text = readDoc(rel);
      expect(text).not.toMatch(/动作库为 125 条精选目录|当前目录为 125 条|筛选行固定顺序 11 项/);
    });
    expect(readDoc('docs/spec.md')).toContain('CloudBase');
    expect(readDoc('docs/spec.md')).toContain('人工');
    expect(readDoc('docs/spec.md')).toContain('七类部位与器械原值多选筛选');
    expect(readDoc('docs/adr/README.md')).toContain('0009-seven-part-library-filter.md');
    expect(readDoc('README.md')).toContain('关键词(含俗称别名)/七类部位/器械原值');
  });

  test('项目索引指向当前七类需求且保留全量目录历史', () => {
    const text = readDoc('AGENTS.md');
    expect(text).toContain('.scratch/library-seven-parts/issue.md');
    expect(text).toContain('.scratch/full-catalog/issue.md');
  });
});
