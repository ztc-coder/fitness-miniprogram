const fs = require('fs');
const path = require('path');
const labels = require('../data/exercise-labels');
const catalog = require('../data/exercises');

const WXML = fs.readFileSync(path.join(__dirname, '../pages/library/library.wxml'), 'utf8');

describe('动作库原值中文表(唯一一处定义,页面与打卡页详情共用)', () => {
  test('部位行固定七类筛选键与中文标签,顺序为胸背肩手臂腿腰腹臀', () => {
    expect(labels.BODY_PART_KEYS).toEqual(['chest', 'back', 'shoulders', 'arms', 'legs', 'waist', 'glutes']);
    expect(labels.BODY_PART_KEYS.map(labels.bodyPartLabel)).toEqual([
      '胸', '背', '肩', '手臂', '腿', '腰腹', '臀',
    ]);
    // 每个筛选键都进表,不留英文回退
    labels.BODY_PART_KEYS.forEach((key) => {
      expect(labels.bodyPartLabel(key)).not.toBe(key);
    });
  });

  test('上游 bodyPart 归入七类:颈归肩、上/下臂归手臂、上/下腿归腿', () => {
    const category = (bodyPart, target) => labels.bodyPartCategory({ bodyPart, target });

    expect(category('chest', 'pectorals')).toBe('chest');
    expect(category('back', 'lats')).toBe('back');
    expect(category('shoulders', 'delts')).toBe('shoulders');
    expect(category('neck', 'levator scapulae')).toBe('shoulders');
    expect(category('upper arms', 'biceps')).toBe('arms');
    expect(category('lower arms', 'forearms')).toBe('arms');
    expect(category('upper legs', 'quads')).toBe('legs');
    expect(category('lower legs', 'calves')).toBe('legs');
    expect(category('waist', 'abs')).toBe('waist');
  });

  test('目标肌群 glutes 优先归臀,不与腿重复', () => {
    expect(labels.bodyPartCategory({ bodyPart: 'upper legs', target: 'glutes' })).toBe('glutes');
    expect(labels.bodyPartCategory({ bodyPart: 'upper legs', target: 'quads' })).toBe('legs');
    // 未知原值回退原值,不静默归入七类
    expect(labels.bodyPartCategory({ bodyPart: 'cardio', target: 'abs' })).toBe('cardio');
    expect(labels.bodyPartCategory(null)).toBe('');
    expect(labels.bodyPartCategory(undefined)).toBe('');
  });

  test('目录里的器械原值都有中文译名,未知原值回退英文', () => {
    const rawKeys = [...new Set(catalog.EXERCISES.map((item) => item.equipment))];
    expect(rawKeys.length).toBeGreaterThan(1);
    rawKeys.forEach((key) => {
      // 全目录覆盖:每个当前原值都在中文表里,标签是中文而不是回退的英文原值
      expect(labels.EQUIPMENT_LABELS[key]).toBeTruthy();
      expect(labels.equipmentLabel(key)).not.toBe(key);
      expect(labels.equipmentLabel(key)).not.toBe('');
      expect(labels.equipmentLabel(key)).not.toMatch(/[A-Za-z]/);
    });
    // 明确契约:未预置的原值原样回退,不猜不空
    expect(labels.equipmentLabel('suspension trainer')).toBe('suspension trainer');
    expect(labels.equipmentLabel('')).toBe('');
    expect(labels.equipmentLabel(undefined)).toBe('');
    expect(labels.bodyPartLabel('cardio')).toBe('cardio');
  });

  test('有中文译名的器械原值都进固定序表,与「已知原值」口径一致', () => {
    Object.keys(labels.EQUIPMENT_LABELS).forEach((key) => {
      expect(labels.EQUIPMENT_ORDER).toContain(key);
    });
  });

  test('assisted 与 body weight 是两个独立原值,不被归并成同一胶囊', () => {
    const keys = labels.equipmentKeys([
      { equipment: 'body weight' },
      { equipment: 'assisted' },
    ]);

    expect(keys).toContain('body weight');
    expect(keys).toContain('assisted');
    expect(keys).toHaveLength(2);
    expect(labels.equipmentLabel('body weight')).toBe('自重');
    expect(labels.equipmentLabel('assisted')).not.toBe(labels.equipmentLabel('body weight'));
  });

  test('器械胶囊稳定排序:已知原值走固定序表,未知原值按字母序追加,去重', () => {
    const keys = labels.equipmentKeys([
      { equipment: 'body weight' },
      { equipment: 'zzz rig' },
      { equipment: 'dumbbell' },
      { equipment: 'aaa rack' },
      { equipment: 'dumbbell' },
      { equipment: 'barbell' },
    ]);

    expect(keys).toEqual(['barbell', 'dumbbell', 'body weight', 'aaa rack', 'zzz rig']);
    expect(labels.equipmentKeys([])).toEqual([]);
    expect(labels.equipmentKeys(undefined)).toEqual([]);
  });

  test('器械胶囊集合等于发布目录实际出现的原值,顺序稳定可复现', () => {
    const rawKeys = [...new Set(catalog.EXERCISES.map((item) => item.equipment))];
    const keys = labels.equipmentKeys(catalog.EXERCISES);

    expect([...keys].sort()).toEqual([...rawKeys].sort());
    expect(keys).toEqual(labels.equipmentKeys(catalog.EXERCISES));
    // 固定序表内的原值按表序,不按目录出现序
    const known = keys.filter((key) => labels.EQUIPMENT_ORDER.indexOf(key) !== -1);
    expect(known).toEqual(labels.EQUIPMENT_ORDER.filter((key) => keys.indexOf(key) !== -1));
  });
});

describe('动作库页 WXML 胶囊绑定', () => {
  test('两行用 wx:for 渲染,选中态与点击 key 都绑到筛选键', () => {
    expect(WXML).toContain('wx:for="{{equipmentFilters}}"');
    expect(WXML).toContain('wx:for="{{bodyPartFilters}}"');
    expect(WXML.match(/data-key="\{\{item\.key\}\}"/g)).toHaveLength(2);
    expect(WXML).toContain("class=\"filter-pill {{item.active ? 'active' : ''}}\"");
    expect(WXML).toContain('bindtap="onEquipFilterTap"');
    expect(WXML).toContain('bindtap="onBodyPartFilterTap"');
    // 旧归并桶 dataset 已退役
    expect(WXML).not.toContain('data-bucket');
  });
});
