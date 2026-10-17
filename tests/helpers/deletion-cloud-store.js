/** Cloud SDK boundary with optimistic document-version conflicts, not Map snapshot last-writer-wins. */
function createCloudStore() {
  const docs = new Map(), versions = new Map();
  const store = { identity: 'A', beforeCommit: null, afterQuery: null, conflicts: 0 };
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  function database(transaction) {
    return {
      startTransaction: async () => {
        const reads = new Map(), writes = new Map();
        const tx = { reads, writes };
        return { ...database(tx), rollback: async () => {}, commit: async () => {
          if (store.beforeCommit) await store.beforeCommit();
          if ([...reads].some(([key, version]) => (versions.get(key) || 0) !== version)) {
            store.conflicts++;
            throw Object.assign(Error('transaction conflict'), { code: 'DATABASE_TRANSACTION_CONFLICT' });
          }
          writes.forEach((value, key) => {
            if (value === null) docs.delete(key); else docs.set(key, clone(value));
            versions.set(key, (versions.get(key) || 0) + 1);
          });
        } };
      },
      collection: name => {
        function query(filter = {}, skip = 0, limit = 20) {
          return {
            where: f => { if (transaction) throw Error('where forbidden in transaction'); return query(f, skip, limit); },
            orderBy() { return this; }, skip: n => query(filter, n, limit), limit: n => query(filter, skip, n),
            get: async () => {
              const data = [...docs].filter(([key, value]) => key.startsWith(name + '/') && Object.entries(filter).every(([k,v]) => value[k] === v)).slice(skip, skip + limit).map(([,value]) => clone(value));
              if (store.afterQuery) await store.afterQuery({ name, data });
              return { data };
            },
            doc: id => {
              const key = name + '/' + id;
              const read = () => {
                if (transaction && !transaction.reads.has(key)) transaction.reads.set(key, versions.get(key) || 0);
                return transaction && transaction.writes.has(key) ? transaction.writes.get(key) : docs.get(key);
              };
              const write = value => {
                if (transaction) { read(); transaction.writes.set(key, value); }
                else { if (value === null) docs.delete(key); else docs.set(key, value); versions.set(key, (versions.get(key) || 0) + 1); }
                return {};
              };
              return { get: async () => ({ data: clone(read()) || null }), set: async ({ data }) => write({ ...clone(data), _id: id }), remove: async () => write(null) };
            },
          };
        }
        return query();
      },
    };
  }
  store.sdk = { DYNAMIC_CURRENT_ENV: 'test', init() {}, getWXContext: () => ({ OPENID: store.identity }), database: () => database() };
  return store;
}
module.exports = { createCloudStore };
