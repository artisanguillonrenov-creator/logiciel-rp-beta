import { creerFileSerie } from '../storage/serialQueue';
import {
  migrerReglagesVisuels,
  reglagesVisuelsInitiaux,
  validerReglagesVisuels,
  type ReglagesVisuels,
} from './reglagesVisuels';

/** Configuration V3 : une seule clé lue par toutes les images. */
export const CLE_REGLAGES_VISUELS_V3 = '@elyndor/concepteur/visuel-v3';
/**
 * Ancienne clé (schéma 1). Elle n'est JAMAIS modifiée ni supprimée : elle sert
 * de sauvegarde de la configuration précédente (retour arrière, ancienne APK).
 */
export const CLE_REGLAGES_VISUELS_V1 = '@elyndor/concepteur/visuel-v1';

interface StockageCleValeur {
  getItem(cle: string): Promise<string | null>;
  setItem(cle: string, valeur: string): Promise<void>;
}

export interface DepotReglagesVisuels {
  lire(): Promise<ReglagesVisuels>;
  enregistrer(v: ReglagesVisuels): Promise<ReglagesVisuels>;
  remigrer(): Promise<ReglagesVisuels>;
  notesMigration(): string[];
  viderCache(): void;
}

/**
 * Lecture de la configuration unique. Au premier lancement de la V3,
 * l'ancienne configuration est migrée une fois (un seul setItem) ; sur erreur
 * de lecture on refuse d'écraser le contenu local et on remonte l'erreur.
 */
export function creerDepotReglagesVisuels(stockage: () => StockageCleValeur): DepotReglagesVisuels {
  const queue = creerFileSerie();
  let cache: ReglagesVisuels | null = null;
  let notes: string[] = [];
  return {
    lire: () => queue(async () => {
      if (cache) return cache;
      const brutV3 = await stockage().getItem(CLE_REGLAGES_VISUELS_V3);
      if (brutV3) {
        cache = validerReglagesVisuels(JSON.parse(brutV3));
        return cache;
      }
      const brutV1 = await stockage().getItem(CLE_REGLAGES_VISUELS_V1);
      if (!brutV1) {
        cache = reglagesVisuelsInitiaux();
        return cache;
      }
      const migration = migrerReglagesVisuels(JSON.parse(brutV1));
      await stockage().setItem(CLE_REGLAGES_VISUELS_V3, JSON.stringify(migration.reglages));
      notes = migration.notes;
      cache = migration.reglages;
      return cache;
    }),
    enregistrer: (v) => {
      const valide = { ...validerReglagesVisuels(v), majLe: Date.now() };
      return queue(async () => {
        await stockage().setItem(CLE_REGLAGES_VISUELS_V3, JSON.stringify(valide));
        cache = valide;
        return valide;
      });
    },
    // Retour à la conversion de l'ancienne configuration, toujours conservée.
    remigrer: () => queue(async () => {
      const brutV1 = await stockage().getItem(CLE_REGLAGES_VISUELS_V1);
      const reglages = brutV1 ? migrerReglagesVisuels(JSON.parse(brutV1)).reglages : reglagesVisuelsInitiaux();
      await stockage().setItem(CLE_REGLAGES_VISUELS_V3, JSON.stringify(reglages));
      cache = reglages;
      return reglages;
    }),
    notesMigration: () => [...notes],
    viderCache: () => { cache = null; notes = []; },
  };
}

// Ne charge pas AsyncStorage natif lors d'un import des outils purement Node.
const depot = creerDepotReglagesVisuels(
  () => require('@react-native-async-storage/async-storage').default as StockageCleValeur,
);

export const lireReglagesVisuels = (): Promise<ReglagesVisuels> => depot.lire();
export const enregistrerReglagesVisuels = (v: ReglagesVisuels): Promise<ReglagesVisuels> => depot.enregistrer(v);
export const remigrerDepuisAncienneConfiguration = (): Promise<ReglagesVisuels> => depot.remigrer();
export const notesDerniereMigration = (): string[] => depot.notesMigration();
export function reinitialiserCacheVisuelPourTests(): void { depot.viderCache(); }
