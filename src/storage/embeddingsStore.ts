import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings } from '../types';
import { obtenirEmbeddings, type FournisseurEmbeddings } from '../engine/embeddings';

const CLEF_CACHE = '@rp_beta/embeddings_cache';

interface EntreeCache {
  hash: string;
  vecteur: number[];
}

interface CacheEmbeddings {
  fournisseur: FournisseurEmbeddings | null;
  entrees: Record<string, EntreeCache>;
}

const CACHE_VIDE: CacheEmbeddings = { fournisseur: null, entrees: {} };

// Empreinte simple (FNV-1a 32 bits) pour détecter qu'une entrée de lore a
// changé de contenu et doit être ré-embeddée — pas un usage cryptographique.
function empreinte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

async function chargerCache(): Promise<CacheEmbeddings> {
  const raw = await AsyncStorage.getItem(CLEF_CACHE);
  if (!raw) return CACHE_VIDE;
  try {
    return JSON.parse(raw);
  } catch {
    return CACHE_VIDE;
  }
}

// Le cache grossit d'une entrée par ancien message de chaque histoire
// (recherche de "souvenirs", voir searchHistorique.ts, ids préfixés
// "msg-") sans jamais être purgé — sur une longue conversation, ça finit
// par dépasser le quota de stockage du navigateur (localStorage, ~5-10 Mo
// par origine sur web, partagé avec les histoires elles-mêmes et le reste
// des réglages). Le lore/les métamoteurs (autres ids), eux, restent
// toujours en cache : ce pool est naturellement borné par la taille du
// lorebook, pas par l'usage, et les réembeder à chaque histoire serait un
// gâchis d'appels réseau. Seules les entrées "msg-" sont plafonnées, en
// gardant les plus récemment ajoutées.
const MAX_ENTREES_MESSAGES = 150;

function plafonnerEntrees(entrees: Record<string, EntreeCache>): Record<string, EntreeCache> {
  const clesMessages = Object.keys(entrees).filter((cle) => cle.startsWith('msg-'));
  if (clesMessages.length <= MAX_ENTREES_MESSAGES) return entrees;
  const aEvincer = new Set(clesMessages.slice(0, clesMessages.length - MAX_ENTREES_MESSAGES));
  const plafonnees: Record<string, EntreeCache> = {};
  for (const [cle, valeur] of Object.entries(entrees)) {
    if (!aEvincer.has(cle)) plafonnees[cle] = valeur;
  }
  return plafonnees;
}

async function sauvegarderCache(cache: CacheEmbeddings): Promise<void> {
  const aEnregistrer: CacheEmbeddings = { ...cache, entrees: plafonnerEntrees(cache.entrees) };
  try {
    await AsyncStorage.setItem(CLEF_CACHE, JSON.stringify(aEnregistrer));
  } catch {
    // Le cache est une optimisation (évite de recalculer des embeddings déjà
    // connus), pas une condition pour que le tour aboutisse — un échec
    // d'écriture (quota dépassé, stockage indisponible...) ne doit jamais
    // faire échouer la génération en cours. Les vecteurs déjà calculés
    // restent utilisables pour ce tour, seule la mise en cache est perdue.
  }
}

export interface EntreeAEmbeder {
  id: string;
  contenu: string;
}

// Réglages concepteur (mode test) : vider le cache force un recalcul complet
// des embeddings au prochain tour — utile après un changement de contenu
// massif (pack de contenu, lore) qu'on veut voir pris en compte tout de
// suite plutôt que d'attendre l'invalidation entrée par entrée.
export async function viderCacheEmbeddings(): Promise<void> {
  await AsyncStorage.removeItem(CLEF_CACHE);
}

/**
 * Renvoie l'embedding de chaque entrée demandée, en réutilisant le cache
 * local (AsyncStorage) quand le contenu n'a pas changé. Ne calcule via
 * l'API que ce qui manque ou a changé. Si le fournisseur d'embeddings a
 * changé depuis le dernier calcul (OpenRouter <-> secours), le cache
 * entier est invalidé — les espaces vectoriels de deux modèles différents
 * ne sont pas comparables entre eux.
 */
export async function assurerEmbeddings(
  entrees: EntreeAEmbeder[],
  appSettings: AppSettings,
): Promise<Record<string, number[]>> {
  const cache = await chargerCache();
  const hashParId = new Map(entrees.map((e) => [e.id, empreinte(e.contenu)]));

  const manquants = entrees.filter((e) => {
    const existant = cache.entrees[e.id];
    return !existant || existant.hash !== hashParId.get(e.id);
  });

  if (manquants.length === 0) {
    return Object.fromEntries(entrees.map((e) => [e.id, cache.entrees[e.id].vecteur]));
  }

  const resultat = await obtenirEmbeddings(manquants.map((e) => e.contenu), appSettings);
  const cacheAvaitDejaDesEntrees = Object.keys(cache.entrees).length > 0;

  if (cacheAvaitDejaDesEntrees && cache.fournisseur !== resultat.fournisseur) {
    // Le fournisseur a changé : impossible de mélanger les anciens vecteurs
    // avec les nouveaux, on recalcule tout le lot demandé d'un coup.
    const tout = await obtenirEmbeddings(entrees.map((e) => e.contenu), appSettings);
    const entreesMaj: Record<string, EntreeCache> = {};
    entrees.forEach((e, i) => {
      entreesMaj[e.id] = { hash: hashParId.get(e.id)!, vecteur: tout.vecteurs[i] };
    });
    await sauvegarderCache({ fournisseur: tout.fournisseur, entrees: entreesMaj });
    return Object.fromEntries(entrees.map((e) => [e.id, entreesMaj[e.id].vecteur]));
  }

  const entreesMaj = { ...cache.entrees };
  manquants.forEach((e, i) => {
    entreesMaj[e.id] = { hash: hashParId.get(e.id)!, vecteur: resultat.vecteurs[i] };
  });
  await sauvegarderCache({ fournisseur: resultat.fournisseur, entrees: entreesMaj });

  return Object.fromEntries(entrees.map((e) => [e.id, entreesMaj[e.id].vecteur]));
}
