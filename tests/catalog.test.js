const catalog = require('../data/exercises');

describe('动作目录', () => {
  test('排除 cardio 后可离线列出全部力量动作', () => {
    expect(catalog.EXERCISES.length).toBe(1295);
    expect(catalog.EXERCISES.every((item) => item.bodyPart !== 'cardio')).toBe(true);
    expect(catalog.EXERCISES.every((item) => item.id && item.name && item.nameZh)).toBe(true);
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
    expect(catalog.equipmentBucket('band')).toBe('other');
  });

  test('部位与目标肌群中文标签', () => {
    expect(catalog.bodyPartLabel('waist')).toBe('腰腹');
    expect(catalog.bodyPartLabel('back')).toBe('背');
    expect(catalog.bodyPartLabel('chest')).toBe('胸');
    expect(catalog.bodyPartLabel('lower arms')).toBe('前臂');
    expect(catalog.bodyPartLabel('lower legs')).toBe('小腿');
    expect(catalog.bodyPartLabel('neck')).toBe('颈');
    expect(catalog.bodyPartLabel('shoulders')).toBe('肩');
    expect(catalog.bodyPartLabel('upper arms')).toBe('上臂');
    expect(catalog.bodyPartLabel('upper legs')).toBe('大腿');
    expect(catalog.targetLabel('pectorals')).toBe('胸大肌');
    expect(catalog.targetLabel('lats')).toBe('背阔肌');
    expect(catalog.targetLabel('abs')).toBe('腹部');
    expect(catalog.targetLabel('glutes')).toBe('臀肌');
    expect(catalog.equipmentLabel('machine')).toBe('器械');
    expect(catalog.equipmentLabel('smith machine')).toBe('器械');
    expect(catalog.equipmentLabel('kettlebell')).toBe('其他');
  });

  test('按 id 查找与旧 slug 解析', () => {
    const byId = catalog.findById('0025');
    expect(byId).not.toBeNull();
    expect(byId.nameZh).toBe('杠铃卧推');
    const bySlug = catalog.findById('bench-press');
    expect(bySlug).not.toBeNull();
    expect(bySlug.id).toBe('0025');
    expect(bySlug.nameZh).toBe('杠铃卧推');
    expect(catalog.findById('not-exist')).toBeNull();
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
    const part = catalog.search('腰腹', '全部');
    expect(part.length).toBeGreaterThan(0);
    expect(part.every((x) => x.bodyPart === 'waist')).toBe(true);
  });

  test('器械桶与部位两维 AND', () => {
    const both = catalog.search('', 'body weight', 'waist');
    expect(both.length).toBeGreaterThan(0);
    expect(both.every((x) => catalog.equipmentBucket(x.equipment) === 'body weight' && x.bodyPart === 'waist')).toBe(true);
    const onlyPart = catalog.search('', '全部', 'chest');
    expect(onlyPart.every((x) => x.bodyPart === 'chest')).toBe(true);
    const keywordAndBoth = catalog.search('平板支撑', 'body weight', 'waist');
    expect(keywordAndBoth.some((x) => x.id === '0464')).toBe(true);
  });
});
