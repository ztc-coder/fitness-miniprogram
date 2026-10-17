/** Destructive user actions. Cloud deletion has its own authorization, never normal sync consent. */
const service = require('./cloud-service');
const storage = require('./owner-storage');
const OPERATION_KEY = 'fitness:deletionOperation';
function withdraw() { service.disable(); }
function clearLocal() {
  withdraw(); // invalidate all in-flight callbacks before touching local data
  storage.clearPrivate({ all: true });
  return { status: 'local-cleared' };
}
function getDeletion() { return storage.getStorageSync(OPERATION_KEY) || null; }
async function deleteAll(authorization) {
  const version = storage.version();
  let token;
  try {
    token = authorization || await service.authorizeDeletion();
    service.assertCurrent(token);
    if (service.snapshot().consent) throw Error('请单独授权删除，不启用常规云服务');
    const call = async data => {
      service.assertCurrent(token);
      const res = await wx.cloud.callFunction({ name: 'personalData', data });
      service.assertCurrent(token);
      if (!res.result || res.result.error) throw Error((res.result && res.result.error) || '删除结果未确认');
      return res.result;
    };
    let operation = getDeletion();
    if (!operation) {
      const state = await call({ action: 'state' });
      if (!Number.isSafeInteger(state.generation)) throw Error('无法确认删除代际');
      operation = { id: state.deleting && state.deletion ? state.deletion.id : 'delete_' + Date.now() + '_' + Math.random().toString(36).slice(2), generation: state.generation, state: 'pending' };
      storage.setStorageSync(OPERATION_KEY, operation); // durable before request: lost response reuses the same ID
    }
    const result = await call({ action: 'deleteAll', operationId: operation.id, generation: operation.generation });
    if (!result.deleted || !Number.isSafeInteger(result.generation)) throw Error('删除尚未完成，请重试原删除任务');
    operation = { ...operation, state: 'cloud-confirmed', resultGeneration: result.generation };
    storage.setStorageSync(OPERATION_KEY, operation);
    if (storage.version() !== version) return { status: 'local-changed', message: '云端已确认删除；期间本机数据发生变化，未清本机，请重新确认并重试' };
    // Pages opened during deletion authorization also become stale at the local wipe boundary.
    service.invalidate();
    token = service.snapshot();
    storage.clearPrivate({ owner: token.owner, keepOperation: true });
    storage.setStorageSync('fitness:syncGeneration', result.generation);
    // A completed delete explicitly reconciles this owner; later new consent/new data may use this generation.
    storage.removeStorageSync(OPERATION_KEY);
    return { status: 'deleted', generation: result.generation };
  } catch (err) {
    if (token) {
      try { service.assertCurrent(token); } catch (stale) { return { status: 'stale', message: '删除响应已失效，未清理当前本机数据；云端可能已执行，请重新确认' }; }
    }
    return { status: 'retry', message: err.message || '删除未确认，请重试' };
  }
}
async function reconcile() {
  const token = service.snapshot();
  if (!service.ready()) throw Error('请先主动同意启用云服务');
  if (getDeletion()) throw Error('请先重试删除，确认云端及本机清理完成后再重新使用');
  const version = storage.version();
  const res = await wx.cloud.callFunction({ name: 'personalData', data: { action: 'state' } });
  service.assertCurrent(token);
  if (storage.version() !== version) throw Error('本机数据已变化，请重新查看范围并确认');
  if (!res.result || !Number.isSafeInteger(res.result.generation) || res.result.deleting) throw Error('删除尚未完成，请重试删除');
  service.invalidate();
  storage.clearPrivate({ owner: token.owner, keepOperation: true });
  storage.setStorageSync('fitness:syncGeneration', res.result.generation);
  return { status: 'reconciled' };
}
module.exports = { withdraw, clearLocal, deleteAll, getDeletion, reconcile, preview: storage.lossPreview, authorizeDeletion: service.authorizeDeletion };
