import { contientExpression, ensembleRacinesFrancaises, normaliserTexte, racineFrancaise, termesTexte } from './texteRecherche';
import { POIDS_SYNONYME, synonymesDe } from './synonymesLexicaux';

export type ScopeLore = 'GLOBAL' | 'CONTINENT' | 'REGION' | 'CITY' | 'FACTION' | 'CHARACTER' | 'SCENE';

export interface EntreeLoreScorable {
  titre: string;
  contenu: string;
  primaryKeys?: string[];
  secondaryKeys?: string[];
  negativeKeys?: string[];
  priority?: number;
  category?: string;
  scope?: ScopeLore;
  constant?: boolean;
}

export const SEUIL_LORE_HYBRIDE = 0.30;
export const MAX_LORE_CONTEXTUEL = 8;

/** Anciennes API, conservées : une seule normalisation dans texteRecherche.ts. */
export const normaliserLore = normaliserTexte;
export const termesSignificatifsLore = termesTexte;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Requête analysée une seule fois, puis réutilisée pour tous les passages. */
export interface RequetePreparee {
  normalisee: string;
  termes: string[];
  /** Racine française de chaque terme, dans le même ordre que `termes`. */
  racinesListe: string[];
  racines: Set<string>;
  /** Racines synonymes de chaque terme (même ordre), comptées avec POIDS_SYNONYME. */
  synonymes: ReadonlySet<string>[];
}

/** Statistiques du corpus de passages : rareté de chaque racine (IDF, comme BM25). */
export interface StatsCorpusLore {
  total: number;
  df: Map<string, number>;
}

const requetesRecentes = new Map<string, RequetePreparee>();

export function preparerRequeteLore(requete: string | RequetePreparee): RequetePreparee {
  if (typeof requete !== 'string') return requete;
  const connue = requetesRecentes.get(requete);
  if (connue) return connue;
  const termes = termesTexte(requete);
  const racinesListe = termes.map(racineFrancaise);
  const prete: RequetePreparee = {
    normalisee: normaliserTexte(requete), termes, racinesListe,
    racines: new Set(racinesListe),
    synonymes: racinesListe.map(synonymesDe),
  };
  if (requetesRecentes.size >= 8) requetesRecentes.delete(requetesRecentes.keys().next().value as string);
  requetesRecentes.set(requete, prete);
  return prete;
}

interface CleIndexee {
  normalisee: string;
  termes: string[];
}

/** Ce qui ne dépend pas de la requête : calculé une fois par fiche ou passage. */
export interface IndexEntreeLore {
  racinesCorps: Set<string>;
  /** Positions de chaque racine dans le texte (proximité des mots de la requête). */
  positions: Map<string, number[]>;
  sujet: string;
  categorie: string;
  primaires: CleIndexee[];
  secondaires: CleIndexee[];
  negatives: string[];
}

const indexParEntree = new WeakMap<object, IndexEntreeLore>();

function indexerCles(cles: string[] | undefined): CleIndexee[] {
  return (cles ?? []).map((cle) => ({ normalisee: normaliserTexte(cle), termes: termesTexte(cle) })).filter((c) => c.normalisee);
}

function sujetTitre(titre: string): string {
  const sansCategorie = normaliserTexte(titre.replace(/^\[[^\]]+\]\s*/, ''));
  return sansCategorie;
}

export function indexerEntreeLore(entry: EntreeLoreScorable): IndexEntreeLore {
  const memorise = indexParEntree.get(entry);
  if (memorise) return memorise;
  const positions = new Map<string, number[]>();
  normaliserTexte(`${entry.titre} ${entry.contenu}`).split(' ').forEach((mot, i) => {
    if (!mot) return;
    const r = racineFrancaise(mot);
    const liste = positions.get(r);
    if (liste) liste.push(i); else positions.set(r, [i]);
  });
  const index: IndexEntreeLore = {
    racinesCorps: ensembleRacinesFrancaises(termesTexte(`${entry.titre} ${entry.contenu}`)),
    positions,
    // Comportement historique conservé : sujet = titre complet sans [CATÉGORIE]
    // (l'ancien découpage sur le tiret long agissait après sa suppression).
    sujet: sujetTitre(entry.titre),
    categorie: normaliserTexte(entry.category ?? ''),
    primaires: indexerCles(entry.primaryKeys),
    secondaires: indexerCles(entry.secondaryKeys),
    negatives: (entry.negativeKeys ?? []).map((c) => normaliserTexte(c)).filter((c) => c.length >= 2),
  };
  indexParEntree.set(entry, index);
  return index;
}

/**
 * Une clé s'applique si la requête la contient comme suite de mots entiers
 * (« garde » ne s'applique plus à « regarder ») ; à défaut, part de ses mots
 * retrouvés dans la requête (singulier ou pluriel).
 */
function scoreCle(requete: RequetePreparee, cles: CleIndexee[]): number {
  let meilleur = 0;
  for (const cle of cles) {
    if (contientExpression(requete.normalisee, cle.normalisee)) return 1;
    if (!cle.termes.length) continue;
    const communs = cle.termes.filter((t) => requete.racines.has(racineFrancaise(t))).length;
    meilleur = Math.max(meilleur, communs / cle.termes.length);
  }
  return clamp01(meilleur);
}

export function estExclueParClesNegatives(entry: EntreeLoreScorable, requete: string | RequetePreparee): boolean {
  const q = preparerRequeteLore(requete);
  return indexerEntreeLore(entry).negatives.some((cle) => contientExpression(q.normalisee, cle));
}

export function infererScopeLore(category?: string): ScopeLore {
  const c = normaliserTexte(category ?? '');
  if (c.includes('relation')) return 'REGION';
  if (c.includes('royaume') || c.includes('conflit') || c.includes('probleme')) return 'CITY';
  if (c.includes('guilde') || c.includes('faction')) return 'FACTION';
  if (c.includes('recurrent') || c.includes('physique') || c === 'profil' || c.includes('personnage')) return 'CHARACTER';
  if (c.includes('culture') || c.includes('racial') || c.includes('race')) return 'CONTINENT';
  if (c.includes('scene')) return 'SCENE';
  return 'GLOBAL';
}

export interface DetailsScoreLore {
  embedding: number;
  lexical: number;
  /** Termes de la requête retrouvés seulement par un synonyme. */
  synonymes: number;
  /** Part des paires de mots voisins de la requête retrouvées proches dans le texte. */
  proximite: number;
  primary: number;
  secondary: number;
  explicite: number;
  categorie: number;
  scope: number;
  priorite: number;
  score: number;
}

/** Raisons lisibles d'un score, pour le diagnostic concepteur. */
export function raisonsScoreLore(d: DetailsScoreLore): string[] {
  const raisons: string[] = [];
  if (d.explicite >= 1) raisons.push('nom exact');
  else if (d.primary >= 1) raisons.push('clé primaire');
  else if (d.primary >= 0.5) raisons.push('clé primaire partielle');
  if (d.secondary >= 1) raisons.push('clé secondaire');
  if (d.lexical >= 0.25) raisons.push(`mots communs ${Math.round(d.lexical * 100)} %`);
  if (d.synonymes > 0) raisons.push(`synonyme${d.synonymes > 1 ? 's' : ''}`);
  if (d.proximite >= 0.5) raisons.push('mots proches');
  if (d.embedding >= 0.5) raisons.push(`sémantique ${d.embedding.toFixed(2)}`);
  if (d.categorie) raisons.push('catégorie citée');
  return raisons.length ? raisons : ['pertinence faible'];
}

const MAX_TERMES_LEXICAL = 12;
const FENETRE_PROXIMITE = 3;

/** Rareté d'une racine dans le corpus (IDF de BM25) ; 1 sans statistiques. */
function rarete(racine: string, stats?: StatsCorpusLore): number {
  if (!stats) return 1;
  const df = stats.df.get(racine) ?? 0;
  return Math.log(1 + (stats.total - df + 0.5) / (df + 0.5));
}

/** Calcule la rareté de chaque racine sur un ensemble de passages (mémorisé par l'appelant). */
export function statsCorpusLore(entrees: readonly EntreeLoreScorable[]): StatsCorpusLore {
  const df = new Map<string, number>();
  for (const e of entrees) for (const r of indexerEntreeLore(e).racinesCorps) df.set(r, (df.get(r) ?? 0) + 1);
  return { total: entrees.length, df };
}

/**
 * Part des paires de mots voisins de la requête (« guilde » puis
 * « aventuriers ») retrouvées à moins de FENETRE_PROXIMITE mots l'un de
 * l'autre dans le texte. 0 si aucune paire n'y figure en entier.
 */
function proximiteRequete(requete: RequetePreparee, index: IndexEntreeLore): number {
  let paires = 0;
  let proches = 0;
  for (let i = 0; i + 1 < requete.racinesListe.length; i++) {
    const a = index.positions.get(requete.racinesListe[i]);
    const b = index.positions.get(requete.racinesListe[i + 1]);
    if (!a || !b) continue;
    paires += 1;
    if (a.some((pa) => b.some((pb) => pb !== pa && Math.abs(pb - pa) <= FENETRE_PROXIMITE))) proches += 1;
  }
  return paires ? proches / paires : 0;
}

export function calculerScoreHybrideLore(
  entry: EntreeLoreScorable,
  requetePrete: string | RequetePreparee,
  similariteEmbedding?: number,
  stats?: StatsCorpusLore,
): DetailsScoreLore {
  const requete = preparerRequeteLore(requetePrete);
  const index = indexerEntreeLore(entry);
  if (index.negatives.some((cle) => contientExpression(requete.normalisee, cle))) {
    return { embedding: 0, lexical: 0, synonymes: 0, proximite: 0, primary: 0, secondary: 0, explicite: 0, categorie: 0, scope: 0, priorite: 0, score: 0 };
  }

  // Chaque terme pèse sa rareté dans le corpus (un mot présent partout compte
  // peu) ; un terme absent mais dont un synonyme figure compte POIDS_SYNONYME.
  // Une requête de tour contient souvent beaucoup de contexte : on ne divise
  // que par les MAX_TERMES_LEXICAL termes les plus rares, pour ne pas écraser
  // artificiellement le lexical.
  const poids = requete.racinesListe.map((r) => rarete(r, stats));
  let trouves = 0;
  let synonymes = 0;
  requete.racinesListe.forEach((racine, i) => {
    if (index.racinesCorps.has(racine)) { trouves += poids[i]; return; }
    for (const s of requete.synonymes[i]) {
      if (index.racinesCorps.has(s)) { trouves += POIDS_SYNONYME * poids[i]; synonymes += 1; return; }
    }
  });
  const denominateur = [...poids].sort((a, b) => b - a).slice(0, MAX_TERMES_LEXICAL).reduce((n, w) => n + w, 0);
  const lexical = clamp01(trouves / Math.max(stats ? 1e-9 : 1, denominateur));
  const proximite = proximiteRequete(requete, index);
  const primary = scoreCle(requete, index.primaires);
  const secondary = scoreCle(requete, index.secondaires);
  const explicite = index.sujet.length >= 3 && contientExpression(requete.normalisee, index.sujet) ? 1 : Math.max(primary, secondary * 0.6);
  const categorie = index.categorie && contientExpression(requete.normalisee, index.categorie) ? 1 : 0;
  const prioriteBrute = Number.isFinite(entry.priority) ? Number(entry.priority) : 100;
  const priorite = clamp01(1 - Math.max(0, Math.min(100, prioriteBrute)) / 100);
  const scopeValue = entry.scope ?? infererScopeLore(entry.category);
  const signalLocal = Math.max(primary, secondary, explicite, lexical);
  let scope = 0;
  switch (scopeValue) {
    case 'GLOBAL': scope = 0.45; break;
    case 'CONTINENT': scope = signalLocal >= 0.35 ? 0.75 : 0.15; break;
    case 'REGION': scope = signalLocal >= 0.35 ? 0.85 : 0.10; break;
    case 'CITY': scope = Math.max(primary, explicite) >= 0.75 ? 1 : signalLocal >= 0.45 ? 0.65 : 0.05; break;
    case 'FACTION': scope = Math.max(primary, explicite) >= 0.75 ? 1 : signalLocal >= 0.45 ? 0.65 : 0; break;
    case 'CHARACTER': scope = Math.max(primary, explicite) >= 0.75 ? 1 : signalLocal >= 0.45 ? 0.70 : 0; break;
    case 'SCENE': scope = lexical >= 0.25 ? 0.80 : 0; break;
  }

  const embeddingDisponible = typeof similariteEmbedding === 'number' && Number.isFinite(similariteEmbedding);
  const embedding = embeddingDisponible ? clamp01(similariteEmbedding) : 0;
  // La similarité aide à rappeler des formulations indirectes ; elle ne prouve
  // rien : un nom exact (explicite) garde son poids, quelle que soit la sémantique.
  // Bonus de proximité : des mots de la requête côte à côte dans le texte
  // (« Guilde des Aventuriers ») valent plus que des mots éparpillés.
  const score = (embeddingDisponible
    ? 0.44 * embedding + 0.20 * lexical + 0.16 * primary + 0.07 * secondary + 0.05 * explicite + 0.04 * scope + 0.03 * priorite + 0.01 * categorie
    : 0.60 * lexical + 0.20 * primary + 0.08 * secondary + 0.05 * explicite + 0.04 * scope + 0.02 * priorite + 0.01 * categorie)
    + (embeddingDisponible ? 0.03 : 0.05) * proximite;

  return { embedding, lexical, synonymes, proximite, primary, secondary, explicite, categorie, scope, priorite, score };
}
