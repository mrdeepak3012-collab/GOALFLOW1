/* Tiny promise wrapper around IndexedDB.
   Stores: habits, checks, sleep, notes, prefs. */
const DB = (() => {
  let db;
  const run = (store, mode, fn) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode), req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req.result);
    t.onerror = t.onabort = () => reject(t.error);
  });
  return {
    open: () => new Promise((resolve, reject) => {
      const r = indexedDB.open('one-percent-better', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('habits', { keyPath: 'id' });
        d.createObjectStore('checks', { keyPath: 'k' });   // k = "YYYY-MM-DD|habitId"
        d.createObjectStore('sleep', { keyPath: 'date' });
        d.createObjectStore('notes', { keyPath: 'date' });
        d.createObjectStore('prefs', { keyPath: 'key' });
      };
      r.onsuccess = () => { db = r.result; resolve(); };
      r.onerror = () => reject(r.error);
    }),
    all: s => run(s, 'readonly', st => st.getAll()),
    put: (s, v) => run(s, 'readwrite', st => st.put(v)),
    del: (s, k) => run(s, 'readwrite', st => st.delete(k)),
    clear: s => run(s, 'readwrite', st => st.clear()),
  };
})();
