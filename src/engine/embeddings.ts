import type { AppSettings } from '../types';
import { ELYNDOR_CLOUD_EMBEDDINGS_URL, ELYNDOR_CLOUD_MODELE_EMBEDDINGS } from './elyndorCloud';

export class ErreurEmbeddings extends Error {
  constructor(message: string, readonly statut?: number) {
    super(message);
    this.name = 'ErreurEmbeddings';
  }
}

/**
 * Embeddings Elyndor Cloud : bge-m3 (multilingue, 1024 dimensions, taille
 * acceptée par l'index HNSW ObjectBox) servi par le pod sur /v1/embeddings
 * (infra/runpod/image_server.py). ObjectBox est le moteur de recherche
 * principal ; la recherche lexicale locale prend le relais dès que cet
 * appel échoue (voir calculerSelectionLore).
 */
export type FournisseurEmbeddings = 'elyndor-cloud' | 'openrouter' | 'infermatic' | 'openai';

export interface ResultatEmbeddings {
  vecteurs: number[][];
  fournisseur: FournisseurEmbeddings;
  identiteCache: string;
}

const IDENTITE_CACHE = ELYNDOR_CLOUD_MODELE_EMBEDDINGS ? `elyndor-cloud:${ELYNDOR_CLOUD_MODELE_EMBEDDINGS}` : null;
/** Lots modestes : le premier calcul du lore (~265 entrées) se fait sur le CPU du pod. */
const TAILLE_LOT = 32;
const DELAI_LOT_MS = 90_000;

async function appelerLot(textes: string[], modele: string): Promise<number[][]> {
  const controleur = new AbortController();
  const timer = setTimeout(() => controleur.abort(), DELAI_LOT_MS);
  let response: Response;
  try {
    response = await fetch(`${ELYNDOR_CLOUD_EMBEDDINGS_URL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modele, input: textes }),
      signal: controleur.signal,
    });
  } catch {
    throw new ErreurEmbeddings('Impossible de joindre le service d’embeddings Elyndor Cloud.');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new ErreurEmbeddings(`Erreur embeddings Elyndor Cloud (${response.status}).`, response.status);
  return extraireVecteurs(await response.json(), textes.length);
}

/** Remet les vecteurs dans l'ordre des textes envoyés (champ `index` OpenAI). */
export function extraireVecteurs(data: unknown, attendus: number): number[][] {
  const items = (data as { data?: Array<{ index?: number; embedding?: unknown }> })?.data;
  if (!Array.isArray(items) || items.length !== attendus) {
    throw new ErreurEmbeddings('Réponse embeddings inattendue (nombre de vecteurs incohérent).');
  }
  const ordonnes: number[][] = new Array(attendus);
  items.forEach((item, position) => {
    const i = typeof item.index === 'number' ? item.index : position;
    if (Array.isArray(item.embedding)) ordonnes[i] = item.embedding as number[];
  });
  if (ordonnes.some((v) => !Array.isArray(v) || v.length === 0)) {
    throw new ErreurEmbeddings('Réponse embeddings incomplète.');
  }
  return ordonnes;
}

export async function obtenirEmbeddings(
  textes: string[],
  _appSettings: AppSettings,
): Promise<ResultatEmbeddings> {
  const modele = ELYNDOR_CLOUD_MODELE_EMBEDDINGS;
  if (!modele || !IDENTITE_CACHE) {
    throw new ErreurEmbeddings('Le service d’embeddings Elyndor Cloud est désactivé ; recherche lexicale utilisée.');
  }
  const vecteurs: number[][] = [];
  for (let i = 0; i < textes.length; i += TAILLE_LOT) {
    vecteurs.push(...await appelerLot(textes.slice(i, i + TAILLE_LOT), modele));
  }
  return { vecteurs, fournisseur: 'elyndor-cloud', identiteCache: IDENTITE_CACHE };
}

/** Disponible dès que le modèle d'embeddings Elyndor Cloud est déclaré, quels que soient les anciens réglages. */
export function embeddingsDisponibles(_appSettings: AppSettings): boolean {
  return IDENTITE_CACHE !== null;
}

export function identiteEmbeddingsConfiguree(_appSettings: AppSettings): string | null {
  return IDENTITE_CACHE;
}

export function identitesEmbeddingsCompatibles(_appSettings: AppSettings): string[] {
  return IDENTITE_CACHE ? [IDENTITE_CACHE] : [];
}

/**
 * Les vecteurs d'un autre modèle (anciens caches OpenRouter/Infermatic) ne
 * sont pas comparables : seul un cache vide ou bge-m3 Elyndor Cloud est réutilisé.
 */
export function cacheEmbeddingsCompatible(
  identiteCache: string | null,
  _appSettings: AppSettings,
): boolean {
  return identiteCache === null || identiteCache === IDENTITE_CACHE;
}

type VecteurIndexeObjectBox = number[] & {
  __elyndorObjectBox?: { type: 'lore' | 'history'; id: string };
};

type CrochetScoreObjectBox = (
  type: 'lore' | 'history',
  id: string,
  vecteurRequete: number[],
) => number | undefined;

/**
 * Fonction pure conservée pour les données vectorielles déjà présentes et
 * pour les tests/outils internes. Aucun appel réseau n'est effectué ici.
 */
export function similariteCosinus(a: number[], b: number[]): number {
  const meta = (b as VecteurIndexeObjectBox).__elyndorObjectBox;
  if (meta) {
    const racine = globalThis as typeof globalThis & { __elyndorObjectBoxScore?: CrochetScoreObjectBox };
    const score = racine.__elyndorObjectBoxScore?.(meta.type, meta.id, a);
    if (typeof score === 'number') return score;
  }

  let produit = 0;
  let normeA = 0;
  let normeB = 0;
  const longueur = Math.min(a.length, b.length);
  for (let i = 0; i < longueur; i++) {
    produit += a[i] * b[i];
    normeA += a[i] * a[i];
    normeB += b[i] * b[i];
  }
  if (normeA === 0 || normeB === 0) return 0;
  return produit / (Math.sqrt(normeA) * Math.sqrt(normeB));
}
