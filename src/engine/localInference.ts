import type { AppelOutil, ChatMessage, ToolDefinition } from './openrouter';

// Moteur local temporairement désactivé (retiré de expo-litert-lm) : la
// dépendance native litertlm-android:0.11.0 exige Kotlin 2.3.0, ce qui
// casse la compilation de react-native-gesture-handler (erreur interne du
// compilateur) — conflit non résolu entre les deux modules natifs. Le code
// d'intégration (openrouter.ts, Settings, modeleLocalStore.ts) reste en
// place ; seul ce fichier redevient un stub le temps de trouver une
// combinaison de versions qui fonctionne pour les deux à la fois. Pour
// réactiver : `git log -- src/engine/localInference.ts` et restaurer la
// version qui importe réellement expo-litert-lm, puis remettre
// expo-litert-lm en dépendance et la surcharge kotlinVersion dans app.json.
export class ErreurMoteurLocal extends Error {}

export async function estDisponibleLocal(): Promise<boolean> {
  return false;
}

export async function genererTexteLocal(_messages: ChatMessage[]): Promise<string> {
  throw new ErreurMoteurLocal('Le moteur local est temporairement indisponible dans cette version.');
}

export async function appellerModeleLocalAvecOutilsJson(
  _messages: ChatMessage[],
  _outils: ToolDefinition[],
): Promise<{ contenu: string; appelsOutils: AppelOutil[] }> {
  throw new ErreurMoteurLocal('Le moteur local est temporairement indisponible dans cette version.');
}

export async function dechargerModeleLocal(): Promise<void> {}
