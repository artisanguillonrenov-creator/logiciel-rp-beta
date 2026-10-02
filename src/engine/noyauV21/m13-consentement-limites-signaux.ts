// Elyndor — Noyau narratif natif V2.1
// M13 — Consentement / limites / signaux.
//
// M13 définit le périmètre réel autorisé pour la scène et distingue les
// signaux du joueur réel des volontés fictives des personnages. Il ne possède
// ni le style de rendu (M08), ni la volonté des PNJ (M03), ni l'intention du
// joueur en fiction (M07), ni le résultat des actions (M14).

import type { ContributionSceneM01 } from './m01-production';
import type {
  DimensionGradueeM08,
  PerimetreM13PourM08,
} from './m08-registre-style';
import type {
  BlocageNarratif,
  ContexteNarratifV21,
  ControleNarratif,
  LimiteActive,
  NiveauRendu,
  PropositionTransition,
  ResultatMoteur,
  SourceNarrative,
} from './types';

export const MOTEUR_M13 = 'M13' as const;

export type TypeSignalReelM13 =
  | 'escalade'
  | 'maintien'
  | 'ralentissement'
  | 'arret';

export type TypeTrajectoireM13 =
  | 'violence'
  | 'romance'
  | 'intimite'
  | 'mort_joueur'
  | 'autre';

export type StatutVolonteFictiveM13 =
  | 'accord'
  | 'refus'
  | 'incertain'
  | 'non_pertinent';

export type DecisionTrajectoireM13 =
  | 'autorisee'
  | 'autorisee_sous_conditions'
  | 'ralentie'
  | 'redirigee'
  | 'bloquee'
  | 'a_clarifier';

export interface SignalJoueurM13 {
  id: string;
  type: TypeSignalReelM13;
  reelEtExplicite: boolean;
  theme?: string;
  dimension?: DimensionGradueeM08;
  niveauCible?: NiveauRendu;
  portee?: string;
  redirection?: string;
  ellipseDemandee?: boolean;
  source: SourceNarrative;
}

export interface VolonteFictiveM13 {
  personnageId: string;
  statut: StatutVolonteFictiveM13;
  sourceIds: string[];
}

export interface TrajectoireProposeeM13 {
  id: string;
  type: TypeTrajectoireM13;
  theme: string;
  dimension?: DimensionGradueeM08;
  intensite?: NiveauRendu;
  personnageIds: string[];
  personnageJoueurId?: string;
  sourceIds: string[];
  contexteDePression?: boolean;
  bloquante?: boolean;
}

export interface DemandeModificationLimiteM13 {
  id: string;
  theme: string;
  portee: string;
  autorisee: boolean;
  intensite?: NiveauRendu;
  revocable?: boolean;
  source: SourceNarrative;
  explicite: boolean;
  remplaceLimiteId?: string;
}

export interface EvaluationSignalM13 {
  signalId: string;
  prisEnCompte: boolean;
  type: TypeSignalReelM13;
  effet: 'aucun' | 'elargissement' | 'maintien' | 'reduction' | 'suspension';
  raisons: string[];
  alertes: string[];
}

export interface EvaluationTrajectoireM13 {
  trajectoireId: string;
  decision: DecisionTrajectoireM13;
  raisons: string[];
  conditions: string[];
  blocages: string[];
  questionClarification?: string;
}

export interface EvaluationModificationLimiteM13 {
  demandeId: string;
  applicable: boolean;
  raisons: string[];
  blocages: string[];
  valeurProposee?: LimiteActive;
}

export interface PerimetreEffectifM13 {
  arretActif: boolean;
  themesInterdits: string[];
  dimensionsInterdites: DimensionGradueeM08[];
  intensiteMaxParDimension: Partial<Record<DimensionGradueeM08, NiveauRendu>>;
  reductionsPonctuelles: Partial<Record<DimensionGradueeM08, NiveauRendu>>;
  mortDefinitiveJoueurAutorisee: boolean;
  autorisationsActives: string[];
  limitationsActives: string[];
  redirection?: string;
  ellipseDemandee: boolean;
}

export interface EntreeM13 {
  contexte: ContexteNarratifV21;
  signal?: SignalJoueurM13;
  trajectoires?: TrajectoireProposeeM13[];
  volontesFictives?: VolonteFictiveM13[];
  adultesConfirmes?: string[];
  modificationsLimites?: DemandeModificationLimiteM13[];
}

export interface SortieM13 {
  moteur: typeof MOTEUR_M13;
  resultat: ResultatMoteur<ContributionSceneM01>;
  perimetre: PerimetreEffectifM13;
  perimetrePourM08: PerimetreM13PourM08;
  evaluationsSignaux: EvaluationSignalM13[];
  evaluationsTrajectoires: EvaluationTrajectoireM13[];
  evaluationsModifications: EvaluationModificationLimiteM13[];
  transitionsLimites: PropositionTransition<LimiteActive>[];
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

function rangNiveau(niveau: NiveauRendu): number {
  return ORDRE_NIVEAUX.indexOf(niveau);
}

function niveauLePlusBas(a: NiveauRendu, b: NiveauRendu): NiveauRendu {
  return rangNiveau(a) <= rangNiveau(b) ? a : b;
}

function niveauProfil(
  contexte: ContexteNarratifV21,
  dimension: DimensionGradueeM08,
): NiveauRendu | undefined {
  switch (dimension) {
    case 'violence': return contexte.profilRendu.violence;
    case 'romance': return contexte.profilRendu.romance;
    case 'crudite': return contexte.profilRendu.crudite;
    case 'detail': return contexte.profilRendu.detail;
    case 'humour': return contexte.profilRendu.humour;
  }
}

function dimensionDepuisTheme(theme: string): DimensionGradueeM08 | undefined {
  const cle = normaliser(theme).replace(/ /g, '_');
  if (cle === 'violence' || cle === 'combat' || cle === 'violence_physique') return 'violence';
  if (cle === 'romance' || cle === 'romantique') return 'romance';
  if (cle === 'crudite' || cle === 'langage_cru') return 'crudite';
  if (cle === 'detail' || cle === 'niveau_de_detail') return 'detail';
  if (cle === 'humour') return 'humour';
  return undefined;
}

function estThemeMortJoueur(theme: string): boolean {
  const cle = normaliser(theme).replace(/ /g, '_');
  return cle === 'mort_joueur' || cle === 'mort_definitive_joueur' || cle === 'mort_personnage_joueur';
}

function limiteCorrespondAuTheme(limite: LimiteActive, theme: string): boolean {
  return normaliser(limite.theme) === normaliser(theme);
}

function limitesAvecModifications(
  contexte: ContexteNarratifV21,
  evaluations: EvaluationModificationLimiteM13[],
): LimiteActive[] {
  const parId = new Map(contexte.limitesActives.map((limite) => [limite.id, limite]));
  for (const evaluation of evaluations) {
    if (!evaluation.applicable || !evaluation.valeurProposee) continue;
    parId.set(evaluation.valeurProposee.id, evaluation.valeurProposee);
  }
  return [...parId.values()];
}

function evaluerModification(
  demande: DemandeModificationLimiteM13,
  contexte: ContexteNarratifV21,
): EvaluationModificationLimiteM13 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  if (!demande.explicite) blocages.push('Une limite réelle ne peut pas être modifiée à partir d’une déduction implicite.');
  if (!propre(demande.theme)) blocages.push('Le thème de la limite est absent.');
  if (!propre(demande.portee)) blocages.push('La portée de la limite est absente.');
  if (!demande.source?.id) blocages.push('La modification ne possède pas de source traçable.');

  const existante = demande.remplaceLimiteId
    ? contexte.limitesActives.find((limite) => limite.id === demande.remplaceLimiteId)
    : undefined;
  if (demande.remplaceLimiteId && !existante) {
    blocages.push(`La limite à remplacer ${demande.remplaceLimiteId} est introuvable.`);
  }

  const applicable = blocages.length === 0;
  if (applicable) raisons.push('La modification provient d’un choix réel explicite et traçable.');

  const id = existante?.id ?? demande.id;
  const valeurProposee: LimiteActive | undefined = applicable ? {
    id,
    theme: demande.theme,
    portee: demande.portee,
    intensite: demande.intensite,
    autorisee: demande.autorisee,
    revocable: demande.revocable ?? true,
    signalActuel: undefined,
    source: demande.source,
  } : undefined;

  return { demandeId: demande.id, applicable, raisons, blocages, valeurProposee };
}

function transitionPourModification(
  demande: DemandeModificationLimiteM13,
  evaluation: EvaluationModificationLimiteM13,
): PropositionTransition<LimiteActive> | undefined {
  if (!evaluation.applicable || !evaluation.valeurProposee) return undefined;
  return {
    id: `m13:limite:${demande.id}`,
    moteurProprietaire: MOTEUR_M13,
    domaine: 'limite',
    cibleIds: [evaluation.valeurProposee.id],
    justification: demande.remplaceLimiteId
      ? `Modification explicite de la limite ${demande.remplaceLimiteId}.`
      : `Création explicite d’une limite sur le thème ${demande.theme}.`,
    sourceIds: [demande.source.id],
    valeurProposee: evaluation.valeurProposee,
    perceptible: false,
    transmissible: false,
  };
}

function evaluerSignal(signal: SignalJoueurM13 | undefined): EvaluationSignalM13[] {
  if (!signal) return [];
  const raisons: string[] = [];
  const alertes: string[] = [];
  if (!signal.reelEtExplicite) {
    raisons.push('Le signal n’est pas classé comme demande réelle explicite ; il reste dans le niveau fictif.');
    return [{ signalId: signal.id, prisEnCompte: false, type: signal.type, effet: 'aucun', raisons, alertes }];
  }
  const effet = signal.type === 'escalade' ? 'elargissement'
    : signal.type === 'maintien' ? 'maintien'
      : signal.type === 'ralentissement' ? 'reduction'
        : 'suspension';
  raisons.push(signal.type === 'arret'
    ? 'Arrêt réel explicite : la trajectoire doit être suspendue immédiatement.'
    : 'Signal réel explicite pris en compte dans son périmètre.');
  return [{ signalId: signal.id, prisEnCompte: true, type: signal.type, effet, raisons, alertes }];
}

function construirePerimetre(
  entree: EntreeM13,
  limites: LimiteActive[],
  evaluationsSignaux: EvaluationSignalM13[],
): PerimetreEffectifM13 {
  const themesInterdits: string[] = [];
  const dimensionsInterdites = new Set<DimensionGradueeM08>();
  const intensiteMaxParDimension: Partial<Record<DimensionGradueeM08, NiveauRendu>> = {};
  const reductionsPonctuelles: Partial<Record<DimensionGradueeM08, NiveauRendu>> = {};
  const autorisationsActives: string[] = [];
  const limitationsActives: string[] = [];
  let mortDefinitiveJoueurAutorisee = false;

  for (const limite of limites) {
    const dimension = dimensionDepuisTheme(limite.theme);
    if (limite.autorisee) {
      autorisationsActives.push(limite.id);
      if (estThemeMortJoueur(limite.theme)) mortDefinitiveJoueurAutorisee = true;
      if (dimension && limite.intensite) {
        const courant = intensiteMaxParDimension[dimension];
        intensiteMaxParDimension[dimension] = courant ? niveauLePlusBas(courant, limite.intensite) : limite.intensite;
      }
    } else {
      limitationsActives.push(limite.id);
      themesInterdits.push(limite.theme);
      if (dimension) dimensionsInterdites.add(dimension);
      if (estThemeMortJoueur(limite.theme)) mortDefinitiveJoueurAutorisee = false;
    }
  }

  const signal = entree.signal;
  const signalPrisEnCompte = evaluationsSignaux.some((evaluation) => evaluation.prisEnCompte);
  let redirection: string | undefined;
  let ellipseDemandee = false;

  if (signal && signalPrisEnCompte) {
    if (signal.type === 'ralentissement' && signal.dimension) {
      const profil = niveauProfil(entree.contexte, signal.dimension) ?? 'modere';
      reductionsPonctuelles[signal.dimension] = signal.niveauCible ?? niveauLePlusBas(profil, 'faible');
    }
    if (signal.type === 'escalade' && signal.dimension && signal.niveauCible && !dimensionsInterdites.has(signal.dimension)) {
      const capExistant = intensiteMaxParDimension[signal.dimension];
      if (capExistant) intensiteMaxParDimension[signal.dimension] = niveauLePlusBas(capExistant, signal.niveauCible);
    }
    if (signal.redirection) redirection = propre(signal.redirection);
    ellipseDemandee = signal.ellipseDemandee === true;
  }

  const arretActif = entree.contexte.cadre.nature === 'arret' || Boolean(
    signal && signal.reelEtExplicite && signal.type === 'arret' && signalPrisEnCompte,
  );

  return {
    arretActif,
    themesInterdits: uniquesTextes(themesInterdits),
    dimensionsInterdites: [...dimensionsInterdites],
    intensiteMaxParDimension,
    reductionsPonctuelles,
    mortDefinitiveJoueurAutorisee,
    autorisationsActives: uniquesTextes(autorisationsActives),
    limitationsActives: uniquesTextes(limitationsActives),
    redirection,
    ellipseDemandee,
  };
}

function volontePour(entree: EntreeM13, personnageId: string): VolonteFictiveM13 | undefined {
  return entree.volontesFictives?.find((volonte) => volonte.personnageId === personnageId);
}

function limiteInterditTheme(limites: LimiteActive[], theme: string): boolean {
  return limites.some((limite) => !limite.autorisee && limiteCorrespondAuTheme(limite, theme));
}

function limiteAutoriseTheme(limites: LimiteActive[], theme: string): boolean {
  return limites.some((limite) => limite.autorisee && limiteCorrespondAuTheme(limite, theme));
}

function verifierIntensite(
  trajectoire: TrajectoireProposeeM13,
  perimetre: PerimetreEffectifM13,
): { autorisee: boolean; condition?: string } {
  const dimension = trajectoire.dimension ?? dimensionDepuisTheme(trajectoire.theme);
  if (!dimension || !trajectoire.intensite) return { autorisee: true };
  if (perimetre.dimensionsInterdites.includes(dimension)) return { autorisee: false, condition: `La dimension ${dimension} est interdite.` };
  const reduction = perimetre.reductionsPonctuelles[dimension];
  if (reduction && rangNiveau(trajectoire.intensite) > rangNiveau(reduction)) {
    return { autorisee: false, condition: `La scène doit rester au niveau ${reduction} pour ${dimension}.` };
  }
  const cap = perimetre.intensiteMaxParDimension[dimension];
  if (cap && rangNiveau(trajectoire.intensite) > rangNiveau(cap)) {
    return { autorisee: false, condition: `Le périmètre actif limite ${dimension} au niveau ${cap}.` };
  }
  return { autorisee: true };
}

function evaluerTrajectoire(
  trajectoire: TrajectoireProposeeM13,
  entree: EntreeM13,
  limites: LimiteActive[],
  perimetre: PerimetreEffectifM13,
): EvaluationTrajectoireM13 {
  const raisons: string[] = [];
  const conditions: string[] = [];
  const blocages: string[] = [];

  if (perimetre.arretActif) {
    blocages.push('Un arrêt réel est actif ; aucune nouvelle conséquence ne doit être ajoutée.');
    return { trajectoireId: trajectoire.id, decision: 'bloquee', raisons, conditions, blocages };
  }

  if (limiteInterditTheme(limites, trajectoire.theme)) blocages.push(`Le thème « ${trajectoire.theme} » est explicitement exclu.`);
  const dimension = trajectoire.dimension ?? dimensionDepuisTheme(trajectoire.theme);
  if (dimension && perimetre.dimensionsInterdites.includes(dimension)) blocages.push(`La dimension ${dimension} est explicitement exclue.`);

  const intensite = verifierIntensite(trajectoire, perimetre);
  if (!intensite.autorisee && intensite.condition) blocages.push(intensite.condition);

  if (trajectoire.type === 'mort_joueur') {
    if (!perimetre.mortDefinitiveJoueurAutorisee) {
      blocages.push('La mort définitive du personnage joueur n’est pas autorisée dans le périmètre actif.');
    } else {
      raisons.push('Une autorisation explicite et applicable de mort définitive est active.');
    }
  }

  if (trajectoire.type === 'romance' || trajectoire.type === 'intimite') {
    const adultes = new Set(entree.adultesConfirmes ?? []);
    const nonConfirmes = trajectoire.personnageIds.filter((id) => !adultes.has(id));
    if (nonConfirmes.length > 0) blocages.push(`L’âge adulte n’est pas confirmé pour : ${nonConfirmes.join(', ')}.`);

    if (trajectoire.type === 'intimite') {
      const volontes = trajectoire.personnageIds.map((personnageId) => ({ personnageId, volonte: volontePour(entree, personnageId) }));
      const refus = volontes.filter(({ volonte }) => volonte?.statut === 'refus');
      const inconnues = volontes.filter(({ volonte }) => !volonte || volonte.statut === 'incertain');
      if (refus.length > 0) blocages.push(`La volonté fictive s’oppose à cette trajectoire pour : ${refus.map(({ personnageId }) => personnageId).join(', ')}.`);
      if (inconnues.length > 0) conditions.push(`La volonté fictive doit être établie pour : ${inconnues.map(({ personnageId }) => personnageId).join(', ')}.`);
      if (trajectoire.contexteDePression) raisons.push('Captivité, dépendance, pression ou rang inférieur ne sont pas utilisés comme preuve de consentement.');
    }
  }

  if (perimetre.redirection) raisons.push(`Une redirection réelle est active : ${perimetre.redirection}`);

  if (blocages.length > 0) {
    return {
      trajectoireId: trajectoire.id,
      decision: perimetre.redirection ? 'redirigee' : 'bloquee',
      raisons,
      conditions,
      blocages,
      questionClarification: trajectoire.type === 'romance' || trajectoire.type === 'intimite'
        ? 'Peux-tu préciser un périmètre compatible ou rediriger la scène ?'
        : undefined,
    };
  }

  if (conditions.length > 0) {
    return {
      trajectoireId: trajectoire.id,
      decision: 'a_clarifier',
      raisons,
      conditions,
      blocages,
      questionClarification: 'Une information décisive manque pour poursuivre cette trajectoire sans élargir implicitement le périmètre.',
    };
  }

  if (dimension && perimetre.reductionsPonctuelles[dimension]) {
    raisons.push(`Réduction ponctuelle active pour ${dimension}.`);
    return { trajectoireId: trajectoire.id, decision: 'ralentie', raisons, conditions, blocages };
  }

  if (limiteAutoriseTheme(limites, trajectoire.theme)) raisons.push('Le thème est explicitement autorisé dans le périmètre actif.');
  else raisons.push('Aucune exclusion applicable ne bloque cette trajectoire ; M13 n’invente pas une autorisation plus large que le profil actif.');

  return { trajectoireId: trajectoire.id, decision: 'autorisee', raisons, conditions, blocages };
}

function blocageDepuisEtat(
  perimetre: PerimetreEffectifM13,
  evaluations: EvaluationTrajectoireM13[],
  signal?: SignalJoueurM13,
): BlocageNarratif | undefined {
  if (perimetre.arretActif) {
    return { type: 'limite', raison: 'Le joueur a demandé un arrêt réel : la trajectoire est suspendue.', sources: signal?.source ? [signal.source] : undefined };
  }
  const bloquante = evaluations.find((evaluation) => evaluation.decision === 'bloquee' || evaluation.decision === 'a_clarifier');
  if (!bloquante) return undefined;
  return {
    type: 'limite',
    raison: bloquante.blocages[0] ?? bloquante.conditions[0] ?? 'La trajectoire dépasse le périmètre actuellement établi.',
    questionClarification: bloquante.questionClarification,
  };
}

function controlesM13(
  perimetre: PerimetreEffectifM13,
  evaluations: EvaluationTrajectoireM13[],
): ControleNarratif[] {
  const incompatible = evaluations.some((evaluation) => evaluation.decision === 'bloquee' || evaluation.decision === 'a_clarifier');
  return [
    {
      id: 'limites',
      ok: !incompatible,
      raison: perimetre.arretActif
        ? 'Arrêt réel actif ; la fiction doit rester suspendue.'
        : incompatible
          ? 'Au moins une trajectoire dépasse ou rend incertain le périmètre actif.'
          : 'Les trajectoires évaluées restent dans le périmètre réel établi.',
    },
    { id: 'agentivite', ok: true, raison: 'M13 distingue les préférences du joueur réel des volontés fictives et ne décide pas à la place des personnages.' },
    { id: 'registre', ok: true, raison: 'M13 borne le périmètre ; le niveau de réalisation reste sous l’autorité de M08.' },
  ];
}

function contributionM13(
  entree: EntreeM13,
  perimetre: PerimetreEffectifM13,
  evaluations: EvaluationTrajectoireM13[],
): ContributionSceneM01 {
  const contraintes: string[] = [];
  const pointsAMontrer: string[] = [];
  const interditsNarratifs: string[] = [];
  const directivesRendu: string[] = [];

  if (perimetre.arretActif) {
    contraintes.push('Suspendre immédiatement la trajectoire fictionnelle en cours.');
    interditsNarratifs.push('Ne pas ajouter de nouvelle menace, conséquence ou sanction après l’arrêt réel.');
    interditsNarratifs.push('Ne pas faire négocier ou insister un PNJ pour contourner l’arrêt.');
    pointsAMontrer.push('Répondre hors personnage et attendre une nouvelle direction compatible.');
  }

  for (const theme of perimetre.themesInterdits) contraintes.push(`Ne pas poursuivre le thème exclu : ${theme}.`);
  for (const dimension of perimetre.dimensionsInterdites) directivesRendu.push(`Dimension ${dimension} inactive selon M13.`);

  for (const dimension of DIMENSIONS_GRADUEES) {
    const reduction = perimetre.reductionsPonctuelles[dimension];
    if (reduction) directivesRendu.push(`Réduire immédiatement ${dimension} au niveau ${reduction} au plus.`);
    const cap = perimetre.intensiteMaxParDimension[dimension];
    if (cap) directivesRendu.push(`Ne pas dépasser le niveau ${cap} pour ${dimension}.`);
  }

  if (perimetre.redirection) pointsAMontrer.push(`Rediriger la scène vers : ${perimetre.redirection}.`);
  if (perimetre.ellipseDemandee) directivesRendu.push('Appliquer l’ellipse demandée sans réécrire ce qui est déjà établi.');
  if (!perimetre.mortDefinitiveJoueurAutorisee) contraintes.push('La mort définitive du personnage joueur n’est pas autorisée sans autorisation explicite applicable.');

  for (const evaluation of evaluations) {
    if (evaluation.decision === 'bloquee') interditsNarratifs.push(...evaluation.blocages);
    if (evaluation.decision === 'a_clarifier') contraintes.push(...evaluation.conditions);
  }

  if (entree.signal?.reelEtExplicite && entree.signal.type === 'maintien' && !perimetre.arretActif) {
    directivesRendu.push('Poursuivre dans le périmètre déjà établi sans exiger une nouvelle confirmation ni élargir implicitement la portée.');
  }

  return {
    contraintes: uniquesTextes(contraintes),
    pointsAMontrer: uniquesTextes(pointsAMontrer),
    interditsNarratifs: uniquesTextes(interditsNarratifs),
    directivesRendu: uniquesTextes(directivesRendu),
    controles: controlesM13(perimetre, evaluations),
  };
}

function perimetrePourM08(
  perimetre: PerimetreEffectifM13,
  blocage: BlocageNarratif | undefined,
  signal?: SignalJoueurM13,
): PerimetreM13PourM08 {
  return {
    arretActif: perimetre.arretActif,
    dimensionsInterdites: perimetre.dimensionsInterdites,
    intensiteMaxParDimension: perimetre.intensiteMaxParDimension,
    reductionsPonctuelles: perimetre.reductionsPonctuelles,
    themesInterdits: perimetre.themesInterdits,
    blocageTrajectoire: blocage ? {
      raison: blocage.raison,
      questionClarification: blocage.questionClarification,
      sourceIds: signal?.source?.id ? [signal.source.id] : undefined,
    } : undefined,
    sourceIds: uniquesTextes([
      ...perimetre.autorisationsActives,
      ...perimetre.limitationsActives,
      ...(signal?.source?.id ? [signal.source.id] : []),
    ]),
  };
}

export function executerM13(entree: EntreeM13): SortieM13 {
  const evaluationsModifications = (entree.modificationsLimites ?? []).map((demande) => evaluerModification(demande, entree.contexte));
  const transitionsLimites = uniquesParCle(
    (entree.modificationsLimites ?? [])
      .map((demande) => {
        const evaluation = evaluationsModifications.find((candidate) => candidate.demandeId === demande.id);
        return evaluation ? transitionPourModification(demande, evaluation) : undefined;
      })
      .filter((transition): transition is PropositionTransition<LimiteActive> => Boolean(transition)),
    (transition) => transition.id,
  );

  const limites = limitesAvecModifications(entree.contexte, evaluationsModifications);
  const evaluationsSignaux = evaluerSignal(entree.signal);
  const perimetre = construirePerimetre(entree, limites, evaluationsSignaux);
  const evaluationsTrajectoires = (entree.trajectoires ?? []).map((trajectoire) => evaluerTrajectoire(trajectoire, entree, limites, perimetre));
  const blocage = blocageDepuisEtat(perimetre, evaluationsTrajectoires, entree.signal);
  const contribution = contributionM13(entree, perimetre, evaluationsTrajectoires);

  const alertes = uniquesTextes([
    ...evaluationsSignaux.flatMap((evaluation) => evaluation.alertes),
    ...evaluationsModifications.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsTrajectoires.flatMap((evaluation) =>
      evaluation.decision === 'bloquee' || evaluation.decision === 'a_clarifier' ? evaluation.blocages : [],
    ),
  ]);

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M13,
    contribution,
    transitions: transitionsLimites,
    contraintes: contribution.contraintes ?? [],
    alertes,
    blocage,
  };

  return {
    moteur: MOTEUR_M13,
    resultat,
    perimetre,
    perimetrePourM08: perimetrePourM08(perimetre, blocage, entree.signal),
    evaluationsSignaux,
    evaluationsTrajectoires,
    evaluationsModifications,
    transitionsLimites,
    alertes,
  };
}
