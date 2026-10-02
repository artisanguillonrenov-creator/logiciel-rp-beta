// Elyndor — Noyau narratif natif V2.1
// M06 — Lois du monde en scène.
//
// M06 détermine les possibilités et contraintes matérielles d'une scène :
// positions, distance, équipement, blessures, soins, fatigue, technologie,
// magie, pouvoirs et risques physiques. Il ne décide pas seul de l'issue
// d'une opposition : M14 reste propriétaire de la résolution.

import type { ContributionSceneM01 } from './m01-production';
import type {
  BlessureNarrative,
  BlocageNarratif,
  ContexteNarratifV21,
  ControleNarratif,
  PositionPhysique,
  PropositionTransition,
  ResultatMoteur,
  SituationPhysique,
  SourceNarrative,
  TentativeAction,
} from './types';

export const MOTEUR_M06 = 'M06' as const;

export type TypeMecanismeM06 =
  | 'magie'
  | 'don'
  | 'technologie'
  | 'equipement'
  | 'regle_physique'
  | 'autre';

export type StatutFaisabiliteM06 =
  | 'possible'
  | 'possible_avec_risque'
  | 'impossible'
  | 'a_clarifier';

export type NiveauRisqueM06 = 'faible' | 'modere' | 'serieux' | 'critique';

export type EffetBlessureM06 =
  | 'aucun'
  | 'gene'
  | 'risque'
  | 'interdit';

export type TypeReactionTiersM06 =
  | 'observer'
  | 'eviter'
  | 'intervenir'
  | 'partir'
  | 'alerter'
  | 'autre';

export type PorteePermissionMortM06 = 'tentative' | 'scene' | 'campagne';

export interface MecanismeMondeM06 {
  id: string;
  nom: string;
  type: TypeMecanismeM06;

  /**
   * Un mécanisme inhabituel ne peut servir à résoudre une difficulté que s'il
   * a déjà été établi dans le monde actif.
   */
  etabli: boolean;
  sourceIds: string[];

  portee?: string;
  acces?: string[];
  preparation?: string[];
  couts?: string[];
  limites?: string[];
  zonesAutorisees?: string[];
  zonesInterdites?: string[];
  niveauTechnologique?: string;
  exceptionRegionaleEtablie?: boolean;
}

export interface ExigenceMaterielleM06 {
  id: string;
  description: string;
  obligatoire: boolean;
  satisfaite: boolean;
  sourceIds: string[];
  type:
    | 'moyen'
    | 'position'
    | 'distance'
    | 'temps'
    | 'etat_physique'
    | 'mecanisme'
    | 'environnement'
    | 'autre';
}

export interface RisqueMaterielM06 {
  id: string;
  tentativeId: string;
  description: string;
  niveau: NiveauRisqueM06;
  condition?: string;
  sourceIds: string[];
  lethalPossible?: boolean;
}

export interface ImpactBlessureSurActionM06 {
  id: string;
  tentativeId: string;
  blessureId: string;
  effet: EffetBlessureM06;
  justification: string;
  sourceIds: string[];
}

export interface TentativeMaterielleM06 {
  tentative: TentativeAction;
  lieuCible?: string;
  precisionCible?: string;
  mecanismeIds?: string[];
  exigences?: ExigenceMaterielleM06[];
  risques?: RisqueMaterielM06[];
  impactsBlessures?: ImpactBlessureSurActionM06[];

  /**
   * Indique qu'une conséquence mortelle est matériellement possible dans les
   * conditions établies. Ce champ ne vaut jamais permission de mort.
   */
  issueMortellePossible?: boolean;

  /**
   * Si vrai, l'action est déjà engagée dans l'histoire. Une modification de
   * permission ultérieure ne réécrit pas rétroactivement ce qui est établi.
   */
  engagee?: boolean;
}

export interface PermissionMortM06 {
  personnageId: string;
  autorisee: boolean;
  portee: PorteePermissionMortM06;
  tentativeIds?: string[];
  sceneId?: string;
  sourceIds: string[];
}

export interface IssueNonLetalePlausibleM06 {
  id: string;
  tentativeId: string;
  type:
    | 'retraite'
    | 'defaite'
    | 'capture'
    | 'intervention'
    | 'perte_ressource'
    | 'blessure'
    | 'autre';
  description: string;
  plausible: boolean;
  raison: string;
  sourceIds: string[];
}

export interface EvaluationFaisabiliteM06 {
  tentativeId: string;
  auteurId: string;
  statut: StatutFaisabiliteM06;
  raisons: string[];
  contraintes: string[];
  risques: RisqueMaterielM06[];
  mecanismesUtilises: string[];
  exigencesManquantes: string[];
  blessuresPertinentes: string[];
  risqueMortel: boolean;
  permissionMortApplicable: boolean;
  clarificationNecessaire: boolean;
}

export interface DemandeDeplacementM06 {
  id: string;
  entiteId: string;
  versLieu: string;
  versPrecision?: string;
  depuisLieuAttendu?: string;
  conditionsSatisfaites: boolean;
  justification: string;
  sourceIds: string[];
}

export interface EvaluationDeplacementM06 {
  demandeId: string;
  entiteId: string;
  applicable: boolean;
  positionActuelle?: PositionPhysique;
  raisons: string[];
  blocages: string[];
}

export interface TransitionPositionM06 {
  id: string;
  entiteId: string;
  positionAvant?: PositionPhysique;
  positionApres: PositionPhysique;
  justification: string;
  sourceIds: string[];
}

export interface TraitementBlessureM06 {
  id: string;
  blessureId: string;
  type: 'soin' | 'repos' | 'recuperation' | 'aggravation';
  etabli: boolean;
  duree?: string;
  nouvelleGravite?: BlessureNarrative['gravite'];
  nouvelleDescription?: string;
  contraintesRetirees?: string[];
  contraintesAjoutees?: string[];
  soinsAjoutes?: string[];
  evolution?: string;
  justification: string;
  sourceIds: string[];
}

export interface EvaluationTraitementM06 {
  traitementId: string;
  blessureId: string;
  applicable: boolean;
  raisons: string[];
  blocages: string[];
}

export interface TransitionBlessureM06 {
  id: string;
  blessureId: string;
  cibleId: string;
  avant: BlessureNarrative;
  apres: BlessureNarrative;
  justification: string;
  sourceIds: string[];
}

export interface ConditionPerceptionM06 {
  id: string;
  acteurId: string;
  cibleId?: string;
  type: 'vue' | 'ouie' | 'contact' | 'acces' | 'autre';
  accessible: boolean;
  raison: string;
  sourceIds: string[];
}

export interface OptionReactionTiersM06 {
  id: string;
  acteurId: string;
  type: TypeReactionTiersM06;
  description: string;
  moyensRequis?: string[];
  moyensDisponibles?: string[];
  physiquementPossible: boolean;
  justification: string;
  sourceIds: string[];
}

export interface EvaluationReactionTiersM06 {
  optionId: string;
  acteurId: string;
  physiquementPossible: boolean;
  moyensManquants: string[];
  raisons: string[];
}

export interface EntreeM06 {
  contexte: ContexteNarratifV21;
  tentatives?: TentativeMaterielleM06[];
  mecanismes?: MecanismeMondeM06[];
  permissionsMort?: PermissionMortM06[];
  issuesNonLetales?: IssueNonLetalePlausibleM06[];
  deplacements?: DemandeDeplacementM06[];
  traitementsBlessures?: TraitementBlessureM06[];
  perceptions?: ConditionPerceptionM06[];
  optionsTiers?: OptionReactionTiersM06[];
  personnageJoueurId?: string;
}

export interface SortieM06 {
  moteur: typeof MOTEUR_M06;
  resultat: ResultatMoteur<ContributionSceneM01>;
  evaluationsFaisabilite: EvaluationFaisabiliteM06[];
  evaluationsDeplacements: EvaluationDeplacementM06[];
  transitionsPositions: TransitionPositionM06[];
  evaluationsTraitements: EvaluationTraitementM06[];
  transitionsBlessures: TransitionBlessureM06[];
  perceptions: ConditionPerceptionM06[];
  evaluationsTiers: EvaluationReactionTiersM06[];
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

function contientEquivalent(collection: string[], valeur: string): boolean {
  const cible = normaliser(valeur);
  if (!cible) return false;
  return collection.some((element) => normaliser(element) === cible);
}

function sourceTechnique(id: string): SourceNarrative {
  return {
    id,
    type: 'autre',
    description: 'Référence technique M06 à relier à une source matérielle ou règle de monde établie.',
  };
}

function positionParEntite(
  situation: SituationPhysique,
  entiteId: string,
): PositionPhysique | undefined {
  return situation.positions.find((position) => position.entiteId === entiteId);
}

function blessureParId(
  situation: SituationPhysique,
  blessureId: string,
): BlessureNarrative | undefined {
  return situation.blessures.find((blessure) => blessure.id === blessureId);
}

function mecanismeParId(
  mecanismes: MecanismeMondeM06[],
  id: string,
): MecanismeMondeM06 | undefined {
  return mecanismes.find((mecanisme) => mecanisme.id === id);
}

function permissionMortApplicable(
  entree: EntreeM06,
  tentative: TentativeMaterielleM06,
): boolean {
  if (!entree.personnageJoueurId) return true;
  if (tentative.tentative.auteurId !== entree.personnageJoueurId) return true;

  const permissions = entree.permissionsMort ?? [];

  return permissions.some((permission) => {
    if (permission.personnageId !== entree.personnageJoueurId) return false;
    if (!permission.autorisee) return false;

    if (permission.portee === 'campagne') return true;

    if (permission.portee === 'scene') {
      if (!permission.sceneId) return true;
      return permission.sceneId === entree.contexte.scene.id;
    }

    return (permission.tentativeIds ?? []).includes(tentative.tentative.id);
  });
}

function issuesNonLetalesPourTentative(
  entree: EntreeM06,
  tentativeId: string,
): IssueNonLetalePlausibleM06[] {
  return (entree.issuesNonLetales ?? []).filter(
    (issue) => issue.tentativeId === tentativeId && issue.plausible,
  );
}

function verifierMecanismes(
  tentative: TentativeMaterielleM06,
  mecanismes: MecanismeMondeM06[],
): {
  valides: string[];
  invalides: string[];
  contraintes: string[];
} {
  const valides: string[] = [];
  const invalides: string[] = [];
  const contraintes: string[] = [];

  for (const id of tentative.mecanismeIds ?? []) {
    const mecanisme = mecanismeParId(mecanismes, id);

    if (!mecanisme) {
      invalides.push(id);
      contraintes.push(`Mécanisme ${id} absent du profil de monde applicable.`);
      continue;
    }

    if (!mecanisme.etabli) {
      invalides.push(id);
      contraintes.push(
        `Mécanisme ${mecanisme.nom} non établi : il ne peut pas résoudre la difficulté par simple improvisation.`,
      );
      continue;
    }

    if (
      mecanisme.zonesInterdites?.some(
        (zone) => normaliser(zone) === normaliser(entreeLieuTentative(tentative)),
      )
    ) {
      invalides.push(id);
      contraintes.push(`${mecanisme.nom} est établi comme indisponible dans cette zone.`);
      continue;
    }

    if (
      mecanisme.zonesAutorisees &&
      mecanisme.zonesAutorisees.length > 0 &&
      !mecanisme.zonesAutorisees.some(
        (zone) => normaliser(zone) === normaliser(entreeLieuTentative(tentative)),
      )
    ) {
      invalides.push(id);
      contraintes.push(`${mecanisme.nom} n'est pas établi comme utilisable dans ce lieu.`);
      continue;
    }

    valides.push(id);
    contraintes.push(...(mecanisme.limites ?? []));
  }

  return {
    valides: uniquesTextes(valides),
    invalides: uniquesTextes(invalides),
    contraintes: uniquesTextes(contraintes),
  };
}

function entreeLieuTentative(tentative: TentativeMaterielleM06): string {
  return tentative.lieuCible ?? '';
}

function verifierPosition(
  contexte: ContexteNarratifV21,
  tentative: TentativeMaterielleM06,
): string[] {
  const contraintes: string[] = [];
  const auteur = positionParEntite(
    contexte.situationPhysique,
    tentative.tentative.auteurId,
  );

  if (tentative.lieuCible && auteur) {
    const memeLieu = normaliser(auteur.lieu) === normaliser(tentative.lieuCible);
    if (!memeLieu) {
      contraintes.push(
        `L'auteur se trouve à ${auteur.lieu} et la cible matérielle est située à ${tentative.lieuCible} : un déplacement ou un moyen à distance doit être établi.`,
      );
    }
  }

  return contraintes;
}

function verifierMoyens(
  contexte: ContexteNarratifV21,
  tentative: TentativeMaterielleM06,
): string[] {
  const disponibles = contexte.situationPhysique.moyensDisponibles;
  const manquants: string[] = [];

  for (const moyen of tentative.tentative.moyens) {
    if (!contientEquivalent(disponibles, moyen)) {
      manquants.push(moyen);
    }
  }

  return manquants;
}

function verifierBlessures(
  contexte: ContexteNarratifV21,
  tentative: TentativeMaterielleM06,
): {
  pertinentes: string[];
  contraintes: string[];
  interdit: boolean;
  ajouteRisque: boolean;
} {
  const pertinentes: string[] = [];
  const contraintes: string[] = [];
  let interdit = false;
  let ajouteRisque = false;

  for (const impact of tentative.impactsBlessures ?? []) {
    const blessure = blessureParId(
      contexte.situationPhysique,
      impact.blessureId,
    );

    if (!blessure) {
      contraintes.push(
        `Impact ${impact.id} ignoré : blessure ${impact.blessureId} absente de l'état physique applicable.`,
      );
      continue;
    }

    if (blessure.cibleId !== tentative.tentative.auteurId) {
      contraintes.push(
        `Impact ${impact.id} ignoré : la blessure ${impact.blessureId} n'appartient pas à l'auteur de la tentative.`,
      );
      continue;
    }

    pertinentes.push(blessure.id);

    if (impact.effet === 'interdit') {
      interdit = true;
      contraintes.push(impact.justification);
    } else if (impact.effet === 'risque') {
      ajouteRisque = true;
      contraintes.push(impact.justification);
    } else if (impact.effet === 'gene') {
      contraintes.push(impact.justification);
    }
  }

  return {
    pertinentes: uniquesTextes(pertinentes),
    contraintes: uniquesTextes(contraintes),
    interdit,
    ajouteRisque,
  };
}

function evaluerFaisabilite(
  entree: EntreeM06,
  tentative: TentativeMaterielleM06,
): EvaluationFaisabiliteM06 {
  const raisons: string[] = [];
  const contraintes: string[] = [];
  const mecanismes = verifierMecanismes(tentative, entree.mecanismes ?? []);
  const moyensManquants = verifierMoyens(entree.contexte, tentative);
  const blessures = verifierBlessures(entree.contexte, tentative);
  const exigencesManquantes = (tentative.exigences ?? [])
    .filter((exigence) => exigence.obligatoire && !exigence.satisfaite)
    .map((exigence) => exigence.description);

  contraintes.push(...mecanismes.contraintes);
  contraintes.push(...verifierPosition(entree.contexte, tentative));
  contraintes.push(...blessures.contraintes);

  if (moyensManquants.length > 0) {
    contraintes.push(
      `Moyens non établis comme disponibles : ${moyensManquants.join(', ')}.`,
    );
  }

  if (exigencesManquantes.length > 0) {
    contraintes.push(...exigencesManquantes);
  }

  if (mecanismes.invalides.length > 0) {
    contraintes.push(
      `Mécanismes indisponibles ou non établis : ${mecanismes.invalides.join(', ')}.`,
    );
  }

  const permissionMort = permissionMortApplicable(entree, tentative);
  const risqueMortel = Boolean(tentative.issueMortellePossible);
  const concerneJoueur =
    Boolean(entree.personnageJoueurId) &&
    tentative.tentative.auteurId === entree.personnageJoueurId;
  const alternatives = issuesNonLetalesPourTentative(
    entree,
    tentative.tentative.id,
  );

  let clarificationNecessaire = false;

  if (concerneJoueur && risqueMortel && !permissionMort) {
    if (alternatives.length > 0) {
      raisons.push(
        `La mort définitive n'est pas autorisée ; seules des issues non létales réellement plausibles peuvent être proposées à M14 : ${alternatives
          .map((issue) => issue.description)
          .join(' ; ')}.`,
      );
    } else if (!tentative.engagee) {
      clarificationNecessaire = true;
      contraintes.push(
        'La tentative expose à une issue mortelle et aucune issue non létale plausible n’est établie ; la résolution doit être suspendue avant engagement.',
      );
    } else {
      contraintes.push(
        'La tentative est déjà engagée : M06 ne fabrique ni sauvetage, ni capture, ni pouvoir rétroactif. Le Kernel doit traiter explicitement l’incompatibilité.',
      );
    }
  }

  const impossible =
    mecanismes.invalides.length > 0 ||
    moyensManquants.length > 0 ||
    exigencesManquantes.length > 0 ||
    blessures.interdit;

  let statut: StatutFaisabiliteM06;

  if (clarificationNecessaire) {
    statut = 'a_clarifier';
  } else if (impossible) {
    statut = 'impossible';
  } else if (
    blessures.ajouteRisque ||
    (tentative.risques ?? []).length > 0 ||
    risqueMortel
  ) {
    statut = 'possible_avec_risque';
  } else {
    statut = 'possible';
  }

  if (statut === 'possible') {
    raisons.push('Les contraintes matérielles connues permettent cette tentative.');
  } else if (statut === 'possible_avec_risque') {
    raisons.push('La tentative reste matériellement possible mais comporte des risques établis.');
  } else if (statut === 'impossible') {
    raisons.push('Au moins une condition matérielle obligatoire n’est pas satisfaite.');
  }

  return {
    tentativeId: tentative.tentative.id,
    auteurId: tentative.tentative.auteurId,
    statut,
    raisons: uniquesTextes(raisons),
    contraintes: uniquesTextes(contraintes),
    risques: uniquesParCle(tentative.risques ?? [], (risque) => risque.id),
    mecanismesUtilises: mecanismes.valides,
    exigencesManquantes: uniquesTextes([
      ...exigencesManquantes,
      ...moyensManquants.map((moyen) => `Moyen requis : ${moyen}`),
      ...mecanismes.invalides.map((id) => `Mécanisme requis : ${id}`),
    ]),
    blessuresPertinentes: blessures.pertinentes,
    risqueMortel,
    permissionMortApplicable: permissionMort,
    clarificationNecessaire,
  };
}

function evaluerDeplacement(
  contexte: ContexteNarratifV21,
  demande: DemandeDeplacementM06,
): EvaluationDeplacementM06 {
  const position = positionParEntite(contexte.situationPhysique, demande.entiteId);
  const raisons: string[] = [];
  const blocages: string[] = [];

  if (!position) {
    blocages.push(
      `Position actuelle de ${demande.entiteId} inconnue : M06 ne peut pas téléporter l'entité pour combler la lacune.`,
    );
  }

  if (
    position &&
    demande.depuisLieuAttendu &&
    normaliser(position.lieu) !== normaliser(demande.depuisLieuAttendu)
  ) {
    blocages.push(
      `Position incohérente : ${demande.entiteId} est établi à ${position.lieu}, pas à ${demande.depuisLieuAttendu}.`,
    );
  }

  if (!demande.conditionsSatisfaites) {
    blocages.push('Les conditions matérielles du déplacement ne sont pas établies comme satisfaites.');
  }

  if (blocages.length === 0) {
    raisons.push('Le déplacement dispose d’un état de départ et de conditions matérielles compatibles.');
  }

  return {
    demandeId: demande.id,
    entiteId: demande.entiteId,
    applicable: blocages.length === 0,
    positionActuelle: position,
    raisons,
    blocages,
  };
}

function construireTransitionsPositions(
  demandes: DemandeDeplacementM06[],
  evaluations: EvaluationDeplacementM06[],
): TransitionPositionM06[] {
  const resultat: TransitionPositionM06[] = [];

  for (const demande of demandes) {
    const evaluation = evaluations.find(
      (item) => item.demandeId === demande.id,
    );
    if (!evaluation?.applicable) continue;

    resultat.push({
      id: `m06-position-${normaliser(demande.id)}`,
      entiteId: demande.entiteId,
      positionAvant: evaluation.positionActuelle,
      positionApres: {
        entiteId: demande.entiteId,
        lieu: demande.versLieu,
        precision: demande.versPrecision,
      },
      justification: demande.justification,
      sourceIds: uniquesTextes(demande.sourceIds),
    });
  }

  return resultat;
}

function evaluerTraitement(
  contexte: ContexteNarratifV21,
  traitement: TraitementBlessureM06,
): EvaluationTraitementM06 {
  const blessure = blessureParId(
    contexte.situationPhysique,
    traitement.blessureId,
  );
  const raisons: string[] = [];
  const blocages: string[] = [];

  if (!blessure) {
    blocages.push(`Blessure ${traitement.blessureId} absente de l'état physique.`);
  }

  if (!traitement.etabli) {
    blocages.push(
      'Le soin, le repos, la récupération ou l’aggravation n’est pas établi : M06 ne crée pas une transition physique par simple ellipse.',
    );
  }

  if (traitement.sourceIds.length === 0) {
    blocages.push('Aucune provenance n’établit la transition physique proposée.');
  }

  if (blocages.length === 0) {
    raisons.push(
      'La transition est rattachée à une blessure existante et à un processus matériel établi.',
    );
  }

  return {
    traitementId: traitement.id,
    blessureId: traitement.blessureId,
    applicable: blocages.length === 0,
    raisons,
    blocages,
  };
}

function retirerContraintes(
  contraintes: string[],
  aRetirer: string[],
): string[] {
  const retraits = new Set(aRetirer.map(normaliser));
  return contraintes.filter((contrainte) => !retraits.has(normaliser(contrainte)));
}

function construireTransitionsBlessures(
  contexte: ContexteNarratifV21,
  traitements: TraitementBlessureM06[],
  evaluations: EvaluationTraitementM06[],
): TransitionBlessureM06[] {
  const resultat: TransitionBlessureM06[] = [];

  for (const traitement of traitements) {
    const evaluation = evaluations.find(
      (item) => item.traitementId === traitement.id,
    );
    if (!evaluation?.applicable) continue;

    const avant = blessureParId(
      contexte.situationPhysique,
      traitement.blessureId,
    );
    if (!avant) continue;

    const contraintesBase = retirerContraintes(
      avant.contraintes,
      traitement.contraintesRetirees ?? [],
    );

    const apres: BlessureNarrative = {
      ...avant,
      description: traitement.nouvelleDescription ?? avant.description,
      gravite: traitement.nouvelleGravite ?? avant.gravite,
      contraintes: uniquesTextes([
        ...contraintesBase,
        ...(traitement.contraintesAjoutees ?? []),
      ]),
      soins: uniquesTextes([
        ...avant.soins,
        ...(traitement.soinsAjoutes ?? []),
      ]),
      evolution: traitement.evolution ?? avant.evolution,
    };

    resultat.push({
      id: `m06-blessure-${normaliser(traitement.id)}`,
      blessureId: avant.id,
      cibleId: avant.cibleId,
      avant,
      apres,
      justification: traitement.justification,
      sourceIds: uniquesTextes(traitement.sourceIds),
    });
  }

  return resultat;
}

function evaluerReactionTiers(
  option: OptionReactionTiersM06,
): EvaluationReactionTiersM06 {
  const requis = option.moyensRequis ?? [];
  const disponibles = option.moyensDisponibles ?? [];
  const manquants = requis.filter(
    (moyen) => !contientEquivalent(disponibles, moyen),
  );

  const possible = option.physiquementPossible && manquants.length === 0;
  const raisons = possible
    ? ['La réaction est matériellement possible avec les moyens établis.']
    : [
        ...(!option.physiquementPossible
          ? ['La réaction est explicitement établie comme matériellement impossible.']
          : []),
        ...(manquants.length > 0
          ? [`Moyens manquants : ${manquants.join(', ')}.`]
          : []),
      ];

  return {
    optionId: option.id,
    acteurId: option.acteurId,
    physiquementPossible: possible,
    moyensManquants: manquants,
    raisons,
  };
}

function transitionPositionVersProposition(
  transition: TransitionPositionM06,
): PropositionTransition<PositionPhysique> {
  return {
    id: transition.id,
    moteurProprietaire: MOTEUR_M06,
    domaine: 'physique',
    categorie: 'materielle',
    cibleIds: [transition.entiteId],
    justification: transition.justification,
    sourceIds: transition.sourceIds,
    valeurProposee: transition.positionApres,
    perceptible: true,
    transmissible: true,
  };
}

function transitionBlessureVersProposition(
  transition: TransitionBlessureM06,
): PropositionTransition<BlessureNarrative> {
  return {
    id: transition.id,
    moteurProprietaire: MOTEUR_M06,
    domaine: 'physique',
    categorie: 'materielle',
    cibleIds: [transition.cibleId],
    justification: transition.justification,
    sourceIds: transition.sourceIds,
    valeurProposee: transition.apres,
    perceptible: true,
    transmissible: true,
  };
}

function premierBlocageMort(
  entree: EntreeM06,
  evaluations: EvaluationFaisabiliteM06[],
): BlocageNarratif | undefined {
  const evaluation = evaluations.find(
    (item) => item.clarificationNecessaire,
  );
  if (!evaluation) return undefined;

  const tentative = (entree.tentatives ?? []).find(
    (item) => item.tentative.id === evaluation.tentativeId,
  );

  return {
    type: 'limite',
    raison:
      'Une tentative matériellement létale entre en conflit avec la protection de mort définitive et aucune issue non létale plausible n’est établie.',
    questionClarification:
      'Cette action conduirait à un risque mortel dans les conditions établies. Veux-tu modifier l’action ou autoriser explicitement ce risque pour cette tentative ?',
    sources: uniquesTextes([
      ...(tentative?.tentative.connaissanceAccessible ?? []),
      ...(tentative?.risques ?? []).flatMap((risque) => risque.sourceIds),
    ]).map(sourceTechnique),
  };
}

function controlesM06(
  evaluations: EvaluationFaisabiliteM06[],
  transitionsPositions: TransitionPositionM06[],
  transitionsBlessures: TransitionBlessureM06[],
): ControleNarratif[] {
  const contradictionPosition = transitionsPositions.some(
    (transition) =>
      transition.positionAvant &&
      normaliser(transition.positionAvant.lieu) ===
        normaliser(transition.positionApres.lieu) &&
      normaliser(transition.positionAvant.precision) ===
        normaliser(transition.positionApres.precision),
  );

  const transitionSansSource = [
    ...transitionsPositions,
    ...transitionsBlessures,
  ].some((transition) => transition.sourceIds.length === 0);

  const impossibleDeclarePossible = evaluations.some(
    (evaluation) =>
      evaluation.statut === 'possible' &&
      evaluation.exigencesManquantes.length > 0,
  );

  return [
    {
      id: 'causalite',
      ok: !impossibleDeclarePossible,
      raison: impossibleDeclarePossible
        ? 'Une tentative a été déclarée possible malgré une condition matérielle obligatoire manquante.'
        : 'M06 sépare possibilité matérielle, risque et issue ; M14 reste propriétaire du résultat contesté.',
    },
    {
      id: 'continuite',
      ok: !contradictionPosition && !transitionSansSource,
      raison:
        contradictionPosition || transitionSansSource
          ? 'Une transition physique manque de provenance ou ne décrit aucun changement matériel identifiable.'
          : 'Les changements de position et de blessure sont proposés comme transitions causales tracées.',
    },
    {
      id: 'agentivite',
      ok: true,
      raison:
        'M06 décrit les contraintes et effets externes possibles sans inventer pensée, émotion ou décision volontaire du joueur.',
    },
    {
      id: 'limites',
      ok: evaluations.every(
        (evaluation) =>
          !(
            evaluation.risqueMortel &&
            !evaluation.permissionMortApplicable &&
            evaluation.statut === 'possible'
          ),
      ),
      raison:
        'La permission de mort définitive est consultée comme une autorité externe de M13 et n’est pas dupliquée dans M06.',
    },
  ];
}

function pointsAMontrer(
  evaluations: EvaluationFaisabiliteM06[],
  perceptions: ConditionPerceptionM06[],
  transitionsBlessures: TransitionBlessureM06[],
): string[] {
  const points: string[] = [];

  for (const evaluation of evaluations) {
    if (evaluation.statut === 'impossible') {
      points.push(
        `La tentative ${evaluation.tentativeId} rencontre une impossibilité matérielle identifiable.`,
      );
    } else if (evaluation.statut === 'possible_avec_risque') {
      points.push(
        `La tentative ${evaluation.tentativeId} est possible mais ses risques matériels doivent rester perceptibles.`,
      );
    } else if (evaluation.statut === 'a_clarifier') {
      points.push(
        `La tentative ${evaluation.tentativeId} doit être suspendue avant résolution en raison d'une incompatibilité entre risque mortel et protection active.`,
      );
    }
  }

  for (const perception of perceptions) {
    if (perception.accessible) {
      points.push(
        `${perception.acteurId} peut matériellement percevoir ${perception.cibleId ?? 'l’élément concerné'} par ${perception.type}.`,
      );
    }
  }

  for (const transition of transitionsBlessures) {
    points.push(
      `Évolution physique de ${transition.cibleId} : ${transition.apres.description}`,
    );
  }

  return uniquesTextes(points);
}

function contributionM01(
  evaluations: EvaluationFaisabiliteM06[],
  perceptions: ConditionPerceptionM06[],
  transitionsBlessures: TransitionBlessureM06[],
  controles: ControleNarratif[],
): ContributionSceneM01 {
  return {
    pointsAMontrer: pointsAMontrer(
      evaluations,
      perceptions,
      transitionsBlessures,
    ),
    contraintes: uniquesTextes([
      'Respecter positions, distances, équipements, blessures, temps, technologie et pouvoirs effectivement établis.',
      'Un mécanisme inhabituel doit être établi avant de servir à résoudre une difficulté ; ne pas inventer de coût ou de faiblesse universels absents du monde.',
      'Une blessure agit selon ses contraintes fonctionnelles : elle ne devient ni jauge de points de vie ni incapacité universelle.',
      'M06 définit ce qui est possible ou risqué ; M14 reste propriétaire de la réussite, de l’échec ou de l’interruption.',
      'La permission de mort définitive vient de M13 ; le mode adulte ou la violence du monde ne valent jamais permission de mort.',
      'Une entité ne change pas de lieu sans transition matérielle établie et un objet ne peut être à deux endroits simultanément.',
      ...evaluations.flatMap((evaluation) => evaluation.contraintes),
    ]),
    interditsNarratifs: [
      'Ne pas créer une magie, un don, une technologie, un outil ou une faiblesse décisive pour équilibrer artificiellement une scène.',
      'Ne pas inventer un sauveur, une capture ou une voie de fuite uniquement pour éviter une issue mortelle incompatible.',
      'Ne pas effacer une blessure au changement de scène ni maintenir exactement la même gêne après une guérison établie.',
      'Ne pas téléporter une personne ou un objet pour réparer une lacune de continuité.',
      'Ne pas transformer une précision absente en mesure métrique arbitraire donnant une fausse impression de simulation.',
      'Ne pas imposer une réaction uniforme aux témoins ; leur intervention éventuelle dépend de leurs moyens et de leurs autres responsabilités.',
    ],
    controles,
  };
}

/**
 * Exécute M06 sans appel de modèle et sans mutation directe de la partie.
 *
 * Les sorties matérielles sont des évaluations et propositions. Les issues
 * contestées restent à M14 ; les permissions réelles restent à M13 ; les
 * décisions volontaires du joueur restent à M07.
 */
export function executerM06(entree: EntreeM06): SortieM06 {
  const tentatives = entree.tentatives ?? [];
  const deplacements = entree.deplacements ?? [];
  const traitements = entree.traitementsBlessures ?? [];
  const perceptions = entree.perceptions ?? [];
  const optionsTiers = entree.optionsTiers ?? [];
  const alertes: string[] = [];

  const evaluationsFaisabilite = tentatives.map((tentative) =>
    evaluerFaisabilite(entree, tentative),
  );

  for (const evaluation of evaluationsFaisabilite) {
    if (evaluation.statut === 'impossible') {
      alertes.push(
        `Tentative ${evaluation.tentativeId} matériellement impossible dans l'état courant.`,
      );
    }
    if (evaluation.clarificationNecessaire) {
      alertes.push(
        `Tentative ${evaluation.tentativeId} suspendue : risque mortel incompatible avec la protection active et aucune issue non létale plausible établie.`,
      );
    }
  }

  const evaluationsDeplacements = deplacements.map((demande) =>
    evaluerDeplacement(entree.contexte, demande),
  );

  for (const evaluation of evaluationsDeplacements) {
    alertes.push(
      ...evaluation.blocages.map(
        (blocage) => `Déplacement ${evaluation.demandeId} ignoré : ${blocage}`,
      ),
    );
  }

  const transitionsPositions = construireTransitionsPositions(
    deplacements,
    evaluationsDeplacements,
  );

  const evaluationsTraitements = traitements.map((traitement) =>
    evaluerTraitement(entree.contexte, traitement),
  );

  for (const evaluation of evaluationsTraitements) {
    alertes.push(
      ...evaluation.blocages.map(
        (blocage) => `Traitement ${evaluation.traitementId} ignoré : ${blocage}`,
      ),
    );
  }

  const transitionsBlessures = construireTransitionsBlessures(
    entree.contexte,
    traitements,
    evaluationsTraitements,
  );

  const evaluationsTiers = optionsTiers.map(evaluerReactionTiers);

  const controles = controlesM06(
    evaluationsFaisabilite,
    transitionsPositions,
    transitionsBlessures,
  );

  const contribution = contributionM01(
    evaluationsFaisabilite,
    perceptions,
    transitionsBlessures,
    controles,
  );

  const transitions: PropositionTransition[] = [
    ...transitionsPositions.map(transitionPositionVersProposition),
    ...transitionsBlessures.map(transitionBlessureVersProposition),
  ];

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M06,
    contribution,
    transitions: uniquesParCle(transitions, (transition) => transition.id),
    contraintes: uniquesTextes([
      ...(contribution.contraintes ?? []),
      ...evaluationsFaisabilite.flatMap((evaluation) => evaluation.contraintes),
      ...evaluationsDeplacements.flatMap((evaluation) => evaluation.blocages),
      ...evaluationsTraitements.flatMap((evaluation) => evaluation.blocages),
    ]),
    alertes: uniquesTextes(alertes),
    blocage: premierBlocageMort(entree, evaluationsFaisabilite),
  };

  return {
    moteur: MOTEUR_M06,
    resultat,
    evaluationsFaisabilite,
    evaluationsDeplacements,
    transitionsPositions,
    evaluationsTraitements,
    transitionsBlessures,
    perceptions: uniquesParCle(perceptions, (perception) => perception.id),
    evaluationsTiers,
    alertes: resultat.alertes,
  };
}

export function sourceTechniqueM06(id: string): SourceNarrative {
  return sourceTechnique(id);
}
