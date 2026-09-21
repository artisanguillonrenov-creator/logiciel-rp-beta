import type { ChatMessage } from './openrouter';

export const CHATGPT_GATEWAY_URL = 'https://elyndor-chatgpt-plus-gateway.onrender.com';
const CLE_SESSION = 'elyndor_chatgpt_plus_session';

export interface DemarrageConnexionChatGPT {
  type?: string;
  loginId?: string;
  verificationUrl?: string;
  userCode?: string;
  sessionToken: string;
}

export interface EtatConnexionChatGPT {
  connected: boolean;
  completed?: boolean;
  error?: string | null;
  planType?: string | null;
  authMode?: string | null;
}

export interface ModeleChatGPT {
  id: string;
  nom: string;
}

function stockageSession(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

export function lireSessionChatGPT(): string {
  try {
    return stockageSession()?.getItem(CLE_SESSION) ?? '';
  } catch {
    return '';
  }
}

function enregistrerSessionChatGPT(token: string): void {
  try {
    stockageSession()?.setItem(CLE_SESSION, token);
  } catch {
    // Session navigateur indisponible : le jeton reste seulement utilisable
    // pendant l'action courante. Le prochain appel demandera une reconnexion.
  }
}

function effacerSessionChatGPT(): void {
  try {
    stockageSession()?.removeItem(CLE_SESSION);
  } catch {}
}

async function lireJson(response: Response): Promise<any> {
  let data: any = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const detail = typeof data?.error === 'string' ? data.error : `Erreur passerelle ChatGPT (${response.status}).`;
    throw new Error(detail);
  }
  return data;
}

function headersAvecSession(): Record<string, string> {
  const token = lireSessionChatGPT();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function demarrerConnexionChatGPT(): Promise<DemarrageConnexionChatGPT> {
  const response = await fetch(`${CHATGPT_GATEWAY_URL}/auth/device/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = await lireJson(response) as DemarrageConnexionChatGPT;
  if (!data.sessionToken) throw new Error('La passerelle n’a pas renvoyé de session de connexion.');
  enregistrerSessionChatGPT(data.sessionToken);
  return data;
}

export async function etatConnexionChatGPT(): Promise<EtatConnexionChatGPT> {
  const token = lireSessionChatGPT();
  if (!token) return { connected: false, completed: false };
  const response = await fetch(`${CHATGPT_GATEWAY_URL}/auth/status`, { headers: headersAvecSession() });
  if (response.status === 401) {
    effacerSessionChatGPT();
    return { connected: false, completed: false };
  }
  return lireJson(response);
}

export async function attendreConnexionChatGPT(
  delaiMaxMs = 180_000,
  intervalleMs = 2000,
): Promise<EtatConnexionChatGPT> {
  const debut = Date.now();
  while (Date.now() - debut < delaiMaxMs) {
    const etat = await etatConnexionChatGPT();
    if (etat.connected) return etat;
    if (etat.completed && etat.error) throw new Error(etat.error);
    await new Promise((resolve) => setTimeout(resolve, intervalleMs));
  }
  throw new Error('La connexion ChatGPT n’a pas été confirmée à temps. Réessaie.');
}

export async function listerModelesChatGPT(): Promise<ModeleChatGPT[]> {
  const response = await fetch(`${CHATGPT_GATEWAY_URL}/models`, { headers: headersAvecSession() });
  const data = await lireJson(response);
  const liste = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
  return liste
    .map((item: any) => ({
      id: String(item?.id ?? item?.model ?? '').trim(),
      nom: String(item?.displayName ?? item?.name ?? item?.id ?? item?.model ?? '').trim(),
    }))
    .filter((m: ModeleChatGPT) => m.id)
    .sort((a: ModeleChatGPT, b: ModeleChatGPT) => a.nom.localeCompare(b.nom));
}

export async function appelerChatGPTAbonnement(
  messages: ChatMessage[],
  model = '',
  signal?: AbortSignal,
): Promise<string> {
  const token = lireSessionChatGPT();
  if (!token) throw new Error('ChatGPT Plus n’est pas connecté. Ouvre Réglages → IA & connexion.');
  const response = await fetch(`${CHATGPT_GATEWAY_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headersAvecSession() },
    body: JSON.stringify({ messages, model: model || undefined, effort: 'low' }),
    signal,
  });
  if (response.status === 401) {
    effacerSessionChatGPT();
    throw new Error('La session ChatGPT a expiré. Reconnecte ton compte dans Réglages.');
  }
  const data = await lireJson(response);
  const contenu = data?.choices?.[0]?.message?.content;
  if (typeof contenu !== 'string' || !contenu.trim()) throw new Error('ChatGPT a renvoyé une réponse vide.');
  return contenu.trim();
}

export async function deconnecterChatGPT(): Promise<void> {
  const token = lireSessionChatGPT();
  try {
    if (token) {
      await fetch(`${CHATGPT_GATEWAY_URL}/auth/logout`, {
        method: 'POST',
        headers: { ...headersAvecSession() },
      });
    }
  } finally {
    effacerSessionChatGPT();
  }
}
