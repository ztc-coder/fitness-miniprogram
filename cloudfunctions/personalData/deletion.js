const boundary = require('./write-boundary');
function active(meta, operationId, generation) {
  return meta.generation === generation && meta.deletion && meta.deletion.id === operationId && meta.deletion.status === 'deleting';
}
async function deleteAll(db, owner, event) {
  const id = event.operationId;
  if (typeof id !== 'string' || !id || id.length > 256 || !Number.isSafeInteger(event.generation)) throw new Error('缺少删除操作标识或代际');
  const job = await boundary.withOwnerGate(db, owner, async (txn, meta) => {
    if (meta.deletion && meta.deletion.id === id) return { generation: meta.generation, deleted: meta.deletion.status === 'completed' };
    if (meta.deletion && meta.deletion.status === 'deleting') throw new Error('已有删除任务，请重试原任务');
    if (event.generation !== meta.generation) throw new Error('删除代际已过期，请重新确认');
    meta.generation += 1;
    meta.deletion = { id, status: 'deleting' };
    return { generation: meta.generation, deleted: false };
  });
  if (job.deleted) return job;
  // Bounded work per invocation; an interrupted/long deletion stays deleting and resumes at page zero.
  let remaining = 100;
  for (const name of ['plans', 'sessions']) {
    while (true) {
      const page = await db.collection(name).where({ _openid: owner }).limit(Math.min(20, remaining)).get();
      for (const doc of page.data) {
        const removed = await boundary.withOwnerGate(db, owner, async (txn, meta) => {
          if (!active(meta, id, job.generation)) return false;
          const ref = txn.collection(name).doc(doc._id);
          const current = await ref.get();
          if (current.data && current.data._openid === owner) await ref.remove();
          return true;
        });
        // A delayed worker must never remove data after its job finished or was superseded.
        if (!removed) return { generation: job.generation, deleted: false, stale: true };
        remaining--;
      }
      if (!remaining) return { generation: job.generation, deleted: false, deleting: true };
      if (!page.data.length) break;
    }
  }
  return boundary.withOwnerGate(db, owner, async (txn, meta) => {
    if (active(meta, id, job.generation)) meta.deletion.status = 'completed';
    return { generation: job.generation, deleted: !!(meta.generation === job.generation && meta.deletion && meta.deletion.id === id && meta.deletion.status === 'completed') };
  });
}
module.exports = { deleteAll };
