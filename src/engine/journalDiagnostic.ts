// Journal de diagnostic détaillé, pour l'export « Diagnostic » : chaque appel
// au narrateur (prompt complet envoyé, réponse brute, paramètres, durée,
// jetons) et chaque génération d'image (prompts, références, durée, erreur),
// rattachés à l'histoire et au tour en cours. Le but : analyser une partie à
// partir des faits enregistrés, sans supposition.
//
// Les histoires vivent dans AsyncStorage (plafond Android de 6 Mo) : le
// journal n'y est jamais écrit. Le moteur ne fait que publier les entrées ;
// l'app branche un « puits » (fichier sur l'appareil, voir
// storage/journalDiagnosticStore). Sans puits (tests, outils), rien n'est
// enregistré.

export type TypeEntreeJournal = 'appel-ia' | 'image' | 'erreur';

export interface EntreeJournal {
  type: TypeEntreeJournal;
  /** Horodatage ISO (UTC). */
  date: string;
  /** Identifiant du diagnostic de tour actif (diagnosticTour), absent hors tour joueur. */
  tourId?: string;
  [champ: string]: unknown;
}

type Puits = (storyId: string, entree: EntreeJournal) => void;
interface TourCourant { id: string; storyId?: string }

let puits: Puits | null = null;
let lireTourCourant: () => TourCourant | undefined = () => undefined;

export function definirPuitsJournal(nouveau: Puits | null): void {
  puits = nouveau;
}

/** Branché par diagnosticTour pour éviter un import circulaire. */
export function definirLecteurTourCourant(lecteur: () => TourCourant | undefined): void {
  lireTourCourant = lecteur;
}

/**
 * L'histoire est toujours celle de l'opération (transmise par l'appelant),
 * jamais celle affichée à l'écran : une tâche de fond de l'histoire A qui se
 * termine pendant que B est ouverte doit rester dans le journal de A. Sans
 * histoire connue, rien n'est enregistré plutôt que mal rangé.
 */
export function journaliser(type: TypeEntreeJournal, donnees: Record<string, unknown>, storyId: string | undefined): void {
  if (!puits || !storyId) return;
  const entree: EntreeJournal = { type, date: new Date().toISOString(), ...donnees };
  const tour = lireTourCourant();
  if (tour && tour.storyId === storyId) entree.tourId = tour.id;
  try {
    puits(storyId, entree);
  } catch {
    // Le diagnostic ne doit jamais interrompre le jeu.
  }
}

/** Les images de référence ne sont pas recopiées : seuls leur rôle et leur taille sont gardés. */
export function resumerReferences(references: ReadonlyArray<{ role: string; image: string }>): Array<{ role: string; taille: number }> {
  return references.map((r) => ({ role: r.role, taille: r.image.length }));
}
