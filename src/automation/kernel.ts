import type { AppCapabilities } from './capabilities';
import type { AutomationJob } from './jobRepositoryCore';
import { automationJobs } from './jobStore';

export type AutomationHandler = (job: AutomationJob) => Promise<void>;

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
  recoveredJobs: number;
  lastRuns: Record<string, AutomationRunInfo>;
  lastKernelError?: string;
}

const handlers = new Map<string, AutomationHandler>();
const listeners = new Set<() => void>();
let processing: Promise<void> | null = null;
let diagnostics: AutomationDiagnostics = {
  initialized: false,
  capabilities: null,
  pendingJobs: 0,
  runningJobs: 0,
  failedJobs: 0,
  completedJobs: 0,
  recoveredJobs: 0,
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
  const jobs = await automationJobs.list();
  patchDiagnostics({
    pendingJobs: jobs.filter((job) => job.status === 'pending').length,
    runningJobs: jobs.filter((job) => job.status === 'running').length,
    failedJobs: jobs.filter((job) => job.status === 'failed').length,
    completedJobs: jobs.filter((job) => job.status === 'completed').length,
  });
}

export function registerAutomationHandler(type: string, handler: AutomationHandler): () => void {
  handlers.set(type, handler);
  return () => {
    if (handlers.get(type) === handler) handlers.delete(type);
  };
}

export function setAutomationCapabilities(capabilities: AppCapabilities): void {
  patchDiagnostics({ capabilities });
}

/**
 * useSyncExternalStore exige une référence stable tant qu'aucune mutation
 * n'a eu lieu. diagnostics est donc remplacé immuablement par patchDiagnostics
 * et renvoyé tel quel ici.
 */
export function getAutomationDiagnostics(): AutomationDiagnostics {
  return diagnostics;
}

export function subscribeAutomationDiagnostics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function initializeAutomationKernel(): Promise<void> {
  if (diagnostics.initialized) {
    await refreshJobCounts();
    return;
  }
  try {
    const recoveredJobs = await automationJobs.recoverInterrupted();
    await automationJobs.removeCompleted();
    patchDiagnostics({ initialized: true, recoveredJobs, lastKernelError: undefined });
    await refreshJobCounts();
  } catch (error) {
    patchDiagnostics({
      initialized: true,
      lastKernelError: error instanceof Error ? error.message : 'Initialisation des automatismes impossible.',
    });
  }
}

export async function enqueueAutomation(
  type: string,
  options: { dedupeKey?: string; storyId?: string; payload?: Record<string, unknown> } = {},
): Promise<AutomationJob> {
  const job = await automationJobs.enqueue({ type, ...options });
  await refreshJobCounts();
  void processAutomationQueue();
  return job;
}

export async function processAutomationQueue(): Promise<void> {
  if (processing) return processing;
  processing = (async () => {
    try {
      while (true) {
        const jobs = await automationJobs.list();
        const next = jobs
          .filter((job) => job.status === 'pending')
          .sort((a, b) => a.createdAt - b.createdAt)[0];
        if (!next) break;

        const handler = handlers.get(next.type);
        if (!handler) {
          await automationJobs.markFailed(next.id, `Aucune routine enregistrée pour ${next.type}.`);
          recordRun(next.type, { at: Date.now(), ok: false, error: 'Routine absente.' });
          await refreshJobCounts();
          continue;
        }

        await automationJobs.markRunning(next.id);
        await refreshJobCounts();
        try {
          const running = (await automationJobs.list()).find((job) => job.id === next.id) ?? next;
          await handler(running);
          await automationJobs.markCompleted(next.id);
          recordRun(next.type, { at: Date.now(), ok: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur inconnue.';
          await automationJobs.markFailed(next.id, message);
          recordRun(next.type, { at: Date.now(), ok: false, error: message });
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

export async function retryFailedAutomationJobs(): Promise<number> {
  const jobs = await automationJobs.list();
  const failed = jobs.filter((job) => job.status === 'failed');
  let count = 0;
  for (const job of failed) {
    await automationJobs.enqueue({
      type: job.type,
      dedupeKey: job.dedupeKey ? `${job.dedupeKey}:retry:${Date.now()}:${count}` : undefined,
      storyId: job.storyId,
      payload: job.payload,
    });
    count++;
  }
  await refreshJobCounts();
  void processAutomationQueue();
  return count;
}
