function setup() {
  jest.resetModules();
  const storage = {};
  global.wx = {
    getStorageSync: k => storage[k],
    setStorageSync: (k, v) => { storage[k] = v; },
    removeStorageSync: k => { delete storage[k]; },
    navigateTo: jest.fn(),
    showToast: jest.fn(),
    getNetworkType: ({ success }) => success({ networkType: 'none' }),
    cloud: { database: () => { throw Error('offline'); } },
  };
  let definition;
  global.Page = p => { definition = p; };
  require('../pages/plan-day/plan-day');
  const page = Object.assign({}, definition, {
    data: Object.assign({}, definition.data),
    setData(values) { Object.assign(this.data, values); },
  });
  return { page, storage };
}
const settled = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
let warn;
beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { warn.mockRestore(); });

async function load(exercises) {
  const { page, storage } = setup();
  const plan = {
    id: 'local_board2', name: '力量循环', cursor: 0,
    cycleDays: [
      { dayId: 'push', name: '推日', exercises: [] },
      { dayId: 'pull', name: '胸 · 推日', exercises },
    ],
  };
  storage['fitness:plans'] = [plan];
  page.onLoad({ planId: plan.id, dayId: 'pull' });
  page.onShow();
  await settled();
  return { page, storage, plan };
}

test('refresh derives selected day kicker, catalog tags, image and weighted capsule without saving display fields', async () => {
  const item = { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', sets: 3, targetReps: 10, targetWeight: 60 };
  const { page, storage, plan } = await load([item]);
  const media = require('../data/exercises').findById(item.exerciseId);
  const labels = require('../data/exercise-labels');
  const { resolveMedia } = require('../data/media-root');
  expect(media.imagePath).toBeTruthy();
  expect(page.data.kicker).toBe('DAY 02 · 力量循环');
  expect(page.data.dayName).toBe('胸 · 推日');
  expect(page.data.exercises[0]).toMatchObject({
    index: 0, name: media.nameZh,
    bodyPartLabel: labels.bodyPartLabel(labels.bodyPartCategory(media)),
    equipmentLabel: '杠铃', imageSrc: resolveMedia(media.imagePath),
    prescription: '3 组 × 10 次 · 60 kg', isFirst: true, isLast: true,
  });
  expect(storage['fitness:plans']).toEqual([plan]);
  expect(page.plan.cycleDays[1].exercises).toEqual([item]);
});

test('bodyweight capsules show unweighted or additional weight; missing media stays blank', async () => {
  const base = { exerciseId: 'missing-board2', name: '自重动作', equipment: 'body weight', sets: 3, targetReps: 15 };
  const { page } = await load([
    { ...base, targetWeight: 0 }, { ...base, targetWeight: 7.5 },
  ]);
  expect(page.data.exercises.map(e => e.prescription)).toEqual([
    '3 组 × 15 次 · 自重', '3 组 × 15 次 · +7.5 kg',
  ]);
  expect(page.data.exercises[0]).toMatchObject({ imageSrc: '', bodyPartLabel: '', equipmentLabel: '自重', isFirst: true, isLast: false });
  expect(page.data.exercises[1]).toMatchObject({ isFirst: false, isLast: true });
});

test('image failure clears only the failed image and never changes the saved plan', async () => {
  const item = { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', sets: 3, targetReps: 10, targetWeight: 60 };
  const { page, storage, plan } = await load([item, item]);
  const second = page.data.exercises[1].imageSrc;
  page.onImageError({ currentTarget: { dataset: { index: '0' } } });
  expect(page.data.exercises[0].imageSrc).toBe('');
  expect(page.data.exercises[1].imageSrc).toBe(second);
  page.onImageError({ currentTarget: { dataset: { index: 'bad' } } });
  expect(storage['fitness:plans']).toEqual([plan]);
});

test('empty day still derives heading without fabricating exercises', async () => {
  const { page } = await load([]);
  expect(page.data.kicker).toBe('DAY 02 · 力量循环');
  expect(page.data.exercises).toEqual([]);
});
