import { creerFileSerie } from '../storage/serialQueue';
import { definirSynonymesPersonnalises, validerGroupesSynonymes } from '../engine/synonymesLexicaux';

/** Groupes de synonymes saisis dans l'Atelier (s'ajoutent aux groupes par défaut). */
const CLE = '@elyndor/concepteur/synonymes-v1';
const queue = creerFileSerie();
let cache: string[][] | null = null;

function stockage() {
  return require('@react-native-async-storage/async-storage').default as typeof import('@react-native-async-storage/async-storage').default;
}

/** Lit les groupes et les applique à la recherche ; une lecture illisible laisse les défauts seuls. */
export function chargerSynonymesPersonnalises(): Promise<string[][]> {
  return queue(async () => {
    if (cache) return cache;
    try {
      const brut = await stockage().getItem(CLE);
      cache = brut ? validerGroupesSynonymes(JSON.parse(brut)) : [];
    } catch {
      cache = [];
    }
    definirSynonymesPersonnalises(cache);
    return cache;
  });
}

export function enregistrerSynonymesPersonnalises(groupes: string[][]): Promise<string[][]> {
  const valides = validerGroupesSynonymes(groupes);
  return queue(async () => {
    await stockage().setItem(CLE, JSON.stringify(valides));
    cache = valides;
    definirSynonymesPersonnalises(valides);
    return valides;
  });
}
