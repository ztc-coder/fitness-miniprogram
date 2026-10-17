/** Page 生命周期/用户事件边界：身份代际改变立即清空旧视图，迟到回调无权继续操作。 */
const service = require('./cloud-service');
function ownerPage(definition) {
  const initial = () => JSON.parse(JSON.stringify(definition.data || {}));
  const result = { ...definition };
  function attach(page) {
    if (page._ownerToken) return;
    page._ownerToken = service.snapshot();
    const setData = typeof page.setData === 'function' ? page.setData.bind(page) : () => {};
    page._ownerClear = () => setData(initial());
    page.setData = (patch, callback) => {
      if (page.isCurrentOwner()) setData(patch, callback);
    };
    page._ownerUnsubscribe = service.subscribe(() => {
      if (definition.clearResources) definition.clearResources.call(page);
      page._ownerClear();
    });
  }
  result.isCurrentOwner = function () {
    if (!this._ownerToken) return true;
    const current = service.snapshot();
    return current.epoch === this._ownerToken.epoch && current.owner === this._ownerToken.owner;
  };
  for (const [name, fn] of Object.entries(definition)) {
    if (typeof fn !== 'function') continue;
    result[name] = function (...args) {
      attach(this);
      if (name === 'onUnload') {
        this._ownerUnsubscribe();
        return fn.apply(this, args);
      }
      if (!this.isCurrentOwner() && !['onHide', 'clearResources'].includes(name)) {
        if (name === 'onShow') wx.reLaunch({ url: '/pages/today/today' });
        return;
      }
      return fn.apply(this, args);
    };
  }
  if (!result.onShow) result.onShow = function () {
    attach(this);
    if (!this.isCurrentOwner()) wx.reLaunch({ url: '/pages/today/today' });
  };
  if (!definition.onUnload) result.onUnload = function () { if (this._ownerUnsubscribe) this._ownerUnsubscribe(); };
  return result;
}
module.exports = { ownerPage };
