import AsyncStorage from '@react-native-async-storage/async-storage';
import { creerFileSerie } from '../storage/serialQueue';
import {
  creerEtatLore, validerEtatLore, modifierEtatLore, restaurerRevisionLore, analyserImportLore,
  type EtatLore,
} from './lorebookModele';

const CLE = '@elyndor/concepteur/lorebook-v1';
const queue = creerFileSerie();
let cache: EtatLore | null = null;

async function disque(): Promise<EtatLore> {
  if (cache) return cache;
  const brut = await AsyncStorage.getItem(CLE);
  // Si le stockage est corrompu, ne jamais écraser automatiquement ses octets.
  cache = brut ? validerEtatLore(JSON.parse(brut)) : creerEtatLore();
  return cache;
}
export function lireLoreAtelier(): Promise<EtatLore> {
  return queue(() => disque());
}
/** Transaction sérialisée. Le cache n'avance qu'après persistance confirmée. */
export function modifierLoreAtelier(modifier: (ancien: EtatLore) => EtatLore): Promise<EtatLore> {
  return queue(async () => {
    const avant = await disque();
    const apres = validerEtatLore(modifier(avant));
    if (apres.numero !== avant.numero) {
      await AsyncStorage.setItem(CLE, JSON.stringify(apres));
      cache = apres;
    }
    return cache ?? avant;
  });
}
export function restaurerLoreAtelier(numero: number) {
  return modifierLoreAtelier(ancien => restaurerRevisionLore(ancien, numero));
}
/**
 * Import volontaire : toutes les modifications importées deviennent des
 * brouillons à vérifier, y compris les fiches ordinaires et les ajouts.
 * Les publications en cours ne sont pas effacées sans validation UI préalable.
 */
export function importerLoreAtelier(texte: string): Promise<EtatLore> {
  const reconstitue = analyserImportLore(texte);
  return modifierLoreAtelier(ancien => {
    const brouillons = { ...ancien.brouillons, ...reconstitue.changements,
      ...reconstitue.ajouts, ...reconstitue.brouillons };
    return modifierEtatLore(ancien, { changements: ancien.changements,
      ajouts: ancien.ajouts, brouillons }, 'Import dans les brouillons');
  });
}
export function reinitialiserCacheLorePourTests(): void { cache = null; }
