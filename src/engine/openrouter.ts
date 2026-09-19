import type { MoteurInference } from '../types';
import { genererTexteLocal, appellerModeleLocalAvecOutilsJson } from './localInference';
import { appelerChatDistant, appelerChatDistantAvecOutils, ErreurFournisseurLLM, listerModelesDistants, type ModeleDistant } from './llmProvider';
import { genererTexteCodex } from './codexAppServerClient';
import { ajouterInstructionsOutilsJson, extraireAppelsOutilsJson } from './toolCallingJson';
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
  moteurInference?: MoteurInference;
  signal?: AbortSignal;
  // Fournisseur Codex uniquement (voir llmProvider.ts, configurationLLM) —
  // ignorés par les autres fournisseurs.
  gatewayUrl?: string;
  gatewayToken?: string;
  reasoningEffort?: string;
}

export { ErreurFournisseurLLM as ErreurOpenRouter };

export async function appellerModele({
  apiKey,
  model,
  messages,
  temperature = 0.9,
  maxTokens = 700,
  moteurInference,
  signal,
  gatewayUrl,
  gatewayToken,
  reasoningEffort,
}: AppelModeleOptions): Promise<string> {
  // Dispatcher de providers (chantier Codex, section 8) : le reste du
  // moteur RP ne connaît que cette fonction, jamais la différence de
  // transport REST (OpenRouter/Infermatic) vs JSON-RPC/WebSocket (Codex)
  // vs sur l'appareil (local).
  if (moteurInference === 'local') return genererTexteLocal(messages);
  if (moteurInference === 'codex') {
    return genererTexteCodex({ gatewayUrl: gatewayUrl ?? '', gatewayToken: gatewayToken ?? '', model, reasoningEffort, messages, signal });
  }
  const fournisseur = moteurInference === 'infermatic' ? 'infermatic' : 'openrouter';
  const TENTATIVES_MAX = 3;
  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative++) {
    const data = await appelerChatDistant({ fournisseur, apiKey, model, messages, temperature, maxTokens, signal });
    const contenu = data?.choices?.[0]?.message?.content;
    if (typeof contenu === 'string' && contenu.trim()) return contenu.trim();
    if (tentative === TENTATIVES_MAX) throw new ErreurFournisseurLLM('Réponse vide reçue du modèle.', fournisseur);
  }
  throw new ErreurFournisseurLLM('Réponse vide reçue du modèle.', fournisseur);
}

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

function versSchemaOutil(outil: ToolDefinition) {
  return {
    type: 'function',
    function: {
      name: outil.nom,
      description: outil.description,
      parameters: { type: 'object', properties: outil.parametres, required: outil.requis },
    },
  };
}

export interface AppelModeleAvecOutilsOptions {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  outils: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  moteurInference?: MoteurInference;
  signal?: AbortSignal;
  gatewayUrl?: string;
  gatewayToken?: string;
  reasoningEffort?: string;
}

/**
 * Codex n'a pas de function calling natif activé côté RP (V1 sans outils
 * agentiques, voir section 13 du chantier) : même repli JSON-en-prose que le
 * moteur local, réutilisant le parsing existant plutôt qu'un second système
 * d'outils.
 */
async function appellerCodexAvecOutilsJson(
  options: AppelModeleAvecOutilsOptions,
): Promise<{ contenu: string; appelsOutils: AppelOutil[] }> {
  const messagesAvecInstructions = ajouterInstructionsOutilsJson(options.messages, options.outils);
  const brut = await genererTexteCodex({
    gatewayUrl: options.gatewayUrl ?? '',
    gatewayToken: options.gatewayToken ?? '',
    model: options.model,
    reasoningEffort: options.reasoningEffort,
    messages: messagesAvecInstructions,
    signal: options.signal,
  });
  return extraireAppelsOutilsJson(brut);
}

export async function appellerModeleAvecOutils({
  apiKey,
  model,
  messages,
  outils,
  temperature = 0.2,
  maxTokens = 600,
  moteurInference,
  signal,
  gatewayUrl,
  gatewayToken,
  reasoningEffort,
}: AppelModeleAvecOutilsOptions): Promise<{ contenu: string; appelsOutils: AppelOutil[] }> {
  if (moteurInference === 'local') return appellerModeleLocalAvecOutilsJson(messages, outils);
  if (moteurInference === 'codex') {
    return appellerCodexAvecOutilsJson({ apiKey, model, messages, outils, moteurInference, signal, gatewayUrl, gatewayToken, reasoningEffort });
  }
  const fournisseur = moteurInference === 'infermatic' ? 'infermatic' : 'openrouter';
  return appelerChatDistantAvecOutils(
    { fournisseur, apiKey, model, messages, temperature, maxTokens, signal },
    outils,
    outils.map(versSchemaOutil),
  );
}

export type ModeleOpenRouter = ModeleDistant;

export async function listerModeles(): Promise<ModeleOpenRouter[]> {
  return listerModelesDistants('openrouter');
}
