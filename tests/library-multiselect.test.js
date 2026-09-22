const fs = require('fs');
const path = require('path');
const labels = require('../data/exercise-labels');
const catalog = require('../data/exercises');

const WXML = fs.readFileSync(path.join(__dirname, '../pages/library/library.wxml'), 'utf8');

describe('动作库原值中文表(唯一一处定义,页面与打卡页详情共用)', () => {
  test('部位行固定 9 个官方非 cardio 原值与中文标签', () => {
    expect(labels.BODY_PART_KEYS).toEqual([
      'back', 'chest', 'lower arms', 'lower legs', 'neck',
      'shoulders', 'upper arms', 'upper legs', 'waist',
    ]);
    expect(labels.BODY_PART_KEYS.map(labels.bodyPartLabel)).toEqual([
      '背', '胸', '前臂', '小腿', '颈', '肩', '上臂', '大腿', '腰腹',
    ]);
    // 每个官方部位都进表,不留英文回退
    labels.BODY_PART_KEYS.forEach((key) => {
      expect(labels.bodyPartLabel(key)).not.toBe(key);
    });
  });

  test('目录里的器械原值都有中文译名,未知原值回退英文', () => {
    const rawKeys = [...new Set(catalog.EXERCISES.map((item) => item.equipment))];
    expect(rawKeys.length).toBeGreaterThan(1);
    rawKeys.forEach((key) => {
      expect(labels.equipmentLabel(key)).toBe(labels.EQUIPMENT_LABELS[key] || key);
      expect(labels.equipmentLabel(key)).not.toBe('');
    });
    // 明确契约:未预置的原值原样回退,不猜不空
    expect(labels.equipmentLabel('suspension trainer')).toBe('suspension trainer');
    expect(labels.equipmentLabel('')).toBe('');
    expect(labels.equipmentLabel(undefined)).toBe('');
    expect(labels.bodyPartLabel('cardio')).toBe('cardio');
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
  test('两行用 wx:for 渲染,选中态与点击 key 都绑到原值', () => {
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
