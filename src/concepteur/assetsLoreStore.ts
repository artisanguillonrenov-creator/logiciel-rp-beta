import { creerFileSerie } from '../storage/serialQueue';
import { etatAssetsLoreVide, validerEtatAssetsLore, type EtatAssetsLore } from './assetsLore';

/** Liens fiche → image du lorebook (les images sont dans storage/assetsVisuelsStore). */
const CLE = '@elyndor/concepteur/assets-lore-v1';
const queue = creerFileSerie();
let cache: EtatAssetsLore | null = null;

function stockage() {
  return require('@react-native-async-storage/async-storage').default as typeof import('@react-native-async-storage/async-storage').default;
}

async function disque(): Promise<EtatAssetsLore> {
  if (cache) return cache;
  const brut = await stockage().getItem(CLE);
  // Contenu illisible : on refuse de l'écraser automatiquement.
  cache = brut ? validerEtatAssetsLore(JSON.parse(brut)) : etatAssetsLoreVide();
  return cache;
}

export function lireAssetsLore(): Promise<EtatAssetsLore> {
  return queue(() => disque());
}

/** Transaction sérialisée : le cache n'avance qu'après écriture confirmée. */
export function modifierAssetsLore(modifier: (avant: EtatAssetsLore) => EtatAssetsLore): Promise<EtatAssetsLore> {
  return queue(async () => {
    const apres = validerEtatAssetsLore(modifier(await disque()));
    await stockage().setItem(CLE, JSON.stringify(apres));
    cache = apres;
    return apres;
  });
}

export function reinitialiserCacheAssetsLorePourTests(): void { cache = null; }
