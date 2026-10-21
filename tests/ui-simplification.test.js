const fs = require('fs');
const read = file => fs.readFileSync(require('path').join(__dirname, '..', file), 'utf8');
test('我的把危险操作隔离到注册的原生数据管理页', () => {
  expect(JSON.parse(read('app.json')).pages).toContain('pages/data-management/data-management');
  const wxml = read('pages/me/me.wxml');
  expect(wxml).toContain('bindtap="onOpenDataManagement"');
  expect(wxml).not.toMatch(/onClearLocal|onDeleteAll|onRecoverDeletion|onReconcile|onClaimLocalData|item\.id|attempts|queue-note/);
});
let definitions;
function runtime(theme = 'dark') {
  jest.resetModules(); definitions = {};
  const saved = { 'fitness:settings': { theme } };
  global.wx = {
    getStorageSync: key => saved[key], setStorageSync: (key, value) => { saved[key] = value; },
    removeStorageSync: key => { delete saved[key]; },
    cloud: { init() {}, callFunction: jest.fn(async ({ name }) => ({ result: name === 'login' ? { openid: 'owner-secret' } : { generation: 0, data: [] } })) },
    onNetworkStatusChange: jest.fn(), getNetworkType: ({ success }) => success({ networkType: 'none' }),
    showModal: jest.fn(), showToast: jest.fn(), navigateTo: jest.fn(), setNavigationBarColor: jest.fn(),
  };
  return saved;
}
function page(route) {
  global.Page = p => { definitions[route] = p; };
  require('../pages/' + route + '/' + route);
  const definition = definitions[route];
  return { ...definition, data: { ...definition.data }, setData(patch) { Object.assign(this.data, patch); } };
}
afterEach(() => { jest.useRealTimers(); delete global.wx; delete global.Page; });
test('我的数据管理入口使用独立原生页面，不再提供危险操作处理器', () => {
  runtime(); const me = page('me');
  me.onOpenDataManagement();
  expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/data-management/data-management' });
  expect(me.onDeleteAll).toBeUndefined(); expect(me.onClearLocal).toBeUndefined();
  expect(me.onRecoverDeletion).toBeUndefined(); expect(me.onReconcile).toBeUndefined();
});
test.each(['dark', 'light'])('数据管理按真实状态显示条件入口并应用 %s 原生主题', async theme => {
  jest.useFakeTimers(); const saved = runtime(theme);
  const service = require('../utils/cloud-service'), local = require('../utils/owner-storage');
  const management = page('data-management');
  management.onShow();
  expect(management.data).toMatchObject({ theme, serviceLabel: '仅本地', consented: false, pendingDeletion: false, canReconcile: false, canClaim: false });
  expect(wx.setNavigationBarColor).toHaveBeenLastCalledWith(expect.objectContaining({ backgroundColor: theme === 'light' ? '#F5F6F7' : '#08110e' }));
  await service.enable();
  local.setStorageSync('fitness:syncBarrier', { generation: 1 });
  management.onShow();
  expect(management.data.canReconcile).toBe(true);
  local.setStorageSync('fitness:deletionOperation', { id: 'private-operation', generation: 0, state: 'pending' });
  management.setData({ dataResult: '删除中；尚未确认完成', deleting: true });
  service.invalidate(); management.onShow();
  expect(management.data).toMatchObject({ pendingDeletion: true, canReconcile: false, deleting: true, dataResult: '删除中；尚未确认完成' });
  const reloaded = page('data-management'); reloaded.onShow();
  expect(reloaded.data).toMatchObject({ pendingDeletion: true, canReconcile: false });
  service.disable();
  expect(reloaded.data).toMatchObject({ consented: false, serviceReady: false, canClaim: false, canReconcile: false });
  reloaded.onUnload();
  saved['fitness:cloudConsent'] = true;
  await service.enable();
  expect(reloaded.data.serviceReady).toBe(false); // subscription really removed
  management.onUnload();
});
test('取消首次本机归属后，重新打开数据管理仍可显式确认，不会自动弹窗或丢失数据', async () => {
  jest.useFakeTimers(); const saved = runtime(); saved['fitness:plans'] = [{ id: 'private-plan', cycleDays: [] }];
  const service = require('../utils/cloud-service'); await service.enable();
  const me = page('me'); me.onClaimLocalData();
  await wx.showModal.mock.calls[0][0].success({ confirm: false });
  const management = page('data-management'); management.onShow();
  expect(management.data.canClaim).toBe(true); expect(wx.showModal).toHaveBeenCalledTimes(1);
  management.onClaimLocalData();
  await wx.showModal.mock.calls[1][0].success({ confirm: true });
  expect(require('../utils/db').getLocalPlans().map(p => p.id)).toEqual(['private-plan']);
  expect(management.data.canClaim).toBe(false);
  management.onUnload();
});
test('清本机确认期间不能重复发起危险操作，取消任一级确认后可以重新操作', async () => {
  runtime(); const management = page('data-management');
  management.onClearLocal();
  management.onClearLocal(); await management.onDeleteAll();
  expect(wx.showModal).toHaveBeenCalledTimes(1); expect(wx.cloud.callFunction).not.toHaveBeenCalled();
  wx.showModal.mock.calls[0][0].success({ confirm: false });
  expect(management.data.deleting).toBe(false);
  management.onClearLocal(); wx.showModal.mock.calls[1][0].success({ confirm: true });
  await wx.showModal.mock.calls[2][0].success({ confirm: false });
  expect(management.data.deleting).toBe(false);
});
test('云同步正向开关、失败和待同步状态不冒充云端确认', async () => {
  jest.useFakeTimers(); const saved = runtime(); saved['fitness:plans'] = [{ id: 'private-plan', cycleDays: [] }];
  const me = page('me'); await me.onShow();
  expect(me.data.syncHeadline).toBe('仅本地'); expect(me.data.serviceReady).toBe(false);
  me.onToggleCloudSync({ detail: { value: true } });
  wx.cloud.callFunction.mockRejectedValueOnce(Error('private backend failure'));
  await wx.showModal.mock.calls[0][0].success({ confirm: true });
  expect(me.data.cloudFailed).toBe(true); expect(me.data.syncHeadline).toBe('启用失败');
  expect(me.data.syncSubtitle).not.toContain('backend');
  me.onToggleOffline(); await wx.showModal.mock.calls[1][0].success({ confirm: true });
  // Cancel the ownership prompt: anonymous data cannot count as acknowledged cloud data.
  await wx.showModal.mock.calls[2][0].success({ confirm: false });
  const local = require('../utils/owner-storage'); local.setStorageSync('fitness:pendingQueue', [{ id: 'private-session' }]);
  await me.onShow();
  expect(me.data).toMatchObject({ syncHeadline: '待同步', serviceReady: true, pendingCount: 1 });
  me.onToggleCloudSync({ detail: { value: false } });
  expect(me.data).toMatchObject({ syncHeadline: '仅本地', serviceReady: false, offlineMode: true });
  me.onUnload();
});
test('WXML 把重试、恢复、结果和本机归属入口绑定到对应条件，不暴露内部标识', () => {
  const me = read('pages/me/me.wxml'), management = read('pages/data-management/data-management.wxml');
  expect(me).toMatch(/wx:if="{{cloudFailed}}"[^>]+bindtap="onToggleOffline"/);
  expect(me).toMatch(/wx:if="{{serviceReady && pendingCount > 0 && !syncProcessing}}"[^>]+bindtap="onFlushQueue"/);
  expect(me).toContain('checked="{{!offlineMode}}"');
  expect(me).toMatch(/<view wx:if="{{showSyncBreakdown}}">[\s\S]*class="sync-status"[\s\S]*class="sync-status"/);
  expect(management).toContain('wx:if="{{canClaim}}"');
  expect(management).toContain('wx:if="{{pendingDeletion}}"');
  expect(management).toContain('wx:if="{{canReconcile}}"');
  expect(management).toMatch(/wx:if="{{dataResult}}"[^>]+aria-live="polite"/);
  expect(management).not.toMatch(/\.id|owner|revision|attempt|generation/);
});
test.each(['deletion', 'barrier', 'anonymous'])('空本人队列不能把 %s 待处理误报为已同步', async kind => {
  jest.useFakeTimers(); const saved = runtime();
  if (kind === 'anonymous') saved['fitness:completedTraining'] = [{ session: { id: 'anonymous-history' }, sessionSynced: true }];
  // Foreign buckets must not influence the current owner's headline.
  saved['fitness:owned:fitness:deletionOperation'] = { version: 1, buckets: [{ owner: 'foreign', value: { id: 'foreign-job' } }] };
  const service = require('../utils/cloud-service'), local = require('../utils/owner-storage');
  await service.enable();
  const me = page('me');
  if (kind === 'anonymous') {
    me.onClaimLocalData(); await wx.showModal.mock.calls[0][0].success({ confirm: false });
  } else local.setStorageSync(kind === 'deletion' ? 'fitness:deletionOperation' : 'fitness:syncBarrier', { generation: 1 });
  await me.onShow();
  expect(me.data.pendingCount).toBe(0);
  expect(me.data.syncHeadline).toBe('待处理');
  expect(me.data.showSyncBreakdown).toBe(false);
  expect(me.data.syncSubtitle).toBe(kind === 'anonymous' ? '本机还有记录未加入云同步' : kind === 'deletion' ? '有未完成的删除，请到数据管理继续' : '删除后的本机数据需确认，请到数据管理查看');
  me.onUnload();
});
test('其他身份的待处理桶不阻止本人空队列确认', async () => {
  jest.useFakeTimers(); const saved = runtime();
  for (const key of ['deletionOperation', 'syncBarrier', 'completedTraining']) saved['fitness:owned:fitness:' + key] = { version: 1, buckets: [{ owner: 'foreign', value: key === 'completedTraining' ? [{ session: { id: 'foreign' } }] : { generation: 1 } }] };
  await require('../utils/cloud-service').enable();
  const me = page('me'); await me.onShow(); expect(me.data.syncHeadline).toBe('已同步'); expect(me.data.showSyncBreakdown).toBe(true); me.onUnload();
});
test('云历史第二页失败保留简短警告，重新加载恢复全部 61 场月统计', async () => {
  jest.useFakeTimers(); runtime();
  let fail = true;
  const now = Date.now(), sessions = Array.from({ length: 61 }, (_, i) => ({ id: `cloud-${i}`, startedAt: now - 60000, submittedAt: now }));
  wx.cloud.callFunction.mockImplementation(async ({ name, data }) => {
    if (name === 'login') return { result: { openid: 'owner-secret' } };
    if (data.action === 'state') return { result: { generation: 0 } };
    if (data.action === 'list') {
      if (fail && data.skip === 20) throw Error('private failure');
      return { result: { data: sessions.slice(data.skip, data.skip + data.limit) } };
    }
    throw Error('unexpected cloud request');
  });
  await require('../utils/cloud-service').enable();
  const me = page('me'); await me.onShow();
  expect(me.data.monthSessions).toBe(20);
  expect(me.data.readFailed).toBe(true); expect(me.data.syncHeadline).not.toBe('已同步');
  expect(me.data.showSyncBreakdown).toBe(false);
  expect(read('pages/me/me.wxml')).toMatch(/wx:if="{{readFailed}}"[\s\S]*部分云端记录未加载[\s\S]*bindtap="onReloadRecords"[^>]*>重新加载/);
  fail = false; const retry = me.onReloadRecords(); expect(me.data.readLoading).toBe(true); await retry;
  expect(me.data).toMatchObject({ monthSessions: 61, readFailed: false, readLoading: false, syncHeadline: '已同步' });
  me.onUnload();
});
test('计划读取不完整也展示加载警告，未同意时重试不发云请求', async () => {
  jest.useFakeTimers(); runtime();
  const service = require('../utils/cloud-service'); await service.enable();
  let failPlans = true;
  wx.cloud.callFunction.mockImplementation(async ({ data }) => {
    if (data.action === 'state') return { result: { generation: 0 } };
    if (data.collection === 'plans' && failPlans) throw Error('private plan failure');
    return { result: { data: [] } };
  });
  await require('../utils/db').fetchPlans();
  const me = page('me'); await me.onShow();
  expect(me.data.readFailed).toBe(true); expect(me.data.syncHeadline).not.toBe('已同步');
  failPlans = false; await me.onReloadRecords();
  expect(me.data).toMatchObject({ readFailed: false, syncHeadline: '已同步' });
  service.disable(); wx.cloud.callFunction.mockClear(); await me.onReloadRecords();
  expect(wx.cloud.callFunction).not.toHaveBeenCalled(); me.onUnload();
});
test.each([true, false])('冷启动身份未知可仅授权检查本人删除（本人任务存在：%s）', async hasOwn => {
  const saved = runtime();
  const buckets = [{ owner: 'foreign', value: { id: 'foreign-job', generation: 0, state: 'pending' } }];
  if (hasOwn) buckets.push({ owner: 'owner-secret', value: { id: 'own-job', generation: 0, state: 'pending' } });
  saved['fitness:owned:fitness:deletionOperation'] = { version: 1, buckets };
  saved['fitness:owned:fitness:plans'] = { version: 1, buckets: [{ owner: 'foreign', value: [{ id: 'foreign-plan' }] }, { owner: '', value: [{ id: 'anonymous-plan' }] }] };
  const before = JSON.stringify(saved);
  const management = page('data-management'); management.onShow();
  expect(management.data).toMatchObject({ canCheckDeletion: true, pendingDeletion: false });
  expect(wx.cloud.callFunction).not.toHaveBeenCalled();
  expect(read('pages/data-management/data-management.wxml')).toMatch(/wx:if="{{canCheckDeletion}}"[\s\S]*如曾删除中断，联网确认本人后继续[\s\S]*bindtap="onCheckDeletion"/);
  await management.onCheckDeletion();
  expect(management.data).toMatchObject({ canCheckDeletion: false, pendingDeletion: hasOwn, consented: false, serviceReady: false, canClaim: false });
  if (!hasOwn) expect(management.data.dataResult).toBe('未发现本机待处理的删除');
  expect(require('../utils/cloud-service').snapshot().consent).toBe(false);
  expect(wx.cloud.callFunction.mock.calls.map(([args]) => args.name)).toEqual(['login']);
  expect(wx.showModal).not.toHaveBeenCalled();
  expect(JSON.stringify({ ...saved, 'fitness:cloudConsent': undefined })).toBe(JSON.stringify({ ...JSON.parse(before), 'fitness:cloudConsent': undefined }));
  management.onUnload();
});
test.each(['onDeleteAll', 'onRecoverDeletion', 'onCheckDeletion'])('卸载后 %s 的迟到授权不更新 UI、不弹确认或执行删除', async method => {
  runtime(); let release;
  wx.cloud.callFunction.mockImplementation(() => new Promise(resolve => { release = resolve; }));
  const management = page('data-management');
  const pending = management[method](); management.onUnload();
  management.setData = jest.fn();
  release({ result: { openid: 'owner-secret' } }); await pending;
  expect(management.data.deleting).toBe(false);
  expect(management.setData).not.toHaveBeenCalled(); expect(wx.showModal).not.toHaveBeenCalled();
  expect(wx.cloud.callFunction).toHaveBeenCalledTimes(1);
});
test.each([1, 2])('卸载后第 %i 级清本机确认回调不能清理数据', async level => {
  const saved = runtime(); saved['fitness:plans'] = [{ id: 'keep-local' }];
  const management = page('data-management'); management.onClearLocal();
  if (level === 2) wx.showModal.mock.calls[0][0].success({ confirm: true });
  management.onUnload(); management.setData = jest.fn();
  await wx.showModal.mock.calls[level - 1][0].success({ confirm: true });
  expect(saved['fitness:plans']).toEqual([{ id: 'keep-local' }]);
  expect(management.setData).not.toHaveBeenCalled(); expect(wx.showModal).toHaveBeenCalledTimes(level);
});
test.each(['me', 'data-management'])('卸载后的 %s 归属确认不能上传或归属匿名记录', async route => {
  jest.useFakeTimers(); const saved = runtime(); saved['fitness:plans'] = [{ id: 'keep-anonymous', cycleDays: [] }];
  await require('../utils/cloud-service').enable();
  const view = page(route); view.onClaimLocalData(); view.onUnload();
  wx.cloud.callFunction.mockClear(); view.setData = jest.fn();
  await wx.showModal.mock.calls[0][0].success({ confirm: true });
  expect(require('../utils/owner-storage').claimPreview().plans).toBe(1);
  expect(wx.cloud.callFunction).not.toHaveBeenCalled(); expect(view.setData).not.toHaveBeenCalled();
});
test('已确认归属但云检查未返回时卸载，迟到结果也不能认领或上传', async () => {
  jest.useFakeTimers(); const saved = runtime(); saved['fitness:plans'] = [{ id: 'keep-anonymous', cycleDays: [] }];
  await require('../utils/cloud-service').enable();
  let release;
  wx.cloud.callFunction.mockImplementation(() => new Promise(resolve => { release = resolve; }));
  const management = page('data-management'); management.onClaimLocalData();
  const pending = wx.showModal.mock.calls[0][0].success({ confirm: true });
  management.onUnload(); management.setData = jest.fn();
  release({ result: { generation: 0 } }); await pending;
  expect(require('../utils/owner-storage').claimPreview().plans).toBe(1);
  expect(wx.showToast).not.toHaveBeenCalled(); expect(wx.cloud.callFunction).toHaveBeenCalledTimes(2); // login + in-flight state only
  expect(management.setData).not.toHaveBeenCalled();
});
