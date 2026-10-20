import type { AppSettings, StoryState } from '../types';
import { avancerHorloge } from '../engine/noyauNarratif';
import { enqueueAutomation, registerAutomationHandler } from './kernel';
import { calculerRattrapageNarratif, besoinRattrapageNarratif } from './narrativePostprocess';
import { calculerRevisionNarrative } from './storyRevision';
import type { NarrativeStorySavedEvent } from './storyEvents';

export {
  besoinRattrapageNarratif,
  calculerRattrapageNarratif,
  type NarrativeDerivedPatch,
} from './narrativePostprocess';

export interface NarrativeAutomationDeps {
  getSettings(): Promise<AppSettings>;
  getStory(id: string): Promise<StoryState | null>;
  getStoryIds(): Promise<string[]>;
  updateStoryIf(
    id: string,
    predicate: (story: StoryState) => boolean,
    updater: (story: StoryState) => StoryState,
  ): Promise<StoryState | null>;
  afterNarrativeUpdate?(story: StoryState): Promise<void> | void;
}

export async function enqueueNarrativePostprocess(event: NarrativeStorySavedEvent): Promise<void> {
  await enqueueAutomation('story.postprocess', {
    storyId: event.storyId,
    dedupeKey: `story.postprocess:${event.storyId}:${event.revision}`,
    payload: { revision: event.revision },
  });
}

export function registerNarrativeAutomationHandlers(deps: NarrativeAutomationDeps): () => void {
  return registerAutomationHandler('story.postprocess', async (job) => {
    if (!job.storyId) return;
    const revision = typeof job.payload?.revision === 'string' ? job.payload.revision : '';
    if (!revision) return;

    const snapshot = await deps.getStory(job.storyId);
    if (!snapshot || calculerRevisionNarrative(snapshot) !== revision) return;

    const patch = await calculerRattrapageNarratif(snapshot, await deps.getSettings());
    if (!patch) return;
    const { diagnosticPostTraitement, minutesEcoulees, ...etatPatch } = patch;

    const miseAJour = await deps.updateStoryIf(
      job.storyId,
      (courante) => calculerRevisionNarrative(courante) === revision,
      (courante) => {
        let diagnosticAttache = false;
        const messages = [...courante.messages].reverse().map((message) => {
          if (!diagnosticAttache && message.role === 'assistant' && message.diagnosticTour && diagnosticPostTraitement) {
            diagnosticAttache = true;
            return {
              ...message,
              diagnosticTour: { ...message.diagnosticTour, postTraitement: diagnosticPostTraitement },
            };
          }
          return message;
        }).reverse();
        // L'horloge du noyau V12 avance du temps relevé avec l'état de scène.
        let narrativeCore = courante.narrativeCore;
        if (narrativeCore && minutesEcoulees) {
          narrativeCore = { ...narrativeCore, clock: { ...narrativeCore.clock } };
          avancerHorloge(narrativeCore, minutesEcoulees);
        }
        return { ...courante, ...etatPatch, narrativeCore, messages };
      },
    );
    if (miseAJour) await deps.afterNarrativeUpdate?.(miseAJour);
  });
}

export async function enqueueNarrativeCatchupOnStartup(deps: NarrativeAutomationDeps): Promise<number> {
  const ids = await deps.getStoryIds();
  let enqueued = 0;
  for (const id of ids) {
    const story = await deps.getStory(id);
    if (!story || !besoinRattrapageNarratif(story)) continue;
    await enqueueNarrativePostprocess({
      storyId: id,
      revision: calculerRevisionNarrative(story),
      story,
    });
    enqueued++;
  }
  return enqueued;
}
