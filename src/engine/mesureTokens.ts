import type { UsageTokens } from '../types';

export type { UsageTokens };

// Compteur de consommation d'un tour (repris de la V13) : chaque appel de
// chat ajoute l'usage renvoyé par le fournisseur à la mesure en cours, que
// genererTour/genererMessageOuverture ouvrent puis ferment autour du tour.
//
// Mesure globale plutôt que passée de fonction en fonction : les appels
// partent de nombreux méta-moteurs (validateur, réparation…). Contrepartie
// assumée : une routine d'arrière-plan qui appellerait le modèle pendant le
// tour serait comptée avec lui.

let courante: UsageTokens | null = null;

function entier(valeur: unknown): number {
  const n = typeof valeur === 'number' ? valeur : Number(valeur);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// Accepte les deux conventions (OpenAI « prompt/completion », Responses
// « input/output ») et leurs détails de cache et de raisonnement.
function lireUsage(usage: any): Omit<UsageTokens, 'apiCalls' | 'complete'> | null {
  if (!usage || typeof usage !== 'object') return null;
  const inputTokens = entier(usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens);
  const cachedInputTokens = entier(usage.cached_input_tokens ?? usage.cachedInputTokens ?? usage.prompt_tokens_details?.cached_tokens);
  const outputTokens = entier(usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens);
  const reasoningTokens = entier(usage.reasoning_output_tokens ?? usage.reasoningOutputTokens ?? usage.completion_tokens_details?.reasoning_tokens);
  const totalTokens = entier(usage.total_tokens ?? usage.totalTokens) || inputTokens + outputTokens;
  if (!inputTokens && !outputTokens && !totalTokens && !cachedInputTokens && !reasoningTokens) return null;
  return { inputTokens, cachedInputTokens, outputTokens, reasoningTokens, totalTokens };
}

export function commencerMesureTokens(): void {
  courante = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0, apiCalls: 0, complete: true };
}

export function enregistrerUsageAppel(usage: unknown): void {
  if (!courante) return;
  courante.apiCalls += 1;
  const lu = lireUsage(usage);
  if (!lu) {
    courante.complete = false;
    return;
  }
  courante.inputTokens += lu.inputTokens;
  courante.cachedInputTokens += lu.cachedInputTokens;
  courante.outputTokens += lu.outputTokens;
  courante.reasoningTokens += lu.reasoningTokens;
  courante.totalTokens += lu.totalTokens;
}

export function enregistrerAppelSansUsage(): void {
  enregistrerUsageAppel(null);
}

/** Ferme la mesure ; undefined si aucun appel n'a eu lieu. */
export function terminerMesureTokens(): UsageTokens | undefined {
  const resultat = courante && courante.apiCalls > 0 ? { ...courante } : undefined;
  courante = null;
  return resultat;
}

export function annulerMesureTokens(): void {
  courante = null;
}

/** Cumul de tous les tours mesurés d'une histoire (exports). */
export function cumulerUsages(usages: (UsageTokens | undefined)[]): UsageTokens & { toursPartiels: number } {
  const total = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0, apiCalls: 0, complete: true, toursPartiels: 0 };
  for (const u of usages) {
    if (!u) continue;
    total.inputTokens += u.inputTokens;
    total.cachedInputTokens += u.cachedInputTokens;
    total.outputTokens += u.outputTokens;
    total.reasoningTokens += u.reasoningTokens;
    total.totalTokens += u.totalTokens;
    total.apiCalls += u.apiCalls;
    if (!u.complete) {
      total.complete = false;
      total.toursPartiels += 1;
    }
  }
  return total;
}
