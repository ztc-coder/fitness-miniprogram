/** 旧云夹具的微信边界适配：这些夹具明确属于 fixture-user，不测试匿名迁移。 */
async function enableCloud() {
  const read = wx.getStorageSync;
  const write = wx.setStorageSync || (() => {});
  const remove = wx.removeStorageSync || (() => {});
  // Legacy fixtures use plain names as virtual owner-bucket backing, not real bare copies.
  // Removing an obsolete bare key must not delete that aliased authoritative bucket.
  // Physical raw/envelope migration is tested with separate real storage in data-deletion.
  const aliases = new Set();
  wx.removeStorageSync = key => {
    if (key.startsWith('fitness:owned:')) return remove(key.slice('fitness:owned:'.length));
    if (!aliases.has(key)) return remove(key);
  };
  wx.getStorageSync = key => {
    if (!key.startsWith('fitness:owned:')) return read(key);
    const plain = key.slice('fitness:owned:'.length);
    aliases.add(plain);
    const value = read(plain);
    return { version: 1, buckets: value === undefined ? [] : [{ owner: 'fixture-user', value }] };
  };
  wx.setStorageSync = (key, value) => {
    if (!key.startsWith('fitness:owned:')) return write(key, value);
    const bucket = value.buckets.find(b => b.owner === 'fixture-user');
    const plain = key.slice('fitness:owned:'.length);
    aliases.add(plain);
    if (bucket) return write(plain, bucket.value);
    return remove(plain);
  };
  wx.cloud = wx.cloud || {};
  wx.cloud.init = () => {};
  wx.cloud.callFunction = async ({ name, data }) => {
    if (data && data.action === 'state') return { result: { generation: 0 } };
    if (name === 'login') return { result: { openid: 'fixture-user' } };
    let collection = wx.cloud.database().collection(data.collection);
    if (data.action === 'list') {
      collection = collection.orderBy(data.field, data.direction);
      if (collection.skip && data.skip !== undefined) collection = collection.skip(data.skip);
      if (collection.limit && data.limit !== undefined) collection = collection.limit(data.limit);
      return { result: await collection.get() };
    }
    if (data.action === 'add') return { result: await collection.add({ data: data.data }) };
    const doc = collection.doc(data.id);
    return { result: await doc[data.action](data.action === 'remove' ? undefined : { data: data.data }) };
  };
  await require('../../utils/cloud-service').enable();
}
module.exports = { enableCloud };
