/**
 * Choix narratifs libres sur Workers AI et AI Horde.
 * Aucun changement du narrateur tant que l'utilisateur n'a pas sélectionné
 * explicitement un nouveau fournisseur dans les Réglages.
 */

export interface ModeleNarratifDisponible { id: string; nom: string }

/** Modèles Workers AI explicitement mentionnés comme accessibles sur Workers Free (juillet 2026). */
export const MODELES_NARRATION_CLOUDFLARE: readonly ModeleNarratifDisponible[] = [
  { id: '@cf/zai-org/glm-4.7-flash', nom: 'GLM-4.7 Flash' },
  { id: '@cf/google/gemma-4-26b-a4b-it', nom: 'Gemma 4 26B A4B' },
  { id: '@cf/nvidia/nemotron-3-120b-a12b', nom: 'Nemotron 3 120B A12B' },
  { id: '@cf/qwen/qwen3-30b-a3b-fp8', nom: 'Qwen3 30B A3B FP8' },
];
export const MODELE_CLOUDFLARE_PAR_DEFAUT = MODELES_NARRATION_CLOUDFLARE[0].id;
const HORDE_API = 'https://aihorde.net/api/v2';
const HORDE_ANONYME = '0000000000';
const DELAI_HORDE_MS = 240_000;

/** Le catalogue est filtré sur les modèles ayant au moins un worker actif. */
export async function listerModelesNarrationHorde(lecteur: typeof fetch = fetch): Promise<ModeleNarratifDisponible[]> {
  const reponse = await lecteur(`${HORDE_API}/status/models?type=text&min_count=1`);
  if (!reponse.ok) throw new Error(`Catalogue narratif AI Horde indisponible (HTTP ${reponse.status}).`);
  const donnees = await reponse.json() as Array<{ name?: unknown; count?: unknown }>;
  if (!Array.isArray(donnees)) throw new Error('Catalogue AI Horde illisible.');
  return donnees
    .filter((m): m is { name: string; count?: number } =>
      typeof m.name === 'string' && m.name.trim().length > 0 && m.count !== 0)
    .map(m => ({ id: m.name, nom: m.name }))
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

export interface MessageNarrateur {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Horde ne propose pas de chat/completions : on aplatit les messages en un
 * prompt strictement délimité, sans perdre les messages système.
 */
export function promptNarrationHorde(messages: readonly MessageNarrateur[]): string {
  const roles = { system: 'SYSTEM', user: 'USER', assistant: 'ASSISTANT' };
  return messages.map(m => `### ${roles[m.role]}\n${m.content}\n`).join('\n') + '\n### ASSISTANT\n';
}

export function construireRequeteTexteHorde(
  messages: readonly MessageNarrateur[], modele: string, temperature: number, maxTokens: number,
) {
  if (!modele.trim()) throw new Error('Choisis un modèle narratif AI Horde.');
  return {
    prompt: promptNarrationHorde(messages),
    models: [modele.trim()],
    params: {
      max_length: Math.max(16, Math.min(1024, Math.floor(maxTokens))),
      max_context_length: 4096,
      temperature: Math.max(0.01, Math.min(1.5, temperature)),
      n: 1,
    },
  };
}

export function convertirReponseCloudflare(data: any): Record<string, any> {
  const result = data?.result;
  const reponse = result?.response ?? data?.response;
  if (typeof reponse !== 'string') {
    throw new Error('Cloudflare : aucune réponse textuelle exploitable.');
  }
  return {
    choices: [{ message: { role: 'assistant', content: reponse }, finish_reason: 'stop' }],
    usage: result?.usage ?? data?.usage,
  };
}

async function attendre(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error('Narration AI Horde annulée.');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', annuler);
      resolve();
    }, ms);
    const annuler = () => {
      clearTimeout(timer);
      reject(new Error('Narration AI Horde annulée.'));
    };
    signal?.addEventListener('abort', annuler, { once: true });
  });
}

async function lireJSON(url: string, init: RequestInit, signal?: AbortSignal, lecteur: typeof fetch = fetch): Promise<any> {
  const reponse = await lecteur(url, { ...init, signal });
  if (!reponse.ok) {
    throw new Error(`AI Horde : erreur HTTP ${reponse.status}.`);
  }
  return reponse.json();
}

/**
 * L'appel est explicitement choisi : aucune bascule vers Runpod/OpenRouter.
 * Les tâches en attente sont supprimées sur annulation ou dépassement du délai.
 */
export async function genererTexteHorde(
  messages: readonly MessageNarrateur[],
  modele: string,
  cle: string,
  temperature: number,
  maxTokens: number,
  signal?: AbortSignal,
  lecteur: typeof fetch = fetch,
): Promise<string> {
  const entetes = {
    'Content-Type': 'application/json',
    apikey: cle.trim() || HORDE_ANONYME,
    'Client-Agent': 'Elyndor:1.0:github.com/artisanguillonrenov-creator/logiciel-rp-beta',
  };
  const demande = await lireJSON(`${HORDE_API}/generate/text/async`, {
    method: 'POST', headers: entetes,
    body: JSON.stringify(construireRequeteTexteHorde(messages, modele, temperature, maxTokens)),
  }, signal, lecteur);
  const id = demande?.id;
  if (typeof id !== 'string' || !/^[\w-]{10,80}$/.test(id)) {
    throw new Error('AI Horde : génération refusée par la file d’attente.');
  }
  const debut = Date.now();
  try {
    while (Date.now() - debut < DELAI_HORDE_MS) {
      await attendre(3500, signal);
      const resultat = await lireJSON(`${HORDE_API}/generate/text/status/${id}`, { headers: entetes }, signal, lecteur);
      if (resultat?.faulted === true || resultat?.is_possible === false) {
        throw new Error('AI Horde : aucun worker compatible avec le modèle choisi.');
      }
      if (resultat?.done === true || (resultat?.finished ?? 0) > 0) {
        const texte = resultat?.generations?.[0]?.text;
        if (typeof texte !== 'string' || !texte.trim()) throw new Error('AI Horde n’a renvoyé aucun texte.');
        return texte.trim();
      }
    }
    throw new Error('AI Horde : attente supérieure à quatre minutes ; choisis un autre modèle actif.');
  } finally {
    if (signal?.aborted || Date.now() - debut >= DELAI_HORDE_MS) {
      try {
        await lecteur(`${HORDE_API}/generate/text/status/${id}`, { method: 'DELETE', headers: entetes });
      } catch { /* abandon best effort, ne masque pas l'erreur principale */ }
    }
  }
}
