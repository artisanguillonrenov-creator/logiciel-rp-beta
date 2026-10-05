import ElyndorObjectBox from '../../modules/elyndor-objectbox';

export interface EntreeObjectBox {
  id: string;
  contenu: string;
  vecteur: number[];
  timestamp?: number;
}

export type ScoresObjectBox = Record<string, number>;

const snapshotsLore = new Map<string, string>();
const snapshotsHistoire = new Map<string, string>();

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
