// Elyndor — Noyau narratif natif V2.1
// M03 — Esprit des personnages.
//
// M03 produit des intentions, réactions, paroles possibles et évolutions
// psychologiques cohérentes à partir de l'identité individuelle, des moyens,
// relations, savoirs et contraintes déjà établis. Il ne décide jamais du
// résultat d'une action : toute issue contestée reste du ressort de M14.

import type { ContributionSceneM01 } from './m01-production';
import type {
  AncrageSocial,
  ConnaissanceSituee,
  ContexteNarratifV21,
  IdentitePersonnage,
  PropositionTransition,
  RelationDirigee,
  ResultatMoteur,
  SourceNarrative,
  TendanceArchetype,
} from './types';

export const MOTEUR_M03 = 'M03' as const;

export type TypeReactionM03 =
  | 'soutenir'
  | 'refuser'
  | 'contester'
  | 'fuir'
  | 'enqueter'
  | 'negocier'
  | 'alerter'
  | 'agir'
  | 'attendre'
  | 'retenue'
  | 'autre';

export type ModeParoleM03 =
  | 'dire'
  | 'hesiter'
  | 'retenir'
  | 'refuser'
  | 'erreur_possible'
  | 'mensonge_possible';

export type NiveauFacteurM03 = 'faible' | 'modere' | 'fort' | 'critique';

export interface OptionReactionM03 {
  id: string;
  acteurId: string;
  type: TypeReactionM03;
  description: string;
  cibleIds?: string[];

  // Alignement individuel : M03 compare ces éléments à la fiche validée.
  butsServis?: string[];
  valeursServies?: string[];
  valeursHeurtees?: string[];
  competencesMobilisees?: string[];

  // Résultats déjà produits par les autres responsabilités.
  faisable?: boolean;
  raisonInfaisabilite?: string;
  savoirsNecessaires?: string[];
  droitsNecessaires?: string[];
  accesNecessaires?: string[];
  devoirsRespectes?: string[];
  devoirsHeurtes?: string[];
  relationFavorise?: boolean;
  relationDefavorise?: boolean;

  // Indication explicite du Kernel. Ce poids ne remplace jamais les blocages.
  prioriteExplicite?: number;
}

export interface DemandeParoleM03 {
  id: string;
  acteurId: string;
  interlocuteurId?: string;
  question?: string;
  affirmationIdsCandidats: string[];
}

export interface RegleDivulgationM03 {
  acteurId: string;
  affirmationId: string;
  valeurInformation?: NiveauFacteurM03;
  risqueDivulgation?: NiveauFacteurM03;
  devoirReserve?: NiveauFacteurM03;
  relationAutorise?: boolean;
  objectifFavoriseDivulgation?: boolean;
  interdite?: boolean;
  mensongePlausible?: boolean;
  erreurPlausible?: boolean;
  justification?: string;
}

export interface ImpactEmotionnelM03 {
  id: string;
  acteurId: string;
  emotion: string;
  mouvement: 'apparition' | 'renforcement' | 'apaisement' | 'rappel' | 'transformation';
  intensite?: NiveauFacteurM03;
  justification: string;
  sourceIds: string[];
}

export interface EvolutionButM03 {
  id: string;
  acteurId: string;
  type: 'ajouter' | 'retirer' | 'prioriser' | 'deprioriser';
  but: string;
  justification: string;
  sourceIds: string[];
  ruptureIdentitaire?: boolean;
  evenementTransformateur?: boolean;
}

export interface EntreeM03 {
  contexte: ContexteNarratifV21;
  /** PNJ à traiter. Sans liste, M03 retient les personnages présents en scène. */
  pnjIds?: string[];
  /** Permet d'exclure explicitement le personnage joueur du traitement M03. */
  personnageJoueurId?: string;
  optionsReaction?: OptionReactionM03[];
  demandesParole?: DemandeParoleM03[];
  reglesDivulgation?: RegleDivulgationM03[];
  impactsEmotionnels?: ImpactEmotionnelM03[];
  evolutionsButs?: EvolutionButM03[];
  /** Suggestions M09 déjà calculées. Elles ne servent qu'aux champs manquants. */
  archetypeIdsParPnj?: Record<string, string[]>;
}

export interface EvaluationOptionM03 {
  optionId: string;
  acteurId: string;
  accessible: boolean;
  score: number;
  raisons: string[];
  blocages: string[];
}

export interface DecisionPersonnageM03 {
  acteurId: string;
  type: TypeReactionM03;
  intention?: string;
  optionId?: string;
  cibleIds: string[];
  justificationInterne: string[];
  retenue: boolean;
}

export interface DecisionParoleM03 {
  demandeId: string;
  acteurId: string;
  affirmationId: string;
  mode: ModeParoleM03;
  raison: string;
}

export interface VuePersonnageM03 {
  personnage: IdentitePersonnage;
  relationsSortantes: RelationDirigee[];
  ancrageSocial?: AncrageSocial;
  connaissances: ConnaissanceSituee[];
  archetypesConsultes: TendanceArchetype[];
  hypothesesArchetypeUtilisees: string[];
}

export interface SortieM03 {
  moteur: typeof MOTEUR_M03;
  resultat: ResultatMoteur<ContributionSceneM01>;
  vues: VuePersonnageM03[];
  evaluations: EvaluationOptionM03[];
  decisions: DecisionPersonnageM03[];
  paroles: DecisionParoleM03[];
  alertes: string[];
}

const POIDS_FACTEUR: Record<NiveauFacteurM03, number> = {
  faible: 1,
  modere: 2,
  fort: 3,
  critique: 4,
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

function correspond(a: string, b: string): boolean {
  const na = normaliser(a);
  const nb = normaliser(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function contientEquivalent(collection: string[], valeur: string): boolean {
  return collection.some((element) => correspond(element, valeur));
}

function sommeCorrespondances(references: string[] | undefined, etablis: string[], poids: number): number {
  if (!references?.length || etablis.length === 0) return 0;
  let score = 0;
  for (const reference of references) {
    if (contientEquivalent(etablis, reference)) score += poids;
  }
  return score;
}

function hashStable(valeur: string): number {
  let hash = 2166136261;
  for (let i = 0; i < valeur.length; i += 1) {
    hash ^= valeur.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clampPriorite(valeur: number | undefined): number {
  if (!Number.isFinite(valeur)) return 0;
  return Math.max(-5, Math.min(5, valeur ?? 0));
}

function idsPnj(entree: EntreeM03): string[] {
  const { contexte } = entree;
  const disponibles = new Set(contexte.personnages.map((personnage) => personnage.id));
  const demandes = entree.pnjIds?.length
    ? entree.pnjIds
    : contexte.scene.participants.filter((id) => disponibles.has(id));

  return uniquesTextes(demandes).filter((id) => id !== entree.personnageJoueurId);
}

function construireVue(
  contexte: ContexteNarratifV21,
  personnage: IdentitePersonnage,
  archetypeIds: string[],
): VuePersonnageM03 {
  const archetypesParId = new Map(contexte.archetypes.map((archetype) => [archetype.id, archetype] as const));
  const archetypesConsultes = archetypeIds
    .map((id) => archetypesParId.get(id))
    .filter((archetype): archetype is TendanceArchetype => Boolean(archetype));

  const hypotheses: string[] = [];

  // L'archétype ne complète que des catégories réellement absentes de la fiche.
  if (personnage.buts.length === 0) {
    for (const archetype of archetypesConsultes) hypotheses.push(...archetype.attentions);
  }
  if (personnage.competences.length === 0) {
    for (const archetype of archetypesConsultes) hypotheses.push(...archetype.optionsAction);
  }
  if (personnage.traits.length === 0) {
    for (const archetype of archetypesConsultes) hypotheses.push(...archetype.variantes);
  }

  return {
    personnage,
    relationsSortantes: contexte.relations.filter((relation) => relation.acteurId === personnage.id),
    ancrageSocial: contexte.ancragesSociaux.find((ancrage) => ancrage.personnageId === personnage.id),
    connaissances: contexte.connaissances.filter((connaissance) => connaissance.acteurId === personnage.id),
    archetypesConsultes,
    hypothesesArchetypeUtilisees: uniquesTextes(hypotheses),
  };
}

function connaissancesIds(vue: VuePersonnageM03): Set<string> {
  return new Set(vue.connaissances.map((connaissance) => connaissance.affirmationId));
}

function verifierAccesSocial(option: OptionReactionM03, ancrage: AncrageSocial | undefined): string[] {
  const blocages: string[] = [];
  if (!option.droitsNecessaires?.length && !option.accesNecessaires?.length) return blocages;

  if (!ancrage) {
    return ["Ancrage social absent : impossible de confirmer les droits ou accès requis."];
  }

  for (const droit of option.droitsNecessaires ?? []) {
    if (!contientEquivalent(ancrage.droits, droit)) {
      blocages.push(`Droit non établi : ${droit}.`);
    }
  }
  for (const acces of option.accesNecessaires ?? []) {
    if (!contientEquivalent(ancrage.acces, acces)) {
      blocages.push(`Accès non établi : ${acces}.`);
    }
  }

  return blocages;
}

function evaluerOption(vue: VuePersonnageM03, option: OptionReactionM03): EvaluationOptionM03 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  const savoirs = connaissancesIds(vue);

  if (option.faisable === false) {
    blocages.push(option.raisonInfaisabilite || 'Option déclarée matériellement indisponible.');
  }

  for (const affirmationId of option.savoirsNecessaires ?? []) {
    if (!savoirs.has(affirmationId)) {
      blocages.push(`Savoir requis non accessible au PNJ : ${affirmationId}.`);
    }
  }

  blocages.push(...verifierAccesSocial(option, vue.ancrageSocial));

  let score = clampPriorite(option.prioriteExplicite);
  if (score !== 0) raisons.push(`Priorité explicite du Kernel : ${score}.`);

  const buts = sommeCorrespondances(option.butsServis, vue.personnage.buts, 4);
  const valeurs = sommeCorrespondances(option.valeursServies, vue.personnage.valeurs, 3);
  const valeursHeurtees = sommeCorrespondances(option.valeursHeurtees, vue.personnage.valeurs, 4);
  const competences = sommeCorrespondances(option.competencesMobilisees, vue.personnage.competences, 2);

  score += buts + valeurs + competences - valeursHeurtees;

  if (buts > 0) raisons.push('Option alignée avec au moins un but individuel établi.');
  if (valeurs > 0) raisons.push('Option alignée avec au moins une valeur individuelle établie.');
  if (valeursHeurtees > 0) raisons.push('Option en tension avec au moins une valeur individuelle établie.');
  if (competences > 0) raisons.push('Option cohérente avec une compétence établie.');

  if (option.relationFavorise) {
    score += 1;
    raisons.push('La relation consultée favorise cette option.');
  }
  if (option.relationDefavorise) {
    score -= 1;
    raisons.push('La relation consultée défavorise cette option.');
  }

  const devoirsRespectes = option.devoirsRespectes?.length ?? 0;
  const devoirsHeurtes = option.devoirsHeurtes?.length ?? 0;
  score += devoirsRespectes * 2;
  score -= devoirsHeurtes * 2;
  if (devoirsRespectes > 0) raisons.push('Option compatible avec des devoirs établis.');
  if (devoirsHeurtes > 0) raisons.push('Option entre en conflit avec des devoirs établis.');

  // M09 ne prime jamais sur une fiche individuelle. Ses hypothèses ne servent
  // qu'en l'absence d'un champ pertinent et avec un poids volontairement faible.
  if (vue.hypothesesArchetypeUtilisees.length > 0) {
    const hypotheseCompatible = vue.hypothesesArchetypeUtilisees.some((hypothese) =>
      correspond(hypothese, option.description),
    );
    if (hypotheseCompatible) {
      score += 1;
      raisons.push('Hypothèse M09 utilisée uniquement pour un champ individuel manquant.');
    }
  }

  return {
    optionId: option.id,
    acteurId: option.acteurId,
    accessible: blocages.length === 0,
    score,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function choisirDecision(
  contexte: ContexteNarratifV21,
  vue: VuePersonnageM03,
  options: OptionReactionM03[],
  evaluations: EvaluationOptionM03[],
): DecisionPersonnageM03 {
  const accessibles = evaluations
    .filter((evaluation) => evaluation.acteurId === vue.personnage.id && evaluation.accessible)
    .sort((a, b) => b.score - a.score || a.optionId.localeCompare(b.optionId));

  if (accessibles.length === 0) {
    return {
      acteurId: vue.personnage.id,
      type: 'retenue',
      cibleIds: [],
      justificationInterne: [
        options.length > 0
          ? 'Aucune option fournie n’est actuellement accessible sans inventer un moyen, un savoir ou un droit.'
          : 'Aucune option d’action n’a été fournie ; M03 conserve une retenue plutôt que d’inventer une initiative décisive.',
      ],
      retenue: true,
    };
  }

  const meilleurScore = accessibles[0].score;
  const equivalentes = accessibles.filter((evaluation) => evaluation.score === meilleurScore);
  const graine = `${contexte.scene.id ?? ''}|${contexte.cadre.initiativeJoueur}|${vue.personnage.id}`;
  const choisie = equivalentes[hashStable(graine) % equivalentes.length];
  const option = options.find((candidate) => candidate.id === choisie.optionId);

  if (!option) {
    return {
      acteurId: vue.personnage.id,
      type: 'retenue',
      cibleIds: [],
      justificationInterne: ['Option évaluée introuvable ; aucune réaction décisive n’est inventée.'],
      retenue: true,
    };
  }

  return {
    acteurId: vue.personnage.id,
    type: option.type,
    intention: option.description,
    optionId: option.id,
    cibleIds: option.cibleIds ?? [],
    justificationInterne: choisie.raisons,
    retenue: option.type === 'retenue' || option.type === 'attendre',
  };
}

function facteurMax(...niveaux: Array<NiveauFacteurM03 | undefined>): number {
  return Math.max(0, ...niveaux.map((niveau) => (niveau ? POIDS_FACTEUR[niveau] : 0)));
}

function deciderParole(
  contexte: ContexteNarratifV21,
  demande: DemandeParoleM03,
  regles: RegleDivulgationM03[],
): DecisionParoleM03[] {
  const connaissances = new Map(
    contexte.connaissances
      .filter((connaissance) => connaissance.acteurId === demande.acteurId)
      .map((connaissance) => [connaissance.affirmationId, connaissance] as const),
  );

  const decisions: DecisionParoleM03[] = [];

  for (const affirmationId of demande.affirmationIdsCandidats) {
    if (!connaissances.has(affirmationId)) continue;

    const regle = regles.find(
      (candidate) =>
        candidate.acteurId === demande.acteurId && candidate.affirmationId === affirmationId,
    );

    if (!regle) {
      decisions.push({
        demandeId: demande.id,
        acteurId: demande.acteurId,
        affirmationId,
        mode: 'dire',
        raison: 'Information connue et aucune contrainte de divulgation n’est établie.',
      });
      continue;
    }

    if (regle.interdite) {
      decisions.push({
        demandeId: demande.id,
        acteurId: demande.acteurId,
        affirmationId,
        mode: 'refuser',
        raison: regle.justification || 'Divulgation explicitement interdite dans l’état applicable.',
      });
      continue;
    }

    const protection = facteurMax(regle.valeurInformation, regle.risqueDivulgation, regle.devoirReserve);
    const motifDivulgation = regle.relationAutorise === true || regle.objectifFavoriseDivulgation === true;

    if (protection >= POIDS_FACTEUR.critique && !motifDivulgation) {
      decisions.push({
        demandeId: demande.id,
        acteurId: demande.acteurId,
        affirmationId,
        mode: regle.mensongePlausible
          ? 'mensonge_possible'
          : regle.erreurPlausible
            ? 'erreur_possible'
            : 'refuser',
        raison: regle.justification || 'Valeur, devoir ou risque critique sans motif établi de divulgation.',
      });
    } else if (protection >= POIDS_FACTEUR.fort && !motifDivulgation) {
      decisions.push({
        demandeId: demande.id,
        acteurId: demande.acteurId,
        affirmationId,
        mode: 'hesiter',
        raison: regle.justification || 'Information sensible : hésitation ou retenue crédible.',
      });
    } else if (protection >= POIDS_FACTEUR.modere && !motifDivulgation && !demande.question) {
      decisions.push({
        demandeId: demande.id,
        acteurId: demande.acteurId,
        affirmationId,
        mode: 'retenir',
        raison: regle.justification || 'Information non sollicitée et suffisamment sensible pour ne pas être offerte spontanément.',
      });
    } else {
      decisions.push({
        demandeId: demande.id,
        acteurId: demande.acteurId,
        affirmationId,
        mode: 'dire',
        raison: regle.justification || 'Divulgation compatible avec les buts, devoirs et risques établis.',
      });
    }
  }

  return decisions;
}

function sourceDepuisId(id: string): SourceNarrative {
  return { id, type: 'autre', description: 'Source référencée par une transition M03.' };
}

function transitionsEmotionnelles(impacts: ImpactEmotionnelM03[]): PropositionTransition[] {
  const transitions: PropositionTransition[] = [];

  for (const impact of impacts) {
    if (!propre(impact.emotion) || !propre(impact.justification) || impact.sourceIds.length === 0) continue;

    transitions.push({
      id: `m03-emotion-${impact.id}`,
      moteurProprietaire: MOTEUR_M03,
      domaine: 'personnage',
      categorie: 'psychologique',
      cibleIds: [impact.acteurId],
      justification: impact.justification,
      sourceIds: [...impact.sourceIds],
      valeurProposee: {
        type: 'etat_emotionnel',
        emotion: impact.emotion,
        mouvement: impact.mouvement,
        intensite: impact.intensite,
      },
      perceptible: true,
      transmissible: false,
    });
  }

  return transitions;
}

function transitionsButs(evolutions: EvolutionButM03[], alertes: string[]): PropositionTransition[] {
  const transitions: PropositionTransition[] = [];

  for (const evolution of evolutions) {
    if (!propre(evolution.but) || !propre(evolution.justification) || evolution.sourceIds.length === 0) {
      alertes.push(`Évolution de but ${evolution.id} ignorée : provenance ou justification insuffisante.`);
      continue;
    }

    if (evolution.ruptureIdentitaire && !evolution.evenementTransformateur) {
      alertes.push(
        `Évolution de but ${evolution.id} suspendue : une rupture identitaire exige un événement réellement transformateur.`,
      );
      continue;
    }

    transitions.push({
      id: `m03-but-${evolution.id}`,
      moteurProprietaire: MOTEUR_M03,
      domaine: 'personnage',
      categorie: 'psychologique',
      cibleIds: [evolution.acteurId],
      justification: evolution.justification,
      sourceIds: [...evolution.sourceIds],
      valeurProposee: {
        type: 'evolution_but',
        operation: evolution.type,
        but: evolution.but,
      },
      perceptible: false,
      transmissible: false,
    });
  }

  return transitions;
}

function controlesM03(
  vues: VuePersonnageM03[],
  decisions: DecisionPersonnageM03[],
  paroles: DecisionParoleM03[],
): NonNullable<ContributionSceneM01['controles']> {
  const controles: NonNullable<ContributionSceneM01['controles']> = [];

  controles.push({
    id: 'savoir',
    ok: true,
    raison: 'M03 n’utilise pour la parole que des affirmations présentes dans les connaissances situées du PNJ.',
  });

  controles.push({
    id: 'causalite',
    ok: true,
    raison: 'Les décisions M03 restent des intentions ; aucun succès d’action n’est déclaré par M03.',
  });

  if (vues.some((vue) => vue.hypothesesArchetypeUtilisees.length > 0)) {
    controles.push({
      id: 'fidelite_recit',
      ok: true,
      raison: 'Les tendances M09 ne complètent que des champs individuels absents et ne remplacent aucune fiche établie.',
    });
  }

  if (decisions.length === 0 && paroles.length === 0) {
    controles.push({
      id: 'fidelite_recit',
      ok: true,
      raison: 'Aucune initiative PNJ n’a été inventée faute de matière suffisante.',
    });
  }

  return controles;
}

function contributionM01(
  decisions: DecisionPersonnageM03[],
  paroles: DecisionParoleM03[],
  controles: NonNullable<ContributionSceneM01['controles']>,
): ContributionSceneM01 {
  const intentionsPnj = decisions
    .filter((decision) => Boolean(decision.intention))
    .map((decision) => ({
      acteurId: decision.acteurId,
      intention: decision.intention as string,
      justification: decision.justificationInterne.join(' ') || 'Intention cohérente avec l’état individuel applicable.',
      cibleIds: decision.cibleIds,
    }));

  const pointsAMontrer = decisions
    .filter((decision) => decision.intention)
    .map((decision) => `${decision.acteurId} : ${decision.intention}`);

  for (const parole of paroles) {
    if (parole.mode === 'dire') {
      pointsAMontrer.push(`${parole.acteurId} peut utiliser l’information ${parole.affirmationId} dans sa réponse.`);
    } else if (parole.mode === 'hesiter') {
      pointsAMontrer.push(`${parole.acteurId} hésite avant de divulguer l’information ${parole.affirmationId}.`);
    } else if (parole.mode === 'refuser' || parole.mode === 'retenir') {
      pointsAMontrer.push(`${parole.acteurId} ne divulgue pas spontanément l’information ${parole.affirmationId}.`);
    } else if (parole.mode === 'mensonge_possible') {
      pointsAMontrer.push(`${parole.acteurId} peut mentir au sujet de l’information ${parole.affirmationId}, sans que ce mensonge devienne vrai.`);
    } else if (parole.mode === 'erreur_possible') {
      pointsAMontrer.push(`${parole.acteurId} peut se tromper au sujet de l’information ${parole.affirmationId}, sans modifier le canon.`);
    }
  }

  return {
    intentionsPnj,
    pointsAMontrer: uniquesTextes(pointsAMontrer),
    contraintes: [
      'Préserver l’identité individuelle, les buts, valeurs, compétences et état émotionnel établis de chaque PNJ.',
      'Limiter chaque PNJ aux informations effectivement accessibles dans son point de vue.',
      'Traiter toute réaction M03 comme une intention ; M14 reste propriétaire de la réussite ou de l’échec.',
      'Consulter relations et ancrage social sans les transformer en personnalité de remplacement.',
    ],
    interditsNarratifs: [
      'Ne pas rendre un PNJ omniscient à partir du contexte global du narrateur.',
      'Ne pas faire d’un archétype une essence qui écrase la fiche individuelle.',
      'Ne pas convertir automatiquement loyauté en obéissance ou désaccord en trahison.',
      'Ne pas attribuer au joueur l’acceptation d’une proposition faite par un PNJ.',
      'Ne pas exposer systématiquement le raisonnement interne utilisé pour choisir une réaction.',
    ],
    controles,
  };
}

/**
 * Exécute M03 sans appel de modèle et sans mutation directe de la partie.
 *
 * Les réactions sont choisies parmi les options fournies par le Kernel et les
 * autres moteurs. M03 peut proposer des évolutions émotionnelles ou de buts,
 * mais elles restent des transitions à valider avant canonisation.
 */
export function executerM03(entree: EntreeM03): SortieM03 {
  const { contexte } = entree;
  const alertes: string[] = [];
  const personnagesParId = new Map(contexte.personnages.map((personnage) => [personnage.id, personnage] as const));
  const ids = idsPnj(entree);
  const vues: VuePersonnageM03[] = [];

  for (const id of ids) {
    const personnage = personnagesParId.get(id);
    if (!personnage) {
      alertes.push(`PNJ ${id} ignoré : aucune identité individuelle n’est disponible.`);
      continue;
    }

    const archetypeIds = entree.archetypeIdsParPnj?.[id] ?? [];
    vues.push(construireVue(contexte, personnage, archetypeIds));
  }

  const options = entree.optionsReaction ?? [];
  const evaluations = vues.flatMap((vue) =>
    options
      .filter((option) => option.acteurId === vue.personnage.id)
      .map((option) => evaluerOption(vue, option)),
  );

  for (const option of options) {
    if (!personnagesParId.has(option.acteurId)) {
      alertes.push(`Option ${option.id} ignorée : acteur ${option.acteurId} absent des identités disponibles.`);
    }
  }

  const decisions = vues.map((vue) =>
    choisirDecision(
      contexte,
      vue,
      options.filter((option) => option.acteurId === vue.personnage.id),
      evaluations,
    ),
  );

  const paroles = (entree.demandesParole ?? []).flatMap((demande) => {
    if (!personnagesParId.has(demande.acteurId)) {
      alertes.push(`Demande de parole ${demande.id} ignorée : acteur ${demande.acteurId} inconnu.`);
      return [];
    }
    return deciderParole(contexte, demande, entree.reglesDivulgation ?? []);
  });

  const transitions: PropositionTransition[] = [
    ...transitionsEmotionnelles(entree.impactsEmotionnels ?? []),
    ...transitionsButs(entree.evolutionsButs ?? [], alertes),
  ];

  const controles = controlesM03(vues, decisions, paroles);
  const contribution = contributionM01(decisions, paroles, controles);

  const contraintes = uniquesTextes([
    ...(contribution.contraintes ?? []),
    ...evaluations.flatMap((evaluation) => evaluation.blocages),
  ]);

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M03,
    contribution,
    transitions: uniquesParCle(transitions, (transition) => transition.id),
    contraintes,
    alertes: uniquesTextes(alertes),
  };

  return {
    moteur: MOTEUR_M03,
    resultat,
    vues,
    evaluations,
    decisions,
    paroles,
    alertes: resultat.alertes,
  };
}

// Référence utilitaire conservée pour garantir que toute transition M03 peut,
// si le Kernel le souhaite plus tard, être reliée à une SourceNarrative
// normalisée sans inventer de contenu supplémentaire.
export function sourceTechniqueM03(id: string): SourceNarrative {
  return sourceDepuisId(id);
}
