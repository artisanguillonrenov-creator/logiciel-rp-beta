import type { ImageSourcePropType } from 'react-native';
import type { ScopeLore } from '../engine/loreScoring';
import type { TypeRole } from '../engine/rolesCanon';

// Contrat d'un paquet monde (chantier multi-mondes) : tout ce qui varie d'un
// monde à l'autre. Cinq champs obligatoires (id, carte, marque, synopsis,
// core, lorebook) ; races, départ et rôles canon sont des modules facultatifs.
// Les images sont des accesseurs (get image() { return require(...) }) :
// Metro les embarque, mais elles ne sont chargées qu'à la lecture, ce qui
// laisse le moteur utilisable sous Node (tests) sans charger de PNG.

/** Entrée de lorebook telle qu'écrite dans le fichier du monde (schéma d'elyndorLore.json). */
export interface EntreeLoreBrute {
  id: number;
  category: string;
  title: string;
  primary_keys?: string[];
  secondary_keys?: string[];
  negative_keys?: string[];
  content: string;
  priority: number;
  constant: boolean;
  scope?: ScopeLore;
}

export interface RaceMonde {
  id: string;
  nom: string;
  sousTitre: string;
  description: string;
}

/** Traits visibles d'une race pour le modèle image (anglais). */
export interface VisuelRace {
  traits: string;
  negatif?: string;
  /** Faux tant que le portrait prédéfini de la race ne correspond pas au canon visé. */
  referenceFiable: boolean;
  /** Description à rappeler au modèle image à la place de RaceMonde.description. */
  apparence?: string;
}

export interface ModuleRaces {
  liste: RaceMonde[];
  /** Portraits « <raceId>-<homme|femme|autre> ». */
  portraits?: Record<string, ImageSourcePropType>;
  /** Reconnaissance d'une race dans un texte normalisé, du motif le plus précis au plus général. */
  detection?: ReadonlyArray<{ race: string; motif: RegExp }>;
  visuels?: Record<string, VisuelRace>;
}

export interface LieuDepart {
  id: string;
  nom: string;
  description: string;
}

export interface SituationDepart {
  id: string;
  nom: string;
  description: string;
}

export interface ModuleDepart {
  /** « liste » : lieux et situations proposés ; « libre » : le joueur écrit son lieu et sa situation. */
  mode: 'liste' | 'libre';
  lieux?: LieuDepart[];
  situationsParLieu?: Record<string, SituationDepart[]>;
}

export interface FicheRoleCanon {
  /** Reconnaît le titre de la fiche « [RÉCURRENT] » qui liste ce rôle ville par ville. */
  motif: RegExp;
  role: TypeRole;
  libelle: string;
}

export interface ModuleRolesCanon {
  roles: FicheRoleCanon[];
  /** Lieux (villes) où les rôles sont fixés ; absents : déduits des fiches lues. */
  lieux?: string[];
}

export interface PaquetMonde {
  /** Identifiant stable : préfixe des entrées du lorebook (« <id>-<n> »). */
  id: string;
  carte: { nom: string; genre: string; description: string; tags: string[]; image: ImageSourcePropType };
  marque: { titre: string; logo?: ImageSourcePropType; fond?: ImageSourcePropType };
  /** Synopsis de l'accueil, un paragraphe par entrée. */
  synopsis: string[];
  /** Lore Core, 2 000 à 4 000 caractères, injecté à chaque tour. */
  core: string;
  lorebook: { entries: EntreeLoreBrute[] };
  /** Titre du bloc de lore du prompt ; défaut « LORE <NOM> PERTINENT ». */
  titreLore?: string;
  /** Consigne du scénario de départ ; défaut : consigne générique du moteur. */
  consigneScenario?: string;
  /** Nom du monde cité dans la consigne d'extraction du lore émergent ; absent : aucun nom. */
  nomPourExtractionLore?: string;
  /** Titres complets (« [CATÉGORIE] Titre ») des fiches réservées au profil Adulte. */
  entreesAdulteUniquement?: string[];
  modules?: {
    races?: ModuleRaces;
    depart?: ModuleDepart;
    rolesCanon?: ModuleRolesCanon;
  };
}
