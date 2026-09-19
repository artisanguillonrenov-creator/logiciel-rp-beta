import type { AppSettings, FournisseurLLM } from '../types';
import { ajouterInstructionsOutilsJson, extraireAppelsOutilsJson } from './toolCallingJson';
import type { ToolDefinition } from './openrouter';
import { fetchInfermatic } from './infermaticScheduler';
import { masquerSecrets } from './responseSanitizer';
import { appliquerPolitiqueRaisonnement, resoudreProfilRaisonnement } from './reasoningPolicy';

export const URLS_FOURNISSEURS = {
  openrouter: 'https://openrouter.ai/api/v1',
  infermatic: 'https://api.totalgpt.ai/v1',
} as const;

/** Fournisseurs REST OpenAI-compatible (chat/completions classique) —
 * exclut 'local' (rien à distance) ET 'codex' (transport JSON-RPC/WebSocket
 * séparé, voir codexAppServerClient.ts, jamais ajouté à URLS_FOURNISSEURS). */
type FournisseurDistant = Exclude<FournisseurLLM, 'local' | 'codex'>;

/** L'absence du champ dans une ancienne sauvegarde garde OpenRouter. */
export function normaliserFournisseur(value: unknown): FournisseurLLM {
  return value === 'infermatic' || value === 'codex' || value === 'local' ? value : 'openrouter';
}

/**
 * Union conceptuellement discriminée par `moteurInference` (chantier Codex,
 * section 9) : chaque fournisseur n'a que les champs qui le concernent
 * réellement (un fournisseur Codex n'a pas de `apiKey` OpenAI, un
 * fournisseur local n'a ni clé ni gateway…). `apiKey` reste présent (vide)
 * sur les variantes qui n'en ont pas besoin uniquement pour rester
 * spreadable tel quel dans AppelModeleOptions — voir openrouter.ts — sans
 * devoir toucher la quinzaine d'appelants existants qui font
 * `...configurationLLM(appSettings)`.
 */
export type ConfigurationLLM =
  | { moteurInference: 'openrouter'; apiKey: string; model: string }
  | { moteurInference: 'infermatic'; apiKey: string; model: string }
  | { moteurInference: 'local'; apiKey: string; model: string }
  | {
      moteurInference: 'codex';
      apiKey: string;
      model: string;
      gatewayUrl: string;
      gatewayToken: string;
      reasoningEffort?: string;
    };

/** Point unique de résolution clé/modèle, partagé par tous les méta-moteurs. */
export function configurationLLM(settings: AppSettings, modeleOverride?: string): ConfigurationLLM {
  const moteurInference = normaliserFournisseur(settings.moteurInference);
  if (moteurInference === 'infermatic') {
    return {
      moteurInference,
      apiKey: settings.infermaticApiKey ?? '',
      model: modeleOverride || settings.infermaticModel || '',
    };
  }
  if (moteurInference === 'codex') {
    return {
      moteurInference,
      apiKey: '',
      model: modeleOverride || settings.codexModel || '',
      gatewayUrl: settings.codexGatewayUrl ?? '',
      gatewayToken: settings.codexGatewayToken ?? '',
      reasoningEffort: settings.codexReasoningEffort,
    };
  }
  if (moteurInference === 'local') {
    return { moteurInference, apiKey: '', model: modeleOverride || settings.model };
  }
  return { moteurInference, apiKey: settings.openRouterApiKey, model: modeleOverride || settings.model };
}

export function modeleOverridePourFournisseur(
  settings: AppSettings,
  modeleOverride?: string,
  fournisseurOverride?: 'openrouter' | 'infermatic' | 'codex',
): string | undefined {
  if (!modeleOverride?.trim()) return undefined;
  const fournisseurActuel = normaliserFournisseur(settings.moteurInference);
  // Migration sûre : tout override historique non étiqueté appartenait à
  // OpenRouter et ne doit pas devenir fortuitement un ID Infermatic/Codex.
  const proprietaire = fournisseurOverride ?? 'openrouter';
  return fournisseurActuel === proprietaire ? modeleOverride.trim() : undefined;
}

export class ErreurFournisseurLLM extends Error {
  readonly fournisseur: FournisseurDistant;
  readonly statut?: number;

  constructor(
    message: string,
    fournisseur: FournisseurDistant = 'openrouter',
    statut?: number,
  ) {
    super(message);
    this.name = 'ErreurFournisseurLLM';
    this.fournisseur = fournisseur;
    this.statut = statut;
  }
}

export interface RequeteChatDistante {
  fournisseur: FournisseurDistant;
  apiKey: string;
  model: string;
  messages: unknown[];
  temperature: number;
  maxTokens: number;
  tools?: unknown[];
  signal?: AbortSignal;
}

const DELAI_MAX_REQUETE_MS = 45_000;

async function fetchAvecDelai(
  effectuerFetch: typeof fetch,
  url: string,
  init: RequestInit,
  signalExterne?: AbortSignal,
): Promise<Response> {
  const controleur = new AbortController();
  const relayerAnnulation = () => controleur.abort(signalExterne?.reason);
  if (signalExterne?.aborted) relayerAnnulation();
  else signalExterne?.addEventListener('abort', relayerAnnulation, { once: true });
  const timer = setTimeout(() => controleur.abort(new Error('Délai de réponse dépassé.')), DELAI_MAX_REQUETE_MS);
  try {
    return await effectuerFetch(url, { ...init, signal: controleur.signal });
  } finally {
    clearTimeout(timer);
    signalExterne?.removeEventListener('abort', relayerAnnulation);
  }
}

function nomFournisseur(fournisseur: FournisseurDistant): string {
  return fournisseur === 'infermatic' ? 'Infermatic' : 'OpenRouter';
}

async function detailErreur(response: Response, apiKey: string): Promise<string> {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message ?? body?.message ?? JSON.stringify(body);
  } catch {
    detail = await response.text();
  }
  return masquerSecrets(detail, [apiKey]);
}

export async function appelerChatDistant(options: RequeteChatDistante): Promise<any> {
  const { fournisseur, apiKey, model, messages, temperature, maxTokens, tools, signal } = options;
  const nom = nomFournisseur(fournisseur);
  if (!apiKey) throw new ErreurFournisseurLLM(`Aucune clé API ${nom} renseignée. Configure-la dans Réglages.`, fournisseur);
  if (!model) throw new ErreurFournisseurLLM(`Aucun modèle ${nom} sélectionné. Choisis-en un dans Réglages.`, fournisseur);

  // Logiciel exclusivement RP : la politique de raisonnement (voir
  // reasoningPolicy.ts) est appliquée à CHAQUE appel, jamais laissée à la
  // discrétion de l'appelant — c'est la couche provider/response parser qui
  // protège l'interface, pas une consigne dans le prompt système.
  const profilRaisonnement = resoudreProfilRaisonnement(fournisseur, model);
  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(profilRaisonnement.reasoningRequestParameters ?? {}),
    ...(tools ? { tools, tool_choice: 'auto' } : {}),
  };
  let response: Response;
  try {
    const effectuerFetch = fournisseur === 'infermatic' ? fetchInfermatic : fetch;
      response = await fetchAvecDelai(effectuerFetch, `${URLS_FOURNISSEURS[fournisseur]}/chat/completions`, {
        method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(fournisseur === 'openrouter' ? { 'X-Title': 'Logiciel RP Beta' } : {}),
        },
        body: JSON.stringify(body),
      }, signal);
  } catch (cause) {
    if (signal?.aborted) {
      throw new ErreurFournisseurLLM(`Génération ${nom} annulée.`, fournisseur);
    }
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new ErreurFournisseurLLM(`Délai dépassé pour ${nom}. Réessaie avec un modèle plus rapide.`, fournisseur);
    }
    throw new ErreurFournisseurLLM(`Impossible de contacter ${nom}. Vérifie ta connexion.`, fournisseur);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ErreurFournisseurLLM(`Accès ${nom} refusé (${response.status}). Vérifie ta clé API et les droits du modèle.`, fournisseur, response.status);
    }
    const detail = await detailErreur(response, apiKey);
    throw new ErreurFournisseurLLM(`Erreur ${nom} (${response.status})${detail ? ` : ${detail}` : ''}`, fournisseur, response.status);
  }
  const data = await response.json();
  appliquerPolitiqueRaisonnement(data?.choices?.[0]?.message, profilRaisonnement);
  return data;
}

export interface ModeleDistant { id: string; nom: string }

export interface AppelOutilDistant { nom: string; arguments: Record<string, unknown> }

export function parserAppelsOutils(message: any): AppelOutilDistant[] {
  if (!Array.isArray(message?.tool_calls)) return [];
  const appels: AppelOutilDistant[] = [];
  for (const appel of message.tool_calls) {
    if (appel?.type !== 'function' || typeof appel.function?.name !== 'string') continue;
    let args: unknown;
    try { args = JSON.parse(appel.function.arguments || '{}'); } catch { continue; }
    if (!args || typeof args !== 'object' || Array.isArray(args)) continue;
    appels.push({ nom: appel.function.name, arguments: args as Record<string, unknown> });
  }
  return appels;
}

export async function appelerChatDistantAvecOutils(
  options: RequeteChatDistante,
  outils: ToolDefinition[],
  schemas: unknown[],
): Promise<{ contenu: string; appelsOutils: AppelOutilDistant[] }> {
  let data: any;
  try {
    data = await appelerChatDistant({ ...options, tools: schemas });
  } catch (erreur) {
    const repliAutorise = options.fournisseur === 'infermatic' && erreur instanceof ErreurFournisseurLLM &&
      (erreur.statut === 400 || erreur.statut === 422);
    if (!repliAutorise) throw erreur;
    data = await appelerChatDistant({
      ...options,
      messages: ajouterInstructionsOutilsJson(options.messages as any, outils),
      tools: undefined,
    });
    const brut = data?.choices?.[0]?.message?.content;
    return extraireAppelsOutilsJson(typeof brut === 'string' ? brut : '');
  }
  const message = data?.choices?.[0]?.message;
  return {
    contenu: typeof message?.content === 'string' ? message.content : '',
    appelsOutils: parserAppelsOutils(message),
  };
}

export async function listerModelesDistants(
  fournisseur: FournisseurDistant,
  apiKey = '',
): Promise<ModeleDistant[]> {
  const nom = nomFournisseur(fournisseur);
  if (fournisseur === 'infermatic' && !apiKey) {
    throw new ErreurFournisseurLLM('Renseigne ta clé API Infermatic avant de charger les modèles.', fournisseur);
  }
  let response: Response;
  try {
    const effectuerFetch = fournisseur === 'infermatic' ? fetchInfermatic : fetch;
      response = await fetchAvecDelai(effectuerFetch, `${URLS_FOURNISSEURS[fournisseur]}/models`, {
        headers: fournisseur === 'infermatic' ? { Authorization: `Bearer ${apiKey}` } : undefined,
      });
  } catch {
    throw new ErreurFournisseurLLM(`Impossible de récupérer la liste des modèles ${nom}.`, fournisseur);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ErreurFournisseurLLM(`Accès ${nom} refusé (${response.status}). Vérifie ta clé API.`, fournisseur, response.status);
    }
    throw new ErreurFournisseurLLM(`Impossible de récupérer la liste des modèles ${nom}.`, fournisseur, response.status);
  }
  const data = await response.json();
  const liste = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return liste
    .filter((m: any) => typeof m?.id === 'string' && m.id.trim())
    .map((m: any) => ({ id: m.id, nom: typeof m.name === 'string' ? m.name : m.id }))
    .sort((a: ModeleDistant, b: ModeleDistant) => a.nom.localeCompare(b.nom));
}
