import type {
  DiagnosticAppelEmbeddings,
  DiagnosticAppelIA,
  DiagnosticEtape,
  DiagnosticStatut,
  DiagnosticTour,
} from '../types';
import { definirLecteurTourCourant } from './journalDiagnostic';

/**
 * Instrumentation passive du pipeline narratif.
 *
 * Un seul tour joueur est généré à la fois dans l'UI actuelle. Le contexte
 * actif sert uniquement à agréger les mesures émises par les couches réseau
 * (LLM / embeddings) sans modifier leurs résultats ni leurs décisions.
 */
let courant: DiagnosticTour | null = null;
let histoireDuTour: string | undefined;
definirLecteurTourCourant(() => (courant ? { id: courant.id, storyId: histoireDuTour } : undefined));

function entier(valeur: unknown): number {
  const n = typeof valeur === 'number' ? valeur : Number(valeur);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function commencerDiagnosticTour(id?: string, storyId?: string): DiagnosticTour {
  histoireDuTour = storyId;
  const diagnostic: DiagnosticTour = {
    id: id ?? `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: Date.now(),
    dureeTotaleMs: 0,
    etapes: [],
    appelsIA: [],
    embeddings: [],
  };
  courant = diagnostic;
  return diagnostic;
}

export function ajouterEtapeDiagnostic(
  nom: string,
  categorie: string,
  statut: DiagnosticStatut,
  dureeMs?: number,
  raison?: string,
  details?: string[],
): void {
  if (!courant) return;
  const etape: DiagnosticEtape = { nom, categorie, statut };
  if (typeof dureeMs === 'number') etape.dureeMs = Math.max(0, Math.round(dureeMs));
  if (raison) etape.raison = raison;
  if (details?.length) etape.details = details;
  courant.etapes.push(etape);
}

export async function mesurerEtapeDiagnostic<T>(
  nom: string,
  categorie: string,
  action: () => Promise<T> | T,
  details?: (resultat: T) => string[],
): Promise<T> {
  const debut = Date.now();
  try {
    const resultat = await action();
    ajouterEtapeDiagnostic(nom, categorie, 'ok', Date.now() - debut, undefined, details?.(resultat));
    return resultat;
  } catch (erreur) {
    ajouterEtapeDiagnostic(
      nom,
      categorie,
      'erreur',
      Date.now() - debut,
      erreur instanceof Error ? erreur.message : 'Erreur inconnue',
    );
    throw erreur;
  }
}

export function enregistrerAppelIADiagnostic(params: {
  composant: string;
  modele: string;
  maxTokens: number;
  dureeMs: number;
  usage: any;
  statut?: DiagnosticStatut;
  raison?: string;
}): void {
  if (!courant) return;
  const usage = params.usage;
  const inputTokens = entier(usage?.input_tokens ?? usage?.prompt_tokens ?? usage?.inputTokens);
  const cachedInputTokens = entier(
    usage?.cached_input_tokens ?? usage?.cachedInputTokens ?? usage?.prompt_tokens_details?.cached_tokens,
  );
  const outputTokens = entier(usage?.output_tokens ?? usage?.completion_tokens ?? usage?.outputTokens);
  const reasoningTokens = entier(
    usage?.reasoning_output_tokens ?? usage?.reasoningOutputTokens ?? usage?.completion_tokens_details?.reasoning_tokens,
  );
  const totalTokens = entier(usage?.total_tokens ?? usage?.totalTokens) || inputTokens + outputTokens;
  const appel: DiagnosticAppelIA = {
    composant: params.composant,
    modele: params.modele,
    maxTokens: params.maxTokens,
    dureeMs: Math.max(0, Math.round(params.dureeMs)),
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
    usageComplet: !!usage && typeof usage === 'object',
    statut: params.statut ?? 'ok',
  };
  if (params.raison) appel.raison = params.raison;
  courant.appelsIA.push(appel);
}

export function enregistrerEmbeddingsDiagnostic(params: {
  composant: string;
  textes: number;
  lots: number;
  dureeMs: number;
  statut?: DiagnosticStatut;
  raison?: string;
}): void {
  if (!courant) return;
  const appel: DiagnosticAppelEmbeddings = {
    composant: params.composant,
    textes: params.textes,
    lots: params.lots,
    dureeMs: Math.max(0, Math.round(params.dureeMs)),
    statut: params.statut ?? 'ok',
  };
  if (params.raison) appel.raison = params.raison;
  courant.embeddings.push(appel);
}

export function terminerDiagnosticTour(): DiagnosticTour | undefined {
  if (!courant) return undefined;
  courant.dureeTotaleMs = Math.max(0, Date.now() - courant.startedAt);
  const resultat = courant;
  courant = null;
  return resultat;
}

export function annulerDiagnosticTour(): void {
  courant = null;
}
