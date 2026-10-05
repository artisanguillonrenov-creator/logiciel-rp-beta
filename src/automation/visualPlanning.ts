import type { StoryState } from '../types';
import { ID_ASSET_JOUEUR, listerPnjVisuels } from '../engine/visualState';
import { calculerRevisionNarrative } from './storyRevision';

export const ID_AVATAR_JOUEUR_VISUEL = ID_ASSET_JOUEUR;

/** Même critère unique que le prompt et les références (estPnjVisuel). */
export function listerIdsPnjVisuels(story: StoryState): string[] {
  return listerPnjVisuels(story).map((entree) => entree.id);
}

export function cleDedupeSynchronisationAvatars(story: StoryState): string {
  return `visual.avatars.sync:${story.meta.id}:${calculerRevisionNarrative(story)}`;
}

export function cleDedupeAvatar(storyId: string, assetId: string, forceToken?: string): string {
  return forceToken
    ? `visual.avatar.generate:${storyId}:${assetId}:${forceToken}`
    : `visual.avatar.generate:${storyId}:${assetId}`;
}

export function cleDedupeScene(story: StoryState, forceToken?: string): string {
  const revision = calculerRevisionNarrative(story);
  return forceToken
    ? `visual.scene.generate:${story.meta.id}:${revision}:${forceToken}`
    : `visual.scene.generate:${story.meta.id}:${revision}`;
}
