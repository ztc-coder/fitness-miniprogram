let saved;
function setup() {
  jest.resetModules(); jest.useFakeTimers(); saved = {};
  global.wx = {
    getStorageSync: k => saved[k], setStorageSync: (k,v) => { saved[k] = JSON.parse(JSON.stringify(v)); }, removeStorageSync: k => { delete saved[k]; },
    cloud: { init() {}, callFunction: jest.fn(async ({name}) => ({ result: name === 'login' ? {openid:'owner'} : {generation:0, data:[]} })) },
    getNetworkType: ({success}) => success({networkType:'wifi'}), onNetworkStatusChange() {}, showModal: jest.fn(), showToast: jest.fn(), setNavigationBarColor() {},
  };
}
function page(route) { let def; global.Page = p => { def = p; }; require('../pages/'+route+'/'+route); return {...def, data:{...def.data}, setData(p) { Object.assign(this.data,p); }}; }
function bucket(key, value) { saved['fitness:owned:fitness:'+key] = {version:1,buckets:[{owner:'owner',value}]}; }
afterEach(() => { jest.useRealTimers(); delete global.wx; delete global.Page; });
test('公开归属确认允许空本人业务桶和同代际空任务元数据，不丢匿名计划和历史', async () => {
  setup(); saved['fitness:plans'] = [{id:'anon',cycleDays:[]}]; saved['fitness:completedTraining'] = [{session:{id:'history'},sessionSynced:true,planSynced:true}];
  bucket('plans', []); bucket('completedTraining', []); bucket('planSync',{tasks:[],deleted:[],completed:[]}); bucket('syncGeneration',0);
  for (const key of ['plans','completedTraining']) saved['fitness:owned:fitness:'+key].buckets.push({owner:'',value:saved['fitness:'+key]});
  saved['fitness:owned:fitness:planSync'].buckets.push({owner:'',value:{tasks:[],deleted:[],completed:[]}}); saved['fitness:owned:fitness:syncGeneration'].buckets.push({owner:'',value:0});
  await require('../utils/cloud-service').enable(); const view = page('data-management'); view.onClaimLocalData(); await wx.showModal.mock.calls[0][0].success({confirm:true});
  const local = require('../utils/owner-storage'); expect(local.claimPreview().plans).toBe(0); expect(local.getStorageSync('fitness:plans').map(p=>p.id)).toEqual(['anon']);
  expect(local.getStorageSync('fitness:completedTraining')[0].session.id).toBe('history'); expect(local.getStorageSync('fitness:syncGeneration')).toBe(0);
});
test('实际 Page 重试在 state RPC 失败时显示安全原因且保留待提交数据', async () => {
  setup(); await require('../utils/cloud-service').enable(); const local = require('../utils/owner-storage'); local.setStorageSync('fitness:pendingQueue',[{id:'keep'}]);
  wx.cloud.callFunction.mockRejectedValue(Object.assign(Error('FUNCTION_NOT_FOUND private-sdk-details'),{errCode:501000}));
  const view = page('me'); await view.onFlushQueue();
  expect(view.data.syncSubtitle).toBe('云同步服务尚未配置，请联系维护者'); expect(wx.showToast).toHaveBeenLastCalledWith(expect.objectContaining({title:'云同步服务尚未配置，请联系维护者'}));
  expect(local.getStorageSync('fitness:pendingQueue')).toEqual([{id:'keep'}]);
});
test('两份非空业务计划不自动覆盖，页面提供保留双方的安全反馈', async () => {
  setup(); bucket('plans',[{id:'own',cycleDays:[]}]); saved['fitness:owned:fitness:plans'].buckets.push({owner:'',value:[{id:'anon',cycleDays:[]}]});
  await require('../utils/cloud-service').enable(); const before = JSON.stringify(saved['fitness:owned:fitness:plans']);
  const view = page('data-management'); view.onClaimLocalData(); await wx.showModal.mock.calls[0][0].success({confirm:true});
  expect(JSON.stringify(saved['fitness:owned:fitness:plans'])).toBe(before);
  expect(view.data.dataResult).toContain('当前微信已有记录，不能直接加入；两份记录均已保留');
});
test.each(['deletionOperation','syncBarrier'])('本人 %s 锁在归属前阻断，匿名技术状态不能覆盖安全锁', async key => {
  setup(); saved['fitness:plans']=[{id:'anon',cycleDays:[]}]; bucket('syncGeneration',0); bucket(key,{generation:0,id:'keep-lock'});
  saved['fitness:'+key]={generation:99,id:'anonymous-lock'};
  await require('../utils/cloud-service').enable(); const view=page('data-management'); view.onClaimLocalData();
  await wx.showModal.mock.calls[0][0].success({confirm:true});
  const local=require('../utils/owner-storage'); expect(local.getStorageSync('fitness:'+key)).toEqual({generation:0,id:'keep-lock'});
  expect(local.claimPreview().plans).toBe(1); expect(local.getStorageSync('fitness:syncGeneration')).toBe(0);
  const me=page('me'); await me.onFlushQueue(); expect(me.data.syncProcessing).toBe(true);
  expect(me.data.syncSubtitle).toBe(key==='deletionOperation'?'有未完成的删除，请到数据管理继续':'删除后的本机数据需确认，请到数据管理查看');
});
test('匿名技术状态不移入本人安全元数据', async () => {
  setup(); saved['fitness:plans']=[{id:'anon',cycleDays:[]}]; saved['fitness:syncBarrier']={generation:0}; saved['fitness:deletionOperation']={id:'anonymous'};
  await require('../utils/cloud-service').enable(); const view=page('data-management'); view.onClaimLocalData(); await wx.showModal.mock.calls[0][0].success({confirm:true});
  const local=require('../utils/owner-storage'); expect(local.getStorageSync('fitness:syncBarrier')).toBeUndefined(); expect(local.getStorageSync('fitness:deletionOperation')).toBeUndefined();
  expect(saved['fitness:syncBarrier']).toEqual({generation:0}); expect(saved['fitness:deletionOperation']).toEqual({id:'anonymous'});
});
test('重试中保留上次原因，只有待提交数据获确认后才清除', async () => {
  setup(); await require('../utils/cloud-service').enable(); const local=require('../utils/owner-storage'); local.setStorageSync('fitness:pendingQueue',[{id:'keep'}]);
  wx.cloud.callFunction.mockRejectedValue(Object.assign(Error('FUNCTION_NOT_FOUND'),{errCode:501000}));
  const view=page('me'); await view.onFlushQueue();
  let release; wx.cloud.callFunction.mockImplementationOnce(() => new Promise(resolve => { release=resolve; }));
  wx.cloud.callFunction.mockImplementation(async ({data}) => ({result:data.action==='state'?{generation:0}:{data:[],revision:1}}));
  const pending=view.onFlushQueue(); for (let i=0;i<12;i++) await Promise.resolve();
  expect(require('../utils/queue').getStatus().reason).toBe('云同步服务尚未配置，请联系维护者');
  release({result:{generation:0}}); await pending;
  expect(require('../utils/queue').getStatus().reason).toBe(''); expect(local.getStorageSync('fitness:pendingQueue')).toEqual([]);
  expect(view.data.syncHeadline).toBe('已同步');
});
test('旧身份在途失败不污染重新启用后的原因或待同步数据', async () => {
  setup(); const service=require('../utils/cloud-service'); await service.enable(); const local=require('../utils/owner-storage'); local.setStorageSync('fitness:pendingQueue',[{id:'keep'}]);
  let reject; wx.cloud.callFunction.mockImplementationOnce(() => new Promise((_,r) => {reject=r;}));
  const view=page('me'); const pending=view.onFlushQueue(); for (let i=0;i<12;i++) await Promise.resolve();
  service.disable(); await service.enable(); reject(Object.assign(Error('FUNCTION_NOT_FOUND'),{errCode:501000})); await pending;
  expect(require('../utils/queue').getStatus().reason).toBe(''); expect(local.getStorageSync('fitness:pendingQueue')).toEqual([{id:'keep'}]); expect(wx.showToast).not.toHaveBeenCalled();
});
test('任务 RPC 的模拟 SDK 失败同样显示安全原因，未知 SDK 错误不输出内部标识', async () => {
  setup(); await require('../utils/cloud-service').enable(); const local=require('../utils/owner-storage'); local.setStorageSync('fitness:pendingQueue',[{id:'keep'}]);
  let known=true;
  wx.cloud.callFunction.mockImplementation(async ({data}) => {
    if (data.action==='state') return {result:{generation:0}};
    throw Object.assign(Error(known?'FUNCTION_NOT_FOUND secret-id':'unknown-secret-payload'),{errCode:known?501000:12345});
  });
  const view=page('me'); await view.onFlushQueue(); expect(view.data.syncSubtitle).toBe('云同步服务尚未配置，请联系维护者');
  known=false; await view.onFlushQueue(); expect(view.data.syncSubtitle).toBe('同步未完成，可查看详情'); expect(view.data.syncIssue).toBe(true);
  view.onSyncDetails(); expect(wx.showModal.mock.calls.at(-1)[0].content).not.toMatch(/secret|payload|12345|keep/);
  expect(local.getStorageSync('fitness:pendingQueue')[0].id).toBe('keep');
});
test('非空任务/墓碑不同则不合并或重绑旧任务，空元数据不误认成业务冲突', async () => {
  setup(); saved['fitness:plans']=[{id:'anon',cycleDays:[]}]; bucket('planSync',{tasks:[{id:'own',generation:0}],deleted:[],completed:[]});
  saved['fitness:owned:fitness:planSync'].buckets.push({owner:'',value:{tasks:[{id:'anon',generation:0}],deleted:[],completed:[]}});
  await require('../utils/cloud-service').enable(); const before=JSON.stringify(saved); const view=page('data-management'); view.onClaimLocalData(); await wx.showModal.mock.calls[0][0].success({confirm:true});
  expect(JSON.stringify(saved)).toBe(before); expect(view.data.dataResult).toContain('当前微信已有记录，不能直接加入；两份记录均已保留');
});
test('相同非零代际归属不覆盖本人代际，也不把匿名锁提升到本人', async () => {
  setup(); saved['fitness:plans']=[{id:'anon',cycleDays:[]}]; bucket('syncGeneration',3); saved['fitness:owned:fitness:syncGeneration'].buckets.push({owner:'',value:3});
  saved['fitness:deletionOperation']={id:'anonymous-job',generation:9};
  await require('../utils/cloud-service').enable(); wx.cloud.callFunction.mockImplementation(async () => ({result:{generation:3,data:[]}}));
  const view=page('data-management'); view.onClaimLocalData(); await wx.showModal.mock.calls[0][0].success({confirm:true});
  const local=require('../utils/owner-storage'); expect(local.getStorageSync('fitness:syncGeneration')).toBe(3); expect(local.getStorageSync('fitness:deletionOperation')).toBeUndefined();
  expect(local.getStorageSync('fitness:plans')[0].id).toBe('anon');
});
test('空队列前置云检查失败时隐藏成功子状态，不暗示已获云端确认', async () => {
  setup(); await require('../utils/cloud-service').enable();
  wx.cloud.callFunction.mockRejectedValue(Object.assign(Error('temporary failure'), { errCode: 12345 }));
  const view = page('me'); await view.onFlushQueue();
  expect(view.data.pendingCount).toBe(0);
  expect(view.data.syncHeadline).toBe('待处理');
  expect(view.data.syncSubtitle).toBe('同步未完成，可查看详情');
  expect(view.data.showSyncBreakdown).toBe(false);
});
test.each([
  { errCode: -501000, message: 'cloud.callFunction:fail', errMsg: 'FUNCTION_NOT_FOUND private-sdk-details' },
  { errCode: -501000, message: 'cloud.callFunction:fail', errMsg: 'FunctionName parameter could not be found' },
  { message: 'cloud.callFunction:fail', errMsg: 'FUNCTION_NOT_FOUND private-sdk-details' },
  { message: 'cloud.callFunction:fail', errMsg: 'FUNCTIONS_NOT_FOUND private-sdk-details' },
  { errCode: -404011, message: 'cloud function execution error', errMsg: 'Function not found: [private-name]' },
])('真实负码或另一消息字段中的部署错误也映射为安全提示：%j', async error => {
  setup(); await require('../utils/cloud-service').enable();
  const local = require('../utils/owner-storage'); local.setStorageSync('fitness:pendingQueue', [{ id: 'keep' }]);
  wx.cloud.callFunction.mockRejectedValue(error);
  const view = page('me'); await view.onFlushQueue();
  expect(view.data.syncSubtitle).toBe('云同步服务尚未配置，请联系维护者');
  expect(wx.showToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: '云同步服务尚未配置，请联系维护者' }));
  expect(local.getStorageSync('fitness:pendingQueue')).toEqual([{ id: 'keep' }]);
});
test.each([-501000, 501000])('只有外层数字码 %i 时不擅自断言云函数未部署', async errCode => {
  setup(); await require('../utils/cloud-service').enable();
  wx.cloud.callFunction.mockRejectedValue({ errCode, message: 'cloud.callFunction:fail', errMsg: 'unknown-private-error' });
  const view = page('me'); await view.onFlushQueue();
  expect(view.data.syncSubtitle).toBe('同步未完成，可查看详情');
});
