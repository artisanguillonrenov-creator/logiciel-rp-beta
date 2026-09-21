export interface UsageTokensMessage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  apiCalls: number;
  complete: boolean;
}

interface Accumulateur extends UsageTokensMessage {}

let actif: Accumulateur | null = null;

function entier(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function extraireUsage(usage: any): Omit<UsageTokensMessage, 'apiCalls' | 'complete'> | null {
  if (!usage || typeof usage !== 'object') return null;
  const inputTokens = entier(usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens);
  const cachedInputTokens = entier(
    usage.cached_input_tokens ?? usage.cachedInputTokens ?? usage.prompt_tokens_details?.cached_tokens,
  );
  const outputTokens = entier(usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens);
  const reasoningTokens = entier(
    usage.reasoning_output_tokens ?? usage.reasoningOutputTokens ?? usage.completion_tokens_details?.reasoning_tokens,
  );
  const reportedTotal = entier(usage.total_tokens ?? usage.totalTokens);
  const totalTokens = reportedTotal || inputTokens + outputTokens;
  if (!inputTokens && !outputTokens && !totalTokens && !cachedInputTokens && !reasoningTokens) return null;
  return { inputTokens, cachedInputTokens, outputTokens, reasoningTokens, totalTokens };
}

export function commencerMesureTokens(): void {
  actif = {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    apiCalls: 0,
    complete: true,
  };
}

/** Enregistre exactement ce que le fournisseur a rapporté pour UN appel LLM. */
export function enregistrerUsageAppel(usage: unknown): void {
  if (!actif) return;
  actif.apiCalls += 1;
  const normalise = extraireUsage(usage);
  if (!normalise) {
    actif.complete = false;
    return;
  }
  actif.inputTokens += normalise.inputTokens;
  actif.cachedInputTokens += normalise.cachedInputTokens;
  actif.outputTokens += normalise.outputTokens;
  actif.reasoningTokens += normalise.reasoningTokens;
  actif.totalTokens += normalise.totalTokens;
}

/** Appel réel sans bloc usage (modèle local ou fournisseur qui ne le rapporte pas). */
export function enregistrerAppelSansUsage(): void {
  if (!actif) return;
  actif.apiCalls += 1;
  actif.complete = false;
}

export function terminerMesureTokens(): UsageTokensMessage | undefined {
  const resultat = actif ? { ...actif } : undefined;
  actif = null;
  return resultat && resultat.apiCalls > 0 ? resultat : undefined;
}

export function annulerMesureTokens(): void {
  actif = null;
}
