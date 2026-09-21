import type { RetrievalBudget, SearchHit } from './types';

const STOPWORDS = new Set([
  'a','ai','au','aux','avec','ce','ces','dans','de','des','du','elle','en','et','eux','il','ils','je','la','le','les','leur','lui','ma','mais','me','mes','moi','mon','ne','nos','notre','nous','on','ou','par','pas','pour','qu','que','qui','sa','se','ses','son','sur','ta','te','tes','toi','ton','tu','un','une','vos','votre','vous','y',
  'the','a','an','and','or','of','to','in','on','for','with','is','are','was','were','be','been','it','this','that','these','those','i','you','he','she','we','they',
]);

export function normaliserRecherche(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function termesRecherche(value: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const raw of normaliserRecherche(value).split(' ')) {
    const term = raw.replace(/^[-']+|[-']+$/g, '');
    if (term.length < 2 || STOPWORDS.has(term) || seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
  }
  return terms;
}

function occurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while ((from = haystack.indexOf(needle, from)) >= 0) {
    count += 1;
    from += needle.length;
  }
  return count;
}

function excerptAutourDuPremierTerme(text: string, terms: string[], maxChars: number): string {
  if (text.length <= maxChars) return text.trim();
  const normalized = normaliserRecherche(text);
  let bestIndex = -1;
  for (const term of terms) {
    const index = normalized.indexOf(term);
    if (index >= 0 && (bestIndex < 0 || index < bestIndex)) bestIndex = index;
  }
  const approx = bestIndex < 0 ? 0 : Math.max(0, bestIndex - Math.floor(maxChars * 0.35));
  const rawStart = Math.min(approx, Math.max(0, text.length - maxChars));
  const piece = text.slice(rawStart, rawStart + maxChars).trim();
  return `${rawStart > 0 ? '…' : ''}${piece}${rawStart + maxChars < text.length ? '…' : ''}`;
}

export interface RankOptions<T> {
  query: string;
  items: T[];
  titleOf?: (item: T) => string;
  textOf: (item: T) => string;
  idOf: (item: T) => string;
  timestampOf?: (item: T) => number | undefined;
  budget: RetrievalBudget;
  now?: number;
}

export function rankLexical<T>(options: RankOptions<T>): SearchHit<T>[] {
  const { items, textOf, titleOf, timestampOf, budget } = options;
  const terms = termesRecherche(options.query);
  if (!terms.length || !items.length || budget.maxResults <= 0 || budget.maxChars <= 0) return [];

  const normalizedPhrase = normaliserRecherche(options.query);
  const now = options.now ?? Date.now();
  const scored = items.map((item) => {
    const title = titleOf?.(item) ?? '';
    const text = textOf(item);
    const titleNorm = normaliserRecherche(title);
    const textNorm = normaliserRecherche(`${title} ${text}`);
    if (!textNorm) return { item, score: 0, excerpt: '' };

    let matched = 0;
    let frequency = 0;
    let titleMatches = 0;
    for (const term of terms) {
      const count = occurrences(textNorm, term);
      if (count > 0) matched += 1;
      frequency += Math.min(count, 4);
      if (titleNorm.includes(term)) titleMatches += 1;
    }

    if (!matched) return { item, score: 0, excerpt: '' };
    const coverage = matched / terms.length;
    const phraseBonus = normalizedPhrase.length >= 6 && textNorm.includes(normalizedPhrase) ? 2.5 : 0;
    const titleBonus = titleMatches * 1.8;
    const tfScore = Math.log2(1 + frequency) * 1.2;
    let recencyBonus = 0;
    const timestamp = timestampOf?.(item);
    if (timestamp && timestamp > 0) {
      const ageDays = Math.max(0, (now - timestamp) / 86_400_000);
      recencyBonus = Math.max(0, 0.7 - Math.log10(1 + ageDays) * 0.25);
    }
    const score = coverage * 5 + tfScore + titleBonus + phraseBonus + recencyBonus;
    return {
      item,
      score,
      excerpt: excerptAutourDuPremierTerme(text, terms, budget.maxCharsPerResult),
    };
  });

  const selected: SearchHit<T>[] = [];
  let chars = 0;
  for (const hit of scored.sort((a, b) => b.score - a.score)) {
    if (hit.score <= 0 || selected.length >= budget.maxResults) break;
    const cost = hit.excerpt.length + 2;
    if (selected.length && chars + cost > budget.maxChars) break;
    const remaining = budget.maxChars - chars;
    const excerpt = hit.excerpt.slice(0, Math.max(0, remaining));
    if (!excerpt) break;
    selected.push({ ...hit, excerpt });
    chars += excerpt.length + 2;
  }
  return selected;
}
