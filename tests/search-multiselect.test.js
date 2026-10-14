const catalog = require('../data/exercises');
const labels = require('../data/exercise-labels');
const { EXERCISES, search, findById } = catalog;
const EXCLUDED_IDS = Object.keys(require('../scripts/catalog-exclusions.js'));

const ids = (items) => items.map((item) => item.id);

/** 固定七类部位筛选键(英文内部键),顺序即胶囊顺序 */
const SEVEN_PART_KEYS = ['chest', 'back', 'shoulders', 'arms', 'legs', 'waist', 'glutes'];

/** 期望集一律按目录里的原值推导,不写死条数:目录换成非 cardio 全量后本文件仍成立。 */
const byEquipment = (key) => EXERCISES.filter((item) => item.equipment === key);
const categoryOf = (item) => labels.bodyPartCategory(item);
const byBodyPart = (key) => EXERCISES.filter((item) => categoryOf(item) === key);
const rawEquipmentKeys = () => [...new Set(EXERCISES.map((item) => item.equipment))];
const rawBodyParts = (key) => EXERCISES.filter((item) => item.bodyPart === key);

describe('动作库检索:器械原值与七类部位键多选', () => {
  test('空选返回全部条目,且是目录里的原引用不复制', () => {
    const all = search('', [], []);

    expect(ids(all)).toEqual(ids(EXERCISES));
    expect(all).toHaveLength(EXERCISES.length);
    expect(all[0]).toBe(EXERCISES[0]);
    all.forEach((item, index) => expect(item).toBe(EXERCISES[index]));

    // undefined 与空白关键词都表示该维无约束
    expect(search()).toHaveLength(EXERCISES.length);
    expect(search('')).toHaveLength(EXERCISES.length);
    expect(search('   ')).toHaveLength(EXERCISES.length);
    expect(search(undefined, undefined, undefined)).toHaveLength(EXERCISES.length);
  });

  test('单键筛选等于按该键筛选,且结果每条都是该键', () => {
    const equipKeys = rawEquipmentKeys();
    expect(equipKeys.length).toBeGreaterThan(1);
    equipKeys.forEach((key) => {
      const result = search('', [key], []);
      expect(ids(result)).toEqual(ids(byEquipment(key)));
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((item) => item.equipment === key)).toBe(true);
    });

    expect(SEVEN_PART_KEYS).toEqual(labels.BODY_PART_KEYS);
    SEVEN_PART_KEYS.forEach((key) => {
      const result = search('', [], [key]);
      expect(ids(result)).toEqual(ids(byBodyPart(key)));
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((item) => categoryOf(item) === key)).toBe(true);
    });
  });

  test('七类键覆盖整个发布目录且互斥:每条动作恰好落入一类', () => {
    expect(SEVEN_PART_KEYS).toHaveLength(7);
    // 覆盖:目录每条都属于七类之一
    expect(EXERCISES.every((item) => SEVEN_PART_KEYS.indexOf(categoryOf(item)) !== -1)).toBe(true);
    // 互斥:七类收集的条数相加等于目录总数,没有动作被两类同时收集
    const collected = SEVEN_PART_KEYS.reduce((total, key) => total + byBodyPart(key).length, 0);
    expect(collected).toBe(EXERCISES.length);
    expect(new Set(SEVEN_PART_KEYS.flatMap((key) => ids(byBodyPart(key)))).size).toBe(EXERCISES.length);
  });

  test('glutes 优先归臀,颈归肩,上/下臂归手臂,上/下腿归腿', () => {
    const glutes = EXERCISES.filter((item) => item.target === 'glutes');
    expect(glutes.length).toBeGreaterThan(0);
    glutes.forEach((item) => {
      expect(categoryOf(item)).toBe('glutes');
      expect(ids(search('', [], ['glutes']))).toContain(item.id);
      // 臀和腿互斥:目标肌群 glutes 的动作不进腿分类
      expect(ids(search('', [], ['legs']))).not.toContain(item.id);
    });

    // 非 glutes 的上/下腿按腿归类
    const upperLegs = rawBodyParts('upper legs');
    const nonGluteUpperLegs = upperLegs.filter((item) => item.target !== 'glutes');
    expect(nonGluteUpperLegs.length).toBeGreaterThan(0);
    nonGluteUpperLegs.forEach((item) => expect(categoryOf(item)).toBe('legs'));
    const lowerLegs = rawBodyParts('lower legs');
    expect(lowerLegs.length).toBeGreaterThan(0);
    lowerLegs.forEach((item) => expect(categoryOf(item)).toBe('legs'));

    // 颈归肩
    const neck = rawBodyParts('neck');
    expect(neck.length).toBeGreaterThan(0);
    neck.forEach((item) => expect(categoryOf(item)).toBe('shoulders'));

    // 上臂 + 前臂合并为手臂
    ['upper arms', 'lower arms'].forEach((key) => {
      const items = rawBodyParts(key);
      expect(items.length).toBeGreaterThan(0);
      items.forEach((item) => expect(categoryOf(item)).toBe('arms'));
    });
  });

  test('同一维多选为并集', () => {
    const equipUnion = search('', ['barbell', 'dumbbell'], []);
    expect(ids(equipUnion)).toEqual(
      ids(EXERCISES.filter((item) => item.equipment === 'barbell' || item.equipment === 'dumbbell'))
    );
    // barbell 与 dumbbell 互斥,并集条数等于两组之和
    expect(equipUnion).toHaveLength(byEquipment('barbell').length + byEquipment('dumbbell').length);
    expect(equipUnion.some((item) => item.id === '0025')).toBe(true);
    expect(equipUnion.some((item) => item.id === '0314')).toBe(true);

    const partUnion = search('', [], ['chest', 'shoulders']);
    expect(ids(partUnion)).toEqual(ids(EXERCISES.filter((item) => ['chest', 'shoulders'].indexOf(categoryOf(item)) !== -1)));
    expect(partUnion).toHaveLength(byBodyPart('chest').length + byBodyPart('shoulders').length);
    expect(partUnion.some((item) => item.id === '0025')).toBe(true); // 杠铃卧推,chest
    expect(partUnion.some((item) => item.id === '0091')).toBe(true); // 杠铃坐姿过头推举,shoulders

    // 臀与腿互斥,并集不重复
    const glutesLegs = search('', [], ['glutes', 'legs']);
    expect(glutesLegs).toHaveLength(byBodyPart('glutes').length + byBodyPart('legs').length);
    expect(new Set(ids(glutesLegs)).size).toBe(glutesLegs.length);
  });

  test('关键词与器械组、部位组之间取交集', () => {
    const result = search('卧推', ['barbell', 'dumbbell'], ['chest']);
    const expected = EXERCISES.filter(
      (item) =>
        (item.nameZh.indexOf('卧推') !== -1 || item.name.toLowerCase().indexOf('卧推') !== -1) &&
        ['barbell', 'dumbbell'].indexOf(item.equipment) !== -1 &&
        categoryOf(item) === 'chest'
    );

    expect(result.length).toBeGreaterThan(0);
    expect(ids(result)).toEqual(ids(expected));
    expect(ids(result)).toContain('0025'); // 杠铃卧推
    expect(ids(result)).toContain('0314'); // 上斜哑铃卧推
    expect(ids(result)).not.toContain('0748'); // 史密斯卧推,器械组外
    expect(ids(result)).not.toContain('0757'); // 史密斯上斜卧推,器械组外
    expect(
      result.every(
        (item) =>
          categoryOf(item) === 'chest' &&
          ['barbell', 'dumbbell'].indexOf(item.equipment) !== -1
      )
    ).toBe(true);

    // 交集任一边为空则结果为空
    expect(search('卧推', ['body weight'], ['chest'])).toEqual([]);
    expect(search('卧推', ['barbell', 'dumbbell'], ['legs'])).toEqual([]);
    expect(search('不存在的动作名', ['barbell'], ['chest'])).toEqual([]);
  });

  test('关键词命中 id、中英文名、目标肌群、部位与器械原值,大小写不敏感', () => {
    const hitIds = (query) => ids(search(query, []));

    expect(hitIds('0025')).toContain('0025');
    expect(hitIds('杠铃卧推')).toContain('0025');
    expect(hitIds('barbell bench press')).toContain('0025');
    expect(hitIds('BENCH PRESS')).toContain('0025');
    expect(hitIds('pectorals')).toContain('0025');
    expect(hitIds('PECTORALS')).toContain('0025');
    expect(hitIds('chest')).toContain('0025');
    expect(hitIds('barbell')).toContain('0025');

    // 中文名里的拉丁字母统一小写比较,不再因大小写不一致漏命中
    expect(hitIds('v 杆窄距高位下拉')).toContain('2616');
    expect(hitIds('V 杆窄距高位下拉')).toContain('2616');
    expect(hitIds('v 杆划船')).toContain('0213');
    expect(hitIds('V 杆划船')).toContain('0213');
  });

  test('俗称与旧译名别名仍能命中对应 id,且不改变展示名', () => {
    const hitIds = (query) => ids(search(query, []));

    expect(hitIds('倒蹬')).toContain('0739');
    expect(hitIds('下拉')).toContain('0198');
    expect(hitIds('龙门架').some((id) => id === '0188' || id === '0868')).toBe(true);
    // 0238 展示名是「绳索直臂下压」,旧名「绳索直臂下拉」作为别名保留
    expect(hitIds('绳索直臂下拉')).toContain('0238');
    expect(hitIds('高脚杯深蹲')).toContain('1760');

    // 别名大小写不敏感,且不参与展示名
    expect(hitIds('ez 杠弯举')).toContain('0447');
    expect(hitIds('EZ 杠弯举')).toContain('0447');
    expect(findById('0198').nameZh).toBe('高位下拉');
    expect(findById('0238').nameZh).toBe('绳索直臂下压');

    // 别名搜索与器械、部位键 AND;倒蹬是腿推,目标肌群 glutes,归臀不归腿
    expect(ids(search('倒蹬', ['sled machine'], ['glutes']))).toEqual(['0739']);
    expect(search('倒蹬', ['sled machine'], ['legs'])).toEqual([]);
    expect(search('倒蹬', ['barbell'], ['glutes'])).toEqual([]);
    expect(search('倒蹬', ['sled machine'], ['chest'])).toEqual([]);
  });

  test('器械原值 assisted 与 body weight 不合并成同一桶', () => {
    const bodyWeight = search('', ['body weight'], []);
    const assisted = search('', ['assisted'], []);

    expect(bodyWeight.length).toBeGreaterThan(0);
    expect(bodyWeight.every((item) => item.equipment === 'body weight')).toBe(true);
    // assisted 只命中 equipment === 'assisted' 的条目,旧归并桶会把它并进自重
    expect(assisted.every((item) => item.equipment === 'assisted')).toBe(true);
    expect(assisted.some((item) => item.equipment === 'body weight')).toBe(false);

    // 并集必须包含两个原值,但不做语义桶归并
    const union = search('', ['assisted', 'body weight'], []);
    expect(union.length).toBe(bodyWeight.length + assisted.length);
    expect(union.some((item) => item.equipment === 'assisted')).toBe(true);
    expect(union.some((item) => item.equipment === 'body weight')).toBe(true);

    // 辅助类动作按原值不是 body weight,不被自重筛选命中
    ['0009', '0017', '0019'].forEach((id) => {
      expect(findById(id).equipment).not.toBe('body weight');
      expect(ids(bodyWeight)).not.toContain(id);
    });
  });

  test('发布目录内 id 都能查到,排除清单 id 不在检索结果里', () => {
    const all = search('', [], []);
    const allIds = ids(all);

    expect(EXCLUDED_IDS.length).toBeGreaterThan(0);
    EXCLUDED_IDS.forEach((id) => {
      expect(allIds).not.toContain(id);
      expect(findById(id)).toBeNull();
    });
    // 旧展示名也搜不到被排除的动作
    expect(ids(search('上斜肩胛俯卧撑', []))).not.toContain('3011');
    expect(ids(search('肩胛俯卧撑', []))).not.toContain('3021');

    all.forEach((item) => {
      expect(findById(item.id)).toBe(item);
    });
  });

  test('归并桶与产品标签筛选入口不再存在,检索只认器械原值与七类部位键', () => {
    [
      'equipmentBucket', 'equipmentLabel', 'bodyPartLabel', 'partTagsLabel',
      'EQUIPMENT_FILTERS', 'PART_FILTERS', 'PART_LABELS', 'TARGET_LABELS', 'BODY_PART_LABELS',
    ].forEach((name) => {
      expect(catalog[name]).toBeUndefined();
    });

    // 保留的导出不变
    expect(typeof catalog.search).toBe('function');
    expect(typeof catalog.findById).toBe('function');
    expect(typeof catalog.targetLabel).toBe('function');
    expect(Array.isArray(catalog.EXERCISES)).toBe(true);
    expect(catalog.targetLabel('pectorals')).toBe('胸大肌');
    expect(catalog.targetLabel('lats')).toBe('背阔肌');

    // 热身/复合/归并桶/「全部」都不是有效的筛选键
    expect(search('', [], ['warm-up'])).toEqual([]);
    expect(search('', [], ['compound'])).toEqual([]);
    expect(search('', ['全部'], [])).toEqual([]);
    expect(search('', ['other'], [])).toEqual([]);
    // 部位第三参是七类筛选键,不再是上游 bodyPart 原值
    expect(search('', [], ['upper legs'])).toEqual([]);
    expect(search('', [], ['lower arms'])).toEqual([]);
    expect(search('', [], ['neck'])).toEqual([]);
    expect(search('', [], ['legs']).length).toBeGreaterThan(0);
    expect(search('', [], ['arms']).length).toBeGreaterThan(0);
    // 部位原值仍可作关键词命中(英文检索保持不变)
    const rawUpperLegs = ids(rawBodyParts('upper legs'));
    expect(rawUpperLegs.length).toBeGreaterThan(0);
    expect(ids(search('upper legs', []))).toEqual(expect.arrayContaining(rawUpperLegs));
  });
});
