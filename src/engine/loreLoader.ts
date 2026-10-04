import type { LoreEntry } from '../types';
import { similariteCosinus } from './embeddings';
import { calculerScoreHybrideLore, infererScopeLore, MAX_LORE_CONTEXTUEL, SEUIL_LORE_HYBRIDE, type ScopeLore } from './loreScoring';

function normalise(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // retire les accents
}

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
  return normalise(texte)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  return ` ${requeteNormalisee} `.includes(` ${aliasNormalise} `);
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
    if (alias.includes(sujet) || sujet.includes(alias)) aliases.add(alias);
  }
  return [...aliases];
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
  const requete = normaliserAncre(texteRequete);
  const notes: { entree: ElyndorEntryChargee; position: number }[] = [];

  for (const entree of entrees) {
    if (!estEntreeAncrable(entree)) continue;
    let meilleurePosition = Number.POSITIVE_INFINITY;
    for (const alias of aliasesCanoniques(entree)) {
      if (!contientExpressionCanonique(requete, alias)) continue;
      const position = requete.indexOf(alias);
      if (position >= 0) meilleurePosition = Math.min(meilleurePosition, position);
    }
    if (!Number.isFinite(meilleurePosition)) continue;
    notes.push({ entree, position: meilleurePosition });
  }

  notes.sort((a, b) =>
    a.position - b.position
    || a.entree.priority - b.entree.priority
    || a.entree.titre.localeCompare(b.entree.titre),
  );

  return notes.map(({ entree }) => ({
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
