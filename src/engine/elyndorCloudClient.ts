import type { AppSettings, MoteurInference } from '../types';
import { ajouterInstructionsOutilsJson, extraireAppelsOutilsJson } from './toolCallingJson';
import { appliquerPolitiqueRaisonnement, resoudreProfilRaisonnement } from './reasoningPolicy';
import { enregistrerUsageAppel } from './mesureTokens';
import { enregistrerAppelIADiagnostic } from './diagnosticTour';
import { ELYNDOR_CLOUD_MODELE, ELYNDOR_CLOUD_URL } from './elyndorCloud';

/**
 * Client réseau unique d'Elyndor.
 *
 * Aucun fournisseur utilisateur n'est résolu ici : ni OpenRouter, ni
 * Infermatic, ni modèle embarqué, ni serveur LAN. Tous les appels narratifs
 * utilisent exclusivement l'endpoint OpenAI-compatible d'Elyndor Cloud.
 */

const DELAI_GENERATION_MS = 600_000;
const TENTATIVES_REPONSE_VIDE = 3;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

export interface AppelModeleOptions {
  /** Champs conservés pour compatibilité avec les appels existants. Ignorés. */
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  moteurInference?: MoteurInference;
  baseUrl?: string;
  signal?: AbortSignal;
  /** Libellé concepteur uniquement : n'altère jamais la requête envoyée au modèle. */
  diagnosticLabel?: string;
}

export interface AppelModeleAvecOutilsOptions extends AppelModeleOptions {
  outils: ToolDefinition[];
}

export interface ModeleOpenRouter {
  id: string;
  nom: string;
}

export class ErreurElyndorCloud extends Error {
  readonly statut?: number;

  constructor(message: string, statut?: number) {
    super(message);
    this.name = 'ErreurElyndorCloud';
    this.statut = statut;
  }
}

/** Alias temporaire pour les écrans qui utilisent encore l'ancien nom. */
export { ErreurElyndorCloud as ErreurOpenRouter };

/**
 * Même forme que l'ancienne configuration LLM afin de ne pas propager un
 * refactor inutile dans le noyau narratif. Les paramètres et overrides de
 * l'histoire sont volontairement ignorés : le modèle Cloud est canonique.
 */
export function configurationLLM(_settings: AppSettings, _modeleOverride?: string) {
  return {
    apiKey: '',
    model: ELYNDOR_CLOUD_MODELE,
    moteurInference: 'serveur' as const,
    baseUrl: ELYNDOR_CLOUD_URL,
  };
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

function parserAppelsOutils(message: any): AppelOutil[] {
  if (!Array.isArray(message?.tool_calls)) return [];
  const appels: AppelOutil[] = [];
  for (const appel of message.tool_calls) {
    if (appel?.type !== 'function' || typeof appel.function?.name !== 'string') continue;
    let args: unknown;
    try {
      args = JSON.parse(appel.function.arguments || '{}');
    } catch {
      continue;
    }
    if (!args || typeof args !== 'object' || Array.isArray(args)) continue;
    appels.push({ nom: appel.function.name, arguments: args as Record<string, unknown> });
  }
  return appels;
}

async function detailErreur(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = body?.error?.message ?? body?.message ?? '';
    return typeof detail === 'string' ? detail : JSON.stringify(detail);
  } catch {
    try {
      return await response.text();
    } catch {
      return '';
    }
  }
}

async function fetchCloud(init: RequestInit, signalExterne?: AbortSignal): Promise<Response> {
  const controleur = new AbortController();
  const relayerAnnulation = () => controleur.abort(signalExterne?.reason);
  if (signalExterne?.aborted) relayerAnnulation();
  else signalExterne?.addEventListener('abort', relayerAnnulation, { once: true });

  const timer = setTimeout(
    () => controleur.abort(new Error('Délai de réponse Elyndor Cloud dépassé.')),
    DELAI_GENERATION_MS,
  );

  try {
    return await fetch(`${ELYNDOR_CLOUD_URL}/chat/completions`, {
      ...init,
      signal: controleur.signal,
    });
  } catch (cause) {
    if (signalExterne?.aborted) {
      throw new ErreurElyndorCloud('Génération Elyndor Cloud annulée.');
    }
    if (controleur.signal.aborted) {
      throw new ErreurElyndorCloud(
        "Elyndor Cloud n'a pas répondu avant la limite. Le pod peut être en démarrage ; réessaie dans quelques instants.",
      );
    }
    throw new ErreurElyndorCloud(
      'Impossible de joindre Elyndor Cloud. Vérifie la connexion réseau puis réessaie.',
    );
  } finally {
    clearTimeout(timer);
    signalExterne?.removeEventListener('abort', relayerAnnulation);
  }
}

async function appelerChat(
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  signal?: AbortSignal,
  tools?: unknown[],
  diagnosticLabel?: string,
): Promise<Record<string, any>> {
  return (await appelerChatDetaille(messages, temperature, maxTokens, signal, tools, diagnosticLabel)).message;
}

async function appelerChatDetaille(
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  signal?: AbortSignal,
  tools?: unknown[],
  diagnosticLabel?: string,
): Promise<{ message: Record<string, any>; finishReason: string }> {
  const profil = resoudreProfilRaisonnement('serveur', ELYNDOR_CLOUD_MODELE);
  const debutAppel = Date.now();

  let response: Response;
  try {
    response = await fetchCloud({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ELYNDOR_CLOUD_MODELE,
      messages,
      temperature,
      max_tokens: maxTokens,
      reasoning_effort: 'low',
      stream: false,
      ...(tools ? { tools, tool_choice: 'auto' } : {}),
    }),
  }, signal);
  } catch (erreur) {
    enregistrerAppelIADiagnostic({
      composant: diagnosticLabel ?? 'Elyndor Cloud',
      modele: ELYNDOR_CLOUD_MODELE,
      maxTokens,
      dureeMs: Date.now() - debutAppel,
      usage: null,
      statut: 'erreur',
      raison: erreur instanceof Error ? erreur.message : 'Erreur réseau',
    });
    throw erreur;
  }

  if (!response.ok) {
    const detail = await detailErreur(response);
    enregistrerAppelIADiagnostic({
      composant: diagnosticLabel ?? 'Elyndor Cloud',
      modele: ELYNDOR_CLOUD_MODELE,
      maxTokens,
      dureeMs: Date.now() - debutAppel,
      usage: null,
      statut: 'erreur',
      raison: `HTTP ${response.status}${detail ? ` : ${detail}` : ''}`,
    });
    throw new ErreurElyndorCloud(
      `Erreur Elyndor Cloud (${response.status})${detail ? ` : ${detail}` : ''}`,
      response.status,
    );
  }

  const data = await response.json();
  enregistrerUsageAppel(data?.usage);
  enregistrerAppelIADiagnostic({
    composant: diagnosticLabel ?? 'Elyndor Cloud',
    modele: ELYNDOR_CLOUD_MODELE,
    maxTokens,
    dureeMs: Date.now() - debutAppel,
    usage: data?.usage,
  });
  const message = data?.choices?.[0]?.message ?? data?.message ?? {};
  appliquerPolitiqueRaisonnement(message, profil);
  const finishReason = String(data?.choices?.[0]?.finish_reason ?? data?.finish_reason ?? '');
  return { message, finishReason };
}

export async function appellerModele({
  messages,
  temperature = 0.9,
  maxTokens = 700,
  signal,
  diagnosticLabel,
}: AppelModeleOptions): Promise<string> {
  for (let tentative = 1; tentative <= TENTATIVES_REPONSE_VIDE; tentative++) {
    const message = await appelerChat(messages, temperature, maxTokens, signal, undefined, diagnosticLabel);
    const contenu = typeof message.content === 'string' ? message.content.trim() : '';
    if (contenu) return contenu;
    if (tentative === TENTATIVES_REPONSE_VIDE) {
      throw new ErreurElyndorCloud('Elyndor Cloud a répondu sans texte exploitable.');
    }
  }
  throw new ErreurElyndorCloud('Elyndor Cloud a répondu sans texte exploitable.');
}

export interface ReponseModele {
  contenu: string;
  /** true si la génération s'est arrêtée sur le plafond de tokens (finish_reason « length »). */
  coupee: boolean;
}

/** Comme appellerModele, mais indique si la réponse a été coupée par le plafond de tokens. */
export async function appellerModeleDetaille({
  messages,
  temperature = 0.9,
  maxTokens = 700,
  signal,
  diagnosticLabel,
}: AppelModeleOptions): Promise<ReponseModele> {
  for (let tentative = 1; tentative <= TENTATIVES_REPONSE_VIDE; tentative++) {
    const { message, finishReason } = await appelerChatDetaille(messages, temperature, maxTokens, signal, undefined, diagnosticLabel);
    const contenu = typeof message.content === 'string' ? message.content.trim() : '';
    if (contenu) return { contenu, coupee: finishReason === 'length' };
  }
  throw new ErreurElyndorCloud('Elyndor Cloud a répondu sans texte exploitable.');
}

export async function appellerModeleAvecOutils({
  messages,
  outils,
  temperature = 0.2,
  maxTokens = 600,
  signal,
  diagnosticLabel,
}: AppelModeleAvecOutilsOptions): Promise<{ contenu: string; appelsOutils: AppelOutil[] }> {
  const schemas = outils.map(versSchemaOutil);

  try {
    const message = await appelerChat(messages, temperature, maxTokens, signal, schemas, diagnosticLabel);
    return {
      contenu: typeof message.content === 'string' ? message.content : '',
      appelsOutils: parserAppelsOutils(message),
    };
  } catch (erreur) {
    const repliJson = erreur instanceof ErreurElyndorCloud &&
      (erreur.statut === 400 || erreur.statut === 422);
    if (!repliJson) throw erreur;

    const message = await appelerChat(
      ajouterInstructionsOutilsJson(messages, outils),
      temperature,
      maxTokens,
      signal,
      undefined,
      diagnosticLabel ? `${diagnosticLabel} — repli JSON` : 'Outils — repli JSON',
    );
    return extraireAppelsOutilsJson(typeof message.content === 'string' ? message.content : '');
  }
}

/** Le catalogue n'est plus exposé : Elyndor Cloud impose son modèle. */
export async function listerModeles(): Promise<ModeleOpenRouter[]> {
  return [{ id: ELYNDOR_CLOUD_MODELE, nom: ELYNDOR_CLOUD_MODELE }];
}
