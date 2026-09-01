import type { MoteurInference } from '../types';
import { genererTexteLocal, appellerModeleLocalAvecOutilsJson } from './localInference';

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
  // Bascule vers le modèle local (expo-litert-lm) au lieu d'OpenRouter —
  // voir MoteurInference. apiKey/model sont ignorés dans ce cas.
  moteurInference?: MoteurInference;
}

export class ErreurOpenRouter extends Error {}

/**
 * Appelle l'API de complétion de chat d'OpenRouter, ou le modèle local si
 * moteurInference === 'local'. La clé API n'est jamais codée en dur : elle
 * vient toujours des réglages saisis par l'utilisateur.
 */
export async function appellerModele({
  apiKey,
  model,
  messages,
  temperature = 0.9,
  maxTokens = 700,
  moteurInference,
}: AppelModeleOptions): Promise<string> {
  if (moteurInference === 'local') {
    return genererTexteLocal(messages);
  }

  if (!apiKey) {
    throw new ErreurOpenRouter("Aucune clé API OpenRouter renseignée. Configure-la dans Réglages.");
  }
  if (!model) {
    throw new ErreurOpenRouter('Aucun modèle sélectionné. Choisis-en un dans Réglages.');
  }

  // Certains modèles renvoient de temps en temps une complétion vide côté
  // fournisseur (aléa d'inférence, pas une vraie panne) : quelques
  // nouvelles tentatives avant d'abandonner évitent de faire perdre le
  // message du joueur pour un raté ponctuel plutôt qu'une vraie erreur.
  const TENTATIVES_MAX = 3;

  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative++) {
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
    if (typeof contenu === 'string' && contenu.trim()) {
      return contenu.trim();
    }
    if (tentative === TENTATIVES_MAX) {
      throw new ErreurOpenRouter('Réponse vide reçue du modèle.');
    }
  }

  throw new ErreurOpenRouter('Réponse vide reçue du modèle.');
}

// Tool calling (brief Phase 2) : définition d'un outil au format function
// calling d'OpenRouter/OpenAI. "composant" sert au cloisonnement des
// permissions — chaque pipeline (monde, social...) ne reçoit que ses
// propres outils, jamais l'ensemble (voir outilsPourComposant dans
// src/engine/tools.ts).
export interface ParametreOutil {
  type: 'string' | 'number' | 'boolean';
  description?: string;
  enum?: string[];
}

export interface ToolDefinition {
  composant: string;
  nom: string;
  description: string;
  parametres: Record<string, ParametreOutil>;
  requis: string[];
}

export interface AppelOutil {
  nom: string;
  arguments: Record<string, unknown>;
}

export interface AppelModeleAvecOutilsOptions {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  outils: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  moteurInference?: MoteurInference;
}

function versSchemaOutil(outil: ToolDefinition) {
  return {
    type: 'function',
    function: {
      name: outil.nom,
      description: outil.description,
      parameters: {
        type: 'object',
        properties: outil.parametres,
        required: outil.requis,
      },
    },
  };
}

/**
 * Variante d'appellerModele qui expose des outils (function calling
 * OpenRouter) au lieu de demander un JSON en prose : les mutations d'état
 * structurées (brief Phase 2 — monde, social) passent par de vrais appels
 * d'outils plutôt que par une extraction regex sur le texte de réponse.
 * Un appel dont les arguments ne sont pas un JSON exploitable est écarté
 * silencieusement (réparation minimale : le reste des appels reste valide)
 * — la validation/réparation par schéma se fait ensuite dans tools.ts.
 */
export async function appellerModeleAvecOutils({
  apiKey,
  model,
  messages,
  outils,
  temperature = 0.2,
  maxTokens = 600,
  moteurInference,
}: AppelModeleAvecOutilsOptions): Promise<{ contenu: string; appelsOutils: AppelOutil[] }> {
  if (moteurInference === 'local') {
    return appellerModeleLocalAvecOutilsJson(messages, outils);
  }

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
        tools: outils.map(versSchemaOutil),
        tool_choice: 'auto',
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
  const message = data?.choices?.[0]?.message;
  const appelsOutils: AppelOutil[] = [];
  if (Array.isArray(message?.tool_calls)) {
    for (const appel of message.tool_calls) {
      if (appel?.type !== 'function' || typeof appel.function?.name !== 'string') continue;
      let args: unknown;
      try {
        args = JSON.parse(appel.function.arguments || '{}');
      } catch {
        continue; // arguments non-JSON : appel écarté plutôt que de faire échouer les autres.
      }
      if (!args || typeof args !== 'object') continue;
      appelsOutils.push({ nom: appel.function.name, arguments: args as Record<string, unknown> });
    }
  }

  return { contenu: typeof message?.content === 'string' ? message.content : '', appelsOutils };
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
