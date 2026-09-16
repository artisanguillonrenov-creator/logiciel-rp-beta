import { supprimerAvatarsHistoire, supprimerAvatarsOrphelins } from '../storage/pnjAvatarsStore';
import { supprimerIllustrationsHistoire, supprimerIllustrationsOrphelines } from '../storage/sceneImagesStore';
import {
  enqueueAutomation,
  listAutomationJobs,
  registerAutomationHandler,
  removeAutomationJobsForStory,
} from './kernel';
import { listerStoryIdsOrphelins } from './lifecyclePlanning';

export interface LifecycleAutomationDeps {
  getStoryIds(): Promise<string[]>;
}

export async function nettoyerDonneesDeriveesHistoire(storyId: string): Promise<void> {
  const resultats = await Promise.allSettled([
    supprimerAvatarsHistoire(storyId),
    supprimerIllustrationsHistoire(storyId),
  ]);
  const erreur = resultats.find((resultat): resultat is PromiseRejectedResult => resultat.status === 'rejected');
  if (erreur) throw erreur.reason;
}

export async function enqueueStoryCleanup(storyId: string): Promise<void> {
  await enqueueAutomation('maintenance.story.cleanup', {
    storyId,
    dedupeKey: `maintenance.story.cleanup:${storyId}`,
  });
}

export async function enqueueLifecycleSweep(): Promise<void> {
  await enqueueAutomation('maintenance.orphans.sweep', {
    dedupeKey: 'maintenance.orphans.sweep',
  });
}

export function registerLifecycleAutomationHandlers(deps: LifecycleAutomationDeps): () => void {
  const unregisterStoryCleanup = registerAutomationHandler('maintenance.story.cleanup', async (job) => {
    if (!job.storyId) return;
    await nettoyerDonneesDeriveesHistoire(job.storyId);
  });

  const unregisterSweep = registerAutomationHandler('maintenance.orphans.sweep', async () => {
    const storyIdsValides = await deps.getStoryIds();
    await Promise.all([
      supprimerAvatarsOrphelins(storyIdsValides),
      supprimerIllustrationsOrphelines(storyIdsValides),
    ]);

    const jobs = await listAutomationJobs();
    for (const storyId of listerStoryIdsOrphelins(jobs, storyIdsValides)) {
      await removeAutomationJobsForStory(storyId);
    }
  });

  return () => {
    unregisterSweep();
    unregisterStoryCleanup();
  };
}
