const DB_NOM = 'elyndor-visual-assets';
const MAGASIN = 'assets';
const FORME = /^asset-[a-z0-9-]{6,60}$/;

function ouvrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const requete = indexedDB.open(DB_NOM, 1);
    requete.onupgradeneeded = () => {
      if (!requete.result.objectStoreNames.contains(MAGASIN)) requete.result.createObjectStore(MAGASIN);
    };
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });
}

function verifier(assetId: string): string {
  if (!FORME.test(assetId)) throw new Error('Identifiant d’asset invalide.');
  return assetId;
}

export async function obtenirAssetVisuel(assetId: string): Promise<string | null> {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readonly');
    const requete = tx.objectStore(MAGASIN).get(verifier(assetId));
    requete.onsuccess = () => resolve((requete.result as string | undefined) ?? null);
    requete.onerror = () => reject(requete.error);
    tx.oncomplete = () => db.close();
  });
}

export async function enregistrerAssetVisuel(assetId: string, dataUrl: string): Promise<string> {
  const db = await ouvrirDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    tx.objectStore(MAGASIN).put(dataUrl, verifier(assetId));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
  return dataUrl;
}

export async function supprimerAssetVisuel(assetId: string): Promise<void> {
  const db = await ouvrirDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    tx.objectStore(MAGASIN).delete(verifier(assetId));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}
