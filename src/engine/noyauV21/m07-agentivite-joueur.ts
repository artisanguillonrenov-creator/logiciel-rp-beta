// Elyndor — Noyau narratif natif V2.1
// M07 — Agentivité du joueur.
//
// M07 protège ce que le personnage joueur décide, dit, ressent explicitement
// ou délègue. Il distingue l'intention de son résultat : M06 décrit les
// possibilités matérielles, M03 l'autonomie des PNJ et M14 tranche les issues
// contestées. M07 ne transforme donc jamais une formulation de succès en
// réussite acquise.

import type { ContributionSceneM01 } from './m01-production';
import type { DecisionReserveeJoueur } from './narrativeContract';
import type {
  BlocageNarratif,
  ContexteNarratifV21,
  ControleNarratif,
  DelegationNarrative,
  PropositionTransition,
  ResultatMoteur,
  SourceNarrative,
  TentativeAction,
} from './types';

export const MOTEUR_M07 = 'M07' as const;

export type TypeInitiativeM07 =
  | 'parole'
  | 'question'
  | 'proposition'
  | 'action_ordinaire'
  | 'tentative'
  | 'etat_intime'
  | 'demande_pnj'
  | 'delegation'
  | 'revocation_delegation'
  | 'autre';

export type FaisabiliteMaterielleM07 =
  | 'possible'
  | 'impossible'
  | 'a_clarifier'
  | 'inconnue';

export type OppositionM07 = 'aucune' | 'presente' | 'inconnue';

export type TraitementInitiativeM07 =
  | 'narrable_directement'
  | 'attend_reponse_monde'
  | 'a_resoudre_m14'
  | 'impossible_selon_m06'
  | 'a_clarifier'
  | 'etat_joueur_etabli';

export type StatutDelegationM07 =
  | 'active'
  | 'en_attente_acceptation'
  | 'refusee'
  | 'invalide';

export interface EtapeActionM07 {
  id: string;
  description: string;

  /** Étape effectivement donnée par le joueur. */
  explicite: boolean;

  /** Geste mécanique indispensable à l'action explicite, sans choix nouveau. */
  gesteOrdinaireImplicite?: boolean;

  faisabiliteMaterielle?: FaisabiliteMaterielleM07;
  opposition?: OppositionM07;

  /** Une nouvelle décision significative du joueur serait nécessaire après cette étape. */
  decisionSupplementaireRequise?: boolean;

  sourceIds?: string[];
}

export interface InitiativeJoueurM07 {
  id: string;
  type: TypeInitiativeM07;
  description: string;
  auteurId?: string;
  cibleIds?: string[];
  sourceIds?: string[];

  /** Formulation exacte à préserver lorsqu'elle importe, notamment pour la parole. */
  formulationExacte?: string;

  /** État intime uniquement lorsqu'il est explicitement donné par le joueur. */
  etatIntimeDeclare?: string;

  /** Informations que le personnage joueur possède déjà pour cette initiative. */
  connaissanceAccessible?: string[];

  /** Moyens explicitement engagés dans la tentative. */
  moyens?: string[];
  preparation?: string[];

  faisabiliteMaterielle?: FaisabiliteMaterielleM07;
  opposition?: OppositionM07;

  /**
   * Le texte peut être formulé comme si l'issue était déjà obtenue. M07 conserve
   * l'intention mais n'accorde pas le résultat lorsque M14 est requis.
   */
  resultatFormuleCommeAcquis?: boolean;

  /** Action banale, possible et sans opposition significative déjà établie. */
  ordinaireSansChoixNouveau?: boolean;

  etapes?: EtapeActionM07[];

  /** Choix que le joueur a explicitement laissé ouverts. */
  choixEncoreOuverts?: string[];
}

export interface IntentionInterpreteeM07 {
  initiativeId: string;
  auteurId: string;
  type: TypeInitiativeM07;
  intention: string;
  cibleIds: string[];
  formulationExacte?: string;
  etatIntimeDeclare?: string;
  sourceIds: string[];
  explicitementDonnee: boolean;
  neVautPasResultat: boolean;
}

export interface FrontiereResolutionM07 {
  initiativeId: string;
  traitement: TraitementInitiativeM07;
  raison: string;
  etapesNarrables: string[];
  etapesReservees: string[];
  prochainChoixReserveAuJoueur?: string;
  requiertM14: boolean;
  requiertReponsePnj: boolean;
}

export interface DemandeDelegationM07 {
  id: string;
  auteurId: string;
  beneficiaireId: string;
  tache: string;
  perimetre: string;
  margeInitiative?: string;
  duree?: string;
  conditionsArret?: string[];
  sourceIds: string[];

  /**
   * M03 reste propriétaire de l'acceptation du PNJ. M07 ne rend la délégation
   * active que lorsque cette acceptation est déjà établie.
   */
  acceptationBeneficiaire?: 'acceptee' | 'refusee' | 'inconnue';
}

export interface EvaluationDelegationM07 {
  demandeId: string;
  auteurId: string;
  beneficiaireId: string;
  statut: StatutDelegationM07;
  raisons: string[];
  blocages: string[];
}

export interface DelegationProposeeM07 {
  demandeId: string;
  delegation: DelegationNarrative;
  statut: StatutDelegationM07;
  justification: string;
  sourceIds: string[];
}

export interface DemandeRevocationDelegationM07 {
  id: string;
  delegationId: string;
  auteurId: string;
  justification: string;
  sourceIds: string[];
}

export interface EvaluationRevocationM07 {
  demandeId: string;
  delegationId: string;
  applicable: boolean;
  raisons: string[];
  blocages: string[];
}

export interface RevocationDelegationM07 {
  demandeId: string;
  avant: DelegationNarrative;
  apres: DelegationNarrative;
  justification: string;
  sourceIds: string[];
}

export interface ChoixOuvertM07 {
  id: string;
  description: string;
  raison: string;
  sourceIds: string[];
}

export interface ConventionNarrationM07 {
  /** Autorise les gestes mécaniques nécessaires à une action ordinaire explicite. */
  gestesOrdinairesImplicites?: boolean;

  /** Si faux ou absent, M07 n'impose jamais une liste artificielle d'options. */
  listesDeChoixSystematiques?: boolean;
}

export interface EntreeM07 {
  contexte: ContexteNarratifV21;
  personnageJoueurId?: string;
  initiatives?: InitiativeJoueurM07[];
  delegationsDemandees?: DemandeDelegationM07[];
  revocationsDelegation?: DemandeRevocationDelegationM07[];
  conventions?: ConventionNarrationM07;
}

export interface SortieM07 {
  moteur: typeof MOTEUR_M07;
  resultat: ResultatMoteur<ContributionSceneM01>;
  intentions: IntentionInterpreteeM07[];
  frontieresResolution: FrontiereResolutionM07[];
  tentativesAResoudre: TentativeAction[];
  evaluationsDelegations: EvaluationDelegationM07[];
  delegationsProposees: DelegationProposeeM07[];
  evaluationsRevocations: EvaluationRevocationM07[];
  revocations: RevocationDelegationM07[];
  choixOuverts: ChoixOuvertM07[];
  alertes: string[];
}

function propre(valeur: unknown): string {
  return String(valeur ?? '').trim();
}

function normaliser(valeur: unknown): string {
  return propre(valeur)
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniquesTextes(valeurs: Iterable<string>): string[] {
  const resultat: string[] = [];
  const vus = new Set<string>();

  for (const valeur of valeurs) {
    const texte = propre(valeur);
    const cle = normaliser(texte);
    if (!cle || vus.has(cle)) continue;
    vus.add(cle);
    resultat.push(texte);
  }

  return resultat;
}

function uniquesParCle<T>(valeurs: Iterable<T>, cle: (valeur: T) => string): T[] {
  const resultat: T[] = [];
  const vus = new Set<string>();

  for (const valeur of valeurs) {
    const id = cle(valeur);
    if (!id || vus.has(id)) continue;
    vus.add(id);
    resultat.push(valeur);
  }

  return resultat;
}

function sourceMessageJoueur(entree: EntreeM07): SourceNarrative {
  return {
    id: `m07-message-${normaliser(entree.contexte.cadre.histoireId) || 'histoire'}`,
    type: 'message_joueur',
    description: entree.contexte.cadre.initiativeJoueur,
    tempsFictif: entree.contexte.scene.momentFictif,
  };
}

function sourcesInitiative(
  entree: EntreeM07,
  initiative: InitiativeJoueurM07,
): string[] {
  const sourceParDefaut = sourceMessageJoueur(entree).id;
  return uniquesTextes([...(initiative.sourceIds ?? []), sourceParDefaut]);
}

function initiativeParDefaut(entree: EntreeM07): InitiativeJoueurM07[] {
  const texte = propre(entree.contexte.cadre.initiativeJoueur);
  if (!texte) return [];

  const type: TypeInitiativeM07 = texte.endsWith('?') ? 'question' : 'autre';

  return [
    {
      id: `initiative-${normaliser(entree.contexte.cadre.histoireId) || 'joueur'}`,
      type,
      description: texte,
      auteurId: entree.personnageJoueurId,
      formulationExacte: texte,
      sourceIds: [sourceMessageJoueur(entree).id],
    },
  ];
}

function acteurJoueur(
  entree: EntreeM07,
  initiative: InitiativeJoueurM07,
): string {
  return propre(initiative.auteurId) || propre(entree.personnageJoueurId);
}

function interpreterIntention(
  entree: EntreeM07,
  initiative: InitiativeJoueurM07,
): IntentionInterpreteeM07 | undefined {
  const auteurId = acteurJoueur(entree, initiative);
  if (!auteurId) return undefined;

  const type = initiative.type;
  const neVautPasResultat =
    type === 'proposition' ||
    type === 'tentative' ||
    type === 'demande_pnj' ||
    type === 'delegation' ||
    Boolean(initiative.resultatFormuleCommeAcquis);

  return {
    initiativeId: initiative.id,
    auteurId,
    type,
    intention: propre(initiative.description),
    cibleIds: uniquesTextes(initiative.cibleIds ?? []),
    formulationExacte: propre(initiative.formulationExacte) || undefined,
    etatIntimeDeclare:
      type === 'etat_intime' && propre(initiative.etatIntimeDeclare)
        ? propre(initiative.etatIntimeDeclare)
        : undefined,
    sourceIds: sourcesInitiative(entree, initiative),
    explicitementDonnee: true,
    neVautPasResultat,
  };
}

function etapesNarrables(
  initiative: InitiativeJoueurM07,
  conventions: ConventionNarrationM07 | undefined,
): { narrables: string[]; reservees: string[]; prochainChoix?: string } {
  const etapes = initiative.etapes ?? [];
  if (etapes.length === 0) {
    if (
      initiative.type === 'action_ordinaire' &&
      initiative.ordinaireSansChoixNouveau &&
      initiative.faisabiliteMaterielle === 'possible' &&
      initiative.opposition === 'aucune'
    ) {
      return { narrables: [initiative.description], reservees: [] };
    }

    return { narrables: [], reservees: [] };
  }

  const narrables: string[] = [];
  const reservees: string[] = [];
  let prochainChoix: string | undefined;
  let bloque = false;

  for (const etape of etapes) {
    const description = propre(etape.description);
    if (!description) continue;

    if (bloque) {
      reservees.push(description);
      continue;
    }

    if (etape.decisionSupplementaireRequise) {
      reservees.push(description);
      prochainChoix = description;
      bloque = true;
      continue;
    }

    if (etape.faisabiliteMaterielle === 'impossible') {
      reservees.push(description);
      bloque = true;
      continue;
    }

    if (
      etape.faisabiliteMaterielle === 'a_clarifier' ||
      etape.faisabiliteMaterielle === 'inconnue'
    ) {
      reservees.push(description);
      bloque = true;
      continue;
    }

    if (etape.opposition === 'presente' || etape.opposition === 'inconnue') {
      reservees.push(description);
      bloque = true;
      continue;
    }

    if (etape.explicite) {
      narrables.push(description);
      continue;
    }

    if (
      etape.gesteOrdinaireImplicite &&
      conventions?.gestesOrdinairesImplicites !== false
    ) {
      narrables.push(description);
      continue;
    }

    reservees.push(description);
    prochainChoix = description;
    bloque = true;
  }

  return {
    narrables: uniquesTextes(narrables),
    reservees: uniquesTextes(reservees),
    prochainChoix,
  };
}

function frontierePourInitiative(
  initiative: InitiativeJoueurM07,
  conventions: ConventionNarrationM07 | undefined,
): FrontiereResolutionM07 {
  const etapes = etapesNarrables(initiative, conventions);
  const faisabilite = initiative.faisabiliteMaterielle ?? 'inconnue';
  const opposition = initiative.opposition ?? 'inconnue';

  if (initiative.type === 'etat_intime') {
    return {
      initiativeId: initiative.id,
      traitement: 'etat_joueur_etabli',
      raison:
        'L’état intime est explicitement donné par le joueur ; il peut être repris sans en inventer un autre.',
      etapesNarrables: [],
      etapesReservees: [],
      requiertM14: false,
      requiertReponsePnj: false,
    };
  }

  if (initiative.type === 'parole' || initiative.type === 'question') {
    return {
      initiativeId: initiative.id,
      traitement: 'attend_reponse_monde',
      raison:
        'La parole ou la question du joueur est acquise ; la réponse et sa vérité appartiennent aux acteurs et au monde.',
      etapesNarrables: [],
      etapesReservees: [],
      requiertM14: false,
      requiertReponsePnj: true,
    };
  }

  if (initiative.type === 'proposition' || initiative.type === 'demande_pnj') {
    return {
      initiativeId: initiative.id,
      traitement: 'attend_reponse_monde',
      raison:
        'La demande ou proposition est bien formulée, mais son acceptation par un PNJ n’est pas acquise.',
      etapesNarrables: [],
      etapesReservees: [],
      requiertM14: false,
      requiertReponsePnj: true,
    };
  }

  if (initiative.type === 'delegation' || initiative.type === 'revocation_delegation') {
    return {
      initiativeId: initiative.id,
      traitement: 'attend_reponse_monde',
      raison:
        'M07 borne la délégation ou sa révocation ; l’acceptation et l’exécution éventuelle restent distinctes.',
      etapesNarrables: [],
      etapesReservees: [],
      requiertM14: false,
      requiertReponsePnj: initiative.type === 'delegation',
    };
  }

  if (faisabilite === 'impossible') {
    return {
      initiativeId: initiative.id,
      traitement: 'impossible_selon_m06',
      raison:
        'L’intention est conservée, mais la faisabilité matérielle établie ne permet pas de la raconter comme accomplie.',
      etapesNarrables: etapes.narrables,
      etapesReservees: uniquesTextes([
        ...etapes.reservees,
        initiative.description,
      ]),
      prochainChoixReserveAuJoueur:
        etapes.prochainChoix ?? initiative.description,
      requiertM14: false,
      requiertReponsePnj: false,
    };
  }

  if (faisabilite === 'a_clarifier') {
    return {
      initiativeId: initiative.id,
      traitement: 'a_clarifier',
      raison:
        'Une information matérielle déterminante manque avant de savoir jusqu’où l’action peut être exécutée.',
      etapesNarrables: etapes.narrables,
      etapesReservees: uniquesTextes([
        ...etapes.reservees,
        initiative.description,
      ]),
      prochainChoixReserveAuJoueur:
        etapes.prochainChoix ?? initiative.description,
      requiertM14: false,
      requiertReponsePnj: false,
    };
  }

  if (
    initiative.type === 'action_ordinaire' &&
    initiative.ordinaireSansChoixNouveau &&
    faisabilite === 'possible' &&
    opposition === 'aucune'
  ) {
    return {
      initiativeId: initiative.id,
      traitement: 'narrable_directement',
      raison:
        'Action ordinaire explicitement donnée, matériellement possible et sans opposition significative établie.',
      etapesNarrables:
        etapes.narrables.length > 0 ? etapes.narrables : [initiative.description],
      etapesReservees: etapes.reservees,
      prochainChoixReserveAuJoueur: etapes.prochainChoix,
      requiertM14: false,
      requiertReponsePnj: false,
    };
  }

  if (
    initiative.type === 'tentative' ||
    opposition === 'presente' ||
    Boolean(initiative.resultatFormuleCommeAcquis)
  ) {
    return {
      initiativeId: initiative.id,
      traitement: 'a_resoudre_m14',
      raison:
        initiative.resultatFormuleCommeAcquis
          ? 'La formulation contient un résultat revendiqué ; M07 conserve l’intention et laisse M14 établir l’issue.'
          : 'Une opposition ou une tentative significative exige une résolution distincte de l’intention du joueur.',
      etapesNarrables: etapes.narrables,
      etapesReservees: uniquesTextes([
        ...etapes.reservees,
        initiative.description,
      ]),
      prochainChoixReserveAuJoueur: etapes.prochainChoix,
      requiertM14: true,
      requiertReponsePnj: false,
    };
  }

  if (
    initiative.type === 'action_ordinaire' &&
    (faisabilite === 'inconnue' || opposition === 'inconnue')
  ) {
    return {
      initiativeId: initiative.id,
      traitement: 'a_clarifier',
      raison:
        'M07 ne transforme pas une action supposée banale en accomplissement lorsque sa faisabilité ou son opposition est déterminante et inconnue.',
      etapesNarrables: etapes.narrables,
      etapesReservees: uniquesTextes([
        ...etapes.reservees,
        initiative.description,
      ]),
      prochainChoixReserveAuJoueur:
        etapes.prochainChoix ?? initiative.description,
      requiertM14: false,
      requiertReponsePnj: false,
    };
  }

  return {
    initiativeId: initiative.id,
    traitement: 'attend_reponse_monde',
    raison:
      'L’initiative est conservée telle qu’elle est donnée ; M07 n’ajoute ni succès, ni décision, ni émotion supplémentaire.',
    etapesNarrables: etapes.narrables,
    etapesReservees: etapes.reservees,
    prochainChoixReserveAuJoueur: etapes.prochainChoix,
    requiertM14: false,
    requiertReponsePnj: false,
  };
}

function tentativeDepuisInitiative(
  entree: EntreeM07,
  initiative: InitiativeJoueurM07,
  frontiere: FrontiereResolutionM07,
): TentativeAction | undefined {
  if (!frontiere.requiertM14) return undefined;

  const auteurId = acteurJoueur(entree, initiative);
  if (!auteurId) return undefined;

  return {
    id: initiative.id,
    auteurId,
    description: initiative.description,
    cibles: uniquesTextes(initiative.cibleIds ?? []),
    moyens: uniquesTextes(initiative.moyens ?? []),
    opposition:
      initiative.opposition === 'presente'
        ? ['Opposition établie pour cette tentative.']
        : [],
    preparation: uniquesTextes(initiative.preparation ?? []),
    connaissanceAccessible: uniquesTextes(
      initiative.connaissanceAccessible ?? [],
    ),
  };
}

function validerDelegation(
  entree: EntreeM07,
  demande: DemandeDelegationM07,
): EvaluationDelegationM07 {
  const raisons: string[] = [];
  const blocages: string[] = [];

  if (!propre(demande.auteurId)) {
    blocages.push('Auteur de la délégation absent.');
  }

  if (
    entree.personnageJoueurId &&
    demande.auteurId !== entree.personnageJoueurId
  ) {
    blocages.push(
      'M07 ne peut pas attribuer au joueur une délégation émise par un autre acteur.',
    );
  }

  if (!propre(demande.beneficiaireId)) {
    blocages.push('Bénéficiaire de la délégation absent.');
  }

  if (!propre(demande.tache)) {
    blocages.push('Tâche déléguée absente.');
  }

  if (!propre(demande.perimetre)) {
    blocages.push('Périmètre de la délégation absent.');
  }

  if ((demande.sourceIds ?? []).length === 0) {
    blocages.push('La délégation ne possède aucune source explicite.');
  }

  if (blocages.length > 0) {
    return {
      demandeId: demande.id,
      auteurId: demande.auteurId,
      beneficiaireId: demande.beneficiaireId,
      statut: 'invalide',
      raisons,
      blocages,
    };
  }

  raisons.push(
    `Le joueur délègue uniquement « ${demande.tache} » dans le périmètre « ${demande.perimetre} ».`,
  );

  if (demande.acceptationBeneficiaire === 'refusee') {
    raisons.push('Le bénéficiaire a refusé la délégation.');
    return {
      demandeId: demande.id,
      auteurId: demande.auteurId,
      beneficiaireId: demande.beneficiaireId,
      statut: 'refusee',
      raisons,
      blocages,
    };
  }

  if (demande.acceptationBeneficiaire !== 'acceptee') {
    raisons.push(
      'L’acceptation du bénéficiaire n’est pas établie ; M03 reste propriétaire de cette décision.',
    );
    return {
      demandeId: demande.id,
      auteurId: demande.auteurId,
      beneficiaireId: demande.beneficiaireId,
      statut: 'en_attente_acceptation',
      raisons,
      blocages,
    };
  }

  raisons.push('L’acceptation du bénéficiaire est déjà établie.');
  return {
    demandeId: demande.id,
    auteurId: demande.auteurId,
    beneficiaireId: demande.beneficiaireId,
    statut: 'active',
    raisons,
    blocages,
  };
}

function construireDelegation(
  demande: DemandeDelegationM07,
  evaluation: EvaluationDelegationM07,
): DelegationProposeeM07 | undefined {
  if (evaluation.statut === 'invalide' || evaluation.statut === 'refusee') {
    return undefined;
  }

  const delegation: DelegationNarrative = {
    id: `delegation-${normaliser(demande.id) || demande.id}`,
    auteurId: demande.auteurId,
    beneficiaireId: demande.beneficiaireId,
    tache: demande.tache,
    perimetre: demande.perimetre,
    margeInitiative: propre(demande.margeInitiative) || undefined,
    duree: propre(demande.duree) || undefined,
    conditionsArret: uniquesTextes(demande.conditionsArret ?? []),
    revoquee: false,
  };

  return {
    demandeId: demande.id,
    delegation,
    statut: evaluation.statut,
    justification:
      evaluation.statut === 'active'
        ? 'Délégation explicitement bornée par le joueur et acceptée par le bénéficiaire.'
        : 'Autorisation du joueur définie, mais activation suspendue jusqu’à l’acceptation du bénéficiaire.',
    sourceIds: uniquesTextes(demande.sourceIds),
  };
}

function transitionDelegation(
  proposition: DelegationProposeeM07,
): PropositionTransition<DelegationNarrative> | undefined {
  if (proposition.statut !== 'active') return undefined;

  return {
    id: `m07-${proposition.delegation.id}-active`,
    moteurProprietaire: MOTEUR_M07,
    domaine: 'delegation',
    cibleIds: [
      proposition.delegation.auteurId,
      proposition.delegation.beneficiaireId,
    ],
    justification: proposition.justification,
    sourceIds: proposition.sourceIds,
    valeurProposee: proposition.delegation,
    perceptible: true,
    transmissible: false,
  };
}

function evaluerRevocation(
  entree: EntreeM07,
  demande: DemandeRevocationDelegationM07,
): EvaluationRevocationM07 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  const delegation = entree.contexte.delegations.find(
    (candidate) => candidate.id === demande.delegationId,
  );

  if (!delegation) {
    blocages.push('Délégation introuvable dans l’état applicable.');
  } else {
    if (delegation.revoquee) {
      blocages.push('La délégation est déjà révoquée.');
    }
    if (delegation.auteurId !== demande.auteurId) {
      blocages.push(
        'Seul l’auteur de cette délégation peut en retirer l’autorité au nom de M07.',
      );
    }
  }

  if (
    entree.personnageJoueurId &&
    demande.auteurId !== entree.personnageJoueurId
  ) {
    blocages.push(
      'La demande de révocation ne correspond pas au personnage joueur courant.',
    );
  }

  if ((demande.sourceIds ?? []).length === 0) {
    blocages.push('La révocation ne possède aucune source explicite.');
  }

  if (blocages.length === 0) {
    raisons.push('Révocation explicitement demandée par l’auteur de la délégation.');
  }

  return {
    demandeId: demande.id,
    delegationId: demande.delegationId,
    applicable: blocages.length === 0,
    raisons,
    blocages,
  };
}

function construireRevocation(
  entree: EntreeM07,
  demande: DemandeRevocationDelegationM07,
  evaluation: EvaluationRevocationM07,
): RevocationDelegationM07 | undefined {
  if (!evaluation.applicable) return undefined;

  const avant = entree.contexte.delegations.find(
    (candidate) => candidate.id === demande.delegationId,
  );
  if (!avant) return undefined;

  return {
    demandeId: demande.id,
    avant,
    apres: {
      ...avant,
      revoquee: true,
    },
    justification: demande.justification,
    sourceIds: uniquesTextes(demande.sourceIds),
  };
}

function transitionRevocation(
  revocation: RevocationDelegationM07,
): PropositionTransition<DelegationNarrative> {
  return {
    id: `m07-${revocation.apres.id}-revoquee`,
    moteurProprietaire: MOTEUR_M07,
    domaine: 'delegation',
    cibleIds: [revocation.apres.auteurId, revocation.apres.beneficiaireId],
    justification:
      propre(revocation.justification) || 'Révocation explicite de la délégation.',
    sourceIds: revocation.sourceIds,
    valeurProposee: revocation.apres,
    perceptible: true,
    transmissible: false,
  };
}

function choixDepuisInitiatives(
  entree: EntreeM07,
  initiatives: InitiativeJoueurM07[],
  frontieres: FrontiereResolutionM07[],
): ChoixOuvertM07[] {
  const resultat: ChoixOuvertM07[] = [];

  if (propre(entree.contexte.cadre.decisionPendante)) {
    resultat.push({
      id: 'decision-pendante-cadre',
      description: propre(entree.contexte.cadre.decisionPendante),
      raison: 'Décision déjà réservée au joueur dans le cadre de l’échange.',
      sourceIds: [sourceMessageJoueur(entree).id],
    });
  }

  for (const initiative of initiatives) {
    for (const choix of initiative.choixEncoreOuverts ?? []) {
      resultat.push({
        id: `choix-${normaliser(initiative.id)}-${normaliser(choix)}`,
        description: choix,
        raison: 'Choix explicitement laissé ouvert par l’initiative du joueur.',
        sourceIds: sourcesInitiative(entree, initiative),
      });
    }

    const frontiere = frontieres.find(
      (candidate) => candidate.initiativeId === initiative.id,
    );
    if (!frontiere?.prochainChoixReserveAuJoueur) continue;

    resultat.push({
      id: `choix-frontiere-${normaliser(initiative.id)}`,
      description: frontiere.prochainChoixReserveAuJoueur,
      raison:
        'Une opposition, une incertitude ou une nouvelle décision significative impose de s’arrêter avant d’inventer la suite du joueur.',
      sourceIds: sourcesInitiative(entree, initiative),
    });
  }

  return uniquesParCle(resultat, (choix) => normaliser(choix.description));
}

function controlesM07(
  entree: EntreeM07,
  initiatives: InitiativeJoueurM07[],
  frontieres: FrontiereResolutionM07[],
  delegations: DelegationProposeeM07[],
  revocations: RevocationDelegationM07[],
): ControleNarratif[] {
  const succesContestesAccordes = initiatives.some((initiative) => {
    if (!initiative.resultatFormuleCommeAcquis) return false;
    const frontiere = frontieres.find(
      (candidate) => candidate.initiativeId === initiative.id,
    );
    return frontiere?.traitement === 'narrable_directement';
  });

  const delegationHorsPerimetre = delegations.some(
    (proposition) =>
      !propre(proposition.delegation.tache) ||
      !propre(proposition.delegation.perimetre),
  );

  const revocationIllegitime = revocations.some(
    (revocation) => revocation.avant.auteurId !== revocation.apres.auteurId,
  );

  const auteurIncoherent = initiatives.some((initiative) => {
    if (!entree.personnageJoueurId || !initiative.auteurId) return false;
    return initiative.auteurId !== entree.personnageJoueurId;
  });

  return [
    {
      id: 'agentivite',
      ok:
        !succesContestesAccordes &&
        !delegationHorsPerimetre &&
        !revocationIllegitime &&
        !auteurIncoherent,
      raison:
        succesContestesAccordes ||
        delegationHorsPerimetre ||
        revocationIllegitime ||
        auteurIncoherent
          ? 'Une proposition risque d’attribuer au joueur un résultat, une décision ou une autorité qu’il n’a pas effectivement donnée.'
          : 'Les décisions, paroles, états intimes explicites et délégations du joueur restent bornés à ce qu’il a effectivement donné.',
    },
    {
      id: 'causalite',
      ok: !succesContestesAccordes,
      raison: succesContestesAccordes
        ? 'Un résultat contesté a été traité comme une action ordinaire.'
        : 'M07 sépare l’intention du résultat et remet les tentatives contestées à M14.',
    },
    {
      id: 'fidelite_recit',
      ok: true,
      raison:
        'Une action ordinaire peut être racontée lorsqu’elle est explicitement donnée, possible et sans opposition, sans ajouter de nouvelle décision.',
    },
  ];
}

function decisionReserveeDepuisChoix(choix: ChoixOuvertM07): DecisionReserveeJoueur {
  return {
    description: choix.description,
    raison: choix.raison,
  };
}

function pointsAMontrer(
  initiatives: InitiativeJoueurM07[],
  frontieres: FrontiereResolutionM07[],
  delegations: DelegationProposeeM07[],
): string[] {
  const points: string[] = [];

  for (const initiative of initiatives) {
    const frontiere = frontieres.find(
      (candidate) => candidate.initiativeId === initiative.id,
    );
    if (!frontiere) continue;

    if (initiative.type === 'question') {
      points.push(`Répondre à la question du joueur : ${initiative.description}`);
    } else if (initiative.type === 'proposition') {
      points.push(
        `Mettre en scène la proposition sans présumer son acceptation : ${initiative.description}`,
      );
    } else if (initiative.type === 'etat_intime' && initiative.etatIntimeDeclare) {
      points.push(
        `L’état intime explicitement déclaré par le joueur peut être repris : ${initiative.etatIntimeDeclare}`,
      );
    }

    for (const etape of frontiere.etapesNarrables) {
      points.push(`Action du joueur narrable sans choix nouveau : ${etape}`);
    }
  }

  for (const delegation of delegations) {
    if (delegation.statut === 'en_attente_acceptation') {
      points.push(
        `La délégation « ${delegation.delegation.tache} » est proposée à ${delegation.delegation.beneficiaireId} ; sa réponse reste libre.`,
      );
    }
  }

  return uniquesTextes(points);
}

function contributionM01(
  initiatives: InitiativeJoueurM07[],
  frontieres: FrontiereResolutionM07[],
  choixOuverts: ChoixOuvertM07[],
  delegations: DelegationProposeeM07[],
  controles: ControleNarratif[],
): ContributionSceneM01 {
  return {
    contraintes: [
      'Conserver exactement la décision donnée par le joueur sans lui ajouter parole, intention, émotion intime, achat, déplacement ou engagement non demandé.',
      'Une formulation de succès ne vaut pas réussite lorsque l’action rencontre une opposition ou exige une résolution M14.',
      'Les réactions des PNJ et du monde restent libres dans leurs domaines : agentivité du joueur ne signifie pas succès garanti.',
      'Une action ordinaire explicitement donnée peut être racontée comme accomplie seulement si elle est matériellement possible, sans opposition significative et sans choix nouveau.',
      'Lorsqu’une nouvelle opposition impose une décision significative, arrêter la progression avant d’inventer la suite du joueur.',
      'Une délégation n’accorde que la tâche, le périmètre, la marge, la durée et les conditions d’arrêt explicitement établis.',
      'Un PNJ délégué peut réellement réussir une tâche dans son domaine ; M07 ne crée pas une règle d’échec destinée à préserver artificiellement la difficulté.',
    ],
    pointsAMontrer: pointsAMontrer(initiatives, frontieres, delegations),
    interditsNarratifs: [
      'Ne pas signer, acheter, accepter, partir, promettre, pardonner ou s’engager à la place du joueur.',
      'Ne pas inventer peur, attirance, colère, approbation ou autre état intime du joueur lorsqu’il ne l’a pas donné.',
      'Ne pas transformer une proposition du joueur en acceptation automatique du PNJ.',
      'Ne pas traiter une tentative formulée comme succès comme une réussite acquise avant M14.',
      'Ne pas étendre une délégation d’inspection à une autorisation d’ouvrir, de signer, de dépenser ou de choisir une alliance.',
      'Ne pas imposer systématiquement une liste d’options ni terminer mécaniquement par « Que fais-tu ? ».',
      'Ne pas utiliser M07 pour modifier l’état d’un fil narratif ; cette responsabilité appartient à M11.',
    ],
    choixReservesAuJoueur: choixOuverts.map(decisionReserveeDepuisChoix),
    controles,
  };
}

function blocagePrincipal(
  initiatives: InitiativeJoueurM07[],
  frontieres: FrontiereResolutionM07[],
): BlocageNarratif | undefined {
  for (const initiative of initiatives) {
    const frontiere = frontieres.find(
      (candidate) => candidate.initiativeId === initiative.id,
    );
    if (!frontiere) continue;

    if (frontiere.traitement === 'impossible_selon_m06') {
      return {
        type: 'impossibilite',
        raison: frontiere.raison,
        questionClarification:
          'Cette action n’est pas matériellement possible dans les conditions établies. Veux-tu modifier l’action ?',
      };
    }

    if (frontiere.traitement === 'a_clarifier') {
      return {
        type: 'information_manquante',
        raison: frontiere.raison,
        questionClarification:
          'Une information déterminante manque pour poursuivre cette action sans inventer ton choix. Veux-tu préciser ce point ?',
      };
    }
  }

  return undefined;
}

export function executerM07(entree: EntreeM07): SortieM07 {
  const initiatives =
    entree.initiatives && entree.initiatives.length > 0
      ? entree.initiatives
      : initiativeParDefaut(entree);

  const alertes: string[] = [];

  const intentions = initiatives
    .map((initiative) => {
      const intention = interpreterIntention(entree, initiative);
      if (!intention) {
        alertes.push(
          `Initiative ${initiative.id} ignorée : auteur joueur impossible à identifier.`,
        );
      }
      return intention;
    })
    .filter((intention): intention is IntentionInterpreteeM07 => Boolean(intention));

  const frontieresResolution = initiatives.map((initiative) =>
    frontierePourInitiative(initiative, entree.conventions),
  );

  const tentativesAResoudre = initiatives
    .map((initiative) => {
      const frontiere = frontieresResolution.find(
        (candidate) => candidate.initiativeId === initiative.id,
      );
      if (!frontiere) return undefined;
      return tentativeDepuisInitiative(entree, initiative, frontiere);
    })
    .filter((tentative): tentative is TentativeAction => Boolean(tentative));

  const demandesDelegation = entree.delegationsDemandees ?? [];
  const evaluationsDelegations = demandesDelegation.map((demande) =>
    validerDelegation(entree, demande),
  );

  for (const evaluation of evaluationsDelegations) {
    alertes.push(
      ...evaluation.blocages.map(
        (blocage) => `Délégation ${evaluation.demandeId} ignorée : ${blocage}`,
      ),
    );
  }

  const delegationsProposees = demandesDelegation
    .map((demande) => {
      const evaluation = evaluationsDelegations.find(
        (candidate) => candidate.demandeId === demande.id,
      );
      if (!evaluation) return undefined;
      return construireDelegation(demande, evaluation);
    })
    .filter(
      (delegation): delegation is DelegationProposeeM07 => Boolean(delegation),
    );

  const demandesRevocation = entree.revocationsDelegation ?? [];
  const evaluationsRevocations = demandesRevocation.map((demande) =>
    evaluerRevocation(entree, demande),
  );

  for (const evaluation of evaluationsRevocations) {
    alertes.push(
      ...evaluation.blocages.map(
        (blocage) => `Révocation ${evaluation.demandeId} ignorée : ${blocage}`,
      ),
    );
  }

  const revocations = demandesRevocation
    .map((demande) => {
      const evaluation = evaluationsRevocations.find(
        (candidate) => candidate.demandeId === demande.id,
      );
      if (!evaluation) return undefined;
      return construireRevocation(entree, demande, evaluation);
    })
    .filter(
      (revocation): revocation is RevocationDelegationM07 => Boolean(revocation),
    );

  const choixOuverts = choixDepuisInitiatives(
    entree,
    initiatives,
    frontieresResolution,
  );

  const controles = controlesM07(
    entree,
    initiatives,
    frontieresResolution,
    delegationsProposees,
    revocations,
  );

  const contribution = contributionM01(
    initiatives,
    frontieresResolution,
    choixOuverts,
    delegationsProposees,
    controles,
  );

  const transitions: PropositionTransition[] = uniquesParCle(
    [
      ...delegationsProposees
        .map(transitionDelegation)
        .filter(
          (
            transition,
          ): transition is PropositionTransition<DelegationNarrative> =>
            Boolean(transition),
        ),
      ...revocations.map(transitionRevocation),
    ],
    (transition) => transition.id,
  );

  const contraintes = uniquesTextes([
    ...(contribution.contraintes ?? []),
    ...evaluationsDelegations.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsRevocations.flatMap((evaluation) => evaluation.blocages),
  ]);

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M07,
    contribution,
    transitions,
    contraintes,
    alertes: uniquesTextes(alertes),
    blocage: blocagePrincipal(initiatives, frontieresResolution),
  };

  return {
    moteur: MOTEUR_M07,
    resultat,
    intentions,
    frontieresResolution,
    tentativesAResoudre: uniquesParCle(
      tentativesAResoudre,
      (tentative) => tentative.id,
    ),
    evaluationsDelegations,
    delegationsProposees,
    evaluationsRevocations,
    revocations,
    choixOuverts,
    alertes: resultat.alertes,
  };
}
