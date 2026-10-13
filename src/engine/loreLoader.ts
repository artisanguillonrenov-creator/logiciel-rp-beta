import type { LoreEntry } from '../types';
import { similariteCosinus } from './embeddings';
import { calculerScoreHybrideLore, infererScopeLore, MAX_LORE_CONTEXTUEL, SEUIL_LORE_HYBRIDE, type ScopeLore } from './loreScoring';
import { contientExpression, distanceEdition, ecartTolere, MOTS_VIDES, normaliserTexte, positionExpression } from './texteRecherche';

// Normalisation commune à toute la recherche (texteRecherche.ts).
const normalise = normaliserTexte;

// --- Métamoteurs (format RISU) -----------------------------------------

interface RisuEntry {
  key: string;
  secondkey?: string;
  comment: string;
  content: string;
  alwaysActive?: boolean;
}

interface RisuLorebook {
  type: string;
  ver: number;
  data: RisuEntry[];
}

export interface MetamoteurEntry {
  id: string;
  titre: string;
  contenu: string;
}

export function chargerMetamoteurs(raw: RisuLorebook): MetamoteurEntry[] {
  return raw.data.map((entry, index) => ({
    id: `meta-${index}`,
    titre: entry.comment,
    contenu: entry.content,
  }));
}

// Métamoteurs toujours retenus car ils gouvernent COMMENT toute réponse est
// produite, indépendamment du contenu de la scène (voir brief section 1 :
// "chargés et sélectionnés par pertinence de scène" — ce socle minimal reste
// nécessaire à chaque tour pour que le protocole Consulter/Sélectionner/
// Vérifier et l'agentivité du joueur s'appliquent systématiquement).
const METAMOTEURS_SOCLE = [
  '[MÉTA] Production de la Réponse',
  '[MÉTA] Continuité',
  '[MÉTA] Agentivité du Joueur',
  '[MÉTA] Registre et Style Narratif',
];

/**
 * Sélectionne les métamoteurs pertinents à la scène par similarité
 * sémantique (embeddings) : le socle toujours actif + les autres
 * métamoteurs les plus proches de la requête, plafonnés pour ne pas tout
 * injecter systématiquement (brief Phase 2 : remplace la correspondance
 * de mots-clés).
 */
export function selectionnerMetamoteursSemantique(
  entries: MetamoteurEntry[],
  vecteurRequete: number[],
  vecteursEntrees: Record<string, number[]>,
  // Infinity plutôt qu'un plafond : demande explicite de l'utilisateur, les
  // 15 métamoteurs (le socle + tout le reste) sont désormais TOUJOURS actifs
  // à chaque tour plutôt qu'un tri par pertinence n'en retenant que 9 — ce
  // sont les règles qui gouvernent COMMENT toute réponse est produite, pas
  // du contenu de scène ponctuel, donc rien à gagner à en exclure certaines.
  maxSupplementaires = Infinity,
): LoreEntry[] {
  const socle = entries.filter((e) => METAMOTEURS_SOCLE.includes(e.titre));
  const reste = entries.filter((e) => !METAMOTEURS_SOCLE.includes(e.titre));

  const classement = reste
    .map((entry) => ({
      entry,
      score: vecteursEntrees[entry.id] ? similariteCosinus(vecteurRequete, vecteursEntrees[entry.id]) : -1,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSupplementaires);

  return [
    ...socle.map((e) => ({ id: e.id, titre: e.titre, contenu: e.contenu })),
    ...classement.map((c) => ({ id: c.entry.id, titre: c.entry.titre, contenu: c.entry.contenu, score: c.score })),
  ];
}

// --- Lore Elyndor -----------------------------------------------------
// V3 étape 10 : les métadonnées positives du lore sont conservées au
// chargement et participent réellement au classement hybride.

interface ElyndorEntryBrute {
  id: number;
  category: string;
  title: string;
  primary_keys?: string[];
  secondary_keys?: string[];
  negative_keys?: string[];
  content: string;
  priority: number;
  constant: boolean;
  scope?: ScopeLore;
}

interface ElyndorLorebook {
  entries: ElyndorEntryBrute[];
}

export interface ElyndorEntryChargee {
  id: string;
  titre: string;
  contenu: string;
  motsClesPrimaires?: string[];
  motsClesSecondaires?: string[];
  motsClesNegatifs: string[];
  primaryKeys?: string[];
  secondaryKeys?: string[];
  negativeKeys?: string[];
  priority: number;
  constant: boolean;
  category?: string;
  scope?: ScopeLore;
}

export function chargerLoreElyndor(raw: ElyndorLorebook): ElyndorEntryChargee[] {
  return raw.entries.map((entry) => {
    const primaryKeys = (entry.primary_keys ?? []).map(normalise);
    const secondaryKeys = (entry.secondary_keys ?? []).map(normalise);
    const negativeKeys = (entry.negative_keys ?? []).map(normalise);
    return {
      id: `elyndor-${entry.id}`,
      titre: `[${entry.category}] ${entry.title}`,
      contenu: entry.content,
      motsClesPrimaires: primaryKeys,
      motsClesSecondaires: secondaryKeys,
      motsClesNegatifs: negativeKeys,
      primaryKeys,
      secondaryKeys,
      negativeKeys,
      priority: entry.priority,
      constant: entry.constant,
      category: entry.category,
      scope: entry.scope ?? infererScopeLore(entry.category),
    };
  });
}

// Une entrée non couverte par "constant" mais dont l'absence casse la
// cohérence du monde : la table race → territoire. Un PNJ improvisé se voit
// attribuer une race à la volée par le modèle (voir [MÉTA] Esprit des
// Personnages / Archétypes Universels) ; sans cette table toujours en
// contexte, rien ne l'ancre à un territoire canon (ex. une "elfe noire"
// inventée sans lien avec Delhi). Coût négligeable (~900 caractères).
const LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE = ['[MONDE] Géographie et Races'];

/**
 * Sélectionne les entrées du lore Elyndor pertinentes à la scène par
 * similarité sémantique (brief Phase 2 : remplace la correspondance de
 * mots-clés — c'est le correctif direct au cas observé où une elfe noire
 * mentionnée sans les mots-clés exacts du lorebook n'ancrait plus rien) :
 * - les entrées "constant" et la table Géographie et Races restent
 *   toujours actives, comme le socle des métamoteurs ;
 * - une entrée dont un mot-clé négatif apparaît littéralement dans le
 *   texte de la requête reste exclue (règle déterministe, indépendante de
 *   la similarité) ;
 * - les autres sont classées par similarité cosinus avec la requête et
 *   plafonnées.
 */
function piocherAleatoirement<T>(items: T[], n: number): T[] {
  const copie = [...items];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie.slice(0, n);
}

export interface OptionsSelectionLore {
  // Ouverture d'histoire (chantier enrichissement automatique) : au lieu de
  // toujours remonter les entrées les mieux notées, pioche au hasard parmi
  // un bassin plus large des entrées pertinentes — pour que deux histoires
  // avec le même monde/lieu de départ ne convoquent pas systématiquement
  // les mêmes détails les plus évidents.
  aleatoire?: boolean;
  tailleBassinAleatoire?: number;
}

export function selectionnerLoreElyndorSemantique(
  entries: ElyndorEntryChargee[],
  texteRequete: string,
  vecteurRequete: number[],
  vecteursEntrees: Record<string, number[]>,
  maxSupplementaires = MAX_LORE_CONTEXTUEL,
  options?: OptionsSelectionLore,
): LoreEntry[] {
  const toujoursActives = entries.filter(
    (e) => e.constant || LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre),
  );
  const reste = entries.filter(
    (e) => !e.constant && !LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre),
  );

  const classementComplet = reste
    .map((entry) => {
      const similarite = vecteursEntrees[entry.id]
        ? similariteCosinus(vecteurRequete, vecteursEntrees[entry.id])
        : undefined;
      const details = calculerScoreHybrideLore(
        {
          titre: entry.titre,
          contenu: entry.contenu,
          primaryKeys: entry.primaryKeys ?? entry.motsClesPrimaires,
          secondaryKeys: entry.secondaryKeys ?? entry.motsClesSecondaires,
          negativeKeys: entry.negativeKeys ?? entry.motsClesNegatifs,
          priority: entry.priority,
          category: entry.category,
          scope: entry.scope,
          constant: entry.constant,
        },
        texteRequete,
        similarite,
      );
      return { entry, score: details.score };
    })
    .filter((x) => x.score >= SEUIL_LORE_HYBRIDE)
    .sort((a, b) => b.score - a.score || a.entry.priority - b.entry.priority);

  const plafond = Math.max(0, Math.min(MAX_LORE_CONTEXTUEL, maxSupplementaires));
  const classement = options?.aleatoire
    ? piocherAleatoirement(
        classementComplet.slice(0, Math.max(options.tailleBassinAleatoire ?? 10, plafond)),
        plafond,
      )
    : classementComplet.slice(0, plafond);

  return [
    ...toujoursActives.map((e) => ({ id: e.id, titre: e.titre, contenu: e.contenu })),
    ...classement.map((c) => ({ id: c.entry.id, titre: c.entry.titre, contenu: c.entry.contenu, score: c.score })),
  ];
}

const SCOPES_ANCRABLES = new Set<ScopeLore>(['CITY', 'FACTION', 'CHARACTER']);

/** Retire tous les préfixes [CATÉGORIE]/[VILLE] et les suffixes descriptifs. */
function sujetCanoniqueTitre(titre: string): string {
  let sujet = titre.trim();
  while (/^\[[^\]]+\]\s*/.test(sujet)) sujet = sujet.replace(/^\[[^\]]+\]\s*/, '');
  return sujet.split(/\s+[—–]\s+/)[0]?.trim() ?? sujet;
}

function normaliserAncre(texte: string): string {
  return normaliserTexte(texte);
}

function estEntreeAncrable(entree: ElyndorEntryChargee): boolean {
  // Les index servent à relier des fiches ; ils ne doivent jamais remplacer
  // la fiche individuelle lorsqu'un nom propre est explicitement cité.
  if (entree.titre.toUpperCase().includes('[INDEX]')) return false;

  const scope = entree.scope ?? infererScopeLore(entree.category);
  if (SCOPES_ANCRABLES.has(scope)) return true;

  // Support explicite des familles demandées par la directive V3, y compris
  // pour de futures fiches nommées de scope GLOBAL.
  const categorie = normalise(entree.category ?? '');
  const titre = normalise(entree.titre);
  return [
    'royaume', 'ville', 'guilde', 'faction', 'pnj', 'personnage',
    'religion', 'culte', 'artefact', 'zone corrompue', 'porte astra',
  ].some((motif) => categorie.includes(motif) || titre.includes(motif));
}

function contientExpressionCanonique(requeteNormalisee: string, aliasNormalise: string): boolean {
  if (aliasNormalise.length < 3) return false;
  return contientExpression(requeteNormalisee, aliasNormalise);
}

function aliasesCanoniques(entree: ElyndorEntryChargee): string[] {
  const sujet = normaliserAncre(sujetCanoniqueTitre(entree.titre));
  if (!sujet) return [];
  const aliases = new Set<string>([sujet]);

  // Une clé existante n'est promue comme alias d'ancre que si elle contient
  // réellement le sujet canonique (ou inversement). Cela accepte par exemple
  // "Séraphine Duvall Paris" sans transformer un rôle générique comme
  // "maîtresse de guilde" en faux nom propre.
  for (const cle of [...(entree.primaryKeys ?? []), ...(entree.secondaryKeys ?? [])]) {
    const alias = normaliserAncre(cle);
    if (!alias || alias.length < 3) continue;
    if (contientExpression(alias, sujet) || contientExpression(sujet, alias)) aliases.add(alias);
  }
  return [...aliases];
}

export interface AncreDetaillee {
  entree: ElyndorEntryChargee;
  /** Alias (normalisé) qui a déclenché l'ancre : sert à repérer les homonymes. */
  alias: string;
  position: number;
  /** Nom reconnu malgré une faute de frappe : ce qui était écrit et l'écart. */
  approche?: { ecrit: string; distance: number };
}

// Vocabulaire courant du lore (mots de ses textes) : un mot qui en fait partie
// (« porte ») n'est jamais pris pour une faute de frappe d'un nom (« Porta »).
const vocabulaireParPool = new WeakMap<object, Set<string>>();

function vocabulaireDe(entrees: ElyndorEntryChargee[]): Set<string> {
  const connu = vocabulaireParPool.get(entrees);
  if (connu) return connu;
  const vocabulaire = new Set<string>(MOTS_VIDES);
  for (const e of entrees) for (const mot of normaliserTexte(e.contenu).split(' ')) if (mot) vocabulaire.add(mot);
  vocabulaireParPool.set(entrees, vocabulaire);
  return vocabulaire;
}

/**
 * Nom canonique mal écrit (« Seraphin » pour Séraphine, « Sylvanna ») :
 * même première lettre, même nombre de mots, écart d'au plus une lettre
 * (deux au-delà de huit lettres), et au moins un mot écrit qui n'existe pas
 * dans le vocabulaire du lore. Les noms de moins de cinq lettres ne sont
 * jamais approchés.
 */
function aliasApproche(motsRequete: string[], alias: string, vocabulaire: Set<string>): { ecrit: string; distance: number; position: number } | null {
  const motsAlias = alias.split(' ');
  const tolerance = ecartTolere(alias.length);
  if (!tolerance) return null;
  let meilleur: { ecrit: string; distance: number; position: number } | null = null;
  for (let i = 0; i + motsAlias.length <= motsRequete.length; i++) {
    const fenetre = motsRequete.slice(i, i + motsAlias.length);
    const ecrit = fenetre.join(' ');
    if (ecrit[0] !== alias[0] || Math.abs(ecrit.length - alias.length) > tolerance) continue;
    if (fenetre.every((m) => vocabulaire.has(m))) continue;
    const distance = distanceEdition(ecrit, alias, tolerance);
    if (distance > 0 && distance <= tolerance && (!meilleur || distance < meilleur.distance)) {
      meilleur = { ecrit, distance, position: motsRequete.slice(0, i).join(' ').length + (i ? 1 : 0) };
    }
  }
  return meilleur;
}

/**
 * Ancres canoniques avec l'alias déclencheur ; mêmes règles que
 * extraireAncresCanoniques. Avec `tolerance`, un nom mal écrit est aussi
 * reconnu (marqué `approche`), seulement pour les fiches non citées exactement.
 */
export function extraireAncresDetaillees(
  texteRequete: string,
  entrees: ElyndorEntryChargee[],
  options: { tolerance?: boolean } = {},
): AncreDetaillee[] {
  const requete = normaliserAncre(texteRequete);
  const notes: AncreDetaillee[] = [];
  const motsRequete = options.tolerance ? requete.split(' ').filter(Boolean) : [];
  const vocabulaire = options.tolerance ? vocabulaireDe(entrees) : null;

  for (const entree of entrees) {
    if (!estEntreeAncrable(entree)) continue;
    let meilleure: { alias: string; position: number } | null = null;
    const aliases = aliasesCanoniques(entree);
    for (const alias of aliases) {
      if (!contientExpressionCanonique(requete, alias)) continue;
      const position = positionExpression(requete, alias);
      if (position >= 0 && (!meilleure || position < meilleure.position)) meilleure = { alias, position };
    }
    if (meilleure) { notes.push({ entree, ...meilleure }); continue; }
    if (!vocabulaire) continue;
    let approchee: AncreDetaillee | null = null;
    for (const alias of aliases) {
      const trouve = aliasApproche(motsRequete, alias, vocabulaire);
      if (trouve && (!approchee || trouve.distance < approchee.approche!.distance)) {
        approchee = { entree, alias, position: trouve.position, approche: { ecrit: trouve.ecrit, distance: trouve.distance } };
      }
    }
    if (approchee) notes.push(approchee);
  }

  return notes.sort((a, b) =>
    a.position - b.position
    || a.entree.priority - b.entree.priority
    || a.entree.titre.localeCompare(b.entree.titre),
  );
}

/**
 * V3 étape 11 — ancres canoniques.
 * Un nom explicite force sa fiche statique même si embedding/lexical restent
 * sous le seuil. Les ancres sont distinctes du quota des 8 entrées
 * contextuelles et ne sont jamais limitées artificiellement à deux noms.
 */
export function extraireAncresCanoniques(
  texteRequete: string,
  entrees: ElyndorEntryChargee[],
): LoreEntry[] {
  return extraireAncresDetaillees(texteRequete, entrees).map(({ entree }) => ({
    id: entree.id,
    titre: entree.titre,
    contenu: entree.contenu,
    score: 2,
  }));
}

/**
 * Place les noms canoniques explicitement cités avant le classement normal.
 * Le Lore Core / socle reste ensuite garanti par la sélection existante.
 */
export function prioriserLoreCanon(
  texteRequete: string,
  selection: LoreEntry[],
  entrees: ElyndorEntryChargee[],
): LoreEntry[] {
  const ancres = extraireAncresCanoniques(texteRequete, entrees);
  const vus = new Set<string>();
  const resultat: LoreEntry[] = [];
  for (const e of [
    ...ancres,
    ...selection.filter((s) => s.score !== undefined),
    ...selection.filter((s) => s.score === undefined),
  ]) {
    if (vus.has(e.id)) continue;
    vus.add(e.id);
    resultat.push(e);
  }
  return resultat;
}
