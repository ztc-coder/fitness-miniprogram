/**
 * 数据访问层「云主本地降级」外部行为测试
 * 重点:云端不可用时,写操作仍通过本地缓存写穿生效(修复"新建计划无反应")
 */

// 内存版本地存储 + 可控的云端,模拟未开通/无网环境
function mockWx({ cloudOk = false, cloudPlans = null, cloudSessions = null } = {}) {
  const storage = {};
  const calls = {};
  let cloudAvailable = cloudOk;
  const cloudDocs = {
    plans: cloudPlans ? JSON.parse(JSON.stringify(cloudPlans)) : [],
    sessions: cloudSessions ? JSON.parse(JSON.stringify(cloudSessions)) : [],
  };
  const rejected = () => Promise.reject(new Error('cloud unavailable'));
  const collection = (name) => ({
    orderBy: () => collection(name),
    limit: () => collection(name),
    get: () =>
      cloudAvailable
        ? Promise.resolve({ data: JSON.parse(JSON.stringify(cloudDocs[name] || [])) })
        : rejected(),
    add: (payload) => {
      calls[`${name}:add`] = (calls[`${name}:add`] || 0) + 1;
      if (!cloudAvailable) return rejected();
      cloudDocs[name] = (cloudDocs[name] || []).concat([
        Object.assign({ _id: 'cloud_generated_id' }, payload && payload.data),
      ]);
      return Promise.resolve({ _id: 'cloud_generated_id' });
    },
    doc: (docId) => ({
      update: (payload) => {
        calls[`${name}:update`] = (calls[`${name}:update`] || 0) + 1;
        if (!cloudAvailable) return rejected();
        cloudDocs[name] = (cloudDocs[name] || []).map((d) =>
          d._id === docId ? Object.assign({}, d, payload && payload.data) : d
        );
        return Promise.resolve({});
      },
      remove: () => {
        calls[`${name}:remove`] = (calls[`${name}:remove`] || 0) + 1;
        if (!cloudAvailable) return rejected();
        cloudDocs[name] = (cloudDocs[name] || []).filter((d) => d._id !== docId);
        return Promise.resolve({});
      },
    }),
  });
  global.wx = {
    getStorageSync: (k) => storage[k],
    setStorageSync: (k, v) => {
      storage[k] = v;
    },
    cloud: { database: () => ({ collection }) },
  };
  return { storage, calls, cloudDocs, setCloudOk: (v) => { cloudAvailable = v; } };
}

function loadDb() {
  jest.resetModules();
  return require('../utils/db');
}

const buildLocalPlan = (overrides = {}) =>
  Object.assign(
    { id: 'local_plan_1', name: '力量循环', cursor: 0, active: true, cycleDays: [] },
    overrides
  );

describe('savePlan 本地写穿', () => {
  test('云端失败时新建计划仍写入本地缓存并 resolve', () => {
    const { storage } = mockWx({ cloudOk: false });
    const db = loadDb();
    const plan = buildLocalPlan();
    return db.savePlan(plan).then((saved) => {
      expect(saved.id).toBe('local_plan_1');
      expect(storage['fitness:plans']).toHaveLength(1);
      expect(storage['fitness:plans'][0].name).toBe('力量循环');
    });
  });

  test('再次读取能取回刚保存的计划(fetchPlans 云失败降级本地)', () => {
    mockWx({ cloudOk: false });
    const db = loadDb();
    return db
      .savePlan(buildLocalPlan())
      .then(() => db.fetchPlans())
      .then((plans) => {
        expect(plans).toHaveLength(1);
        expect(plans[0].id).toBe('local_plan_1');
      });
  });

  test('同 id 再次保存为更新而非新增', () => {
    const { storage } = mockWx({ cloudOk: false });
    const db = loadDb();
    return db
      .savePlan(buildLocalPlan())
      .then(() => db.savePlan(buildLocalPlan({ name: '改名后' })))
      .then(() => {
        expect(storage['fitness:plans']).toHaveLength(1);
        expect(storage['fitness:plans'][0].name).toBe('改名后');
      });
  });

  test('云端成功时用返回的正式 id 替换本地 local_ 记录', () => {
    const { storage } = mockWx({ cloudOk: true });
    const db = loadDb();
    return db.savePlan(buildLocalPlan()).then((saved) => {
      expect(saved.id).toBe('cloud_generated_id');
      expect(storage['fitness:plans']).toHaveLength(1);
      expect(storage['fitness:plans'][0].id).toBe('cloud_generated_id');
    });
  });
});

describe('deletePlan 本地删除', () => {
  test('云端失败也能从本地移除', () => {
    const { storage } = mockWx({ cloudOk: false });
    const db = loadDb();
    return db
      .savePlan(buildLocalPlan())
      .then(() => db.deletePlan('local_plan_1'))
      .then(() => {
        expect(storage['fitness:plans']).toHaveLength(0);
      });
  });
});

describe('normalizePlan 旧 slug 计划迁移', () => {
  const buildSlugPlan = () => ({
    id: 'plan_old',
    name: '力量循环',
    cursor: 0,
    active: true,
    cycleDays: [
      {
        dayId: 'push',
        name: '推',
        exercises: [
          { exerciseId: 'bench-press', name: '杠铃卧推', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 60 },
        ],
      },
      {
        dayId: 'legs',
        name: '腿',
        exercises: [
          { exerciseId: 'leg-press', name: '腿举', equipment: 'machine', sets: 3, targetReps: 10, targetWeight: 120 },
          { exerciseId: 'unknown-move', name: '查不到的动作', equipment: 'other', sets: 2, targetReps: 5, targetWeight: 10 },
        ],
      },
    ],
  });

  test('含 slug 的计划读出后 exerciseId 解析为数字 id,name/equipment 与目录对齐,组数目标不变', () => {
    const { storage } = mockWx({ cloudOk: false });
    storage['fitness:plans'] = [buildSlugPlan()];
    const db = loadDb();
    return db.fetchPlans().then((plans) => {
      expect(plans).toHaveLength(1);
      const push = plans[0].cycleDays[0].exercises[0];
      expect(push.exerciseId).toBe('0025');
      expect(push.name).toBe('杠铃卧推');
      expect(push.equipment).toBe('barbell');
      expect(push.sets).toBe(4);
      expect(push.targetReps).toBe(8);
      expect(push.targetWeight).toBe(60);
      const legPress = plans[0].cycleDays[1].exercises[0];
      expect(legPress.exerciseId).toBe('0739');
      expect(legPress.equipment).toBe('sled machine');
      expect(legPress.sets).toBe(3);
    });
  });

  test('查不到目录的 exerciseId 在目录裁剪迁移中被删除', () => {
    const { storage } = mockWx({ cloudOk: false });
    storage['fitness:plans'] = [buildSlugPlan()];
    const db = loadDb();
    return db.migratePlansForCatalog().then((plans) => {
      const legs = plans[0].cycleDays.find((d) => d.dayId === 'legs');
      expect(legs.exercises.map((e) => e.exerciseId)).toEqual(['0739']);
      expect(storage['fitness:planMigrationVersion']).toBe(3);
    });
  });
});

describe('目录裁剪迁移(最终 136 条目录 v3)', () => {
  const catalog = require('../data/exercises');

  const buildMixedPlan = () => ({
    id: 'plan_mixed',
    name: '旧计划',
    cursor: 1,
    active: true,
    cycleDays: [
      {
        dayId: 'push',
        name: '推',
        exercises: [
          { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 60 },
          { exerciseId: '0994', name: '弹力带反握腕弯举', equipment: 'band', sets: 3, targetReps: 12, targetWeight: 10 },
        ],
      },
      {
        dayId: 'arms',
        name: '手臂',
        exercises: [
          { exerciseId: '9999', name: '已下架动作', equipment: 'other', sets: 3, targetReps: 10, targetWeight: 10 },
        ],
      },
    ],
  });

  // 最终 136 条目录裁掉的两条:0200(纯附件重复的绳索下压)、0673(反握器械下拉)
  const buildRemovedIdsPlan = () => ({
    id: 'plan_removed_ids',
    name: '含被删动作的计划',
    cursor: 0,
    active: true,
    cycleDays: [
      {
        dayId: 'push',
        name: '推',
        exercises: [
          { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 60 },
          { exerciseId: '0200', name: '绳索下压(附件变式)', equipment: 'cable', sets: 3, targetReps: 12, targetWeight: 20 },
        ],
      },
      {
        dayId: 'pull',
        name: '拉',
        exercises: [
          { exerciseId: '0673', name: '反握器械下拉', equipment: 'machine', sets: 3, targetReps: 10, targetWeight: 40 },
        ],
      },
    ],
  });

  test('0200/0673 从计划移除且无 replacement:不改成 0201/0198/2616,移除后为空的训练日删除', () => {
    expect(catalog.findById('0200')).toBeNull();
    expect(catalog.findById('0673')).toBeNull();
    const { storage } = mockWx({ cloudOk: false });
    storage['fitness:plans'] = [buildRemovedIdsPlan()];
    const db = loadDb();
    return db.migratePlansForCatalog().then((plans) => {
      expect(plans).toHaveLength(1);
      // 只含 0673 的训练日随动作移除被删,推日保留有效动作
      expect(plans[0].cycleDays.map((d) => d.dayId)).toEqual(['push']);
      const ids = plans[0].cycleDays.reduce(
        (all, day) => all.concat(day.exercises.map((e) => e.exerciseId)),
        []
      );
      expect(ids).toEqual(['0025']);
      ['0200', '0673', '0201', '0198', '2616'].forEach((id) => expect(ids).not.toContain(id));
      expect(storage['fitness:planMigrationVersion']).toBe(3);
      expect(storage['fitness:plans'][0].cycleDays.map((d) => d.dayId)).toEqual(['push']);
    });
  });

  test('既有计划的有效动作原样保留,新增目录动作不自动注入', () => {
    const plan = {
      id: 'local_valid',
      name: '全有效计划',
      cursor: 1,
      active: true,
      cycleDays: [
        {
          dayId: 'push',
          name: '推',
          exercises: [
            { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 60 },
          ],
        },
        {
          dayId: 'legs',
          name: '腿',
          exercises: [
            { exerciseId: '0739', name: '腿举', equipment: 'sled machine', sets: 3, targetReps: 10, targetWeight: 120 },
          ],
        },
      ],
    };
    const { storage } = mockWx({ cloudOk: false });
    storage['fitness:plans'] = [plan];
    const db = loadDb();
    return db.migratePlansForCatalog().then((plans) => {
      expect(plans[0].cycleDays).toEqual(plan.cycleDays);
      expect(plans[0].cursor).toBe(1);
      const ids = plans[0].cycleDays.reduce(
        (all, day) => all.concat(day.exercises.map((e) => e.exerciseId)),
        []
      );
      // 新增的 34 条只在用户手动添加时出现
      ['0017', '0216', '2616', '3699'].forEach((id) => expect(ids).not.toContain(id));
      expect(storage['fitness:plans'][0].cycleDays).toEqual(plan.cycleDays);
    });
  });

  test('删除当前训练日后游标环回下一个有效日,本地写穿', () => {
    const { storage } = mockWx({ cloudOk: false });
    storage['fitness:plans'] = [buildMixedPlan()];
    const db = loadDb();
    return db.ensureSeedPlans().then((plans) => {
      expect(plans).toHaveLength(1);
      expect(plans[0].id).toBe('plan_mixed');
      expect(plans[0].cursor).toBe(0);
      expect(plans[0].cycleDays.map((d) => d.dayId)).toEqual(['push']);
      expect(plans[0].cycleDays[0].exercises.map((e) => e.exerciseId)).toEqual(['0025']);
      expect(storage['fitness:plans'][0].cursor).toBe(0);
      expect(storage['fitness:planMigrationVersion']).toBe(3);
    });
  });

  test('删除游标之前的训练日后仍指向同一个当前日,并同步云端新索引', () => {
    const cloudPlan = {
      _id: 'plan_cursor_shift',
      name: '游标迁移',
      cursor: 1,
      active: true,
      cycleDays: [
        { dayId: 'removed', name: '下架日', exercises: [{ exerciseId: '9999', name: '下架动作' }] },
        { dayId: 'current', name: '当前日', exercises: [{ exerciseId: '0025', name: '杠铃卧推' }] },
        { dayId: 'next', name: '下一日', exercises: [{ exerciseId: '0739', name: '杠铃深蹲' }] },
      ],
    };
    const mock = mockWx({ cloudOk: true, cloudPlans: [cloudPlan] });
    const db = loadDb();
    return db.migratePlansForCatalog().then((plans) => {
      expect(plans[0].cycleDays.map((day) => day.dayId)).toEqual(['current', 'next']);
      expect(plans[0].cursor).toBe(0);
      expect(plans[0].cycleDays[plans[0].cursor].dayId).toBe('current');
      expect(mock.cloudDocs.plans[0].cursor).toBe(0);
    });
  });

  test('当前训练日被删除时选择原顺序的下一个有效日', () => {
    const plan = {
      id: 'local_cursor_next',
      name: '游标后继',
      cursor: 1,
      active: true,
      cycleDays: [
        { dayId: 'previous', name: '前一日', exercises: [{ exerciseId: '0025', name: '杠铃卧推' }] },
        { dayId: 'removed', name: '下架日', exercises: [{ exerciseId: '9999', name: '下架动作' }] },
        { dayId: 'next', name: '下一日', exercises: [{ exerciseId: '0739', name: '杠铃深蹲' }] },
      ],
    };
    const { storage } = mockWx({ cloudOk: false });
    storage['fitness:plans'] = [plan];
    const db = loadDb();
    return db.migratePlansForCatalog().then((plans) => {
      expect(plans[0].cycleDays.map((day) => day.dayId)).toEqual(['previous', 'next']);
      expect(plans[0].cursor).toBe(1);
      expect(plans[0].cycleDays[plans[0].cursor].dayId).toBe('next');
    });
  });

  test('无训练日的计划被整份删除,历史 session 集合零写入', () => {
    const { storage, calls } = mockWx({ cloudOk: false });
    storage['fitness:plans'] = [
      buildMixedPlan(),
      buildLocalPlan({ id: 'plan_empty', cycleDays: [] }),
    ];
    const db = loadDb();
    return db.migratePlansForCatalog().then((plans) => {
      expect(plans.map((p) => p.id)).toEqual(['plan_mixed']);
      expect(storage['fitness:plans']).toHaveLength(1);
      expect(Object.keys(calls).filter((k) => k.startsWith('sessions:'))).toEqual([]);
    });
  });

  test('目录迁移保留历史 session 的完整快照,不读取或改写 sessions', () => {
    const historicalSession = {
      _id: 'session_1',
      planId: 'plan_mixed',
      dayId: 'push',
      exercises: [
        {
          exerciseId: '0994',
          name: '历史动作',
          equipment: 'band',
          sets: [{ weight: 10, reps: 12 }],
        },
      ],
      submittedAt: 123,
    };
    const mock = mockWx({
      cloudOk: true,
      cloudPlans: [Object.assign(buildMixedPlan(), { _id: 'plan_mixed' })],
      cloudSessions: [historicalSession],
    });
    const db = loadDb();
    return db.migratePlansForCatalog().then(() => {
      expect(mock.cloudDocs.sessions).toEqual([historicalSession]);
      expect(mock.calls['sessions:get']).toBeUndefined();
      expect(mock.calls['sessions:update']).toBeUndefined();
      expect(mock.calls['sessions:remove']).toBeUndefined();
      expect(mock.calls['sessions:add']).toBeUndefined();
    });
  });

  test('迁移版本化且幂等:重复执行不重复写云端,不改既有有效计划', () => {
    const cloudPlan = Object.assign(buildMixedPlan(), { _id: 'plan_mixed' });
    const { calls } = mockWx({ cloudOk: true, cloudPlans: [cloudPlan] });
    const db = loadDb();
    return db
      .migratePlansForCatalog()
      .then((first) =>
        db.migratePlansForCatalog().then((second) => [first, second, calls])
      )
      .then(([first, second, c]) => {
        expect(first[0].cycleDays.map((d) => d.dayId)).toEqual(['push']);
        expect(second).toEqual(first);
        expect(c['plans:update']).toBe(1);
        expect(c['plans:add']).toBeUndefined();
        expect(c['plans:remove']).toBeUndefined();
        expect(Object.keys(c).filter((k) => k.startsWith('sessions:'))).toEqual([]);
      });
  });

  test('云端不可达时本地迁移生效且不发起云写,联网后再补偿', () => {
    const { storage, calls } = mockWx({ cloudOk: false });
    storage['fitness:plans'] = [buildMixedPlan()];
    const db = loadDb();
    return db
      .migratePlansForCatalog()
      .then(() => db.migratePlansForCatalog())
      .then(() => {
        expect(storage['fitness:planMigrationVersion']).toBe(3);
        expect(calls['plans:update']).toBeUndefined();
      });
  });

  test('v2 已完成迁移的设备升级到最终 136 条目录后重新裁剪:裁动作、删空日、删空计划,sessions 零写入', () => {
    const allRemovedCycleDays = [
      {
        dayId: 'push',
        name: '推',
        exercises: [
          { exerciseId: '0994', name: '弹力带反握腕弯举', equipment: 'band', sets: 3, targetReps: 12, targetWeight: 10 },
        ],
      },
    ];
    // v2 已同步设备的云端与本地一致
    const mock = mockWx({
      cloudOk: true,
      cloudPlans: [
        Object.assign(buildMixedPlan(), { _id: 'plan_mixed' }),
        Object.assign(buildLocalPlan({ id: 'plan_all_removed', cycleDays: allRemovedCycleDays }), { _id: 'plan_all_removed' }),
      ],
    });
    // 精选目录迁移(v2)已完成,本地与云端键都落在 2
    mock.storage['fitness:planMigrationVersion'] = 2;
    mock.storage['fitness:planMigrationCloudSynced'] = 2;
    mock.storage['fitness:plans'] = [
      buildMixedPlan(),
      buildLocalPlan({ id: 'plan_all_removed', cycleDays: allRemovedCycleDays }),
    ];
    const db = loadDb();
    return db.migratePlansForCatalog().then((plans) => {
      // 含有效动作的计划被裁剪,空训练日删除;全部动作被移除的计划整份删除
      expect(plans.map((p) => p.id)).toEqual(['plan_mixed']);
      expect(plans[0].cycleDays.map((d) => d.dayId)).toEqual(['push']);
      expect(plans[0].cycleDays[0].exercises.map((e) => e.exerciseId)).toEqual(['0025']);
      // 空计划本地删除、云端删除,版本升级到 3
      expect(mock.storage['fitness:plans'].map((p) => p.id)).toEqual(['plan_mixed']);
      expect(mock.calls['plans:remove']).toBe(1);
      expect(mock.storage['fitness:planMigrationVersion']).toBe(3);
      expect(mock.storage['fitness:planMigrationCloudSynced']).toBe(3);
      // 历史 session 集合零写入
      expect(Object.keys(mock.calls).filter((k) => k.startsWith('sessions:'))).toEqual([]);
    });
  });

  test('v2 离线升级到 v3:本地裁剪立即生效,联网恢复后补偿云端且不重复写', () => {
    const cloudPlan = Object.assign(buildMixedPlan(), { _id: 'plan_mixed' });
    const mock = mockWx({ cloudOk: false, cloudPlans: [cloudPlan] });
    mock.storage['fitness:planMigrationVersion'] = 2;
    mock.storage['fitness:planMigrationCloudSynced'] = 2;
    mock.storage['fitness:plans'] = [buildMixedPlan()];
    const db = loadDb();
    return db
      .migratePlansForCatalog()
      .then(() => {
        // 离线:本地已裁剪并落 v3,云端同步键保持 v2 不动,不做注定失败的云写
        expect(mock.storage['fitness:planMigrationVersion']).toBe(3);
        expect(mock.storage['fitness:planMigrationCloudSynced']).toBe(2);
        expect(mock.calls['plans:update']).toBeUndefined();
        // 联网恢复:读取未裁剪云端计划,迁移重试补齐云端
        mock.setCloudOk(true);
        return db.migratePlansForCatalog();
      })
      .then((retried) => {
        expect(retried[0].cycleDays.map((d) => d.dayId)).toEqual(['push']);
        expect(mock.calls['plans:update']).toBe(1);
        expect(mock.storage['fitness:planMigrationCloudSynced']).toBe(3);
        expect(mock.storage['fitness:plans'][0].cycleDays[0].exercises.map((e) => e.exerciseId)).toEqual(['0025']);
        // 成功后再执行不再重复写云端
        return db.migratePlansForCatalog();
      })
      .then((again) => {
        expect(again[0].cycleDays.map((d) => d.dayId)).toEqual(['push']);
        expect(mock.calls['plans:update']).toBe(1);
        expect(mock.calls['plans:add']).toBeUndefined();
        expect(mock.calls['plans:remove']).toBeUndefined();
      });
  });

  test('离线迁移云端失败后,联网恢复重试云端裁剪,成功后不重复写', () => {
    const cloudPlan = Object.assign(buildMixedPlan(), { _id: 'plan_mixed' });
    const mock = mockWx({ cloudOk: false, cloudPlans: [cloudPlan] });
    mock.storage['fitness:plans'] = [buildMixedPlan()];
    const db = loadDb();
    return db
      .migratePlansForCatalog()
      .then(() => {
        // 离线:本地已裁剪并落本地版本,云端同步版本不落定且不发起云写
        expect(mock.storage['fitness:planMigrationVersion']).toBe(3);
        expect(mock.storage['fitness:planMigrationCloudSynced']).toBeUndefined();
        expect(mock.calls['plans:update']).toBeUndefined();
        // 联网恢复:读取未裁剪的云端旧计划并重试
        mock.setCloudOk(true);
        return db.migratePlansForCatalog();
      })
      .then((retried) => {
        expect(retried[0].cycleDays.map((d) => d.dayId)).toEqual(['push']);
        expect(mock.calls['plans:update']).toBe(1);
        expect(mock.storage['fitness:planMigrationCloudSynced']).toBe(3);
        expect(mock.storage['fitness:plans'][0].cycleDays[0].exercises.map((e) => e.exerciseId)).toEqual(['0025']);
        // 成功后再执行不再重复写云端
        return db.migratePlansForCatalog();
      })
      .then((again) => {
        expect(again[0].cycleDays.map((d) => d.dayId)).toEqual(['push']);
        expect(mock.calls['plans:update']).toBe(1);
        expect(mock.calls['plans:add']).toBeUndefined();
        expect(mock.calls['plans:remove']).toBeUndefined();
      });
  });
});

describe('目录裁剪迁移保留未上云的 local_ 计划', () => {
  const catalog = require('../data/exercises');

  // 0994(弹力带反握腕弯举)不在最终 136 条目录里,裁剪后只留 0025
  const buildPendingLocalPlan = () =>
    buildLocalPlan({
      id: 'local_plan_pending',
      name: '待上云计划',
      cursor: 0,
      cycleDays: [
        {
          dayId: 'push',
          name: '推',
          exercises: [
            { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 60 },
            { exerciseId: '0994', name: '弹力带反握腕弯举', equipment: 'band', sets: 3, targetReps: 12, targetWeight: 10 },
          ],
        },
      ],
    });

  test('云端可读但为空:local_ 计划不丢,裁剪后上云并换成云端正式 id,两个版本键落 3', () => {
    expect(catalog.findById('0994')).toBeNull();
    const mock = mockWx({ cloudOk: true, cloudPlans: [] });
    mock.storage['fitness:plans'] = [buildPendingLocalPlan()];
    const db = loadDb();
    return db.migratePlansForCatalog().then((plans) => {
      // 本地计划保留、裁剪并上云
      expect(mock.calls['plans:add']).toBe(1);
      expect(mock.cloudDocs.plans).toHaveLength(1);
      expect(mock.cloudDocs.plans[0].cycleDays[0].exercises.map((e) => e.exerciseId)).toEqual(['0025']);
      // 本地记录换成云端正式 id,本地不丢
      expect(plans.map((p) => p.id)).toEqual(['cloud_generated_id']);
      expect(mock.storage['fitness:plans'].map((p) => p.id)).toEqual(['cloud_generated_id']);
      expect(mock.storage['fitness:plans'][0].cycleDays[0].exercises.map((e) => e.exerciseId)).toEqual(['0025']);
      // 本地与云端版本键都落 3
      expect(mock.storage['fitness:planMigrationVersion']).toBe(3);
      expect(mock.storage['fitness:planMigrationCloudSynced']).toBe(3);
      // 历史 session 集合零写入
      expect(Object.keys(mock.calls).filter((k) => k.startsWith('sessions:'))).toEqual([]);
      // 幂等:两个版本键落定后不再重复上云
      return db.migratePlansForCatalog().then((again) => {
        expect(again.map((p) => p.id)).toEqual(['cloud_generated_id']);
        expect(mock.calls['plans:add']).toBe(1);
        expect(mock.calls['plans:update']).toBeUndefined();
      });
    });
  });

  test('local_ 计划已无需裁剪但云端缺失时仍补上云,本地换成云端正式 id', () => {
    const mock = mockWx({ cloudOk: true, cloudPlans: [] });
    mock.storage['fitness:plans'] = [
      buildLocalPlan({
        id: 'local_plan_valid',
        name: '已有效计划',
        cursor: 0,
        cycleDays: [
          {
            dayId: 'push',
            name: '推',
            exercises: [
              { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 60 },
            ],
          },
        ],
      }),
    ];
    const db = loadDb();
    return db.migratePlansForCatalog().then((plans) => {
      expect(mock.calls['plans:add']).toBe(1);
      expect(plans.map((p) => p.id)).toEqual(['cloud_generated_id']);
      expect(plans[0].cycleDays[0].exercises.map((e) => e.exerciseId)).toEqual(['0025']);
      expect(mock.storage['fitness:plans'].map((p) => p.id)).toEqual(['cloud_generated_id']);
      expect(mock.storage['fitness:planMigrationCloudSynced']).toBe(3);
    });
  });

  test('云端已有计划与本地 local_ 计划并存:按 id 合并去重,云端正式 id 以云端为真相', () => {
    const cloudPlan = {
      _id: 'plan_cloud',
      name: '云端计划',
      cursor: 0,
      active: true,
      cycleDays: [
        {
          dayId: 'pull',
          name: '拉',
          exercises: [
            { exerciseId: '0652', name: '引体向上', equipment: 'body weight', sets: 4, targetReps: 6, targetWeight: 0 },
            { exerciseId: '9999', name: '已下架动作', equipment: 'other', sets: 3, targetReps: 10, targetWeight: 10 },
          ],
        },
      ],
    };
    const mock = mockWx({ cloudOk: true, cloudPlans: [cloudPlan] });
    mock.storage['fitness:plans'] = [
      // 同一云端 id 的本地旧副本:内容与云端不同,不得覆盖云端真相
      buildLocalPlan({
        id: 'plan_cloud',
        name: '本地旧副本',
        cycleDays: [
          { dayId: 'stale', name: '旧日', exercises: [{ exerciseId: '0025', name: '杠铃卧推' }] },
        ],
      }),
      buildPendingLocalPlan(),
    ];
    const db = loadDb();
    return db.migratePlansForCatalog().then((plans) => {
      // 按 id 合并去重:云端计划 + 本地待上云计划,无重复
      expect(plans.map((p) => p.id)).toEqual(['plan_cloud', 'cloud_generated_id']);
      expect(mock.storage['fitness:plans'].map((p) => p.id)).toEqual(['plan_cloud', 'cloud_generated_id']);
      // 云端正式 id 以云端为真相:本地旧副本的 stale 日不生效,按云端内容裁剪后回写
      expect(plans[0].cycleDays.map((d) => d.dayId)).toEqual(['pull']);
      expect(plans[0].cycleDays[0].exercises.map((e) => e.exerciseId)).toEqual(['0652']);
      expect(mock.calls['plans:update']).toBe(1);
      const synced = mock.cloudDocs.plans.find((d) => d._id === 'plan_cloud');
      expect(synced.cycleDays[0].exercises.map((e) => e.exerciseId)).toEqual(['0652']);
      // 本地待上云计划同样上云,两个版本键落 3
      expect(mock.calls['plans:add']).toBe(1);
      expect(mock.cloudDocs.plans).toHaveLength(2);
      expect(mock.storage['fitness:planMigrationVersion']).toBe(3);
      expect(mock.storage['fitness:planMigrationCloudSynced']).toBe(3);
      expect(Object.keys(mock.calls).filter((k) => k.startsWith('sessions:'))).toEqual([]);
    });
  });

  test('离线时 local_ 计划保留在本地并裁剪,联网恢复后补上云,云端版本键先不落定后落定', () => {
    const mock = mockWx({ cloudOk: false, cloudPlans: [] });
    mock.storage['fitness:plans'] = [buildPendingLocalPlan()];
    const db = loadDb();
    return db
      .migratePlansForCatalog()
      .then((offline) => {
        // 离线:本地裁剪立即生效,计划不丢,云端同步键不落定
        expect(offline.map((p) => p.id)).toEqual(['local_plan_pending']);
        expect(mock.storage['fitness:plans'].map((p) => p.id)).toEqual(['local_plan_pending']);
        expect(mock.storage['fitness:plans'][0].cycleDays[0].exercises.map((e) => e.exerciseId)).toEqual(['0025']);
        expect(mock.storage['fitness:planMigrationVersion']).toBe(3);
        expect(mock.storage['fitness:planMigrationCloudSynced']).toBeUndefined();
        expect(mock.cloudDocs.plans).toHaveLength(0);
        // 联网恢复:补上云并换成云端正式 id,云端同步键落定
        mock.setCloudOk(true);
        return db.migratePlansForCatalog();
      })
      .then((retried) => {
        expect(mock.calls['plans:add']).toBe(1);
        expect(retried.map((p) => p.id)).toEqual(['cloud_generated_id']);
        expect(mock.cloudDocs.plans).toHaveLength(1);
        expect(mock.storage['fitness:plans'].map((p) => p.id)).toEqual(['cloud_generated_id']);
        expect(mock.storage['fitness:planMigrationCloudSynced']).toBe(3);
        // 成功后再执行不再重复上云
        return db.migratePlansForCatalog();
      })
      .then((again) => {
        expect(again.map((p) => p.id)).toEqual(['cloud_generated_id']);
        expect(mock.calls['plans:add']).toBe(1);
        expect(mock.calls['plans:update']).toBeUndefined();
      });
  });
});

describe('ensureSeedPlans 数据集 id 种子', () => {
  const catalog = require('../data/exercises');

  test('新种子每条 exerciseId 均为 4 位数字 id,且 name/equipment 与动作库一致', () => {
    mockWx({ cloudOk: false });
    const db = loadDb();
    return db.ensureSeedPlans().then((plans) => {
      expect(plans).toHaveLength(1);
      const exercises = plans[0].cycleDays.reduce(
        (all, day) => all.concat(day.exercises),
        []
      );
      expect(exercises.length).toBe(14);
      exercises.forEach((ex) => {
        expect(ex.exerciseId).toMatch(/^\d{4}$/);
        const found = catalog.findById(ex.exerciseId);
        expect(found).not.toBeNull();
        expect(ex.name).toBe(found.nameZh);
        expect(ex.equipment).toBe(found.equipment);
      });
    });
  });

  test('种子 0314 沿用冻结名「上斜哑铃卧推」且与目录一致', () => {
    mockWx({ cloudOk: false });
    const db = loadDb();
    return db.ensureSeedPlans().then((plans) => {
      const incline = plans[0].cycleDays
        .reduce((all, day) => all.concat(day.exercises), [])
        .find((ex) => ex.exerciseId === '0314');
      expect(incline).toBeDefined();
      expect(incline.name).toBe('上斜哑铃卧推');
      expect(incline.name).toBe(catalog.findById('0314').nameZh);
    });
  });

  test('腿举用数据集原值 sled machine,不是字面 machine', () => {
    mockWx({ cloudOk: false });
    const db = loadDb();
    return db.ensureSeedPlans().then((plans) => {
      const legPress = plans[0].cycleDays
        .reduce((all, day) => all.concat(day.exercises), [])
        .find((ex) => ex.exerciseId === '0739');
      expect(legPress).toBeDefined();
      expect(legPress.equipment).toBe('sled machine');
    });
  });

  test('演示计划为胸三/背二/肩腿,肩腿日含肩部动作且全计划不预置腹部', () => {
    mockWx({ cloudOk: false });
    const db = loadDb();
    return db.ensureSeedPlans().then((plans) => {
      const days = plans[0].cycleDays;
      expect(days.map((d) => d.name)).toEqual(['胸三', '背二', '肩腿']);
      const legDay = days[2].exercises.map((ex) => catalog.findById(ex.exerciseId));
      expect(legDay.some((x) => x.target === 'delts')).toBe(true);
      const all = days
        .reduce((allDays, d) => allDays.concat(d.exercises), [])
        .map((ex) => catalog.findById(ex.exerciseId));
      expect(all.every((x) => x !== null)).toBe(true);
      expect(all.some((x) => x.target === 'abs')).toBe(false);
    });
  });

  test('本地已记过旧 version 且无计划时能重新种入新种子', () => {
    const { storage } = mockWx({ cloudOk: false });
    storage['fitness:seedVersion'] = 1;
    const db = loadDb();
    return db.ensureSeedPlans().then((plans) => {
      expect(plans).toHaveLength(1);
      expect(plans[0].cycleDays[0].exercises[0].exerciseId).toBe('0025');
      expect(storage['fitness:seedVersion']).toBe(3);
    });
  });

  test('已有旧计划的用户不重种,迁移后保留原计划', () => {
    const { storage } = mockWx({ cloudOk: false });
    storage['fitness:seedVersion'] = 1;
    storage['fitness:plans'] = [
      buildLocalPlan({
        id: 'plan_old',
        cycleDays: [
          {
            dayId: 'push',
            name: '推',
            exercises: [
              { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', sets: 4, targetReps: 8, targetWeight: 60 },
            ],
          },
        ],
      }),
    ];
    const db = loadDb();
    return db.ensureSeedPlans().then((plans) => {
      expect(plans).toHaveLength(1);
      expect(plans[0].id).toBe('plan_old');
      expect(storage['fitness:seedVersion']).toBe(1);
      expect(storage['fitness:planMigrationVersion']).toBe(3);
    });
  });
});
