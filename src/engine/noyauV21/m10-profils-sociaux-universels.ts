// Elyndor — Noyau narratif natif V2.1
// M10 — Profils sociaux universels.
//
// M10 décrit la position sociale effective d'une personne : droits, accès,
// soutiens, dépendances et exposition. Il ne déduit ni personnalité, ni
// moralité, ni ressources matérielles à partir d'un statut. Les règles des
// institutions restent sous l'autorité de M05 ; M10 applique seulement leurs
// effets explicitement établis à la personne concernée.

import type { ContributionSceneM01 } from './m01-production';
import type {
  AncrageSocial,
  ContexteNarratifV21,
  PropositionTransition,
  ResultatMoteur,
} from './types';

export const MOTEUR_M10 = 'M10' as const;

export type PositionSocialeReferenceM10 =
  | 'aristocratie'
  | 'clerge'
  | 'marchands'
  | 'aventuriers-independants'
  | 'artisans'
  | 'population-locale'
  | 'employes-serviteurs-libres'
  | 'personnes-asservies'
  | 'paria-personne-criminalisee'
  | 'militaires';

export type StatutReconnaissanceM10 =
  | 'reconnu'
  | 'non_reconnu'
  | 'incertain'
  | 'non_applicable';

export type DomaineEffetSocialM10 =
  | 'droit'
  | 'acces'
  | 'soutien'
  | 'dependance'
  | 'exposition';

export type OperationEffetSocialM10 = 'ajouter' | 'retirer';

export type StatutApplicabiliteRegleM10 =
  | 'applicable'
  | 'non_applicable'
  | 'indeterminee';

export type TypeTransitionAncrageM10 =
  | 'reconnaissance_statut'
  | 'perte_reconnaissance'
  | 'affranchissement'
  | 'nomination'
  | 'changement_professionnel'
  | 'criminalisation'
  | 'regularisation'
  | 'autre';

export interface DefinitionProfilSocialM10 {
  id: PositionSocialeReferenceM10;
  nom: string;
  aliases: string[];
  leviersFrequents: string[];
  risquesOuDependances: string[];
  pointAVerifier: string;
}

export interface EffetRegleSocialeM10 {
  domaine: DomaineEffetSocialM10;
  operation: OperationEffetSocialM10;
  valeur: string;
}

/**
 * Règle sociale déjà établie par le monde ou une institution.
 * M10 ne crée pas la règle : il vérifie seulement si elle s'applique ici.
 */
export interface RegleSocialeM10 {
  id: string;
  description: string;
  sourceIds: string[];

  juridictions?: string[];
  cultures?: string[];
  statutsReconnus?: string[];
  positionIds?: PositionSocialeReferenceM10[];
  institutionId?: string;

  conditionsRequises?: string[];
  conditionsSatisfaites?: string[];
  conditionsRefusees?: string[];

  effets: EffetRegleSocialeM10[];
}

/**
 * Faits situés nécessaires à l'évaluation d'une personne. Ces données sont
 * des références vers des états établis ailleurs, pas un stockage concurrent.
 */
export interface SituationPersonneM10 {
  personnageId: string;
  culture?: string;
  juridiction?: string;
  reconnaissanceStatut?: StatutReconnaissanceM10;
  statutLegal?: string;

  /** Accusations connues : elles ne valent pas actes prouvés. */
  accusations?: string[];

  /** Moyens déjà établis par le monde/M06 ; M10 peut les consulter, jamais les créer. */
  ressourcesMateriellesEtablies?: string[];

  /** Réseaux effectivement établis, distincts d'un réseau supposé par la classe sociale. */
  reseauxEtablis?: string[];

  /** Obligations applicables provenant notamment de M05. */
  obligationsApplicables?: string[];

  /** Historique conservé par M02 : il n'écrase jamais le statut courant. */
  historiqueStatuts?: string[];

  /** Possibilités de mobilité explicitement établies dans le monde. */
  mobiliteSociale?: string[];

  /** Positions de référence explicitement connues si le statut seul ne suffit pas. */
  positionIds?: PositionSocialeReferenceM10[];

  /** Si renseigné, seules ces règles sont candidates pour cette personne. */
  regleIdsApplicables?: string[];
}

export interface PressionSocialeM10 {
  id: string;
  cibleId: string;
  description: string;
  vulnerabilitesVisees: string[];
  credibiliteEtablie?: boolean;
  coutsAnnonces?: string[];
  alternativesEtablies?: string[];
  sourceIds: string[];
}

export interface EvaluationPressionM10 {
  pressionId: string;
  cibleId: string;
  cibleTrouvee: boolean;
  vulnerabilitesEffectivementVisees: string[];
  soutiensPertinents: string[];
  alternativesEtablies: string[];
  enjeuAccru: boolean;
  reactionDeterminee: false;
  raisons: string[];
  alertes: string[];
}

export interface DemandeTransitionAncrageM10 {
  id: string;
  personnageId: string;
  type: TypeTransitionAncrageM10;
  vers: AncrageSocial;
  justification: string;
  sourceIds: string[];

  /**
   * Requis pour les changements dont l'effet dépend de la reconnaissance de
   * la juridiction (affranchissement, titre, nomination...).
   */
  reconnaissanceLocaleEtablie?: boolean;

  conditionsRequises?: string[];
  conditionsSatisfaites?: string[];
  conditionsRefusees?: string[];
  perceptible?: boolean;
}

export interface EvaluationTransitionAncrageM10 {
  demandeId: string;
  personnageId: string;
  type: TypeTransitionAncrageM10;
  applicable: boolean;
  raisons: string[];
  blocages: string[];
}

export interface EvaluationRegleSocialeM10 {
  regleId: string;
  personnageId: string;
  statut: StatutApplicabiliteRegleM10;
  raisons: string[];
  conditionsManquantes: string[];
}

export interface LevierSocialEffectifM10 {
  type: 'droit' | 'acces' | 'soutien' | 'reseau' | 'ressource_etablie';
  valeur: string;
}

export interface VulnerabiliteSocialeM10 {
  type: 'dependance' | 'exposition' | 'obligation' | 'statut_legal' | 'accusation';
  valeur: string;
}

export interface EvaluationPersonneM10 {
  personnageId: string;
  personnageTrouve: boolean;
  ancrageTrouve: boolean;
  statutReconnu?: string;
  reconnaissanceStatut: StatutReconnaissanceM10;
  juridiction?: string;
  culture?: string;

  positionsReference: PositionSocialeReferenceM10[];
  droitsEffectifs: string[];
  accesEffectifs: string[];
  soutiensEffectifs: string[];
  dependancesEffectives: string[];
  expositionsEffectives: string[];

  leviersEffectifs: LevierSocialEffectifM10[];
  vulnerabilites: VulnerabiliteSocialeM10[];
  coutsComportementaux: string[];
  mobiliteSociale: string[];
  historiqueStatuts: string[];

  /** Moyens matériels seulement référencés ; ils restent propriété de M06/du monde. */
  ressourcesMateriellesConsultees: string[];

  regles: EvaluationRegleSocialeM10[];
  raisons: string[];
  inconnus: string[];
  alertes: string[];
}

export interface EntreeM10 {
  contexte: ContexteNarratifV21;

  /** Sans liste, M10 examine les participants de la scène qui ont un ancrage ou une identité. */
  personnageIds?: string[];

  situations?: SituationPersonneM10[];
  reglesSociales?: RegleSocialeM10[];
  pressions?: PressionSocialeM10[];
  transitionsDemandees?: DemandeTransitionAncrageM10[];
}

export interface SortieM10 {
  moteur: typeof MOTEUR_M10;
  resultat: ResultatMoteur<ContributionSceneM01>;
  profilsReference: DefinitionProfilSocialM10[];
  evaluationsPersonnes: EvaluationPersonneM10[];
  evaluationsPressions: EvaluationPressionM10[];
  evaluationsTransitions: EvaluationTransitionAncrageM10[];
  transitionsAncrage: PropositionTransition<AncrageSocial>[];
  alertes: string[];
}

const PROFILS_REFERENCE_M10: readonly DefinitionProfilSocialM10[] = [
  {
    id: 'aristocratie',
    nom: 'Aristocratie',
    aliases: ['noble', 'noblesse', 'aristocrate', 'seigneur', 'dame', 'baron', 'comte', 'prince'],
    leviersFrequents: ['titre', 'réseau', 'patrimoine'],
    risquesOuDependances: ['rivalité', 'perte de reconnaissance', 'dette'],
    pointAVerifier: 'Autorité locale réellement applicable.',
  },
  {
    id: 'clerge',
    nom: 'Clergé',
    aliases: ['clergé', 'clerc', 'prêtre', 'prêtresse', 'moine', 'religieux', 'religieuse'],
    leviersFrequents: ['communauté', 'légitimité spirituelle'],
    risquesOuDependances: ['dogme', 'mandat', 'crise de confiance'],
    pointAVerifier: 'Différence entre foi personnelle et pouvoir institutionnel.',
  },
  {
    id: 'marchands',
    nom: 'Marchands',
    aliases: ['marchand', 'marchande', 'commerçant', 'commerçante', 'négociant', 'négociante'],
    leviersFrequents: ['capital', 'clientèle', 'distribution'],
    risquesOuDependances: ['créance', 'rupture d’approvisionnement'],
    pointAVerifier: 'Ressources effectives, pas richesse supposée.',
  },
  {
    id: 'aventuriers-independants',
    nom: 'Aventuriers / indépendants',
    aliases: ['aventurier', 'aventurière', 'indépendant', 'indépendante', 'mercenaire', 'explorateur', 'exploratrice'],
    leviersFrequents: ['compétence', 'mobilité', 'contacts'],
    risquesOuDependances: ['contrats', 'blessure', 'absence de soutien'],
    pointAVerifier: 'Statut légal et protection réelle.',
  },
  {
    id: 'artisans',
    nom: 'Artisans',
    aliases: ['artisan', 'artisane', 'forgeron', 'forgeronne', 'tailleur', 'tisserand', 'atelier'],
    leviersFrequents: ['savoir-faire', 'atelier', 'clientèle'],
    risquesOuDependances: ['commandes', 'matières', 'dépendance économique'],
    pointAVerifier: 'Accès au métier et droits professionnels.',
  },
  {
    id: 'population-locale',
    nom: 'Population locale',
    aliases: ['habitant', 'habitante', 'citoyen', 'citoyenne', 'villageois', 'villageoise', 'résident', 'résidente'],
    leviersFrequents: ['famille', 'communauté', 'connaissance du lieu'],
    risquesOuDependances: ['déplacement', 'précarité', 'coercition'],
    pointAVerifier: 'Diversité d’intérêts au sein du « peuple ».',
  },
  {
    id: 'employes-serviteurs-libres',
    nom: 'Employés / serviteurs libres',
    aliases: ['employé', 'employée', 'salarié', 'salariée', 'serviteur libre', 'servante libre', 'domestique libre'],
    leviersFrequents: ['compétence', 'proximité', 'contrat'],
    risquesOuDependances: ['dépendance à l’emploi', 'devoirs'],
    pointAVerifier: 'Capacité de refuser, quitter ou négocier.',
  },
  {
    id: 'personnes-asservies',
    nom: 'Personnes asservies',
    aliases: ['asservi', 'asservie', 'esclave', 'captif asservi', 'captive asservie'],
    leviersFrequents: ['réseaux informels', 'expérience', 'solidarités'],
    risquesOuDependances: ['contrainte', 'séparation', 'répression'],
    pointAVerifier: 'Liberté limitée n’équivaut ni à absence de volonté ni à consentement.',
  },
  {
    id: 'paria-personne-criminalisee',
    nom: 'Paria / personne criminalisée',
    aliases: ['paria', 'hors-la-loi', 'recherché', 'recherchée', 'criminel', 'criminelle', 'banni', 'bannie'],
    leviersFrequents: ['réseau alternatif', 'dissimulation'],
    risquesOuDependances: ['arrestation', 'exclusion', 'rivaux'],
    pointAVerifier: 'Distinguer accusation, statut légal et actes réellement commis.',
  },
  {
    id: 'militaires',
    nom: 'Militaires',
    aliases: ['militaire', 'soldat', 'soldate', 'officier', 'officière', 'garde', 'capitaine'],
    leviersFrequents: ['organisation', 'camaraderie', 'moyens'],
    risquesOuDependances: ['ordres', 'solde', 'responsabilité'],
    pointAVerifier: 'Mandat, loyautés et marge d’initiative.',
  },
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
    const id = cle(valeur);
    if (!id || vus.has(id)) continue;
    vus.add(id);
    resultat.push(valeur);
  }

  return resultat;
}

function equivalent(a: string, b: string): boolean {
  const na = normaliser(a);
  const nb = normaliser(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function contientEquivalent(valeurs: string[], cible: string): boolean {
  return valeurs.some((valeur) => equivalent(valeur, cible));
}

function retirerEquivalent(valeurs: string[], cible: string): string[] {
  return valeurs.filter((valeur) => !equivalent(valeur, cible));
}

function copierProfilReference(profil: DefinitionProfilSocialM10): DefinitionProfilSocialM10 {
  return {
    id: profil.id,
    nom: profil.nom,
    aliases: [...profil.aliases],
    leviersFrequents: [...profil.leviersFrequents],
    risquesOuDependances: [...profil.risquesOuDependances],
    pointAVerifier: profil.pointAVerifier,
  };
}

function situationPour(entree: EntreeM10, personnageId: string): SituationPersonneM10 | undefined {
  return entree.situations?.find((situation) => situation.personnageId === personnageId);
}

function ancragePour(contexte: ContexteNarratifV21, personnageId: string): AncrageSocial | undefined {
  return contexte.ancragesSociaux.find((ancrage) => ancrage.personnageId === personnageId);
}

function personnageExiste(contexte: ContexteNarratifV21, personnageId: string): boolean {
  return contexte.personnages.some((personnage) => personnage.id === personnageId);
}

function idsPersonnes(entree: EntreeM10): string[] {
  if (entree.personnageIds?.length) return uniquesTextes(entree.personnageIds);

  const idsConnus = new Set<string>([
    ...entree.contexte.personnages.map((personnage) => personnage.id),
    ...entree.contexte.ancragesSociaux.map((ancrage) => ancrage.personnageId),
  ]);

  const participants = entree.contexte.scene.participants.filter((id) => idsConnus.has(id));
  if (participants.length > 0) return uniquesTextes(participants);

  return uniquesTextes(entree.contexte.ancragesSociaux.map((ancrage) => ancrage.personnageId));
}

function positionsReference(
  ancrage: AncrageSocial | undefined,
  situation: SituationPersonneM10 | undefined,
): PositionSocialeReferenceM10[] {
  const explicites = situation?.positionIds ?? [];
  const resultat = new Set<PositionSocialeReferenceM10>(explicites);
  const statut = ancrage?.statutReconnu;

  if (statut) {
    for (const profil of PROFILS_REFERENCE_M10) {
      if (
        equivalent(statut, profil.nom) ||
        profil.aliases.some((alias) => equivalent(statut, alias))
      ) {
        resultat.add(profil.id);
      }
    }
  }

  return [...resultat];
}

function profilReferenceParId(id: PositionSocialeReferenceM10): DefinitionProfilSocialM10 | undefined {
  return PROFILS_REFERENCE_M10.find((profil) => profil.id === id);
}

function correspondListe(valeur: string | undefined, attendus: string[] | undefined): boolean | undefined {
  if (!attendus?.length) return true;
  if (!valeur) return undefined;
  return attendus.some((attendu) => equivalent(valeur, attendu));
}

function evaluerRegle(
  entree: EntreeM10,
  personnageId: string,
  regle: RegleSocialeM10,
  ancrage: AncrageSocial | undefined,
  situation: SituationPersonneM10 | undefined,
  positions: PositionSocialeReferenceM10[],
): EvaluationRegleSocialeM10 {
  const raisons: string[] = [];
  const conditionsManquantes: string[] = [];

  if (situation?.regleIdsApplicables?.length && !situation.regleIdsApplicables.includes(regle.id)) {
    return {
      regleId: regle.id,
      personnageId,
      statut: 'non_applicable',
      raisons: ['La situation exclut cette règle de la liste des règles applicables.'],
      conditionsManquantes: [],
    };
  }

  if (regle.institutionId && !entree.contexte.institutions.some((institution) => institution.id === regle.institutionId)) {
    conditionsManquantes.push(`Institution introuvable : ${regle.institutionId}.`);
  }

  const juridiction = correspondListe(situation?.juridiction, regle.juridictions);
  if (juridiction === false) {
    return {
      regleId: regle.id,
      personnageId,
      statut: 'non_applicable',
      raisons: ['La juridiction actuelle ne correspond pas au périmètre de la règle.'],
      conditionsManquantes: [],
    };
  }
  if (juridiction === undefined) conditionsManquantes.push('Juridiction nécessaire mais inconnue.');

  const culture = correspondListe(situation?.culture, regle.cultures);
  if (culture === false) {
    return {
      regleId: regle.id,
      personnageId,
      statut: 'non_applicable',
      raisons: ['La culture actuelle ne correspond pas au périmètre de la règle.'],
      conditionsManquantes: [],
    };
  }
  if (culture === undefined) conditionsManquantes.push('Culture nécessaire mais inconnue.');

  if (regle.statutsReconnus?.length) {
    if (!ancrage?.statutReconnu) {
      conditionsManquantes.push('Statut reconnu nécessaire mais inconnu.');
    } else if (!regle.statutsReconnus.some((statut) => equivalent(statut, ancrage.statutReconnu!))) {
      return {
        regleId: regle.id,
        personnageId,
        statut: 'non_applicable',
        raisons: ['Le statut reconnu ne correspond pas à cette règle.'],
        conditionsManquantes: [],
      };
    }
  }

  if (regle.positionIds?.length) {
    if (positions.length === 0) {
      conditionsManquantes.push('Position sociale de référence nécessaire mais non établie.');
    } else if (!regle.positionIds.some((position) => positions.includes(position))) {
      return {
        regleId: regle.id,
        personnageId,
        statut: 'non_applicable',
        raisons: ['La position sociale ne correspond pas au périmètre de la règle.'],
        conditionsManquantes: [],
      };
    }
  }

  const requises = uniquesTextes(regle.conditionsRequises ?? []);
  const satisfaites = uniquesTextes(regle.conditionsSatisfaites ?? []);
  const refusees = uniquesTextes(regle.conditionsRefusees ?? []);

  for (const condition of requises) {
    if (contientEquivalent(refusees, condition)) {
      return {
        regleId: regle.id,
        personnageId,
        statut: 'non_applicable',
        raisons: [`Condition explicitement non satisfaite : ${condition}.`],
        conditionsManquantes: [],
      };
    }
    if (!contientEquivalent(satisfaites, condition)) conditionsManquantes.push(condition);
  }

  if (conditionsManquantes.length > 0) {
    return {
      regleId: regle.id,
      personnageId,
      statut: 'indeterminee',
      raisons: ['La règle ne modifie pas la position tant que ses conditions déterminantes ne sont pas établies.'],
      conditionsManquantes: uniquesTextes(conditionsManquantes),
    };
  }

  raisons.push('Le périmètre et les conditions explicites de la règle sont satisfaits.');
  return {
    regleId: regle.id,
    personnageId,
    statut: 'applicable',
    raisons,
    conditionsManquantes: [],
  };
}

function appliquerEffet(
  etat: Pick<AncrageSocial, 'droits' | 'acces' | 'soutiens' | 'dependances' | 'expositions'>,
  effet: EffetRegleSocialeM10,
): void {
  const valeur = propre(effet.valeur);
  if (!valeur) return;

  const collection =
    effet.domaine === 'droit' ? etat.droits :
    effet.domaine === 'acces' ? etat.acces :
    effet.domaine === 'soutien' ? etat.soutiens :
    effet.domaine === 'dependance' ? etat.dependances :
    etat.expositions;

  if (effet.operation === 'ajouter') {
    if (!contientEquivalent(collection, valeur)) collection.push(valeur);
    return;
  }

  const nouvelle = retirerEquivalent(collection, valeur);
  collection.splice(0, collection.length, ...nouvelle);
}

function leviersEffectifs(
  droits: string[],
  acces: string[],
  soutiens: string[],
  situation: SituationPersonneM10 | undefined,
): LevierSocialEffectifM10[] {
  return uniquesParCle(
    [
      ...droits.map((valeur) => ({ type: 'droit' as const, valeur })),
      ...acces.map((valeur) => ({ type: 'acces' as const, valeur })),
      ...soutiens.map((valeur) => ({ type: 'soutien' as const, valeur })),
      ...(situation?.reseauxEtablis ?? []).map((valeur) => ({ type: 'reseau' as const, valeur })),
      ...(situation?.ressourcesMateriellesEtablies ?? []).map((valeur) => ({ type: 'ressource_etablie' as const, valeur })),
    ],
    (levier) => `${levier.type}:${normaliser(levier.valeur)}`,
  );
}

function vulnerabilitesEffectives(
  dependances: string[],
  expositions: string[],
  situation: SituationPersonneM10 | undefined,
): VulnerabiliteSocialeM10[] {
  return uniquesParCle(
    [
      ...dependances.map((valeur) => ({ type: 'dependance' as const, valeur })),
      ...expositions.map((valeur) => ({ type: 'exposition' as const, valeur })),
      ...(situation?.obligationsApplicables ?? []).map((valeur) => ({ type: 'obligation' as const, valeur })),
      ...(situation?.statutLegal ? [{ type: 'statut_legal' as const, valeur: situation.statutLegal }] : []),
      ...(situation?.accusations ?? []).map((valeur) => ({ type: 'accusation' as const, valeur })),
    ],
    (vulnerabilite) => `${vulnerabilite.type}:${normaliser(vulnerabilite.valeur)}`,
  );
}

function coutsComportementaux(
  dependances: string[],
  expositions: string[],
  situation: SituationPersonneM10 | undefined,
): string[] {
  return uniquesTextes([
    ...dependances.map((dependance) => `Dépendance à prendre en compte : ${dependance}.`),
    ...expositions.map((exposition) => `Exposition sociale à prendre en compte : ${exposition}.`),
    ...(situation?.obligationsApplicables ?? []).map((obligation) => `Obligation applicable : ${obligation}.`),
  ]);
}

function raisonsReferences(
  positions: PositionSocialeReferenceM10[],
  situation: SituationPersonneM10 | undefined,
): string[] {
  const raisons: string[] = [];

  for (const id of positions) {
    const profil = profilReferenceParId(id);
    if (!profil) continue;
    raisons.push(`Repère social « ${profil.nom} » : ${profil.pointAVerifier}`);

    if (id === 'marchands' && (situation?.ressourcesMateriellesEtablies ?? []).length === 0) {
      raisons.push('La position marchande ne suffit pas à établir une richesse ou un capital disponible.');
    }
    if (id === 'aristocratie' && situation?.reconnaissanceStatut === 'non_reconnu') {
      raisons.push('Le titre n’est pas reconnu localement : aucune autorité locale supplémentaire ne peut être déduite du titre seul.');
    }
    if (id === 'personnes-asservies') {
      raisons.push('Une restriction de liberté ne supprime ni volonté propre, ni capacité de refus lorsqu’une option réelle existe, ni nécessité d’évaluer la réaction via M03.');
    }
  }

  return uniquesTextes(raisons);
}

function evaluerPersonne(entree: EntreeM10, personnageId: string): EvaluationPersonneM10 {
  const ancrage = ancragePour(entree.contexte, personnageId);
  const situation = situationPour(entree, personnageId);
  const positions = positionsReference(ancrage, situation);
  const reconnaissanceStatut = situation?.reconnaissanceStatut ?? (ancrage?.statutReconnu ? 'reconnu' : 'incertain');

  const etat = {
    droits: uniquesTextes(ancrage?.droits ?? []),
    acces: uniquesTextes(ancrage?.acces ?? []),
    soutiens: uniquesTextes(ancrage?.soutiens ?? []),
    dependances: uniquesTextes(ancrage?.dependances ?? []),
    expositions: uniquesTextes(ancrage?.expositions ?? []),
  };

  const regles = (entree.reglesSociales ?? []).map((regle) =>
    evaluerRegle(entree, personnageId, regle, ancrage, situation, positions),
  );

  for (const evaluation of regles) {
    if (evaluation.statut !== 'applicable') continue;
    const regle = (entree.reglesSociales ?? []).find((candidate) => candidate.id === evaluation.regleId);
    if (!regle) continue;
    for (const effet of regle.effets) appliquerEffet(etat, effet);
  }

  const leviers = leviersEffectifs(etat.droits, etat.acces, etat.soutiens, situation);
  const vulnerabilites = vulnerabilitesEffectives(etat.dependances, etat.expositions, situation);
  const inconnus: string[] = [];
  const raisons: string[] = [];
  const alertes: string[] = [];

  if (!ancrage) {
    inconnus.push('Aucun ancrage social courant n’est établi pour cette personne.');
    raisons.push('M10 laisse la position inconnue plutôt que de l’inférer depuis la personnalité, la race ou un archétype.');
  }

  if (reconnaissanceStatut === 'incertain') {
    inconnus.push('La reconnaissance locale du statut n’est pas établie.');
  } else if (reconnaissanceStatut === 'non_reconnu') {
    raisons.push('Le statut ou titre peut exister historiquement sans produire l’autorité locale attendue dans cette juridiction.');
  }

  const reglesIndeterminees = regles.filter((regle) => regle.statut === 'indeterminee');
  for (const regle of reglesIndeterminees) {
    inconnus.push(`Règle ${regle.regleId} non appliquée : ${regle.conditionsManquantes.join(', ')}`);
  }

  if ((situation?.historiqueStatuts ?? []).length > 0 && ancrage?.statutReconnu) {
    raisons.push('L’historique de statut est conservé comme antécédent ; il ne rétablit pas automatiquement une restriction antérieure.');
  }

  if ((situation?.accusations ?? []).length > 0) {
    raisons.push('Les accusations sont conservées comme allégations ou exposition ; elles ne prouvent pas les actes allégués ni le statut légal.');
  }

  raisons.push(...raisonsReferences(positions, situation));

  if (positions.includes('aristocratie') && leviers.some((levier) => levier.type === 'ressource_etablie') === false) {
    raisons.push('Un rang aristocratique n’autorise pas M10 à inventer une fortune, des soldats ou un patrimoine disponible.');
  }

  if (!personnageExiste(entree.contexte, personnageId) && !ancrage) {
    alertes.push(`Personne introuvable pour M10 : ${personnageId}.`);
  }

  return {
    personnageId,
    personnageTrouve: personnageExiste(entree.contexte, personnageId),
    ancrageTrouve: Boolean(ancrage),
    statutReconnu: ancrage?.statutReconnu,
    reconnaissanceStatut,
    juridiction: situation?.juridiction,
    culture: situation?.culture,
    positionsReference: positions,
    droitsEffectifs: uniquesTextes(etat.droits),
    accesEffectifs: uniquesTextes(etat.acces),
    soutiensEffectifs: uniquesTextes(etat.soutiens),
    dependancesEffectives: uniquesTextes(etat.dependances),
    expositionsEffectives: uniquesTextes(etat.expositions),
    leviersEffectifs: leviers,
    vulnerabilites,
    coutsComportementaux: coutsComportementaux(etat.dependances, etat.expositions, situation),
    mobiliteSociale: uniquesTextes(situation?.mobiliteSociale ?? []),
    historiqueStatuts: uniquesTextes(situation?.historiqueStatuts ?? []),
    ressourcesMateriellesConsultees: uniquesTextes(situation?.ressourcesMateriellesEtablies ?? []),
    regles,
    raisons: uniquesTextes(raisons),
    inconnus: uniquesTextes(inconnus),
    alertes: uniquesTextes(alertes),
  };
}

function correspondVulnerabilite(a: string, b: string): boolean {
  return equivalent(a, b);
}

function evaluerPression(
  pression: PressionSocialeM10,
  evaluations: EvaluationPersonneM10[],
): EvaluationPressionM10 {
  const cible = evaluations.find((evaluation) => evaluation.personnageId === pression.cibleId);
  if (!cible) {
    return {
      pressionId: pression.id,
      cibleId: pression.cibleId,
      cibleTrouvee: false,
      vulnerabilitesEffectivementVisees: [],
      soutiensPertinents: [],
      alternativesEtablies: uniquesTextes(pression.alternativesEtablies ?? []),
      enjeuAccru: false,
      reactionDeterminee: false,
      raisons: [],
      alertes: [`Cible de pression introuvable pour M10 : ${pression.cibleId}.`],
    };
  }

  const vulnerabilitesVisees = uniquesTextes(pression.vulnerabilitesVisees);
  const touchees = cible.vulnerabilites
    .filter((vulnerabilite) =>
      vulnerabilitesVisees.some((visee) => correspondVulnerabilite(visee, vulnerabilite.valeur)),
    )
    .map((vulnerabilite) => vulnerabilite.valeur);

  const raisons: string[] = [];
  if (touchees.length > 0) {
    raisons.push(`La pression vise une vulnérabilité sociale effectivement établie : ${touchees.join(', ')}.`);
  } else {
    raisons.push('Aucune vulnérabilité établie de la cible ne correspond explicitement à la pression décrite.');
  }

  if (pression.credibiliteEtablie === false) {
    raisons.push('La menace est explicitement non crédible ; M10 ne la traite pas comme un coût certain.');
  } else if (pression.credibiliteEtablie === undefined) {
    raisons.push('La crédibilité de la menace n’est pas établie ; elle reste un facteur ouvert pour M03/M14.');
  }

  raisons.push('Une vulnérabilité augmente l’enjeu mais ne garantit jamais la capitulation, l’obéissance ou le mensonge.');

  return {
    pressionId: pression.id,
    cibleId: pression.cibleId,
    cibleTrouvee: true,
    vulnerabilitesEffectivementVisees: uniquesTextes(touchees),
    soutiensPertinents: [...cible.soutiensEffectifs],
    alternativesEtablies: uniquesTextes(pression.alternativesEtablies ?? []),
    enjeuAccru: touchees.length > 0 && pression.credibiliteEtablie !== false,
    reactionDeterminee: false,
    raisons: uniquesTextes(raisons),
    alertes: [],
  };
}

function ancragesEquivalents(a: AncrageSocial | undefined, b: AncrageSocial): boolean {
  if (!a) return false;
  const signature = (valeurs: string[]) =>
    uniquesTextes(valeurs).map(normaliser).sort((x, y) => x.localeCompare(y)).join('|');

  return normaliser(a.personnageId) === normaliser(b.personnageId) &&
    normaliser(a.statutReconnu) === normaliser(b.statutReconnu) &&
    signature(a.droits) === signature(b.droits) &&
    signature(a.acces) === signature(b.acces) &&
    signature(a.dependances) === signature(b.dependances) &&
    signature(a.soutiens) === signature(b.soutiens) &&
    signature(a.expositions) === signature(b.expositions);
}

function typeExigeReconnaissance(type: TypeTransitionAncrageM10): boolean {
  return type === 'affranchissement' ||
    type === 'reconnaissance_statut' ||
    type === 'nomination' ||
    type === 'regularisation';
}

function evaluerTransition(
  entree: EntreeM10,
  demande: DemandeTransitionAncrageM10,
): EvaluationTransitionAncrageM10 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  const courant = ancragePour(entree.contexte, demande.personnageId);

  if (!propre(demande.id)) blocages.push('Identifiant de transition manquant.');
  if (!propre(demande.personnageId)) blocages.push('Personnage cible manquant.');
  if (demande.vers.personnageId !== demande.personnageId) {
    blocages.push('La valeur proposée cible un autre personnage.');
  }
  if (!propre(demande.justification)) blocages.push('Justification du changement social manquante.');
  if (uniquesTextes(demande.sourceIds).length === 0) {
    blocages.push('Aucune source n’établit le changement de position sociale.');
  }

  const requises = uniquesTextes(demande.conditionsRequises ?? []);
  const satisfaites = uniquesTextes(demande.conditionsSatisfaites ?? []);
  const refusees = uniquesTextes(demande.conditionsRefusees ?? []);

  for (const condition of requises) {
    if (contientEquivalent(refusees, condition)) {
      blocages.push(`Condition explicitement non satisfaite : ${condition}.`);
      continue;
    }
    if (!contientEquivalent(satisfaites, condition)) {
      blocages.push(`Condition requise non établie : ${condition}.`);
    }
  }

  if (typeExigeReconnaissance(demande.type) && demande.reconnaissanceLocaleEtablie !== true) {
    blocages.push('La reconnaissance locale nécessaire à ce changement n’est pas établie.');
  }

  if (courant && ancragesEquivalents(courant, demande.vers)) {
    blocages.push('La transition proposée ne modifie pas l’ancrage social courant.');
  }

  if (demande.type === 'affranchissement') {
    raisons.push('Un affranchissement reconnu modifie les droits et restrictions actuels sans restaurer automatiquement les anciennes contraintes.');
  }
  if (demande.type === 'perte_reconnaissance') {
    raisons.push('La perte de reconnaissance peut réduire l’autorité effective sans effacer le titre historique ni les contacts encore établis.');
  }
  if (demande.type === 'criminalisation') {
    raisons.push('Un statut légal défavorable est distinct de la vérité de chaque accusation et de la personnalité de la personne.');
  }

  if (blocages.length === 0) {
    raisons.push('Le changement social est explicitement sourcé et ses conditions déterminantes sont établies.');
  }

  return {
    demandeId: demande.id,
    personnageId: demande.personnageId,
    type: demande.type,
    applicable: blocages.length === 0,
    raisons: uniquesTextes(raisons),
    blocages: uniquesTextes(blocages),
  };
}

function transitionDepuisDemande(
  demande: DemandeTransitionAncrageM10,
  evaluation: EvaluationTransitionAncrageM10,
): PropositionTransition<AncrageSocial> | undefined {
  if (!evaluation.applicable) return undefined;

  return {
    id: `m10:${demande.id}`,
    moteurProprietaire: MOTEUR_M10,
    domaine: 'social',
    categorie: 'sociale',
    cibleIds: [demande.personnageId],
    justification: demande.justification,
    sourceIds: uniquesTextes(demande.sourceIds),
    valeurProposee: {
      personnageId: demande.vers.personnageId,
      statutReconnu: demande.vers.statutReconnu,
      droits: uniquesTextes(demande.vers.droits),
      acces: uniquesTextes(demande.vers.acces),
      dependances: uniquesTextes(demande.vers.dependances),
      soutiens: uniquesTextes(demande.vers.soutiens),
      expositions: uniquesTextes(demande.vers.expositions),
    },
    perceptible: demande.perceptible ?? true,
    transmissible: true,
  };
}

function contraintesM10(
  evaluations: EvaluationPersonneM10[],
  pressions: EvaluationPressionM10[],
): string[] {
  const contraintes = [
    'La position sociale décrit des droits, accès, soutiens, dépendances et risques ; elle ne définit ni la valeur morale ni la personnalité d’une personne.',
    'Un titre, une profession ou une classe ne crée jamais automatiquement argent, équipement, compétence, loyauté ou autorité locale.',
    'Les règles institutionnelles viennent de M05 ; M10 applique seulement leurs effets explicitement établis à la personne concernée.',
    'Une accusation, un statut légal et un acte réellement commis restent trois notions distinctes.',
    'Un ancien statut reste un antécédent ; il ne rétablit pas automatiquement des restrictions supprimées par une transition reconnue.',
    'Une vulnérabilité sociale augmente l’enjeu d’une pression mais ne détermine pas la réaction du PNJ.',
    'Une norme de classe ou de culture ne fixe pas un vocabulaire uniforme et ne permet jamais de dériver une psychologie depuis une race.',
  ];

  if (evaluations.some((evaluation) => evaluation.reconnaissanceStatut === 'non_reconnu')) {
    contraintes.push('Un statut non reconnu localement ne procure pas automatiquement les droits ou l’autorité attendus ailleurs.');
  }

  if (pressions.some((pression) => pression.enjeuAccru)) {
    contraintes.push('Pour les pressions socialement crédibles, M03 compare encore valeurs, alternatives, coûts et soutiens ; aucune capitulation automatique n’est autorisée.');
  }

  return uniquesTextes(contraintes);
}

function interditsM10(): string[] {
  return [
    'Ne pas inventer une fortune à un noble ou un marchand, une protection à un aventurier, une autorité à un titre non reconnu ou une obéissance à une personne dépendante.',
    'Ne pas confondre serviteur libre et personne asservie, ni restaurer un statut d’asservissement après un affranchissement reconnu.',
    'Ne pas transformer précarité, criminalisation, classe sociale ou origine en trait moral ou psychologique automatique.',
    'Ne pas créer une seconde réserve de ressources matérielles dans M10 : les moyens effectifs restent ceux établis par le monde et M06.',
    'Ne pas inventer les règles d’une institution : leur contenu et leur mandat appartiennent à M05.',
  ];
}

function contributionM10(
  evaluations: EvaluationPersonneM10[],
  pressions: EvaluationPressionM10[],
): ContributionSceneM01 {
  return {
    contraintes: contraintesM10(evaluations, pressions),
    interditsNarratifs: interditsM10(),
  };
}

/**
 * M10 est déterministe et local. Il lit l'ancrage social courant, applique
 * seulement les règles situées explicitement établies et propose les
 * transitions sociales demandées. Il ne modifie aucun état persistant seul.
 */
export function executerM10(entree: EntreeM10): SortieM10 {
  const evaluationsPersonnes = idsPersonnes(entree).map((personnageId) =>
    evaluerPersonne(entree, personnageId),
  );

  const evaluationsPressions = (entree.pressions ?? []).map((pression) =>
    evaluerPression(pression, evaluationsPersonnes),
  );

  const evaluationsTransitions = (entree.transitionsDemandees ?? []).map((demande) =>
    evaluerTransition(entree, demande),
  );

  const transitionsAncrage = (entree.transitionsDemandees ?? [])
    .map((demande, index) => transitionDepuisDemande(demande, evaluationsTransitions[index]))
    .filter((transition): transition is PropositionTransition<AncrageSocial> => Boolean(transition));

  const alertes = uniquesTextes([
    ...evaluationsPersonnes.flatMap((evaluation) => evaluation.alertes),
    ...evaluationsPressions.flatMap((evaluation) => evaluation.alertes),
    ...evaluationsTransitions.flatMap((evaluation) =>
      evaluation.applicable ? [] : evaluation.blocages.map((blocage) => `Transition ${evaluation.demandeId} : ${blocage}`),
    ),
  ]);

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M10,
    contribution: contributionM10(evaluationsPersonnes, evaluationsPressions),
    transitions: transitionsAncrage,
    contraintes: contraintesM10(evaluationsPersonnes, evaluationsPressions),
    alertes,
  };

  return {
    moteur: MOTEUR_M10,
    resultat,
    profilsReference: PROFILS_REFERENCE_M10.map(copierProfilReference),
    evaluationsPersonnes,
    evaluationsPressions,
    evaluationsTransitions,
    transitionsAncrage,
    alertes,
  };
}
