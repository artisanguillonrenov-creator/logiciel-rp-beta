const DB_NOM = 'elyndor-pnj-avatars';
const MAGASIN = 'avatars';

function ouvrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const requete = indexedDB.open(DB_NOM, 1);
    requete.onupgradeneeded = () => {
      if (!requete.result.objectStoreNames.contains(MAGASIN)) {
        requete.result.createObjectStore(MAGASIN);
      }
    };
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });
}

function cle(storyId: string, pnjId: string): string {
  return `${storyId}_${pnjId}`;
}

function prefixeHistoire(storyId: string): string {
  return `${storyId}_`;
}

export async function obtenirAvatarPnj(storyId: string, pnjId: string): Promise<string | null> {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readonly');
    const requete = tx.objectStore(MAGASIN).get(cle(storyId, pnjId));
    requete.onsuccess = () => resolve((requete.result as string | undefined) ?? null);
    requete.onerror = () => reject(requete.error);
    tx.oncomplete = () => db.close();
  });
}

export async function enregistrerAvatarPnj(storyId: string, pnjId: string, dataUrl: string): Promise<string> {
  const db = await ouvrirDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    tx.objectStore(MAGASIN).put(dataUrl, cle(storyId, pnjId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Enregistrement du portrait interrompu.'));
  });
  db.close();
  return dataUrl;
}

export async function preparerImageReference(uri: string): Promise<string> {
  return uri;
}

export async function supprimerAvatarPnj(storyId: string, pnjId: string): Promise<void> {
  const db = await ouvrirDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    tx.objectStore(MAGASIN).delete(cle(storyId, pnjId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function supprimerAvatarsHistoire(storyId: string): Promise<void> {
  const db = await ouvrirDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    const magasin = tx.objectStore(MAGASIN);
    const requete = magasin.openCursor();
    const prefixe = prefixeHistoire(storyId);
    requete.onsuccess = () => {
      const curseur = requete.result;
      if (!curseur) return;
      if (typeof curseur.key === 'string' && curseur.key.startsWith(prefixe)) curseur.delete();
      curseur.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function supprimerAvatarsOrphelins(storyIdsValides: readonly string[]): Promise<number> {
  const db = await ouvrirDB();
  const prefixesValides = storyIdsValides.map(prefixeHistoire);
  let supprimes = 0;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    const requete = tx.objectStore(MAGASIN).openCursor();
    requete.onsuccess = () => {
      const curseur = requete.result;
      if (!curseur) return;
      const key = curseur.key;
      if (typeof key === 'string' && !prefixesValides.some((prefixe) => key.startsWith(prefixe))) {
        curseur.delete();
        supprimes++;
      }
      curseur.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return supprimes;
}
