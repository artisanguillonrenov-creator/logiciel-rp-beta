import type { NarrativeContextBudget } from './types';

/**
 * Budgets en caractères : indépendants du tokenizer/fournisseur.
 * L'objectif est ~1 200-2 000 tokens d'entrée utile selon langue/modèle,
 * et non une fenêtre fixe gonflée par toute l'histoire.
 */
export const DEFAULT_CONTEXT_BUDGET: NarrativeContextBudget = {
  identityChars: 850,
  stateChars: 1100,
  historyChars: 1500,
  loreChars: 1800,
  recentChars: 1800,
  playerChars: 1600,
};

export function truncateContext(text: string | undefined, maxChars: number): string {
  const value = (text ?? '').trim();
  if (value.length <= maxChars) return value;
  if (maxChars <= 1) return value.slice(0, Math.max(0, maxChars));
  return `${value.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 3.2);
}

export function contextBudgetReport(budget: NarrativeContextBudget = DEFAULT_CONTEXT_BUDGET) {
  const chars = Object.values(budget).reduce((sum, n) => sum + n, 0);
  return { chars, estimatedTokens: estimateTokensFromChars(chars) };
}
