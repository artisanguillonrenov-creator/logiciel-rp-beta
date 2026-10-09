import type { DiagnosticTour, StoryState } from '../types';
import { RESPONSABILITES_NARRATIVES } from '../engine/narrativeBehaviorKernel';
import type { ConfigurationAtelier } from './configuration';
import { creerInstantaneAtelier } from './configuration';

export interface EtatExecutionMoteur {
  id: string;
  nom: string;
  dernierTour: 'mobilise' | 'non_mobilise' | 'non_mesure';
  raison: string;
}
export interface ResumeDiagnosticAtelier {
  disponible: boolean;
  date: number | null;
  dureeMs: number | null;
  appelsIA: number;
  tokensEntree: number;
  tokensSortie: number;
  tokensTotal: number;
  etapes: Array<{ nom: string; categorie: string; statut: string; dureeMs: number | null }>;
  moteurs: EtatExecutionMoteur[];
}
const traceContrat = (d: DiagnosticTour) =>
  d.etapes.find((e) => e.nom.startsWith('Méta-moteurs V2.1') && e.statut === 'ok');

/** Résumé purement technique ; pas de prompt, message ou identité de personnage. */
export function resumerDiagnosticAtelier(story: StoryState | null): ResumeDiagnosticAtelier {
  const message = story?.messages.slice().reverse().find((m) => m.role === 'assistant' && m.diagnosticTour);
  const diagnostic = message?.diagnosticTour;
  const contrat = diagnostic ? traceContrat(diagnostic) : null;
  const lignes = contrat?.details ?? [];
  const moteurs = RESPONSABILITES_NARRATIVES.map((m): EtatExecutionMoteur => {
    if (!contrat) return { ...m, dernierTour: 'non_mesure', raison: 'Aucune trace de contrat V2.1.' };
    const info = lignes.find((x) => x.startsWith(m.id + ' '));
    return { ...m, dernierTour: info ? 'mobilise' : 'non_mobilise',
      raison: info ? info.slice(m.id.length + 1, 160) : 'Condition de mobilisation non remplie.' };
  });
  const appels = diagnostic?.appelsIA ?? [];
  return {
    disponible: !!diagnostic,
    date: diagnostic?.startedAt ?? null,
    dureeMs: diagnostic?.dureeTotaleMs ?? null,
    appelsIA: appels.length,
    tokensEntree: appels.reduce((n, a) => n + a.inputTokens, 0),
    tokensSortie: appels.reduce((n, a) => n + a.outputTokens, 0),
    tokensTotal: appels.reduce((n, a) => n + a.totalTokens, 0),
    etapes: (diagnostic?.etapes ?? []).map((e) => ({
      nom: e.nom, categorie: e.categorie, statut: e.statut, dureeMs: e.dureeMs ?? null,
    })),
    moteurs,
  };
}

export interface RapportAuditAtelier {
  format: 'elyndor-audit-technique';
  schema: 1;
  genereLe: string;
  configuration: ReturnType<typeof creerInstantaneAtelier>;
  histoires: { nombre: number; derniereHistoireAvecDiagnostic: boolean };
  dernierTour: ResumeDiagnosticAtelier;
  avertissement: string;
}
export function creerRapportAuditAtelier(params: {
  configuration: ConfigurationAtelier;
  version: string;
  commitBundle: string;
  nombreHistoires: number;
  dernierTour: ResumeDiagnosticAtelier;
  date?: Date;
}): RapportAuditAtelier {
  const date = params.date ?? new Date();
  return {
    format: 'elyndor-audit-technique',
    schema: 1,
    genereLe: date.toISOString(),
    configuration: creerInstantaneAtelier(params.configuration, params.version, params.commitBundle, date),
    histoires: { nombre: params.nombreHistoires, derniereHistoireAvecDiagnostic: params.dernierTour.disponible },
    dernierTour: params.dernierTour,
    avertissement: 'Statistiques techniques uniquement : aucune conversation, clé API, endpoint privé ou donnée personnelle exportée.',
  };
}
