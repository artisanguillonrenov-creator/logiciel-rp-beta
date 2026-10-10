import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage } from './elyndorCloudClient';

const URL = 'https://elyndor-chatgpt-plus-gateway.onrender.com';
const KEY = 'elyndor_chatgpt_plus_session';
const LEGACY = 'elyndor_chatgpt_plus_session';
// Chargement tardif : permet de tester la narration Node sans environnement Expo natif.
async function coffre() { return import('expo-secure-store'); }

async function lireSession(): Promise<string> {
  if (typeof document !== 'undefined') {
    try { return globalThis.localStorage?.getItem(KEY) || globalThis.sessionStorage?.getItem(LEGACY) || ''; }
    catch { return ''; }
  }
  return (await (await coffre()).getItemAsync(KEY)) || (await AsyncStorage.getItem(KEY)) || '';
}
async function ecrireSession(value: string): Promise<void> {
  if (typeof document !== 'undefined') {
    globalThis.localStorage?.setItem(KEY, value);
    return;
  }
  await (await coffre()).setItemAsync(KEY, value);
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
async function effacerSession(): Promise<void> {
  if (typeof document !== 'undefined') {
    try { globalThis.localStorage?.removeItem(KEY); globalThis.sessionStorage?.removeItem(LEGACY); } catch {}
    return;
  }
  await (await coffre()).deleteItemAsync(KEY);
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
async function requete(chemin: string, options: RequestInit = {}, authentifie = true): Promise<any> {
  const token = authentifie ? await lireSession() : '';
  if (authentifie && !token) throw new Error('Connecte ton abonnement ChatGPT dans Réglages → Fournisseurs IA.');
  const response = await fetch(URL + chemin, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  });
  let data: any = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    if (response.status === 401 && authentifie) await effacerSession();
    const message = typeof data?.error === 'string' ? data.error : 'Passerelle ChatGPT indisponible (' + response.status + ').';
    throw new Error(message);
  }
  return data;
}
export interface ConnexionChatGPT {
  connected: boolean;
  completed?: boolean;
  error?: string | null;
  planType?: string | null;
}
export async function demarrerConnexionChatGPT(): Promise<{ verificationUrl: string; userCode: string }> {
  const r = await requete('/auth/device/start', { method: 'POST', body: '{}' }, false);
  if (!r?.sessionToken || !r?.verificationUrl || !r?.userCode) throw new Error('Le serveur n’a pas renvoyé de code de connexion.');
  await ecrireSession(r.sessionToken);
  return { verificationUrl: r.verificationUrl, userCode: r.userCode };
}
export async function statutChatGPT(): Promise<ConnexionChatGPT> {
  if (!(await lireSession())) return { connected: false };
  return requete('/auth/status');
}
export async function deconnecterChatGPT(): Promise<void> {
  try { if (await lireSession()) await requete('/auth/logout', { method: 'POST' }); }
  finally { await effacerSession(); }
}
export async function modelesChatGPT(): Promise<Array<{ id: string; nom: string }>> {
  const r = await requete('/models');
  const values = Array.isArray(r?.data) ? r.data : Array.isArray(r?.models) ? r.models : [];
  return values.map((m: any) => ({ id: String(m?.id || m?.model || ''), nom: String(m?.displayName || m?.name || m?.id || '') })).filter((m: { id: string }) => m.id);
}
export async function reponseChatGPT(messages: ChatMessage[], model: string, signal?: AbortSignal): Promise<string> {
  const r = await requete('/chat', { method: 'POST', body: JSON.stringify({ messages, model: model || undefined, effort: 'low' }), signal });
  const texte = r?.choices?.[0]?.message?.content;
  if (typeof texte !== 'string' || !texte.trim()) throw new Error('GPT a renvoyé une réponse vide.');
  return texte.trim();
}
