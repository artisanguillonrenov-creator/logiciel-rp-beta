// Elyndor — Noyau narratif natif V2.1
// M12 — Dynamique de groupe.
//
// M12 organise la coordination entre plusieurs PNJ présents : rôles contextuels,
// prises de parole utiles, décisions collectives et simultanéité. Il ne crée ni
// connaissance collective parallèle, ni relation, ni intention individuelle.
// M03, M04, M06, M07, M14 et M15 restent propriétaires de ces domaines.

import type { ContributionSceneM01 } from './m01-production';
import type {
  ConnaissanceSituee,
  ContexteNarratifV21,
  GroupeNarratif,
  PropositionTransition,
  ResultatMoteur,
} from './types';

export const MOTEUR_M12 = 'M12' as const;

export type RoleContextuelM12 =
  | 'meneur'
  | 'analyste'
  | 'soutien'
  | 'mediateur'
  | 'executant'
  | 'perturbateur'
  | 'autre';

export type RegleDecisionM12 =
  | 'commandement'
  | 'vote'
  | 'consensus'
  | 'repartition'
  | 'desaccord_ouvert'
  | 'autre';

export type TypeInteractionM12 =
  | 'accord'
  | 'friction'
  | 'coordination'
  | 'complicite'
  | 'positionnement';

export type PositionDecisionM12 =
  | 'soutien'
  | 'opposition'
  | 'abstention'
  | 'condition';

export type StatutDecisionCollectiveM12 =
  | 'adoptee'
  | 'rejetee'
  | 'non_resolue'
  | 'desaccord_ouvert';

export type StatutCoordinationM12 =
  | 'valide'
  | 'partielle'
  | 'impossible';

export interface PresenceMembreM12 {
  personnageId: string;
  groupeId?: string;
  present: boolean;
  peutAgir?: boolean;
  position?: string;
  sourceIds?: string[];
}

/**
 * Fait d'audibilité déjà établi dans la scène. M12 ne transforme pas ce fait
 * en connaissance : l'acquisition et la transmission appartiennent à M15.
 */
export interface AudibiliteM12 {
  emetteurId: string;
  auditeurId: string;
  contenuId?: string;
  audible: boolean;
  sourceIds?: string[];
}

export interface IntentionMembreM12 {
  personnageId: string;
  description: string;
  objectif?: string;
  cibleIds?: string[];
  sourceIds: string[];
}

export interface AttributionRoleM12 {
  groupeId: string;
  personnageId: string;
  role: RoleContextuelM12;
  tache?: string;
  justification: string;
  sourceIds?: string[];
}

export interface ReactionCandidateM12 {
  id: string;
  groupeId: string;
  personnageId: string;
  description: string;
  cibleIds?: string[];
  sourceIds: string[];

  adresseDirecteAuJoueur?: boolean;
  toucheCompetence?: boolean;
  toucheSecurite?: boolean;
  toucheRelation?: boolean;
  toucheObjectif?: boolean;
  apporteInformationUtile?: boolean;
  apporteCoordination?: boolean;
}

export interface EvaluationReactionM12 {
  reactionId: string;
  groupeId: string;
  personnageId: string;
  membreTrouve: boolean;
  present: boolean;
  pertinente: boolean;
  prioritaire: boolean;
  raisons: string[];
  alertes: string[];
}

export interface InteractionCroiseeM12 {
  id: string;
  groupeId: string;
  type: TypeInteractionM12;
  acteurId: string;
  cibleId: string;
  description: string;
  sourceIds: string[];
}

export interface EvaluationInteractionM12 {
  interactionId: string;
  groupeId: string;
  admissible: boolean;
  raisons: string[];
  blocages: string[];
}

export interface ActionCoordonneeMembreM12 {
  id: string;
  personnageId: string;
  description: string;
  tentativeId?: string;
  dependDeActionIds?: string[];
  sourceIds: string[];
}

export interface PropositionCoordinationM12 {
  id: string;
  groupeId: string;
  description: string;
  actions: ActionCoordonneeMembreM12[];
  simultanee: boolean;
  sourceIds: string[];
}

export interface EvaluationActionCoordonneeM12 {
  actionId: string;
  personnageId: string;
  present: boolean;
  peutAgir: boolean;
  dependancesTrouvees: boolean;
  resolutionDejaEtablie: boolean;
  avantageDejaAcquis: boolean;
  raisons: string[];
}

export interface EvaluationCoordinationM12 {
  coordinationId: string;
  groupeId: string;
  statut: StatutCoordinationM12;
  simultanee: boolean;
  actions: EvaluationActionCoordonneeM12[];
  aResoudreParM14: boolean;
  raisons: string[];
  blocages: string[];
}

export interface PositionCollectiveM12 {
  personnageId: string;
  position: PositionDecisionM12;
  condition?: string;
  sourceIds: string[];
}

export interface PropositionDecisionCollectiveM12 {
  id: string;
  groupeId: string;
  description: string;
  regle?: RegleDecisionM12;
  positions: PositionCollectiveM12[];
  sourceIds: string[];

  /** Pour commandement : personne réellement investie de l'autorité ici. */
  autoriteDecisionnelleId?: string;

  /** Pour vote : seuil défini par la règle du groupe. Aucun seuil n'est inventé. */
  seuilAdoption?: number;

  /** Pour répartition : tous les membres concernés doivent avoir accepté leur part. */
  membresConcernes?: string[];

  /** Vrai si cette décision prétend aussi engager le personnage joueur. */
  engagePersonnageJoueur?: boolean;

  /** Délégation explicite M07 permettant à un PNJ d'engager le joueur. */
  delegationJoueurId?: string;
}

export interface EvaluationDecisionCollectiveM12 {
  decisionId: string;
  groupeId: string;
  regle: RegleDecisionM12;
  statut: StatutDecisionCollectiveM12;
  positionsValides: PositionCollectiveM12[];
  joueurReserve: boolean;
  raisons: string[];
  blocages: string[];
}

export interface PointDesaccordM12 {
  id: string;
  groupeId: string;
  sujet: string;
  personnageIds: string[];
  description: string;
  sourceIds: string[];
  pertinent?: boolean;
}

export interface EvaluationDesaccordM12 {
  desaccordId: string;
  groupeId: string;
  pertinent: boolean;
  raisons: string[];
}

export interface DemandeEvolutionGroupeM12 {
  id: string;
  groupeId: string;
  valeurProposee: GroupeNarratif;
  justification: string;
  sourceIds: string[];
  etablieExplicitement: boolean;
}

export interface EvaluationEvolutionGroupeM12 {
  demandeId: string;
  groupeId: string;
  applicable: boolean;
  raisons: string[];
  blocages: string[];
}

export interface EvaluationGroupeM12 {
  groupeId: string;
  groupeTrouve: boolean;
  membresPresents: string[];
  membresAbsents: string[];
  membresPouvantAgir: string[];
  rolesContextuels: Record<string, RoleContextuelM12 | string>;
  affirmationIdsCommunsEtablis: string[];
  intentionsDisponibles: IntentionMembreM12[];
  raisons: string[];
  alertes: string[];
}

export interface EntreeM12 {
  contexte: ContexteNarratifV21;

  /** Sans liste, M12 examine les groupes qui ont au moins un membre dans la scène. */
  groupeIds?: string[];

  personnageJoueurId?: string;
  presences?: PresenceMembreM12[];
  audibilites?: AudibiliteM12[];
  intentions?: IntentionMembreM12[];
  rolesContextuels?: AttributionRoleM12[];
  reactionsCandidates?: ReactionCandidateM12[];
  interactionsCroisees?: InteractionCroiseeM12[];
  coordinations?: PropositionCoordinationM12[];
  decisionsCollectives?: PropositionDecisionCollectiveM12[];
  desaccords?: PointDesaccordM12[];
  evolutionsGroupe?: DemandeEvolutionGroupeM12[];
}

export interface SortieM12 {
  moteur: typeof MOTEUR_M12;
  resultat: ResultatMoteur<ContributionSceneM01>;
  evaluationsGroupes: EvaluationGroupeM12[];
  evaluationsReactions: EvaluationReactionM12[];
  evaluationsInteractions: EvaluationInteractionM12[];
  evaluationsCoordinations: EvaluationCoordinationM12[];
  evaluationsDecisions: EvaluationDecisionCollectiveM12[];
  evaluationsDesaccords: EvaluationDesaccordM12[];
  evaluationsEvolutions: EvaluationEvolutionGroupeM12[];
  transitionsGroupe: PropositionTransition<GroupeNarratif>[];
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
    const id = propre(cle(valeur));
    if (!id || vus.has(id)) continue;
    vus.add(id);
    resultat.push(valeur);
  }

  return resultat;
}

function groupeParId(contexte: ContexteNarratifV21, groupeId: string): GroupeNarratif | undefined {
  return contexte.groupes.find((groupe) => groupe.id === groupeId);
}

function idsGroupes(entree: EntreeM12): string[] {
  if (entree.groupeIds?.length) return uniquesTextes(entree.groupeIds);

  const participants = new Set(entree.contexte.scene.participants);
  return entree.contexte.groupes
    .filter((groupe) => groupe.membres.some((membreId) => participants.has(membreId)))
    .map((groupe) => groupe.id);
}

function presenceExplicite(
  entree: EntreeM12,
  groupeId: string,
  personnageId: string,
): PresenceMembreM12 | undefined {
  return entree.presences?.find(
    (presence) =>
      presence.personnageId === personnageId &&
      (!presence.groupeId || presence.groupeId === groupeId),
  );
}

function estPresent(
  entree: EntreeM12,
  groupeId: string,
  personnageId: string,
): boolean {
  const explicite = presenceExplicite(entree, groupeId, personnageId);
  if (explicite) return explicite.present;

  if (entree.contexte.scene.participants.includes(personnageId)) return true;

  const lieuScene = propre(entree.contexte.scene.lieu ?? entree.contexte.situationPhysique.lieu);
  if (!lieuScene) return false;

  const position = entree.contexte.situationPhysique.positions.find(
    (candidate) => candidate.entiteId === personnageId,
  );

  return Boolean(position && normaliser(position.lieu) === normaliser(lieuScene));
}

function peutAgir(
  entree: EntreeM12,
  groupeId: string,
  personnageId: string,
): boolean {
  if (!estPresent(entree, groupeId, personnageId)) return false;
  const explicite = presenceExplicite(entree, groupeId, personnageId);
  return explicite?.peutAgir !== false;
}

function connaissancesPourActeur(
  connaissances: ConnaissanceSituee[],
  acteurId: string,
): Set<string> {
  return new Set(
    connaissances
      .filter((connaissance) => connaissance.acteurId === acteurId)
      .map((connaissance) => connaissance.affirmationId),
  );
}

function connaissancesCommunesEtablies(
  contexte: ContexteNarratifV21,
  membresPresents: string[],
): string[] {
  if (membresPresents.length === 0) return [];

  const ensembles = membresPresents.map((membreId) =>
    connaissancesPourActeur(contexte.connaissances, membreId),
  );

  const [premier, ...autres] = ensembles;
  return [...premier].filter((affirmationId) =>
    autres.every((ensemble) => ensemble.has(affirmationId)),
  );
}

function audibiliteEtablie(
  entree: EntreeM12,
  emetteurId: string,
  auditeurId: string,
  contenuId?: string,
): boolean | undefined {
  const correspondances = (entree.audibilites ?? []).filter(
    (audibilite) =>
      audibilite.emetteurId === emetteurId &&
      audibilite.auditeurId === auditeurId &&
      (!contenuId || !audibilite.contenuId || audibilite.contenuId === contenuId),
  );

  if (correspondances.length === 0) return undefined;
  return correspondances.every((audibilite) => audibilite.audible);
}

function roleNormalise(role: string): RoleContextuelM12 | string {
  const cle = normaliser(role);
  if (['meneur', 'leader', 'chef'].includes(cle)) return 'meneur';
  if (['analyste', 'analyse'].includes(cle)) return 'analyste';
  if (['soutien', 'support'].includes(cle)) return 'soutien';
  if (['mediateur', 'mediation'].includes(cle)) return 'mediateur';
  if (['executant', 'execution'].includes(cle)) return 'executant';
  if (['perturbateur', 'perturbation'].includes(cle)) return 'perturbateur';
  return propre(role) || 'autre';
}

function rolesPourGroupe(
  entree: EntreeM12,
  groupe: GroupeNarratif,
): Record<string, RoleContextuelM12 | string> {
  const roles: Record<string, RoleContextuelM12 | string> = {};

  for (const [personnageId, role] of Object.entries(groupe.rolesContextuels ?? {})) {
    roles[personnageId] = roleNormalise(role);
  }

  for (const attribution of entree.rolesContextuels ?? []) {
    if (attribution.groupeId !== groupe.id) continue;
    if (!groupe.membres.includes(attribution.personnageId)) continue;
    roles[attribution.personnageId] = attribution.role;
  }

  return roles;
}

function evaluerGroupe(entree: EntreeM12, groupeId: string): EvaluationGroupeM12 {
  const groupe = groupeParId(entree.contexte, groupeId);
  if (!groupe) {
    return {
      groupeId,
      groupeTrouve: false,
      membresPresents: [],
      membresAbsents: [],
      membresPouvantAgir: [],
      rolesContextuels: {},
      affirmationIdsCommunsEtablis: [],
      intentionsDisponibles: [],
      raisons: [],
      alertes: [`Groupe introuvable pour M12 : ${groupeId}.`],
    };
  }

  const membresPresents = groupe.membres.filter((membreId) =>
    estPresent(entree, groupe.id, membreId),
  );
  const membresAbsents = groupe.membres.filter((membreId) =>
    !membresPresents.includes(membreId),
  );
  const membresPouvantAgir = membresPresents.filter((membreId) =>
    peutAgir(entree, groupe.id, membreId),
  );

  return {
    groupeId,
    groupeTrouve: true,
    membresPresents,
    membresAbsents,
    membresPouvantAgir,
    rolesContextuels: rolesPourGroupe(entree, groupe),
    affirmationIdsCommunsEtablis: connaissancesCommunesEtablies(
      entree.contexte,
      membresPresents,
    ),
    intentionsDisponibles: (entree.intentions ?? []).filter(
      (intention) => groupe.membres.includes(intention.personnageId),
    ),
    raisons: [
      'La présence, les rôles contextuels et les connaissances déjà établies sont conservés séparément.',
      'Un membre absent ou silencieux n’est pas traité comme un esprit collectif du groupe.',
    ],
    alertes: [],
  };
}

function reactionPertinente(candidate: ReactionCandidateM12): boolean {
  return Boolean(
    candidate.adresseDirecteAuJoueur ||
      candidate.toucheCompetence ||
      candidate.toucheSecurite ||
      candidate.toucheRelation ||
      candidate.toucheObjectif ||
      candidate.apporteInformationUtile ||
      candidate.apporteCoordination,
  );
}

function evaluerReaction(
  entree: EntreeM12,
  candidate: ReactionCandidateM12,
): EvaluationReactionM12 {
  const groupe = groupeParId(entree.contexte, candidate.groupeId);
  const raisons: string[] = [];
  const alertes: string[] = [];

  if (!groupe || !groupe.membres.includes(candidate.personnageId)) {
    return {
      reactionId: candidate.id,
      groupeId: candidate.groupeId,
      personnageId: candidate.personnageId,
      membreTrouve: false,
      present: false,
      pertinente: false,
      prioritaire: false,
      raisons: [],
      alertes: ['La réaction vise une personne qui n’appartient pas au groupe indiqué.'],
    };
  }

  const present = estPresent(entree, groupe.id, candidate.personnageId);
  if (!present) {
    alertes.push('Le personnage est absent de la scène : sa réaction immédiate est écartée.');
  }

  const pertinente = present && reactionPertinente(candidate);
  if (candidate.adresseDirecteAuJoueur) raisons.push('Le joueur attend une réponse adressée de ce membre.');
  if (candidate.toucheCompetence) raisons.push('L’événement touche sa compétence pertinente.');
  if (candidate.toucheSecurite) raisons.push('L’événement touche sa sécurité.');
  if (candidate.toucheRelation) raisons.push('L’événement touche un lien pertinent.');
  if (candidate.toucheObjectif) raisons.push('L’événement touche un objectif propre.');
  if (candidate.apporteInformationUtile) raisons.push('La réaction apporte une information utile.');
  if (candidate.apporteCoordination) raisons.push('La réaction apporte une coordination utile.');

  if (!reactionPertinente(candidate)) {
    raisons.push('Aucun motif concret ne justifie une prise de parole pour ce tour.');
  }

  return {
    reactionId: candidate.id,
    groupeId: candidate.groupeId,
    personnageId: candidate.personnageId,
    membreTrouve: true,
    present,
    pertinente,
    prioritaire: pertinente && Boolean(candidate.adresseDirecteAuJoueur),
    raisons: uniquesTextes(raisons),
    alertes,
  };
}

function evaluerInteraction(
  entree: EntreeM12,
  interaction: InteractionCroiseeM12,
): EvaluationInteractionM12 {
  const groupe = groupeParId(entree.contexte, interaction.groupeId);
  const raisons: string[] = [];
  const blocages: string[] = [];

  if (!groupe) {
    blocages.push('Groupe introuvable.');
  } else {
    if (!groupe.membres.includes(interaction.acteurId)) {
      blocages.push('L’acteur de l’interaction n’appartient pas au groupe.');
    }
    if (!groupe.membres.includes(interaction.cibleId)) {
      blocages.push('La cible de l’interaction n’appartient pas au groupe.');
    }
    if (!estPresent(entree, groupe.id, interaction.acteurId)) {
      blocages.push('L’acteur est absent de la scène.');
    }
    if (!estPresent(entree, groupe.id, interaction.cibleId)) {
      blocages.push('La cible est absente de la scène.');
    }
  }

  if (!propre(interaction.description)) {
    blocages.push('Interaction sans contenu exploitable.');
  }

  if (blocages.length === 0) {
    raisons.push(
      `L’interaction ajoute un élément de type « ${interaction.type} » entre deux membres présents.`,
    );
  }

  return {
    interactionId: interaction.id,
    groupeId: interaction.groupeId,
    admissible: blocages.length === 0,
    raisons,
    blocages,
  };
}

function resultatPourTentative(
  contexte: ContexteNarratifV21,
  tentativeId: string | undefined,
) {
  if (!tentativeId) return undefined;
  return contexte.resultatsDejaEtablis.find(
    (resolution) => resolution.tentativeId === tentativeId,
  );
}

function evaluerCoordination(
  entree: EntreeM12,
  coordination: PropositionCoordinationM12,
): EvaluationCoordinationM12 {
  const groupe = groupeParId(entree.contexte, coordination.groupeId);
  const blocages: string[] = [];
  const raisons: string[] = [];

  if (!groupe) blocages.push('Groupe introuvable.');
  if (coordination.actions.length === 0) blocages.push('Aucune action coordonnée fournie.');

  const idsActions = new Set(coordination.actions.map((action) => action.id));
  const evaluations = coordination.actions.map((action): EvaluationActionCoordonneeM12 => {
    const present = Boolean(groupe && estPresent(entree, groupe.id, action.personnageId));
    const peutAgirMaintenant = Boolean(
      groupe &&
        groupe.membres.includes(action.personnageId) &&
        peutAgir(entree, groupe.id, action.personnageId),
    );
    const dependancesTrouvees = (action.dependDeActionIds ?? []).every((id) => idsActions.has(id));
    const resolution = resultatPourTentative(entree.contexte, action.tentativeId);
    const resolutionDejaEtablie = Boolean(resolution);
    const avantageDejaAcquis = Boolean(
      resolution &&
        (resolution.etat === 'reussite' || resolution.etat === 'reussite_partielle'),
    );

    const raisonsAction: string[] = [];
    if (present) raisonsAction.push('Le membre est présent dans la scène.');
    if (peutAgirMaintenant) raisonsAction.push('Le membre peut agir dans l’état fourni.');
    if (dependancesTrouvees) raisonsAction.push('Les dépendances d’action sont identifiées.');
    if (resolutionDejaEtablie) raisonsAction.push('Une issue M14 existe déjà pour cette tentative.');

    return {
      actionId: action.id,
      personnageId: action.personnageId,
      present,
      peutAgir: peutAgirMaintenant,
      dependancesTrouvees,
      resolutionDejaEtablie,
      avantageDejaAcquis,
      raisons: raisonsAction,
    };
  });

  const invalides = evaluations.filter(
    (evaluation) => !evaluation.present || !evaluation.peutAgir || !evaluation.dependancesTrouvees,
  );

  if (invalides.length > 0) {
    blocages.push('Au moins une action repose sur un membre absent, indisponible ou une dépendance inconnue.');
  }

  const dejaResolues = evaluations.filter((evaluation) => evaluation.resolutionDejaEtablie).length;
  const aResoudreParM14 = evaluations.some((evaluation) => !evaluation.resolutionDejaEtablie);

  if (coordination.simultanee) {
    raisons.push('Les actions sont traitées comme appartenant à la même scène et au même temps.');
  }
  if (aResoudreParM14) {
    raisons.push('Les actions non encore résolues restent à arbitrer par M14 dans un état partagé.');
  }
  if (dejaResolues > 0) {
    raisons.push('Seuls les effets déjà établis par M14 peuvent être considérés comme acquis.');
  }

  const statut: StatutCoordinationM12 =
    blocages.length > 0
      ? evaluations.some((evaluation) => evaluation.present && evaluation.peutAgir)
        ? 'partielle'
        : 'impossible'
      : 'valide';

  return {
    coordinationId: coordination.id,
    groupeId: coordination.groupeId,
    statut,
    simultanee: coordination.simultanee,
    actions: evaluations,
    aResoudreParM14,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function regleDepuisTexte(regles: string[]): RegleDecisionM12 | undefined {
  for (const regle of regles) {
    const texte = normaliser(regle);
    if (texte.includes('command')) return 'commandement';
    if (texte.includes('vote')) return 'vote';
    if (texte.includes('consensus')) return 'consensus';
    if (texte.includes('repartition')) return 'repartition';
    if (texte.includes('desaccord')) return 'desaccord_ouvert';
  }
  return undefined;
}

function delegationJoueurValide(
  entree: EntreeM12,
  decision: PropositionDecisionCollectiveM12,
): boolean {
  if (!decision.engagePersonnageJoueur) return true;
  if (!entree.personnageJoueurId || !decision.delegationJoueurId) return false;

  const delegation = entree.contexte.delegations.find(
    (candidate) => candidate.id === decision.delegationJoueurId,
  );

  return Boolean(
    delegation &&
      !delegation.revoquee &&
      delegation.auteurId === entree.personnageJoueurId,
  );
}

function evaluerDecision(
  entree: EntreeM12,
  decision: PropositionDecisionCollectiveM12,
): EvaluationDecisionCollectiveM12 {
  const groupe = groupeParId(entree.contexte, decision.groupeId);
  const blocages: string[] = [];
  const raisons: string[] = [];

  if (!groupe) {
    return {
      decisionId: decision.id,
      groupeId: decision.groupeId,
      regle: decision.regle ?? 'autre',
      statut: 'non_resolue',
      positionsValides: [],
      joueurReserve: Boolean(decision.engagePersonnageJoueur),
      raisons: [],
      blocages: ['Groupe introuvable.'],
    };
  }

  const regle = decision.regle ?? regleDepuisTexte(groupe.reglesDecision) ?? 'autre';
  const positionsValides = uniquesParCle(
    decision.positions.filter(
      (position) =>
        groupe.membres.includes(position.personnageId) &&
        estPresent(entree, groupe.id, position.personnageId),
    ),
    (position) => position.personnageId,
  );

  const joueurReserve = !delegationJoueurValide(entree, decision);
  if (joueurReserve) {
    blocages.push('La décision collective ne peut pas engager le personnage joueur sans délégation M07 applicable.');
  }

  let statut: StatutDecisionCollectiveM12 = 'non_resolue';

  if (regle === 'desaccord_ouvert') {
    statut = 'desaccord_ouvert';
    raisons.push('La règle admise permet de conserver explicitement le désaccord.');
  } else if (regle === 'commandement') {
    if (!decision.autoriteDecisionnelleId) {
      blocages.push('Aucune autorité décisionnelle n’est établie pour appliquer le commandement.');
    } else if (!groupe.membres.includes(decision.autoriteDecisionnelleId)) {
      blocages.push('L’autorité désignée n’appartient pas au groupe.');
    } else {
      const positionAutorite = positionsValides.find(
        (position) => position.personnageId === decision.autoriteDecisionnelleId,
      );
      if (!positionAutorite) {
        raisons.push('La position de l’autorité décisionnelle n’est pas encore fournie.');
      } else if (positionAutorite.position === 'soutien') {
        statut = 'adoptee';
      } else if (positionAutorite.position === 'opposition') {
        statut = 'rejetee';
      } else {
        raisons.push('L’autorité pose une condition ou s’abstient : la décision reste ouverte.');
      }
    }
  } else if (regle === 'vote') {
    if (typeof decision.seuilAdoption !== 'number') {
      raisons.push('Le groupe fonctionne au vote mais aucun seuil d’adoption n’est fourni ; M12 n’en invente pas un.');
    } else if (decision.seuilAdoption <= 0) {
      blocages.push('Le seuil de vote fourni est invalide.');
    } else {
      const soutiens = positionsValides.filter((position) => position.position === 'soutien').length;
      const oppositions = positionsValides.filter((position) => position.position === 'opposition').length;
      if (soutiens >= decision.seuilAdoption) statut = 'adoptee';
      else if (oppositions > positionsValides.length - decision.seuilAdoption) statut = 'rejetee';
      else raisons.push('Le seuil défini n’est pas encore atteint dans un sens ou dans l’autre.');
    }
  } else if (regle === 'consensus') {
    const membresPresents = groupe.membres.filter((membreId) =>
      estPresent(entree, groupe.id, membreId),
    );
    const soutiens = new Set(
      positionsValides
        .filter((position) => position.position === 'soutien')
        .map((position) => position.personnageId),
    );
    const opposition = positionsValides.some((position) => position.position === 'opposition');

    if (opposition) statut = 'rejetee';
    else if (membresPresents.length > 0 && membresPresents.every((id) => soutiens.has(id))) {
      statut = 'adoptee';
    } else {
      raisons.push('Le consensus n’est pas établi auprès de tous les membres présents concernés.');
    }
  } else if (regle === 'repartition') {
    const concernes = decision.membresConcernes ?? [];
    if (concernes.length === 0) {
      raisons.push('La répartition ne précise pas quels membres doivent accepter une tâche.');
    } else {
      const positionsParId = new Map(
        positionsValides.map((position) => [position.personnageId, position.position] as const),
      );
      if (concernes.some((id) => positionsParId.get(id) === 'opposition')) {
        statut = 'rejetee';
      } else if (concernes.every((id) => positionsParId.get(id) === 'soutien')) {
        statut = 'adoptee';
      } else {
        raisons.push('Toutes les parts de la répartition ne sont pas encore acceptées.');
      }
    }
  } else {
    raisons.push('La règle de décision collective n’est pas assez précise pour établir une issue.');
  }

  if (joueurReserve && statut === 'adoptee') {
    raisons.push('La décision peut être adoptée par le groupe sans valoir décision du personnage joueur.');
  }

  return {
    decisionId: decision.id,
    groupeId: decision.groupeId,
    regle,
    statut,
    positionsValides,
    joueurReserve,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function evaluerDesaccord(desaccord: PointDesaccordM12): EvaluationDesaccordM12 {
  const pertinent = desaccord.pertinent !== false && propre(desaccord.description).length > 0;
  return {
    desaccordId: desaccord.id,
    groupeId: desaccord.groupeId,
    pertinent,
    raisons: pertinent
      ? ['Le désaccord fourni affecte réellement la coordination ou le positionnement du groupe.']
      : ['Le désaccord n’apporte rien d’utile à l’enjeu présent et peut rester hors champ.'],
  };
}

function groupesEquivalents(a: GroupeNarratif, b: GroupeNarratif): boolean {
  const tri = (valeurs: string[]) => uniquesTextes(valeurs).map(normaliser).sort();
  const roles = (groupe: GroupeNarratif) =>
    Object.entries(groupe.rolesContextuels ?? {})
      .map(([id, role]) => `${normaliser(id)}:${normaliser(role)}`)
      .sort();

  return (
    normaliser(a.id) === normaliser(b.id) &&
    JSON.stringify(tri(a.membres)) === JSON.stringify(tri(b.membres)) &&
    normaliser(a.butCommun) === normaliser(b.butCommun) &&
    JSON.stringify(tri(a.reglesDecision)) === JSON.stringify(tri(b.reglesDecision)) &&
    JSON.stringify(roles(a)) === JSON.stringify(roles(b))
  );
}

function evaluerEvolution(
  entree: EntreeM12,
  demande: DemandeEvolutionGroupeM12,
): EvaluationEvolutionGroupeM12 {
  const groupe = groupeParId(entree.contexte, demande.groupeId);
  const raisons: string[] = [];
  const blocages: string[] = [];

  if (!groupe) blocages.push('Groupe introuvable.');
  if (!demande.etablieExplicitement) {
    blocages.push('Le changement du groupe n’est pas établi explicitement.');
  }
  if (demande.valeurProposee.id !== demande.groupeId) {
    blocages.push('La valeur proposée cible un autre identifiant de groupe.');
  }
  if (!propre(demande.justification)) {
    blocages.push('Justification manquante.');
  }
  if (groupe && groupesEquivalents(groupe, demande.valeurProposee)) {
    raisons.push('La valeur proposée est équivalente à l’état courant ; aucune transition n’est nécessaire.');
  }
  if (blocages.length === 0 && groupe && !groupesEquivalents(groupe, demande.valeurProposee)) {
    raisons.push('Le changement explicite appartient au domaine groupe de M12 et peut être proposé au noyau.');
  }

  return {
    demandeId: demande.id,
    groupeId: demande.groupeId,
    applicable:
      blocages.length === 0 &&
      Boolean(groupe) &&
      !groupesEquivalents(groupe as GroupeNarratif, demande.valeurProposee),
    raisons,
    blocages,
  };
}

function transitionsGroupe(
  entree: EntreeM12,
  evaluations: EvaluationEvolutionGroupeM12[],
): PropositionTransition<GroupeNarratif>[] {
  const sorties: PropositionTransition<GroupeNarratif>[] = [];

  for (const evaluation of evaluations) {
    if (!evaluation.applicable) continue;
    const demande = entree.evolutionsGroupe?.find(
      (candidate) => candidate.id === evaluation.demandeId,
    );
    if (!demande) continue;

    sorties.push({
      id: `M12:${demande.id}`,
      moteurProprietaire: MOTEUR_M12,
      domaine: 'groupe',
      categorie: 'narrative',
      cibleIds: [demande.groupeId],
      justification: demande.justification,
      sourceIds: uniquesTextes(demande.sourceIds),
      valeurProposee: {
        ...demande.valeurProposee,
        membres: uniquesTextes(demande.valeurProposee.membres),
        rolesContextuels: { ...demande.valeurProposee.rolesContextuels },
        reglesDecision: uniquesTextes(demande.valeurProposee.reglesDecision),
      },
      perceptible: true,
      transmissible: true,
    });
  }

  return sorties;
}

function pointsAMontrer(
  entree: EntreeM12,
  evaluationsReactions: EvaluationReactionM12[],
  evaluationsInteractions: EvaluationInteractionM12[],
  evaluationsDecisions: EvaluationDecisionCollectiveM12[],
  evaluationsDesaccords: EvaluationDesaccordM12[],
): string[] {
  const points: string[] = [];

  const reactionsParId = new Map(
    (entree.reactionsCandidates ?? []).map((candidate) => [candidate.id, candidate] as const),
  );

  const prioritaires = evaluationsReactions.filter(
    (evaluation) => evaluation.pertinente && evaluation.prioritaire,
  );
  const autres = evaluationsReactions.filter(
    (evaluation) => evaluation.pertinente && !evaluation.prioritaire,
  );

  for (const evaluation of [...prioritaires, ...autres]) {
    const candidate = reactionsParId.get(evaluation.reactionId);
    if (!candidate) continue;
    points.push(`${candidate.personnageId} : ${candidate.description}`);
  }

  for (const evaluation of evaluationsInteractions) {
    if (!evaluation.admissible) continue;
    const interaction = entree.interactionsCroisees?.find(
      (candidate) => candidate.id === evaluation.interactionId,
    );
    if (interaction) points.push(interaction.description);
  }

  for (const evaluation of evaluationsDecisions) {
    const decision = entree.decisionsCollectives?.find(
      (candidate) => candidate.id === evaluation.decisionId,
    );
    if (!decision) continue;
    if (evaluation.statut === 'adoptee') {
      points.push(`Le groupe adopte : ${decision.description}`);
    } else if (evaluation.statut === 'rejetee') {
      points.push(`Le groupe rejette : ${decision.description}`);
    } else if (evaluation.statut === 'desaccord_ouvert') {
      points.push(`Le groupe reste en désaccord sur : ${decision.description}`);
    }
  }

  for (const evaluation of evaluationsDesaccords) {
    if (!evaluation.pertinent) continue;
    const desaccord = entree.desaccords?.find(
      (candidate) => candidate.id === evaluation.desaccordId,
    );
    if (desaccord) points.push(desaccord.description);
  }

  return uniquesTextes(points);
}

function contraintesM12(): string[] {
  return [
    'Un groupe n’est pas un esprit collectif : présence, savoir, intention et relation restent individuels.',
    'Un PNJ silencieux n’exige pas une prise de parole ; il intervient lorsqu’un enjeu touche réellement sa compétence, sa sécurité, ses liens ou ses objectifs.',
    'Une information entendue par certains membres ne devient commune que si M15 établit sa réception pour les destinataires concernés.',
    'Les rôles meneur, analyste, soutien, médiateur, exécutant ou perturbateur sont contextuels et peuvent changer selon la tâche.',
    'Une interaction entre PNJ doit ajouter accord utile, friction, coordination, complicité ou positionnement ; aucun conflit n’est obligatoire.',
    'La règle de décision effectivement admise par le groupe s’applique sans engager le personnage joueur hors délégation M07.',
    'Les actions coordonnées et simultanées partagent un même état de scène ; leurs issues appartiennent à M14.',
    'Un avantage issu d’une diversion n’est acquis que si cette diversion a réellement été effectuée et résolue.',
    'La charge de scène doit préserver la réponse adressée au joueur au lieu de transformer chaque tour en discussion interne du groupe.',
  ];
}

function interditsM12(): string[] {
  return [
    'Ne pas faire réagir tous les membres en chœur pour prouver leur présence.',
    'Ne pas attribuer à un membre absent ou hors portée une confidence qu’il n’a pas reçue.',
    'Ne pas transformer un rôle contextuel en identité permanente ou en trait psychologique.',
    'Ne pas inventer un conflit lorsque l’accord du groupe est cohérent et motivé.',
    'Ne pas signer, promettre, dépenser ou choisir une alliance au nom du personnage joueur sans délégation explicite.',
    'Ne pas résoudre deux actions simultanées comme si chacune avait rencontré un environnement inchangé.',
    'Ne pas créer un second registre de connaissances collectives, de relations ou d’intentions dans M12.',
  ];
}

function contributionM12(
  entree: EntreeM12,
  evaluationsReactions: EvaluationReactionM12[],
  evaluationsInteractions: EvaluationInteractionM12[],
  evaluationsDecisions: EvaluationDecisionCollectiveM12[],
  evaluationsDesaccords: EvaluationDesaccordM12[],
): ContributionSceneM01 {
  return {
    contraintes: contraintesM12(),
    interditsNarratifs: interditsM12(),
    pointsAMontrer: pointsAMontrer(
      entree,
      evaluationsReactions,
      evaluationsInteractions,
      evaluationsDecisions,
      evaluationsDesaccords,
    ),
  };
}

function alertesAudibilite(entree: EntreeM12): string[] {
  const alertes: string[] = [];

  for (const audibilite of entree.audibilites ?? []) {
    if (audibilite.audible) continue;
    const connaissance = entree.contexte.connaissances.find(
      (candidate) =>
        candidate.acteurId === audibilite.auditeurId &&
        (!audibilite.contenuId || candidate.affirmationId === audibilite.contenuId),
    );

    if (connaissance && audibilite.contenuId) {
      alertes.push(
        `M12 constate une non-audibilité pour ${audibilite.auditeurId} sur ${audibilite.contenuId}, mais M15 possède déjà une connaissance correspondante : vérifier sa provenance plutôt que la supprimer.`,
      );
    }
  }

  return alertes;
}

/**
 * M12 coordonne le groupe sans recalculer les états individuels. Les seules
 * transitions persistantes qu'il propose concernent le domaine groupe et
 * exigent un changement explicitement établi. Les actions coordonnées restent
 * des données à résoudre par M14 lorsque leur issue n'existe pas encore.
 */
export function executerM12(entree: EntreeM12): SortieM12 {
  const evaluationsGroupes = idsGroupes(entree).map((groupeId) =>
    evaluerGroupe(entree, groupeId),
  );

  const evaluationsReactions = (entree.reactionsCandidates ?? []).map((candidate) =>
    evaluerReaction(entree, candidate),
  );

  const evaluationsInteractions = (entree.interactionsCroisees ?? []).map((interaction) =>
    evaluerInteraction(entree, interaction),
  );

  const evaluationsCoordinations = (entree.coordinations ?? []).map((coordination) =>
    evaluerCoordination(entree, coordination),
  );

  const evaluationsDecisions = (entree.decisionsCollectives ?? []).map((decision) =>
    evaluerDecision(entree, decision),
  );

  const evaluationsDesaccords = (entree.desaccords ?? []).map(evaluerDesaccord);

  const evaluationsEvolutions = (entree.evolutionsGroupe ?? []).map((demande) =>
    evaluerEvolution(entree, demande),
  );

  const transitions = transitionsGroupe(entree, evaluationsEvolutions);

  const alertes = uniquesTextes([
    ...evaluationsGroupes.flatMap((evaluation) => evaluation.alertes),
    ...evaluationsReactions.flatMap((evaluation) => evaluation.alertes),
    ...evaluationsInteractions.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsCoordinations.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsDecisions.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsEvolutions.flatMap((evaluation) => evaluation.blocages),
    ...alertesAudibilite(entree),
  ]);

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M12,
    contribution: contributionM12(
      entree,
      evaluationsReactions,
      evaluationsInteractions,
      evaluationsDecisions,
      evaluationsDesaccords,
    ),
    transitions,
    contraintes: contraintesM12(),
    alertes,
  };

  return {
    moteur: MOTEUR_M12,
    resultat,
    evaluationsGroupes,
    evaluationsReactions,
    evaluationsInteractions,
    evaluationsCoordinations,
    evaluationsDecisions,
    evaluationsDesaccords,
    evaluationsEvolutions,
    transitionsGroupe: transitions,
    alertes,
  };
}
