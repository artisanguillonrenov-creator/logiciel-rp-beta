import type { AppelOutil, ChatMessage, ToolDefinition } from './openrouter';

// Stub web : le moteur local (expo-litert-lm) est natif uniquement.
// Metro résout automatiquement ce fichier plutôt que localInference.ts sur
// le build web, donc expo-litert-lm n'est jamais bundlé pour le web — voir
// la note en tête de localInference.ts.
export class ErreurMoteurLocal extends Error {}

export async function estDisponibleLocal(): Promise<boolean> {
  return false;
}

export async function genererTexteLocal(_messages: ChatMessage[]): Promise<string> {
  throw new ErreurMoteurLocal("Le moteur local n'est pas disponible sur le web.");
}

export async function appellerModeleLocalAvecOutilsJson(
  _messages: ChatMessage[],
  _outils: ToolDefinition[],
): Promise<{ contenu: string; appelsOutils: AppelOutil[] }> {
  throw new ErreurMoteurLocal("Le moteur local n'est pas disponible sur le web.");
}

export async function dechargerModeleLocal(): Promise<void> {}
