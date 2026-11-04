// 이 기기(브라우저)의 IndexedDB에 오프라인용 자료를 보관
// - outbox: 인터넷이 끊겼을 때 저장하지 못한 변경 (다시 연결되면 차례대로 보냄)
// - kv: 마지막으로 불러온 내용 (오프라인으로 앱을 열어도 보이게)
// IndexedDB를 쓸 수 없는 환경(일부 사생활 보호 모드 등)에서는 null을 돌려주고, 부르는 쪽은 메모리로만 동작함
const DB_NAME = 'moa-offline';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  dbPromise ??= new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'seq' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

type StoreName = 'outbox' | 'kv';

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => resolve(undefined);
      tx.onabort = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export const offlineStore = {
  getAll: <T>(store: StoreName) => run<T[]>(store, 'readonly', s => s.getAll() as IDBRequest<T[]>),
  get: <T>(store: StoreName, key: IDBValidKey) => run<T>(store, 'readonly', s => s.get(key) as IDBRequest<T>),
  put: (store: StoreName, value: unknown, key?: IDBValidKey) => run(store, 'readwrite', s => s.put(value, key)),
  delete: (store: StoreName, key: IDBValidKey) => run(store, 'readwrite', s => s.delete(key)),
};
