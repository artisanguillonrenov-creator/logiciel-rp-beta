import type { AppSettings } from '../types';

export class ErreurEmbeddings extends Error {}

// Modèle essayé en premier via OpenRouter (mêmes clé/compte que le
// narrateur — brief Phase 2 : "le modèle reste en API via clé OpenRouter").
const MODELE_OPENROUTER = 'openai/text-embedding-3-small';
// Modèle de secours si OpenRouter ne sert pas d'embeddings pour ce compte,
// appelé directement chez OpenAI avec la clé de secours des Réglages.
const MODELE_OPENAI = 'text-embedding-3-small';

export type FournisseurEmbeddings = 'openrouter' | 'openai';

export interface ResultatEmbeddings {
  vecteurs: number[][];
  fournisseur: FournisseurEmbeddings;
}

async function appellerEndpointEmbeddings(
  url: string,
  apiKey: string,
  model: string,
  textes: string[],
): Promise<number[][]> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: textes }),
    });
  } catch {
    throw new ErreurEmbeddings(`Impossible de contacter ${url}.`);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message ?? JSON.stringify(body);
    } catch {
      detail = await response.text();
    }
    throw new ErreurEmbeddings(`Erreur embeddings (${response.status}) sur ${url} : ${detail}`);
  }

  const data = await response.json();
  const items = data?.data;
  if (!Array.isArray(items) || items.length !== textes.length) {
    throw new ErreurEmbeddings('Réponse embeddings inattendue (nombre de vecteurs incohérent).');
  }
  // L'API renvoie les embeddings avec un index — on les remet dans l'ordre
  // d'entrée plutôt que de supposer que l'ordre de retour est préservé.
  const ordonnes = new Array(textes.length);
  for (const item of items) {
    const idx = typeof item.index === 'number' ? item.index : items.indexOf(item);
    ordonnes[idx] = item.embedding;
  }
  if (ordonnes.some((v) => !Array.isArray(v))) {
    throw new ErreurEmbeddings('Réponse embeddings incomplète.');
  }
  return ordonnes;
}

/**
 * Calcule les embeddings d'un lot de textes. Essaie d'abord OpenRouter
 * (même clé que le narrateur, brief Phase 2) ; si ce n'est pas supporté par
 * ce compte, bascule sur une clé d'embeddings dédiée (Réglages) appelée
 * directement chez OpenAI. Lève une erreur claire si aucun des deux
 * n'est disponible.
 */
export async function obtenirEmbeddings(
  textes: string[],
  appSettings: AppSettings,
): Promise<ResultatEmbeddings> {
  if (textes.length === 0) return { vecteurs: [], fournisseur: 'openrouter' };

  if (appSettings.openRouterApiKey) {
    try {
      const vecteurs = await appellerEndpointEmbeddings(
        'https://openrouter.ai/api/v1/embeddings',
        appSettings.openRouterApiKey,
        MODELE_OPENROUTER,
        textes,
      );
      return { vecteurs, fournisseur: 'openrouter' };
    } catch {
      // OpenRouter ne sert peut-être pas d'embeddings pour ce compte —
      // on tente le secours ci-dessous plutôt que d'échouer directement.
    }
  }

  if (appSettings.embeddingsApiKey) {
    const vecteurs = await appellerEndpointEmbeddings(
      'https://api.openai.com/v1/embeddings',
      appSettings.embeddingsApiKey,
      MODELE_OPENAI,
      textes,
    );
    return { vecteurs, fournisseur: 'openai' };
  }

  throw new ErreurEmbeddings(
    "La recherche sémantique du lore n'a pas pu joindre OpenRouter et aucune clé d'embeddings de secours n'est configurée dans Réglages.",
  );
}

export function similariteCosinus(a: number[], b: number[]): number {
  let produit = 0;
  let normeA = 0;
  let normeB = 0;
  for (let i = 0; i < a.length; i++) {
    produit += a[i] * b[i];
    normeA += a[i] * a[i];
    normeB += b[i] * b[i];
  }
  if (normeA === 0 || normeB === 0) return 0;
  return produit / (Math.sqrt(normeA) * Math.sqrt(normeB));
}
