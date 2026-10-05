import type { AppSettings } from '../types';
import {
  ErreurElyndorCloud,
  configurationLLM,
} from './elyndorCloudClient';

/**
 * Pont de compatibilité pour les quelques appels historiques qui importent
 * encore llmProvider. Aucun fournisseur externe n'est joignable depuis ce
 * module : le modèle Elyndor Cloud est imposé par configurationLLM.
 */
export { ErreurElyndorCloud as ErreurFournisseurLLM, configurationLLM };

export interface ModeleDistant {
  id: string;
  nom: string;
}

export interface AppelOutilDistant {
  nom: string;
  arguments: Record<string, unknown>;
}

/**
 * Les overrides de modèle d'anciennes histoires sont volontairement ignorés.
 * Ils ne doivent jamais pouvoir remplacer le modèle Cloud canonique.
 */
export function modeleOverridePourFournisseur(
  _settings: AppSettings,
  _modeleOverride?: string,
  _fournisseurOverride?: 'openrouter' | 'infermatic' | 'serveur',
): undefined {
  return undefined;
}

/** Parseur pur conservé pour les anciens tests/outils de tool calling. */
export function parserAppelsOutils(message: any): AppelOutilDistant[] {
  if (!Array.isArray(message?.tool_calls)) return [];
  const appels: AppelOutilDistant[] = [];
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
