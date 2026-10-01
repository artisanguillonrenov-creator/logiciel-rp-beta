// Elyndor — Noyau narratif natif V2.1
// M04 — Dynamiques sociales.
//
// M04 transforme des expériences vécues ou des informations effectivement
// reçues en évolutions relationnelles dirigées et en perceptions sociales.
// Il n'invente ni la circulation d'une information, ni sa vérité, ni les
// clauses d'une institution : M15, M02 et M05 restent propriétaires de ces
// domaines.

import type { ContributionSceneM01 } from './m01-production';
import type {
  AffirmationNarrative,
  ConnaissanceSituee,
  ContexteNarratifV21,
  ControleNarratif,
  EvenementNarratif,
  PropositionTransition,
  RelationDirigee,
  ReputationSituee,
  ResultatMoteur,
  SourceNarrative,
} from './types';

export const MOTEUR_M04 = 'M04' as const;

export type DimensionRelationM04 =
  | 'confiance'
  | 'attachement'
  | 'respect'
  | 'peur'
  | 'ressentiment'
  | 'dependance'
  | 'attirance';

export type DirectionRelationM04 = 'augmente' | 'diminue' | 'stable';
export type NiveauSocialM04 = 'faible' | 'modere' | 'fort' | 'critique';
export type OrigineExperienceM04 = 'vecue' | 'apprise';
export type OrientationReputationM04 =
  | 'favorable'
  | 'defavorable'
  | 'mixte'
  | 'neutre';

export interface VariationDimensionM04 {
  dimension: DimensionRelationM04;
  direction: DirectionRelationM04;
  ampleur?: NiveauSocialM04;
  effetObservable?: string;
}

export interface ExperienceSocialeM04 {
  id: string;
  acteurId: string;
  cibleId: string;
  origine: OrigineExperienceM04;
  evenementId?: string;
  affirmationId?: string;
  percueDirectement?: boolean;
  relationAbsenteConfirmee?: boolean;
  etatJoueurExplicitementDeclare?: boolean;
  variations: VariationDimensionM04[];
  gravite?: NiveauSocialM04;
  repetition?: NiveauSocialM04;
  ambiguite?: NiveauSocialM04;
  credibilite?: NiveauSocialM04;
  attentesTouchees?: string[];
  valeursTouchees?: string[];
  justification: string;
  sourceIds?: string[];
}

export interface DiffusionReputationM04 {
  id: string;
  cibleId: string;
  communauteId: string;
  affirmationId: string;
  recue: boolean;
  orientation: OrientationReputationM04;
  gravite?: NiveauSocialM04;
  credibilite?: NiveauSocialM04;
  ambiguite?: NiveauSocialM04;
  repetition?: NiveauSocialM04;
  jugementPropose: string;
  effetsObservables?: string[];
  rectifieAffirmationIds?: string[];
  sourceIds?: string[];
}

export interface PolitiqueCommunauteM04 {
  communauteId: string;
  inertie?: NiveauSocialM04;
  valeurs?: string[];
  description?: string;
}

export interface EvaluationExperienceM04 {
  experienceId: string;
  acteurId: string;
  cibleId: string;
  applicable: boolean;
  relationId?: string;
  raisons: string[];
  blocages: string[];
}

export interface TransitionRelationnelleM04 {
  id: string;
  relationId: string;
  acteurId: string;
  cibleId: string;
  dimension: DimensionRelationM04;
  direction: DirectionRelationM04;
  ampleur: NiveauSocialM04;
  justification: string;
  sourceIds: string[];
  effetObservable?: string;
  nouvelleRelation: boolean;
}

export interface EvaluationReputationM04 {
  diffusionId: string;
  cibleId: string;
  communauteId: string;
  applicable: boolean;
  affirmationId: string;
  reputationId?: string;
  raisons: string[];
  blocages: string[];
}

export interface JugementReputationM04 {
  id: string;
  reputationId: string;
  cibleId: string;
  communauteId: string;
  affirmationId: string;
  orientation: OrientationReputationM04;
  ampleur: NiveauSocialM04;
  jugement: string;
  effetsObservables: string[];
  rectifieAffirmationIds: string[];
  sourceIds: string[];
  nouvelleReputation: boolean;
}

export interface IndicePostureM04 {
  acteurId: string;
  cibleId: string;
  relationId?: string;
  facteurs: string[];
  effetsObservables: string[];
}

export interface EntreeM04 {
  contexte: ContexteNarratifV21;
  experiences?: ExperienceSocialeM04[];
  diffusionsReputation?: DiffusionReputationM04[];
  politiquesCommunautaires?: PolitiqueCommunauteM04[];
  personnageJoueurId?: string;
}

export interface SortieM04 {
  moteur: typeof MOTEUR_M04;
  resultat: ResultatMoteur<ContributionSceneM01>;
  evaluationsRelations: EvaluationExperienceM04[];
  transitionsRelationnelles: TransitionRelationnelleM04[];
  evaluationsReputation: EvaluationReputationM04[];
  jugementsReputation: JugementReputationM04[];
  indicesPosture: IndicePostureM04[];
  alertes: string[];
}

const POIDS_NIVEAU: Record<NiveauSocialM04, number> = {
  faible: 1,
  modere: 2,
  fort: 3,
  critique: 4,
};

const NIVEAUX_PAR_POIDS: NiveauSocialM04[] = [
  'faible',
  'modere',
  'fort',
  'critique',
];

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

function bornerPoids(valeur: number): number {
  return Math.max(1, Math.min(4, Math.round(valeur)));
}

function niveauDepuisPoids(valeur: number): NiveauSocialM04 {
  return NIVEAUX_PAR_POIDS[bornerPoids(valeur) - 1];
}

function poids(niveau: NiveauSocialM04 | undefined, defaut: NiveauSocialM04): number {
  return POIDS_NIVEAU[niveau ?? defaut];
}

function ampleurSociale(
  gravite: NiveauSocialM04 | undefined,
  repetition: NiveauSocialM04 | undefined,
  ambiguite: NiveauSocialM04 | undefined,
  credibilite: NiveauSocialM04 | undefined,
  ampleurExplicite?: NiveauSocialM04,
): NiveauSocialM04 {
  if (ampleurExplicite) return ampleurExplicite;

  const score =
    poids(gravite, 'modere') +
    poids(repetition, 'faible') +
    poids(credibilite, 'modere') -
    Math.max(0, poids(ambiguite, 'faible') - 1);

  return niveauDepuisPoids(Math.ceil(score / 2));
}

function appliquerInertie(
  ampleur: NiveauSocialM04,
  inertie: NiveauSocialM04 | undefined,
): NiveauSocialM04 {
  if (!inertie) return ampleur;

  const brut = POIDS_NIVEAU[ampleur];
  const frein = Math.max(0, POIDS_NIVEAU[inertie] - 2);
  return niveauDepuisPoids(Math.max(1, brut - frein));
}

function cleRelation(acteurId: string, cibleId: string): string {
  return `${normaliser(acteurId)}->${normaliser(cibleId)}`;
}

function trouverRelation(
  relations: RelationDirigee[],
  acteurId: string,
  cibleId: string,
): RelationDirigee | undefined {
  const cle = cleRelation(acteurId, cibleId);
  return relations.find(
    (relation) => cleRelation(relation.acteurId, relation.cibleId) === cle,
  );
}

function trouverReputation(
  reputations: ReputationSituee[],
  cibleId: string,
  communauteId: string,
): ReputationSituee | undefined {
  const cible = normaliser(cibleId);
  const communaute = normaliser(communauteId);

  return reputations.find(
    (reputation) =>
      normaliser(reputation.cibleId) === cible &&
      normaliser(reputation.communauteId) === communaute,
  );
}

function affirmationParId(
  contexte: ContexteNarratifV21,
): Map<string, AffirmationNarrative> {
  return new Map(
    contexte.affirmations.map((affirmation) => [affirmation.id, affirmation] as const),
  );
}

function evenementParId(
  contexte: ContexteNarratifV21,
): Map<string, EvenementNarratif> {
  return new Map(
    contexte.evenementsPertinents.map((evenement) => [evenement.id, evenement] as const),
  );
}

function connaissanceDisponible(
  connaissances: ConnaissanceSituee[],
  acteurId: string,
  affirmationId: string,
): ConnaissanceSituee | undefined {
  return connaissances.find(
    (connaissance) =>
      connaissance.acteurId === acteurId &&
      connaissance.affirmationId === affirmationId &&
      connaissance.statut !== 'inconnu',
  );
}

function acteurImplique(evenement: EvenementNarratif, acteurId: string): boolean {
  return (
    evenement.acteurs.includes(acteurId) ||
    (evenement.cibles ?? []).includes(acteurId)
  );
}

function sourcesExperience(
  experience: ExperienceSocialeM04,
  evenement: EvenementNarratif | undefined,
  connaissance: ConnaissanceSituee | undefined,
): string[] {
  return uniquesTextes([
    ...(experience.sourceIds ?? []),
    ...(evenement ? [evenement.id, ...evenement.sources.map((source) => source.id)] : []),
    ...(connaissance?.sourceIds ?? []),
    ...(experience.affirmationId ? [experience.affirmationId] : []),
  ]);
}

function verifierExperience(
  entree: EntreeM04,
  experience: ExperienceSocialeM04,
): {
  evaluation: EvaluationExperienceM04;
  relation?: RelationDirigee;
  evenement?: EvenementNarratif;
  connaissance?: ConnaissanceSituee;
} {
  const { contexte } = entree;
  const raisons: string[] = [];
  const blocages: string[] = [];
  const relation = trouverRelation(
    contexte.relations,
    experience.acteurId,
    experience.cibleId,
  );

  const personnages = new Set(contexte.personnages.map((personnage) => personnage.id));
  if (!personnages.has(experience.acteurId)) {
    blocages.push(`Acteur ${experience.acteurId} absent des identités disponibles.`);
  }
  if (!personnages.has(experience.cibleId)) {
    blocages.push(`Cible ${experience.cibleId} absente des identités disponibles.`);
  }

  if (!relation && !experience.relationAbsenteConfirmee) {
    blocages.push(
      'Relation absente ou non récupérée : M04 reste neutre sur l’inconnu au lieu de créer ou dégrader le lien.',
    );
  } else if (relation) {
    raisons.push(`Relation dirigée existante : ${relation.id}.`);
  } else {
    raisons.push('Absence de relation confirmée : une première transition relationnelle peut être proposée.');
  }

  let evenement: EvenementNarratif | undefined;
  let connaissance: ConnaissanceSituee | undefined;

  if (experience.origine === 'vecue') {
    if (!experience.evenementId) {
      blocages.push('Expérience vécue sans événement de provenance.');
    } else {
      evenement = evenementParId(contexte).get(experience.evenementId);
      if (!evenement || !evenement.canonique) {
        blocages.push(`Événement ${experience.evenementId} absent ou non canonique.`);
      } else if (
        !acteurImplique(evenement, experience.acteurId) &&
        !experience.percueDirectement
      ) {
        blocages.push(
          `La perception directe de ${experience.acteurId} n’est pas établie pour l’événement ${experience.evenementId}.`,
        );
      } else {
        raisons.push(`Expérience rattachée à l’événement ${experience.evenementId}.`);
      }
    }
  } else {
    if (!experience.affirmationId) {
      blocages.push('Expérience apprise sans affirmation de provenance.');
    } else {
      connaissance = connaissanceDisponible(
        contexte.connaissances,
        experience.acteurId,
        experience.affirmationId,
      );
      if (!connaissance) {
        blocages.push(
          `L’acteur ${experience.acteurId} ne dispose pas de l’affirmation ${experience.affirmationId} dans son registre de connaissances.`,
        );
      } else {
        raisons.push(
          `Information ${experience.affirmationId} effectivement accessible à ${experience.acteurId}.`,
        );
      }
    }
  }

  if (
    entree.personnageJoueurId &&
    experience.acteurId === entree.personnageJoueurId &&
    experience.variations.some(
      (variation) =>
        variation.dimension === 'attachement' ||
        variation.dimension === 'attirance',
    ) &&
    !experience.etatJoueurExplicitementDeclare
  ) {
    blocages.push(
      'L’attachement ou l’attirance du personnage joueur ne peut pas être déduit par M04 sans déclaration explicite.',
    );
  }

  if (experience.variations.length === 0) {
    raisons.push('Aucune dimension relationnelle n’est touchée : aucune mutation relationnelle nécessaire.');
  }

  return {
    evaluation: {
      experienceId: experience.id,
      acteurId: experience.acteurId,
      cibleId: experience.cibleId,
      applicable: blocages.length === 0,
      relationId: relation?.id,
      raisons: uniquesTextes(raisons),
      blocages: uniquesTextes(blocages),
    },
    relation,
    evenement,
    connaissance,
  };
}

function construireTransitionsRelationnelles(
  entree: EntreeM04,
  evaluations: EvaluationExperienceM04[],
): TransitionRelationnelleM04[] {
  const resultat: TransitionRelationnelleM04[] = [];
  const evaluationParId = new Map(
    evaluations.map((evaluation) => [evaluation.experienceId, evaluation] as const),
  );
  const evenements = evenementParId(entree.contexte);

  for (const experience of entree.experiences ?? []) {
    const evaluation = evaluationParId.get(experience.id);
    if (!evaluation?.applicable) continue;

    const relation = trouverRelation(
      entree.contexte.relations,
      experience.acteurId,
      experience.cibleId,
    );
    const connaissance = experience.affirmationId
      ? connaissanceDisponible(
          entree.contexte.connaissances,
          experience.acteurId,
          experience.affirmationId,
        )
      : undefined;
    const evenement = experience.evenementId
      ? evenements.get(experience.evenementId)
      : undefined;

    const relationId =
      relation?.id ??
      `m04-rel-${normaliser(experience.acteurId)}-${normaliser(experience.cibleId)}`;

    const sourceIds = sourcesExperience(experience, evenement, connaissance);

    for (const variation of experience.variations) {
      if (variation.direction === 'stable') continue;

      resultat.push({
        id: `m04-rel-${normaliser(experience.id)}-${variation.dimension}`,
        relationId,
        acteurId: experience.acteurId,
        cibleId: experience.cibleId,
        dimension: variation.dimension,
        direction: variation.direction,
        ampleur: ampleurSociale(
          experience.gravite,
          experience.repetition,
          experience.ambiguite,
          experience.credibilite,
          variation.ampleur,
        ),
        justification: experience.justification,
        sourceIds,
        effetObservable: propre(variation.effetObservable) || undefined,
        nouvelleRelation: !relation,
      });
    }
  }

  return uniquesParCle(resultat, (transition) => transition.id);
}

function transitionRelationnelleVersProposition(
  transition: TransitionRelationnelleM04,
): PropositionTransition {
  return {
    id: transition.id,
    moteurProprietaire: MOTEUR_M04,
    domaine: 'relation',
    categorie: 'sociale',
    cibleIds: [transition.acteurId, transition.cibleId],
    justification: transition.justification,
    sourceIds: transition.sourceIds,
    valeurProposee: {
      relationId: transition.relationId,
      acteurId: transition.acteurId,
      cibleId: transition.cibleId,
      dimension: transition.dimension,
      direction: transition.direction,
      ampleur: transition.ampleur,
      effetObservable: transition.effetObservable,
      nouvelleRelation: transition.nouvelleRelation,
    },
    perceptible: Boolean(transition.effetObservable),
    transmissible: true,
  };
}

function verifierDiffusion(
  entree: EntreeM04,
  diffusion: DiffusionReputationM04,
): EvaluationReputationM04 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  const affirmations = affirmationParId(entree.contexte);
  const affirmation = affirmations.get(diffusion.affirmationId);
  const reputation = trouverReputation(
    entree.contexte.reputations,
    diffusion.cibleId,
    diffusion.communauteId,
  );

  if (!diffusion.recue) {
    blocages.push(
      'Information non reçue par la communauté : aucun effet réputationnel public ne peut être produit.',
    );
  }

  if (!affirmation) {
    blocages.push(`Affirmation ${diffusion.affirmationId} absente du registre informationnel.`);
  } else {
    raisons.push(
      `Affirmation disponible avec le statut "${affirmation.statut}" ; M04 n’en déduit pas la vérité.`,
    );
  }

  const cibleConnue = entree.contexte.personnages.some(
    (personnage) => personnage.id === diffusion.cibleId,
  );
  if (!cibleConnue) {
    const cibleReferencee =
      entree.contexte.reputations.some(
        (element) => element.cibleId === diffusion.cibleId,
      ) ||
      entree.contexte.evenementsPertinents.some(
        (evenement) =>
          evenement.acteurs.includes(diffusion.cibleId) ||
          (evenement.cibles ?? []).includes(diffusion.cibleId),
      );

    if (!cibleReferencee) {
      blocages.push(`Cible sociale ${diffusion.cibleId} sans référence établie dans le contexte.`);
    }
  }

  if (reputation) {
    raisons.push(`Réputation existante dans ${diffusion.communauteId} : ${reputation.id}.`);
  } else {
    raisons.push(
      `Aucune réputation antérieure pour ${diffusion.cibleId} dans ${diffusion.communauteId} ; une perception locale peut être proposée sans la généraliser.`,
    );
  }

  if (diffusion.rectifieAffirmationIds?.includes(diffusion.affirmationId)) {
    blocages.push(
      'Une diffusion ne peut pas se déclarer elle-même comme sa propre réfutation.',
    );
  }

  return {
    diffusionId: diffusion.id,
    cibleId: diffusion.cibleId,
    communauteId: diffusion.communauteId,
    applicable: blocages.length === 0,
    affirmationId: diffusion.affirmationId,
    reputationId: reputation?.id,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function politiquePour(
  politiques: PolitiqueCommunauteM04[],
  communauteId: string,
): PolitiqueCommunauteM04 | undefined {
  const cible = normaliser(communauteId);
  return politiques.find(
    (politique) => normaliser(politique.communauteId) === cible,
  );
}

function sourceIdsDiffusion(
  contexte: ContexteNarratifV21,
  diffusion: DiffusionReputationM04,
): string[] {
  const affirmation = contexte.affirmations.find(
    (element) => element.id === diffusion.affirmationId,
  );

  return uniquesTextes([
    ...(diffusion.sourceIds ?? []),
    diffusion.affirmationId,
    ...(affirmation?.origine ? [affirmation.origine.id] : []),
    ...(diffusion.rectifieAffirmationIds ?? []),
  ]);
}

function construireJugementsReputation(
  entree: EntreeM04,
  evaluations: EvaluationReputationM04[],
): JugementReputationM04[] {
  const evaluationParId = new Map(
    evaluations.map((evaluation) => [evaluation.diffusionId, evaluation] as const),
  );
  const politiques = entree.politiquesCommunautaires ?? [];
  const resultat: JugementReputationM04[] = [];

  for (const diffusion of entree.diffusionsReputation ?? []) {
    const evaluation = evaluationParId.get(diffusion.id);
    if (!evaluation?.applicable) continue;

    const existante = trouverReputation(
      entree.contexte.reputations,
      diffusion.cibleId,
      diffusion.communauteId,
    );
    const politique = politiquePour(politiques, diffusion.communauteId);
    const brut = ampleurSociale(
      diffusion.gravite,
      diffusion.repetition,
      diffusion.ambiguite,
      diffusion.credibilite,
    );

    resultat.push({
      id: `m04-rep-${normaliser(diffusion.id)}`,
      reputationId:
        existante?.id ??
        `m04-reputation-${normaliser(diffusion.cibleId)}-${normaliser(diffusion.communauteId)}`,
      cibleId: diffusion.cibleId,
      communauteId: diffusion.communauteId,
      affirmationId: diffusion.affirmationId,
      orientation: diffusion.orientation,
      ampleur: appliquerInertie(brut, politique?.inertie),
      jugement: propre(diffusion.jugementPropose),
      effetsObservables: uniquesTextes(diffusion.effetsObservables ?? []),
      rectifieAffirmationIds: uniquesTextes(diffusion.rectifieAffirmationIds ?? []),
      sourceIds: sourceIdsDiffusion(entree.contexte, diffusion),
      nouvelleReputation: !existante,
    });
  }

  return uniquesParCle(resultat, (jugement) => jugement.id);
}

function jugementVersProposition(
  jugement: JugementReputationM04,
): PropositionTransition {
  return {
    id: jugement.id,
    moteurProprietaire: MOTEUR_M04,
    domaine: 'reputation',
    categorie: 'sociale',
    cibleIds: [jugement.cibleId, jugement.communauteId],
    justification:
      jugement.jugement ||
      `Effet social de l’affirmation ${jugement.affirmationId} dans ${jugement.communauteId}.`,
    sourceIds: jugement.sourceIds,
    valeurProposee: {
      reputationId: jugement.reputationId,
      cibleId: jugement.cibleId,
      communauteId: jugement.communauteId,
      affirmationId: jugement.affirmationId,
      orientation: jugement.orientation,
      ampleur: jugement.ampleur,
      jugement: jugement.jugement,
      effetsObservables: jugement.effetsObservables,
      rectifieAffirmationIds: jugement.rectifieAffirmationIds,
      nouvelleReputation: jugement.nouvelleReputation,
    },
    perceptible: jugement.effetsObservables.length > 0,
    transmissible: true,
  };
}

function indicesPosture(
  entree: EntreeM04,
  transitions: TransitionRelationnelleM04[],
  jugements: JugementReputationM04[],
): IndicePostureM04[] {
  const resultat: IndicePostureM04[] = [];
  const personnes = entree.contexte.personnages;

  for (const personnage of personnes) {
    if (!entree.contexte.scene.participants.includes(personnage.id)) continue;

    const relations = entree.contexte.relations.filter(
      (relation) => relation.acteurId === personnage.id,
    );

    for (const relation of relations) {
      const facteurs: string[] = [];
      const effets: string[] = [];

      const transitionsLiees = transitions.filter(
        (transition) =>
          transition.acteurId === relation.acteurId &&
          transition.cibleId === relation.cibleId,
      );

      for (const transition of transitionsLiees) {
        facteurs.push(
          `${transition.dimension} ${transition.direction} (${transition.ampleur})`,
        );
        if (transition.effetObservable) effets.push(transition.effetObservable);
      }

      const affirmationsConnues = entree.contexte.connaissances
        .filter((connaissance) => connaissance.acteurId === personnage.id)
        .map((connaissance) => connaissance.affirmationId);

      const reputationsLiees = jugements.filter(
        (jugement) =>
          jugement.cibleId === relation.cibleId &&
          affirmationsConnues.includes(jugement.affirmationId),
      );

      for (const jugement of reputationsLiees) {
        facteurs.push(
          `réputation ${jugement.orientation} connue via ${jugement.affirmationId} (${jugement.ampleur})`,
        );
        effets.push(...jugement.effetsObservables);
      }

      if (facteurs.length === 0 && effets.length === 0) continue;

      resultat.push({
        acteurId: personnage.id,
        cibleId: relation.cibleId,
        relationId: relation.id,
        facteurs: uniquesTextes(facteurs),
        effetsObservables: uniquesTextes(effets),
      });
    }
  }

  return resultat;
}

function controlesM04(
  evaluationsRelations: EvaluationExperienceM04[],
  evaluationsReputation: EvaluationReputationM04[],
  transitions: TransitionRelationnelleM04[],
  jugements: JugementReputationM04[],
): ControleNarratif[] {
  const relationInvalideAppliquee = evaluationsRelations.some(
    (evaluation) =>
      !evaluation.applicable &&
      transitions.some(
        (transition) => transition.id.includes(normaliser(evaluation.experienceId)),
      ),
  );

  const reputationInvalideAppliquee = evaluationsReputation.some(
    (evaluation) =>
      !evaluation.applicable &&
      jugements.some(
        (jugement) => jugement.id.includes(normaliser(evaluation.diffusionId)),
      ),
  );

  const fuiteInformation = jugements.some((jugement) => jugement.sourceIds.length === 0);

  return [
    {
      id: 'social',
      ok: !relationInvalideAppliquee && !reputationInvalideAppliquee,
      raison:
        relationInvalideAppliquee || reputationInvalideAppliquee
          ? 'Une transition sociale a été produite malgré une provenance invalide.'
          : 'Les transitions sociales proviennent uniquement d’expériences ou réceptions applicables.',
    },
    {
      id: 'savoir',
      ok: !fuiteInformation,
      raison: fuiteInformation
        ? 'Un jugement de réputation ne possède aucune provenance informationnelle.'
        : 'M04 référence les informations reçues sans décider de leur vérité ni de leur diffusion.',
    },
    {
      id: 'continuite',
      ok: true,
      raison:
        'M04 propose des transitions dirigées sans effacer l’historique relationnel ni propager automatiquement une réputation.',
    },
  ];
}

function pointsAMontrerM04(
  transitions: TransitionRelationnelleM04[],
  jugements: JugementReputationM04[],
): string[] {
  return uniquesTextes([
    ...transitions
      .filter((transition) => propre(transition.effetObservable))
      .map(
        (transition) =>
          `${transition.acteurId} envers ${transition.cibleId} : ${transition.effetObservable}`,
      ),
    ...jugements.flatMap((jugement) =>
      jugement.effetsObservables.map(
        (effet) => `${jugement.communauteId} envers ${jugement.cibleId} : ${effet}`,
      ),
    ),
  ]);
}

function contributionM01(
  transitions: TransitionRelationnelleM04[],
  jugements: JugementReputationM04[],
  controles: ControleNarratif[],
): ContributionSceneM01 {
  return {
    pointsAMontrer: pointsAMontrerM04(transitions, jugements),
    contraintes: [
      'Traiter chaque relation comme dirigée : le lien de A vers B ne détermine pas automatiquement le lien de B vers A.',
      'Une relation absente ou non récupérée reste inconnue ; elle ne doit pas être rétrogradée ou recréée arbitrairement.',
      'Une réputation ne change que pour les communautés effectivement exposées à une information ou à une expérience pertinente.',
      'M15 reste propriétaire de la circulation et du statut des affirmations ; M04 ne transforme pas une rumeur en fait.',
      'M05 reste propriétaire des dettes, contrats, mandats et sanctions institutionnelles ; M04 n’en conserve pas une seconde version.',
    ],
    interditsNarratifs: [
      'Ne pas convertir un service rendu en loyauté totale, amour profond ou dette formelle sans transition établie.',
      'Ne pas rendre une accusation vraie simplement parce qu’elle nuit à la réputation.',
      'Ne pas rendre publique une information secrète ou privée faute de transmission établie.',
      'Ne pas appliquer une réputation locale à toutes les communautés ou à toute la planète.',
      'Ne pas dicter au personnage joueur une émotion, une attirance ou un attachement qu’il n’a pas explicitement donné.',
      'Ne pas interpréter automatiquement amitié comme complicité ni mandat comme haine personnelle.',
    ],
    controles,
  };
}

function sourceTechnique(id: string): SourceNarrative {
  return {
    id,
    type: 'autre',
    description: 'Référence technique M04 à relier à une provenance narrative établie.',
  };
}

export function executerM04(entree: EntreeM04): SortieM04 {
  const experiences = entree.experiences ?? [];
  const diffusions = entree.diffusionsReputation ?? [];
  const alertes: string[] = [];

  const verifications = experiences.map((experience) =>
    verifierExperience(entree, experience),
  );
  const evaluationsRelations = verifications.map(
    (verification) => verification.evaluation,
  );

  for (const evaluation of evaluationsRelations) {
    alertes.push(...evaluation.blocages.map(
      (blocage) => `Expérience ${evaluation.experienceId} ignorée : ${blocage}`,
    ));
  }

  const transitionsRelationnelles = construireTransitionsRelationnelles(
    entree,
    evaluationsRelations,
  );

  const evaluationsReputation = diffusions.map((diffusion) =>
    verifierDiffusion(entree, diffusion),
  );

  for (const evaluation of evaluationsReputation) {
    alertes.push(...evaluation.blocages.map(
      (blocage) => `Diffusion ${evaluation.diffusionId} ignorée : ${blocage}`,
    ));
  }

  const jugementsReputation = construireJugementsReputation(
    entree,
    evaluationsReputation,
  );

  const postures = indicesPosture(
    entree,
    transitionsRelationnelles,
    jugementsReputation,
  );

  const controles = controlesM04(
    evaluationsRelations,
    evaluationsReputation,
    transitionsRelationnelles,
    jugementsReputation,
  );

  const contribution = contributionM01(
    transitionsRelationnelles,
    jugementsReputation,
    controles,
  );

  const transitions: PropositionTransition[] = [
    ...transitionsRelationnelles.map(transitionRelationnelleVersProposition),
    ...jugementsReputation.map(jugementVersProposition),
  ];

  const contraintes = uniquesTextes([
    ...(contribution.contraintes ?? []),
    ...evaluationsRelations.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsReputation.flatMap((evaluation) => evaluation.blocages),
  ]);

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M04,
    contribution,
    transitions: uniquesParCle(transitions, (transition) => transition.id),
    contraintes,
    alertes: uniquesTextes(alertes),
  };

  return {
    moteur: MOTEUR_M04,
    resultat,
    evaluationsRelations,
    transitionsRelationnelles,
    evaluationsReputation,
    jugementsReputation,
    indicesPosture: postures,
    alertes: resultat.alertes,
  };
}

export function sourceTechniqueM04(id: string): SourceNarrative {
  return sourceTechnique(id);
}
