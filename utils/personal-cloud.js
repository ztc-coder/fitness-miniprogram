/** 私人 CRUD 只走可信云函数；小程序不持有集合写权限。 */
const service = require('./cloud-service');
function database() {
  return { collection(collection) {
    function query(options = {}) {
      const run = async (action, payload = {}) => {
        const token = service.snapshot();
        if (!service.ready()) throw new Error('仅本地模式');
        const currentGeneration = await generation();
        service.assertCurrent(token);
        let result;
        try {
          const res = await wx.cloud.callFunction({ name: 'personalData', data: { collection, action, ...options, generation: currentGeneration, ...payload } });
          service.assertCurrent(token);
          if (!res.result || res.result.error) throw new Error((res.result && res.result.error) || '云服务返回无效结果');
          result = res.result;
        } catch (err) {
          service.assertCurrent(token);
          await generation(); // a rejection may be a deletion that raced the request
          throw err;
        }
        await generation(); // never accept a list/write acknowledgement captured before a new barrier
        service.assertCurrent(token);
        return result;
      };
      return {
        orderBy: (field, direction) => query({ ...options, field, direction }),
        limit: limit => query({ ...options, limit }),
        skip: skip => query({ ...options, skip }),
        get: () => run('list'),
        add: ({ data }) => run('add', { data }),
        doc: id => ({
          set: payload => run('set', { id, ...payload }),
          update: ({ data }) => run('update', { id, data }),
          remove: (payload = {}) => run('remove', { id, ...payload }),
        }),
      };
    }
    return query();
  } };
}
async function generation() {
  const storage = require('./owner-storage');
  const token = service.snapshot();
  if (!service.ready()) throw new Error('仅本地模式');
  // An owned deletion must be explicitly retried/recovered, never auto-wiped by its own barrier.
  if (storage.getStorageSync('fitness:deletionOperation')) throw new Error('请先重试删除并完成本机清理，再重新使用云服务');
  const res = await wx.cloud.callFunction({ name: 'personalData', data: { action: 'state' } });
  service.assertCurrent(token);
  if (!res.result || !Number.isSafeInteger(res.result.generation)) throw new Error('无法确认云端代际');
  const state = res.result;
  if (storage.getStorageSync('fitness:deletionOperation')) throw new Error('请先重试删除并完成本机清理，再重新使用云服务');
  const saved = storage.getStorageSync('fitness:syncGeneration');
  const barrier = storage.getStorageSync('fitness:syncBarrier');
  if ((saved === undefined || saved === '' ? 0 : saved) !== state.generation ||
      (state.deleting && (!barrier || !barrier.deleting))) {
    service.invalidate();
    storage.clearPrivate({ owner: token.owner, keepOperation: true });
    storage.setStorageSync('fitness:syncGeneration', state.generation);
    storage.setStorageSync('fitness:syncBarrier', { generation: state.generation, deleting: !!state.deleting });
    throw new Error('云端删除屏障已改变，旧本机数据已失效；请确认后重新使用');
  }
  if (barrier || state.deleting) throw new Error('请确认云端删除完成并协调本机数据后重新使用');
  return state.generation;
}
module.exports = { database, generation };
