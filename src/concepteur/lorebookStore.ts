import AsyncStorage from '@react-native-async-storage/async-storage';
import { creerFileSerie } from '../storage/serialQueue';
import { monde } from '../mondes';
import {
  cleLoreAtelier, creerEtatLore, validerEtatLore, modifierEtatLore, restaurerRevisionLore, analyserImportLore,
  type EtatLore,
} from './lorebookModele';

const queue = creerFileSerie();
const caches = new Map<string, EtatLore>();

async function disque(mondeId: string): Promise<EtatLore> {
  const existant = caches.get(mondeId);
  if (existant) return existant;
  const brut = await AsyncStorage.getItem(cleLoreAtelier(mondeId));
  // Si le stockage est corrompu, ne jamais écraser automatiquement ses octets.
  const etat = brut ? validerEtatLore(JSON.parse(brut), mondeId) : creerEtatLore();
  caches.set(mondeId, etat);
  return etat;
}
export function lireLoreAtelier(mondeId: string = monde.actifId()): Promise<EtatLore> {
  return queue(() => disque(mondeId));
}
/** Transaction sérialisée. Le cache n'avance qu'après persistance confirmée. */
export function modifierLoreAtelier(modifier: (ancien: EtatLore) => EtatLore, mondeId: string = monde.actifId()): Promise<EtatLore> {
  return queue(async () => {
    const avant = await disque(mondeId);
    const apres = validerEtatLore(modifier(avant), mondeId);
    if (apres.numero !== avant.numero) {
      await AsyncStorage.setItem(cleLoreAtelier(mondeId), JSON.stringify(apres));
      caches.set(mondeId, apres);
    }
    return caches.get(mondeId) ?? avant;
  });
}
export function restaurerLoreAtelier(numero: number, mondeId: string = monde.actifId()) {
  return modifierLoreAtelier(ancien => restaurerRevisionLore(ancien, numero), mondeId);
}
/**
 * Import volontaire : toutes les modifications importées deviennent des
 * brouillons à vérifier, y compris les fiches ordinaires et les ajouts.
 * Les publications en cours ne sont pas effacées sans validation UI préalable.
 * Les fiches canoniques d'un autre monde sont refusées.
 */
export function importerLoreAtelier(texte: string, mondeId: string = monde.actifId()): Promise<EtatLore> {
  const reconstitue = analyserImportLore(texte, mondeId);
  return modifierLoreAtelier(ancien => {
    const brouillons = { ...ancien.brouillons, ...reconstitue.changements,
      ...reconstitue.ajouts, ...reconstitue.brouillons };
    return modifierEtatLore(ancien, { changements: ancien.changements,
      ajouts: ancien.ajouts, brouillons }, 'Import dans les brouillons');
  }, mondeId);
}
export function reinitialiserCacheLorePourTests(): void { caches.clear(); }
