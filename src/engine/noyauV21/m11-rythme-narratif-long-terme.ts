// Elyndor — Noyau narratif natif V2.1
// M11 — Rythme narratif long terme.
//
// M11 organise la place des fils dans la campagne : attention, reprise,
// respiration, attentes et lisibilité. Il ne réécrit pas le passé, ne suspend
// pas une obligation et ne crée pas une complication seulement pour relancer
// le récit. M02 conserve l'histoire ; M05 possède les échéances et obligations.

import type { ContributionSceneM01 } from './m01-production';
import type {
  ContexteNarratifV21,
  EngagementNarratif,
  EtatFilNarratif,
  FilNarratif,
  PropositionTransition,
  ResultatMoteur,
} from './types';

export const MOTEUR_M11 = 'M11' as const;

export type NiveauPrioriteRepriseM11 =
  | 'immediate'
  | 'proche'
  | 'disponible'
  | 'aucune';

export type CategorieElementNarratifM11 =
  | 'motif_ambiance'
  | 'indice_fonctionnel'
  | 'graine_volontaire';

export type TypeProgressionSceneM11 =
  | 'information'
  | 'lien'
  | 'experience_quotidienne'
  | 'decision'
  | 'deplacement'
  | 'resolution';

export type TypeDiagnosticStagnationM11 =
  | 'aucune'
  | 'repetition_improductive'
  | 'attente_choisie'
  | 'dialogue_approfondi'
  | 'tache_bloquee';

export type RecommandationTempoM11 =
  | 'maintenir'
  | 'respirer'
  | 'reprendre_fil'
  | 'traiter_blocage'
  | 'laisser_calme'
  | 'repondre_initiative';

export interface SignalAttentionFilM11 {
  filId: string;

  /** L'initiative actuelle vise réellement ce fil. */
  initiativeJoueurLiee?: boolean;

  /** Un acteur concerné porte une initiative déjà établie par son propriétaire. */
  initiativeActeurLiee?: boolean;

  /** Une condition de reprise définie par le fil est effectivement satisfaite. */
  conditionRepriseSatisfaite?: boolean;

  /** Une échéance réelle de M05 ou du monde exige de considérer ce fil maintenant. */
  echeanceReellePertinente?: boolean;

  /** Une information accessible et utile peut déjà être donnée dans ce fil. */
  informationDisponible?: boolean;

  /** Une initiative existante dans ce fil reste sans traitement. */
  initiativeNonTraitee?: boolean;

  /** Le joueur a explicitement délaissé l'objectif porté par ce fil. */
  abandonExplicite?: boolean;

  /** Le joueur a explicitement repris un objectif précédemment abandonné. */
  repriseExplicite?: boolean;

  /** Le fil ne possède plus d'objectif poursuivi, fait établi et non simple silence. */
  objectifNonPoursuiviEtabli?: boolean;

  /** Une condition identifiée empêche réellement la reprise. */
  blocageIdentifie?: boolean;

  /** La condition qui suspendait le fil a été levée. */
  conditionBlocageLevee?: boolean;

  /** Une résolution reconnue justifie la clôture du fil. */
  resolutionEtablie?: boolean;

  /** Le fil peut quitter le premier plan sans supprimer ses conséquences. */
  miseEnSommeilJustifiee?: boolean;

  sourceIds?: string[];
}

export interface ElementNarratifM11 {
  id: string;
  categorie: CategorieElementNarratifM11;
  description: string;
  filId?: string;
  acteurIds?: string[];
  sourceIds: string[];

  /** Un indice fonctionnel doit avoir été exposé ou être accessible avant usage. */
  accessible?: boolean;

  /** Une graine volontaire doit annoncer ce qui pourrait revenir. */
  enjeu?: string;
  conditionsRetour?: string[];
  horizonQualitatif?: string;
}

export interface CreationFilM11 {
  id: string;
  graineId: string;
  fil: FilNarratif;
  justification: string;
  sourceIds: string[];
}

export interface EvaluationCreationFilM11 {
  creationId: string;
  graineId: string;
  applicable: boolean;
  raisons: string[];
  blocages: string[];
}

export interface DemandeTransitionFilM11 {
  id: string;
  filId: string;
  vers: EtatFilNarratif;
  justification: string;
  sourceIds: string[];

  conditionRepriseSatisfaite?: boolean;
  conditionBlocageLevee?: boolean;
  blocageIdentifie?: boolean;
  resolutionEtablie?: boolean;
  abandonExplicite?: boolean;
  objectifNonPoursuiviEtabli?: boolean;
  repriseExplicite?: boolean;
  miseEnSommeilJustifiee?: boolean;
}

export interface EvaluationTransitionFilM11 {
  demandeId: string;
  filId: string;
  de?: EtatFilNarratif;
  vers: EtatFilNarratif;
  applicable: boolean;
  raisons: string[];
  blocages: string[];
}

export interface PrioriteRepriseM11 {
  filId: string;
  etat: EtatFilNarratif;
  priorite: NiveauPrioriteRepriseM11;
  raisons: string[];
  rappelPertinent?: string;
}

export interface PossibiliteSceneM11 {
  id: string;
  type: TypeProgressionSceneM11;
  description: string;
  filId?: string;
  sourceIds: string[];
  raisons: string[];
}

export interface ContexteStagnationM11 {
  repetitionImproductive?: boolean;
  attenteChoisie?: boolean;
  dialogueApprofondi?: boolean;
  tacheBloquee?: boolean;
  initiativeExistanteNonTraitee?: boolean;
  informationDisponible?: boolean;
  echeanceReelle?: boolean;
  sourceIds?: string[];
}

export interface DiagnosticStagnationM11 {
  type: TypeDiagnosticStagnationM11;
  stagnationReelle: boolean;
  inventerPerturbation: false;
  recommandation: RecommandationTempoM11;
  raisons: string[];
}

export interface EvolutionHorsChampM11 {
  id: string;
  filId?: string;
  description: string;
  sourceIds: string[];

  /** Le résultat doit déjà être établi par le moteur propriétaire. */
  etablieParProprietaire: boolean;
  causaliteComprehensible: boolean;
  delaiCompatible: boolean;

  /** Vrai si ce résultat supprimerait une décision que le joueur devait encore prendre. */
  clotureMomentDecisionJoueur?: boolean;
}

export interface EvaluationEvolutionHorsChampM11 {
  evolutionId: string;
  filId?: string;
  admissiblePourRythme: boolean;
  raisons: string[];
  blocages: string[];
}

export interface RevelationM11 {
  id: string;
  description: string;
  sourceIds: string[];

  /** Identifiants d'indices effectivement exposés auparavant. */
  indiceExposeIds?: string[];

  /** La révélation relit un indice existant sans modifier ce qui a été vu. */
  reinterpreteIndiceExpose?: boolean;

  /** Interdit : preuve prétendument visible avant mais créée après coup. */
  introduitPreuveRetroactive?: boolean;
}

export interface EvaluationRevelationM11 {
  revelationId: string;
  loyale: boolean;
  raisons: string[];
  blocages: string[];
}

export interface EntreeM11 {
  contexte: ContexteNarratifV21;
  signauxFils?: SignalAttentionFilM11[];
  elementsNarratifs?: ElementNarratifM11[];
  creationsFils?: CreationFilM11[];
  transitionsDemandees?: DemandeTransitionFilM11[];
  possibilitesProposees?: PossibiliteSceneM11[];
  stagnation?: ContexteStagnationM11;
  evolutionsHorsChamp?: EvolutionHorsChampM11[];
  revelations?: RevelationM11[];
}

export interface SortieM11 {
  moteur: typeof MOTEUR_M11;
  resultat: ResultatMoteur<ContributionSceneM01>;

  prioritesReprise: PrioriteRepriseM11[];
  possibilitesScene: PossibiliteSceneM11[];
  rappelsPertinents: string[];
  recommandationTempo: RecommandationTempoM11;
  diagnosticStagnation: DiagnosticStagnationM11;

  evaluationsCreations: EvaluationCreationFilM11[];
  evaluationsTransitions: EvaluationTransitionFilM11[];
  transitionsFils: PropositionTransition<FilNarratif>[];

  evaluationsHorsChamp: EvaluationEvolutionHorsChampM11[];
  evaluationsRevelations: EvaluationRevelationM11[];
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

function intersecte(a: string[], b: string[]): boolean {
  const ensemble = new Set(a.map(normaliser).filter(Boolean));
  return b.some((valeur) => ensemble.has(normaliser(valeur)));
}

function contientMots(texte: string, valeurs: string[]): boolean {
  const base = normaliser(texte);
  if (!base) return false;

  return valeurs.some((valeur) => {
    const candidate = normaliser(valeur);
    return candidate.length >= 3 && (base.includes(candidate) || candidate.includes(base));
  });
}

function filParId(contexte: ContexteNarratifV21, filId: string): FilNarratif | undefined {
  return contexte.filsNarratifs.find((fil) => fil.id === filId);
}

function engagementParId(
  contexte: ContexteNarratifV21,
  engagementId: string,
): EngagementNarratif | undefined {
  return contexte.engagements.find((engagement) => engagement.id === engagementId);
}

function signalParFil(entree: EntreeM11, filId: string): SignalAttentionFilM11 | undefined {
  return entree.signauxFils?.find((signal) => signal.filId === filId);
}

function filConcerneScene(contexte: ContexteNarratifV21, fil: FilNarratif): boolean {
  if (intersecte(fil.acteurs, contexte.scene.participants)) return true;
  if (contientMots(contexte.cadre.initiativeJoueur, [fil.enjeu, ...fil.acteurs])) return true;
  return false;
}

function engagementToujoursActif(engagement: EngagementNarratif): boolean {
  return (
    engagement.etat === 'propose' ||
    engagement.etat === 'accepte' ||
    engagement.etat === 'en_cours' ||
    engagement.etat === 'conteste' ||
    engagement.etat === 'suspendu'
  );
}

function engagementsActifsDuFil(
  contexte: ContexteNarratifV21,
  fil: FilNarratif,
): EngagementNarratif[] {
  return (fil.engagementIds ?? [])
    .map((id) => engagementParId(contexte, id))
    .filter((engagement): engagement is EngagementNarratif => Boolean(engagement))
    .filter(engagementToujoursActif);
}

function rappelFil(
  contexte: ContexteNarratifV21,
  fil: FilNarratif,
  signal: SignalAttentionFilM11 | undefined,
): string | undefined {
  if (fil.etat === 'clos') return undefined;

  const engagementsActifs = engagementsActifsDuFil(contexte, fil);
  const parties: string[] = [];

  if (signal?.initiativeNonTraitee) {
    parties.push(`initiative non traitée pour « ${fil.enjeu} »`);
  }
  if (signal?.informationDisponible) {
    parties.push(`information déjà disponible pour « ${fil.enjeu} »`);
  }
  if (signal?.echeanceReellePertinente) {
    parties.push(`échéance réelle pertinente pour « ${fil.enjeu} »`);
  }
  if (engagementsActifs.length > 0) {
    parties.push(
      `${engagementsActifs.length} engagement${engagementsActifs.length > 1 ? 's' : ''} encore actif${engagementsActifs.length > 1 ? 's' : ''}`,
    );
  }

  return parties.length > 0 ? parties.join(' ; ') : undefined;
}

function prioriteFil(entree: EntreeM11, fil: FilNarratif): PrioriteRepriseM11 {
  const signal = signalParFil(entree, fil.id);
  const raisons: string[] = [];
  const concerneScene = filConcerneScene(entree.contexte, fil);
  const rappelPertinent = rappelFil(entree.contexte, fil, signal);

  if (fil.etat === 'clos') {
    return {
      filId: fil.id,
      etat: fil.etat,
      priorite: 'aucune',
      raisons: ['Le fil est clos par un événement reconnu ; M11 ne le relance pas pour produire du rythme.'],
    };
  }

  if (fil.etat === 'abandonne') {
    if (signal?.repriseExplicite) {
      raisons.push('Le joueur ou un acteur a explicitement repris cet objectif.');
      return {
        filId: fil.id,
        etat: fil.etat,
        priorite: concerneScene ? 'immediate' : 'proche',
        raisons,
        rappelPertinent,
      };
    }

    return {
      filId: fil.id,
      etat: fil.etat,
      priorite: 'aucune',
      raisons: [
        'Le fil est abandonné : ses conséquences restent vraies, mais il ne réclame pas une reprise narrative automatique.',
      ],
      rappelPertinent,
    };
  }

  if (fil.etat === 'suspendu') {
    if (signal?.conditionBlocageLevee || signal?.conditionRepriseSatisfaite) {
      raisons.push('La condition qui empêchait la reprise est établie comme levée.');
      return {
        filId: fil.id,
        etat: fil.etat,
        priorite: concerneScene || signal.initiativeJoueurLiee ? 'immediate' : 'proche',
        raisons,
        rappelPertinent,
      };
    }

    return {
      filId: fil.id,
      etat: fil.etat,
      priorite: 'aucune',
      raisons: ['Le fil reste suspendu par une condition identifiée.'],
      rappelPertinent,
    };
  }

  const urgenceEtablie = Boolean(
    signal?.initiativeJoueurLiee ||
      signal?.initiativeActeurLiee ||
      signal?.initiativeNonTraitee ||
      signal?.echeanceReellePertinente,
  );

  const conditionReprise = Boolean(signal?.conditionRepriseSatisfaite);
  const informationDisponible = Boolean(signal?.informationDisponible);

  if (fil.etat === 'actif') {
    if (concerneScene || urgenceEtablie) {
      raisons.push(
        urgenceEtablie
          ? 'Une initiative ou une échéance établie appelle ce fil maintenant.'
          : 'Les acteurs ou l’enjeu du fil concernent directement la scène actuelle.',
      );
      return {
        filId: fil.id,
        etat: fil.etat,
        priorite: 'immediate',
        raisons,
        rappelPertinent,
      };
    }

    raisons.push('Le fil reste actif mais n’exige pas d’occuper chaque tour.');
    return {
      filId: fil.id,
      etat: fil.etat,
      priorite: informationDisponible ? 'proche' : 'disponible',
      raisons,
      rappelPertinent,
    };
  }

  // Dormant : il est conservé sans obligation de présence immédiate.
  if (urgenceEtablie || conditionReprise) {
    raisons.push(
      urgenceEtablie
        ? 'Une initiative ou une échéance établie justifie la reprise d’un fil dormant.'
        : 'Une condition de reprise explicitement définie est satisfaite.',
    );
    return {
      filId: fil.id,
      etat: fil.etat,
      priorite: concerneScene || signal?.initiativeJoueurLiee ? 'immediate' : 'proche',
      raisons,
      rappelPertinent,
    };
  }

  return {
    filId: fil.id,
    etat: fil.etat,
    priorite: informationDisponible ? 'disponible' : 'aucune',
    raisons: [
      informationDisponible
        ? 'Le fil dormant possède une information exploitable mais aucune reprise n’est imposée.'
        : 'Le fil dormant est conservé sans exigence de présence immédiate.',
    ],
    rappelPertinent,
  };
}

function ordrePriorite(niveau: NiveauPrioriteRepriseM11): number {
  switch (niveau) {
    case 'immediate':
      return 0;
    case 'proche':
      return 1;
    case 'disponible':
      return 2;
    case 'aucune':
    default:
      return 3;
  }
}

function prioritesReprise(entree: EntreeM11): PrioriteRepriseM11[] {
  return entree.contexte.filsNarratifs
    .map((fil) => prioriteFil(entree, fil))
    .sort((a, b) => {
      const pa = ordrePriorite(a.priorite);
      const pb = ordrePriorite(b.priorite);
      if (pa !== pb) return pa - pb;

      const ia = filParId(entree.contexte, a.filId)?.importance ?? 0;
      const ib = filParId(entree.contexte, b.filId)?.importance ?? 0;
      if (ia !== ib) return ib - ia;

      return a.filId.localeCompare(b.filId);
    });
}

function evaluerCreationFil(
  entree: EntreeM11,
  creation: CreationFilM11,
): EvaluationCreationFilM11 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  const graine = entree.elementsNarratifs?.find((element) => element.id === creation.graineId);

  if (!graine) {
    blocages.push('La graine narrative référencée est introuvable.');
  } else if (graine.categorie !== 'graine_volontaire') {
    blocages.push('Seule une graine volontaire peut proposer la création d’un fil persistant.');
  } else {
    if (!propre(graine.enjeu) && !propre(creation.fil.enjeu)) {
      blocages.push('Une graine volontaire doit porter un enjeu explicite.');
    }

    const conditions = uniquesTextes([
      ...(graine.conditionsRetour ?? []),
      ...creation.fil.conditionsReprise,
    ]);
    if (conditions.length === 0) {
      blocages.push('Une graine volontaire doit posséder au moins une condition de retour compréhensible.');
    }

    raisons.push(
      'La création d’un fil provient d’une graine volontaire, pas d’un simple motif d’ambiance ou d’un indice isolé.',
    );
  }

  if (entree.contexte.filsNarratifs.some((fil) => fil.id === creation.fil.id)) {
    blocages.push('Un fil portant déjà cet identifiant existe dans le contexte.');
  }

  if (!propre(creation.justification)) {
    blocages.push('La création du fil doit être justifiée.');
  }

  if (creation.sourceIds.length === 0) {
    blocages.push('La création du fil doit référencer au moins une source.');
  }

  if (creation.fil.etat === 'clos' || creation.fil.etat === 'abandonne') {
    blocages.push('Un nouveau fil ne peut pas naître déjà clos ou abandonné.');
  }

  return {
    creationId: creation.id,
    graineId: creation.graineId,
    applicable: blocages.length === 0,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function transitionCreation(
  creation: CreationFilM11,
): PropositionTransition<FilNarratif> {
  return {
    id: `m11-creation-${creation.id}`,
    moteurProprietaire: MOTEUR_M11,
    domaine: 'fil',
    categorie: 'narrative',
    cibleIds: uniquesTextes(creation.fil.acteurs),
    justification: creation.justification,
    sourceIds: uniquesTextes(creation.sourceIds),
    valeurProposee: {
      ...creation.fil,
      acteurs: uniquesTextes(creation.fil.acteurs),
      conditionsReprise: uniquesTextes(creation.fil.conditionsReprise),
      engagementIds: creation.fil.engagementIds
        ? uniquesTextes(creation.fil.engagementIds)
        : undefined,
      evenementIds: creation.fil.evenementIds
        ? uniquesTextes(creation.fil.evenementIds)
        : undefined,
    },
    perceptible: false,
    transmissible: false,
  };
}

function evaluerTransitionFil(
  entree: EntreeM11,
  demande: DemandeTransitionFilM11,
): EvaluationTransitionFilM11 {
  const fil = filParId(entree.contexte, demande.filId);
  const raisons: string[] = [];
  const blocages: string[] = [];

  if (!fil) {
    return {
      demandeId: demande.id,
      filId: demande.filId,
      vers: demande.vers,
      applicable: false,
      raisons,
      blocages: ['Fil narratif introuvable.'],
    };
  }

  if (fil.etat === demande.vers) {
    blocages.push('La transition demandée ne change pas l’état du fil.');
  }

  if (!propre(demande.justification)) {
    blocages.push('Toute transition d’attention narrative doit être justifiée.');
  }

  if (demande.sourceIds.length === 0) {
    blocages.push('Toute transition doit conserver une provenance.');
  }

  if (fil.etat === 'clos') {
    blocages.push(
      'Un fil clos n’est pas rouvert pour des raisons de rythme ; un nouvel enjeu doit former un nouveau fil ou une transition explicitement fondée ailleurs.',
    );
  }

  switch (demande.vers) {
    case 'actif': {
      if (fil.etat === 'suspendu') {
        if (!demande.conditionBlocageLevee && !demande.conditionRepriseSatisfaite) {
          blocages.push('La condition qui suspendait le fil doit être établie comme levée avant réactivation.');
        } else {
          raisons.push('La condition de suspension est levée ; le fil peut redevenir actif.');
        }
      } else if (fil.etat === 'dormant') {
        if (!demande.conditionRepriseSatisfaite) {
          blocages.push('Un fil dormant exige une condition de reprise satisfaite ou une demande plus précise.');
        } else {
          raisons.push('Une condition de reprise du fil dormant est satisfaite.');
        }
      } else if (fil.etat === 'abandonne') {
        if (!demande.repriseExplicite) {
          blocages.push('Un fil abandonné ne redevient actif qu’après reprise explicite de son objectif.');
        } else {
          raisons.push('L’objectif abandonné est explicitement repris.');
        }
      }
      break;
    }

    case 'dormant': {
      if (!demande.miseEnSommeilJustifiee) {
        blocages.push(
          'Le passage en dormance doit être justifié par l’attention narrative réelle, pas seulement par le désir de varier le rythme.',
        );
      } else {
        raisons.push('Le fil reste conservé mais n’exige plus de présence immédiate.');
      }
      break;
    }

    case 'suspendu': {
      if (!demande.blocageIdentifie) {
        blocages.push('Un fil suspendu doit être bloqué par une condition identifiée.');
      } else {
        raisons.push('Une condition identifiée empêche temporairement la poursuite du fil.');
      }
      break;
    }

    case 'clos': {
      if (!demande.resolutionEtablie) {
        blocages.push('Un fil ne peut être clos que par une résolution effectivement établie.');
      } else {
        raisons.push('Une résolution reconnue justifie la clôture du fil.');
      }
      break;
    }

    case 'abandonne': {
      if (!demande.abandonExplicite && !demande.objectifNonPoursuiviEtabli) {
        blocages.push(
          'L’abandon doit être explicite ou reposer sur l’établissement qu’aucun objectif n’est désormais poursuivi.',
        );
      } else {
        raisons.push(
          demande.abandonExplicite
            ? 'L’objectif du fil est explicitement délaissé.'
            : 'L’absence d’objectif poursuivi est établie.',
        );
      }
      break;
    }

    default:
      break;
  }

  return {
    demandeId: demande.id,
    filId: demande.filId,
    de: fil.etat,
    vers: demande.vers,
    applicable: blocages.length === 0,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function transitionFil(
  contexte: ContexteNarratifV21,
  demande: DemandeTransitionFilM11,
): PropositionTransition<FilNarratif> | undefined {
  const fil = filParId(contexte, demande.filId);
  if (!fil) return undefined;

  return {
    id: `m11-transition-${demande.id}`,
    moteurProprietaire: MOTEUR_M11,
    domaine: 'fil',
    categorie: 'narrative',
    cibleIds: uniquesTextes(fil.acteurs),
    justification: demande.justification,
    sourceIds: uniquesTextes(demande.sourceIds),
    valeurProposee: {
      ...fil,
      etat: demande.vers,
      acteurs: [...fil.acteurs],
      conditionsReprise: [...fil.conditionsReprise],
      engagementIds: fil.engagementIds ? [...fil.engagementIds] : undefined,
      evenementIds: fil.evenementIds ? [...fil.evenementIds] : undefined,
    },
    perceptible: false,
    transmissible: false,
  };
}

function evaluerStagnation(entree: EntreeM11): DiagnosticStagnationM11 {
  const contexte = entree.stagnation;

  if (!contexte) {
    return {
      type: 'aucune',
      stagnationReelle: false,
      inventerPerturbation: false,
      recommandation: 'maintenir',
      raisons: ['Aucun signal de stagnation n’est établi.'],
    };
  }

  if (contexte.attenteChoisie) {
    return {
      type: 'attente_choisie',
      stagnationReelle: false,
      inventerPerturbation: false,
      recommandation: 'laisser_calme',
      raisons: [
        'L’attente ou le calme est choisi : il constitue une forme de jeu valide et ne justifie aucune perturbation automatique.',
      ],
    };
  }

  if (contexte.dialogueApprofondi) {
    return {
      type: 'dialogue_approfondi',
      stagnationReelle: false,
      inventerPerturbation: false,
      recommandation: 'maintenir',
      raisons: [
        'Le dialogue approfondit réellement la scène ; sa durée ne constitue pas une stagnation par elle-même.',
      ],
    };
  }

  if (contexte.tacheBloquee) {
    const raisons = ['Une tâche est bloquée par une condition identifiable.'];
    if (contexte.informationDisponible) {
      raisons.push('Une information déjà disponible peut être traitée avant toute nouvelle perturbation.');
    }
    if (contexte.echeanceReelle) {
      raisons.push('Une échéance réelle peut produire une évolution sans invention de menace.');
    }
    return {
      type: 'tache_bloquee',
      stagnationReelle: true,
      inventerPerturbation: false,
      recommandation: 'traiter_blocage',
      raisons,
    };
  }

  if (contexte.repetitionImproductive) {
    const raisons = ['La répétition ne produit plus d’information, de lien, de décision ou d’évolution utile.'];
    if (contexte.initiativeExistanteNonTraitee) {
      raisons.push('Une initiative existante doit être traitée avant d’inventer un nouvel enjeu.');
    }
    if (contexte.informationDisponible) {
      raisons.push('Une information accessible doit être exploitée avant d’ajouter un événement artificiel.');
    }
    if (contexte.echeanceReelle) {
      raisons.push('Une échéance réellement établie peut être considérée avant toute perturbation inventée.');
    }
    return {
      type: 'repetition_improductive',
      stagnationReelle: true,
      inventerPerturbation: false,
      recommandation: contexte.initiativeExistanteNonTraitee
        ? 'repondre_initiative'
        : contexte.informationDisponible || contexte.echeanceReelle
          ? 'reprendre_fil'
          : 'respirer',
      raisons,
    };
  }

  return {
    type: 'aucune',
    stagnationReelle: false,
    inventerPerturbation: false,
    recommandation: 'maintenir',
    raisons: ['Aucun signal ne permet de qualifier la scène de stagnante.'],
  };
}

function evaluerEvolutionHorsChamp(
  evolution: EvolutionHorsChampM11,
): EvaluationEvolutionHorsChampM11 {
  const raisons: string[] = [];
  const blocages: string[] = [];

  if (!evolution.etablieParProprietaire) {
    blocages.push(
      'M11 ne peut pas inventer l’issue d’une action hors champ : elle doit déjà être établie par son moteur propriétaire.',
    );
  } else {
    raisons.push('L’évolution hors champ est déjà établie par le domaine qui en possède le sens.');
  }

  if (!evolution.causaliteComprehensible) {
    blocages.push('L’évolution hors champ ne possède pas une causalité suffisamment compréhensible.');
  }

  if (!evolution.delaiCompatible) {
    blocages.push('Le délai de l’évolution hors champ est incompatible avec le temps fictif établi.');
  }

  if (evolution.clotureMomentDecisionJoueur) {
    blocages.push(
      'Une évolution hors champ ne peut pas supprimer le moment de décision encore réservé au joueur pour un enjeu qu’il poursuit.',
    );
  }

  return {
    evolutionId: evolution.id,
    filId: evolution.filId,
    admissiblePourRythme: blocages.length === 0,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function evaluerRevelation(revelation: RevelationM11): EvaluationRevelationM11 {
  const raisons: string[] = [];
  const blocages: string[] = [];

  if (revelation.introduitPreuveRetroactive) {
    blocages.push(
      'Une révélation ne peut pas inventer rétroactivement une preuve censée avoir été accessible dans une scène terminée.',
    );
  }

  if (revelation.reinterpreteIndiceExpose) {
    if ((revelation.indiceExposeIds ?? []).length === 0) {
      blocages.push('Une réinterprétation loyale doit référencer au moins un indice réellement exposé.');
    } else {
      raisons.push('La révélation réinterprète un indice réellement exposé sans falsifier ce qui a été vu.');
    }
  }

  if (!revelation.reinterpreteIndiceExpose && !revelation.introduitPreuveRetroactive) {
    raisons.push(
      'La révélation n’altère pas rétroactivement une scène antérieure ; sa validité factuelle reste du ressort des propriétaires concernés.',
    );
  }

  return {
    revelationId: revelation.id,
    loyale: blocages.length === 0,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function possibilitesDepuisElements(entree: EntreeM11): PossibiliteSceneM11[] {
  const resultat: PossibiliteSceneM11[] = [];

  for (const element of entree.elementsNarratifs ?? []) {
    if (element.categorie === 'motif_ambiance') {
      resultat.push({
        id: `m11-element-${element.id}`,
        type: 'experience_quotidienne',
        description: element.description,
        filId: element.filId,
        sourceIds: uniquesTextes(element.sourceIds),
        raisons: [
          'Motif d’ambiance utilisable pour donner présence à la scène sans promettre une révélation future.',
        ],
      });
      continue;
    }

    if (element.categorie === 'indice_fonctionnel') {
      if (!element.accessible) continue;
      resultat.push({
        id: `m11-element-${element.id}`,
        type: 'information',
        description: element.description,
        filId: element.filId,
        sourceIds: uniquesTextes(element.sourceIds),
        raisons: ['Indice fonctionnel accessible et exploitable dans la scène.'],
      });
      continue;
    }

    // Une graine volontaire ne devient pertinente que lorsque sa condition de retour
    // est satisfaite ou qu'un signal explicite ramène son fil au premier plan.
    const signal = element.filId ? signalParFil(entree, element.filId) : undefined;
    if (!signal?.conditionRepriseSatisfaite && !signal?.initiativeJoueurLiee && !signal?.initiativeActeurLiee) {
      continue;
    }

    resultat.push({
      id: `m11-element-${element.id}`,
      type: 'decision',
      description: element.description,
      filId: element.filId,
      sourceIds: uniquesTextes(element.sourceIds),
      raisons: ['Une condition de retour ou une initiative établie rend la graine volontaire pertinente maintenant.'],
    });
  }

  return resultat;
}

function filtrerPossibilitesProposees(
  entree: EntreeM11,
  priorites: PrioriteRepriseM11[],
): PossibiliteSceneM11[] {
  const prioriteParFil = new Map(priorites.map((priorite) => [priorite.filId, priorite.priorite] as const));

  return (entree.possibilitesProposees ?? []).filter((possibilite) => {
    if (!possibilite.filId) return true;
    const niveau = prioriteParFil.get(possibilite.filId);
    return niveau !== 'aucune';
  });
}

function possibilitesDepuisPriorites(
  entree: EntreeM11,
  priorites: PrioriteRepriseM11[],
): PossibiliteSceneM11[] {
  const resultat: PossibiliteSceneM11[] = [];

  for (const priorite of priorites) {
    if (priorite.priorite !== 'immediate' && priorite.priorite !== 'proche') continue;
    const fil = filParId(entree.contexte, priorite.filId);
    if (!fil) continue;

    const signal = signalParFil(entree, fil.id);
    if (signal?.informationDisponible) {
      resultat.push({
        id: `m11-info-${fil.id}`,
        type: 'information',
        description: `Traiter l’information déjà disponible concernant « ${fil.enjeu} » sans inventer de nouvelle complication.`,
        filId: fil.id,
        sourceIds: uniquesTextes(signal.sourceIds ?? []),
        raisons: ['Une information accessible peut faire progresser la scène.'],
      });
    }

    if (signal?.initiativeNonTraitee || signal?.initiativeJoueurLiee) {
      resultat.push({
        id: `m11-initiative-${fil.id}`,
        type: 'decision',
        description: `Répondre à l’initiative existante concernant « ${fil.enjeu} » avant d’ouvrir un nouvel enjeu.`,
        filId: fil.id,
        sourceIds: uniquesTextes(signal.sourceIds ?? []),
        raisons: ['Une initiative liée à ce fil attend déjà un traitement.'],
      });
    }

    if (signal?.echeanceReellePertinente) {
      resultat.push({
        id: `m11-echeance-${fil.id}`,
        type: 'resolution',
        description: `Tenir compte de l’échéance réellement établie liée à « ${fil.enjeu} » sans modifier ses termes.`,
        filId: fil.id,
        sourceIds: uniquesTextes(signal.sourceIds ?? []),
        raisons: ['Une échéance réelle peut produire une évolution de campagne sans perturbation artificielle.'],
      });
    }
  }

  return resultat;
}

function construirePossibilites(
  entree: EntreeM11,
  priorites: PrioriteRepriseM11[],
): PossibiliteSceneM11[] {
  return uniquesParCle(
    [
      ...filtrerPossibilitesProposees(entree, priorites),
      ...possibilitesDepuisElements(entree),
      ...possibilitesDepuisPriorites(entree, priorites),
    ],
    (possibilite) => normaliser(possibilite.id),
  ).map((possibilite) => ({
    ...possibilite,
    sourceIds: uniquesTextes(possibilite.sourceIds),
    raisons: uniquesTextes(possibilite.raisons),
  }));
}

function rappelsPertinents(priorites: PrioriteRepriseM11[]): string[] {
  return uniquesTextes(
    priorites
      .filter((priorite) => priorite.priorite !== 'aucune')
      .map((priorite) => priorite.rappelPertinent ?? '')
      .filter(Boolean),
  );
}

function recommandationGlobale(
  entree: EntreeM11,
  priorites: PrioriteRepriseM11[],
  diagnostic: DiagnosticStagnationM11,
): RecommandationTempoM11 {
  if (diagnostic.recommandation !== 'maintenir') return diagnostic.recommandation;

  if (entree.contexte.cadre.nature !== 'fiction') return 'maintenir';

  const signalInitiative = (entree.signauxFils ?? []).some(
    (signal) => signal.initiativeJoueurLiee || signal.initiativeNonTraitee,
  );
  if (signalInitiative) return 'repondre_initiative';

  if (priorites.some((priorite) => priorite.priorite === 'immediate')) {
    return 'reprendre_fil';
  }

  const rythme = normaliser(entree.contexte.profilRendu.rythme);
  if (rythme.includes('lent') || rythme.includes('calme')) return 'respirer';

  return 'maintenir';
}

function contraintesM11(
  diagnostic: DiagnosticStagnationM11,
  evaluationsHorsChamp: EvaluationEvolutionHorsChampM11[],
  evaluationsRevelations: EvaluationRevelationM11[],
): string[] {
  const contraintes = [
    'Un fil dormant reste conservé : sa dormance ne suspend ni le temps fictif, ni une dette, ni une échéance appartenant à M05.',
    'Un fil non résolu n’est pas automatiquement prioritaire à chaque tour.',
    'Le calme choisi, le quotidien, le dialogue ou une réussite qui simplifie la situation sont des progressions narratives valides.',
    'Avant toute perturbation nouvelle, traiter l’initiative existante, l’information disponible ou l’échéance réellement établie lorsqu’elles sont pertinentes.',
    'Les évolutions hors champ doivent déjà être causées et établies par leurs moteurs propriétaires ; M11 n’en invente pas le résultat.',
  ];

  if (diagnostic.type === 'attente_choisie') {
    contraintes.push('La scène calme ou l’attente choisie ne doit pas être interrompue uniquement pour relancer la tension.');
  }

  if (evaluationsHorsChamp.some((evaluation) => !evaluation.admissiblePourRythme)) {
    contraintes.push('Ne pas utiliser une évolution hors champ rejetée pour clôturer ou forcer un enjeu de la scène.');
  }

  if (evaluationsRevelations.some((evaluation) => !evaluation.loyale)) {
    contraintes.push('Ne pas narrer comme preuve une révélation rejetée pour rétroactivité ou absence d’indice exposé.');
  }

  return uniquesTextes(contraintes);
}

function interditsM11(): string[] {
  return [
    'Ne pas déclencher une attaque, une catastrophe, une trahison ou une révélation seulement parce que plusieurs scènes sont calmes.',
    'Ne pas imposer exposition, complication, crise, confrontation et retombée comme cycle obligatoire.',
    'Ne pas maintenir un vague mystère sans enjeu, conditions de retour ou source identifiable.',
    'Ne pas inventer rétroactivement une preuve censée avoir été visible auparavant.',
    'Ne pas clore hors champ le moment de décision réservé au joueur pour améliorer le pacing.',
    'Ne pas transformer un motif d’ambiance en promesse narrative ou en fil persistant sans graine volontaire.',
    'Ne pas afficher les états actif, dormant, suspendu, clos ou abandonné comme un HUD dans la prose.',
  ];
}

function pointsAMontrer(
  possibilites: PossibiliteSceneM11[],
  priorites: PrioriteRepriseM11[],
): string[] {
  const points = possibilites
    .slice(0, 6)
    .map((possibilite) => possibilite.description);

  for (const priorite of priorites) {
    if (priorite.priorite !== 'immediate' || !priorite.rappelPertinent) continue;
    points.push(priorite.rappelPertinent);
  }

  return uniquesTextes(points);
}

function contributionM11(
  possibilites: PossibiliteSceneM11[],
  priorites: PrioriteRepriseM11[],
  diagnostic: DiagnosticStagnationM11,
  evaluationsHorsChamp: EvaluationEvolutionHorsChampM11[],
  evaluationsRevelations: EvaluationRevelationM11[],
): ContributionSceneM01 {
  return {
    contraintes: contraintesM11(diagnostic, evaluationsHorsChamp, evaluationsRevelations),
    pointsAMontrer: pointsAMontrer(possibilites, priorites),
    interditsNarratifs: interditsM11(),
  };
}

/**
 * M11 ne déroule aucun scénario pré-écrit. Il classe l'attention portée aux
 * fils, valide les transitions de son propre domaine et fournit des possibilités
 * de scène déjà compatibles avec les faits. Les obligations, événements hors
 * champ, connaissances et résolutions restent chez leurs moteurs propriétaires.
 */
export function executerM11(entree: EntreeM11): SortieM11 {
  const priorites = prioritesReprise(entree);
  const diagnostic = evaluerStagnation(entree);
  const possibilites = construirePossibilites(entree, priorites);

  const evaluationsCreations = (entree.creationsFils ?? []).map((creation) =>
    evaluerCreationFil(entree, creation),
  );

  const evaluationsTransitions = (entree.transitionsDemandees ?? []).map((demande) =>
    evaluerTransitionFil(entree, demande),
  );

  const transitionsFils: PropositionTransition<FilNarratif>[] = [];

  for (const creation of entree.creationsFils ?? []) {
    const evaluation = evaluationsCreations.find((item) => item.creationId === creation.id);
    if (evaluation?.applicable) transitionsFils.push(transitionCreation(creation));
  }

  for (const demande of entree.transitionsDemandees ?? []) {
    const evaluation = evaluationsTransitions.find((item) => item.demandeId === demande.id);
    if (!evaluation?.applicable) continue;
    const transition = transitionFil(entree.contexte, demande);
    if (transition) transitionsFils.push(transition);
  }

  const evaluationsHorsChamp = (entree.evolutionsHorsChamp ?? []).map(evaluerEvolutionHorsChamp);
  const evaluationsRevelations = (entree.revelations ?? []).map(evaluerRevelation);

  const alertes = uniquesTextes([
    ...evaluationsCreations.flatMap((evaluation) =>
      evaluation.applicable
        ? []
        : evaluation.blocages.map(
            (blocage) => `Création de fil ${evaluation.creationId} refusée : ${blocage}`,
          ),
    ),
    ...evaluationsTransitions.flatMap((evaluation) =>
      evaluation.applicable
        ? []
        : evaluation.blocages.map(
            (blocage) => `Transition de fil ${evaluation.demandeId} refusée : ${blocage}`,
          ),
    ),
    ...evaluationsHorsChamp.flatMap((evaluation) =>
      evaluation.admissiblePourRythme
        ? []
        : evaluation.blocages.map(
            (blocage) => `Évolution hors champ ${evaluation.evolutionId} rejetée : ${blocage}`,
          ),
    ),
    ...evaluationsRevelations.flatMap((evaluation) =>
      evaluation.loyale
        ? []
        : evaluation.blocages.map(
            (blocage) => `Révélation ${evaluation.revelationId} rejetée : ${blocage}`,
          ),
    ),
  ]);

  const contraintes = contraintesM11(
    diagnostic,
    evaluationsHorsChamp,
    evaluationsRevelations,
  );

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M11,
    contribution: contributionM11(
      possibilites,
      priorites,
      diagnostic,
      evaluationsHorsChamp,
      evaluationsRevelations,
    ),
    transitions: transitionsFils,
    contraintes,
    alertes,
  };

  return {
    moteur: MOTEUR_M11,
    resultat,
    prioritesReprise: priorites,
    possibilitesScene: possibilites,
    rappelsPertinents: rappelsPertinents(priorites),
    recommandationTempo: recommandationGlobale(entree, priorites, diagnostic),
    diagnosticStagnation: diagnostic,
    evaluationsCreations,
    evaluationsTransitions,
    transitionsFils,
    evaluationsHorsChamp,
    evaluationsRevelations,
    alertes,
  };
}
