import { creerFileSerie } from '../storage/serialQueue';
import { REGLAGES_VISUELS_INITIAUX, validerReglagesVisuels, type ReglagesVisuels } from './reglagesVisuels';
const CLE = '@elyndor/concepteur/visuel-v1';
const queue = creerFileSerie();
let cache: ReglagesVisuels | null = null;
// Ne charge pas AsyncStorage natif lors d'un import des outils purement Node.
function stockage() {
  return require('@react-native-async-storage/async-storage').default
    as typeof import('@react-native-async-storage/async-storage').default;
}
/** Sur erreur de lecture on refuse d'écraser le contenu local et on remonte l'erreur. */
export function lireReglagesVisuels(): Promise<ReglagesVisuels> {
  return queue(async () => {
    if (cache) return cache;
    const raw = await stockage().getItem(CLE);
    cache = raw ? validerReglagesVisuels(JSON.parse(raw)) : { ...REGLAGES_VISUELS_INITIAUX };
    return cache;
  });
}
export function enregistrerReglagesVisuels(v: ReglagesVisuels): Promise<ReglagesVisuels> {
  const valide = validerReglagesVisuels(v);
  return queue(async () => {
    await stockage().setItem(CLE, JSON.stringify(valide));
    cache = valide;
    return valide;
  });
}
export function reinitialiserCacheVisuelPourTests() { cache = null; }
