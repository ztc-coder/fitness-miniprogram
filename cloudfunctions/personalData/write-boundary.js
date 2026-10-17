const { createHash } = require('crypto');
const COLLECTION = 'personalDataMeta';
const metadataId = owner => createHash('sha256').update(owner).digest('hex');

/** One serialization point for writes, deletion start, each physical removal and finalization.
 * Only doc operations inside the transaction. Retry only the SDK's explicit conflict code.
 */
async function withOwnerGate(db, owner, write) {
  for (let attempt = 0; ; attempt++) {
    const txn = await db.startTransaction();
    try {
      const metadata = txn.collection(COLLECTION).doc(metadataId(owner));
      const res = await metadata.get();
      const meta = res.data || { generation: 0, serial: 0 };
      const result = await write(txn, meta);
      const data = { _openid: owner, generation: meta.generation, serial: (meta.serial || 0) + 1 };
      if (meta.deletion) data.deletion = meta.deletion;
      await metadata.set({ data });
      await txn.commit();
      return result;
    } catch (err) {
      try { await txn.rollback(); } catch (rollbackError) { /* preserve original failure */ }
      if (err.code !== 'DATABASE_TRANSACTION_CONFLICT' || attempt >= 3) throw err;
    }
  }
}
function withOwnerWrite(db, owner, generation, write) {
  return withOwnerGate(db, owner, (txn, meta) => {
    if (!Number.isSafeInteger(generation) || generation !== meta.generation) throw new Error('数据代际已过期，请处理本地未同步数据');
    if (meta.deletion && meta.deletion.status === 'deleting') throw new Error('个人数据正在删除，请重试删除');
    return write(txn, meta);
  });
}
module.exports = { COLLECTION, metadataId, withOwnerGate, withOwnerWrite };
