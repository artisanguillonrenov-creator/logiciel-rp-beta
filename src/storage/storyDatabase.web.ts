import { differencesMessages, type HistoireStockee, type MessageStocke, type StockageHistoires } from './storySerialization';

type LigneHistoire = Omit<HistoireStockee, 'messages'>;
type LigneMessage = MessageStocke & { histoireId: string };

export function creerStockageIndexedDB(nom = 'elyndor-histoires'): StockageHistoires {
  let ouverture: Promise<IDBDatabase> | undefined;
  function base(): Promise<IDBDatabase> {
    if (!ouverture) {
      ouverture = new Promise<IDBDatabase>((resolve, reject) => {
        const requete = indexedDB.open(nom, 1);
        let bloquee = false;
        requete.onupgradeneeded = () => {
          const db = requete.result;
          db.createObjectStore('histoires', { keyPath: 'id' });
          const messages = db.createObjectStore('messages', { keyPath: ['histoireId', 'id'] });
          messages.createIndex('histoireId', 'histoireId');
        };
        requete.onblocked = () => {
          bloquee = true;
          reject(new Error('Ferme les autres onglets Elyndor puis réessaie.'));
        };
        requete.onerror = () => reject(requete.error);
        requete.onsuccess = () => {
          const db = requete.result;
          if (bloquee) { db.close(); return; }
          db.onversionchange = () => { db.close(); ouverture = undefined; };
          resolve(db);
        };
      }).catch((erreur) => { ouverture = undefined; throw erreur; });
    }
    return ouverture;
  }

  async function transaction<T>(mode: IDBTransactionMode, action: (tx: IDBTransaction, definir: (valeur: T) => void) => void): Promise<T> {
    const db = await base();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(['histoires', 'messages'], mode);
      let resultat: T;
      tx.oncomplete = () => resolve(resultat);
      tx.onabort = () => reject(tx.error ?? new Error('Transaction de sauvegarde interrompue.'));
      tx.onerror = () => reject(tx.error ?? new Error('Échec du stockage des histoires.'));
      try { action(tx, (valeur) => { resultat = valeur; }); }
      catch (erreur) { tx.abort(); reject(erreur); }
    });
  }

  return {
    lister: () => transaction('readonly', (tx, definir) => {
      const requete = tx.objectStore('histoires').getAll();
      requete.onsuccess = () => definir((requete.result as LigneHistoire[]).map((h) => JSON.parse(h.meta)));
    }),
    lire: (id) => transaction('readonly', (tx, definir) => {
      const entete = tx.objectStore('histoires').get(id);
      const messages = tx.objectStore('messages').index('histoireId').getAll(id);
      messages.onsuccess = () => {
        const ligne = entete.result as LigneHistoire | undefined;
        definir(ligne ? { ...ligne, messages: (messages.result as LigneMessage[]).map(({ histoireId, ...m }) => m) } : null);
      };
    }),
    ecrire: (histoire, seulementSiAbsente = false) => transaction<void>('readwrite', (tx) => {
      const histoires = tx.objectStore('histoires');
      const messages = tx.objectStore('messages');
      const entete = histoires.get(histoire.id);
      entete.onsuccess = () => {
        if (seulementSiAbsente && entete.result) return;
        const anciens = messages.index('histoireId').getAll(histoire.id);
        anciens.onsuccess = () => {
          const delta = differencesMessages(anciens.result, histoire.messages);
          const { messages: _messages, ...ligne } = histoire;
          histoires.put(ligne);
          for (const id of delta.supprimer) messages.delete([histoire.id, id]);
          for (const message of delta.ecrire) messages.put({ ...message, histoireId: histoire.id });
        };
      };
    }),
    supprimer: (id) => transaction<void>('readwrite', (tx) => {
      tx.objectStore('histoires').delete(id);
      const messages = tx.objectStore('messages').index('histoireId').openCursor(IDBKeyRange.only(id));
      messages.onsuccess = () => {
        const curseur = messages.result;
        if (!curseur) return;
        curseur.delete();
        curseur.continue();
      };
    }),
  };
}

export const stockageHistoires = creerStockageIndexedDB();
