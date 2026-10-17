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
          set: ({ data }) => run('set', { id, data }),
          update: ({ data }) => run('update', { id, data }),
          remove: () => run('remove', { id }),
        }),
      };
    }
    return query();
  } };
}
module.exports = { database };
