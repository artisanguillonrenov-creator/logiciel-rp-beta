import type { AppCapabilities } from './capabilities';
import type { AutomationJob, AutomationJobRepository } from './jobRepositoryCore';

export interface AutomationHandlerContext {
  /** Déclenché au dépassement du délai maximum : la file n'attend plus le handler. */
  signal: AbortSignal;
}

export type AutomationHandler = (job: AutomationJob, context: AutomationHandlerContext) => Promise<void>;

export type AutomationLane = 'texte' | 'image';

export interface AutomationRunInfo {
  at: number;
  ok: boolean;
  error?: string;
}

export interface AutomationDiagnostics {
  initialized: boolean;
  capabilities: AppCapabilities | null;
  pendingJobs: number;
  runningJobs: number;
  failedJobs: number;
  completedJobs: number;
  /** Tâches en attente d'une relance automatique programmée (incluses dans pendingJobs). */
  retryingJobs: number;
  recoveredJobs: number;
  purgedFailedJobs: number;
  lastRuns: Record<string, AutomationRunInfo>;
  lastKernelError?: string;
}

export const DELAI_MAX_TACHE_TEXTE_MS = 3 * 60 * 1000;
export const DELAI_MAX_TACHE_IMAGE_MS = 5 * 60 * 1000;
export const TENTATIVES_MAX_TACHE = 3;
/** Délai avant la 2e puis la 3e tentative. */
export const DELAIS_RELANCE_MS: readonly number[] = [30 * 1000, 2 * 60 * 1000];
export const CONSERVATION_ECHECS_MS = 7 * 24 * 60 * 60 * 1000;

export function fileDeTache(type: string): AutomationLane {
  return type.startsWith('visual.') ? 'image' : 'texte';
}

export function delaiMaxTache(type: string): number {
  return fileDeTache(type) === 'image' ? DELAI_MAX_TACHE_IMAGE_MS : DELAI_MAX_TACHE_TEXTE_MS;
}

export interface AutomationKernelOptions {
  now?: () => number;
  /** Programme un rappel ; renvoie la fonction d'annulation. Injectable pour les tests. */
  setTimer?: (callback: () => void, ms: number) => () => void;
  delaiMax?: (type: string) => number;
  tentativesMax?: number;
  delaisRelance?: readonly number[];
}

class DelaiDepasseError extends Error {}

function minutes(ms: number): string {
  const valeur = ms / 60000;
  return Number.isInteger(valeur) ? `${valeur} min` : `${Math.round(ms / 1000)} s`;
}

function timerParDefaut(callback: () => void, ms: number): () => void {
  const id = setTimeout(callback, ms);
  return () => clearTimeout(id);
}

export function createAutomationKernel(repository: AutomationJobRepository, options: AutomationKernelOptions = {}) {
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? timerParDefaut;
  const delaiMax = options.delaiMax ?? delaiMaxTache;
  const tentativesMax = options.tentativesMax ?? TENTATIVES_MAX_TACHE;
  const delaisRelance = options.delaisRelance ?? DELAIS_RELANCE_MS;

  const handlers = new Map<string, AutomationHandler>();
  const listeners = new Set<() => void>();
  let processing: Promise<void> | null = null;
  let annulerRelance: (() => void) | null = null;
  let diagnostics: AutomationDiagnostics = {
    initialized: false,
    capabilities: null,
    pendingJobs: 0,
    runningJobs: 0,
    failedJobs: 0,
    completedJobs: 0,
    retryingJobs: 0,
    recoveredJobs: 0,
    purgedFailedJobs: 0,
    lastRuns: {},
  };

  function notify(): void {
    for (const listener of listeners) {
      try { listener(); } catch { /* diagnostic listener only */ }
    }
  }

  function patchDiagnostics(patch: Partial<AutomationDiagnostics>): void {
    diagnostics = { ...diagnostics, ...patch };
    notify();
  }

  function recordRun(type: string, info: AutomationRunInfo): void {
    patchDiagnostics({ lastRuns: { ...diagnostics.lastRuns, [type]: info } });
  }

  async function refreshJobCounts(): Promise<void> {
    const jobs = await repository.list();
    patchDiagnostics({
      pendingJobs: jobs.filter((job) => job.status === 'pending').length,
      runningJobs: jobs.filter((job) => job.status === 'running').length,
      failedJobs: jobs.filter((job) => job.status === 'failed').length,
      completedJobs: jobs.filter((job) => job.status === 'completed').length,
      retryingJobs: jobs.filter((job) => job.status === 'pending' && job.nextAttemptAt !== undefined).length,
    });
  }

  function executerAvecDelai(handler: AutomationHandler, job: AutomationJob): Promise<void> {
    const limite = delaiMax(job.type);
    const controleur = new AbortController();
    return new Promise<void>((resolve, reject) => {
      let regle = false;
      const annulerDelai = setTimer(() => {
        if (regle) return;
        regle = true;
        controleur.abort();
        reject(new DelaiDepasseError(
          `Délai maximum dépassé (${minutes(limite)}) : la routine ${job.type} a été interrompue pour laisser avancer la file.`,
        ));
      }, limite);
      let execution: Promise<void>;
      try {
        execution = handler(job, { signal: controleur.signal });
      } catch (error) {
        execution = Promise.reject(error);
      }
      execution.then(
        () => {
          if (regle) return;
          regle = true;
          annulerDelai();
          resolve();
        },
        (error) => {
          if (regle) return;
          regle = true;
          annulerDelai();
          reject(error);
        },
      );
    });
  }

  async function traiterEchec(job: AutomationJob, message: string): Promise<void> {
    if (job.attempts < tentativesMax) {
      const delai = delaisRelance[Math.min(job.attempts - 1, delaisRelance.length - 1)] ?? 0;
      await repository.scheduleRetry(job.id, message, now() + delai);
    } else {
      await repository.markFailed(job.id, `${message} (échec définitif après ${job.attempts} tentative(s))`);
    }
  }

  function programmerProchaineRelance(jobs: readonly AutomationJob[]): void {
    annulerRelance?.();
    annulerRelance = null;
    const prochaine = jobs
      .filter((job) => job.status === 'pending' && job.nextAttemptAt !== undefined)
      .reduce<number | null>((min, job) => (min === null || job.nextAttemptAt! < min ? job.nextAttemptAt! : min), null);
    if (prochaine === null) return;
    annulerRelance = setTimer(() => {
      annulerRelance = null;
      // Le passage courant peut être en train de se terminer : on enchaîne
      // après lui pour ne jamais perdre la relance.
      void (processing ?? Promise.resolve()).then(() => processAutomationQueue());
    }, Math.max(0, prochaine - now()));
  }

  function registerAutomationHandler(type: string, handler: AutomationHandler): () => void {
    handlers.set(type, handler);
    return () => {
      if (handlers.get(type) === handler) handlers.delete(type);
    };
  }

  function setAutomationCapabilities(capabilities: AppCapabilities): void {
    patchDiagnostics({ capabilities });
  }

  function getAutomationDiagnostics(): AutomationDiagnostics {
    return diagnostics;
  }

  function subscribeAutomationDiagnostics(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function initializeAutomationKernel(): Promise<void> {
    if (diagnostics.initialized) {
      await refreshJobCounts();
      return;
    }
    try {
      const recoveredJobs = await repository.recoverInterrupted();
      await repository.removeCompleted();
      const purgedFailedJobs = await repository.removeFailed(CONSERVATION_ECHECS_MS);
      patchDiagnostics({ initialized: true, recoveredJobs, purgedFailedJobs, lastKernelError: undefined });
      await refreshJobCounts();
    } catch (error) {
      patchDiagnostics({
        initialized: true,
        lastKernelError: error instanceof Error ? error.message : 'Initialisation des automatismes impossible.',
      });
    }
  }

  async function enqueueAutomation(
    type: string,
    enqueueOptions: { dedupeKey?: string; storyId?: string; payload?: Record<string, unknown> } = {},
  ): Promise<AutomationJob> {
    const job = await repository.enqueue({ type, ...enqueueOptions });
    await refreshJobCounts();
    void processAutomationQueue();
    return job;
  }

  async function removeAutomationJobsForStory(storyId: string): Promise<number> {
    const count = await repository.removeByStoryId(storyId);
    await refreshJobCounts();
    return count;
  }

  async function listAutomationJobs(): Promise<AutomationJob[]> {
    return repository.list();
  }

  function processAutomationQueue(): Promise<void> {
    if (processing) return processing;
    processing = (async () => {
      try {
        while (true) {
          const jobs = await repository.list();
          const instant = now();
          const next = jobs
            .filter((job) => job.status === 'pending' && (job.nextAttemptAt ?? 0) <= instant)
            .sort((a, b) => a.createdAt - b.createdAt)[0];
          if (!next) {
            programmerProchaineRelance(jobs);
            break;
          }

          const handler = handlers.get(next.type);
          if (!handler) {
            await repository.markFailed(next.id, `Aucune routine enregistrée pour ${next.type}.`);
            recordRun(next.type, { at: now(), ok: false, error: 'Routine absente.' });
            await refreshJobCounts();
            continue;
          }

          const running = (await repository.markRunning(next.id)) ?? next;
          await refreshJobCounts();
          try {
            await executerAvecDelai(handler, running);
            await repository.markCompleted(next.id);
            recordRun(next.type, { at: now(), ok: true });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Erreur inconnue.';
            await traiterEchec(running, message);
            recordRun(next.type, { at: now(), ok: false, error: message });
          }
          await refreshJobCounts();
        }
      } catch (error) {
        patchDiagnostics({ lastKernelError: error instanceof Error ? error.message : 'File des automatismes interrompue.' });
      } finally {
        processing = null;
      }
    })();
    return processing;
  }

  async function retryFailedAutomationJobs(): Promise<number> {
    const count = await repository.retryFailed();
    await refreshJobCounts();
    void processAutomationQueue();
    return count;
  }

  return {
    registerAutomationHandler,
    setAutomationCapabilities,
    getAutomationDiagnostics,
    subscribeAutomationDiagnostics,
    initializeAutomationKernel,
    enqueueAutomation,
    removeAutomationJobsForStory,
    listAutomationJobs,
    processAutomationQueue,
    retryFailedAutomationJobs,
  };
}

export type AutomationKernel = ReturnType<typeof createAutomationKernel>;
