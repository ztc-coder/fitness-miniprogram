const catalog = require('../data/exercises');
const { CURATED_EXERCISES, PART_LABELS, PART_FILTERS } = require('../data/curated-catalog');

const PART_TAG_KEYS = PART_FILTERS.filter((key) => key !== '全部');

/** 产品标签词表:9 个具体部位标签 + 热身标签;顺序即筛选顺序 */
const TAG_KEYS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'waist', 'glutes', 'warm-up'];

/** 提案 G.3 冻结的 tags 分布(最终 136 条) */
const FROZEN_TAG_COUNTS = {
  chest: 22,
  back: 23,
  shoulders: 27,
  biceps: 11,
  triceps: 14,
  legs: 38,
  waist: 19,
  glutes: 31,
  compound: 62,
  'warm-up': 18,
};

/** 提案 C 节冻结的 18 条热身集合 */
const WARM_UP_IDS = [
  '0233', '0276', '0628', '0705',
  '0216', '0235', '0710', '0864', '0993', '1604', '3006', '3012', '3021', '3561',
  '2143', '1017', '3011', '0688',
];

/** 提案 C 节明确不标热身 */
const NOT_WARM_UP_IDS = ['0464', '0979', '3699', '0624', '0659'];

/** 提案 F.1 冻结的 39 个 mode 受控词 */
const MODE_VOCABULARY = [
  'anti-extension', 'anti-rotation', 'carry', 'chest-fly', 'dip', 'elbow-extension', 'elbow-flexion',
  'hip-abduction', 'hip-adduction', 'hip-extension', 'hip-flexion', 'hip-hinge', 'hip-thrust',
  'horizontal-pull', 'horizontal-push', 'incline-push', 'knee-extension', 'knee-flexion', 'lunge',
  'mobility-flow', 'plantar-flexion', 'scapular-protraction', 'scapular-retraction', 'shoulder-abduction',
  'shoulder-circumduction', 'shoulder-extension', 'shoulder-external-rotation', 'shoulder-flexion',
  'shoulder-horizontal-abduction', 'shoulder-internal-rotation', 'squat', 'step-up', 'trunk-extension',
  'trunk-flexion', 'trunk-lateral-flexion', 'trunk-rotation', 'upright-row', 'vertical-pull', 'vertical-push',
];

/** 提案 E 删除 2 条 + D 严格排除 9 条 + 其他明确不收 3 条 */
const REMOVED_IDS = [
  '0200', '0673',
  '1015', '0222', '2399', '3697', '0549', '2571', '1419', '1314', '0241',
  '0129', '0095', '0406',
];

/** 提案 B.1 正式新增 28 条 + B.2 追加新增 6 条 */
const ADDED_IDS = [
  '0009', '0017', '0216', '0223', '0226', '0235', '0246', '0336', '0381', '0407', '0437', '0475',
  '0575', '0710', '0864', '0979', '0993', '1361', '1604', '1757', '2133', '2188', '2616', '3006',
  '3012', '3021', '3561', '3699',
  '2143', '1017', '3011', '0688', '0624', '0659',
];

describe('动作目录', () => {
  test('分片文件低于微信单 JS 约 500KB 上限', () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '../data');
    const chunks = fs.readdirSync(dir).filter((name) => /^exercises-data-\d+\.js$/.test(name));
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((name) => {
      expect(fs.statSync(path.join(dir, name)).size).toBeLessThan(500 * 1024);
    });
  });

  test('最终目录即精选白名单:恰好 136 条,与白名单一一对应', () => {
    expect(catalog.EXERCISES.length).toBe(136);
    expect(catalog.EXERCISES.length).toBe(Object.keys(CURATED_EXERCISES).length);
    const ids = new Set(catalog.EXERCISES.map((item) => item.id));
    ids.forEach((id) => expect(CURATED_EXERCISES[id]).toBeDefined());
    Object.keys(CURATED_EXERCISES).forEach((id) => expect(ids.has(id)).toBe(true));
  });

  test('每条精选动作都有可审计元数据:动作模式、部位标签、复合标记', () => {
    Object.entries(CURATED_EXERCISES).forEach(([id, meta]) => {
      expect(MODE_VOCABULARY).toContain(meta.mode);
      expect(Array.isArray(meta.tags)).toBe(true);
      expect(meta.tags.length).toBeGreaterThan(0);
      meta.tags.forEach((tag) => expect(TAG_KEYS).toContain(tag));
      expect(typeof meta.compound).toBe('boolean');
      const item = catalog.findById(id);
      expect(item).not.toBeNull();
      expect(item.name && item.nameZh).toBeTruthy();
    });
  });

  test('冷门/平衡设备/版本号/单侧重复变式不在最终目录', () => {
    const excluded = [
      '0045', // barbell guillotine bench press 异常动作
      '0127', // barbell zercher squat 冷门
      '0545', // kettlebell plyo push-up 爆发变式
      '0638', // one arm chin-up 极限单侧
      '0655', // push-up (on stability ball) 平衡设备
      '1303', // medicine ball chest push 药球爆发
      '0332', // dumbbell iron cross 奇异变式
      '0342', // dumbbell lying one arm press v. 2 版本号变式
    ];
    excluded.forEach((id) => {
      expect(CURATED_EXERCISES[id]).toBeUndefined();
      expect(catalog.findById(id)).toBeNull();
    });
  });

  test('代表性常用动作可按 id 查到,旧 slug 解析仍生效', () => {
    const expected = {
      '0025': '杠铃卧推',
      '0043': '杠铃深蹲',
      '0652': '引体向上',
      '0032': '杠铃硬拉',
      '0031': '杠铃弯举',
      '0201': '绳索下压',
      '1409': '杠铃臀桥',
      '0464': '平板支撑带转体',
      '0314': '上斜哑铃卧推',
      '0196': '绳索穿腿后拉',
    };
    Object.entries(expected).forEach(([id, nameZh]) => {
      const item = catalog.findById(id);
      expect(item).not.toBeNull();
      expect(item.nameZh).toBe(nameZh);
    });
    const bySlug = catalog.findById('bench-press');
    expect(bySlug.id).toBe('0025');
    expect(catalog.findById('not-exist')).toBeNull();
  });

  test('删除 2 条与严格排除 12 条既不在白名单也不在目录', () => {
    expect(REMOVED_IDS).toHaveLength(14);
    REMOVED_IDS.forEach((id) => {
      expect(CURATED_EXERCISES[id]).toBeUndefined();
      expect(catalog.findById(id)).toBeNull();
    });
  });

  test('用户最终保留的 0227/0297/0310/0333 仍在,且 0227 的 mode 是 chest-fly', () => {
    ['0227', '0297', '0310', '0333'].forEach((id) => {
      expect(catalog.findById(id)).not.toBeNull();
    });
    expect(CURATED_EXERCISES['0227'].mode).toBe('chest-fly');
    ['0171', '0188', '0308', '0319', '0596'].forEach((id) => {
      expect(CURATED_EXERCISES[id].mode).toBe('chest-fly');
    });
  });

  test('34 条新增可按 id 查到,且修正后的 mode 落地', () => {
    expect(ADDED_IDS).toHaveLength(34);
    ADDED_IDS.forEach((id) => {
      expect(CURATED_EXERCISES[id]).toBeDefined();
      expect(catalog.findById(id)).not.toBeNull();
    });
    expect(CURATED_EXERCISES['0431'].mode).toBe('step-up');
    expect(CURATED_EXERCISES['1299'].mode).toBe('incline-push');
    ['0472', '0475', '0620'].forEach((id) => expect(CURATED_EXERCISES[id].mode).toBe('hip-flexion'));
    ['0223', '0407'].forEach((id) =>
      expect(CURATED_EXERCISES[id].mode).toBe('trunk-lateral-flexion')
    );
    expect(CURATED_EXERCISES['0464'].mode).toBe('trunk-rotation');
    ['0489', '0573'].forEach((id) =>
      expect(CURATED_EXERCISES[id].tags).toEqual(['back', 'glutes', 'legs'])
    );
    expect(CURATED_EXERCISES['2133'].tags).toEqual(['legs', 'back', 'waist', 'glutes']);
  });

  test('冻结 nameZh:0464/0472/0314/0196/0201/0431/1299/0710/3012/3021', () => {
    const frozen = {
      '0314': '上斜哑铃卧推',
      '0196': '绳索穿腿后拉',
      '0464': '平板支撑带转体',
      '0472': '悬垂举腿',
      '0201': '绳索下压',
      '0431': '哑铃登阶',
      '1299': '器械上斜推胸',
      '0710': '站姿髋外展',
      '3012': '站姿肩胛后缩撑起',
      '3021': '肩胛俯卧撑',
    };
    Object.entries(frozen).forEach(([id, nameZh]) => {
      expect(catalog.findById(id).nameZh).toBe(nameZh);
    });
  });

  test('aliases 是目录一等字段:每条都是数组,不参与展示名与 id 解析', () => {
    catalog.EXERCISES.forEach((item) => {
      expect(Array.isArray(item.aliases)).toBe(true);
    });
    expect(catalog.findById('0198').aliases).toContain('下拉');
    expect(catalog.findById('0198').nameZh).toBe('高位下拉');
    // 别名不是 slug,不能当 id 解析
    expect(catalog.findById('倒蹬')).toBeNull();
    expect(catalog.findById('下拉')).toBeNull();
  });

  test('用健身房俗称搜索可命中对应动作', () => {
    const hitIds = (query) => catalog.search(query, '全部').map((x) => x.id);
    expect(hitIds('倒蹬')).toContain('0739');
    expect(hitIds('龙门架').some((id) => id === '0188' || id === '0868')).toBe(true);
    expect(hitIds('下拉')).toContain('0198');
    expect(hitIds('澳式引体')).toContain('0499');
    expect(hitIds('高脚杯深蹲')).toContain('1760');
    // 别名搜索仍与器械桶、部位标签 AND
    expect(hitIds('倒蹬')).not.toContain('0025');
    expect(catalog.search('倒蹬', 'machine', 'legs').map((x) => x.id)).toEqual(['0739']);
  });

  test('生成器粗筛放行 traps / serratus anterior,仍不收前臂与肩胛提肌', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../scripts/build-exercises.js'), 'utf8');
    const match = src.match(/const TARGET_WHITELIST = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const targets = match[1]
      .split(',')
      .map((entry) => entry.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
    expect(targets).toHaveLength(16);
    expect(targets).toContain('traps');
    expect(targets).toContain('serratus anterior');
    expect(targets).not.toContain('forearms');
    expect(targets).not.toContain('levator scapulae');
    // 放行只服务肩胛动作:用 traps / serratus anterior 的只有这 4 条
    const scapular = catalog.EXERCISES.filter(
      (item) => item.target === 'traps' || item.target === 'serratus anterior'
    );
    expect(scapular.map((item) => item.id).sort()).toEqual(['0688', '3011', '3012', '3021']);
    // 白名单覆盖目录全部 target(否则生成器粗筛会静默丢掉条目)
    expect(catalog.EXERCISES.every((item) => targets.includes(item.target))).toBe(true);
  });

  test('器械筛选桶按语义归并', () => {
    expect(catalog.equipmentBucket('ez barbell')).toBe('barbell');
    expect(catalog.equipmentBucket('olympic barbell')).toBe('barbell');
    expect(catalog.equipmentBucket('trap bar')).toBe('barbell');
    expect(catalog.equipmentBucket('leverage machine')).toBe('machine');
    expect(catalog.equipmentBucket('smith machine')).toBe('machine');
    expect(catalog.equipmentBucket('sled machine')).toBe('machine');
    expect(catalog.equipmentBucket('rope')).toBe('cable');
    expect(catalog.equipmentBucket('assisted')).toBe('body weight');
    expect(catalog.equipmentBucket('body weight')).toBe('body weight');
    expect(catalog.equipmentBucket('kettlebell')).toBe('other');
  });

  test('10 个产品标签筛选各自命中带标签动作,数量等于冻结分布', () => {
    PART_TAG_KEYS.forEach((key) => {
      const result = catalog.search('', '全部', key);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBe(FROZEN_TAG_COUNTS[key]);
      result.forEach((item) => {
        const meta = CURATED_EXERCISES[item.id];
        if (key === 'compound') {
          expect(meta.compound).toBe(true);
        } else {
          expect(meta.tags).toContain(key);
        }
      });
    });
    expect(Object.keys(FROZEN_TAG_COUNTS).sort()).toEqual(PART_TAG_KEYS.slice().sort());
  });

  test('热身是重叠标签:命中冻结的 18 条,且每条都带具体部位标签', () => {
    const warmUp = catalog.search('', '全部', 'warm-up');
    expect(warmUp.map((item) => item.id).sort()).toEqual(WARM_UP_IDS.slice().sort());
    expect(WARM_UP_IDS).toHaveLength(18);

    const concreteTags = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'waist', 'glutes'];
    warmUp.forEach((item) => {
      const meta = CURATED_EXERCISES[item.id];
      const concrete = meta.tags.filter((tag) => concreteTags.indexOf(tag) !== -1);
      expect(concrete.length).toBeGreaterThan(0);
      // 热身动作仍能从其具体部位筛选中找到
      concrete.forEach((tag) => {
        expect(catalog.search('', '全部', tag).some((x) => x.id === item.id)).toBe(true);
      });
      expect(catalog.partTagsLabel(item.id)).toContain('热身');
    });

    // 热身不改变部位集合:具体部位筛选结果仍包含热身动作
    expect(catalog.search('', '全部', 'shoulders').some((x) => x.id === '0216')).toBe(true);
    expect(catalog.search('', '全部', 'glutes').some((x) => x.id === '0628')).toBe(true);
  });

  test('明确不标热身的 5 条不在热身结果中', () => {
    const warmUpIds = catalog.search('', '全部', 'warm-up').map((item) => item.id);
    NOT_WARM_UP_IDS.forEach((id) => {
      expect(CURATED_EXERCISES[id]).toBeDefined();
      expect(warmUpIds).not.toContain(id);
      expect(CURATED_EXERCISES[id].tags).not.toContain('warm-up');
    });
  });

  test('热身标签仍与关键词、器械桶三维 AND', () => {
    const bodyWeightWarmUp = catalog.search('', 'body weight', 'warm-up');
    expect(bodyWeightWarmUp.length).toBeGreaterThan(0);
    expect(
      bodyWeightWarmUp.every(
        (x) =>
          catalog.equipmentBucket(x.equipment) === 'body weight' &&
          CURATED_EXERCISES[x.id].tags.includes('warm-up')
      )
    ).toBe(true);
    const keyword = catalog.search('肩', '全部', 'warm-up');
    expect(keyword.some((x) => x.id === '0216')).toBe(true);
    const keywordOnly = new Set(catalog.search('肩', '全部').map((x) => x.id));
    const warmUpOnly = new Set(catalog.search('', '全部', 'warm-up').map((x) => x.id));
    keyword.forEach((x) => {
      expect(keywordOnly.has(x.id)).toBe(true);
      expect(warmUpOnly.has(x.id)).toBe(true);
    });
  });

  test('复合动作与具体部位标签重叠:复合结果都带具体部位,深蹲同时命中腿/臀/复合', () => {
    const compound = catalog.search('', '全部', 'compound');
    expect(compound).toHaveLength(62);
    compound.forEach((item) => {
      const meta = CURATED_EXERCISES[item.id];
      expect(meta.compound).toBe(true);
      expect(meta.tags.length).toBeGreaterThan(0);
      // 复合动作必然也能从某个具体部位筛选中找到
      const concreteHit = meta.tags.some((tag) =>
        catalog.search('', '全部', tag).some((x) => x.id === item.id)
      );
      expect(concreteHit).toBe(true);
    });
    const legs = catalog.search('', '全部', 'legs').map((x) => x.id);
    const glutes = catalog.search('', '全部', 'glutes').map((x) => x.id);
    const compoundIds = compound.map((x) => x.id);
    ['0043', '0032', '1460'].forEach((id) => {
      expect(legs).toContain(id);
      expect(glutes).toContain(id);
      expect(compoundIds).toContain(id);
    });
  });

  test('关键词、器械桶、部位标签三维 AND', () => {
    const both = catalog.search('', 'body weight', 'waist');
    expect(both.length).toBeGreaterThan(0);
    expect(
      both.every(
        (x) => catalog.equipmentBucket(x.equipment) === 'body weight' && CURATED_EXERCISES[x.id].tags.includes('waist')
      )
    ).toBe(true);
    const onlyPart = catalog.search('', '全部', 'chest');
    expect(onlyPart.every((x) => CURATED_EXERCISES[x.id].tags.includes('chest'))).toBe(true);
    const keywordAndBoth = catalog.search('平板支撑', 'body weight', 'waist');
    expect(keywordAndBoth.some((x) => x.id === '0464')).toBe(true);
    // 复合 + 器械 + 关键词仍取交集
    const triple = catalog.search('杠铃', 'barbell', 'compound');
    expect(triple.length).toBeGreaterThan(0);
    expect(
      triple.every(
        (x) =>
          catalog.equipmentBucket(x.equipment) === 'barbell' &&
          CURATED_EXERCISES[x.id].compound &&
          (x.nameZh.indexOf('杠铃') !== -1 || x.name.toLowerCase().indexOf('barbell') !== -1)
      )
    ).toBe(true);
  });

  test('搜索命中中英文名、肌群与器械中文', () => {
    const zh = catalog.search('杠铃卧推', '全部');
    expect(zh.some((x) => x.id === '0025')).toBe(true);
    const en = catalog.search('bench press', '全部');
    expect(en.some((x) => x.id === '0025')).toBe(true);
    const target = catalog.search('胸大肌', '全部');
    expect(target.some((x) => x.id === '0025')).toBe(true);
    const equip = catalog.search('杠铃', '全部');
    expect(equip.some((x) => x.id === '0025')).toBe(true);
  });

  test('部位与目标肌群中文标签', () => {
    expect(catalog.bodyPartLabel('waist')).toBe('腰腹');
    expect(catalog.bodyPartLabel('back')).toBe('背');
    expect(catalog.bodyPartLabel('chest')).toBe('胸');
    expect(catalog.targetLabel('pectorals')).toBe('胸大肌');
    expect(catalog.targetLabel('lats')).toBe('背阔肌');
    expect(catalog.targetLabel('abs')).toBe('腹部');
    expect(catalog.targetLabel('glutes')).toBe('臀肌');
    expect(catalog.equipmentLabel('machine')).toBe('器械');
    expect(catalog.equipmentLabel('smith machine')).toBe('器械');
    expect(catalog.equipmentLabel('kettlebell')).toBe('其他');
    expect(PART_LABELS.chest).toBe('胸');
    expect(PART_LABELS.back).toBe('背');
    expect(PART_LABELS.shoulders).toBe('肩');
    expect(PART_LABELS.biceps).toBe('二头肌');
    expect(PART_LABELS.triceps).toBe('三头肌');
    expect(PART_LABELS.legs).toBe('腿');
    expect(PART_LABELS.waist).toBe('腰腹');
    expect(PART_LABELS.glutes).toBe('臀');
    expect(PART_LABELS.compound).toBe('复合动作');
    expect(PART_LABELS['warm-up']).toBe('热身');
    expect(PART_FILTERS[0]).toBe('全部');
    expect(PART_FILTERS).toHaveLength(11);
    expect(PART_FILTERS).toEqual([
      '全部', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'waist', 'glutes', 'warm-up', 'compound',
    ]);
  });

  test('详情部位标签:复合动作追加复合标记,热身按 tags 顺序拼接', () => {
    expect(catalog.partTagsLabel('0025')).toBe('胸 · 复合动作');
    expect(catalog.partTagsLabel('0251')).toBe('胸 · 三头肌 · 复合动作');
    expect(catalog.partTagsLabel('0031')).toBe('二头肌');
    expect(catalog.partTagsLabel('0032')).toBe('腿 · 背 · 臀 · 复合动作');
    expect(catalog.partTagsLabel('0216')).toBe('肩 · 热身');
    expect(catalog.partTagsLabel('1604')).toBe('腿 · 臀 · 热身');
    expect(catalog.partTagsLabel('3561')).toBe('臀 · 腿 · 热身 · 复合动作');
  });
});
