/**
 * 集成验收:领域文档与最终目录契约一致(票 05)
 * 只断言可复核的稳定事实(规模数字、筛选顺序、文档索引指向),不锁死排版。
 */
const fs = require('fs');
const path = require('path');
const catalog = require('../data/exercises');

const ROOT = path.join(__dirname, '..');
const readDoc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** 票 05 要求与最终行为同步的契约文档 */
const CONTRACT_DOCS = [
  'CONTEXT.md',
  'docs/spec.md',
  'docs/spec-mvp.md',
  'docs/adr/0007-exercises-dataset-as-catalog.md',
  'README.md',
];

/** 把 104 当作目录规模写死的过时表述(公式 `104 − 2 + 34` 只出现在历史 ticket 里) */
const STALE_SIZE_PATTERNS = [/104\s*条/, /104\s*个/, /104\s*−/, /approximately 104/];

/** 过时的部位标签口径 */
const STALE_TAG_PHRASES = ['九个部位', '九部位', '九个标签', '9 类'];

describe('领域文档与最终目录契约一致', () => {
  test('契约本身:136 条、11 项筛选顺序、warm-up 是第 10 个标签', () => {
    expect(catalog.EXERCISES).toHaveLength(136);
    expect(Object.keys(catalog.PART_LABELS)).toHaveLength(10);
    expect(catalog.PART_LABELS['warm-up']).toBe('热身');
    expect(catalog.PART_FILTERS).toEqual([
      '全部', 'chest', 'back', 'shoulders', 'biceps', 'triceps',
      'legs', 'waist', 'glutes', 'warm-up', 'compound',
    ]);
  });

  test('契约文档写明 136 条规模,且不把 104 当作目录规模', () => {
    CONTRACT_DOCS.forEach((rel) => {
      const text = readDoc(rel);
      expect(text).toContain('136');
      STALE_SIZE_PATTERNS.forEach((pattern) => {
        expect(text).not.toMatch(pattern);
      });
    });
  });

  test('契约文档没有过时的九个部位标签表述', () => {
    CONTRACT_DOCS.forEach((rel) => {
      const text = readDoc(rel);
      STALE_TAG_PHRASES.forEach((phrase) => {
        expect(text).not.toContain(phrase);
      });
    });
  });

  test('CONTEXT.md 的词汇表与实现口径一致', () => {
    const text = readDoc('CONTEXT.md');
    // aliases 已实现并参与搜索
    expect(text).toContain('aliases');
    expect(text).toContain('参与关键词搜索');
    // mode 受控词表与 TARGET_WHITELIST 口径
    expect(text).toContain('39 词受控词表');
    expect(text).toContain('TARGET_WHITELIST');
    expect(text).toContain('16 项');
    // 10 个部位标签 / 11 项筛选
    expect(text).toContain('共 10 个标签');
    expect(text).toContain('11 项');
  });

  test('AGENTS.md 的项目文档索引指向本轮 spec', () => {
    const text = readDoc('AGENTS.md');
    expect(text).toContain('.scratch/catalog-expansion/issue.md');
    expect(text).toContain('05-integration-acceptance-and-docs.md');
  });

  test('README 与 spec 标明人工验收不能由 mock 或 dry-run 代替', () => {
    ['README.md', 'docs/spec.md'].forEach((rel) => {
      const text = readDoc(rel);
      expect(text).toMatch(/dry-run/);
      expect(text).toContain('人工');
    });
  });

  test('被取代的旧一轮 ticket 已标注,且不冒充当前验收依据', () => {
    const oldIssue = readDoc('.scratch/common-exercise-catalog/issue.md');
    expect(oldIssue).toContain('已被取代');
    expect(oldIssue).toContain('.scratch/catalog-expansion/issue.md');
  });
});
