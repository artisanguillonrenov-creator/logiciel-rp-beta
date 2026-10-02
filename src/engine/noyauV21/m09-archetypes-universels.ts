// Elyndor — Noyau narratif natif V2.1
// M09 — Archétypes universels.
//
// M09 fournit des tendances génériques uniquement lorsqu'un PNJ est peu défini.
// Il n'établit ni personnalité individuelle, ni moralité, ni compétence prouvée,
// ni statut social. M03 reste propriétaire de l'individualisation du PNJ et
// M10 de son ancrage social.

import type { ContributionSceneM01 } from './m01-production';
import type {
  ContexteNarratifV21,
  IdentitePersonnage,
  ResultatMoteur,
  TendanceArchetype,
} from './types';

export const MOTEUR_M09 = 'M09' as const;

export type ChampIndividuelM09 = 'traits' | 'buts' | 'competences';

export type OrigineArchetypeM09 = 'reference' | 'contexte' | 'extension';

export interface DefinitionArchetypeM09 extends TendanceArchetype {
  /** Termes de rôle qui permettent d'identifier ce schéma sans en faire une identité. */
  rolesAssocies: string[];

  /** Indices de contexte pouvant départager plusieurs schémas plausibles. */
  contextesFavorables?: string[];

  /** Compétences indicatives uniquement ; elles ne deviennent jamais prouvées par M09. */
  competencesIndicatives?: string[];

  origine?: OrigineArchetypeM09;
}

export interface ExtensionArchetypeM09 {
  archetype: DefinitionArchetypeM09;
  justification: string;
}

export interface EvaluationExtensionM09 {
  archetypeId: string;
  valide: boolean;
  raisons: string[];
  doublonAvec?: string;
}

export interface ProfilPnjM09 {
  personnageId: string;

  /** Rôles réellement attribués ou plausiblement décrits par la situation. */
  roles: string[];

  /**
   * Expérience disponible pour aider la sélection. Elle n'ajoute aucune
   * compétence à la fiche individuelle.
   */
  experienceDisponible?: string[];

  /**
   * Compétences présumées mais non décisives. Elles servent seulement d'indice
   * de sélection et ne doivent pas être remontées comme capacités établies.
   */
  competencesPresumees?: string[];

  /** Indices de scène servant à prioriser une tendance lorsque plusieurs conviennent. */
  contexte?: string[];

  /** Réduction explicite du domaine de recherche lorsqu'un rôle est déjà cadré. */
  archetypeIdsAutorises?: string[];
  archetypeIdsExclus?: string[];

  /**
   * Priorité contextuelle explicite. L'ordre exprime une préférence de situation,
   * pas un poids psychologique ou un mélange numérique.
   */
  prioriteContextuelle?: string[];
}

export interface CorrespondanceArchetypeM09 {
  archetypeId: string;
  correspondRole: boolean;
  correspondContexte: boolean;
  correspondExperience: boolean;
  correspondCompetencePresumee: boolean;
  raisons: string[];
}

export interface SuggestionArchetypeM09 {
  personnageId: string;
  archetypeId: string;
  principal: boolean;

  /** Hypothèses utilisables seulement si les buts individuels manquent. */
  attentionsSuggerees: string[];

  /** Options de réaction, jamais compétences ou réussites acquises. */
  optionsReactionSuggerees: string[];

  /** Variantes proposées à M03 pour individualisation, jamais traits canoniques. */
  variantesSuggerees: string[];

  champsCompletesParHypothese: ChampIndividuelM09[];
  justification: string[];
}

export interface EvaluationPnjM09 {
  personnageId: string;
  personnageTrouve: boolean;
  champsIndividuelsManquants: ChampIndividuelM09[];
  archetypesConsideres: string[];
  archetypesRetenus: string[];
  archetypePrincipal?: string;
  correspondances: CorrespondanceArchetypeM09[];
  suggestions: SuggestionArchetypeM09[];
  raisons: string[];
  alertes: string[];
}

export interface EntreeM09 {
  contexte: ContexteNarratifV21;

  /** Sans liste, M09 examine les PNJ présents dans la scène. */
  pnjIds?: string[];

  /** Permet d'exclure le personnage joueur du traitement archétypal. */
  personnageJoueurId?: string;

  /** Indices de rôle/contextes fournis par le Kernel ou le monde actif. */
  profils?: ProfilPnjM09[];

  /** Schémas propres au monde à ajouter à la palette de référence. */
  extensions?: ExtensionArchetypeM09[];

  /**
   * Si faux, la palette de référence n'est pas injectée. Utile pour un monde
   * disposant volontairement de sa propre palette complète.
   */
  utiliserPaletteReference?: boolean;
}

export interface SortieM09 {
  moteur: typeof MOTEUR_M09;
  resultat: ResultatMoteur<ContributionSceneM01>;
  paletteEffective: DefinitionArchetypeM09[];
  evaluationsExtensions: EvaluationExtensionM09[];
  evaluationsPnj: EvaluationPnjM09[];

  /**
   * Sortie directement exploitable par M03. Le Kernel peut placer la palette
   * effective dans le contexte partagé puis lui transmettre ces identifiants.
   */
  archetypeIdsParPnj: Record<string, string[]>;

  alertes: string[];
}

const PALETTE_REFERENCE_M09: readonly DefinitionArchetypeM09[] = [
  {
    id: 'guerrier',
    nom: 'Guerrier',
    rolesAssocies: ['guerrier', 'combattant', 'mercenaire', 'champion'],
    contextesFavorables: ['menace', 'combat', 'terrain', 'protection', 'pression'],
    competencesIndicatives: ['combat', 'armes', 'tactique'],
    attentions: ['menace', 'terrain', 'moyens'],
    optionsAction: ['protéger', 'engager', 'temporiser', 'reculer'],
    variantes: ['courage discipliné', 'peur maîtrisée', 'expérience traumatique'],
    origine: 'reference',
  },
  {
    id: 'marchand',
    nom: 'Marchand',
    rolesAssocies: ['marchand', 'vendeur', 'négociant', 'commerçant'],
    contextesFavorables: ['échange', 'prix', 'vente', 'achat', 'risque', 'transaction'],
    competencesIndicatives: ['négoce', 'commerce', 'estimation'],
    attentions: ['valeur', 'fiabilité', 'risque d’échange'],
    optionsAction: ['négocier', 'refuser', 'alerter', 'préserver son bien'],
    variantes: ['honnête', 'prudent', 'opportuniste', 'solidaire'],
    origine: 'reference',
  },
  {
    id: 'noble-dirigeant',
    nom: 'Noble / dirigeant',
    rolesAssocies: ['noble', 'dirigeant', 'seigneur', 'chef', 'régent', 'gouverneur'],
    contextesFavorables: ['rang', 'légitimité', 'alliance', 'politique', 'autorité'],
    competencesIndicatives: ['politique', 'commandement', 'diplomatie'],
    attentions: ['rang', 'légitimité', 'alliances'],
    optionsAction: ['recours politique', 'compromis', 'démonstration d’autorité'],
    variantes: ['réformateur', 'combattant', 'discret', 'dépendant d’un protecteur'],
    origine: 'reference',
  },
  {
    id: 'aventurier',
    nom: 'Aventurier',
    rolesAssocies: ['aventurier', 'explorateur', 'indépendant', 'éclaireur'],
    contextesFavorables: ['exploration', 'inconnu', 'équipe', 'coût', 'opportunité'],
    competencesIndicatives: ['exploration', 'survie', 'improvisation'],
    attentions: ['possibilités', 'coûts', 'équipe'],
    optionsAction: ['explorer', 'improviser', 'se retirer', 'demander de l’aide'],
    variantes: ['spécialiste méthodique', 'débutant prudent'],
    origine: 'reference',
  },
  {
    id: 'religieux',
    nom: 'Religieux',
    rolesAssocies: ['religieux', 'prêtre', 'prêtresse', 'moine', 'clerc', 'dévot'],
    contextesFavorables: ['foi', 'rituel', 'devoir spirituel', 'communauté', 'valeurs'],
    competencesIndicatives: ['rituel', 'théologie', 'médiation'],
    attentions: ['valeurs', 'rituel', 'devoir spirituel'],
    optionsAction: ['consoler', 'argumenter', 'protéger', 'condamner'],
    variantes: ['conviction ouverte', 'rigorisme', 'crise de foi'],
    origine: 'reference',
  },
  {
    id: 'bandit',
    nom: 'Bandit',
    rolesAssocies: ['bandit', 'brigand', 'hors-la-loi', 'pillard'],
    contextesFavorables: ['vulnérabilité', 'contrôle', 'sécurité', 'embuscade', 'fuite'],
    competencesIndicatives: ['intimidation', 'embuscade', 'fuite'],
    attentions: ['vulnérabilité', 'contrôle', 'sécurité'],
    optionsAction: ['intimider', 'fuir', 'négocier', 'tendre une embuscade'],
    variantes: ['code de groupe', 'nécessité', 'ambition'],
    origine: 'reference',
  },
  {
    id: 'erudit-mage',
    nom: 'Érudit / mage',
    rolesAssocies: ['érudit', 'mage', 'savant', 'chercheur', 'occultiste'],
    contextesFavorables: ['indice', 'mécanisme', 'savoir', 'expérience', 'analyse'],
    competencesIndicatives: ['analyse', 'recherche', 'magie', 'érudition'],
    attentions: ['indices', 'mécanisme', 'savoir'],
    optionsAction: ['analyser', 'expérimenter', 'protéger', 'chercher un abri'],
    variantes: ['compétence physique variable', 'discipline', 'curiosité risquée'],
    origine: 'reference',
  },
  {
    id: 'domestique-assistant',
    nom: 'Domestique / assistant',
    rolesAssocies: ['domestique', 'assistant', 'aide', 'serviteur', 'intendant'],
    contextesFavorables: ['tâche', 'attente', 'fonctionnement local', 'service', 'routine'],
    competencesIndicatives: ['service', 'organisation', 'fonctionnement local'],
    attentions: ['tâche', 'attentes', 'fonctionnement local'],
    optionsAction: ['alerter', 'aider', 'dissimuler', 'refuser selon marge réelle'],
    variantes: ['professionnalisme', 'loyauté choisie', 'contrainte'],
    origine: 'reference',
  },
  {
    id: 'garde-soldat',
    nom: 'Garde / soldat',
    rolesAssocies: ['garde', 'soldat', 'sentinelle', 'militaire', 'patrouilleur'],
    contextesFavorables: ['consigne', 'ordre', 'sécurité', 'contrôle', 'patrouille'],
    competencesIndicatives: ['surveillance', 'combat', 'contrôle'],
    attentions: ['consigne', 'ordre', 'sécurité'],
    optionsAction: ['contrôler', 'rapporter', 'intervenir', 'temporiser'],
    variantes: ['initiative', 'doute', 'corruption', 'devoir réfléchi'],
    origine: 'reference',
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

function correspond(a: string, b: string): boolean {
  const na = normaliser(a);
  const nb = normaliser(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function contientEquivalent(collection: string[], valeur: string): boolean {
  return collection.some((element) => correspond(element, valeur));
}

function auMoinsUneCorrespondance(a: string[], b: string[]): boolean {
  return a.some((elementA) => b.some((elementB) => correspond(elementA, elementB)));
}

function hashStable(valeur: string): number {
  let hash = 2166136261;
  for (let i = 0; i < valeur.length; i += 1) {
    hash ^= valeur.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function copierArchetype(
  archetype: DefinitionArchetypeM09,
  origine: OrigineArchetypeM09,
): DefinitionArchetypeM09 {
  return {
    id: propre(archetype.id),
    nom: propre(archetype.nom),
    rolesAssocies: uniquesTextes(archetype.rolesAssocies),
    contextesFavorables: uniquesTextes(archetype.contextesFavorables ?? []),
    competencesIndicatives: uniquesTextes(archetype.competencesIndicatives ?? []),
    attentions: uniquesTextes(archetype.attentions),
    optionsAction: uniquesTextes(archetype.optionsAction),
    variantes: uniquesTextes(archetype.variantes),
    origine,
  };
}

function depuisArchetypeContexte(archetype: TendanceArchetype): DefinitionArchetypeM09 {
  return {
    id: propre(archetype.id),
    nom: propre(archetype.nom),
    rolesAssocies: uniquesTextes([archetype.id, archetype.nom]),
    contextesFavorables: [],
    competencesIndicatives: [],
    attentions: uniquesTextes(archetype.attentions),
    optionsAction: uniquesTextes(archetype.optionsAction),
    variantes: uniquesTextes(archetype.variantes),
    origine: 'contexte',
  };
}

function signatureArchetype(archetype: DefinitionArchetypeM09): string {
  const bloc = (valeurs: string[]) =>
    valeurs.map(normaliser).filter(Boolean).sort((a, b) => a.localeCompare(b)).join('|');

  return [bloc(archetype.attentions), bloc(archetype.optionsAction), bloc(archetype.variantes)].join('::');
}

function optionDistincte(
  archetype: DefinitionArchetypeM09,
  existants: DefinitionArchetypeM09[],
): boolean {
  const optionsExistantes = existants.flatMap((existant) => existant.optionsAction);
  return archetype.optionsAction.some((option) => !contientEquivalent(optionsExistantes, option));
}

function trouverDoublon(
  archetype: DefinitionArchetypeM09,
  existants: DefinitionArchetypeM09[],
): DefinitionArchetypeM09 | undefined {
  const id = normaliser(archetype.id);
  const nom = normaliser(archetype.nom);
  const signature = signatureArchetype(archetype);

  return existants.find((existant) => {
    if (normaliser(existant.id) === id) return true;
    if (normaliser(existant.nom) === nom) return true;
    return Boolean(signature) && signatureArchetype(existant) === signature;
  });
}

function evaluerExtension(
  extension: ExtensionArchetypeM09,
  existants: DefinitionArchetypeM09[],
): EvaluationExtensionM09 {
  const archetype = extension.archetype;
  const raisons: string[] = [];

  if (!propre(archetype.id)) raisons.push('Identifiant d’archétype manquant.');
  if (!propre(archetype.nom)) raisons.push('Nom d’archétype manquant.');
  if (!propre(extension.justification)) raisons.push('Justification d’extension manquante.');
  if (archetype.attentions.length === 0) raisons.push('Aucune attention générique définie.');
  if (archetype.optionsAction.length === 0) raisons.push('Aucune option d’action définie.');
  if (archetype.rolesAssocies.length === 0) raisons.push('Aucun rôle associé défini.');

  const doublon = trouverDoublon(archetype, existants);
  if (doublon) {
    raisons.push(`Schéma déjà couvert par « ${doublon.nom} ».`);
  } else if (archetype.optionsAction.length > 0 && !optionDistincte(archetype, existants)) {
    raisons.push('L’extension n’apporte aucune option d’action réellement distincte de la palette existante.');
  }

  return {
    archetypeId: propre(archetype.id),
    valide: raisons.length === 0,
    raisons,
    doublonAvec: doublon?.id,
  };
}

function construirePalette(entree: EntreeM09): {
  palette: DefinitionArchetypeM09[];
  evaluationsExtensions: EvaluationExtensionM09[];
  alertes: string[];
} {
  const palette: DefinitionArchetypeM09[] = [];
  const alertes: string[] = [];

  if (entree.utiliserPaletteReference !== false) {
    for (const archetype of PALETTE_REFERENCE_M09) {
      palette.push(copierArchetype(archetype, 'reference'));
    }
  }

  for (const archetype of entree.contexte.archetypes) {
    const converti = depuisArchetypeContexte(archetype);
    const doublon = trouverDoublon(converti, palette);
    if (!doublon) palette.push(converti);
  }

  const evaluationsExtensions: EvaluationExtensionM09[] = [];

  for (const extension of entree.extensions ?? []) {
    const evaluation = evaluerExtension(extension, palette);
    evaluationsExtensions.push(evaluation);

    if (!evaluation.valide) {
      alertes.push(
        `Extension d’archétype « ${extension.archetype.nom || extension.archetype.id} » ignorée : ${evaluation.raisons.join(' ')}`,
      );
      continue;
    }

    palette.push(copierArchetype(extension.archetype, 'extension'));
  }

  return {
    palette: uniquesParCle(palette, (archetype) => normaliser(archetype.id)),
    evaluationsExtensions,
    alertes: uniquesTextes(alertes),
  };
}

function idsPnj(entree: EntreeM09): string[] {
  const disponibles = new Set(entree.contexte.personnages.map((personnage) => personnage.id));
  const demandes = entree.pnjIds?.length
    ? entree.pnjIds
    : entree.contexte.scene.participants.filter((id) => disponibles.has(id));

  return uniquesTextes(demandes).filter((id) => id !== entree.personnageJoueurId);
}

function personnageParId(
  contexte: ContexteNarratifV21,
  personnageId: string,
): IdentitePersonnage | undefined {
  return contexte.personnages.find((personnage) => personnage.id === personnageId);
}

function profilParId(entree: EntreeM09, personnageId: string): ProfilPnjM09 | undefined {
  return entree.profils?.find((profil) => profil.personnageId === personnageId);
}

function champsManquants(personnage: IdentitePersonnage): ChampIndividuelM09[] {
  const manquants: ChampIndividuelM09[] = [];
  if (personnage.traits.length === 0) manquants.push('traits');
  if (personnage.buts.length === 0) manquants.push('buts');
  if (personnage.competences.length === 0) manquants.push('competences');
  return manquants;
}

function autoriseParProfil(
  archetype: DefinitionArchetypeM09,
  profil: ProfilPnjM09 | undefined,
): boolean {
  if (!profil) return true;

  const exclus = profil.archetypeIdsExclus ?? [];
  if (exclus.some((id) => correspond(id, archetype.id) || correspond(id, archetype.nom))) {
    return false;
  }

  const autorises = profil.archetypeIdsAutorises ?? [];
  if (autorises.length === 0) return true;

  return autorises.some((id) => correspond(id, archetype.id) || correspond(id, archetype.nom));
}

function correspondanceArchetype(
  archetype: DefinitionArchetypeM09,
  profil: ProfilPnjM09,
): CorrespondanceArchetypeM09 {
  const raisons: string[] = [];

  const correspondRole = auMoinsUneCorrespondance(profil.roles, [
    archetype.id,
    archetype.nom,
    ...archetype.rolesAssocies,
  ]);

  const correspondContexte = auMoinsUneCorrespondance(
    profil.contexte ?? [],
    archetype.contextesFavorables ?? [],
  );

  const correspondExperience = auMoinsUneCorrespondance(
    profil.experienceDisponible ?? [],
    [...archetype.attentions, ...archetype.optionsAction, ...(archetype.contextesFavorables ?? [])],
  );

  const correspondCompetencePresumee = auMoinsUneCorrespondance(
    profil.competencesPresumees ?? [],
    archetype.competencesIndicatives ?? [],
  );

  if (correspondRole) raisons.push('Le rôle fourni correspond à ce schéma.');
  if (correspondContexte) raisons.push('La situation actuelle rend ce schéma pertinent.');
  if (correspondExperience) raisons.push('L’expérience disponible est compatible avec ce schéma.');
  if (correspondCompetencePresumee) {
    raisons.push('Une compétence présumée oriente vers ce schéma sans être considérée comme prouvée.');
  }

  return {
    archetypeId: archetype.id,
    correspondRole,
    correspondContexte,
    correspondExperience,
    correspondCompetencePresumee,
    raisons,
  };
}

function indexPriorite(profil: ProfilPnjM09, archetype: DefinitionArchetypeM09): number {
  const priorites = profil.prioriteContextuelle ?? [];
  const index = priorites.findIndex(
    (valeur) => correspond(valeur, archetype.id) || correspond(valeur, archetype.nom),
  );
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function ordreRole(profil: ProfilPnjM09, archetype: DefinitionArchetypeM09): number {
  const index = profil.roles.findIndex((role) =>
    [archetype.id, archetype.nom, ...archetype.rolesAssocies].some((valeur) => correspond(role, valeur)),
  );
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function choisirArchetypes(
  palette: DefinitionArchetypeM09[],
  profil: ProfilPnjM09,
): { retenus: DefinitionArchetypeM09[]; correspondances: CorrespondanceArchetypeM09[] } {
  const candidats = palette.filter((archetype) => autoriseParProfil(archetype, profil));
  const correspondances = candidats.map((archetype) => correspondanceArchetype(archetype, profil));

  const parId = new Map(candidats.map((archetype) => [archetype.id, archetype] as const));

  // La priorité explicite de contexte prévaut lorsqu'elle désigne un schéma autorisé.
  const prioritaires = (profil.prioriteContextuelle ?? [])
    .map((id) =>
      candidats.find((archetype) => correspond(id, archetype.id) || correspond(id, archetype.nom)),
    )
    .filter((archetype): archetype is DefinitionArchetypeM09 => Boolean(archetype));

  const parRole = correspondances
    .filter((evaluation) => evaluation.correspondRole)
    .map((evaluation) => parId.get(evaluation.archetypeId))
    .filter((archetype): archetype is DefinitionArchetypeM09 => Boolean(archetype));

  const parSituation = correspondances
    .filter(
      (evaluation) =>
        evaluation.correspondContexte ||
        evaluation.correspondExperience ||
        evaluation.correspondCompetencePresumee,
    )
    .map((evaluation) => parId.get(evaluation.archetypeId))
    .filter((archetype): archetype is DefinitionArchetypeM09 => Boolean(archetype));

  const pool = uniquesParCle(
    [...prioritaires, ...parRole, ...parSituation],
    (archetype) => archetype.id,
  );

  pool.sort((a, b) => {
    const prioriteA = indexPriorite(profil, a);
    const prioriteB = indexPriorite(profil, b);
    if (prioriteA !== prioriteB) return prioriteA - prioriteB;

    const roleA = ordreRole(profil, a);
    const roleB = ordreRole(profil, b);
    if (roleA !== roleB) return roleA - roleB;

    return a.id.localeCompare(b.id);
  });

  return { retenus: pool, correspondances };
}

function variantePour(
  personnageId: string,
  archetype: DefinitionArchetypeM09,
): string[] {
  if (archetype.variantes.length === 0) return [];
  const index = hashStable(`${personnageId}|${archetype.id}`) % archetype.variantes.length;
  return [archetype.variantes[index]];
}

function construireSuggestion(
  personnage: IdentitePersonnage,
  archetype: DefinitionArchetypeM09,
  manquants: ChampIndividuelM09[],
  principal: boolean,
  correspondance: CorrespondanceArchetypeM09 | undefined,
): SuggestionArchetypeM09 {
  const justification = [...(correspondance?.raisons ?? [])];

  const attentionsSuggerees = manquants.includes('buts')
    ? uniquesTextes(archetype.attentions)
    : [];

  const optionsReactionSuggerees = manquants.includes('competences')
    ? uniquesTextes(archetype.optionsAction)
    : [];

  const variantesSuggerees = manquants.includes('traits')
    ? variantePour(personnage.id, archetype)
    : [];

  if (!manquants.includes('buts')) {
    justification.push('Les buts individuels sont déjà définis : les attentions génériques ne les remplacent pas.');
  }
  if (!manquants.includes('competences')) {
    justification.push('Les compétences individuelles sont déjà définies : les options génériques ne deviennent pas des capacités.');
  }
  if (!manquants.includes('traits')) {
    justification.push('Les traits individuels sont déjà définis : aucune variante générique ne les remplace.');
  }

  const champsCompletesParHypothese: ChampIndividuelM09[] = [];
  if (attentionsSuggerees.length > 0) champsCompletesParHypothese.push('buts');
  if (optionsReactionSuggerees.length > 0) champsCompletesParHypothese.push('competences');
  if (variantesSuggerees.length > 0) champsCompletesParHypothese.push('traits');

  return {
    personnageId: personnage.id,
    archetypeId: archetype.id,
    principal,
    attentionsSuggerees,
    optionsReactionSuggerees,
    variantesSuggerees,
    champsCompletesParHypothese,
    justification: uniquesTextes(justification),
  };
}

function evaluerPnj(
  entree: EntreeM09,
  palette: DefinitionArchetypeM09[],
  personnageId: string,
): EvaluationPnjM09 {
  const personnage = personnageParId(entree.contexte, personnageId);
  if (!personnage) {
    return {
      personnageId,
      personnageTrouve: false,
      champsIndividuelsManquants: [],
      archetypesConsideres: [],
      archetypesRetenus: [],
      correspondances: [],
      suggestions: [],
      raisons: [],
      alertes: [`Personnage introuvable pour M09 : ${personnageId}.`],
    };
  }

  const manquants = champsManquants(personnage);
  const profil = profilParId(entree, personnageId);

  if (manquants.length === 0) {
    return {
      personnageId,
      personnageTrouve: true,
      champsIndividuelsManquants: [],
      archetypesConsideres: [],
      archetypesRetenus: [],
      correspondances: [],
      suggestions: [],
      raisons: [
        'La fiche individuelle renseigne déjà traits, buts et compétences ; aucun schéma générique n’est nécessaire.',
      ],
      alertes: [],
    };
  }

  if (!profil || profil.roles.length === 0) {
    return {
      personnageId,
      personnageTrouve: true,
      champsIndividuelsManquants: manquants,
      archetypesConsideres: [],
      archetypesRetenus: [],
      correspondances: [],
      suggestions: [],
      raisons: [
        'La fiche est partielle mais aucun rôle ou indice de sélection n’est fourni ; M09 laisse les champs inconnus plutôt que d’imposer un stéréotype.',
      ],
      alertes: [],
    };
  }

  const { retenus, correspondances } = choisirArchetypes(palette, profil);

  if (retenus.length === 0) {
    return {
      personnageId,
      personnageTrouve: true,
      champsIndividuelsManquants: manquants,
      archetypesConsideres: palette
        .filter((archetype) => autoriseParProfil(archetype, profil))
        .map((archetype) => archetype.id),
      archetypesRetenus: [],
      correspondances,
      suggestions: [],
      raisons: [
        'Aucun schéma ne correspond suffisamment aux rôles et indices fournis ; aucune hypothèse individuelle n’est fabriquée.',
      ],
      alertes: [],
    };
  }

  const suggestions = retenus.map((archetype, index) =>
    construireSuggestion(
      personnage,
      archetype,
      manquants,
      index === 0,
      correspondances.find((evaluation) => evaluation.archetypeId === archetype.id),
    ),
  );

  return {
    personnageId,
    personnageTrouve: true,
    champsIndividuelsManquants: manquants,
    archetypesConsideres: palette
      .filter((archetype) => autoriseParProfil(archetype, profil))
      .map((archetype) => archetype.id),
    archetypesRetenus: retenus.map((archetype) => archetype.id),
    archetypePrincipal: retenus[0]?.id,
    correspondances,
    suggestions,
    raisons: [
      'Les schémas retenus sont des hypothèses de réaction pour les champs individuels encore absents.',
      'La priorité entre plusieurs schémas suit le contexte et l’ordre des rôles fournis, sans mélange numérique de personnalité.',
    ],
    alertes: [],
  };
}

function contraintesM09(evaluations: EvaluationPnjM09[]): string[] {
  const contraintes = [
    'Une tendance générique ne remplace jamais un trait, un but ou une compétence individuelle déjà établis.',
    'Une profession ou un rôle ne détermine pas automatiquement la moralité, la loyauté ou l’obéissance d’un personnage.',
    'Une compétence présumée par un archétype ne vaut pas compétence prouvée et ne garantit aucun résultat.',
    'Les archétypes proposent des options de réaction ; M03 individualise et M14 résout les actions contestées.',
  ];

  if (evaluations.some((evaluation) => evaluation.archetypesRetenus.length > 1)) {
    contraintes.push(
      'Lorsque plusieurs schémas conviennent, leur priorité dépend de la situation ; ils ne sont pas fusionnés en pourcentages de personnalité.',
    );
  }

  return contraintes;
}

function interditsM09(): string[] {
  return [
    'Ne pas rendre un marchand cupide, un érudit peureux, un domestique obéissant, un noble méprisant ou un religieux fanatique par simple catégorie.',
    'Ne pas inventer une compétence décisive, une ressource, une relation, un savoir ou un statut social à partir d’un archétype.',
    'Ne pas conserver une psychologie parallèle dans M09 lorsqu’une donnée individuelle appartient déjà à M03.',
  ];
}

function contributionM09(evaluations: EvaluationPnjM09[]): ContributionSceneM01 {
  return {
    contraintes: contraintesM09(evaluations),
    interditsNarratifs: interditsM09(),
  };
}

/**
 * M09 est volontairement sans transition persistante : il fournit une palette
 * et des hypothèses de travail. La fiche individuelle reste sous l'autorité de
 * M03 ; si une suggestion devient un trait établi, la validation appartient au
 * noyau et au moteur propriétaire, pas à M09 seul.
 */
export function executerM09(entree: EntreeM09): SortieM09 {
  const { palette, evaluationsExtensions, alertes: alertesPalette } = construirePalette(entree);
  const evaluationsPnj = idsPnj(entree).map((personnageId) =>
    evaluerPnj(entree, palette, personnageId),
  );

  const alertes = uniquesTextes([
    ...alertesPalette,
    ...evaluationsPnj.flatMap((evaluation) => evaluation.alertes),
  ]);

  const archetypeIdsParPnj: Record<string, string[]> = {};
  for (const evaluation of evaluationsPnj) {
    if (evaluation.archetypesRetenus.length === 0) continue;
    archetypeIdsParPnj[evaluation.personnageId] = [...evaluation.archetypesRetenus];
  }

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M09,
    contribution: contributionM09(evaluationsPnj),
    transitions: [],
    contraintes: contraintesM09(evaluationsPnj),
    alertes,
  };

  return {
    moteur: MOTEUR_M09,
    resultat,
    paletteEffective: palette,
    evaluationsExtensions,
    evaluationsPnj,
    archetypeIdsParPnj,
    alertes,
  };
}
