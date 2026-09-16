import type { StoryState } from '../types';
import { calculerRevisionNarrative } from './storyRevision';

export interface StorySavedEvent {
  storyId: string;
  story: StoryState;
}

export interface NarrativeStorySavedEvent extends StorySavedEvent {
  revision: string;
}

type StoryListener = (event: StorySavedEvent) => void;
type NarrativeListener = (event: NarrativeStorySavedEvent) => void;

const storyListeners = new Set<StoryListener>();
const narrativeListeners = new Set<NarrativeListener>();
const lastPublishedRevision = new Map<string, string>();

/**
 * Événement léger destiné à l'interface. Il est publié à chaque sauvegarde
 * réussie, y compris lorsqu'une modification ne change pas la révision
 * narrative (contexte, épingle, réaction...). Les écrans dérivés peuvent
 * ainsi rester synchronisés sans relire la base en boucle.
 */
export function publierSauvegardeStory(story: StoryState): void {
  const event: StorySavedEvent = { storyId: story.meta.id, story };
  for (const listener of storyListeners) {
    try { listener(event); } catch { /* un observateur UI ne doit jamais casser la sauvegarde */ }
  }
}

export function abonnerSauvegardesStory(listener: StoryListener): () => void {
  storyListeners.add(listener);
  return () => storyListeners.delete(listener);
}

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
  for (const listener of narrativeListeners) {
    try { listener(event); } catch { /* un observateur ne doit jamais casser la sauvegarde */ }
  }
}

export function abonnerSauvegardesNarratives(listener: NarrativeListener): () => void {
  narrativeListeners.add(listener);
  return () => narrativeListeners.delete(listener);
}

export function reinitialiserStoryEventsPourTests(): void {
  storyListeners.clear();
  narrativeListeners.clear();
  lastPublishedRevision.clear();
}
