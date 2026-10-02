// Elyndor — Noyau narratif natif V2.1
// M08 — Registre et style narratif.
//
// M08 transforme le profil de rendu actif en directives de mise en scène
// compactes. Il règle comment raconter, jamais ce qui s'est matériellement
// produit. Les faits, blessures, relations, décisions et résultats restent
// sous l'autorité de leurs moteurs propriétaires.

import type { ContributionSceneM01 } from './m01-production';
import type {
  BlocageNarratif,
  ContexteNarratifV21,
  ControleNarratif,
  LimiteActive,
  NiveauRendu,
  ProfilRenduNarratif,
  ResultatMoteur,
} from './types';

export const MOTEUR_M08 = 'M08' as const;

export type TypeSceneM08 =
  | 'combat'
  | 'dialogue'
  | 'exploration'
  | 'tension'
  | 'repos'
  | 'romance'
  | 'intimite'
  | 'hors_fiction'
  | 'autre';

export type IntensiteSceneM08 = 'calme' | 'moderee' | 'intense';

export type DimensionGradueeM08 =
  | 'violence'
  | 'romance'
  | 'crudite'
  | 'detail'
  | 'humour';

export type DimensionRenduM08 =
  | DimensionGradueeM08
  | 'ton'
  | 'longueur'
  | 'rythme'
  | 'creativite'
  | 'point_de_vue'
  | 'sensoriel'
  | 'mystere'
  | 'exploration'
  | 'voix';

export type RaisonInactiviteM08 =
  | 'absente_scene'
  | 'desactivee_profil'
  | 'interdite_m13'
  | 'non_configuree'
  | 'hors_fiction';

export interface VoixPersonnageM08 {
  personnageId: string;
  description: string;
  contraintes?: string[];
}

export interface SignalSceneM08 {
  type: TypeSceneM08;
  intensite?: IntensiteSceneM08;

  /**
   * Dimensions réellement présentes dans la scène. Une valeur de profil élevée
   * ne suffit pas, à elle seule, à rendre une dimension pertinente.
   */
  dimensionsPresentes?: DimensionRenduM08[];

  /** Faits et effets déjà établis que le rendu peut seulement mettre en scène. */
  faitsEtablis?: string[];
  effetsEtablis?: string[];

  /** Thèmes descriptifs utiles au cadrage, sans devenir des faits nouveaux. */
  themes?: string[];

  pointDeVue?: string;
  voixPersonnages?: VoixPersonnageM08[];
}

export interface BlocageTrajectoireM13PourM08 {
  raison: string;
  questionClarification?: string;
  sourceIds?: string[];
}

/**
 * Vue de consommation de M13 par M08.
 * M08 n'en est pas propriétaire : ces données doivent être calculées par M13
 * ou par un adaptateur temporaire du Kernel, jamais persistées comme second
 * état de limites dans M08.
 */
export interface PerimetreM13PourM08 {
  arretActif?: boolean;
  dimensionsInterdites?: DimensionGradueeM08[];
  intensiteMaxParDimension?: Partial<Record<DimensionGradueeM08, NiveauRendu>>;
  reductionsPonctuelles?: Partial<Record<DimensionGradueeM08, NiveauRendu>>;
  themesInterdits?: string[];
  blocageTrajectoire?: BlocageTrajectoireM13PourM08;
  sourceIds?: string[];
}

export interface EvaluationDimensionM08 {
  dimension: DimensionRenduM08;
  presenteDansScene: boolean;
  active: boolean;
  niveauDemande?: NiveauRendu;
  niveauEffectif?: NiveauRendu;
  raisonInactivite?: RaisonInactiviteM08;
  contrainteM13: boolean;
  justification: string;
}

export interface DirectiveRenduM08 {
  id: string;
  dimension?: DimensionRenduM08;
  texte: string;
  priorite: 'haute' | 'normale' | 'basse';
}

export interface ProfilRenduEffectifM08 {
  profilSource: ProfilRenduNarratif;
  mode: ProfilRenduNarratif['mode'];
  ton?: string;
  violence: NiveauRendu;
  romance: NiveauRendu;
  crudite?: NiveauRendu;
  detail?: NiveauRendu;
  longueur?: string;
  rythme?: string;
  creativite?: string;
  humour?: NiveauRendu;
  autresPreferences: Record<string, string | number | boolean>;
}

export interface EntreeM08 {
  contexte: ContexteNarratifV21;
  scene?: SignalSceneM08;

  /**
   * Périmètre explicite fourni par M13 lorsqu'il est disponible.
   * En son absence, M08 ne déduit que les limites dont le thème correspond
   * explicitement à une dimension de rendu connue.
   */
  perimetreM13?: PerimetreM13PourM08;

  /**
   * Anti-répétition : éléments récemment surutilisés à éviter dans ce tour.
   * Cette liste est une entrée de travail, pas une mémoire persistante M08.
   */
  motifsRecents?: string[];
}

export interface SortieM08 {
  moteur: typeof MOTEUR_M08;
  resultat: ResultatMoteur<ContributionSceneM01>;
  profilEffectif: ProfilRenduEffectifM08;
  evaluationsDimensions: EvaluationDimensionM08[];
  directives: DirectiveRenduM08[];
  dimensionsActives: DimensionRenduM08[];
  dimensionsInactives: DimensionRenduM08[];
  alertes: string[];
}

const ORDRE_NIVEAUX: readonly NiveauRendu[] = [
  'desactive',
  'faible',
  'modere',
  'eleve',
  'maximal',
] as const;

const DIMENSIONS_GRADUEES: readonly DimensionGradueeM08[] = [
  'violence',
  'romance',
  'crudite',
  'detail',
  'humour',
] as const;

const DIMENSIONS_STRUCTURELLES: readonly DimensionRenduM08[] = [
  'ton',
  'detail',
  'longueur',
  'rythme',
  'creativite',
  'point_de_vue',
  'voix',
] as const;

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

function uniquesDimensions(
  valeurs: Iterable<DimensionRenduM08>,
): DimensionRenduM08[] {
  const resultat: DimensionRenduM08[] = [];
  const vus = new Set<DimensionRenduM08>();

  for (const valeur of valeurs) {
    if (vus.has(valeur)) continue;
    vus.add(valeur);
    resultat.push(valeur);
  }

  return resultat;
}

function niveauIndex(niveau: NiveauRendu): number {
  return ORDRE_NIVEAUX.indexOf(niveau);
}

function minNiveau(a: NiveauRendu, b: NiveauRendu): NiveauRendu {
  return niveauIndex(a) <= niveauIndex(b) ? a : b;
}

function estGraduee(
  dimension: DimensionRenduM08,
): dimension is DimensionGradueeM08 {
  return (DIMENSIONS_GRADUEES as readonly string[]).includes(dimension);
}

function niveauProfil(
  profil: ProfilRenduNarratif,
  dimension: DimensionGradueeM08,
): NiveauRendu | undefined {
  switch (dimension) {
    case 'violence':
      return profil.violence;
    case 'romance':
      return profil.romance;
    case 'crudite':
      return profil.crudite;
    case 'detail':
      return profil.detail;
    case 'humour':
      return profil.humour;
  }
}

function dimensionDepuisThemeLimite(
  theme: string,
): DimensionGradueeM08 | undefined {
  const cle = normaliser(theme).replace(/ /g, '_');

  if (cle === 'violence') return 'violence';
  if (cle === 'romance' || cle === 'romantique') return 'romance';
  if (cle === 'crudite' || cle === 'langage_cru') return 'crudite';
  if (cle === 'detail' || cle === 'niveau_de_detail') return 'detail';
  if (cle === 'humour') return 'humour';

  return undefined;
}

function fusionnerPerimetreM13(
  contexte: ContexteNarratifV21,
  explicite: PerimetreM13PourM08 | undefined,
): PerimetreM13PourM08 {
  const dimensionsInterdites = new Set<DimensionGradueeM08>(
    explicite?.dimensionsInterdites ?? [],
  );

  const intensiteMaxParDimension: Partial<
    Record<DimensionGradueeM08, NiveauRendu>
  > = {
    ...(explicite?.intensiteMaxParDimension ?? {}),
  };

  const reductionsPonctuelles: Partial<
    Record<DimensionGradueeM08, NiveauRendu>
  > = {
    ...(explicite?.reductionsPonctuelles ?? {}),
  };

  const themesInterdits = [...(explicite?.themesInterdits ?? [])];
  const sourceIds = [...(explicite?.sourceIds ?? [])];

  for (const limite of contexte.limitesActives) {
    const dimension = dimensionDepuisThemeLimite(limite.theme);

    if (!limite.autorisee) {
      themesInterdits.push(limite.theme);
      if (dimension) dimensionsInterdites.add(dimension);
    }

    if (limite.autorisee && dimension && limite.intensite) {
      const deja = intensiteMaxParDimension[dimension];
      intensiteMaxParDimension[dimension] = deja
        ? minNiveau(deja, limite.intensite)
        : limite.intensite;
    }

    if (limite.signalActuel && !limite.autorisee) {
      sourceIds.push(limite.source.id);
    }
  }

  return {
    arretActif:
      explicite?.arretActif === true || contexte.cadre.nature === 'arret',
    dimensionsInterdites: [...dimensionsInterdites],
    intensiteMaxParDimension,
    reductionsPonctuelles,
    themesInterdits: uniquesTextes(themesInterdits),
    blocageTrajectoire: explicite?.blocageTrajectoire,
    sourceIds: uniquesTextes(sourceIds),
  };
}

function dimensionsParTypeScene(type: TypeSceneM08): DimensionRenduM08[] {
  const structurelles = [...DIMENSIONS_STRUCTURELLES];

  switch (type) {
    case 'combat':
      return [...structurelles, 'violence', 'crudite', 'sensoriel'];
    case 'dialogue':
      return [...structurelles];
    case 'exploration':
      return [...structurelles, 'sensoriel', 'exploration'];
    case 'tension':
      return [...structurelles, 'sensoriel', 'mystere'];
    case 'repos':
      return [...structurelles, 'sensoriel'];
    case 'romance':
      return [...structurelles, 'romance', 'sensoriel'];
    case 'intimite':
      return [...structurelles, 'romance', 'crudite', 'sensoriel'];
    case 'hors_fiction':
      return ['longueur', 'ton'];
    case 'autre':
      return [...structurelles];
  }
}

function sceneEffective(entree: EntreeM08): SignalSceneM08 {
  if (entree.scene) {
    return {
      ...entree.scene,
      dimensionsPresentes: uniquesDimensions([
        ...dimensionsParTypeScene(entree.scene.type),
        ...(entree.scene.dimensionsPresentes ?? []),
      ]),
      pointDeVue: entree.scene.pointDeVue ?? entree.contexte.scene.pointDeVue,
    };
  }

  const type: TypeSceneM08 =
    entree.contexte.cadre.nature === 'fiction' ? 'autre' : 'hors_fiction';

  return {
    type,
    dimensionsPresentes: dimensionsParTypeScene(type),
    pointDeVue: entree.contexte.scene.pointDeVue,
  };
}

function dimensionConfiguree(
  profil: ProfilRenduNarratif,
  dimension: DimensionRenduM08,
): boolean {
  if (estGraduee(dimension)) {
    return niveauProfil(profil, dimension) !== undefined;
  }

  switch (dimension) {
    case 'ton':
      return propre(profil.ton).length > 0;
    case 'longueur':
      return propre(profil.longueur).length > 0;
    case 'rythme':
      return propre(profil.rythme).length > 0;
    case 'creativite':
      return propre(profil.creativite).length > 0;
    case 'point_de_vue':
      return true;
    case 'sensoriel':
    case 'mystere':
    case 'exploration':
    case 'voix':
      return true;
  }
}

function estDimensionContenuContextuelle(
  dimension: DimensionRenduM08,
): boolean {
  return dimension === 'violence' || dimension === 'romance' || dimension === 'humour';
}

function appliquerPlafondM13(
  niveau: NiveauRendu,
  dimension: DimensionGradueeM08,
  perimetre: PerimetreM13PourM08,
): { niveau: NiveauRendu; contraint: boolean } {
  let effectif = niveau;
  let contraint = false;

  const plafond = perimetre.intensiteMaxParDimension?.[dimension];
  if (plafond) {
    const suivant = minNiveau(effectif, plafond);
    contraint ||= suivant !== effectif;
    effectif = suivant;
  }

  const reduction = perimetre.reductionsPonctuelles?.[dimension];
  if (reduction) {
    const suivant = minNiveau(effectif, reduction);
    contraint ||= suivant !== effectif;
    effectif = suivant;
  }

  return { niveau: effectif, contraint };
}

function evaluerDimension(
  dimension: DimensionRenduM08,
  profil: ProfilRenduNarratif,
  scene: SignalSceneM08,
  perimetre: PerimetreM13PourM08,
): EvaluationDimensionM08 {
  const presentes = new Set(scene.dimensionsPresentes ?? []);
  const presenteDansScene = presentes.has(dimension);
  const configuree = dimensionConfiguree(profil, dimension);

  if (scene.type === 'hors_fiction' && dimension !== 'longueur' && dimension !== 'ton') {
    return {
      dimension,
      presenteDansScene,
      active: false,
      raisonInactivite: 'hors_fiction',
      contrainteM13: false,
      justification: 'Échange hors fiction : la dimension n’est pas mise en scène.',
    };
  }

  if (!configuree) {
    return {
      dimension,
      presenteDansScene,
      active: false,
      raisonInactivite: 'non_configuree',
      contrainteM13: false,
      justification: 'Aucun réglage actif ne définit cette dimension.',
    };
  }

  if (!presenteDansScene && estDimensionContenuContextuelle(dimension)) {
    return {
      dimension,
      presenteDansScene,
      active: false,
      niveauDemande: estGraduee(dimension)
        ? niveauProfil(profil, dimension)
        : undefined,
      raisonInactivite: 'absente_scene',
      contrainteM13: false,
      justification:
        'Le profil n’active pas à lui seul une dimension absente de la scène.',
    };
  }

  if (estGraduee(dimension)) {
    const niveauDemande = niveauProfil(profil, dimension);

    if (!niveauDemande) {
      return {
        dimension,
        presenteDansScene,
        active: false,
        raisonInactivite: 'non_configuree',
        contrainteM13: false,
        justification: 'Niveau non configuré pour cette dimension.',
      };
    }

    if (perimetre.dimensionsInterdites?.includes(dimension)) {
      return {
        dimension,
        presenteDansScene,
        active: false,
        niveauDemande,
        niveauEffectif: 'desactive',
        raisonInactivite: 'interdite_m13',
        contrainteM13: true,
        justification: 'La portée active fournie par M13 interdit cette dimension.',
      };
    }

    if (niveauDemande === 'desactive') {
      return {
        dimension,
        presenteDansScene,
        active: false,
        niveauDemande,
        niveauEffectif: 'desactive',
        raisonInactivite: 'desactivee_profil',
        contrainteM13: false,
        justification: 'La dimension est désactivée dans le profil de rendu.',
      };
    }

    const plafond = appliquerPlafondM13(niveauDemande, dimension, perimetre);

    if (plafond.niveau === 'desactive') {
      return {
        dimension,
        presenteDansScene,
        active: false,
        niveauDemande,
        niveauEffectif: plafond.niveau,
        raisonInactivite: 'interdite_m13',
        contrainteM13: true,
        justification:
          'La réduction active fournie par M13 désactive cette dimension pour le tour.',
      };
    }

    return {
      dimension,
      presenteDansScene,
      active: true,
      niveauDemande,
      niveauEffectif: plafond.niveau,
      contrainteM13: plafond.contraint,
      justification: plafond.contraint
        ? 'Dimension pertinente, ajustée au plafond actif de M13.'
        : 'Dimension pertinente, appliquée au niveau demandé.',
    };
  }

  return {
    dimension,
    presenteDansScene,
    active: true,
    contrainteM13: false,
    justification: 'Dimension structurelle applicable à la réalisation de la scène.',
  };
}

function toutesDimensionsAExaminer(scene: SignalSceneM08): DimensionRenduM08[] {
  return uniquesDimensions([
    ...DIMENSIONS_STRUCTURELLES,
    'violence',
    'romance',
    'crudite',
    'humour',
    'sensoriel',
    'mystere',
    'exploration',
    ...(scene.dimensionsPresentes ?? []),
  ]);
}

function evaluationParDimension(
  evaluations: EvaluationDimensionM08[],
  dimension: DimensionRenduM08,
): EvaluationDimensionM08 | undefined {
  return evaluations.find((evaluation) => evaluation.dimension === dimension);
}

function niveauEffectif(
  evaluations: EvaluationDimensionM08[],
  dimension: DimensionGradueeM08,
  fallback: NiveauRendu | undefined,
): NiveauRendu | undefined {
  const evaluation = evaluationParDimension(evaluations, dimension);
  return evaluation?.niveauEffectif ?? fallback;
}

function construireProfilEffectif(
  profil: ProfilRenduNarratif,
  evaluations: EvaluationDimensionM08[],
): ProfilRenduEffectifM08 {
  return {
    profilSource: profil,
    mode: profil.mode,
    ton: profil.ton,
    violence:
      niveauEffectif(evaluations, 'violence', profil.violence) ?? profil.violence,
    romance:
      niveauEffectif(evaluations, 'romance', profil.romance) ?? profil.romance,
    crudite: niveauEffectif(evaluations, 'crudite', profil.crudite),
    detail: niveauEffectif(evaluations, 'detail', profil.detail),
    longueur: profil.longueur,
    rythme: profil.rythme,
    creativite: profil.creativite,
    humour: niveauEffectif(evaluations, 'humour', profil.humour),
    autresPreferences: { ...profil.autresPreferences },
  };
}

function libelleNiveau(niveau: NiveauRendu): string {
  switch (niveau) {
    case 'desactive':
      return 'désactivé';
    case 'faible':
      return 'faible';
    case 'modere':
      return 'modéré';
    case 'eleve':
      return 'élevé';
    case 'maximal':
      return 'maximal';
  }
}

function directiveMode(profil: ProfilRenduEffectifM08): DirectiveRenduM08 {
  if (profil.mode === 'adulte') {
    return {
      id: 'm08-mode-adulte',
      dimension: 'ton',
      priorite: 'haute',
      texte:
        'Mode Adulte : utiliser la palette mature, sombre ou crue réellement configurée lorsque la scène la mobilise ; ne pas imposer une intensité maximale permanente et ne pas réduire automatiquement les niveaux élevés ou maximaux.',
    };
  }

  return {
    id: 'm08-mode-grand-public',
    dimension: 'ton',
    priorite: 'haute',
    texte:
      'Mode Grand public : conserver les faits du monde mais les présenter dans le périmètre de rendu correspondant au profil actif, sans transformer cette présentation en modification des événements.',
  };
}

function directiveTon(profil: ProfilRenduEffectifM08): DirectiveRenduM08 | undefined {
  const ton = propre(profil.ton);
  if (!ton) return undefined;

  return {
    id: 'm08-ton',
    dimension: 'ton',
    priorite: 'normale',
    texte: `Coloration de ton : ${ton}. Le ton ne change ni la vérité des faits ni la moralité des personnages.`,
  };
}

function directiveViolence(
  evaluation: EvaluationDimensionM08 | undefined,
): DirectiveRenduM08 | undefined {
  if (!evaluation?.active || !evaluation.niveauEffectif) return undefined;

  return {
    id: 'm08-violence',
    dimension: 'violence',
    priorite: 'haute',
    texte:
      `Violence ${libelleNiveau(evaluation.niveauEffectif)} : rendre la confrontation et ses effets établis avec ce niveau de dureté et de précision. ` +
      'Ne créer ni blessure supplémentaire, ni combat, ni gravité matérielle uniquement pour satisfaire le réglage.',
  };
}

function directiveRomance(
  evaluation: EvaluationDimensionM08 | undefined,
): DirectiveRenduM08 | undefined {
  if (!evaluation?.active || !evaluation.niveauEffectif) return undefined;

  return {
    id: 'm08-romance',
    dimension: 'romance',
    priorite: 'haute',
    texte:
      `Romance ${libelleNiveau(evaluation.niveauEffectif)} : développer uniquement les liens, la proximité ou l’intimité déjà pertinents dans la scène et compatibles avec leur histoire. ` +
      'Ne pas fabriquer attirance, réciprocité, consentement, âge, engagement ou évolution relationnelle.',
  };
}

function directiveCrudite(
  evaluation: EvaluationDimensionM08 | undefined,
): DirectiveRenduM08 | undefined {
  if (!evaluation?.active || !evaluation.niveauEffectif) return undefined;

  return {
    id: 'm08-crudite',
    dimension: 'crudite',
    priorite: 'normale',
    texte:
      `Crudité ${libelleNiveau(evaluation.niveauEffectif)} : ajuster la franchise lexicale et la rugosité de la narration à ce niveau, sans uniformiser la voix des personnages ni introduire un thème absent.`,
  };
}

function directiveDetail(
  evaluation: EvaluationDimensionM08 | undefined,
): DirectiveRenduM08 | undefined {
  if (!evaluation?.active || !evaluation.niveauEffectif) return undefined;

  return {
    id: 'm08-detail',
    dimension: 'detail',
    priorite: 'normale',
    texte:
      `Détail ${libelleNiveau(evaluation.niveauEffectif)} : régler la densité sensorielle, la précision des gestes et le développement des effets utiles. ` +
      'Le détail n’autorise aucun fait nouveau et ne prolonge pas artificiellement une action terminée.',
  };
}

function directiveHumour(
  evaluation: EvaluationDimensionM08 | undefined,
): DirectiveRenduM08 | undefined {
  if (!evaluation?.active || !evaluation.niveauEffectif) return undefined;

  return {
    id: 'm08-humour',
    dimension: 'humour',
    priorite: 'basse',
    texte:
      `Humour ${libelleNiveau(evaluation.niveauEffectif)} : l’utiliser seulement lorsqu’il est réellement présent ou pertinent dans la scène, sans casser les voix, la causalité ni une tension établie.`,
  };
}

function directiveLongueur(profil: ProfilRenduEffectifM08): DirectiveRenduM08 | undefined {
  const longueur = propre(profil.longueur);
  if (!longueur) return undefined;

  return {
    id: 'm08-longueur',
    dimension: 'longueur',
    priorite: 'normale',
    texte:
      `Longueur cible : ${longueur}. C’est une cible de densité et d’ampleur, pas une obligation de remplissage ni une permission d’ajouter des décisions, actions ou rebondissements inexistants.`,
  };
}

function directiveRythme(
  profil: ProfilRenduEffectifM08,
  scene: SignalSceneM08,
): DirectiveRenduM08 | undefined {
  const rythme = propre(profil.rythme);
  if (!rythme) return undefined;

  const forme = (() => {
    switch (scene.type) {
      case 'combat':
        return 'privilégier la lisibilité spatiale et les gestes précis';
      case 'dialogue':
        return 'privilégier les réponses adressées et la présence des interlocuteurs';
      case 'exploration':
        return 'privilégier les indices accessibles et quelques sensations choisies';
      case 'tension':
        return 'maintenir une incertitude compréhensible sans obscurcir les faits établis';
      case 'repos':
        return 'laisser de la respiration et du quotidien lorsque rien ne pousse la scène';
      case 'romance':
      case 'intimite':
        return 'laisser la proximité suivre l’histoire de la relation et le rythme choisi';
      case 'hors_fiction':
        return 'répondre directement sans simuler un tempo fictif';
      case 'autre':
        return 'adapter le découpage au moment présent sans cycle obligatoire';
    }
  })();

  return {
    id: 'm08-rythme',
    dimension: 'rythme',
    priorite: 'normale',
    texte:
      `Rythme ${rythme} : ${forme}. Le rythme ne fait pas avancer le temps fictif, une échéance ou un processus sans cause établie.`,
  };
}

function directiveCreativite(
  profil: ProfilRenduEffectifM08,
): DirectiveRenduM08 | undefined {
  const creativite = propre(profil.creativite);
  if (!creativite) return undefined;

  return {
    id: 'm08-creativite',
    dimension: 'creativite',
    priorite: 'normale',
    texte:
      `Créativité : ${creativite}. Élargir seulement les variantes compatibles avec le monde, l’identité, le passé et les connaissances situées ; une surprise ne peut pas être une contradiction présentée comme originalité.`,
  };
}

function directivePointDeVue(
  scene: SignalSceneM08,
  contexte: ContexteNarratifV21,
): DirectiveRenduM08 {
  const pointDeVue = propre(scene.pointDeVue ?? contexte.scene.pointDeVue);

  return {
    id: 'm08-point-de-vue',
    dimension: 'point_de_vue',
    priorite: 'haute',
    texte: pointDeVue
      ? `Point de vue : ${pointDeVue}. Montrer seulement ce qui est perceptible ou narrativement accessible depuis ce cadrage ; ne pas transformer un secret du noyau en connaissance d’un personnage.`
      : 'Respecter le cadrage perceptif de la scène et les connaissances situées ; ne pas transformer un secret du noyau en connaissance d’un personnage.',
  };
}

function directivesVoix(scene: SignalSceneM08): DirectiveRenduM08[] {
  const voix = scene.voixPersonnages ?? [];

  if (voix.length === 0) {
    return [
      {
        id: 'm08-voix-generale',
        dimension: 'voix',
        priorite: 'normale',
        texte:
          'Conserver des voix cohérentes avec l’identité, l’interlocuteur et l’état des personnages ; le niveau global de crudité ou d’humour ne doit pas leur donner les mêmes tics.',
      },
    ];
  }

  return voix.map((item) => ({
    id: `m08-voix-${item.personnageId}`,
    dimension: 'voix' as const,
    priorite: 'normale' as const,
    texte:
      `Voix ${item.personnageId} : ${propre(item.description)}.` +
      (item.contraintes?.length
        ? ` Contraintes : ${uniquesTextes(item.contraintes).join(' ; ')}.`
        : ''),
  }));
}

function directiveFormat(type: TypeSceneM08): DirectiveRenduM08 {
  if (type === 'hors_fiction') {
    return {
      id: 'm08-format-hors-fiction',
      priorite: 'haute',
      texte:
        'Échange hors fiction : répondre comme tel, sans le déguiser en événement du monde ni utiliser artificiellement la mise en scène RP.',
    };
  }

  return {
    id: 'm08-format-fiction',
    priorite: 'haute',
    texte:
      'Format RP par défaut : actions et narration entre astérisques, dialogues entre guillemets droits, paragraphes lisibles et interlocuteurs identifiables. Aucun HUD, jauge, calcul ou nom de moteur exposé.',
  };
}

function directiveIndependanceDimensions(): DirectiveRenduM08 {
  return {
    id: 'm08-independance-dimensions',
    priorite: 'haute',
    texte:
      'Les dimensions sont indépendantes : un niveau maximal de violence n’augmente ni romance, ni humour, ni longueur ; un détail élevé n’impose pas un rythme lent ; une crudité élevée n’uniformise pas les voix.',
  };
}

function directiveCausalite(): DirectiveRenduM08 {
  return {
    id: 'm08-causalite',
    priorite: 'haute',
    texte:
      'Le rendu décrit les faits et effets établis sans les amplifier matériellement : style, intensité, longueur et détail ne créent ni dommage, ni relation, ni résultat, ni sanction supplémentaire.',
  };
}

function directiveAntiRepetition(motifsRecents: string[]): DirectiveRenduM08 {
  const motifs = uniquesTextes(motifsRecents);

  return {
    id: 'm08-anti-repetition',
    priorite: 'normale',
    texte:
      motifs.length > 0
        ? `Éviter de répéter mécaniquement ces motifs récents sauf nécessité : ${motifs.join(' ; ')}. Varier gestes, clôtures et détails sans changer les faits.`
        : 'Éviter les mêmes gestes, surnoms, descriptions physiques et clôtures automatiques lorsqu’ils n’apportent rien de nouveau.',
  };
}

function directiveLimites(perimetre: PerimetreM13PourM08): DirectiveRenduM08 | undefined {
  const dimensions = perimetre.dimensionsInterdites ?? [];
  const themes = perimetre.themesInterdits ?? [];

  if (dimensions.length === 0 && themes.length === 0) return undefined;

  const morceaux: string[] = [];
  if (dimensions.length > 0) {
    morceaux.push(`dimensions exclues : ${dimensions.join(', ')}`);
  }
  if (themes.length > 0) {
    morceaux.push(`thèmes exclus : ${themes.join(', ')}`);
  }

  return {
    id: 'm08-limites-m13',
    priorite: 'haute',
    texte:
      `Respecter le périmètre réel fourni par M13 (${morceaux.join(' ; ')}). ` +
      'Une exclusion ne peut pas être contournée en racontant la même trajectoire avec moins de détail.',
  };
}

function directivesPreferencesAutres(
  profil: ProfilRenduEffectifM08,
): DirectiveRenduM08[] {
  return Object.entries(profil.autresPreferences)
    .filter(([, valeur]) => valeur !== false && valeur !== '' && valeur !== 0)
    .map(([cle, valeur]) => ({
      id: `m08-preference-${normaliser(cle).replace(/ /g, '-') || 'autre'}`,
      priorite: 'basse' as const,
      texte:
        `Préférence de rendu « ${cle} » : ${String(valeur)}. L’appliquer seulement si elle est pertinente et sans priorité sur l’agentivité, la causalité, les connaissances situées ou les limites réelles.`,
    }));
}

function construireDirectives(
  entree: EntreeM08,
  scene: SignalSceneM08,
  profil: ProfilRenduEffectifM08,
  evaluations: EvaluationDimensionM08[],
  perimetre: PerimetreM13PourM08,
): DirectiveRenduM08[] {
  if (perimetre.arretActif || perimetre.blocageTrajectoire) {
    return [
      {
        id: 'm08-suspension',
        priorite: 'haute',
        texte:
          'Suspendre la mise en scène de la trajectoire concernée : une limite réelle active prime sur le profil de rendu.',
      },
    ];
  }

  const directives: Array<DirectiveRenduM08 | undefined> = [
    directiveFormat(scene.type),
    directiveMode(profil),
    directiveIndependanceDimensions(),
    directiveCausalite(),
    directiveTon(profil),
    directiveViolence(evaluationParDimension(evaluations, 'violence')),
    directiveRomance(evaluationParDimension(evaluations, 'romance')),
    directiveCrudite(evaluationParDimension(evaluations, 'crudite')),
    directiveDetail(evaluationParDimension(evaluations, 'detail')),
    directiveHumour(evaluationParDimension(evaluations, 'humour')),
    directiveLongueur(profil),
    directiveRythme(profil, scene),
    directiveCreativite(profil),
    directivePointDeVue(scene, entree.contexte),
    directiveLimites(perimetre),
    directiveAntiRepetition(entree.motifsRecents ?? []),
  ];

  directives.push(...directivesVoix(scene));
  directives.push(...directivesPreferencesAutres(profil));

  const uniques = new Map<string, DirectiveRenduM08>();
  for (const directive of directives) {
    if (!directive) continue;
    if (!uniques.has(directive.id)) uniques.set(directive.id, directive);
  }

  return [...uniques.values()];
}

function blocageM08(
  contexte: ContexteNarratifV21,
  perimetre: PerimetreM13PourM08,
): BlocageNarratif | undefined {
  if (perimetre.blocageTrajectoire) {
    return {
      type: 'limite',
      raison: perimetre.blocageTrajectoire.raison,
      questionClarification: perimetre.blocageTrajectoire.questionClarification,
    };
  }

  if (perimetre.arretActif || contexte.cadre.nature === 'arret') {
    return {
      type: 'limite',
      raison: 'Arrêt réel actif : M08 ne poursuit pas la mise en scène.',
    };
  }

  return undefined;
}

function controlesM08(
  blocage: BlocageNarratif | undefined,
  evaluations: EvaluationDimensionM08[],
): ControleNarratif[] {
  const dimensionInterditeActive = evaluations.some(
    (evaluation) =>
      evaluation.raisonInactivite === 'interdite_m13' && evaluation.presenteDansScene,
  );

  return [
    {
      id: 'registre',
      ok: !blocage,
      raison: blocage
        ? 'Le rendu est suspendu par une limite réelle active.'
        : 'Le profil est traduit en directives sans modifier les faits ni les résultats.',
    },
    {
      id: 'limites',
      ok: !blocage && !dimensionInterditeActive,
      raison: blocage
        ? blocage.raison
        : dimensionInterditeActive
          ? 'Une dimension présente dans la scène est exclue du rendu par M13.'
          : 'Les plafonds et exclusions disponibles ont été appliqués au rendu.',
    },
    {
      id: 'causalite',
      ok: true,
      raison:
        'M08 n’émet aucune transition matérielle, sociale, contractuelle ou de résolution.',
    },
  ];
}

function contraintesM08(
  scene: SignalSceneM08,
  perimetre: PerimetreM13PourM08,
  evaluations: EvaluationDimensionM08[],
): string[] {
  const contraintes: string[] = [
    'M08 règle la réalisation narrative ; il ne change aucun événement établi.',
    'Ne pas activer une dimension de contenu seulement parce que son niveau configuré est élevé.',
    'Ne pas diminuer silencieusement un niveau élevé ou maximal lorsqu’il est pertinent et autorisé.',
    'Ne pas dépasser le niveau demandé par surenchère automatique.',
    'Ne pas convertir style, longueur, rythme ou créativité en nouvelle décision du joueur.',
  ];

  if (scene.type !== 'hors_fiction') {
    contraintes.push(
      'Narration entre astérisques et dialogues entre guillemets droits par défaut.',
      'Ne pas exposer HUD, jauges, calculs, noms de moteurs ou arbitrages internes.',
    );
  }

  if (perimetre.arretActif) {
    contraintes.push('Arrêt actif : ne pas poursuivre la trajectoire fictive concernée.');
  }

  if (perimetre.blocageTrajectoire) {
    contraintes.push(`Trajectoire suspendue : ${perimetre.blocageTrajectoire.raison}`);
  }

  for (const evaluation of evaluations) {
    if (evaluation.raisonInactivite === 'interdite_m13') {
      contraintes.push(
        `Dimension ${evaluation.dimension} exclue ou réduite par le périmètre actif de M13.`,
      );
    }
  }

  return uniquesTextes(contraintes);
}

function alertesM08(
  entree: EntreeM08,
  evaluations: EvaluationDimensionM08[],
  perimetre: PerimetreM13PourM08,
): string[] {
  const alertes: string[] = [];

  if (!entree.scene) {
    alertes.push(
      'M08 n’a reçu aucun SignalSceneM08 explicite ; seules les dimensions structurelles du cadrage ont été retenues.',
    );
  }

  for (const evaluation of evaluations) {
    if (evaluation.contrainteM13 && evaluation.niveauDemande !== evaluation.niveauEffectif) {
      alertes.push(
        `M13 réduit ${evaluation.dimension} de ${evaluation.niveauDemande ?? 'non défini'} à ${evaluation.niveauEffectif ?? 'désactivé'}.`,
      );
    }
  }

  if (
    entree.contexte.profilRendu.mode === 'adulte' &&
    evaluations.every(
      (evaluation) =>
        evaluation.dimension !== 'violence' ||
        !evaluation.active ||
        evaluation.niveauEffectif !== 'maximal',
    ) &&
    entree.contexte.profilRendu.violence === 'maximal'
  ) {
    const violence = evaluationParDimension(evaluations, 'violence');
    if (violence?.raisonInactivite === 'absente_scene') {
      alertes.push(
        'Violence maximale configurée mais absente de la scène : aucune violence n’est ajoutée artificiellement.',
      );
    }
  }

  if (perimetre.themesInterdits?.length) {
    alertes.push(
      `Thèmes interdits actifs : ${perimetre.themesInterdits.join(', ')}. M08 ne tente pas de les contourner par le style.`,
    );
  }

  return uniquesTextes(alertes);
}

function contributionM01(
  scene: SignalSceneM08,
  evaluations: EvaluationDimensionM08[],
  directives: DirectiveRenduM08[],
  controles: ControleNarratif[],
): ContributionSceneM01 {
  const dimensionsActives = evaluations
    .filter((evaluation) => evaluation.active)
    .map((evaluation) => evaluation.dimension);

  const dimensionsInactives = evaluations
    .filter((evaluation) => !evaluation.active)
    .map((evaluation) => evaluation.dimension);

  const interditsNarratifs = [
    'Ne pas créer un événement, un dommage, une relation ou un résultat pour remplir un réglage de style.',
    'Ne pas activer violence, romance ou humour uniquement parce que leur réglage est élevé.',
    'Ne pas révéler les calculs, moteurs, jauges ou arbitrages internes.',
    'Ne pas uniformiser les voix des personnages selon la crudité ou l’humour global.',
  ];

  if (scene.type === 'hors_fiction') {
    interditsNarratifs.push(
      'Ne pas déguiser une réponse hors fiction en événement narratif.',
    );
  }

  return {
    dimensionsRenduActives: dimensionsActives,
    dimensionsRenduInactives: dimensionsInactives,
    directivesRendu: directives.map((directive) => directive.texte),
    interditsNarratifs,
    controles,
  };
}

/**
 * Exécute M08 sans appel de modèle et sans mutation persistante.
 *
 * Le moteur consomme le ProfilRenduNarratif déjà normalisé par l'application,
 * applique uniquement les restrictions de portée reçues de M13 et remet à M01
 * des directives compactes pour le NarrativeContract du tour courant.
 */
export function executerM08(entree: EntreeM08): SortieM08 {
  const scene = sceneEffective(entree);
  const perimetre = fusionnerPerimetreM13(entree.contexte, entree.perimetreM13);

  const evaluations = toutesDimensionsAExaminer(scene).map((dimension) =>
    evaluerDimension(
      dimension,
      entree.contexte.profilRendu,
      scene,
      perimetre,
    ),
  );

  const profilEffectif = construireProfilEffectif(
    entree.contexte.profilRendu,
    evaluations,
  );

  const blocage = blocageM08(entree.contexte, perimetre);
  const controles = controlesM08(blocage, evaluations);
  const directives = construireDirectives(
    entree,
    scene,
    profilEffectif,
    evaluations,
    perimetre,
  );
  const alertes = alertesM08(entree, evaluations, perimetre);
  const contraintes = contraintesM08(scene, perimetre, evaluations);
  const contribution = contributionM01(scene, evaluations, directives, controles);

  const dimensionsActives = evaluations
    .filter((evaluation) => evaluation.active)
    .map((evaluation) => evaluation.dimension);

  const dimensionsInactives = evaluations
    .filter((evaluation) => !evaluation.active)
    .map((evaluation) => evaluation.dimension);

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M08,
    contribution,
    transitions: [],
    contraintes,
    alertes,
    blocage,
  };

  return {
    moteur: MOTEUR_M08,
    resultat,
    profilEffectif,
    evaluationsDimensions: evaluations,
    directives,
    dimensionsActives,
    dimensionsInactives,
    alertes,
  };
}

/**
 * Utilitaire de préparation facultatif pour un Kernel qui souhaite déclarer
 * explicitement les dimensions de la scène avant l'exécution de M08.
 * Cette fonction ne lit pas le texte libre pour "deviner" un contenu : elle
 * assemble uniquement les dimensions fournies et celles structurelles du type.
 */
export function creerSignalSceneM08(
  type: TypeSceneM08,
  dimensionsPresentes: DimensionRenduM08[] = [],
  options: Omit<SignalSceneM08, 'type' | 'dimensionsPresentes'> = {},
): SignalSceneM08 {
  return {
    ...options,
    type,
    dimensionsPresentes: uniquesDimensions([
      ...dimensionsParTypeScene(type),
      ...dimensionsPresentes,
    ]),
  };
}

/**
 * Adaptateur prudent des limites déjà présentes dans ContexteNarratifV21.
 * Il est exposé pour faciliter la future intégration de M13 sans transformer
 * M08 en propriétaire des limites.
 */
export function perimetreM08DepuisLimites(
  limites: LimiteActive[],
): PerimetreM13PourM08 {
  const contexteMinimal = {
    cadre: {
      histoireId: '__m08__',
      nature: 'fiction' as const,
      initiativeJoueur: '',
    },
    scene: { participants: [] },
    profilRendu: {
      mode: 'grand_public' as const,
      violence: 'desactive' as const,
      romance: 'desactive' as const,
      autresPreferences: {},
    },
    limitesActives: limites,
    evenementsPertinents: [],
    personnages: [],
    relations: [],
    reputations: [],
    engagements: [],
    institutions: [],
    situationPhysique: {
      positions: [],
      objetsPertinents: [],
      blessures: [],
      contraintesMaterielles: [],
      moyensDisponibles: [],
    },
    delegations: [],
    archetypes: [],
    ancragesSociaux: [],
    filsNarratifs: [],
    groupes: [],
    connaissances: [],
    affirmations: [],
    transmissions: [],
    resultatsDejaEtablis: [],
    incertitudes: [],
  } satisfies ContexteNarratifV21;

  return fusionnerPerimetreM13(contexteMinimal, undefined);
}
