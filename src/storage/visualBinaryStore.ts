const DB_NAME = 'elyndor-visual-assets';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

type VisualRecord = {
  key: string;
  dataUrl: string;
  updatedAt: number;
};

function indexedDbDisponible(): boolean {
  return typeof globalThis !== 'undefined' && !!(globalThis as any).indexedDB;
}

function ouvrirDb(): Promise<any> {
  return new Promise((resolve, reject) => {
    const indexedDB = (globalThis as any).indexedDB;
    if (!indexedDB) {
      reject(new Error('IndexedDB indisponible sur ce navigateur.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Impossible d’ouvrir le stockage visuel.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function transaction<T>(mode: 'readonly' | 'readwrite', executer: (store: any, resolve: (value: T) => void, reject: (reason?: any) => void) => void): Promise<T> {
  if (!indexedDbDisponible()) throw new Error('Stockage visuel persistant indisponible.');
  const db = await ouvrirDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { const err = tx.error; db.close(); reject(err ?? new Error('Erreur de stockage visuel.')); };
    tx.onabort = () => { const err = tx.error; db.close(); reject(err ?? new Error('Stockage visuel interrompu.')); };
    executer(store, resolve, reject);
  });
}

export async function lireVisuelWeb(key: string): Promise<string | null> {
  return transaction<string | null>('readonly', (store, resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as VisualRecord | undefined)?.dataUrl ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function ecrireVisuelWeb(key: string, dataUrl: string): Promise<string> {
  return transaction<string>('readwrite', (store, resolve, reject) => {
    const req = store.put({ key, dataUrl, updatedAt: Date.now() } satisfies VisualRecord);
    req.onsuccess = () => resolve(dataUrl);
    req.onerror = () => reject(req.error);
  });
}

export async function supprimerVisuelWeb(key: string): Promise<void> {
  return transaction<void>('readwrite', (store, resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function supprimerVisuelsWebParPrefixe(prefixe: string, sauf?: string): Promise<number> {
  return transaction<number>('readwrite', (store, resolve, reject) => {
    let supprimes = 0;
    const req = store.openCursor();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(supprimes);
        return;
      }
      const key = String(cursor.key ?? '');
      if (key.startsWith(prefixe) && key !== sauf) {
        cursor.delete();
        supprimes++;
      }
      cursor.continue();
    };
  });
}

export async function supprimerVisuelsWebOrphelins(prefixeType: string, prefixesValides: readonly string[]): Promise<number> {
  return transaction<number>('readwrite', (store, resolve, reject) => {
    let supprimes = 0;
    const req = store.openCursor();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(supprimes);
        return;
      }
      const key = String(cursor.key ?? '');
      if (key.startsWith(prefixeType) && !prefixesValides.some((prefixe) => key.startsWith(prefixe))) {
        cursor.delete();
        supprimes++;
      }
      cursor.continue();
    };
  });
}
