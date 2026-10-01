// Elyndor — Noyau narratif natif V2.1
// Contrat compact produit par le Kernel pour un tour de narration.
//
// Ce contrat est transitoire : il ne remplace ni l'état persistant de la
// partie, ni la mémoire, ni les propriétaires d'état M01 à M15. Il rassemble
// uniquement ce qui est utile au tour courant avant l'appel au modèle.

import type {
  BlocageNarratif,
  CadrageScene,
  ControleNarratif,
  IdMoteurNarratif,
  NatureEchange,
  NiveauRendu,
  ProfilRenduNarratif,
  PropositionTransition,
  ResolutionAction,
  SourceNarrative,
  StatutInformation,
} from './types';

export const VERSION_NARRATIVE_CONTRACT_V21 = '2.1' as const;

/** Fait déjà établi et réellement utile à la scène courante. */
export interface FaitContractuel {
  id: string;
  contenu: string;
  sources: SourceNarrative[];
  prioritaire?: boolean;
}

/** Information disponible pour un acteur sans lui donner un savoir d'auteur. */
export interface SavoirContractuel {
  acteurId: string;
  contenu: string;
  statut: StatutInformation;
  sourceIds: string[];
  confiance?: number;
}

/** Intention ou initiative d'un PNJ préparée par M03/M12, sans issue garantie. */
export interface IntentionPnjContractuelle {
  acteurId: string;
  intention: string;
  justification: string;
  cibleIds?: string[];
}

/** Décision que la narration doit impérativement laisser au joueur. */
export interface DecisionReserveeJoueur {
  description: string;
  raison?: string;
}

/** Limite réellement applicable au tour courant, sous une forme compacte. */
export interface LimiteContractuelle {
  theme: string;
  autorisee: boolean;
  portee: string;
  intensite?: NiveauRendu;
  signalActuel?: string;
}

/**
 * Vue de rendu issue des réglages existants de l'application.
 * M08 peut l'interpréter selon la scène, mais ne crée pas un second stockage.
 */
export interface RenduContractuel {
  profil: ProfilRenduNarratif;
  dimensionsActives: string[];
  dimensionsInactives: string[];
  directives: string[];
}

/** Ce que le modèle doit montrer sans réciter les mécanismes internes. */
export interface MiseEnSceneContractuelle {
  pointsAMontrer: string[];
  contraintes: string[];
  interditsNarratifs: string[];
  choixReservesAuJoueur: DecisionReserveeJoueur[];
  ouvertureSuivante?: string;
}

/** Clarification ciblée lorsqu'une incertitude empêche réellement la résolution. */
export interface ClarificationContractuelle {
  question: string;
  raison: string;
  suspendResolution: boolean;
}

/**
 * Sortie compacte du Narrative Behavior Kernel pour UN tour.
 *
 * Le Kernel conserve l'autorité : ce contrat décrit ce que le modèle peut
 * mettre en scène. Une proposition du modèle ne devient pas canonique par le
 * seul fait d'avoir été générée.
 */
export interface NarrativeContractV21 {
  version: typeof VERSION_NARRATIVE_CONTRACT_V21;
  histoireId: string;
  varianteId?: string;
  natureEchange: NatureEchange;
  initiativeJoueur: string;
  scene: CadrageScene;

  // Sélection et compression : seulement les éléments utiles au tour.
  faitsDecisifs: FaitContractuel[];
  savoirsSitues: SavoirContractuel[];
  intentionsPnj: IntentionPnjContractuelle[];
  contraintesApplicables: string[];

  // Résolution déjà déterminée par le noyau, lorsqu'une tentative l'exige.
  resolutions: ResolutionAction[];

  // Rendu et limites restent deux responsabilités distinctes.
  rendu: RenduContractuel;
  limites: LimiteContractuelle[];

  // Préparation de la réponse et mutations proposées, jamais canonisées ici.
  miseEnScene: MiseEnSceneContractuelle;
  transitionsProposees: PropositionTransition[];

  // Vérification du sens avant/après génération.
  controles: ControleNarratif[];
  blocage?: BlocageNarratif;
  clarification?: ClarificationContractuelle;

  // Diagnostic interne uniquement ; ne doit pas être récité au joueur.
  moteursContributeurs: IdMoteurNarratif[];
}

export interface BaseNarrativeContractV21 {
  histoireId: string;
  varianteId?: string;
  natureEchange: NatureEchange;
  initiativeJoueur: string;
  scene: CadrageScene;
  profilRendu: ProfilRenduNarratif;
}

/**
 * Fabrique un contrat vide mais valide structurellement.
 * Les moteurs le complèteront progressivement ; aucune donnée n'est inventée.
 */
export function creerNarrativeContractV21(base: BaseNarrativeContractV21): NarrativeContractV21 {
  return {
    version: VERSION_NARRATIVE_CONTRACT_V21,
    histoireId: base.histoireId,
    varianteId: base.varianteId,
    natureEchange: base.natureEchange,
    initiativeJoueur: base.initiativeJoueur,
    scene: base.scene,
    faitsDecisifs: [],
    savoirsSitues: [],
    intentionsPnj: [],
    contraintesApplicables: [],
    resolutions: [],
    rendu: {
      profil: base.profilRendu,
      dimensionsActives: [],
      dimensionsInactives: [],
      directives: [],
    },
    limites: [],
    miseEnScene: {
      pointsAMontrer: [],
      contraintes: [],
      interditsNarratifs: [],
      choixReservesAuJoueur: [],
    },
    transitionsProposees: [],
    controles: [],
    moteursContributeurs: [],
  };
}
