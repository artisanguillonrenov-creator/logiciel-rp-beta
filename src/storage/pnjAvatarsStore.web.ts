// Variante web de pnjAvatarsStore.ts (résolue automatiquement par le
// bundler Metro/Expo à la place du fichier natif). IndexedDB plutôt que
// localStorage/AsyncStorage : pas de petit quota ~5-10 Mo (déjà dépassé une
// fois cette session par du contenu plus léger que des images base64).
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

export async function obtenirAvatarPnj(storyId: string, pnjId: string): Promise<string | null> {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readonly');
    const requete = tx.objectStore(MAGASIN).get(cle(storyId, pnjId));
    requete.onsuccess = () => resolve((requete.result as string | undefined) ?? null);
    requete.onerror = () => reject(requete.error);
  });
}

export async function enregistrerAvatarPnj(storyId: string, pnjId: string, dataUrl: string): Promise<void> {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    tx.objectStore(MAGASIN).put(dataUrl, cle(storyId, pnjId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Supprime le portrait d'un seul PNJ (ou du joueur, voir ID_AVATAR_JOUEUR
 * dans images.ts) — pour un nettoyage manuel, ex. une fiche dupliquée, sans
 * attendre de vider toute l'histoire (supprimerAvatarsHistoire). */
export async function supprimerAvatarPnj(storyId: string, pnjId: string): Promise<void> {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    tx.objectStore(MAGASIN).delete(cle(storyId, pnjId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function supprimerAvatarsHistoire(storyId: string): Promise<void> {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MAGASIN, 'readwrite');
    const magasin = tx.objectStore(MAGASIN);
    const requete = magasin.openCursor();
    const prefixe = `${storyId}_`;
    requete.onsuccess = () => {
      const curseur = requete.result;
      if (!curseur) return;
      if (typeof curseur.key === 'string' && curseur.key.startsWith(prefixe)) {
        curseur.delete();
      }
      curseur.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
