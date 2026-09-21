export interface SearchableLoreEntry {
  id: string;
  titre: string;
  contenu: string;
  score?: number;
}

export interface SearchableMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SearchHit<T> {
  item: T;
  score: number;
  excerpt: string;
}

export interface RetrievalBudget {
  maxResults: number;
  maxChars: number;
  maxCharsPerResult: number;
}

export interface NarrativeContextBudget {
  identityChars: number;
  stateChars: number;
  historyChars: number;
  loreChars: number;
  recentChars: number;
  playerChars: number;
}
