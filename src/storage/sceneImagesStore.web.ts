const DB_NOM = 'elyndor-scene-images';
const MAGASIN = 'scenes';

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

function prefixeHistoire(storyId: string): string {
  return `${storyId}_`;
}

function cle(storyId: string, revision: string): string {
  return `${prefixeHistoire(storyId)}${revision}`;
}

export async function obtenirIllustrationScene(storyId: string, revision: string): Promise<string | null> {
  const db = await ouvrirDB();
  const valeur = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readonly');
    const requete = tx.objectStore(MAGASIN).get(cle(storyId, revision));
    requete.onsuccess = () => resolve((requete.result as string | undefined) ?? null);
    requete.onerror = () => reject(requete.error);
  });
  db.close();
  return valeur;
}

export async function enregistrerIllustrationScene(
  storyId: string,
  revision: string,
  dataUrl: string,
): Promise<string> {
  const db = await ouvrirDB();
  const cible = cle(storyId, revision);
  const prefixe = prefixeHistoire(storyId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    const magasin = tx.objectStore(MAGASIN);
    const requete = magasin.openCursor();
    requete.onsuccess = () => {
      const curseur = requete.result;
      if (!curseur) {
        magasin.put(dataUrl, cible);
        return;
      }
      if (typeof curseur.key === 'string' && curseur.key.startsWith(prefixe) && curseur.key !== cible) curseur.delete();
      curseur.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Enregistrement de l’illustration interrompu.'));
  });
  db.close();
  return dataUrl;
}

export async function supprimerIllustrationsHistoire(storyId: string): Promise<void> {
  const db = await ouvrirDB();
  const prefixe = prefixeHistoire(storyId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    const requete = tx.objectStore(MAGASIN).openCursor();
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

export async function supprimerIllustrationsOrphelines(storyIdsValides: readonly string[]): Promise<number> {
  const db = await ouvrirDB();
  const prefixesValides = storyIdsValides.map(prefixeHistoire);
  let supprimees = 0;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    const requete = tx.objectStore(MAGASIN).openCursor();
    requete.onsuccess = () => {
      const curseur = requete.result;
      if (!curseur) return;
      const key = curseur.key;
      if (typeof key === 'string' && !prefixesValides.some((prefixe) => key.startsWith(prefixe))) {
        curseur.delete();
        supprimees++;
      }
      curseur.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return supprimees;
}
