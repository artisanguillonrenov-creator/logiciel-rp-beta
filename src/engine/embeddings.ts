import type { AppSettings } from '../types';

export class ErreurEmbeddings extends Error {}

// Modèle essayé en premier via OpenRouter (mêmes clé/compte que le
// narrateur — brief Phase 2 : "le modèle reste en API via clé OpenRouter").
const MODELE_OPENROUTER = 'openai/text-embedding-3-small';
// Modèle de secours si OpenRouter ne sert pas d'embeddings pour ce compte,
// appelé directement chez OpenAI avec la clé de secours des Réglages.
const MODELE_OPENAI = 'text-embedding-3-small';
const MODELE_INFERMATIC = 'intfloat-multilingual-e5-base';

export type FournisseurEmbeddings = 'openrouter' | 'infermatic' | 'openai';

export interface ResultatEmbeddings {
  vecteurs: number[][];
  fournisseur: FournisseurEmbeddings;
  /** Sépare aussi deux modèles différents servis par le même fournisseur. */
  identiteCache: string;
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
  if (textes.length === 0) return { vecteurs: [], fournisseur: 'openrouter', identiteCache: `openrouter:${MODELE_OPENROUTER}` };

  // En mode Infermatic, une clé dédiée désigne volontairement OpenAI ; sans
  // elle, la clé Infermatic suffit pour conserver le lore sémantique.
  if (appSettings.moteurInference === 'infermatic' && appSettings.embeddingsApiKey) {
    const vecteurs = await appellerEndpointEmbeddings(
      'https://api.openai.com/v1/embeddings',
      appSettings.embeddingsApiKey,
      MODELE_OPENAI,
      textes,
    );
    return { vecteurs, fournisseur: 'openai', identiteCache: `openai:${MODELE_OPENAI}` };
  }

  if (appSettings.moteurInference === 'infermatic' && appSettings.infermaticApiKey) {
    const vecteurs = await appellerEndpointEmbeddings(
      'https://api.totalgpt.ai/v1/embeddings',
      appSettings.infermaticApiKey,
      MODELE_INFERMATIC,
      textes,
    );
    return { vecteurs, fournisseur: 'infermatic', identiteCache: `infermatic:${MODELE_INFERMATIC}` };
  }

  if (appSettings.openRouterApiKey) {
    try {
      const vecteurs = await appellerEndpointEmbeddings(
        'https://openrouter.ai/api/v1/embeddings',
        appSettings.openRouterApiKey,
        MODELE_OPENROUTER,
        textes,
      );
      return { vecteurs, fournisseur: 'openrouter', identiteCache: `openrouter:${MODELE_OPENROUTER}` };
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
    return { vecteurs, fournisseur: 'openai', identiteCache: `openai:${MODELE_OPENAI}` };
  }

  throw new ErreurEmbeddings(
    "La recherche sémantique du lore n'a trouvé aucune clé d'embeddings utilisable dans Réglages.",
  );
}

export function embeddingsDisponibles(appSettings: AppSettings): boolean {
  return Boolean(
    appSettings.embeddingsApiKey ||
    appSettings.openRouterApiKey ||
    (appSettings.moteurInference === 'infermatic' && appSettings.infermaticApiKey),
  );
}

export function identiteEmbeddingsConfiguree(appSettings: AppSettings): string | null {
  if (appSettings.moteurInference === 'infermatic' && appSettings.embeddingsApiKey) return `openai:${MODELE_OPENAI}`;
  if (appSettings.moteurInference === 'infermatic' && appSettings.infermaticApiKey) {
    return `infermatic:${MODELE_INFERMATIC}`;
  }
  if (appSettings.openRouterApiKey) return `openrouter:${MODELE_OPENROUTER}`;
  if (appSettings.embeddingsApiKey) return `openai:${MODELE_OPENAI}`;
  return null;
}

/**
 * Toutes les identités qu'une configuration peut légitimement produire.
 * OpenAI est compatible avec une configuration OpenRouter quand sa clé de
 * secours est présente : conserver ce résultat évite de retester puis de
 * recalculer tout le cache à chaque tour si OpenRouter refuse les embeddings.
 */
export function identitesEmbeddingsCompatibles(appSettings: AppSettings): string[] {
  if (appSettings.moteurInference === 'infermatic') {
    if (appSettings.embeddingsApiKey) return [`openai:${MODELE_OPENAI}`];
    return appSettings.infermaticApiKey ? [`infermatic:${MODELE_INFERMATIC}`] : [];
  }
  const identites: string[] = [];
  if (appSettings.openRouterApiKey) identites.push(`openrouter:${MODELE_OPENROUTER}`);
  if (appSettings.embeddingsApiKey) identites.push(`openai:${MODELE_OPENAI}`);
  return identites;
}

export function cacheEmbeddingsCompatible(identiteCache: string | null, appSettings: AppSettings): boolean {
  return identiteCache === null || identitesEmbeddingsCompatibles(appSettings).includes(identiteCache);
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
