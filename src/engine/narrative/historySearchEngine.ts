import type { SearchableMessage } from './types';
import { rankLexical } from './lexicalRetrieval';

export const HISTORY_BUDGET = {
  maxResults: 3,
  maxChars: 1500,
  maxCharsPerResult: 520,
} as const;

export interface HistoryHit {
  message: SearchableMessage;
  score: number;
  excerpt: string;
}

export function searchHistoryLocal(
  messages: SearchableMessage[],
  query: string,
  recentWindow = 4,
): HistoryHit[] {
  const oldMessages = messages.slice(0, Math.max(0, messages.length - recentWindow));
  return rankLexical({
    query,
    items: oldMessages,
    textOf: (m) => m.content,
    idOf: (m) => m.id,
    timestampOf: (m) => m.timestamp,
    budget: HISTORY_BUDGET,
  }).map((hit) => ({ message: hit.item, score: hit.score, excerpt: hit.excerpt }));
}

export function formatHistoryHits(hits: HistoryHit[], playerName: string): string {
  if (!hits.length) return '';
  return hits
    .slice()
    .sort((a, b) => a.message.timestamp - b.message.timestamp)
    .map((hit) => `- ${hit.message.role === 'user' ? playerName : 'Narrateur'} : ${hit.excerpt}`)
    .join('\n');
}
