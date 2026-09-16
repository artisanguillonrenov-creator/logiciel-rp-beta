export type AutomationJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AutomationJob {
  id: string;
  type: string;
  dedupeKey?: string;
  storyId?: string;
  payload?: Record<string, unknown>;
  status: AutomationJobStatus;
  attempts: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  lastError?: string;
}

export interface AutomationJobStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface AutomationJobRepository {
  list(): Promise<AutomationJob[]>;
  enqueue(input: Pick<AutomationJob, 'type' | 'dedupeKey' | 'storyId' | 'payload'>): Promise<AutomationJob>;
  markRunning(id: string): Promise<AutomationJob | null>;
  markCompleted(id: string): Promise<AutomationJob | null>;
  markFailed(id: string, error: string): Promise<AutomationJob | null>;
  retryFailed(): Promise<number>;
  recoverInterrupted(): Promise<number>;
  removeCompleted(olderThanMs?: number): Promise<number>;
  removeByStoryId(storyId: string): Promise<number>;
}

const STORAGE_KEY = '@rp_beta/automation_jobs/v1';

function newId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createAutomationJobRepository(
  storage: AutomationJobStorage,
  now: () => number = () => Date.now(),
): AutomationJobRepository {
  let queue: Promise<unknown> = Promise.resolve();

  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation, operation);
    queue = next.then(() => undefined, () => undefined);
    return next;
  }

  async function readUnsafe(): Promise<AutomationJob[]> {
    const raw = await storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function writeUnsafe(jobs: AutomationJob[]): Promise<void> {
    await storage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }

  function updateJob(jobs: AutomationJob[], id: string, mutate: (job: AutomationJob) => AutomationJob): AutomationJob | null {
    const index = jobs.findIndex((job) => job.id === id);
    if (index < 0) return null;
    const updated = mutate(jobs[index]);
    jobs[index] = updated;
    return updated;
  }

  return {
    list: () => serialized(async () => readUnsafe()),

    enqueue: (input) => serialized(async () => {
      const jobs = await readUnsafe();
      if (input.dedupeKey) {
        const existing = jobs.find(
          (job) => job.dedupeKey === input.dedupeKey && (job.status === 'pending' || job.status === 'running'),
        );
        if (existing) return existing;
      }
      const job: AutomationJob = {
        id: newId(),
        type: input.type,
        dedupeKey: input.dedupeKey,
        storyId: input.storyId,
        payload: input.payload,
        status: 'pending',
        attempts: 0,
        createdAt: now(),
      };
      jobs.push(job);
      await writeUnsafe(jobs);
      return job;
    }),

    markRunning: (id) => serialized(async () => {
      const jobs = await readUnsafe();
      const updated = updateJob(jobs, id, (job) => ({
        ...job,
        status: 'running',
        attempts: job.attempts + 1,
        startedAt: now(),
        finishedAt: undefined,
        lastError: undefined,
      }));
      if (updated) await writeUnsafe(jobs);
      return updated;
    }),

    markCompleted: (id) => serialized(async () => {
      const jobs = await readUnsafe();
      const updated = updateJob(jobs, id, (job) => ({ ...job, status: 'completed', finishedAt: now() }));
      if (updated) await writeUnsafe(jobs);
      return updated;
    }),

    markFailed: (id, error) => serialized(async () => {
      const jobs = await readUnsafe();
      const updated = updateJob(jobs, id, (job) => ({
        ...job,
        status: 'failed',
        finishedAt: now(),
        lastError: error.slice(0, 500),
      }));
      if (updated) await writeUnsafe(jobs);
      return updated;
    }),

    retryFailed: () => serialized(async () => {
      const jobs = await readUnsafe();
      let count = 0;
      const retried = jobs.map((job) => {
        if (job.status !== 'failed') return job;
        count++;
        return {
          ...job,
          status: 'pending' as const,
          startedAt: undefined,
          finishedAt: undefined,
          lastError: undefined,
        };
      });
      if (count > 0) await writeUnsafe(retried);
      return count;
    }),

    recoverInterrupted: () => serialized(async () => {
      const jobs = await readUnsafe();
      let count = 0;
      const recovered = jobs.map((job) => {
        if (job.status !== 'running') return job;
        count++;
        return {
          ...job,
          status: 'pending' as const,
          startedAt: undefined,
          lastError: 'Interrompu lors de la fermeture précédente ; remis en attente.',
        };
      });
      if (count > 0) await writeUnsafe(recovered);
      return count;
    }),

    removeCompleted: (olderThanMs = 24 * 60 * 60 * 1000) => serialized(async () => {
      const jobs = await readUnsafe();
      const threshold = now() - olderThanMs;
      const kept = jobs.filter((job) => job.status !== 'completed' || (job.finishedAt ?? job.createdAt) >= threshold);
      const removed = jobs.length - kept.length;
      if (removed > 0) await writeUnsafe(kept);
      return removed;
    }),

    removeByStoryId: (storyId) => serialized(async () => {
      const jobs = await readUnsafe();
      const kept = jobs.filter((job) => job.storyId !== storyId);
      const removed = jobs.length - kept.length;
      if (removed > 0) await writeUnsafe(kept);
      return removed;
    }),
  };
}
