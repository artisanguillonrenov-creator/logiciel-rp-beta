import ElyndorObjectBox from '../../modules/elyndor-objectbox';

export interface EntreeObjectBox {
  id: string;
  contenu: string;
  vecteur: number[];
  timestamp?: number;
}

export type ScoresObjectBox = Record<string, number>;
export type TypeIndexObjectBox = 'lore' | 'history';

const NAMESPACE_LORE_ACTIF = '__elyndor_lore_actif__';
const STORY_HISTOIRE_ACTIVE = '__elyndor_histoire_active__';
const snapshotsLore = new Map<string, string>();
const snapshotsHistoire = new Map<string, string>();
const cacheRequetes = new WeakMap<number[], Partial<Record<TypeIndexObjectBox, ScoresObjectBox>>>();

interface VecteurAvecIndex extends Array<number> {
  __elyndorObjectBox?: { type: TypeIndexObjectBox; id: string };
}

declare global {
  // Pont volontairement minuscule : embeddings.ts reste indépendant d'Expo/
  // React Native et les tests Node continuent donc de fonctionner sans module natif.
  var __elyndorObjectBoxScore:
    | ((type: TypeIndexObjectBox, id: string, vecteurRequete: number[]) => number | undefined)
    | undefined;
}

function fnvAjouter(hash: number, valeur: number): number {
  hash ^= valeur;
  return Math.imul(hash, 0x01000193);
}

function empreinteTexte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) h = fnvAjouter(h, texte.charCodeAt(i));
  return (h >>> 0).toString(16);
}

function empreinteVecteur(vecteur: number[]): string {
  let h = 0x811c9dc5;
  const floats = new Float32Array(vecteur);
  const bytes = new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength);
  for (let i = 0; i < bytes.length; i++) h = fnvAjouter(h, bytes[i]);
  return (h >>> 0).toString(16);
}

function empreinteEntree(entree: EntreeObjectBox): string {
  return `${empreinteTexte(entree.contenu)}:${empreinteVecteur(entree.vecteur)}`;
}

function empreinteSnapshot(entrees: EntreeObjectBox[]): string {
  let h = 0x811c9dc5;
  for (const entree of entrees) {
    const morceau = `${entree.id}:${empreinteEntree(entree)}:${entree.timestamp ?? 0}|`;
    for (let i = 0; i < morceau.length; i++) h = fnvAjouter(h, morceau.charCodeAt(i));
  }
  return (h >>> 0).toString(16);
}

function serialiserEntrees(entrees: EntreeObjectBox[]): string {
  return JSON.stringify(
    entrees.map((entree) => ({
      id: entree.id,
      hash: empreinteEntree(entree),
      vector: entree.vecteur,
      timestamp: entree.timestamp ?? 0,
    })),
  );
}

function parserScores(raw: string): ScoresObjectBox {
  const valeurs = JSON.parse(raw) as Array<{ id?: unknown; score?: unknown }>;
  const scores: ScoresObjectBox = {};
  if (!Array.isArray(valeurs)) return scores;
  for (const valeur of valeurs) {
    if (typeof valeur?.id !== 'string' || typeof valeur?.score !== 'number') continue;
    scores[valeur.id] = valeur.score;
  }
  return scores;
}

function marquerVecteur(vecteur: number[], type: TypeIndexObjectBox, id: string): void {
  Object.defineProperty(vecteur as VecteurAvecIndex, '__elyndorObjectBox', {
    value: { type, id },
    configurable: true,
    enumerable: false,
    writable: true,
  });
}

function rechercherSync(type: TypeIndexObjectBox, vecteurRequete: number[]): ScoresObjectBox | undefined {
  if (!ElyndorObjectBox || vecteurRequete.length === 0) return undefined;
  let cache = cacheRequetes.get(vecteurRequete);
  if (!cache) {
    cache = {};
    cacheRequetes.set(vecteurRequete, cache);
  }
  if (cache[type]) return cache[type];

  try {
    const raw = type === 'lore'
      ? ElyndorObjectBox.searchLoreSync(NAMESPACE_LORE_ACTIF, JSON.stringify(vecteurRequete), 256)
      : ElyndorObjectBox.searchHistorySync(STORY_HISTOIRE_ACTIVE, JSON.stringify(vecteurRequete), 128);
    const scores = parserScores(raw);
    cache[type] = scores;
    return scores;
  } catch {
    return undefined;
  }
}

// embeddings.ts appelle ce crochet uniquement quand un vecteur d'entrée a
// été indexé par ObjectBox. Une recherche HNSW est exécutée une fois par
// requête/type, puis toutes les comparaisons suivantes sont de simples accès
// dans la table de scores au lieu d'un balayage cosinus de tout le corpus.
globalThis.__elyndorObjectBoxScore = (type, id, vecteurRequete) => {
  const scores = rechercherSync(type, vecteurRequete);
  if (!scores) return undefined;
  return scores[id] ?? -1;
};

export function objectBoxDisponible(): boolean {
  return ElyndorObjectBox !== null;
}

export async function synchroniserLoreObjectBox(namespace: string, entrees: EntreeObjectBox[]): Promise<boolean> {
  if (!ElyndorObjectBox) return false;
  const snapshot = empreinteSnapshot(entrees);
  if (snapshotsLore.get(namespace) === snapshot) return true;
  await ElyndorObjectBox.syncLore(namespace, serialiserEntrees(entrees));
  snapshotsLore.set(namespace, snapshot);
  return true;
}

export async function synchroniserHistoireObjectBox(storyId: string, entrees: EntreeObjectBox[]): Promise<boolean> {
  if (!ElyndorObjectBox) return false;
  const snapshot = empreinteSnapshot(entrees);
  if (snapshotsHistoire.get(storyId) === snapshot) return true;
  await ElyndorObjectBox.syncHistory(storyId, serialiserEntrees(entrees));
  snapshotsHistoire.set(storyId, snapshot);
  return true;
}

/**
 * Branche automatiquement les lots déjà produits par le pipeline actuel :
 * - msg-* => index Histoire ;
 * - meta-* => volontairement ignorés (ancienne architecture) ;
 * - le reste => index Lore.
 *
 * L'index "actif" est resynchronisé à chaque changement de corpus. Il ne peut
 * donc pas faire remonter des éléments provenant d'une autre sauvegarde.
 */
export async function preparerIndexObjectBox(
  entrees: Array<{ id: string; contenu: string }>,
  vecteurs: Record<string, number[]>,
): Promise<void> {
  if (!ElyndorObjectBox || entrees.length === 0) return;
  if (entrees.every((e) => e.id.startsWith('meta-'))) return;

  const type: TypeIndexObjectBox = entrees.every((e) => e.id.startsWith('msg-')) ? 'history' : 'lore';
  const payload: EntreeObjectBox[] = [];
  for (const entree of entrees) {
    const vecteur = vecteurs[entree.id];
    if (!vecteur?.length) continue;
    marquerVecteur(vecteur, type, entree.id);
    payload.push({ id: entree.id, contenu: entree.contenu, vecteur });
  }
  if (payload.length === 0) return;

  if (type === 'history') {
    await synchroniserHistoireObjectBox(STORY_HISTOIRE_ACTIVE, payload);
  } else {
    await synchroniserLoreObjectBox(NAMESPACE_LORE_ACTIF, payload);
  }
}

export async function rechercherLoreObjectBox(
  namespace: string,
  vecteurRequete: number[],
  maxResultats = 40,
): Promise<ScoresObjectBox | null> {
  if (!ElyndorObjectBox || vecteurRequete.length === 0) return null;
  const raw = await ElyndorObjectBox.searchLore(namespace, JSON.stringify(vecteurRequete), maxResultats);
  return parserScores(raw);
}

export async function rechercherHistoireObjectBox(
  storyId: string,
  vecteurRequete: number[],
  maxResultats = 24,
): Promise<ScoresObjectBox | null> {
  if (!ElyndorObjectBox || vecteurRequete.length === 0) return null;
  const raw = await ElyndorObjectBox.searchHistory(storyId, JSON.stringify(vecteurRequete), maxResultats);
  return parserScores(raw);
}

export async function purgerObjectBoxStory(storyId: string): Promise<void> {
  snapshotsLore.delete(storyId);
  snapshotsHistoire.delete(storyId);
  if (ElyndorObjectBox) await ElyndorObjectBox.clearStory(storyId);
}
