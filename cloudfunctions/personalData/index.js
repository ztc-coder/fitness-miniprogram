const cloud = require('wx-server-sdk');
const { createHash } = require('crypto');
const { isDeepStrictEqual } = require('util');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, throwOnNotFound: false });
const hash = value => createHash('sha256').update(value).digest('hex');
const boundary = require('./write-boundary');

// Compare the entire legacy immutable snapshot, not a whitelist that could hide differing content.
function sessionSnapshot(data) {
  const snapshot = Object.assign({}, data);
  ['_id', '_openid', 'training', 'nextSetId', 'attempts', 'syncGeneration'].forEach(key => delete snapshot[key]);
  return snapshot;
}

/** All personal writes lock the same owner metadata document inside the transaction.
 * Ticket03 must advance generation through this same boundary, never a parallel writer.
 */
exports.main = async (event = {}) => {
  const owner = cloud.getWXContext().OPENID;
  if (typeof owner !== 'string' || !owner.trim()) throw new Error('缺少可信微信身份');
  const db = cloud.database({ throwOnNotFound: false });
  const metadataId = boundary.metadataId(owner);
  if (event.action === 'state') {
    const res = await db.collection(boundary.COLLECTION).doc(metadataId).get();
    return { generation: res.data ? res.data.generation : 0 };
  }
  if (!['plans', 'sessions'].includes(event.collection)) throw new Error('不支持的集合');
  if (event.action === 'list') {
    const skip = Number.isSafeInteger(event.skip) && event.skip >= 0 ? event.skip : 0;
    const limit = Number.isSafeInteger(event.limit) && event.limit > 0 ? Math.min(100, event.limit) : 20;
    return db.collection(event.collection).where({ _openid: owner })
      .orderBy(event.collection === 'plans' ? 'createdAt' : 'submittedAt', event.collection === 'plans' ? 'asc' : 'desc')
      .orderBy('_id', 'asc').skip(skip).limit(limit).get();
  }
  if (!['set', 'remove'].includes(event.action)) throw new Error('所有写入必须使用版本化 set/remove');
  if (typeof event.id !== 'string' || !event.id || event.id.length > 256 || event.id.includes('/')) throw new Error('无效文档 ID');
  return boundary.withOwnerWrite(db, owner, event.generation, async (txn, meta) => {
    const collection = txn.collection(event.collection);
    const original = await collection.doc(event.id).get();
    if (original.data && original.data._openid !== owner) throw new Error('无权访问该文档');
    const id = original.data ? event.id : 'owned_' + hash(owner + '\0' + event.id);
    const res = original.data ? original : await collection.doc(id).get();
    const current = res.data;
    if (current && current._openid !== owner) throw new Error('无权访问该文档');
    if (typeof event.operationId !== 'string' || !event.operationId || event.operationId.length > 256) throw new Error('缺少幂等操作标识');
    if (current && current.operationId === event.operationId) {
      return { _id: id, revision: current.revision, acknowledged: true };
    }
    const revision = current ? (current.revision || 0) : 0;
    if (!Number.isSafeInteger(event.expectedRevision) || event.expectedRevision !== revision || (current && current.deleted)) throw new Error('版本已过期或计划已删除；本地修改保留待处理');
    if (event.collection === 'sessions' && current && event.action === 'set' &&
        !Object.prototype.hasOwnProperty.call(current, 'revision') &&
        !Object.prototype.hasOwnProperty.call(current, 'operationId') &&
        isDeepStrictEqual(sessionSnapshot(current), sessionSnapshot(event.data))) {
      // Pre-versioned doc.set may have succeeded without a local acknowledgement.
      // Confirm only an identical owned snapshot; do not rewrite history or bypass generation/revision checks.
      return { _id: id, revision, acknowledged: true };
    }
    if (event.collection === 'sessions' && (current || event.action === 'remove')) throw new Error('训练记录不可变');
    const fields = event.collection === 'plans'
      ? ['name', 'cursor', 'active', 'cycleDays', 'createdAt', 'updatedAt']
      : ['planId', 'planName', 'dayId', 'dayName', 'dayIndex', 'startedAt', 'submittedAt', 'flowVersion', 'exercises'];
    const data = { _openid: owner, id: (current && current.revision && current.id) || event.id,
      revision: revision + 1, generation: meta.generation, operationId: event.operationId,
      deleted: event.action === 'remove' };
    if (!data.deleted) for (const key of fields) if (event.data && event.data[key] !== undefined) data[key] = event.data[key];
    // A tombstone keeps only the minimum barrier, not the deleted plan content.
    if (data.deleted) data.createdAt = (current && current.createdAt) || 0;
    await collection.doc(id).set({ data });
    return { _id: id, revision: data.revision, acknowledged: true };
  });
};
