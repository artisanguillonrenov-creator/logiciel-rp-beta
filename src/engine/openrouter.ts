export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AppelModeleOptions {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export class ErreurOpenRouter extends Error {}

/**
 * Appelle l'API de complétion de chat d'OpenRouter. La clé API n'est jamais
 * codée en dur : elle vient toujours des réglages saisis par l'utilisateur.
 */
export async function appellerModele({
  apiKey,
  model,
  messages,
  temperature = 0.9,
  maxTokens = 700,
}: AppelModeleOptions): Promise<string> {
  if (!apiKey) {
    throw new ErreurOpenRouter("Aucune clé API OpenRouter renseignée. Configure-la dans Réglages.");
  }
  if (!model) {
    throw new ErreurOpenRouter('Aucun modèle sélectionné. Choisis-en un dans Réglages.');
  }

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Logiciel RP Beta',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });
  } catch (e) {
    throw new ErreurOpenRouter("Impossible de contacter OpenRouter. Vérifie ta connexion.");
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message ?? JSON.stringify(body);
    } catch {
      detail = await response.text();
    }
    throw new ErreurOpenRouter(`Erreur OpenRouter (${response.status}) : ${detail}`);
  }

  const data = await response.json();
  const contenu = data?.choices?.[0]?.message?.content;
  if (typeof contenu !== 'string' || !contenu.trim()) {
    throw new ErreurOpenRouter('Réponse vide reçue du modèle.');
  }
  return contenu.trim();
}

export interface ModeleOpenRouter {
  id: string;
  nom: string;
}

/**
 * Liste les modèles disponibles sur OpenRouter (endpoint public, sans clé).
 * Permet à l'utilisateur de choisir parmi les options OpenRouter plutôt
 * qu'un modèle unique imposé (brief section 3).
 */
export async function listerModeles(): Promise<ModeleOpenRouter[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models');
  if (!response.ok) {
    throw new ErreurOpenRouter('Impossible de récupérer la liste des modèles OpenRouter.');
  }
  const data = await response.json();
  const liste = Array.isArray(data?.data) ? data.data : [];
  return liste
    .map((m: any) => ({ id: String(m.id), nom: String(m.name ?? m.id) }))
    .sort((a: ModeleOpenRouter, b: ModeleOpenRouter) => a.nom.localeCompare(b.nom));
}
