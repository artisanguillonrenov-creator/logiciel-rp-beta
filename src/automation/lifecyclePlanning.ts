import type { AutomationJob } from './jobRepositoryCore';

export function listerStoryIdsOrphelins(
  jobs: readonly AutomationJob[],
  storyIdsValides: readonly string[],
): string[] {
  const valides = new Set(storyIdsValides);
  return [...new Set(jobs.map((job) => job.storyId).filter((id): id is string => !!id && !valides.has(id)))];
}
