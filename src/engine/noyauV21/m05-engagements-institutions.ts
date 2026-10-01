// Elyndor — Noyau narratif natif V2.1
// M05 — Engagements et institutions.
//
// M05 possède le sens des obligations et de la logique institutionnelle :
// termes, acceptation, état d'un engagement, reconnaissance, procédures et
// réactions possibles d'une organisation. Il ne diffuse pas l'information,
// ne fabrique pas la connaissance d'un incident et ne convertit pas seul une
// conséquence en réputation : M15, M02, M04 et M14 restent propriétaires de
// ces domaines.

import type { ContributionSceneM01 } from './m01-production';
import type {
  ConnaissanceSituee,
  ContexteNarratifV21,
  ControleNarratif,
  EngagementNarratif,
  EtatEngagement,
  InstitutionNarrative,
  PropositionTransition,
  ResolutionAction,
  ResultatMoteur,
  SourceNarrative,
} from './types';

export const MOTEUR_M05 = 'M05' as const;

export type NatureEngagementM05 =
  | 'contrat'
  | 'promesse'
  | 'dette'
  | 'serment'
  | 'transaction'
  | 'ordre'
  | 'accord'
  | 'autre';

export type DecisionAcceptationM05 = 'accepte' | 'refuse' | 'ambigu';

export type TypeReactionInstitutionnelleM05 =
  | 'enquete'
  | 'avertissement'
  | 'mediation'
  | 'renegociation'
  | 'retrait_service'
  | 'arbitrage'
  | 'sanction'
  | 'action_directe'
  | 'attente'
  | 'autre';

export type StatutReactionInstitutionnelleM05 =
  | 'impossible'
  | 'possible'
  | 'engagee';

export interface SignalAcceptationM05 {
  acteurId: string;
  decision: DecisionAcceptationM05;
  explicite: boolean;
  sourceIds: string[];
}

export interface PropositionAccordM05 {
  id: string;
  nature: NatureEngagementM05;
  parties: string[];
  termes: string[];
  partiesRequisesPourAcceptation?: string[];
  acceptations?: SignalAcceptationM05[];
  echeance?: string;
  preuvesAttendues?: string[];
  contrepartie?: string;
  conditionsSortie?: string[];
  sourceIds: string[];
}

export interface EvaluationAccordM05 {
  propositionId: string;
  applicable: boolean;
  etatInitial?: EtatEngagement;
  acceptePar: string[];
  raisons: string[];
  blocages: string[];
}

export interface CreationEngagementM05 {
  propositionId: string;
  nature: NatureEngagementM05;
  engagement: EngagementNarratif;
  justification: string;
}

export interface DemandeTransitionEngagementM05 {
  id: string;
  engagementId: string;
  vers: EtatEngagement;
  justification: string;
  sourceIds: string[];

  /** Acceptations supplémentaires explicitement établies depuis la dernière version. */
  acceptationsSupplementaires?: SignalAcceptationM05[];

  /** Référence à une issue déjà établie par M14 lorsque la transition dépend d'une exécution. */
  resolutionId?: string;
  executionConformeAuxTermes?: boolean;
  termesSatisfaits?: string[];
  preuvesFournies?: string[];

  /** Conditions explicites pour les transitions qui ne peuvent pas être inférées du temps seul. */
  ruptureEtablie?: boolean;
  echeanceAtteinte?: boolean;
  annulationAutorisee?: boolean;
  suspensionEtablie?: boolean;
  contestationEtablie?: boolean;
}

export interface EvaluationTransitionEngagementM05 {
  demandeId: string;
  engagementId: string;
  de: EtatEngagement;
  vers: EtatEngagement;
  applicable: boolean;
  resolutionId?: string;
  raisons: string[];
  blocages: string[];
}

export interface TransitionEngagementM05 {
  id: string;
  engagementId: string;
  de: EtatEngagement;
  vers: EtatEngagement;
  valeurProposee: EngagementNarratif;
  justification: string;
  sourceIds: string[];
}

export interface DemandeReconnaissanceM05 {
  id: string;
  engagementId: string;
  acteurId: string;
  decision: 'reconnait' | 'conteste' | 'refuse';
  affirmationId?: string;
  perceptionDirecteEtablie?: boolean;
  sourceIds: string[];
}

export interface EvaluationReconnaissanceM05 {
  demandeId: string;
  engagementId: string;
  acteurId: string;
  applicable: boolean;
  decision: DemandeReconnaissanceM05['decision'];
  raisons: string[];
  blocages: string[];
}

export interface ReconnaissanceEngagementM05 {
  id: string;
  engagementId: string;
  acteurId: string;
  decision: DemandeReconnaissanceM05['decision'];
  valeurProposee: EngagementNarratif;
  justification: string;
  sourceIds: string[];
}

export interface CandidatReactionInstitutionnelleM05 {
  id: string;
  institutionId: string;
  type: TypeReactionInstitutionnelleM05;
  cibleIds: string[];
  description: string;
  justification: string;

  /** L'institution doit avoir reçu l'affirmation via M15, sauf constat direct établi. */
  affirmationId?: string;
  constatDirectEtabli?: boolean;

  /** Ces booléens doivent provenir des règles et du monde applicables, pas d'une invention de M05. */
  mandatApplicable: boolean;
  procedureEtablie: boolean;
  preuveRequise?: boolean;
  preuveSuffisante?: boolean;

  moyensRequis?: string[];
  moyensDisponiblesEtablis?: string[];
  delai?: string;
  engagerMaintenant?: boolean;
  sourceIds: string[];
}

export interface EvaluationReactionInstitutionnelleM05 {
  candidatId: string;
  institutionId: string;
  statut: StatutReactionInstitutionnelleM05;
  raisons: string[];
  blocages: string[];
}

export interface ReactionInstitutionnelleM05 {
  id: string;
  institutionId: string;
  type: TypeReactionInstitutionnelleM05;
  cibleIds: string[];
  description: string;
  statut: Exclude<StatutReactionInstitutionnelleM05, 'impossible'>;
  justification: string;
  sourceIds: string[];
  delai?: string;
}

export interface CandidatProgressionInstitutionnelleM05 {
  id: string;
  institutionId: string;
  personnageId: string;
  progression: string;
  conditionsRequises: string[];
  conditionsSatisfaites: string[];
  decisionInstitutionnelleEtablie: boolean;
  exceptionInstitutionnelleEtablie?: boolean;
  justificationException?: string;
  sourceIds: string[];
}

export interface EvaluationProgressionInstitutionnelleM05 {
  candidatId: string;
  institutionId: string;
  personnageId: string;
  applicable: boolean;
  progression: string;
  conditionsManquantes: string[];
  raisons: string[];
  blocages: string[];
}

export interface ProgressionInstitutionnelleM05 {
  id: string;
  institutionId: string;
  personnageId: string;
  progression: string;
  justification: string;
  sourceIds: string[];
}

export interface ConflitObligationsM05 {
  id: string;
  engagementIds: string[];
  description: string;
  personnageJoueurConcerne?: boolean;
  optionsConnues?: string[];
  sourceIds: string[];
}

export interface EntreeM05 {
  contexte: ContexteNarratifV21;
  propositionsAccord?: PropositionAccordM05[];
  transitionsEngagement?: DemandeTransitionEngagementM05[];
  reconnaissances?: DemandeReconnaissanceM05[];
  reactionsInstitutionnelles?: CandidatReactionInstitutionnelleM05[];
  progressionsInstitutionnelles?: CandidatProgressionInstitutionnelleM05[];
  conflitsObligations?: ConflitObligationsM05[];
  personnageJoueurId?: string;
}

export interface SortieM05 {
  moteur: typeof MOTEUR_M05;
  resultat: ResultatMoteur<ContributionSceneM01>;
  evaluationsAccords: EvaluationAccordM05[];
  engagementsCrees: CreationEngagementM05[];
  evaluationsTransitions: EvaluationTransitionEngagementM05[];
  transitionsEngagements: TransitionEngagementM05[];
  evaluationsReconnaissances: EvaluationReconnaissanceM05[];
  reconnaissances: ReconnaissanceEngagementM05[];
  evaluationsInstitutions: EvaluationReactionInstitutionnelleM05[];
  reactionsInstitutionnelles: ReactionInstitutionnelleM05[];
  evaluationsProgressions: EvaluationProgressionInstitutionnelleM05[];
  progressions: ProgressionInstitutionnelleM05[];
  conflitsObligations: ConflitObligationsM05[];
  alertes: string[];
}

const TRANSITIONS_AUTORISEES: Record<EtatEngagement, ReadonlySet<EtatEngagement>> = {
  propose: new Set<EtatEngagement>(['accepte', 'annule', 'expire', 'conteste']),
  accepte: new Set<EtatEngagement>(['en_cours', 'annule', 'expire', 'suspendu', 'conteste']),
  en_cours: new Set<EtatEngagement>(['accompli', 'rompu', 'expire', 'annule', 'suspendu', 'conteste']),
  accompli: new Set<EtatEngagement>(['conteste']),
  rompu: new Set<EtatEngagement>(['conteste']),
  expire: new Set<EtatEngagement>(['conteste']),
  annule: new Set<EtatEngagement>(['conteste']),
  conteste: new Set<EtatEngagement>(['en_cours', 'accompli', 'rompu', 'expire', 'annule', 'suspendu']),
  suspendu: new Set<EtatEngagement>(['en_cours', 'rompu', 'expire', 'annule', 'conteste']),
};

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

function contientEquivalent(collection: string[], valeur: string): boolean {
  const cible = normaliser(valeur);
  if (!cible) return false;
  return collection.some((element) => normaliser(element) === cible);
}

function tousPresents(attendus: string[], disponibles: string[]): string[] {
  return attendus.filter((attendu) => !contientEquivalent(disponibles, attendu));
}

function engagementParId(
  contexte: ContexteNarratifV21,
  engagementId: string,
): EngagementNarratif | undefined {
  return contexte.engagements.find((engagement) => engagement.id === engagementId);
}

function institutionParId(
  contexte: ContexteNarratifV21,
  institutionId: string,
): InstitutionNarrative | undefined {
  return contexte.institutions.find((institution) => institution.id === institutionId);
}

function resolutionParId(
  contexte: ContexteNarratifV21,
  resolutionId: string | undefined,
): ResolutionAction | undefined {
  if (!resolutionId) return undefined;
  return contexte.resultatsDejaEtablis.find(
    (resolution) => resolution.tentativeId === resolutionId,
  );
}

function connaissanceDisponible(
  connaissances: ConnaissanceSituee[],
  acteurId: string,
  affirmationId: string | undefined,
): ConnaissanceSituee | undefined {
  if (!affirmationId) return undefined;
  return connaissances.find(
    (connaissance) =>
      connaissance.acteurId === acteurId &&
      connaissance.affirmationId === affirmationId &&
      connaissance.statut !== 'inconnu',
  );
}

function sourceTechnique(id: string): SourceNarrative {
  return {
    id,
    type: 'autre',
    description: 'Référence technique M05 à relier à une provenance narrative établie.',
  };
}

function sourcesDepuisIds(ids: string[]): SourceNarrative[] {
  return uniquesTextes(ids).map(sourceTechnique);
}

function partiesRequises(proposition: PropositionAccordM05): string[] {
  const requises = proposition.partiesRequisesPourAcceptation?.length
    ? proposition.partiesRequisesPourAcceptation
    : proposition.parties;
  return uniquesTextes(requises);
}

function acceptationsExplicites(
  signaux: SignalAcceptationM05[] | undefined,
): SignalAcceptationM05[] {
  return (signaux ?? []).filter(
    (signal) => signal.explicite && signal.decision === 'accepte',
  );
}

function refusExplicites(
  signaux: SignalAcceptationM05[] | undefined,
): SignalAcceptationM05[] {
  return (signaux ?? []).filter(
    (signal) => signal.explicite && signal.decision === 'refuse',
  );
}

function evaluerAccord(proposition: PropositionAccordM05): EvaluationAccordM05 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  const parties = uniquesTextes(proposition.parties);
  const termes = uniquesTextes(proposition.termes);
  const requises = partiesRequises(proposition);
  const acceptes = uniquesTextes(
    acceptationsExplicites(proposition.acceptations).map((signal) => signal.acteurId),
  );
  const refuses = refusExplicites(proposition.acceptations);

  if (!propre(proposition.id)) blocages.push("Identifiant d'accord absent.");
  if (parties.length < 2) blocages.push('Un engagement doit identifier au moins deux parties ou rôles distincts.');
  if (termes.length === 0) blocages.push('Aucun terme explicite : M05 ne fabrique pas une obligation à partir d’une formule vague.');

  for (const partie of requises) {
    if (!contientEquivalent(parties, partie)) {
      blocages.push(`Partie requise pour acceptation absente de l’accord : ${partie}.`);
    }
  }

  for (const signal of proposition.acceptations ?? []) {
    if (!contientEquivalent(parties, signal.acteurId)) {
      blocages.push(`Signal d’acceptation attribué à une personne extérieure à l’accord : ${signal.acteurId}.`);
    }
    if (!signal.explicite && signal.decision === 'accepte') {
      blocages.push(`Acceptation de ${signal.acteurId} non explicite : une proposition ou une formule polie ne vaut pas accord.`);
    }
  }

  if (refuses.length > 0) {
    blocages.push(
      `Refus explicite de ${uniquesTextes(refuses.map((signal) => signal.acteurId)).join(', ')} : l’accord ne peut pas être canonisé comme accepté.`,
    );
  }

  const manquantes = requises.filter(
    (partie) => !contientEquivalent(acceptes, partie),
  );

  let etatInitial: EtatEngagement = 'propose';
  if (manquantes.length === 0 && requises.length > 0) {
    etatInitial = 'accepte';
    raisons.push('Toutes les parties requises ont une acceptation explicite établie.');
  } else {
    raisons.push(
      manquantes.length > 0
        ? `Acceptations encore manquantes : ${manquantes.join(', ')}.`
        : 'Accord conservé comme proposition faute de condition d’acceptation suffisante.',
    );
  }

  return {
    propositionId: proposition.id,
    applicable: blocages.length === 0,
    etatInitial,
    acceptePar: acceptes,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function creerEngagement(
  proposition: PropositionAccordM05,
  evaluation: EvaluationAccordM05,
): CreationEngagementM05 | undefined {
  if (!evaluation.applicable || !evaluation.etatInitial) return undefined;

  const engagement: EngagementNarratif = {
    id: proposition.id,
    parties: uniquesTextes(proposition.parties),
    termes: uniquesTextes(proposition.termes),
    etat: evaluation.etatInitial,
    acceptePar: evaluation.acceptePar,
    echeance: propre(proposition.echeance) || undefined,
    preuvesAttendues: uniquesTextes(proposition.preuvesAttendues ?? []),
    reconnaissancePar: [],
    contrepartie: propre(proposition.contrepartie) || undefined,
    conditionsSortie: uniquesTextes(proposition.conditionsSortie ?? []),
    sources: sourcesDepuisIds(proposition.sourceIds),
  };

  return {
    propositionId: proposition.id,
    nature: proposition.nature,
    engagement,
    justification:
      evaluation.etatInitial === 'accepte'
        ? 'Accord créé avec les termes fournis et des acceptations explicites suffisantes.'
        : 'Proposition conservée sans transformer l’absence d’acceptation en promesse ferme.',
  };
}

function acceptationsValidesSupplementaires(
  engagement: EngagementNarratif,
  signaux: SignalAcceptationM05[] | undefined,
): { acceptes: string[]; blocages: string[] } {
  const acceptes = [...engagement.acceptePar];
  const blocages: string[] = [];

  for (const signal of signaux ?? []) {
    if (!contientEquivalent(engagement.parties, signal.acteurId)) {
      blocages.push(`Acceptation supplémentaire attribuée à une partie inconnue : ${signal.acteurId}.`);
      continue;
    }
    if (!signal.explicite || signal.decision !== 'accepte') {
      blocages.push(`Le signal de ${signal.acteurId} n’établit pas une acceptation explicite.`);
      continue;
    }
    if (!contientEquivalent(acceptes, signal.acteurId)) acceptes.push(signal.acteurId);
  }

  return { acceptes: uniquesTextes(acceptes), blocages: uniquesTextes(blocages) };
}

function verifierPreuvesAttendues(
  engagement: EngagementNarratif,
  preuvesFournies: string[] | undefined,
): string[] {
  return tousPresents(
    engagement.preuvesAttendues ?? [],
    uniquesTextes(preuvesFournies ?? []),
  );
}

function evaluerTransition(
  entree: EntreeM05,
  demande: DemandeTransitionEngagementM05,
): EvaluationTransitionEngagementM05 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  const engagement = engagementParId(entree.contexte, demande.engagementId);

  if (!engagement) {
    return {
      demandeId: demande.id,
      engagementId: demande.engagementId,
      de: 'propose',
      vers: demande.vers,
      applicable: false,
      resolutionId: demande.resolutionId,
      raisons: [],
      blocages: [`Engagement ${demande.engagementId} introuvable.`],
    };
  }

  if (!TRANSITIONS_AUTORISEES[engagement.etat].has(demande.vers)) {
    blocages.push(`Transition ${engagement.etat} → ${demande.vers} non admise sans événement intermédiaire explicite.`);
  }

  const supplement = acceptationsValidesSupplementaires(
    engagement,
    demande.acceptationsSupplementaires,
  );
  blocages.push(...supplement.blocages);

  if (demande.vers === 'accepte') {
    const manquantes = engagement.parties.filter(
      (partie) => !contientEquivalent(supplement.acceptes, partie),
    );
    if (manquantes.length > 0) {
      blocages.push(`Acceptations explicites manquantes : ${manquantes.join(', ')}.`);
    } else {
      raisons.push('Toutes les parties de l’engagement ont une acceptation explicite établie.');
    }
  }

  if (demande.vers === 'accompli') {
    const resolution = resolutionParId(entree.contexte, demande.resolutionId);
    if (!resolution) {
      blocages.push('Accomplissement demandé sans résultat M14 déjà établi.');
    } else if (
      resolution.etat !== 'reussite' &&
      resolution.etat !== 'reussite_partielle'
    ) {
      blocages.push(`Le résultat M14 ${resolution.etat} n’établit pas l’accomplissement demandé.`);
    } else {
      raisons.push(`Résultat M14 disponible pour la tentative ${resolution.tentativeId}.`);
    }

    if (demande.executionConformeAuxTermes !== true) {
      blocages.push('La conformité de l’exécution aux termes n’est pas établie.');
    }

    const termesManquants = tousPresents(
      engagement.termes,
      uniquesTextes(demande.termesSatisfaits ?? []),
    );
    if (termesManquants.length > 0) {
      blocages.push(`Termes non établis comme satisfaits : ${termesManquants.join(' ; ')}.`);
    }

    const preuvesManquantes = verifierPreuvesAttendues(
      engagement,
      demande.preuvesFournies,
    );
    if (preuvesManquantes.length > 0) {
      blocages.push(`Preuves attendues manquantes : ${preuvesManquantes.join(', ')}.`);
    }
  }

  if (demande.vers === 'rompu' && demande.ruptureEtablie !== true) {
    blocages.push('Rupture demandée sans événement ou constat de rupture établi.');
  }

  if (demande.vers === 'expire' && demande.echeanceAtteinte !== true) {
    blocages.push('Expiration demandée sans échéance effectivement atteinte.');
  }

  if (demande.vers === 'annule' && demande.annulationAutorisee !== true) {
    blocages.push('Annulation demandée sans condition de sortie ou autorisation établie.');
  }

  if (demande.vers === 'suspendu' && demande.suspensionEtablie !== true) {
    blocages.push('Suspension demandée sans motif de suspension établi.');
  }

  if (demande.vers === 'conteste' && demande.contestationEtablie !== true) {
    blocages.push('Contestation demandée sans contestation effectivement établie.');
  }

  if (!propre(demande.justification)) {
    blocages.push('Transition sans justification causale.');
  }
  if (demande.sourceIds.length === 0) {
    blocages.push('Transition sans provenance : M05 ne modifie pas un engagement sans source.');
  }

  return {
    demandeId: demande.id,
    engagementId: demande.engagementId,
    de: engagement.etat,
    vers: demande.vers,
    applicable: blocages.length === 0,
    resolutionId: demande.resolutionId,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function construireTransition(
  entree: EntreeM05,
  demande: DemandeTransitionEngagementM05,
  evaluation: EvaluationTransitionEngagementM05,
): TransitionEngagementM05 | undefined {
  if (!evaluation.applicable) return undefined;
  const engagement = engagementParId(entree.contexte, demande.engagementId);
  if (!engagement) return undefined;

  const supplement = acceptationsValidesSupplementaires(
    engagement,
    demande.acceptationsSupplementaires,
  );

  const valeurProposee: EngagementNarratif = {
    ...engagement,
    etat: demande.vers,
    acceptePar: supplement.acceptes,
    sources: uniquesParCle(
      [...engagement.sources, ...sourcesDepuisIds(demande.sourceIds)],
      (source) => source.id,
    ),
  };

  return {
    id: `m05:engagement:${demande.id}`,
    engagementId: engagement.id,
    de: engagement.etat,
    vers: demande.vers,
    valeurProposee,
    justification: demande.justification,
    sourceIds: uniquesTextes(demande.sourceIds),
  };
}

function evaluerReconnaissance(
  entree: EntreeM05,
  demande: DemandeReconnaissanceM05,
): EvaluationReconnaissanceM05 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  const engagement = engagementParId(entree.contexte, demande.engagementId);

  if (!engagement) blocages.push(`Engagement ${demande.engagementId} introuvable.`);
  if (engagement && !contientEquivalent(engagement.parties, demande.acteurId)) {
    raisons.push('La reconnaissance provient d’un acteur extérieur aux parties ; elle ne vaut pas acceptation contractuelle.');
  }

  const connaissance = connaissanceDisponible(
    entree.contexte.connaissances,
    demande.acteurId,
    demande.affirmationId,
  );

  if (demande.perceptionDirecteEtablie) {
    raisons.push('Connaissance directe de l’exécution explicitement établie.');
  } else if (connaissance) {
    raisons.push(`Information reçue via M15 : ${connaissance.affirmationId}.`);
  } else {
    blocages.push('Reconnaissance impossible à établir : aucune perception directe ni connaissance M15 disponible.');
  }

  if (demande.sourceIds.length === 0) {
    blocages.push('Reconnaissance sans provenance établie.');
  }

  return {
    demandeId: demande.id,
    engagementId: demande.engagementId,
    acteurId: demande.acteurId,
    applicable: blocages.length === 0,
    decision: demande.decision,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function construireReconnaissance(
  entree: EntreeM05,
  demande: DemandeReconnaissanceM05,
  evaluation: EvaluationReconnaissanceM05,
): ReconnaissanceEngagementM05 | undefined {
  if (!evaluation.applicable) return undefined;
  const engagement = engagementParId(entree.contexte, demande.engagementId);
  if (!engagement) return undefined;

  const deja = engagement.reconnaissancePar ?? [];
  const reconnaissancePar =
    demande.decision === 'reconnait'
      ? uniquesTextes([...deja, demande.acteurId])
      : deja.filter((acteurId) => acteurId !== demande.acteurId);

  return {
    id: `m05:reconnaissance:${demande.id}`,
    engagementId: engagement.id,
    acteurId: demande.acteurId,
    decision: demande.decision,
    valeurProposee: {
      ...engagement,
      reconnaissancePar,
      sources: uniquesParCle(
        [...engagement.sources, ...sourcesDepuisIds(demande.sourceIds)],
        (source) => source.id,
      ),
    },
    justification:
      demande.decision === 'reconnait'
        ? 'Reconnaissance ajoutée après réception ou perception établie de l’exécution.'
        : demande.decision === 'conteste'
          ? 'Reconnaissance retirée ou non accordée : l’acteur conteste l’exécution sans effacer le fait matériel.'
          : 'Reconnaissance refusée sans réécrire l’exécution déjà établie.',
    sourceIds: uniquesTextes(demande.sourceIds),
  };
}

function moyensDisponibles(
  institution: InstitutionNarrative,
  candidat: CandidatReactionInstitutionnelleM05,
): string[] {
  return uniquesTextes([
    ...institution.moyens,
    ...(candidat.moyensDisponiblesEtablis ?? []),
  ]);
}

function evaluerReactionInstitutionnelle(
  entree: EntreeM05,
  candidat: CandidatReactionInstitutionnelleM05,
): EvaluationReactionInstitutionnelleM05 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  const institution = institutionParId(entree.contexte, candidat.institutionId);

  if (!institution) {
    blocages.push(`Institution ${candidat.institutionId} introuvable.`);
  }

  const connaissance = connaissanceDisponible(
    entree.contexte.connaissances,
    candidat.institutionId,
    candidat.affirmationId,
  );

  if (candidat.constatDirectEtabli) {
    raisons.push('Incident directement constaté par l’institution.');
  } else if (connaissance) {
    raisons.push(`Information disponible via M15 : ${connaissance.affirmationId}.`);
  } else {
    blocages.push('L’institution n’a pas de connaissance établie de l’incident.');
  }

  if (!candidat.mandatApplicable) {
    blocages.push('Mandat institutionnel non applicable à cet incident ou à cette cible.');
  } else {
    raisons.push('Mandat applicable explicitement établi.');
  }

  if (!candidat.procedureEtablie) {
    blocages.push('Procédure proposée non établie par les règles ou pratiques de cette institution.');
  } else {
    raisons.push('Procédure institutionnelle établie.');
  }

  if (candidat.preuveRequise && candidat.preuveSuffisante !== true) {
    blocages.push('La procédure exige une preuve qui n’est pas établie comme suffisante.');
  }

  if (institution) {
    const manquants = tousPresents(
      candidat.moyensRequis ?? [],
      moyensDisponibles(institution, candidat),
    );
    if (manquants.length > 0) {
      blocages.push(`Moyens institutionnels manquants : ${manquants.join(', ')}.`);
    }
  }

  if (!propre(candidat.description)) blocages.push('Réaction institutionnelle sans description concrète.');
  if (!propre(candidat.justification)) blocages.push('Réaction institutionnelle sans justification.');
  if (candidat.sourceIds.length === 0) blocages.push('Réaction institutionnelle sans provenance.');

  const statut: StatutReactionInstitutionnelleM05 =
    blocages.length > 0
      ? 'impossible'
      : candidat.engagerMaintenant
        ? 'engagee'
        : 'possible';

  return {
    candidatId: candidat.id,
    institutionId: candidat.institutionId,
    statut,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function construireReactionInstitutionnelle(
  candidat: CandidatReactionInstitutionnelleM05,
  evaluation: EvaluationReactionInstitutionnelleM05,
): ReactionInstitutionnelleM05 | undefined {
  if (evaluation.statut === 'impossible') return undefined;

  return {
    id: `m05:institution:${candidat.id}`,
    institutionId: candidat.institutionId,
    type: candidat.type,
    cibleIds: uniquesTextes(candidat.cibleIds),
    description: candidat.description,
    statut: evaluation.statut,
    justification: candidat.justification,
    sourceIds: uniquesTextes(candidat.sourceIds),
    delai: propre(candidat.delai) || undefined,
  };
}

function evaluerProgression(
  entree: EntreeM05,
  candidat: CandidatProgressionInstitutionnelleM05,
): EvaluationProgressionInstitutionnelleM05 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  const institution = institutionParId(entree.contexte, candidat.institutionId);

  if (!institution) blocages.push(`Institution ${candidat.institutionId} introuvable.`);
  if (!entree.contexte.personnages.some((personnage) => personnage.id === candidat.personnageId)) {
    blocages.push(`Personnage ${candidat.personnageId} introuvable.`);
  }

  const conditionsManquantes = tousPresents(
    candidat.conditionsRequises,
    candidat.conditionsSatisfaites,
  );

  if (conditionsManquantes.length > 0 && !candidat.exceptionInstitutionnelleEtablie) {
    blocages.push(`Conditions institutionnelles manquantes : ${conditionsManquantes.join(', ')}.`);
  } else if (conditionsManquantes.length > 0) {
    if (!propre(candidat.justificationException)) {
      blocages.push('Exception institutionnelle annoncée sans justification établie.');
    } else {
      raisons.push(`Exception institutionnelle établie : ${candidat.justificationException}.`);
    }
  } else {
    raisons.push('Toutes les conditions institutionnelles déclarées sont satisfaites.');
  }

  if (!candidat.decisionInstitutionnelleEtablie) {
    blocages.push('Aucune décision institutionnelle établie : l’éligibilité ne vaut pas nomination automatique.');
  }
  if (!propre(candidat.progression)) blocages.push('Progression ou nomination non décrite.');
  if (candidat.sourceIds.length === 0) blocages.push('Progression sans provenance.');

  return {
    candidatId: candidat.id,
    institutionId: candidat.institutionId,
    personnageId: candidat.personnageId,
    applicable: blocages.length === 0,
    progression: candidat.progression,
    conditionsManquantes,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function construireProgression(
  candidat: CandidatProgressionInstitutionnelleM05,
  evaluation: EvaluationProgressionInstitutionnelleM05,
): ProgressionInstitutionnelleM05 | undefined {
  if (!evaluation.applicable) return undefined;

  return {
    id: `m05:progression:${candidat.id}`,
    institutionId: candidat.institutionId,
    personnageId: candidat.personnageId,
    progression: candidat.progression,
    justification:
      candidat.exceptionInstitutionnelleEtablie && propre(candidat.justificationException)
        ? candidat.justificationException as string
        : 'Conditions et décision institutionnelles établies.',
    sourceIds: uniquesTextes(candidat.sourceIds),
  };
}

function creationVersProposition(
  creation: CreationEngagementM05,
): PropositionTransition<EngagementNarratif> {
  return {
    id: `m05:creation:${creation.propositionId}`,
    moteurProprietaire: MOTEUR_M05,
    domaine: 'engagement',
    categorie: 'contractuelle',
    cibleIds: creation.engagement.parties,
    justification: creation.justification,
    sourceIds: creation.engagement.sources.map((source) => source.id),
    valeurProposee: creation.engagement,
    perceptible: true,
    transmissible: true,
  };
}

function transitionVersProposition(
  transition: TransitionEngagementM05,
): PropositionTransition<EngagementNarratif> {
  return {
    id: transition.id,
    moteurProprietaire: MOTEUR_M05,
    domaine: 'engagement',
    categorie: 'contractuelle',
    cibleIds: transition.valeurProposee.parties,
    justification: transition.justification,
    sourceIds: transition.sourceIds,
    valeurProposee: transition.valeurProposee,
    perceptible: true,
    transmissible: true,
  };
}

function reconnaissanceVersProposition(
  reconnaissance: ReconnaissanceEngagementM05,
): PropositionTransition<EngagementNarratif> {
  return {
    id: reconnaissance.id,
    moteurProprietaire: MOTEUR_M05,
    domaine: 'engagement',
    categorie: 'contractuelle',
    cibleIds: [reconnaissance.acteurId, ...reconnaissance.valeurProposee.parties],
    justification: reconnaissance.justification,
    sourceIds: reconnaissance.sourceIds,
    valeurProposee: reconnaissance.valeurProposee,
    perceptible: true,
    transmissible: false,
  };
}

function reactionVersProposition(
  reaction: ReactionInstitutionnelleM05,
): PropositionTransition<ReactionInstitutionnelleM05> | undefined {
  if (reaction.statut !== 'engagee') return undefined;

  return {
    id: reaction.id,
    moteurProprietaire: MOTEUR_M05,
    domaine: 'institution',
    categorie: 'institutionnelle',
    cibleIds: [reaction.institutionId, ...reaction.cibleIds],
    justification: reaction.justification,
    sourceIds: reaction.sourceIds,
    valeurProposee: reaction,
    perceptible: true,
    transmissible: true,
  };
}

function progressionVersProposition(
  progression: ProgressionInstitutionnelleM05,
): PropositionTransition<ProgressionInstitutionnelleM05> {
  return {
    id: progression.id,
    moteurProprietaire: MOTEUR_M05,
    domaine: 'institution',
    categorie: 'institutionnelle',
    cibleIds: [progression.institutionId, progression.personnageId],
    justification: progression.justification,
    sourceIds: progression.sourceIds,
    valeurProposee: progression,
    perceptible: true,
    transmissible: true,
  };
}

function controlesM05(
  evaluationsAccords: EvaluationAccordM05[],
  evaluationsTransitions: EvaluationTransitionEngagementM05[],
  evaluationsReconnaissances: EvaluationReconnaissanceM05[],
  evaluationsInstitutions: EvaluationReactionInstitutionnelleM05[],
  evaluationsProgressions: EvaluationProgressionInstitutionnelleM05[],
): ControleNarratif[] {
  const accordInvalide = evaluationsAccords.some((evaluation) => !evaluation.applicable);
  const transitionInvalide = evaluationsTransitions.some((evaluation) => !evaluation.applicable);
  const reconnaissanceInvalide = evaluationsReconnaissances.some((evaluation) => !evaluation.applicable);
  const institutionInvalide = evaluationsInstitutions.some((evaluation) => evaluation.statut === 'impossible');
  const progressionInvalide = evaluationsProgressions.some((evaluation) => !evaluation.applicable);

  return [
    {
      id: 'engagement',
      ok: !accordInvalide && !transitionInvalide && !reconnaissanceInvalide,
      raison:
        accordInvalide || transitionInvalide || reconnaissanceInvalide
          ? 'Au moins une obligation, transition ou reconnaissance demandée ne possède pas les conditions suffisantes.'
          : 'Les engagements reposent sur des termes, acceptations et transitions explicitement établis.',
    },
    {
      id: 'savoir',
      ok: !reconnaissanceInvalide && !institutionInvalide,
      raison:
        reconnaissanceInvalide || institutionInvalide
          ? 'Une reconnaissance ou réaction institutionnelle manque de connaissance ou de provenance.'
          : 'M05 ne suppose ni connaissance du donneur d’ordre ni omniscience institutionnelle.',
    },
    {
      id: 'causalite',
      ok: !transitionInvalide && !institutionInvalide && !progressionInvalide,
      raison:
        transitionInvalide || institutionInvalide || progressionInvalide
          ? 'Une transition, réaction ou progression ne satisfait pas ses conditions causales déclarées.'
          : 'Résultats, procédures, moyens et conditions institutionnelles restent distincts et vérifiables.',
    },
    {
      id: 'agentivite',
      ok: !accordInvalide,
      raison: accordInvalide
        ? 'Une proposition tente de devenir un engagement sans acceptation explicite suffisante.'
        : 'Une proposition ne vaut pas acceptation et aucun choix contractuel du joueur n’est inventé.',
    },
  ];
}

function pointsAMontrerM05(
  creations: CreationEngagementM05[],
  transitions: TransitionEngagementM05[],
  reconnaissances: ReconnaissanceEngagementM05[],
  reactions: ReactionInstitutionnelleM05[],
  progressions: ProgressionInstitutionnelleM05[],
  conflits: ConflitObligationsM05[],
): string[] {
  return uniquesTextes([
    ...creations.map((creation) =>
      creation.engagement.etat === 'accepte'
        ? `Accord ${creation.engagement.id} accepté selon les termes établis.`
        : `Accord ${creation.engagement.id} reste une proposition en attente d’acceptation explicite.`,
    ),
    ...transitions.map(
      (transition) =>
        `Engagement ${transition.engagementId} : ${transition.de} → ${transition.vers}.`,
    ),
    ...reconnaissances.map((reconnaissance) =>
      reconnaissance.decision === 'reconnait'
        ? `${reconnaissance.acteurId} reconnaît l’exécution liée à ${reconnaissance.engagementId}.`
        : `${reconnaissance.acteurId} ${reconnaissance.decision === 'conteste' ? 'conteste' : 'refuse de reconnaître'} l’exécution liée à ${reconnaissance.engagementId}.`,
    ),
    ...reactions
      .filter((reaction) => reaction.statut === 'engagee')
      .map((reaction) => `${reaction.institutionId} engage : ${reaction.description}`),
    ...progressions.map(
      (progression) =>
        `${progression.institutionId} établit pour ${progression.personnageId} : ${progression.progression}.`,
    ),
    ...conflits.map((conflit) =>
      conflit.personnageJoueurConcerne
        ? `Exigences incompatibles à montrer au joueur sans décider à sa place : ${conflit.description}`
        : `Conflit d’obligations établi : ${conflit.description}`,
    ),
  ]);
}

function contributionM01(
  creations: CreationEngagementM05[],
  transitions: TransitionEngagementM05[],
  reconnaissances: ReconnaissanceEngagementM05[],
  reactions: ReactionInstitutionnelleM05[],
  progressions: ProgressionInstitutionnelleM05[],
  conflits: ConflitObligationsM05[],
  controles: ControleNarratif[],
): ContributionSceneM01 {
  return {
    pointsAMontrer: pointsAMontrerM05(
      creations,
      transitions,
      reconnaissances,
      reactions,
      progressions,
      conflits,
    ),
    contraintes: [
      'Une proposition, une formule polie ou une intention ne vaut jamais acceptation contractuelle sans signal explicite suffisant.',
      'Les clauses absentes restent absentes : M05 n’invente ni preuve, ni délai, ni sanction, ni contrepartie après coup.',
      'M14 établit le résultat d’une action ; M05 le compare aux obligations sans réécrire l’issue.',
      'M15 reste propriétaire de la connaissance et de la diffusion : une exécution réelle n’est pas automatiquement connue du donneur d’ordre ou d’une institution.',
      'M04 reste propriétaire des effets relationnels et réputationnels : une dette ou rupture n’implique pas une condamnation sociale générale.',
      'Une institution agit seulement dans son mandat, avec une procédure, des preuves et des moyens réellement établis lorsque ceux-ci sont requis.',
      'Une nomination ou promotion suit les conditions et décisions de l’institution ; aucun nombre universel de succès ne crée un droit automatique.',
    ],
    interditsNarratifs: [
      'Ne pas transformer « je verrai », une politesse ou le silence du joueur en promesse ferme.',
      'Ne pas exiger un rapport, une preuve ou une formalité qui n’existe pas dans les termes applicables.',
      'Ne pas confondre tâche accomplie, information reçue et reconnaissance par le donneur d’ordre.',
      'Ne pas déclencher une traque ou une sanction institutionnelle par omniscience.',
      'Ne pas rendre toute institution hostile, uniforme ou toute-puissante par défaut.',
      'Ne pas transformer une dette privée en réputation publique sans transmission M15 puis évaluation M04.',
      'Ne pas choisir à la place du joueur lorsqu’il fait face à plusieurs obligations incompatibles.',
    ],
    controles,
  };
}

function verifierConflits(
  contexte: ContexteNarratifV21,
  conflits: ConflitObligationsM05[],
  alertes: string[],
): ConflitObligationsM05[] {
  const engagements = new Set(contexte.engagements.map((engagement) => engagement.id));
  const resultat: ConflitObligationsM05[] = [];

  for (const conflit of conflits) {
    const inconnus = conflit.engagementIds.filter((id) => !engagements.has(id));
    if (inconnus.length > 0) {
      alertes.push(`Conflit ${conflit.id} ignoré : engagements inconnus ${inconnus.join(', ')}.`);
      continue;
    }
    if (conflit.engagementIds.length < 2) {
      alertes.push(`Conflit ${conflit.id} ignoré : moins de deux obligations concernées.`);
      continue;
    }
    if (!propre(conflit.description)) {
      alertes.push(`Conflit ${conflit.id} ignoré : description absente.`);
      continue;
    }
    resultat.push({
      ...conflit,
      engagementIds: uniquesTextes(conflit.engagementIds),
      optionsConnues: uniquesTextes(conflit.optionsConnues ?? []),
      sourceIds: uniquesTextes(conflit.sourceIds),
    });
  }

  return resultat;
}

/**
 * Exécute M05 sans appel de modèle et sans mutation directe de l'état de partie.
 *
 * Toutes les créations, reconnaissances, transitions et réactions restent des
 * propositions à valider par le Kernel avant canonisation. M05 refuse de
 * combler une clause absente ou une connaissance manquante par supposition.
 */
export function executerM05(entree: EntreeM05): SortieM05 {
  const alertes: string[] = [];

  const propositions = entree.propositionsAccord ?? [];
  const evaluationsAccords = propositions.map(evaluerAccord);
  const engagementsCrees = propositions.flatMap((proposition, index) => {
    const creation = creerEngagement(proposition, evaluationsAccords[index]);
    if (!creation) {
      alertes.push(
        ...evaluationsAccords[index].blocages.map(
          (blocage) => `Accord ${proposition.id} ignoré : ${blocage}`,
        ),
      );
      return [];
    }
    return [creation];
  });

  const demandesTransitions = entree.transitionsEngagement ?? [];
  const evaluationsTransitions = demandesTransitions.map((demande) =>
    evaluerTransition(entree, demande),
  );
  const transitionsEngagements = demandesTransitions.flatMap((demande, index) => {
    const transition = construireTransition(
      entree,
      demande,
      evaluationsTransitions[index],
    );
    if (!transition) {
      alertes.push(
        ...evaluationsTransitions[index].blocages.map(
          (blocage) => `Transition ${demande.id} ignorée : ${blocage}`,
        ),
      );
      return [];
    }
    return [transition];
  });

  const demandesReconnaissance = entree.reconnaissances ?? [];
  const evaluationsReconnaissances = demandesReconnaissance.map((demande) =>
    evaluerReconnaissance(entree, demande),
  );
  const reconnaissances = demandesReconnaissance.flatMap((demande, index) => {
    const reconnaissance = construireReconnaissance(
      entree,
      demande,
      evaluationsReconnaissances[index],
    );
    if (!reconnaissance) {
      alertes.push(
        ...evaluationsReconnaissances[index].blocages.map(
          (blocage) => `Reconnaissance ${demande.id} ignorée : ${blocage}`,
        ),
      );
      return [];
    }
    return [reconnaissance];
  });

  const candidatsInstitutions = entree.reactionsInstitutionnelles ?? [];
  const evaluationsInstitutions = candidatsInstitutions.map((candidat) =>
    evaluerReactionInstitutionnelle(entree, candidat),
  );
  const reactionsInstitutionnelles = candidatsInstitutions.flatMap((candidat, index) => {
    const reaction = construireReactionInstitutionnelle(
      candidat,
      evaluationsInstitutions[index],
    );
    if (!reaction) {
      alertes.push(
        ...evaluationsInstitutions[index].blocages.map(
          (blocage) => `Réaction institutionnelle ${candidat.id} impossible : ${blocage}`,
        ),
      );
      return [];
    }
    return [reaction];
  });

  const candidatsProgressions = entree.progressionsInstitutionnelles ?? [];
  const evaluationsProgressions = candidatsProgressions.map((candidat) =>
    evaluerProgression(entree, candidat),
  );
  const progressions = candidatsProgressions.flatMap((candidat, index) => {
    const progression = construireProgression(
      candidat,
      evaluationsProgressions[index],
    );
    if (!progression) {
      alertes.push(
        ...evaluationsProgressions[index].blocages.map(
          (blocage) => `Progression ${candidat.id} ignorée : ${blocage}`,
        ),
      );
      return [];
    }
    return [progression];
  });

  const conflitsObligations = verifierConflits(
    entree.contexte,
    entree.conflitsObligations ?? [],
    alertes,
  );

  const controles = controlesM05(
    evaluationsAccords,
    evaluationsTransitions,
    evaluationsReconnaissances,
    evaluationsInstitutions,
    evaluationsProgressions,
  );

  const contribution = contributionM01(
    engagementsCrees,
    transitionsEngagements,
    reconnaissances,
    reactionsInstitutionnelles,
    progressions,
    conflitsObligations,
    controles,
  );

  const transitions: PropositionTransition[] = [
    ...engagementsCrees.map(creationVersProposition),
    ...transitionsEngagements.map(transitionVersProposition),
    ...reconnaissances.map(reconnaissanceVersProposition),
    ...reactionsInstitutionnelles
      .map(reactionVersProposition)
      .filter((transition): transition is PropositionTransition<ReactionInstitutionnelleM05> => Boolean(transition)),
    ...progressions.map(progressionVersProposition),
  ];

  const contraintes = uniquesTextes([
    ...(contribution.contraintes ?? []),
    ...evaluationsAccords.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsTransitions.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsReconnaissances.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsInstitutions.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsProgressions.flatMap((evaluation) => evaluation.blocages),
  ]);

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M05,
    contribution,
    transitions: uniquesParCle(transitions, (transition) => transition.id),
    contraintes,
    alertes: uniquesTextes(alertes),
  };

  return {
    moteur: MOTEUR_M05,
    resultat,
    evaluationsAccords,
    engagementsCrees,
    evaluationsTransitions,
    transitionsEngagements,
    evaluationsReconnaissances,
    reconnaissances,
    evaluationsInstitutions,
    reactionsInstitutionnelles,
    evaluationsProgressions,
    progressions,
    conflitsObligations,
    alertes: resultat.alertes,
  };
}

export function sourceTechniqueM05(id: string): SourceNarrative {
  return sourceTechnique(id);
}
