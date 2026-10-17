const { createHash } = require('crypto');
const COLLECTION = 'personalDataMeta';
const metadataId = owner => createHash('sha256').update(owner).digest('hex');

/** Shared serialization point for every owner write (including ticket03 deletion).
 * Callback may only use transaction.doc operations; no network/where/batch work.
 * Advancing generation must happen under this same metadata lock, not after it.
 */
async function withOwnerWrite(db, owner, generation, write) {
  const txn = await db.startTransaction();
  try {
    const metadata = txn.collection(COLLECTION).doc(metadataId(owner));
    const res = await metadata.get();
    const meta = res.data || { generation: 0, serial: 0 };
    if (!Number.isSafeInteger(generation) || generation !== meta.generation) throw new Error('数据代际已过期，请处理本地未同步数据');
    const result = await write(txn, meta);
    await metadata.set({ data: { _openid: owner, generation: meta.generation, serial: (meta.serial || 0) + 1 } });
    await txn.commit();
    return result;
  } catch (err) {
    try { await txn.rollback(); } catch (rollbackError) { /* preserve original failure */ }
    throw err;
  }
}
module.exports = { COLLECTION, metadataId, withOwnerWrite };
