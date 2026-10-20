import type { ChapitreEnAttente, MondeState } from '../types';
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

/** Champs de MondeState propres aux chapitres. */
export type EtatChapitreStocke = Pick<MondeState, 'chapitreId' | 'chapitreDepuisMessage' | 'chapitreEnAttente' | 'chapitreAvant'>;

export interface EtatChapitre {
  enCours: ChapitreMonde;
  precedent?: ChapitreMonde;
  suivant?: ChapitreMonde;
  /** Messages écoulés depuis la dernière avancée (ou depuis le début de l'histoire). */
  messagesDepuisAvancee: number;
}

function sansIndefinis(etat: EtatChapitreStocke): EtatChapitreStocke {
  return Object.fromEntries(Object.entries(etat).filter(([, v]) => v !== undefined)) as EtatChapitreStocke;
}

export function champsChapitre(monde: EtatChapitreStocke): EtatChapitreStocke {
  return sansIndefinis({
    chapitreId: monde.chapitreId,
    chapitreDepuisMessage: monde.chapitreDepuisMessage,
    chapitreEnAttente: monde.chapitreEnAttente,
    chapitreAvant: monde.chapitreAvant,
  });
}

/** Avancée en attente qui a pris effet : relevée au plus tard maintenant, délai écoulé. */
function attenteEchue(enCours: ChapitreMonde, depuis: number, attente: ChapitreEnAttente | undefined, nbMessages: number): boolean {
  return !!attente && attente.vers === enCours.suivant && attente.auMessage <= nbMessages
    && nbMessages - depuis >= DELAI_MIN_AVANCEE_CHAPITRE;
}

/**
 * Chapitre en cours d'une histoire ; undefined pour un monde sans chapitres.
 * Absent ou inconnu : premier chapitre. Une avancée en attente compte dès que
 * le délai minimal est écoulé.
 */
export function etatChapitre(
  chapitres: readonly ChapitreMonde[] | undefined,
  monde: EtatChapitreStocke,
  nbMessages: number,
): EtatChapitre | undefined {
  if (!chapitres?.length) return undefined;
  let enCours = chapitres.find((c) => c.id === monde.chapitreId) ?? chapitres[0];
  let depuis = monde.chapitreDepuisMessage ?? 0;
  if (attenteEchue(enCours, depuis, monde.chapitreEnAttente, nbMessages)) {
    enCours = chapitres.find((c) => c.id === enCours.suivant) ?? enCours;
    depuis += DELAI_MIN_AVANCEE_CHAPITRE;
  }
  return {
    enCours,
    precedent: chapitres.find((c) => c.suivant === enCours.id),
    suivant: enCours.suivant ? chapitres.find((c) => c.id === enCours.suivant) : undefined,
    messagesDepuisAvancee: nbMessages - depuis,
  };
}

/** Seul le chapitre suivant immédiat est accepté, et pas avant le délai minimal : aucun saut possible. */
export function avanceeChapitreAutorisee(etat: EtatChapitre | undefined, vers: unknown): boolean {
  return !!etat?.suivant && vers === etat.suivant.id && etat.messagesDepuisAvancee >= DELAI_MIN_AVANCEE_CHAPITRE;
}

/** Avancée vers le bon chapitre mais trop tôt : elle sera mise en attente plutôt que perdue. */
export function avanceeChapitreTropTot(etat: EtatChapitre | undefined, vers: unknown): boolean {
  return !!etat?.suivant && vers === etat.suivant.id && etat.messagesDepuisAvancee < DELAI_MIN_AVANCEE_CHAPITRE;
}

/** État à restaurer si l'avancée est annulée par une régénération. */
function avant(monde: EtatChapitreStocke): NonNullable<MondeState['chapitreAvant']> {
  const etat: NonNullable<MondeState['chapitreAvant']> = {};
  if (monde.chapitreId !== undefined) etat.id = monde.chapitreId;
  if (monde.chapitreDepuisMessage !== undefined) etat.depuisMessage = monde.chapitreDepuisMessage;
  if (monde.chapitreEnAttente !== undefined) etat.enAttente = monde.chapitreEnAttente;
  return etat;
}

/** Enregistre dans l'état stocké une avancée en attente qui a pris effet. */
export function fixerChapitre(chapitres: readonly ChapitreMonde[] | undefined, monde: EtatChapitreStocke, nbMessages: number): EtatChapitreStocke {
  const etat = etatChapitre(chapitres, monde, nbMessages);
  const stocke = chapitres?.find((c) => c.id === monde.chapitreId) ?? chapitres?.[0];
  if (!etat || etat.enCours.id === stocke?.id) return champsChapitre(monde);
  return sansIndefinis({
    chapitreId: etat.enCours.id,
    chapitreDepuisMessage: (monde.chapitreDepuisMessage ?? 0) + DELAI_MIN_AVANCEE_CHAPITRE,
    chapitreAvant: avant(monde),
  });
}

/** Avancée validée : chapitre suivant, l'état précédent est conservé pour une régénération. */
export function avancerChapitre(monde: EtatChapitreStocke, vers: string, nbMessages: number): EtatChapitreStocke {
  return sansIndefinis({ chapitreId: vers, chapitreDepuisMessage: nbMessages, chapitreAvant: avant(monde) });
}

/** Avancée relevée trop tôt : mise en attente (la première relevée est gardée). */
export function differerChapitre(monde: EtatChapitreStocke, vers: string, nbMessages: number): EtatChapitreStocke {
  if (monde.chapitreEnAttente?.vers === vers) return champsChapitre(monde);
  return champsChapitre({ ...monde, chapitreEnAttente: { vers, auMessage: nbMessages } });
}

/**
 * Régénération du dernier échange : une avancée (ou une mise en attente)
 * relevée après les messages restants est annulée.
 */
export function annulerAvanceeChapitre<T extends EtatChapitreStocke>(monde: T, nbMessagesRestants: number): T {
  let resultat: T = monde;
  if (resultat.chapitreAvant && (resultat.chapitreDepuisMessage ?? 0) > nbMessagesRestants) {
    const { chapitreAvant, chapitreId: _id, chapitreDepuisMessage: _depuis, chapitreEnAttente: _attente, ...reste } = resultat;
    resultat = { ...reste, ...sansIndefinis({ chapitreId: chapitreAvant.id, chapitreDepuisMessage: chapitreAvant.depuisMessage, chapitreEnAttente: chapitreAvant.enAttente }) } as T;
  }
  if (resultat.chapitreEnAttente && resultat.chapitreEnAttente.auMessage > nbMessagesRestants) {
    const { chapitreEnAttente: _attente, ...reste } = resultat;
    resultat = reste as T;
  }
  return resultat;
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
