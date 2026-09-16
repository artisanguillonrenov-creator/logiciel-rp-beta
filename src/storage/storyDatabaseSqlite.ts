import type { SQLiteDatabase } from 'expo-sqlite';
import { differencesMessages, type HistoireStockee, type MessageStocke, type StockageHistoires } from './storySerialization';

type LigneHistoire = Omit<HistoireStockee, 'messages'>;
type Base = Pick<SQLiteDatabase, 'execAsync' | 'getAllAsync' | 'withExclusiveTransactionAsync'>;

export function creerStockageSQLite(ouvrir: () => Promise<Base>): StockageHistoires {
  let ouverture: Promise<Base> | undefined;
  function base() {
    if (!ouverture) {
      ouverture = ouvrir().then(async (db) => {
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS histoires (id TEXT PRIMARY KEY NOT NULL, meta TEXT NOT NULL, etat TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS messages (
            histoireId TEXT NOT NULL, id TEXT NOT NULL, position INTEGER NOT NULL, contenu TEXT NOT NULL,
            PRIMARY KEY (histoireId, id)
          );
        `);
        return db;
      }).catch((erreur) => { ouverture = undefined; throw erreur; });
    }
    return ouverture;
  }

  return {
    async lister() {
      const db = await base();
      const lignes = await db.getAllAsync<{ meta: string }>('SELECT meta FROM histoires');
      return lignes.map((ligne) => JSON.parse(ligne.meta));
    },
    async lire(id) {
      const db = await base();
      let resultat: HistoireStockee | null = null;
      await db.withExclusiveTransactionAsync(async (tx) => {
        const ligne = await tx.getFirstAsync<LigneHistoire>('SELECT id, meta, etat FROM histoires WHERE id = ?', id);
        if (ligne) {
          const messages = await tx.getAllAsync<MessageStocke>(
            'SELECT id, position, contenu FROM messages WHERE histoireId = ? ORDER BY position', id,
          );
          resultat = { ...ligne, messages };
        }
      });
      return resultat;
    },
    async ecrire(histoire, seulementSiAbsente = false) {
      const db = await base();
      await db.withExclusiveTransactionAsync(async (tx) => {
        if (seulementSiAbsente && await tx.getFirstAsync('SELECT id FROM histoires WHERE id = ?', histoire.id)) return;
        const anciens = await tx.getAllAsync<MessageStocke>(
          'SELECT id, position, contenu FROM messages WHERE histoireId = ?', histoire.id,
        );
        const delta = differencesMessages(anciens, histoire.messages);
        await tx.runAsync(
          'INSERT INTO histoires (id, meta, etat) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET meta = excluded.meta, etat = excluded.etat',
          histoire.id, histoire.meta, histoire.etat,
        );
        for (const id of delta.supprimer) {
          await tx.runAsync('DELETE FROM messages WHERE histoireId = ? AND id = ?', histoire.id, id);
        }
        for (const message of delta.ecrire) {
          await tx.runAsync(
            'INSERT INTO messages (histoireId, id, position, contenu) VALUES (?, ?, ?, ?) ON CONFLICT(histoireId, id) DO UPDATE SET position = excluded.position, contenu = excluded.contenu',
            histoire.id, message.id, message.position, message.contenu,
          );
        }
      });
    },
    async supprimer(id) {
      const db = await base();
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync('DELETE FROM messages WHERE histoireId = ?', id);
        await tx.runAsync('DELETE FROM histoires WHERE id = ?', id);
      });
    },
  };
}
