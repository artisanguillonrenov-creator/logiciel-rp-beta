import type { AppSettings, MoteurInference } from '../types';
import { ajouterInstructionsOutilsJson, extraireAppelsOutilsJson } from './toolCallingJson';
import { appliquerPolitiqueRaisonnement, resoudreProfilRaisonnement } from './reasoningPolicy';
import { enregistrerUsageAppel } from './mesureTokens';
import { enregistrerAppelIADiagnostic } from './diagnosticTour';
import { journaliser } from './journalDiagnostic';
import { ELYNDOR_CLOUD_MODELE, assurerPodElyndorCloud } from './elyndorCloud';
import { activerReglagesFournisseurs, reglagesFournisseursActifs, resoudreRouteTexte, type RouteTexte } from './fournisseursRuntime';

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
  /** Curseurs du concepteur validés pour llama.cpp. Réservés aux tours narratifs. */
  samplers?: Record<string, number>;
  moteurInference?: MoteurInference;
  baseUrl?: string;
  signal?: AbortSignal;
  /** Libellé concepteur uniquement : n'altère jamais la requête envoyée au modèle. */
  diagnosticLabel?: string;
  /** Histoire concernée : rattache l'appel au bon journal de diagnostic. */
  storyId?: string;
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
export function configurationLLM(settings: AppSettings, _modeleOverride?: string) {
  activerReglagesFournisseurs(settings);
  const route = resoudreRouteTexte(settings);
  return {
    apiKey: route.apiKey, model: route.model,
    moteurInference: (route.fournisseur === 'openrouter' ? 'openrouter' : 'serveur') as 'openrouter' | 'serveur',
    baseUrl: route.url.replace(/\/chat\/completions$/, ''),
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

async function fetchCloud(init: RequestInit, signalExterne?: AbortSignal, route?: RouteTexte): Promise<Response> {
  const controleur = new AbortController();
  const relayerAnnulation = () => controleur.abort(signalExterne?.reason);
  if (signalExterne?.aborted) relayerAnnulation();
  else signalExterne?.addEventListener('abort', relayerAnnulation, { once: true });

  const timer = setTimeout(
    () => controleur.abort(new Error('Délai de réponse Elyndor Cloud dépassé.')),
    DELAI_GENERATION_MS,
  );

  try {
    const destination = route ?? resoudreRouteTexte(reglagesFournisseursActifs());
    if (destination.fournisseur === 'openrouter' && !destination.apiKey) {
      throw new ErreurElyndorCloud('Renseigne ta clé OpenRouter dans Réglages → Fournisseurs IA.');
    }
    if (destination.fournisseur === 'runpod') await assurerPodElyndorCloud();
    return await fetch(destination.url, {
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
    if (cause instanceof ErreurElyndorCloud) throw cause;
    throw new ErreurElyndorCloud(
      'Impossible de joindre le fournisseur IA sélectionné. Vérifie la connexion et la clé.',
    );
  } finally {
    clearTimeout(timer);
    signalExterne?.removeEventListener('abort', relayerAnnulation);
  }
}

/**
 * Accepte une réponse JSON classique ou un flux SSE (`data: {...}` …
 * `data: [DONE]`) et la ramène à la forme d'une réponse non streamée :
 * contenu concaténé, raisonnement éventuel, finish_reason et usage du dernier
 * morceau qui les porte.
 */
export function analyserCorpsReponse(texte: string): Record<string, any> {
  const brut = texte.trim();
  if (!brut.startsWith('data:') && !brut.startsWith('event:') && !brut.startsWith(':')) {
    try {
      return JSON.parse(brut);
    } catch {
      throw new ErreurElyndorCloud('Réponse Elyndor Cloud illisible.');
    }
  }
  let contenu = '';
  let raisonnement = '';
  let finishReason: string | null = null;
  let usage: unknown;
  for (const ligne of brut.split(/\r?\n/)) {
    if (!ligne.startsWith('data:')) continue;
    const donnees = ligne.slice(5).trim();
    if (!donnees || donnees === '[DONE]') continue;
    let morceau: any;
    try {
      morceau = JSON.parse(donnees);
    } catch {
      continue;
    }
    if (morceau?.error) {
      const detail = morceau.error.message ?? JSON.stringify(morceau.error);
      throw new ErreurElyndorCloud(`Erreur Elyndor Cloud : ${detail}`);
    }
    const choix = morceau?.choices?.[0];
    const delta = choix?.delta ?? {};
    if (typeof delta.content === 'string') contenu += delta.content;
    if (typeof delta.reasoning_content === 'string') raisonnement += delta.reasoning_content;
    if (choix?.finish_reason) finishReason = choix.finish_reason;
    if (morceau?.usage) usage = morceau.usage;
  }
  const message: Record<string, unknown> = { role: 'assistant', content: contenu };
  if (raisonnement) message.reasoning_content = raisonnement;
  return { choices: [{ message, finish_reason: finishReason }], usage };
}

async function appelerChat(
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  signal?: AbortSignal,
  tools?: unknown[],
  diagnosticLabel?: string,
  storyId?: string,
  samplers?: Record<string, number>,
): Promise<Record<string, any>> {
  return (await appelerChatDetaille(messages, temperature, maxTokens, signal, tools, diagnosticLabel, storyId, samplers)).message;
}

async function appelerChatDetaille(
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  signal?: AbortSignal,
  tools?: unknown[],
  diagnosticLabel?: string,
  storyId?: string,
  samplers?: Record<string, number>,
): Promise<{ message: Record<string, any>; finishReason: string }> {
  const route = resoudreRouteTexte(reglagesFournisseursActifs());
  const profil = resoudreProfilRaisonnement(
    route.fournisseur === 'openrouter' ? 'openrouter' : 'serveur', route.model);
  const debutAppel = Date.now();

  let response: Response;
  try {
    response = await fetchCloud({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(route.apiKey ? { Authorization: `Bearer ${route.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: route.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      // llama.cpp accepte les paramètres d'échantillonnage directement dans le JSON.
      // Ne transmettre que les clés prévalidées par reglagesNarrateur.ts.
      ...(route.fournisseur === 'runpod' ? (samplers || {}) : {}),
      ...(route.fournisseur === 'runpod' ? { reasoning_effort: 'low' } : {}),
      // Streaming : le proxy Runpod (Cloudflare) coupe toute réponse qui n'a
      // rien envoyé en 100 s (erreur 524). En flux, les jetons arrivent au fil
      // de l'eau et une longue narration n'est plus interrompue. Les appels à
      // outils restent en une seule réponse (courts, deltas d'outils complexes).
      stream: !tools,
      ...(tools ? { tools, tool_choice: 'auto' } : { stream_options: { include_usage: true } }),
    }),
  }, signal, route);
  } catch (erreur) {
    journaliser('appel-ia', {
      composant: diagnosticLabel ?? 'Elyndor Cloud', temperature, maxTokens, messages,
      dureeMs: Date.now() - debutAppel, statut: 'erreur',
      raison: erreur instanceof Error ? erreur.message : 'Erreur réseau',
    }, storyId);
    enregistrerAppelIADiagnostic({
      composant: diagnosticLabel ?? 'Elyndor Cloud',
      modele: route.model,
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
    journaliser('appel-ia', {
      composant: diagnosticLabel ?? 'Elyndor Cloud', temperature, maxTokens, messages,
      dureeMs: Date.now() - debutAppel, statut: 'erreur',
      raison: `HTTP ${response.status}${detail ? ` : ${detail}` : ''}`,
    }, storyId);
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

  const data = analyserCorpsReponse(await response.text());
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
  journaliser('appel-ia', {
    composant: diagnosticLabel ?? 'Elyndor Cloud',
    temperature,
    maxTokens,
    outils: Array.isArray(tools) ? tools.length : 0,
    messages,
    reponse: message.content ?? null,
    appelsOutils: message.tool_calls ?? undefined,
    finishReason,
    dureeMs: Date.now() - debutAppel,
    usage: data?.usage ?? null,
    statut: 'ok',
  }, storyId);
  return { message, finishReason };
}

export async function appellerModele({
  samplers,
  messages,
  temperature = 0.9,
  maxTokens = 700,
  signal,
  diagnosticLabel,
  storyId,
}: AppelModeleOptions): Promise<string> {
  for (let tentative = 1; tentative <= TENTATIVES_REPONSE_VIDE; tentative++) {
    const message = await appelerChat(messages, temperature, maxTokens, signal, undefined, diagnosticLabel, storyId, samplers);
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
  samplers,
  messages,
  temperature = 0.9,
  maxTokens = 700,
  signal,
  diagnosticLabel,
  storyId,
}: AppelModeleOptions): Promise<ReponseModele> {
  for (let tentative = 1; tentative <= TENTATIVES_REPONSE_VIDE; tentative++) {
    const { message, finishReason } = await appelerChatDetaille(messages, temperature, maxTokens, signal, undefined, diagnosticLabel, storyId, samplers);
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
  storyId,
}: AppelModeleAvecOutilsOptions): Promise<{ contenu: string; appelsOutils: AppelOutil[] }> {
  const schemas = outils.map(versSchemaOutil);

  try {
    const message = await appelerChat(messages, temperature, maxTokens, signal, schemas, diagnosticLabel, storyId);
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
      storyId,
    );
    return extraireAppelsOutilsJson(typeof message.content === 'string' ? message.content : '');
  }
}

/** Le catalogue n'est plus exposé : Elyndor Cloud impose son modèle. */
export async function listerModeles(): Promise<ModeleOpenRouter[]> {
  const actifs = reglagesFournisseursActifs();
  if (actifs.moteurInference !== 'openrouter') {
    const route = resoudreRouteTexte(actifs);
    return [{ id: route.model, nom: route.model }];
  }
  const resultat = await fetch('https://openrouter.ai/api/v1/models');
  if (!resultat.ok) throw new ErreurElyndorCloud('Catalogue OpenRouter indisponible.', resultat.status);
  const donnees = await resultat.json();
  const modeles = (donnees?.data ?? []) as Array<{id?:string,name?:string}>;
  return modeles.filter(m=>typeof m.id==='string' && m.id.endsWith(':free'))
    .map(m=>({id:m.id!,nom:m.name || m.id!}));
}
