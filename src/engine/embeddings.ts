import type { AppSettings } from '../types';

export class ErreurEmbeddings extends Error {
  constructor(message: string, readonly statut?: number) {
    super(message);
    this.name = 'ErreurEmbeddings';
  }
}

/**
 * Compatibilité de type avec le cache historique. Elyndor Cloud n'utilise
 * plus aucun fournisseur d'embeddings distant : le moteur narratif bascule
 * systématiquement sur la recherche lexicale locale.
 */
export type FournisseurEmbeddings = 'openrouter' | 'infermatic' | 'openai';

export interface ResultatEmbeddings {
  vecteurs: number[][];
  fournisseur: FournisseurEmbeddings;
  identiteCache: string;
}

export async function obtenirEmbeddings(
  _textes: string[],
  _appSettings: AppSettings,
): Promise<ResultatEmbeddings> {
  throw new ErreurEmbeddings(
    'Les embeddings distants ont été retirés d’Elyndor Cloud. La recherche lexicale locale est utilisée à la place.',
  );
}

/** Elyndor Cloud ne dépend d'aucune clé ni API d'embeddings. */
export function embeddingsDisponibles(_appSettings: AppSettings): boolean {
  return false;
}

export function identiteEmbeddingsConfiguree(_appSettings: AppSettings): string | null {
  return null;
}

export function identitesEmbeddingsCompatibles(_appSettings: AppSettings): string[] {
  return [];
}

/**
 * Un ancien cache vectoriel distant n'est plus considéré compatible. Le
 * cache vide reste valide afin que les routines de nettoyage puissent
 * fonctionner sans recréer d'embeddings réseau.
 */
export function cacheEmbeddingsCompatible(
  identiteCache: string | null,
  _appSettings: AppSettings,
): boolean {
  return identiteCache === null;
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
