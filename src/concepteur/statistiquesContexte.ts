import type { DiagnosticTour, StoryState } from '../types';

export interface StatistiquesContexte {
  echantillon: number;
  p50Ms: number | null;
  p95Ms: number | null;
  toursAvecComptageExact: number;
  toursNonVerifies: number;
  toursAvecRepli: number;
  appelsIA: number;
  sortiesDeclarees: number;
  donneesUsageCompletes: boolean;
}
export function percentile(valeurs: number[], quantile: number): number | null {
  if (!valeurs.length) return null;
  const ordonnees = [...valeurs].sort((a, b) => a - b);
  const indice = Math.max(0, Math.min(ordonnees.length - 1, Math.ceil(quantile * ordonnees.length) - 1));
  return ordonnees[indice];
}

/** Statistiques sur les tours persistés, sans accès au réseau ou au contenu des messages. */
export function analyserSeriesContexte(story: StoryState | null, maximum = 120): StatistiquesContexte {
  const diagnostics: DiagnosticTour[] = story?.messages
    .filter(m => m.role === 'assistant' && m.diagnosticTour)
    .slice(-Math.max(1, Math.floor(maximum)))
    .map(m => m.diagnosticTour!)
    ?? [];
  const durees = diagnostics.map(d => d.dureeTotaleMs).filter(Number.isFinite);
  const longueurs = diagnostics.map(d => d.etapes.find(e => e.nom === 'Contrôle final des longueurs'));
  return {
    echantillon: diagnostics.length,
    p50Ms: percentile(durees, 0.5),
    p95Ms: percentile(durees, 0.95),
    toursAvecComptageExact: longueurs.filter(e => e?.statut === 'ok' && /tokens exacts/.test(e.raison ?? '')).length,
    toursNonVerifies: longueurs.filter(e => !e || e.statut !== 'ok' || !/tokens exacts/.test(e.raison ?? '')).length,
    toursAvecRepli: diagnostics.filter(d => d.etapes.some(e => e.statut === 'repli')).length,
    appelsIA: diagnostics.reduce((sum, d) => sum + d.appelsIA.length, 0),
    sortiesDeclarees: diagnostics.reduce((sum, d) => sum + d.appelsIA.reduce((n, a) => n + a.outputTokens, 0), 0),
    donneesUsageCompletes: diagnostics.every(d => d.appelsIA.every(a => a.usageComplet)),
  };
}
