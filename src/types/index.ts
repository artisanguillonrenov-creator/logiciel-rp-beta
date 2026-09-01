export type Creativite = 'faible' | 'moyenne' | 'elevee';
export type Longueur = 'courte' | 'moyenne' | 'longue';

export interface StorySettings {
  creativite: Creativite;
  longueur: Longueur;
}

export interface StoryMeta {
  id: string;
  personnageNom: string;
  personnageDescription: string;
  pointDeDepart: string;
  createdAt: number;
  updatedAt: number;
}

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export type FactType = 'personnage' | 'lieu' | 'promesse' | 'autre';

export interface Fact {
  id: string;
  type: FactType;
  texte: string;
  resolue?: boolean;
}

export interface MemoryState {
  resume: string;
  faits: Fact[];
  dernierMessageIndexMaj: number;
}

export interface StoryState {
  meta: StoryMeta;
  messages: Message[];
  memoire: MemoryState;
  settings: StorySettings;
}

export interface AppSettings {
  openRouterApiKey: string;
  model: string;
  // Clé de secours pour les embeddings (recherche sémantique du lore) si
  // OpenRouter n'en sert pas pour ce compte. Optionnelle : voir
  // src/engine/embeddings.ts.
  embeddingsApiKey?: string;
}

export interface LoreEntry {
  id: string;
  titre: string;
  contenu: string;
  // Similarité cosinus avec la requête, quand l'entrée vient de la
  // sélection sémantique (absente pour les entrées toujours actives).
  score?: number;
}

export interface ValidationResult {
  ok: boolean;
  raisons: string[];
}
