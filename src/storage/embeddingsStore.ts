import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings } from '../types';
import { obtenirEmbeddings, type FournisseurEmbeddings } from '../engine/embeddings';

// Une clé AsyncStorage par entrée (plutôt qu'un unique blob JSON regroupant
// tout le cache) — le blob unique a fini par dépasser la taille max d'une
// ligne SQLite qu'AsyncStorage utilise comme backend sur Android ("Row too
// big to fit into CursorWindow", constaté en usage réel après plusieurs
// histoires jouées). Le lore Elyndor, les métamoteurs, et surtout les PNJ /
// lieux / factions émergents de CHAQUE histoire s'accumulent dans ce cache
// sans jamais être purgés — seules les entrées "msg-" (souvenirs) sont
// plafonnées, voir idsAEvincer — donc un unique blob ne fait que grossir. Un
// vecteur seul (quelques Ko une fois sérialisé) reste largement sous cette
// limite ; seul un blob qui en regroupe des centaines pouvait la dépasser.
const PREFIXE_ENTREE = '@rp_beta/embeddings_cache/';
const CLEF_INDEX = '@rp_beta/embeddings_cache_index';
const CLEF_FOURNISSEUR = '@rp_beta/embeddings_cache_fournisseur';

interface EntreeCache {
  hash: string;
  vecteur: number[];
}

function cleEntree(id: string): string {
  return `${PREFIXE_ENTREE}${id}`;
}

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

async function chargerIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(CLEF_INDEX);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function chargerFournisseur(): Promise<FournisseurEmbeddings | null> {
  const raw = await AsyncStorage.getItem(CLEF_FOURNISSEUR);
  return raw === 'openrouter' || raw === 'openai' ? raw : null;
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

function idsAEvincer(index: string[]): string[] {
  const clesMessages = index.filter((id) => id.startsWith('msg-'));
  if (clesMessages.length <= MAX_ENTREES_MESSAGES) return [];
  return clesMessages.slice(0, clesMessages.length - MAX_ENTREES_MESSAGES);
}

// Réglages concepteur (mode test) : vider le cache force un recalcul complet
// des embeddings au prochain tour — utile après un changement de contenu
// massif (pack de contenu, lore) qu'on veut voir pris en compte tout de
// suite plutôt que d'attendre l'invalidation entrée par entrée. Aussi
// utilisé comme filet de secours quand l'écriture d'une histoire échoue
// faute de place (voir storage.ts, ecrireAvecRetraitSurQuota).
export async function viderCacheEmbeddings(): Promise<void> {
  const index = await chargerIndex();
  if (index.length > 0) await AsyncStorage.multiRemove(index.map(cleEntree));
  await AsyncStorage.multiRemove([CLEF_INDEX, CLEF_FOURNISSEUR]);
}

export interface EntreeAEmbeder {
  id: string;
  contenu: string;
}

// Écrit les entrées nouvelles/mises à jour (une clé par id, voir l'en-tête
// du fichier), met à jour l'index et le fournisseur, et applique le plafond
// des entrées "msg-" (idsAEvincer). Jamais d'échec bloquant : le cache est
// une optimisation, pas une condition pour que le tour aboutisse — les
// vecteurs déjà calculés restent utilisables pour ce tour même si la mise
// en cache échoue (quota dépassé, stockage indisponible...).
async function ecrireEntrees(
  fournisseur: FournisseurEmbeddings,
  nouvelles: Record<string, EntreeCache>,
  indexPrecedent: string[],
): Promise<void> {
  try {
    const idsNouveaux = Object.keys(nouvelles);
    const indexMaj = [...new Set([...indexPrecedent, ...idsNouveaux])];
    const aEvincer = idsAEvincer(indexMaj);
    const aEvincerSet = new Set(aEvincer);
    const indexFinal = indexMaj.filter((id) => !aEvincerSet.has(id));

    const paires: [string, string][] = idsNouveaux
      .filter((id) => !aEvincerSet.has(id))
      .map((id) => [cleEntree(id), JSON.stringify(nouvelles[id])]);

    if (paires.length > 0) await AsyncStorage.multiSet(paires);
    if (aEvincer.length > 0) await AsyncStorage.multiRemove(aEvincer.map(cleEntree));
    await AsyncStorage.multiSet([
      [CLEF_INDEX, JSON.stringify(indexFinal)],
      [CLEF_FOURNISSEUR, fournisseur],
    ]);
  } catch {
    // Optimisation seulement, voir plus haut.
  }
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
  const index = await chargerIndex();
  const indexSet = new Set(index);
  const fournisseurCache = await chargerFournisseur();
  const hashParId = new Map(entrees.map((e) => [e.id, empreinte(e.contenu)]));

  const idsPresents = entrees.map((e) => e.id).filter((id) => indexSet.has(id));
  const pairesExistantes = idsPresents.length > 0 ? await AsyncStorage.multiGet(idsPresents.map(cleEntree)) : [];
  const existantesParId = new Map<string, EntreeCache>();
  for (const [cle, valeur] of pairesExistantes) {
    if (!valeur) continue;
    try {
      existantesParId.set(cle.slice(PREFIXE_ENTREE.length), JSON.parse(valeur));
    } catch {
      // Entrée corrompue : ignorée, traitée comme absente (recalculée ci-dessous).
    }
  }

  const manquants = entrees.filter((e) => {
    const existant = existantesParId.get(e.id);
    return !existant || existant.hash !== hashParId.get(e.id);
  });

  if (manquants.length === 0) {
    return Object.fromEntries(entrees.map((e) => [e.id, existantesParId.get(e.id)!.vecteur]));
  }

  const resultat = await obtenirEmbeddings(manquants.map((e) => e.contenu), appSettings);
  const cacheAvaitDejaDesEntrees = index.length > 0;

  if (cacheAvaitDejaDesEntrees && fournisseurCache !== null && fournisseurCache !== resultat.fournisseur) {
    // Fournisseur changé : impossible de mélanger les anciens vecteurs avec
    // les nouveaux — on jette tout le cache existant et on recalcule le lot
    // demandé d'un coup.
    const tout = await obtenirEmbeddings(entrees.map((e) => e.contenu), appSettings);
    const nouvellesEntrees: Record<string, EntreeCache> = {};
    entrees.forEach((e, i) => {
      nouvellesEntrees[e.id] = { hash: hashParId.get(e.id)!, vecteur: tout.vecteurs[i] };
    });
    if (index.length > 0) await AsyncStorage.multiRemove(index.map(cleEntree));
    await ecrireEntrees(tout.fournisseur, nouvellesEntrees, []);
    return Object.fromEntries(entrees.map((e) => [e.id, nouvellesEntrees[e.id].vecteur]));
  }

  const nouvellesEntrees: Record<string, EntreeCache> = {};
  manquants.forEach((e, i) => {
    nouvellesEntrees[e.id] = { hash: hashParId.get(e.id)!, vecteur: resultat.vecteurs[i] };
  });
  await ecrireEntrees(resultat.fournisseur, nouvellesEntrees, index);

  return Object.fromEntries(
    entrees.map((e) => [e.id, nouvellesEntrees[e.id]?.vecteur ?? existantesParId.get(e.id)!.vecteur]),
  );
}
