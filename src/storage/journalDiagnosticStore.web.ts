import type { EntreeJournal } from '../engine/journalDiagnostic';

// Version web : journal gardé en mémoire le temps de la session (la version
// web sert de prévisualisation ; l'analyse de parties se fait sur Android).

const journaux = new Map<string, { entrees: EntreeJournal[] }>();

export function ajouterAuJournal(storyId: string, entree: EntreeJournal): void {
  const j = journaux.get(storyId) ?? { entrees: [] };
  j.entrees.push(entree);
  journaux.set(storyId, j);
}

export async function lireJournal(storyId: string): Promise<EntreeJournal[]> {
  return [...(journaux.get(storyId)?.entrees ?? [])];
}

export async function supprimerJournauxOrphelins(storyIdsValides: readonly string[]): Promise<number> {
  const valides = new Set(storyIdsValides);
  let supprimes = 0;
  for (const id of [...journaux.keys()]) {
    if (valides.has(id)) continue;
    journaux.delete(id);
    supprimes++;
  }
  return supprimes;
}

export async function supprimerJournal(storyId: string): Promise<void> {
  journaux.delete(storyId);
}
