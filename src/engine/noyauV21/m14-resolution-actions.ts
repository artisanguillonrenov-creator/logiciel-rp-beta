// Elyndor — Noyau narratif natif V2.1
// M14 — Résolution des actions.
//
// M14 détermine l'issue d'une tentative à partir des capacités, moyens,
// conditions et oppositions déjà établis. Il ne réécrit ni les lois physiques
// (M06), ni l'intention du joueur (M07), ni les limites réelles (M13), ni les
// états spécialisés auxquels les conséquences doivent être proposées.

import type { ContributionSceneM01 } from './m01-production';
import type { PerimetreEffectifM13 } from './m13-consentement-limites-signaux';
import type {
  BlocageNarratif,
  CategorieConsequence,
  ContexteNarratifV21,
  ControleNarratif,
  DomaineEtatNarratif,
  EtatResolution,
  IdMoteurNarratif,
  PropositionTransition,
  ResolutionAction,
  ResultatMoteur,
  TentativeAction,
} from './types';

export const MOTEUR_M14 = 'M14' as const;

export type TypeActionM14 =
  | 'ordinaire'
  | 'physique'
  | 'sociale'
  | 'mystere'
  | 'autre';

export type StatutFaisabiliteM14 =
  | 'possible'
  | 'possible_sous_conditions'
  | 'impossible'
  | 'inconnue';

export type NiveauCompetenceM14 =
  | 'non_requise'
  | 'etablie_suffisante'
  | 'etablie_partielle'
  | 'etablie_insuffisante'
  | 'inconnue';

export type NiveauOppositionM14 =
  | 'aucune'
  | 'faible'
  | 'comparable'
  | 'forte'
  | 'dominante'
  | 'inconnue';

export type EtatPreparationM14 =
  | 'suffisante'
  | 'partielle'
  | 'insuffisante'
  | 'non_requise'
  | 'inconnue';

export type EtatContexteM14 =
  | 'favorable'
  | 'neutre'
  | 'defavorable'
  | 'bloquant'
  | 'inconnu';

/**
 * Catégories conceptuelles plus précises que l'état compact ResolutionAction.
 * Elles servent à expliquer l'arbitrage sans exposer de score au joueur.
 */
export type TypeIssueM14 =
  | 'reussite_simple'
  | 'reussite_avec_cout_necessaire'
  | 'reussite_partielle'
  | 'absence_resultat'
  | 'echec_changement_situation'
  | 'opposition_victorieuse'
  | 'interrompue'
  | 'impossible'
  | 'suspendue_information';

export type NatureEffetSocialInterditM14 =
  | 'conversion_valeurs'
  | 'loyaute_totale'
  | 'attirance_imposee'
  | 'consentement_impose';

export interface ConventionChanceM14 {
  active: boolean;
  /**
   * Résultat déjà tiré/établi par la convention de partie. M14 ne génère pas
   * un hasard rétroactif pour justifier une issue.
   */
  resultat?: 'favorable' | 'neutre' | 'defavorable';
  sourceIds: string[];
}

export interface RisqueM14 {
  id: string;
  description: string;
  perceptible: boolean;
  signaleAvantEngagement: boolean;
  difficileARevoquer?: boolean;
  sourceIds: string[];
}

export interface IndiceMystereM14 {
  id: string;
  description: string;
  accessible: boolean;
  sourceIds: string[];
}

export interface RevelationMystereM14 {
  id: string;
  description: string;
  indiceId?: string;
  solutionComplete?: boolean;
  connueSeulementAuteur?: boolean;
  sourceIds: string[];
}

export interface EffetCausalM14 {
  id: string;
  domaine: DomaineEtatNarratif;
  categorie?: CategorieConsequence;
  moteurProprietaire: IdMoteurNarratif;
  cibleIds: string[];
  description: string;
  valeurProposee: unknown;
  sourceIds: string[];
  perceptible: boolean;
  transmissible: boolean;

  /** Lien causal explicite avec la tentative ou son issue. */
  causal: boolean;

  /** Coût réellement nécessaire à l'issue, et non complication décorative. */
  coutNecessaire?: boolean;

  /** Marque un effet social que M14 ne peut jamais imposer par persuasion. */
  natureSocialeInterdite?: NatureEffetSocialInterditM14;

  /** Mort définitive du personnage joueur. M13 doit l'autoriser explicitement. */
  mortDefinitiveJoueur?: boolean;
}

export interface DonneesResolutionM14 {
  tentativeId: string;
  typeAction: TypeActionM14;

  /** M07 a reconnu l'intention/tentative et n'a pas réservé une décision préalable. */
  intentionValideeM07: boolean;

  /** Résultat de faisabilité issu de M06 ou d'un adaptateur équivalent. */
  faisabiliteM06: StatutFaisabiliteM14;
  prerequisManquants?: string[];

  competence: NiveauCompetenceM14;
  preparation: EtatPreparationM14;
  contexte: EtatContexteM14;
  opposition: NiveauOppositionM14;

  /** Action sans enjeu contesté nécessitant normalement une résolution simple. */
  banaleSansEnjeu?: boolean;

  /** Informations réellement décisives qui manquent encore. */
  informationsDecisivesManquantes?: string[];

  /** Facteurs explicites à conserver dans ResolutionAction. */
  facteurs?: string[];

  risques?: RisqueM14[];
  chance?: ConventionChanceM14;

  /** Conséquences candidates à soumettre aux moteurs propriétaires. */
  effetsProposes?: EffetCausalM14[];

  /** Données propres aux actions d'enquête/mystère. */
  indicesAccessibles?: IndiceMystereM14[];
  revelationsProposees?: RevelationMystereM14[];

  /**
   * Si une première conséquence crée un choix nouveau significatif, M14 doit
   * s'arrêter avant de résoudre ce choix à la place du joueur.
   */
  choixNouveauApresIssue?: string;

  /**
   * Indique que l'action a déjà été interrompue par un événement établi ; M14
   * n'invente pas la réaction volontaire suivante de l'auteur.
   */
  interruptionEtablie?: string;

  /** Sources supplémentaires permettant de justifier l'arbitrage. */
  sourceIds?: string[];
}

export interface EvaluationEffetM14 {
  effetId: string;
  admissible: boolean;
  raisons: string[];
  blocages: string[];
  transition?: PropositionTransition;
}

export interface EvaluationMystereM14 {
  revelationId: string;
  admissible: boolean;
  raisons: string[];
  blocages: string[];
}

export interface EvaluationRisqueM14 {
  risqueId: string;
  bloqueResolution: boolean;
  raisons: string[];
}

export interface EvaluationTentativeM14 {
  tentativeId: string;
  tentativeTrouvee: boolean;
  issue: TypeIssueM14;
  etatResolution: EtatResolution;
  resume: string;
  facteurs: string[];
  coutsNecessaires: string[];
  effetsAdmissibles: PropositionTransition[];
  effetsRejetes: string[];
  prochainChoixReserve?: string;
  raisons: string[];
  alertes: string[];
  blocage?: BlocageNarratif;
}

export interface EntreeM14 {
  contexte: ContexteNarratifV21;
  tentatives: TentativeAction[];
  donnees: DonneesResolutionM14[];

  /** Périmètre calculé par M13 lorsqu'il est disponible. */
  perimetreM13?: PerimetreEffectifM13;
}

export interface SortieM14 {
  moteur: typeof MOTEUR_M14;
  resultat: ResultatMoteur<ContributionSceneM01>;
  evaluations: EvaluationTentativeM14[];
  resolutions: ResolutionAction[];
  transitionsResolution: PropositionTransition<ResolutionAction>[];
  evaluationsEffets: EvaluationEffetM14[];
  evaluationsMysteres: EvaluationMystereM14[];
  evaluationsRisques: EvaluationRisqueM14[];
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

function donneesPourTentative(
  donnees: DonneesResolutionM14[],
  tentativeId: string,
): DonneesResolutionM14 | undefined {
  return donnees.find((item) => item.tentativeId === tentativeId);
}

function tentativeParId(
  tentatives: TentativeAction[],
  tentativeId: string,
): TentativeAction | undefined {
  return tentatives.find((tentative) => tentative.id === tentativeId);
}

function etatDepuisIssue(issue: TypeIssueM14): EtatResolution {
  switch (issue) {
    case 'reussite_simple':
    case 'reussite_avec_cout_necessaire':
      return 'reussite';
    case 'reussite_partielle':
      return 'reussite_partielle';
    case 'absence_resultat':
    case 'echec_changement_situation':
    case 'opposition_victorieuse':
      return 'echec';
    case 'interrompue':
      return 'interrompue';
    case 'impossible':
      return 'impossible';
    case 'suspendue_information':
      return 'a_clarifier';
  }
}

function resumeIssue(issue: TypeIssueM14, tentative: TentativeAction): string {
  switch (issue) {
    case 'reussite_simple':
      return `La tentative « ${tentative.description} » réussit sans complication nécessaire.`;
    case 'reussite_avec_cout_necessaire':
      return `La tentative « ${tentative.description} » réussit avec un coût causal déjà justifié.`;
    case 'reussite_partielle':
      return `La tentative « ${tentative.description} » n'atteint qu'une partie de son objectif.`;
    case 'absence_resultat':
      return `La tentative « ${tentative.description} » ne produit pas le résultat recherché.`;
    case 'echec_changement_situation':
      return `La tentative « ${tentative.description} » échoue et la situation change selon les effets causaux établis.`;
    case 'opposition_victorieuse':
      return `L'opposition empêche la tentative « ${tentative.description} » d'atteindre son objectif.`;
    case 'interrompue':
      return `La tentative « ${tentative.description} » est interrompue avant son achèvement.`;
    case 'impossible':
      return `La tentative « ${tentative.description} » est matériellement impossible dans l'état applicable.`;
    case 'suspendue_information':
      return `La tentative « ${tentative.description} » ne peut pas encore être résolue faute d'une information décisive.`;
  }
}

function estMortJoueurAutorisee(perimetre: PerimetreEffectifM13 | undefined): boolean {
  return perimetre?.mortDefinitiveJoueurAutorisee === true;
}

function evaluerRisque(risque: RisqueM14): EvaluationRisqueM14 {
  const raisons: string[] = [];
  let bloqueResolution = false;

  if (risque.perceptible && risque.difficileARevoquer && !risque.signaleAvantEngagement) {
    bloqueResolution = true;
    raisons.push('Un risque perceptible difficile à révoquer doit être signalé avant l’engagement.');
  } else if (!risque.perceptible) {
    raisons.push('Le risque n’était pas perceptible ; son absence d’avertissement ne constitue pas à elle seule une erreur.');
  } else if (risque.signaleAvantEngagement) {
    raisons.push('Le risque perceptible a été signalé avant l’engagement.');
  } else {
    raisons.push('Le risque ne bloque pas la résolution dans les conditions fournies.');
  }

  return { risqueId: risque.id, bloqueResolution, raisons };
}

function evaluerMystere(
  revelation: RevelationMystereM14,
  indices: IndiceMystereM14[],
): EvaluationMystereM14 {
  const raisons: string[] = [];
  const blocages: string[] = [];

  if (revelation.connueSeulementAuteur) {
    blocages.push('Une solution connue seulement par l’auteur ne peut pas être révélée comme résultat de l’inspection.');
  }

  if (revelation.indiceId) {
    const indice = indices.find((item) => item.id === revelation.indiceId);
    if (!indice) {
      blocages.push(`L’indice ${revelation.indiceId} n’est pas fourni dans le dossier de résolution.`);
    } else if (!indice.accessible) {
      blocages.push(`L’indice ${revelation.indiceId} n’est pas accessible dans les conditions actuelles.`);
    } else {
      raisons.push(`La révélation s’appuie sur l’indice accessible ${revelation.indiceId}.`);
    }
  } else if (revelation.solutionComplete) {
    blocages.push('Une solution complète sans indice accessible ne peut pas être produite par simple inspection.');
  }

  return {
    revelationId: revelation.id,
    admissible: blocages.length === 0,
    raisons,
    blocages,
  };
}

function transitionEffet(effet: EffetCausalM14): PropositionTransition {
  return {
    id: `m14:effet:${effet.id}`,
    moteurProprietaire: effet.moteurProprietaire,
    domaine: effet.domaine,
    categorie: effet.categorie,
    cibleIds: [...effet.cibleIds],
    justification: effet.description,
    sourceIds: [...effet.sourceIds],
    valeurProposee: effet.valeurProposee,
    perceptible: effet.perceptible,
    transmissible: effet.transmissible,
  };
}

function evaluerEffet(
  effet: EffetCausalM14,
  donnees: DonneesResolutionM14,
  perimetreM13: PerimetreEffectifM13 | undefined,
): EvaluationEffetM14 {
  const raisons: string[] = [];
  const blocages: string[] = [];

  if (!effet.causal) {
    blocages.push('L’effet n’a pas de lien causal établi avec la tentative ou son issue.');
  }

  if (effet.natureSocialeInterdite) {
    blocages.push(`Une action sociale ne peut pas imposer automatiquement : ${effet.natureSocialeInterdite}.`);
  }

  if (effet.mortDefinitiveJoueur && !estMortJoueurAutorisee(perimetreM13)) {
    blocages.push('La mort définitive du personnage joueur n’est pas autorisée par M13.');
  }

  if (effet.moteurProprietaire === MOTEUR_M14 && effet.domaine !== 'resolution') {
    blocages.push('M14 ne doit pas devenir propriétaire d’un état spécialisé extérieur au domaine résolution.');
  }

  if (donnees.typeAction === 'sociale' && effet.natureSocialeInterdite) {
    raisons.push('Le levier social peut obtenir une coopération ciblée, pas une commande mentale.');
  }

  if (effet.coutNecessaire) {
    raisons.push('Le coût est explicitement déclaré nécessaire par la causalité de l’issue.');
  }

  if (blocages.length === 0) {
    raisons.push(`L’effet est proposé au propriétaire ${effet.moteurProprietaire} du domaine ${effet.domaine}.`);
  }

  return {
    effetId: effet.id,
    admissible: blocages.length === 0,
    raisons,
    blocages,
    transition: blocages.length === 0 ? transitionEffet(effet) : undefined,
  };
}

function facteursDeBase(
  tentative: TentativeAction,
  donnees: DonneesResolutionM14,
): string[] {
  const facteurs: string[] = [
    `Faisabilité M06 : ${donnees.faisabiliteM06}.`,
    `Compétence : ${donnees.competence}.`,
    `Préparation : ${donnees.preparation}.`,
    `Contexte : ${donnees.contexte}.`,
    `Opposition : ${donnees.opposition}.`,
  ];

  if (tentative.moyens.length) facteurs.push(`Moyens établis : ${tentative.moyens.join(', ')}.`);
  if (tentative.preparation.length) facteurs.push(`Préparation déclarée : ${tentative.preparation.join(', ')}.`);
  if (tentative.opposition.length) facteurs.push(`Opposition établie : ${tentative.opposition.join(', ')}.`);
  facteurs.push(...(donnees.facteurs ?? []));

  if (donnees.chance?.active) {
    facteurs.push(donnees.chance.resultat
      ? `Convention de chance active ; résultat déjà établi : ${donnees.chance.resultat}.`
      : 'Convention de chance active sans résultat préétabli ; aucun hasard rétroactif n’est inventé.');
  }

  return uniquesTextes(facteurs);
}

function issueSansOpposition(donnees: DonneesResolutionM14): TypeIssueM14 {
  if (donnees.banaleSansEnjeu) return 'reussite_simple';

  if (donnees.competence === 'etablie_insuffisante') return 'absence_resultat';
  if (donnees.preparation === 'insuffisante') return 'absence_resultat';
  if (donnees.contexte === 'bloquant') return 'impossible';

  if (
    donnees.competence === 'etablie_suffisante' &&
    (donnees.preparation === 'suffisante' || donnees.preparation === 'non_requise') &&
    (donnees.contexte === 'favorable' || donnees.contexte === 'neutre')
  ) {
    return 'reussite_simple';
  }

  if (
    donnees.competence === 'etablie_partielle' ||
    donnees.preparation === 'partielle' ||
    donnees.contexte === 'defavorable'
  ) {
    return 'reussite_partielle';
  }

  return 'reussite_simple';
}

function issueAvecOpposition(donnees: DonneesResolutionM14): TypeIssueM14 {
  if (donnees.opposition === 'dominante') return 'opposition_victorieuse';

  if (
    donnees.competence === 'etablie_insuffisante' &&
    (donnees.opposition === 'forte' || donnees.opposition === 'comparable')
  ) {
    return 'opposition_victorieuse';
  }

  if (
    donnees.competence === 'etablie_suffisante' &&
    donnees.preparation === 'suffisante' &&
    donnees.contexte !== 'defavorable' &&
    (donnees.opposition === 'faible' || donnees.opposition === 'comparable')
  ) {
    return donnees.opposition === 'faible' ? 'reussite_simple' : 'reussite_partielle';
  }

  if (
    donnees.opposition === 'forte' &&
    (donnees.competence === 'etablie_partielle' || donnees.preparation === 'partielle')
  ) {
    return 'echec_changement_situation';
  }

  if (
    donnees.competence === 'etablie_partielle' ||
    donnees.preparation === 'partielle' ||
    donnees.contexte === 'defavorable' ||
    donnees.opposition === 'comparable'
  ) {
    return 'reussite_partielle';
  }

  return 'absence_resultat';
}

function appliquerChanceEtablie(
  issue: TypeIssueM14,
  chance: ConventionChanceM14 | undefined,
): TypeIssueM14 {
  if (!chance?.active || !chance.resultat) return issue;

  if (chance.resultat === 'neutre') return issue;

  if (chance.resultat === 'favorable') {
    if (issue === 'absence_resultat') return 'reussite_partielle';
    if (issue === 'reussite_partielle') return 'reussite_simple';
    return issue;
  }

  if (issue === 'reussite_simple') return 'reussite_partielle';
  if (issue === 'reussite_partielle') return 'absence_resultat';
  return issue;
}

function choisirIssue(
  donnees: DonneesResolutionM14,
  risques: EvaluationRisqueM14[],
): { issue: TypeIssueM14; blocage?: BlocageNarratif; raisons: string[] } {
  const raisons: string[] = [];

  if (!donnees.intentionValideeM07) {
    return {
      issue: 'suspendue_information',
      blocage: {
        type: 'agentivite',
        raison: 'La tentative ne peut pas être résolue tant que son intention n’est pas validée par M07.',
      },
      raisons: ['M14 ne transforme pas une formulation ambiguë en décision du joueur.'],
    };
  }

  if (donnees.interruptionEtablie) {
    return {
      issue: 'interrompue',
      raisons: [`Interruption établie : ${donnees.interruptionEtablie}`],
    };
  }

  const risqueBloquant = risques.find((item) => item.bloqueResolution);
  if (risqueBloquant) {
    return {
      issue: 'suspendue_information',
      blocage: {
        type: 'information_manquante',
        raison: 'Un risque perceptible et difficile à révoquer n’a pas été signalé avant l’engagement.',
        questionClarification: 'Le risque doit être rendu perceptible avant de poursuivre cette résolution.',
      },
      raisons: [...risqueBloquant.raisons],
    };
  }

  if (donnees.faisabiliteM06 === 'impossible' || donnees.contexte === 'bloquant') {
    return {
      issue: 'impossible',
      blocage: {
        type: 'impossibilite',
        raison: uniquesTextes([
          ...(donnees.prerequisManquants ?? []),
          'La tentative est incompatible avec les possibilités matérielles établies par M06.',
        ]).join(' '),
      },
      raisons: ['Une expertise ne remplace ni un outil manquant ni une impossibilité matérielle.'],
    };
  }

  const informationsManquantes = uniquesTextes(donnees.informationsDecisivesManquantes ?? []);
  const competenceInconnueDecisive =
    donnees.competence === 'inconnue' && !donnees.banaleSansEnjeu;
  const faisabiliteInconnue = donnees.faisabiliteM06 === 'inconnue';
  const oppositionInconnue = donnees.opposition === 'inconnue';

  if (informationsManquantes.length || competenceInconnueDecisive || faisabiliteInconnue || oppositionInconnue) {
    const detail = uniquesTextes([
      ...informationsManquantes,
      competenceInconnueDecisive ? 'Compétence décisive non établie.' : '',
      faisabiliteInconnue ? 'Faisabilité matérielle non établie.' : '',
      oppositionInconnue ? 'Niveau d’opposition décisif non établi.' : '',
    ]);
    return {
      issue: 'suspendue_information',
      blocage: {
        type: 'information_manquante',
        raison: detail.join(' '),
        questionClarification: 'Récupérer la donnée décisive manquante avant de fixer l’issue.',
      },
      raisons: ['Une information décisive absente reste inconnue ; elle n’est pas remplacée par une supposition.'],
    };
  }

  let issue = donnees.opposition === 'aucune'
    ? issueSansOpposition(donnees)
    : issueAvecOpposition(donnees);

  issue = appliquerChanceEtablie(issue, donnees.chance);

  if (donnees.banaleSansEnjeu && donnees.faisabiliteM06 === 'possible' && donnees.opposition === 'aucune') {
    issue = 'reussite_simple';
    raisons.push('Une action ordinaire, possible et sans opposition réussit normalement.');
  }

  return { issue, raisons };
}

function aCoutNecessaire(evaluationsEffets: EvaluationEffetM14[]): boolean {
  return evaluationsEffets.some((evaluation) =>
    evaluation.admissible &&
    evaluation.transition &&
    Boolean((evaluation as EvaluationEffetM14) && true) &&
    false,
  );
}

function determinerCouts(
  effets: EffetCausalM14[],
  evaluations: EvaluationEffetM14[],
): string[] {
  const admis = new Set(
    evaluations.filter((evaluation) => evaluation.admissible).map((evaluation) => evaluation.effetId),
  );
  return effets
    .filter((effet) => effet.coutNecessaire && admis.has(effet.id))
    .map((effet) => effet.description);
}

function evaluationTentative(
  tentative: TentativeAction,
  donnees: DonneesResolutionM14,
  perimetreM13: PerimetreEffectifM13 | undefined,
): {
  evaluation: EvaluationTentativeM14;
  resolution: ResolutionAction;
  transitionResolution: PropositionTransition<ResolutionAction>;
  effets: EvaluationEffetM14[];
  mysteres: EvaluationMystereM14[];
  risques: EvaluationRisqueM14[];
} {
  const alertes: string[] = [];
  const raisons: string[] = [];

  const risques = (donnees.risques ?? []).map(evaluerRisque);
  const mysteres = (donnees.revelationsProposees ?? []).map((revelation) =>
    evaluerMystere(revelation, donnees.indicesAccessibles ?? []),
  );
  const effets = (donnees.effetsProposes ?? []).map((effet) =>
    evaluerEffet(effet, donnees, perimetreM13),
  );

  const choix = choisirIssue(donnees, risques);
  let issue = choix.issue;
  raisons.push(...choix.raisons);

  const revelationRefusee = mysteres.some((evaluation) => !evaluation.admissible);
  if (donnees.typeAction === 'mystere' && revelationRefusee && issue === 'reussite_simple') {
    issue = 'reussite_partielle';
    raisons.push('L’inspection peut réussir sans révéler une information qui n’est pas accessible.');
  }

  const effetsAdmissibles = effets
    .filter((evaluation) => evaluation.admissible && evaluation.transition)
    .map((evaluation) => evaluation.transition as PropositionTransition);

  const effetsRejetes = effets
    .filter((evaluation) => !evaluation.admissible)
    .flatMap((evaluation) => evaluation.blocages.map((blocage) => `${evaluation.effetId}: ${blocage}`));

  const coutsNecessaires = determinerCouts(donnees.effetsProposes ?? [], effets);
  if (issue === 'reussite_simple' && coutsNecessaires.length) {
    issue = 'reussite_avec_cout_necessaire';
    raisons.push('La réussite implique un coût causal déjà établi ; ce coût n’est pas ajouté pour dramatiser.');
  }

  if ((donnees.effetsProposes ?? []).some((effet) => effet.mortDefinitiveJoueur) && !estMortJoueurAutorisee(perimetreM13)) {
    if (effetsRejetes.some((message) => message.includes('mort définitive'))) {
      alertes.push('Une conséquence mortelle définitive proposée a été rejetée car M13 ne l’autorise pas.');
    }
  }

  if (donnees.chance?.active && !donnees.chance.resultat) {
    alertes.push('La convention de chance est active mais aucun résultat n’est fourni ; M14 n’invente aucun tirage rétroactif.');
  }

  const facteurs = facteursDeBase(tentative, donnees);
  const etatResolution = etatDepuisIssue(issue);
  const resume = resumeIssue(issue, tentative);

  const resolution: ResolutionAction = {
    tentativeId: tentative.id,
    etat: etatResolution,
    resume,
    facteurs,
    effets: effetsAdmissibles,
  };

  const transitionResolution: PropositionTransition<ResolutionAction> = {
    id: `m14:resolution:${tentative.id}`,
    moteurProprietaire: MOTEUR_M14,
    domaine: 'resolution',
    cibleIds: [tentative.id],
    justification: resume,
    sourceIds: uniquesTextes([
      ...(donnees.sourceIds ?? []),
      ...(donnees.chance?.sourceIds ?? []),
      ...tentative.connaissanceAccessible,
    ]),
    valeurProposee: resolution,
    perceptible: true,
    transmissible: false,
  };

  const evaluation: EvaluationTentativeM14 = {
    tentativeId: tentative.id,
    tentativeTrouvee: true,
    issue,
    etatResolution,
    resume,
    facteurs,
    coutsNecessaires,
    effetsAdmissibles,
    effetsRejetes,
    prochainChoixReserve: donnees.choixNouveauApresIssue,
    raisons: uniquesTextes(raisons),
    alertes: uniquesTextes(alertes),
    blocage: choix.blocage,
  };

  return { evaluation, resolution, transitionResolution, effets, mysteres, risques };
}

function evaluationDonneeSansTentative(donnees: DonneesResolutionM14): EvaluationTentativeM14 {
  return {
    tentativeId: donnees.tentativeId,
    tentativeTrouvee: false,
    issue: 'suspendue_information',
    etatResolution: 'a_clarifier',
    resume: `La tentative ${donnees.tentativeId} est introuvable et ne peut pas être résolue.`,
    facteurs: [],
    coutsNecessaires: [],
    effetsAdmissibles: [],
    effetsRejetes: [],
    raisons: ['M14 ne fabrique pas une tentative absente pour compléter la scène.'],
    alertes: [`Données de résolution orphelines pour ${donnees.tentativeId}.`],
    blocage: {
      type: 'information_manquante',
      raison: `La tentative ${donnees.tentativeId} n’existe pas dans les entrées M14.`,
    },
  };
}

function controlesM14(evaluations: EvaluationTentativeM14[]): ControleNarratif[] {
  const causaliteOk = evaluations.every((evaluation) =>
    !evaluation.effetsRejetes.some((message) => message.includes('causal')),
  );
  const agentiviteOk = evaluations.every((evaluation) => evaluation.blocage?.type !== 'agentivite');
  const limitesOk = evaluations.every((evaluation) =>
    !evaluation.effetsRejetes.some((message) => message.includes('mort définitive')),
  );

  return [
    {
      id: 'causalite',
      ok: causaliteOk,
      raison: causaliteOk
        ? 'Les effets retenus possèdent une justification causale.'
        : 'Au moins un effet sans causalité a été rejeté.',
    },
    {
      id: 'agentivite',
      ok: agentiviteOk,
      raison: agentiviteOk
        ? 'M14 résout les tentatives sans inventer l’intention suivante du joueur.'
        : 'Au moins une tentative attend une validation d’intention M07.',
    },
    {
      id: 'limites',
      ok: limitesOk,
      raison: limitesOk
        ? 'Les conséquences retenues respectent le périmètre M13 fourni.'
        : 'Une conséquence incompatible avec M13 a été rejetée.',
    },
  ];
}

function contributionM14(
  evaluations: EvaluationTentativeM14[],
  resolutions: ResolutionAction[],
): ContributionSceneM01 {
  const pointsAMontrer: string[] = [];
  const contraintes: string[] = [];
  const choixReservesAuJoueur: ContributionSceneM01['choixReservesAuJoueur'] = [];

  for (const evaluation of evaluations) {
    if (evaluation.tentativeTrouvee) pointsAMontrer.push(evaluation.resume);
    if (evaluation.blocage) contraintes.push(evaluation.blocage.raison);
    if (evaluation.prochainChoixReserve) {
      choixReservesAuJoueur?.push({
        description: evaluation.prochainChoixReserve,
        raison: 'La résolution s’arrête au premier choix volontaire nouveau.',
      });
    }
  }

  return {
    resolutions,
    contraintes: uniquesTextes(contraintes),
    pointsAMontrer: uniquesTextes(pointsAMontrer),
    choixReservesAuJoueur,
    interditsNarratifs: [
      'Ne pas inventer une complication uniquement pour maintenir la tension.',
      'Ne pas transformer la réussite d’une tentative en décision volontaire suivante du joueur.',
      'Ne pas inventer un outil, une compétence ou une exception physique pour sauver une tentative.',
      'Ne pas convertir une persuasion en contrôle mental, loyauté, attirance ou consentement automatique.',
      'Ne pas révéler une solution de mystère inaccessible au point de vue autorisé.',
      'Ne pas exposer de score, calcul ou tirage interne dans la narration.',
    ],
    controles: controlesM14(evaluations),
  };
}

function premierBlocage(evaluations: EvaluationTentativeM14[]): BlocageNarratif | undefined {
  const priorite: Record<BlocageNarratif['type'], number> = {
    limite: 0,
    agentivite: 1,
    impossibilite: 2,
    information_manquante: 3,
    contradiction: 4,
    autre: 5,
  };

  return evaluations
    .map((evaluation) => evaluation.blocage)
    .filter((blocage): blocage is BlocageNarratif => Boolean(blocage))
    .sort((a, b) => priorite[a.type] - priorite[b.type])[0];
}

/**
 * Point d'entrée de M14.
 *
 * M14 est déterministe : il ne fait aucun appel modèle et ne produit aucun
 * hasard. Les données qualitatives viennent des propriétaires concernés ; M14
 * les arbitre en une issue, puis propose les effets à leurs propriétaires.
 */
export function executerM14(entree: EntreeM14): SortieM14 {
  const evaluations: EvaluationTentativeM14[] = [];
  const resolutions: ResolutionAction[] = [];
  const transitionsResolution: PropositionTransition<ResolutionAction>[] = [];
  const evaluationsEffets: EvaluationEffetM14[] = [];
  const evaluationsMysteres: EvaluationMystereM14[] = [];
  const evaluationsRisques: EvaluationRisqueM14[] = [];
  const alertes: string[] = [];

  const donneesUniques = uniquesParCle(entree.donnees, (donnee) => donnee.tentativeId);
  if (donneesUniques.length !== entree.donnees.length) {
    alertes.push('Des données M14 dupliquées pour une même tentative ont été ignorées après la première occurrence.');
  }

  for (const tentative of uniquesParCle(entree.tentatives, (item) => item.id)) {
    const donnees = donneesPourTentative(donneesUniques, tentative.id);
    if (!donnees) {
      const evaluation: EvaluationTentativeM14 = {
        tentativeId: tentative.id,
        tentativeTrouvee: true,
        issue: 'suspendue_information',
        etatResolution: 'a_clarifier',
        resume: `Aucune donnée de résolution n’est fournie pour la tentative « ${tentative.description} ».` ,
        facteurs: [],
        coutsNecessaires: [],
        effetsAdmissibles: [],
        effetsRejetes: [],
        raisons: ['M14 ne remplace pas des facteurs absents par une issue arbitraire.'],
        alertes: [],
        blocage: {
          type: 'information_manquante',
          raison: `Les facteurs de résolution de ${tentative.id} sont absents.`,
        },
      };
      evaluations.push(evaluation);
      continue;
    }

    const traite = evaluationTentative(tentative, donnees, entree.perimetreM13);
    evaluations.push(traite.evaluation);
    resolutions.push(traite.resolution);
    transitionsResolution.push(traite.transitionResolution);
    evaluationsEffets.push(...traite.effets);
    evaluationsMysteres.push(...traite.mysteres);
    evaluationsRisques.push(...traite.risques);
    alertes.push(...traite.evaluation.alertes);
  }

  for (const donnees of donneesUniques) {
    if (tentativeParId(entree.tentatives, donnees.tentativeId)) continue;
    const evaluation = evaluationDonneeSansTentative(donnees);
    evaluations.push(evaluation);
    alertes.push(...evaluation.alertes);
  }

  const contribution = contributionM14(evaluations, resolutions);
  const transitionsEffets = evaluationsEffets
    .filter((evaluation) => evaluation.admissible && evaluation.transition)
    .map((evaluation) => evaluation.transition as PropositionTransition);

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M14,
    contribution,
    transitions: [...transitionsResolution, ...transitionsEffets],
    contraintes: uniquesTextes([
      'Une action ordinaire possible ne reçoit pas de complication artificielle.',
      'Une issue contestée suit les moyens, la préparation, le contexte et l’opposition établis.',
      'Les effets spécialisés sont proposés à leurs moteurs propriétaires avant canonisation.',
      ...evaluations.flatMap((evaluation) => evaluation.blocage ? [evaluation.blocage.raison] : []),
    ]),
    alertes: uniquesTextes([
      ...alertes,
      ...evaluationsEffets.flatMap((evaluation) => evaluation.blocages),
      ...evaluationsMysteres.flatMap((evaluation) => evaluation.blocages),
    ]),
    blocage: premierBlocage(evaluations),
  };

  return {
    moteur: MOTEUR_M14,
    resultat,
    evaluations,
    resolutions,
    transitionsResolution,
    evaluationsEffets,
    evaluationsMysteres,
    evaluationsRisques,
    alertes: resultat.alertes,
  };
}
