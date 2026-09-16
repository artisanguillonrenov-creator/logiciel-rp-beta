import type { StoryState } from '../types';
import { calculerRevisionNarrative } from './storyRevision';

export const ID_AVATAR_JOUEUR_VISUEL = '__joueur__';

export function listerIdsPnjVisuels(story: StoryState): string[] {
  const nomJoueur = story.meta.personnageNom.trim().toLowerCase();
  return story.loreEmergent
    .filter((entree) => entree.categorie === 'pnj')
    .filter((entree) => entree.titre.trim().toLowerCase() !== nomJoueur)
    .map((entree) => entree.id);
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
