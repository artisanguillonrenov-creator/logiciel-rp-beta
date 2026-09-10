import type { MoteurInference } from '../types';
import { genererTexteLocal, appellerModeleLocalAvecOutilsJson } from './localInference';
import { appelerChatDistant, appelerChatDistantAvecOutils, ErreurFournisseurLLM, listerModelesDistants, type ModeleDistant } from './llmProvider';
export { configurationLLM } from './llmProvider';

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
  // Certains modèles (DeepSeek V3.1+/hybrides, Qwen3...) raisonnent en
  // interne avant de répondre, et ce raisonnement consomme le même budget
  // maxTokens que la réponse visible — sur un appel qui n'en a pas besoin
  // (ex. suggestion.ts), la part restante pour la réponse elle-même devient
  // imprévisible et peut être coupée bien avant maxTokens, quelle que soit
  // sa valeur. À false, désactive ce raisonnement via le paramètre unifié
  // d'OpenRouter (pris en charge par les modèles qui l'exposent, ignoré
  // sinon) — voir suggestion.ts.
  raisonnement?: boolean;
}

export { ErreurFournisseurLLM as ErreurOpenRouter };

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
  raisonnement,
}: AppelModeleOptions): Promise<string> {
  if (moteurInference === 'local') return genererTexteLocal(messages);
  const fournisseur = moteurInference === 'infermatic' ? 'infermatic' : 'openrouter';
  const TENTATIVES_MAX = 3;
  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative++) {
    const data = await appelerChatDistant({ fournisseur, apiKey, model, messages, temperature, maxTokens, raisonnement });
    const contenu = data?.choices?.[0]?.message?.content;
    if (typeof contenu === 'string' && contenu.trim()) return contenu.trim();
    if (tentative === TENTATIVES_MAX) {
      throw new ErreurFournisseurLLM('Réponse vide reçue du modèle.', fournisseur);
    }
  }
  throw new ErreurFournisseurLLM('Réponse vide reçue du modèle.', fournisseur);
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
  if (moteurInference === 'local') return appellerModeleLocalAvecOutilsJson(messages, outils);
  const fournisseur = moteurInference === 'infermatic' ? 'infermatic' : 'openrouter';
  return appelerChatDistantAvecOutils(
    { fournisseur, apiKey, model, messages, temperature, maxTokens },
    outils,
    outils.map(versSchemaOutil),
  );
}

export type ModeleOpenRouter = ModeleDistant;

/**
 * Liste les modèles disponibles sur OpenRouter (endpoint public, sans clé).
 * Permet à l'utilisateur de choisir parmi les options OpenRouter plutôt
 * qu'un modèle unique imposé (brief section 3).
 */
export async function listerModeles(): Promise<ModeleOpenRouter[]> {
  return listerModelesDistants('openrouter');
}
