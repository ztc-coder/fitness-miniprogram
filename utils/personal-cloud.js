/** 私人 CRUD 只走可信云函数；小程序不持有集合写权限。 */
const service = require('./cloud-service');
function database() {
  return { collection(collection) {
    function query(options = {}) {
      const run = (action, payload = {}) => {
        const token = service.snapshot();
        if (!service.ready()) return Promise.reject(new Error('仅本地模式'));
        return wx.cloud.callFunction({ name: 'personalData', data: { collection, action, ...options, ...payload } })
          .then(res => {
            service.assertCurrent(token);
            if (!res.result || res.result.error) throw new Error((res.result && res.result.error) || '云服务返回无效结果');
            return res.result;
          });
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
  const saved = storage.getStorageSync('fitness:syncGeneration');
  if (saved !== undefined && saved !== '') return saved;
  const token = service.snapshot();
  if (!service.ready()) throw new Error('仅本地模式');
  const res = await wx.cloud.callFunction({ name: 'personalData', data: { action: 'state' } });
  service.assertCurrent(token);
  if (!res.result || !Number.isSafeInteger(res.result.generation)) throw new Error('无法确认云端代际');
  if (res.result.generation !== 0) throw new Error('云端数据代际已改变，本地未同步数据保留待处理');
  storage.setStorageSync('fitness:syncGeneration', 0);
  return res.result.generation;
}
module.exports = { database, generation };
