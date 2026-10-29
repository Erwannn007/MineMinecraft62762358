// Sauvegarde locale : IndexedDB pour les mondes, localStorage pour les réglages.

const DB_NAME = 'mineminecraft';
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const st = tx.objectStore(store);
    let result;
    const r = fn(st);
    if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

const range = (worldId) => IDBKeyRange.bound(worldId + ':', worldId + ':￿');

export const storage = {
  listWorlds() {
    return run('worlds', 'readonly', (st) => st.getAll()).then((w) => (w || []).sort((a, b) => b.lastPlayed - a.lastPlayed));
  },
  getWorld(id) { return run('worlds', 'readonly', (st) => st.get(id)); },
  putWorld(meta) { return run('worlds', 'readwrite', (st) => st.put(meta)); },
  async deleteWorld(id) {
    await run('worlds', 'readwrite', (st) => st.delete(id));
    await run('chunks', 'readwrite', (st) => st.delete(range(id)));
  },
  chunkKeys(id) {
    return run('chunks', 'readonly', (st) => st.getAllKeys(range(id))).then((keys) => new Set((keys || []).map((k) => k.slice(id.length + 1))));
  },
  loadChunk(id, key) { return run('chunks', 'readonly', (st) => st.get(id + ':' + key)); },
  saveChunks(id, entries) {
    if (!entries.length) return Promise.resolve();
    return run('chunks', 'readwrite', (st) => { for (const [key, data] of entries) st.put(data, id + ':' + key); });
  },
};

const SETTINGS_KEY = 'mineminecraft.settings';
export const DEFAULT_SETTINGS = {
  zoom: 0, // 0 = automatique
  volume: 0.7,
  autoJump: true,
  showCoords: false,
  touch: 'auto', // auto | on | off
  mobs: true,
  clouds: true,
  bubble: true,
};

export function loadSettings() {
  try {
    return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  } catch {
    return Object.assign({}, DEFAULT_SETTINGS);
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ }
}
