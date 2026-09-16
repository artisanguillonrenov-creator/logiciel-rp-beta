import type { StoryState } from '../types';
import { calculerRevisionNarrative } from './storyRevision';

export interface NarrativeStorySavedEvent {
  storyId: string;
  revision: string;
  story: StoryState;
}

type Listener = (event: NarrativeStorySavedEvent) => void;

const listeners = new Set<Listener>();
const lastPublishedRevision = new Map<string, string>();

/**
 * Publie uniquement quand le contenu narratif change réellement. Une
 * réaction, un pin ou un renommage ne déclenche donc pas une nouvelle
 * analyse mémoire/monde/social inutile.
 */
export function publierSauvegardeNarrative(story: StoryState): void {
  const revision = calculerRevisionNarrative(story);
  if (lastPublishedRevision.get(story.meta.id) === revision) return;
  lastPublishedRevision.set(story.meta.id, revision);
  const event: NarrativeStorySavedEvent = { storyId: story.meta.id, revision, story };
  for (const listener of listeners) {
    try { listener(event); } catch { /* un observateur ne doit jamais casser la sauvegarde */ }
  }
}

export function abonnerSauvegardesNarratives(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reinitialiserStoryEventsPourTests(): void {
  listeners.clear();
  lastPublishedRevision.clear();
}
