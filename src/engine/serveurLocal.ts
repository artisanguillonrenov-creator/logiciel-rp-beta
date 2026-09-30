import type { AppSettings } from '../types';
import type { ChatMessage, ToolDefinition } from './openrouter';
import { parserAppelsOutils, type AppelOutilDistant, type ModeleDistant } from './llmProvider';
import { appliquerPolitiqueRaisonnement, resoudreProfilRaisonnement } from './reasoningPolicy';
import { enregistrerUsageAppel } from './mesureTokens';
import { masquerSecrets } from './responseSanitizer';
import { normaliserUrlServeur } from './serveurUrl';
import { ajouterInstructionsOutilsJson, extraireAppelsOutilsJson } from './toolCallingJson';

export { EXEMPLES_URL_SERVEUR_LOCAL, normaliserUrlServeur, URL_SERVEUR_LOCAL_DEFAUT } from './serveurUrl';

// Moteur « serveur local » (repris de la V13 « Modèle local ») : un runtime
// compatible OpenAI /v1 — LM Studio, Ollama, llama.cpp server… — lancé par
// l'utilisateur sur son PC. Contrairement au moteur 'local' (LiteRT, sur
// l'appareil), rien n'est chargé par l'application : elle ne fait que parler
// HTTP, donc le même code sert le web, Android et iOS. Depuis un téléphone
// ou une tablette, l'adresse est celle du PC sur le réseau local.

// Un modèle local sur un PC grand public répond bien plus lentement qu'une
// API distante, surtout au premier message (chargement du modèle et
// préparation du contexte) : la V13.2.5 coupait à 120 s des générations
// encore en cours, la V13.2.6 attend jusqu'à 10 minutes.
const DELAI_GENERATION_MS = 600_000;
const DELAI_LISTE_MS = 12_000;

// Les modèles à raisonnement (Qwen3, DeepSeek-R1…) consomment une partie du
// budget en réflexion avant d'écrire : avec 700 tokens, la V13 recevait
// souvent une réponse vide. reasoning_effort ne fait que raccourcir cette
// réflexion, on laisse donc de la marge.
const MAX_TOKENS_MIN_RAISONNEMENT = 4096;

export class ErreurServeurLocal extends Error {
  readonly statut?: number;

  constructor(message: string, statut?: number) {
    super(message);
    this.name = 'ErreurServeurLocal';
    this.statut = statut;
  }
}

export interface ConfigurationServeurLocal {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export function configurationServeurLocal(settings: AppSettings): ConfigurationServeurLocal {
  return {
    baseUrl: normaliserUrlServeur(settings.serveurLocalUrl),
    model: settings.serveurLocalModele?.trim() ?? '',
    apiKey: settings.serveurLocalApiKey?.trim() || undefined,
  };
}

function entetes(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

async function fetchServeur(
  url: string,
  init: RequestInit,
  delaiMs: number,
  signalExterne?: AbortSignal,
): Promise<Response> {
  const controleur = new AbortController();
  const relayerAnnulation = () => controleur.abort(signalExterne?.reason);
  if (signalExterne?.aborted) relayerAnnulation();
  else signalExterne?.addEventListener('abort', relayerAnnulation, { once: true });
  const timer = setTimeout(() => controleur.abort(new Error('Délai de réponse dépassé.')), delaiMs);
  try {
    return await fetch(url, { ...init, signal: controleur.signal });
  } catch (cause) {
    if (signalExterne?.aborted) throw new ErreurServeurLocal('Génération locale annulée.');
    if (controleur.signal.aborted) {
      // Sans ce message, l'utilisateur ne voyait que « signal is aborted
      // without reason » (constat V13.2.6).
      throw new ErreurServeurLocal(
        `Le serveur local n'a pas répondu en ${Math.round(delaiMs / 60_000) || 1} min. La génération a été arrêtée : essaie un modèle plus léger ou une réponse plus courte.`,
      );
    }
    // Sur le web, un runtime injoignable, un CORS refusé et un accès au
    // réseau local bloqué par le navigateur produisent tous le même
    // TypeError opaque : on liste les trois pistes plutôt que d'en deviner une.
    throw new ErreurServeurLocal(
      "Impossible de joindre le serveur local. Vérifie l'adresse, que le runtime (LM Studio, Ollama…) est lancé et " +
      "qu'il accepte les connexions du réseau local (et CORS si Elyndor tourne dans un navigateur).",
    );
  } finally {
    clearTimeout(timer);
    signalExterne?.removeEventListener('abort', relayerAnnulation);
  }
}

async function detailErreur(response: Response, apiKey?: string): Promise<string> {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message ?? body?.message ?? '';
    if (typeof detail !== 'string') detail = JSON.stringify(detail);
  } catch {
    // Corps vide ou non JSON : le code HTTP suffit.
  }
  return masquerSecrets(detail, apiKey ? [apiKey] : []);
}

async function verifierReponse(response: Response, config: ConfigurationServeurLocal): Promise<void> {
  if (response.ok) return;
  if (response.status === 401 || response.status === 403) {
    throw new ErreurServeurLocal(`Accès au serveur local refusé (${response.status}). Vérifie la clé du serveur.`, response.status);
  }
  const detail = await detailErreur(response, config.apiKey);
  throw new ErreurServeurLocal(`Erreur du serveur local (${response.status})${detail ? ` : ${detail}` : ''}`, response.status);
}

export async function listerModelesServeur(config: Pick<ConfigurationServeurLocal, 'baseUrl' | 'apiKey'>): Promise<ModeleDistant[]> {
  const complet = { ...config, model: '' };
  const response = await fetchServeur(`${config.baseUrl}/models`, { headers: entetes(config.apiKey) }, DELAI_LISTE_MS);
  await verifierReponse(response, complet);
  const data = await response.json();
  // /v1/models renvoie { data: [...] } ; certains runtimes (API native
  // d'Ollama) renvoient { models: [...] } ou un tableau nu.
  const liste: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : Array.isArray(data) ? data : [];
  const vus = new Set<string>();
  const modeles: ModeleDistant[] = [];
  for (const m of liste) {
    const id = String(m?.id ?? m?.model ?? m?.name ?? '').trim();
    if (!id || vus.has(id)) continue;
    vus.add(id);
    modeles.push({ id, nom: String(m?.name ?? id).trim() || id });
  }
  return modeles.sort((a, b) => a.nom.localeCompare(b.nom));
}

function cleComparaison(nom: string): string {
  return nom
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/^.*\//, '')
    .replace(/\.gguf$/, '')
    .replace(/[\s_:@]+/g, '-');
}

/**
 * V13.2.5 « nom + Entrée » : l'utilisateur tape le nom de son fichier GGUF
 * (« Qwen3.5-9B-Q4_K_M.gguf ») alors que le runtime l'expose sous un
 * identifiant à lui (« qwen3.5-9b », « lmstudio-community/qwen3.5-9b@q4_k_m »,
 * « qwen3.5:9b »…). On retrouve l'identifiant exact à envoyer au serveur.
 * Renvoie null si aucun modèle ne correspond ou si plusieurs correspondent
 * aussi bien — mieux vaut demander que charger le mauvais modèle.
 */
export function resoudreModeleServeur(saisie: string, modeles: ModeleDistant[]): string | null {
  const brut = saisie.trim();
  if (!brut) return modeles.length === 1 ? modeles[0].id : null;
  const exact = modeles.find((m) => m.id === brut);
  if (exact) return exact.id;

  const cible = cleComparaison(brut);
  const egaux = modeles.filter((m) => cleComparaison(m.id) === cible || cleComparaison(m.nom) === cible);
  if (egaux.length === 1) return egaux[0].id;
  if (egaux.length > 1) return null;

  // Correspondance partielle : l'ID du runtime omet souvent la quantification
  // (« qwen3.5-9b » pour « Qwen3.5-9B-Q4_K_M »), ou l'inverse.
  const candidats = modeles
    .map((m) => {
      const cle = cleComparaison(m.id);
      const recouvrement = cible.startsWith(cle) || cle.startsWith(cible) ? Math.min(cle.length, cible.length) : 0;
      return { id: m.id, recouvrement };
    })
    .filter((c) => c.recouvrement >= 3)
    .sort((a, b) => b.recouvrement - a.recouvrement);
  if (candidats.length === 0) return null;
  if (candidats.length > 1 && candidats[1].recouvrement === candidats[0].recouvrement) return null;
  return candidats[0].id;
}

export interface ResultatConnexionServeur {
  modele: string;
  modeles: ModeleDistant[];
}

/** Teste le serveur, puis retrouve le modèle demandé parmi ceux qu'il sert. */
export async function connecterServeurLocal(
  config: Pick<ConfigurationServeurLocal, 'baseUrl' | 'apiKey'>,
  saisieModele: string,
): Promise<ResultatConnexionServeur> {
  const modeles = await listerModelesServeur(config);
  if (modeles.length === 0) {
    throw new ErreurServeurLocal('Le serveur répond mais ne propose aucun modèle. Charge un modèle dans LM Studio (ou `ollama pull`) puis réessaie.');
  }
  const modele = resoudreModeleServeur(saisieModele, modeles);
  if (!modele) {
    const apercu = modeles.slice(0, 6).map((m) => m.id).join(', ');
    throw new ErreurServeurLocal(
      saisieModele.trim()
        ? `Aucun modèle unique ne correspond à « ${saisieModele.trim()} ». Modèles disponibles : ${apercu}${modeles.length > 6 ? '…' : ''}`
        : 'Plusieurs modèles sont disponibles : tape le nom de celui à utiliser.',
    );
  }
  return { modele, modeles };
}

function exigerConfiguration(config: ConfigurationServeurLocal): void {
  if (!config.model) throw new ErreurServeurLocal('Aucun modèle local choisi. Configure le serveur local dans Réglages.');
}

export interface RequeteServeurLocal {
  config: ConfigurationServeurLocal;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
}

async function appelerChat(options: RequeteServeurLocal, tools?: unknown[]): Promise<Record<string, any>> {
  const { config, messages, temperature, signal } = options;
  exigerConfiguration(config);
  const profil = resoudreProfilRaisonnement('serveur', config.model);
  const maxTokens = profil.supportsReasoning ? Math.max(options.maxTokens, MAX_TOKENS_MIN_RAISONNEMENT) : options.maxTokens;
  const response = await fetchServeur(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { ...entetes(config.apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      // V13.2.6 : réduit nettement le temps de réflexion de Qwen3.5 sous
      // LM Studio ; les runtimes qui ne le connaissent pas l'ignorent.
      reasoning_effort: 'low',
      stream: false,
      ...(tools ? { tools, tool_choice: 'auto' } : {}),
    }),
  }, DELAI_GENERATION_MS, signal);
  await verifierReponse(response, config);
  const data = await response.json();
  enregistrerUsageAppel(data?.usage);
  const message = data?.choices?.[0]?.message ?? data?.message ?? {};
  const raisonnementSeul = !(typeof message.content === 'string' && message.content.trim()) &&
    ['reasoning_content', 'reasoning'].some((champ) => typeof message[champ] === 'string' && message[champ].trim());
  appliquerPolitiqueRaisonnement(message, profil);
  if (raisonnementSeul) {
    throw new ErreurServeurLocal(
      "Le modèle a épuisé sa réponse en raisonnement interne sans écrire de texte. Réessaie, ou augmente la longueur de contexte dans le runtime.",
    );
  }
  return message;
}

export async function genererTexteServeur(options: RequeteServeurLocal): Promise<string> {
  const message = await appelerChat(options);
  const contenu = typeof message.content === 'string' ? message.content.trim() : '';
  if (!contenu) throw new ErreurServeurLocal('Le serveur local a répondu sans texte exploitable.');
  return contenu;
}

/**
 * Tool calling natif (tool_calls OpenAI) d'abord : LM Studio et Ollama le
 * gèrent pour les modèles compatibles. Un runtime ou un modèle qui refuse le
 * champ `tools` (400/422) retombe sur le protocole JSON-en-prose partagé avec
 * Infermatic et LiteRT.
 */
export async function appelerServeurAvecOutils(
  options: RequeteServeurLocal,
  outils: ToolDefinition[],
  schemas: unknown[],
): Promise<{ contenu: string; appelsOutils: AppelOutilDistant[] }> {
  let message: Record<string, any>;
  try {
    message = await appelerChat(options, schemas);
  } catch (erreur) {
    if (!(erreur instanceof ErreurServeurLocal && (erreur.statut === 400 || erreur.statut === 422))) throw erreur;
    message = await appelerChat({ ...options, messages: ajouterInstructionsOutilsJson(options.messages, outils) });
    return extraireAppelsOutilsJson(typeof message.content === 'string' ? message.content : '');
  }
  return {
    contenu: typeof message.content === 'string' ? message.content : '',
    appelsOutils: parserAppelsOutils(message),
  };
}
