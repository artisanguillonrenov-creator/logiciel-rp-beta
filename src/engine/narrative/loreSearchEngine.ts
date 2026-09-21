import type { SearchableLoreEntry } from './types';
import { rankLexical } from './lexicalRetrieval';

export const LORE_BUDGET = {
  maxResults: 4,
  maxChars: 1800,
  maxCharsPerResult: 520,
} as const;

export interface LoreHit {
  entry: SearchableLoreEntry;
  score: number;
  excerpt: string;
}

export function searchLoreLocal(entries: SearchableLoreEntry[], query: string): LoreHit[] {
  return rankLexical({
    query,
    items: entries,
    titleOf: (e) => e.titre,
    textOf: (e) => e.contenu,
    idOf: (e) => e.id,
    budget: LORE_BUDGET,
  }).map((hit) => ({ entry: hit.item, score: hit.score, excerpt: hit.excerpt }));
}

export function loreHitsAsEntries(hits: LoreHit[]): SearchableLoreEntry[] {
  return hits.map((hit) => ({
    ...hit.entry,
    contenu: hit.excerpt,
    score: hit.score,
  }));
}
