const cloud = require('wx-server-sdk');
const { createHash } = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/** 管理 SDK 绕过客户端规则，因此每个操作都必须从可信上下文限定所有者。 */
exports.main = async (event = {}) => {
  const owner = cloud.getWXContext().OPENID;
  if (typeof owner !== 'string' || !owner.trim()) throw new Error('缺少可信微信身份');
  if (!['plans', 'sessions'].includes(event.collection)) throw new Error('不支持的集合');
  if (!['list', 'add', 'set', 'update', 'remove'].includes(event.action)) throw new Error('不支持的操作');
  const collection = cloud.database().collection(event.collection);
  if (event.action === 'list') {
    const field = event.collection === 'plans' ? 'createdAt' : 'submittedAt';
    const skip = Number.isSafeInteger(event.skip) && event.skip >= 0 ? event.skip : 0;
    const limit = Number.isSafeInteger(event.limit) && event.limit > 0 ? Math.min(100, event.limit) : 20;
    return collection.where({ _openid: owner }).orderBy(field, event.collection === 'plans' ? 'asc' : 'desc')
      .skip(skip).limit(limit).get();
  }
  const fields = event.collection === 'plans'
    ? ['id', 'name', 'cursor', 'active', 'cycleDays', 'createdAt', 'updatedAt']
    : ['id', 'planId', 'planName', 'dayId', 'dayName', 'dayIndex', 'startedAt', 'submittedAt', 'flowVersion', 'exercises'];
  const data = { _openid: owner };
  for (const key of fields) if (event.data && event.data[key] !== undefined) data[key] = event.data[key];
  if (event.action === 'add') return collection.add({ data });
  if (typeof event.id !== 'string' || !event.id || event.id.length > 256 || event.id.includes('/')) throw new Error('无效文档 ID');
  // 查询不泄露其他人的数据；猜中现有文档也不能修改/删除。
  const scopedId = 'owned_' + createHash('sha256').update(owner + '\0' + event.id).digest('hex');
  const existing = await collection.where({ _id: event.id }).limit(1).get();
  let doc = existing.data[0];
  let id = event.id;
  if (doc && doc._openid !== owner) throw new Error('无权访问该文档');
  if (!doc) {
    id = scopedId;
    const scoped = await collection.where({ _id: id }).limit(1).get();
    doc = scoped.data[0];
  }
  if (doc && doc._openid !== owner) throw new Error('无权访问该文档');
  if (event.action === 'remove') return doc ? collection.doc(id).remove() : { stats: { removed: 0 } };
  if (event.action === 'update') {
    if (!doc) throw new Error('无权访问或文档不存在');
    delete data._openid;
    return collection.doc(id).update({ data });
  }
  // 新建幂等写使用本人命名空间，不让前端挑选全局新文档 ID。
  const result = await collection.doc(id).set({ data });
  return { ...result, _id: id };
};
