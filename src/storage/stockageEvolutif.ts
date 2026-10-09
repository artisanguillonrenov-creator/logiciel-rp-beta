import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { creerFileSerie } from './serialQueue';

/**
 * Stockage durable des données qui grandissent avec les aventures.
 * SQLite natif, hors RKStorage/AsyncStorage, sans quota applicatif.
 * Migration clé par clé : une valeur legacy n'est retirée d'AsyncStorage
 * qu'une fois copiée dans la nouvelle base. Les suppressions posent une
 * pierre tombale pour empêcher toute résurrection en cas d'échec du retrait.
 */
let ouverture: Promise<SQLiteDatabase> | undefined;
const executer = creerFileSerie();
function base(): Promise<SQLiteDatabase> {
  if (!ouverture) {
    ouverture = openDatabaseAsync('elyndor-stockage-evolutif.db').then(async db => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS donnees (
          cle TEXT PRIMARY KEY NOT NULL,
          valeur TEXT
        );
      `);
      return db;
    }).catch(err => { ouverture = undefined; throw err; });
  }
  return ouverture;
}
async function lireInterne(cle: string): Promise<string | null> {
  const db = await base();
  const presente = await db.getFirstAsync<{ valeur: string | null }>(
    'SELECT valeur FROM donnees WHERE cle = ?', cle,
  );
  if (presente) return presente.valeur;
  const ancienne = await AsyncStorage.getItem(cle);
  if (ancienne === null) return null;
  await db.runAsync(
    'INSERT INTO donnees (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur=excluded.valeur',
    cle, ancienne,
  );
  // Ne jamais perdre une sauvegarde si le retrait de l'ancien stockage échoue.
  await AsyncStorage.removeItem(cle).catch(() => {});
  return ancienne;
}
async function ecrireInterne(cle: string, valeur: string | null): Promise<void> {
  const db = await base();
  await db.runAsync(
    'INSERT INTO donnees (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur=excluded.valeur',
    cle, valeur,
  );
  await AsyncStorage.removeItem(cle).catch(() => {});
}
export const stockageEvolutif = {
  getItem(cle: string): Promise<string | null> {
    return executer(() => lireInterne(cle));
  },
  setItem(cle: string, valeur: string): Promise<void> {
    return executer(() => ecrireInterne(cle, valeur));
  },
  multiGet(cles: readonly string[]): Promise<[string, string | null][]> {
    return executer(async () => {
      const ret: [string, string | null][] = [];
      for (const cle of cles) ret.push([cle, await lireInterne(cle)]);
      return ret;
    });
  },
  multiSet(valeurs: readonly (readonly [string, string])[]): Promise<void> {
    return executer(async () => {
      const db = await base();
      await db.withExclusiveTransactionAsync(async tx => {
        for (const [cle, valeur] of valeurs) {
          await tx.runAsync(
            'INSERT INTO donnees (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur=excluded.valeur',
            cle, valeur,
          );
        }
      });
      await AsyncStorage.multiRemove(valeurs.map(([cle]) => cle)).catch(() => {});
    });
  },
  multiRemove(cles: readonly string[]): Promise<void> {
    return executer(async () => {
      const db = await base();
      await db.withExclusiveTransactionAsync(async tx => {
        for (const cle of cles) {
          await tx.runAsync(
            'INSERT INTO donnees (cle, valeur) VALUES (?, NULL) ON CONFLICT(cle) DO UPDATE SET valeur=NULL',
            cle,
          );
        }
      });
      await AsyncStorage.multiRemove([...cles]).catch(() => {});
    });
  },
};
