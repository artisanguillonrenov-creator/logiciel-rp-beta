/**
 * Types du narrateur Prax (test) : Prax joue le rôle du narrateur dans une
 * conversation d'Elyndor, sans aucun appel à un modèle de langage.
 *
 * Deux sorties par tour :
 * - un COMPTE RENDU structuré (qui a fait quoi, qui l'a vu, ce qui a changé),
 *   pensé pour être repris plus tard par le modèle IA qui embellira le récit ;
 * - un RENDU brut en français, affiché tel quel pendant les essais.
 */
import type { RolePnj } from './sujets';

export const ID_JOUEUR = 'joueur';
export const LIEU_AILLEURS = 'ailleurs';

export interface PnjDescription {
  /** Identifiant Prax (minuscules ASCII, sans espace). */
  id: string;
  nom: string;
  role: RolePnj;
  /** « la réceptionniste de la Guilde des Aventuriers » ; absent pour un habitant. */
  libelleRole?: string;
  lieu: string;
  faction?: string;
  sujets: string[];
}

export interface LieuDescription {
  id: string;
  nom: string;
  /** Type de lieu reconnu par l'application (taverne, forge…), s'il y en a un. */
  type?: string;
}

/** Ce que Prax sait de la scène : distribution, lieux, sujets. Persisté avec la partie. */
export interface DescriptionScene {
  version: 1;
  ville: string;
  joueurNom: string;
  lieux: LieuDescription[];
  pnj: PnjDescription[];
}

/** État Prax persisté dans la partie (StoryState.prax). */
export interface EtatPraxHistoire {
  version: 1;
  description: DescriptionScene;
  /** Sauvegarde du moteur (core/persist) après le dernier tour. */
  etat: string;
  /** Lieu actuel du joueur. */
  lieuJoueur: string;
  /** Dernier PNJ qui s'est adressé au joueur (cible par défaut du message suivant). */
  dernierInterlocuteur?: string;
  /** Message assistant produit par le dernier tour Prax. */
  apresMessageId?: string;
  /** État avant ce dernier tour, pour le régénérer. */
  precedent?: Omit<EtatPraxHistoire, 'version' | 'precedent'>;
  tours: number;
}

export type GenreAction =
  | 'saluer' | 'rendreSalut' | 'accueillir' | 'converser' | 'repondreAimable' | 'rabrouer'
  | 'interroger' | 'repondre' | 'eluder' | 'ignorerSujet' | 'ignorer' | 'complimenter' | 'remercier'
  | 'menacer' | 'ceder' | 'tenirTete' | 'insulter' | 'rendreInsulte' | 'attaquer' | 'riposter'
  | 'implorer' | 'fuir' | 'voler' | 'accuser' | 'aider' | 'rendreService' | 'payer'
  | 's_excuser' | 'pardonner' | 'rassurer' | 'refuserExcuses' | 's_interposer' | 'se_mefier'
  | 'raconter' | 'se_rendre' | 'attendre';

export interface EvenementTour {
  acteur: string;
  acteurNom: string;
  /** Rôle du PNJ acteur (pour les répliques d'accueil). */
  roleActeur?: string;
  genre: GenreAction;
  /** Libellé Prax rendu avec les noms (« Margaux répond à toi au sujet de… »). */
  libelle: string;
  cible?: string;
  cibleNom?: string;
  /** Pour une interposition : la personne protégée. */
  victimeNom?: string;
  sujet?: string;
  sujetNom?: string;
  /** Pour un récit rapporté : de qui parle la rumeur, et quel acte. */
  rapporte?: { genre: GenreAction; auteurNom: string; victimeNom: string };
  lieu?: string;
  lieuNom?: string;
  temoins: string[];
}

export interface ChangementRelation {
  pnj: string;
  axe: 'confiance' | 'respect' | 'peur' | 'affection' | 'hostilite';
  avant: number;
  apres: number;
}

export interface CoulisseActeur {
  acteur: string;
  /** Les meilleures options pesées, notes du planificateur comprises. */
  options: Array<{ libelle: string; note: number }>;
  choix: string;
}

export interface CompteRenduTour {
  version: 1;
  tour: number;
  ville: string;
  lieu: string;
  presents: string[];
  joueur: {
    message: string;
    compris: boolean;
    action?: string;
    motif?: string;
  };
  evenements: EvenementTour[];
  relations: ChangementRelation[];
  coulisses: CoulisseActeur[];
}
