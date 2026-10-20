import type { MondeState } from '../types';
import type { ChapitreMonde } from '../mondes/types';

// Chapitres d'un monde (mécanisme générique, optionnel) : le paquet décrit sa
// trame, l'état du monde retient le chapitre en cours, et seule la fiche de ce
// chapitre part au narrateur. Le passage au suivant se fait par l'outil
// avancer_chapitre (tools.ts), traité dans worldSimulation.ts.

/**
 * Délai minimal, en messages de l'histoire, entre deux avancées de chapitre :
 * garde-fou de rythme contre un extracteur trop pressé.
 */
export const DELAI_MIN_AVANCEE_CHAPITRE = 10;

export interface EtatChapitre {
  enCours: ChapitreMonde;
  precedent?: ChapitreMonde;
  suivant?: ChapitreMonde;
  /** Messages écoulés depuis la dernière avancée (ou depuis le début de l'histoire). */
  messagesDepuisAvancee: number;
}

/** Chapitre en cours d'une histoire ; undefined pour un monde sans chapitres. Absent ou inconnu : premier chapitre. */
export function etatChapitre(
  chapitres: readonly ChapitreMonde[] | undefined,
  monde: Pick<MondeState, 'chapitreId' | 'chapitreDepuisMessage'>,
  nbMessages: number,
): EtatChapitre | undefined {
  if (!chapitres?.length) return undefined;
  const enCours = chapitres.find((c) => c.id === monde.chapitreId) ?? chapitres[0];
  return {
    enCours,
    precedent: chapitres.find((c) => c.suivant === enCours.id),
    suivant: enCours.suivant ? chapitres.find((c) => c.id === enCours.suivant) : undefined,
    messagesDepuisAvancee: nbMessages - (monde.chapitreDepuisMessage ?? 0),
  };
}

/** Seul le chapitre suivant immédiat est accepté, et pas avant le délai minimal : aucun saut possible. */
export function avanceeChapitreAutorisee(etat: EtatChapitre | undefined, vers: unknown): boolean {
  return !!etat?.suivant && vers === etat.suivant.id && etat.messagesDepuisAvancee >= DELAI_MIN_AVANCEE_CHAPITRE;
}

/**
 * Bloc du prompt : fiche du chapitre en cours, ses jalons de fin et le titre du
 * chapitre précédent. Les chapitres suivants ne sont jamais transmis.
 */
export function formaterChapitre(etat: EtatChapitre | undefined): string {
  if (!etat) return '';
  const lignes = ['[CHAPITRE EN COURS — fait autorité]'];
  if (etat.precedent) lignes.push(`Chapitre précédent : ${etat.precedent.id} — ${etat.precedent.titre}.`);
  lignes.push(etat.enCours.fiche);
  if (etat.enCours.jalons.length) {
    lignes.push('Jalons de fin de ce chapitre (le récit ne passe au chapitre suivant qu’une fois tous atteints) :');
    for (const jalon of etat.enCours.jalons) lignes.push(`- ${jalon}`);
  }
  return lignes.join('\n');
}
