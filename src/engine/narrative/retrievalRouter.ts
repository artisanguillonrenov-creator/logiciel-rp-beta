import type { SearchableLoreEntry, SearchableMessage } from './types';
import { searchHistoryLocal, formatHistoryHits } from './historySearchEngine';
import { searchLoreLocal, loreHitsAsEntries } from './loreSearchEngine';

export interface RetrievalInput {
  playerName: string;
  playerMessage: string;
  recentMessages: SearchableMessage[];
  allMessages: SearchableMessage[];
  loreEntries: SearchableLoreEntry[];
  currentLocation?: string;
  currentObjectives?: string;
}

export interface RetrievalResult {
  query: string;
  historyText: string;
  loreEntries: SearchableLoreEntry[];
  debug: {
    history: Array<{ id: string; score: number }>;
    lore: Array<{ id: string; score: number }>;
  };
}

export function retrieveForTurn(input: RetrievalInput): RetrievalResult {
  const query = [
    input.playerMessage,
    input.currentLocation,
    input.currentObjectives,
    ...input.recentMessages.slice(-2).map((m) => m.content),
  ].filter(Boolean).join('\n');

  const history = searchHistoryLocal(input.allMessages, query, 4);
  const lore = searchLoreLocal(input.loreEntries, query);
  return {
    query,
    historyText: formatHistoryHits(history, input.playerName),
    loreEntries: loreHitsAsEntries(lore),
    debug: {
      history: history.map((h) => ({ id: h.message.id, score: h.score })),
      lore: lore.map((h) => ({ id: h.entry.id, score: h.score })),
    },
  };
}
