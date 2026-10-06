import type { EntreeJournal } from '../engine/journalDiagnostic';

// Version web : journal gardé en mémoire le temps de la session (la version
// web sert de prévisualisation ; l'analyse de parties se fait sur Android).

const TAILLE_MAX = 4_000_000;
const journaux = new Map<string, { entrees: EntreeJournal[]; taille: number }>();

export function ajouterAuJournal(storyId: string, entree: EntreeJournal): void {
  const j = journaux.get(storyId) ?? { entrees: [], taille: 0 };
  const taille = JSON.stringify(entree).length;
  j.entrees.push(entree);
  j.taille += taille;
  while (j.taille > TAILLE_MAX && j.entrees.length > 1) {
    j.taille -= JSON.stringify(j.entrees.shift()).length;
  }
  journaux.set(storyId, j);
}

export async function lireJournal(storyId: string): Promise<EntreeJournal[]> {
  return [...(journaux.get(storyId)?.entrees ?? [])];
}

export async function supprimerJournal(storyId: string): Promise<void> {
  journaux.delete(storyId);
}
