import { contientExpression, ensembleRacines, normaliserTexte, racineSimple, termesTexte } from './texteRecherche';

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
  racines: Set<string>;
}

const requetesRecentes = new Map<string, RequetePreparee>();

export function preparerRequeteLore(requete: string | RequetePreparee): RequetePreparee {
  if (typeof requete !== 'string') return requete;
  const connue = requetesRecentes.get(requete);
  if (connue) return connue;
  const termes = termesTexte(requete);
  const prete = { normalisee: normaliserTexte(requete), termes, racines: ensembleRacines(termes) };
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
  const index: IndexEntreeLore = {
    racinesCorps: ensembleRacines(termesTexte(`${entry.titre} ${entry.contenu}`)),
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
    const communs = cle.termes.filter((t) => requete.racines.has(racineSimple(t))).length;
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
  if (d.embedding >= 0.5) raisons.push(`sémantique ${d.embedding.toFixed(2)}`);
  if (d.categorie) raisons.push('catégorie citée');
  return raisons.length ? raisons : ['pertinence faible'];
}

export function calculerScoreHybrideLore(
  entry: EntreeLoreScorable,
  requetePrete: string | RequetePreparee,
  similariteEmbedding?: number,
): DetailsScoreLore {
  const requete = preparerRequeteLore(requetePrete);
  const index = indexerEntreeLore(entry);
  if (index.negatives.some((cle) => contientExpression(requete.normalisee, cle))) {
    return { embedding: 0, lexical: 0, primary: 0, secondary: 0, explicite: 0, categorie: 0, scope: 0, priorite: 0, score: 0 };
  }

  const trouves = requete.termes.filter((t) => index.racinesCorps.has(racineSimple(t))).length;
  // Une requête de tour contient souvent beaucoup de contexte : on ne divise
  // pas par des dizaines de termes, ce qui écraserait artificiellement le lexical.
  const lexical = clamp01(trouves / Math.max(1, Math.min(12, requete.termes.length)));
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
  const score = embeddingDisponible
    ? 0.44 * embedding + 0.20 * lexical + 0.16 * primary + 0.07 * secondary + 0.05 * explicite + 0.04 * scope + 0.03 * priorite + 0.01 * categorie
    : 0.60 * lexical + 0.20 * primary + 0.08 * secondary + 0.05 * explicite + 0.04 * scope + 0.02 * priorite + 0.01 * categorie;

  return { embedding, lexical, primary, secondary, explicite, categorie, scope, priorite, score };
}
