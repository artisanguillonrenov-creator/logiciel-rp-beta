/**
 * Narrateur Prax (test) : branchements avec le reste de l'application.
 *
 * Quand `AppSettings.narrateurPrax` est actif, la conversation passe ici au
 * lieu du modèle IA : mêmes entrées, même forme de résultat, aucun appel
 * réseau. Voir src/engine/praxNarrateur/tour.ts pour le déroulé d'un tour.
 */
import type { AppSettings, Message, StoryState } from '../../types';
import type { ResultatTour } from '../generateTurn';
import { niveauIntime } from './intime';
import { jouerTourPrax, ouvrirAvecPrax, regenererTourPrax } from './tour';

export { jouerTourPrax, ouvrirAvecPrax, regenererTourPrax } from './tour';
export type { CompteRenduTour, EtatPraxHistoire } from './types';

export function narrateurPraxActif(appSettings: AppSettings | null | undefined): boolean {
  return appSettings?.narrateurPrax === true;
}

function resultat(story: StoryState): ResultatTour {
  const diagnosticTour = [...story.messages].reverse().find((m) => m.role === 'assistant')?.diagnosticTour;
  return { story, aEteCorrige: false, debugLore: { metamoteurs: [], loreElyndor: [], souvenirs: [], diagnosticTour } };
}

/** Niveau d'intimité permis : profil de contenu de l'appareil, puis curseur romance de l'histoire. */
function intimeDe(story: StoryState, appSettings: AppSettings | null | undefined) {
  return niveauIntime(appSettings?.profilContenu, story.settings?.romance);
}

/** Équivalent Prax de genererTour. */
export function genererTourPrax(story: StoryState, messageJoueur: string, appSettings?: AppSettings | null): ResultatTour {
  return resultat(jouerTourPrax(story, messageJoueur, { intime: intimeDe(story, appSettings) }).story);
}

/** Équivalent Prax de regenererDernierTour (ou de regenererOuverture pour une partie sans tour). */
export function regenererAvecPrax(story: StoryState, appSettings?: AppSettings | null): ResultatTour {
  const sansTour = story.messages.length <= 1 || !story.messages.some((m) => m.role === 'user');
  return resultat(sansTour ? ouvrirAvecPrax({ ...story, messages: [] }, { variante: story.messages.length + 1 }) : regenererTourPrax(story, { intime: intimeDe(story, appSettings) }).story);
}

/** Message d'ouverture seul (l'état Prax est rejoué au premier tour). */
export function messageOuverturePrax(story: StoryState): Message {
  return ouvrirAvecPrax(story).messages[0];
}
