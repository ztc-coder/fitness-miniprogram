// 票 05：默认值移除 + 未配置时硬拦截云能力，本地训练与媒体降级不受影响。
const ENV_KEYS = ['FITNESS_CLOUD_APPID', 'FITNESS_CLOUD_ENV_ID', 'FITNESS_CLOUD_MEDIA_ROOT'];
const SAVED = {};
ENV_KEYS.forEach(key => { SAVED[key] = process.env[key]; });

function restoreEnv() {
  ENV_KEYS.forEach(key => {
    if (SAVED[key] === undefined) delete process.env[key];
    else process.env[key] = SAVED[key];
  });
}

function useUnconfiguredDeployment() {
  ENV_KEYS.forEach(key => { delete process.env[key]; });
}

function runtime(options = {}) {
  jest.resetModules();
  const storage = {};
  const cloud = {
    init: jest.fn(),
    callFunction: jest.fn().mockResolvedValue({ result: { openid: 'A' } }),
    database: jest.fn(() => { throw Error('unexpected direct database'); }),
  };
  global.wx = {
    getStorageSync: key => storage[key],
    setStorageSync: (key, value) => { storage[key] = value; },
    removeStorageSync: key => { delete storage[key]; },
    cloud,
    getNetworkType: jest.fn(opts => opts.success({ networkType: 'wifi' })),
    onNetworkStatusChange: jest.fn(),
    showModal: jest.fn(),
    reLaunch: jest.fn(),
  };
  if (options.appId !== undefined) {
    global.wx.getAccountInfoSync = () => ({ miniProgram: { appId: options.appId } });
  }
  return { storage, cloud };
}

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  restoreEnv();
  jest.resetModules();
});

describe('部署配置校验(utils/cloud-env)', () => {
  const {
    getCloudIssues,
    getMediaNotices,
    isAppIdLike,
    isLegacyMediaRoot,
  } = require('../utils/cloud-env');

  test('未配置环境 ID 时阻断,并指向配置文件', () => {
    const issues = getCloudIssues({ appId: '', envId: '' }, {});
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('未配置');
    expect(issues[0]).toContain('config/cloud-env.js');
  });

  test('仍是原运营者环境 ID 或 AppID 时阻断', () => {
    expect(getCloudIssues({ envId: 'cloud1-d2ga0mned4bbf9b29' }, {})[0]).toContain('原运营者环境');
    expect(getCloudIssues({ envId: 'my-env' }, { appId: 'wxa884033ad71b4514' })[0]).toContain('原运营者 AppID');
    expect(getCloudIssues({ appId: 'wxa884033ad71b4514', envId: 'my-env' }, {})[0]).toContain('原运营者 AppID');
  });

  test('游客模式阻断', () => {
    expect(getCloudIssues({ envId: 'my-env' }, { appId: 'touristappid' })[0]).toContain('游客模式');
  });

  test('填好自己的值后无阻断', () => {
    expect(getCloudIssues(
      { appId: 'wx0000000000000000', envId: 'my-own-env' },
      { appId: 'wx0000000000000000' }
    )).toEqual([]);
  });

  test('AppID 形状与媒体根判断', () => {
    expect(isAppIdLike('wx0000000000000000')).toBe(true);
    expect(isAppIdLike('touristappid')).toBe(false);
    expect(isAppIdLike('')).toBe(false);
    expect(isLegacyMediaRoot('cloud://cloud1-d2ga0mned4bbf9b29.636c-x-1')).toBe(true);
    expect(isLegacyMediaRoot('cloud://my-env.636c-my-env-1')).toBe(false);
    expect(getMediaNotices({ mediaRoot: '' })[0]).toContain('降级');
    expect(getMediaNotices({ mediaRoot: 'cloud://cloud1-d2ga0mned4bbf9b29.636c-x-1' })[0]).toContain('原运营者');
    expect(getMediaNotices({ mediaRoot: 'cloud://my-env.636c-my-env-1' })).toEqual([]);
  });
});

describe('未配置自己的云环境时禁用云能力', () => {
  test('启云被拒绝:不初始化云、不登录、不写同意,保持本地模式', async () => {
    useUnconfiguredDeployment();
    const { cloud, storage } = runtime();
    const service = require('../utils/cloud-service');
    await expect(service.enable()).rejects.toThrow('云能力未配置');
    expect(service.configured()).toBe(false);
    expect(cloud.init).not.toHaveBeenCalled();
    expect(cloud.callFunction).not.toHaveBeenCalled();
    expect(storage['fitness:cloudConsent']).toBeUndefined();
    expect(service.snapshot()).toMatchObject({ status: 'local', consent: false, owner: '' });
    expect(service.ready()).toBe(false);
  });

  test('删除专用授权同样被拦截', async () => {
    useUnconfiguredDeployment();
    const { cloud } = runtime();
    const service = require('../utils/cloud-service');
    await expect(service.authorizeDeletion()).rejects.toThrow('云能力未配置');
    expect(cloud.init).not.toHaveBeenCalled();
  });

  test('旧同意记录不会被恢复成云连接', async () => {
    useUnconfiguredDeployment();
    const { cloud, storage } = runtime();
    storage['fitness:cloudConsent'] = true;
    const service = require('../utils/cloud-service');
    const state = await service.restore();
    expect(state).toMatchObject({ status: 'local', consent: false });
    expect(cloud.init).not.toHaveBeenCalled();
  });

  test('本地训练仍可用,远程媒体降级为空地址', async () => {
    useUnconfiguredDeployment();
    runtime();
    const db = require('../utils/db');
    await db.savePlan({ id: 'local_one', name: '本地计划', cycleDays: [], active: true });
    expect((await db.fetchPlans())[0].name).toBe('本地计划');
    expect(require('../data/media-root').resolveMedia('exercises/a.jpg')).toBe('');
  });

  test('启动弹窗说明云能力已禁用,不恢复云也不跳转', async () => {
    useUnconfiguredDeployment();
    const { cloud } = runtime();
    global.App = appConfig => { global.app = appConfig; };
    require('../app');
    await app.onLaunch();
    expect(wx.showModal).toHaveBeenCalledTimes(1);
    const modal = wx.showModal.mock.calls[0][0];
    expect(modal.title).toBe('云能力已禁用');
    expect(modal.content).toContain('config/cloud-env.js');
    expect(modal.content).toContain('本地训练');
    expect(cloud.init).not.toHaveBeenCalled();
    expect(cloud.callFunction).not.toHaveBeenCalled();
    expect(wx.reLaunch).not.toHaveBeenCalled();
  });
});

describe('配置齐全时正常启云', () => {
  test('enable() 初始化自己的环境 ID 并进入 ready', async () => {
    // 启云会启动网络重试定时器,用假定时器避免撑住进程
    jest.useFakeTimers();
    const { cloud } = runtime();
    const service = require('../utils/cloud-service');
    expect(service.configured()).toBe(true);
    const state = await service.enable();
    expect(cloud.init).toHaveBeenCalledWith({ env: 'test-env-id', traceUser: false });
    expect(state).toMatchObject({ status: 'ready', owner: 'A', consent: true });
    expect(service.ready()).toBe(true);
  });

  test('编译结果仍是原运营者 AppID 时仍然拦截', async () => {
    const { cloud } = runtime({ appId: 'wxa884033ad71b4514' });
    const service = require('../utils/cloud-service');
    await expect(service.enable()).rejects.toThrow('原运营者 AppID');
    expect(cloud.init).not.toHaveBeenCalled();
  });

  test('游客模式编译结果同样拦截', async () => {
    const { cloud } = runtime({ appId: 'touristappid' });
    const service = require('../utils/cloud-service');
    await expect(service.enable()).rejects.toThrow('游客模式');
    expect(cloud.init).not.toHaveBeenCalled();
  });
});
