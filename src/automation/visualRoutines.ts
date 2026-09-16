import type { AppSettings, StoryState } from '../types';
import {
  genererImageScene,
  obtenirOuGenererAvatarJoueur,
  obtenirOuGenererAvatarPnj,
  obtenirPortraitReferenceJoueur,
  obtenirPromptScene,
  pnjMentionneDansTexte,
} from '../engine/images';
import {
  enregistrerAvatarPnj,
  obtenirAvatarPnj,
  preparerImageReference,
  supprimerAvatarPnj,
} from '../storage/pnjAvatarsStore';
import { enregistrerIllustrationScene } from '../storage/sceneImagesStore';
import { calculerCapacites } from './capabilities';
import { enqueueAutomation, registerAutomationHandler } from './kernel';
import { calculerRevisionNarrative } from './storyRevision';
import {
  ID_AVATAR_JOUEUR_VISUEL,
  cleDedupeAvatar,
  cleDedupeScene,
  cleDedupeSynchronisationAvatars,
  listerIdsPnjVisuels,
} from './visualPlanning';
import { publierEvenementVisuel } from './visualEvents';

const MAX_PNJ_REFERENCE_SCENE = 2;

export interface VisualAutomationDeps {
  getSettings(): Promise<AppSettings>;
  getStory(id: string): Promise<StoryState | null>;
}

function verifierCapaciteImages(settings: AppSettings): void {
  const caps = calculerCapacites(settings, { plateforme: 'native' });
  if (!caps.images) throw new Error(caps.raisons.images ?? 'Génération d’images indisponible.');
}

async function genererAvatarSansCache(
  story: StoryState,
  settings: AppSettings,
  assetId: string,
): Promise<string> {
  if (assetId === ID_AVATAR_JOUEUR_VISUEL) {
    return obtenirOuGenererAvatarJoueur(story, settings);
  }

  const pnj = story.loreEmergent.find((entree) => entree.id === assetId && entree.categorie === 'pnj');
  if (!pnj) throw new Error('Ce PNJ n’existe plus dans le lore émergent de cette histoire.');
  return obtenirOuGenererAvatarPnj(story, pnj, settings);
}

async function genererAvatar(
  story: StoryState,
  settings: AppSettings,
  assetId: string,
  force = false,
): Promise<string> {
  verifierCapaciteImages(settings);
  if (!force) return genererAvatarSansCache(story, settings, assetId);

  // Les fonctions historiques de images.ts renvoient le cache s'il existe.
  // Pour une vraie régénération il faut donc le retirer temporairement, mais
  // sans perdre le portrait précédent si l'appel réseau échoue.
  const existant = await obtenirAvatarPnj(story.meta.id, assetId);
  const sauvegarde = existant ? await preparerImageReference(existant) : null;
  if (existant) await supprimerAvatarPnj(story.meta.id, assetId);
  try {
    return await genererAvatarSansCache(story, settings, assetId);
  } catch (error) {
    if (sauvegarde) {
      try { await enregistrerAvatarPnj(story.meta.id, assetId, sauvegarde); } catch { /* erreur d'origine prioritaire */ }
    }
    throw error;
  }
}

async function synchroniserAvatars(story: StoryState, settings: AppSettings): Promise<void> {
  const caps = calculerCapacites(settings, { plateforme: 'native' });
  if (!caps.avatars) return;

  const ids = [ID_AVATAR_JOUEUR_VISUEL, ...listerIdsPnjVisuels(story)];
  for (const assetId of ids) {
    const existant = await obtenirAvatarPnj(story.meta.id, assetId);
    if (existant) {
      publierEvenementVisuel({ type: 'avatar.ready', storyId: story.meta.id, assetId, uri: existant });
      continue;
    }
    try {
      const uri = await genererAvatar(story, settings, assetId, false);
      publierEvenementVisuel({ type: 'avatar.ready', storyId: story.meta.id, assetId, uri });
    } catch (error) {
      publierEvenementVisuel({
        type: 'avatar.error',
        storyId: story.meta.id,
        assetId,
        message: error instanceof Error ? error.message : 'Portrait impossible à générer.',
      });
      // Un portrait en erreur ne doit pas empêcher les autres de passer.
    }
  }
}

async function genererScene(story: StoryState, settings: AppSettings): Promise<string> {
  verifierCapaciteImages(settings);
  const prompt = await obtenirPromptScene(story, settings);
  const portraitReference = await obtenirPortraitReferenceJoueur(story);
  const avatarJoueur = await obtenirAvatarPnj(story.meta.id, ID_AVATAR_JOUEUR_VISUEL);
  const dernierMessageNarrateur = [...story.messages].reverse().find((m) => m.role === 'assistant');
  const texteSceneMinuscule = (dernierMessageNarrateur?.content ?? story.meta.pointDeDepart).toLowerCase();

  const refsPnj: string[] = [];
  for (const pnj of story.loreEmergent
    .filter((entree) => entree.categorie === 'pnj')
    .filter((entree) => pnjMentionneDansTexte(entree, texteSceneMinuscule))) {
    const uri = await obtenirAvatarPnj(story.meta.id, pnj.id);
    if (uri) refsPnj.push(uri);
    if (refsPnj.length >= MAX_PNJ_REFERENCE_SCENE) break;
  }

  const dataUrl = await genererImageScene(
    settings.openRouterApiKey,
    prompt,
    settings.modeleImagesGratuit,
    [portraitReference, avatarJoueur, ...refsPnj],
  );
  const revision = calculerRevisionNarrative(story);
  return enregistrerIllustrationScene(story.meta.id, revision, dataUrl);
}

export async function enqueueVisualAvatarSync(story: StoryState): Promise<void> {
  const revision = calculerRevisionNarrative(story);
  await enqueueAutomation('visual.avatars.sync', {
    storyId: story.meta.id,
    dedupeKey: cleDedupeSynchronisationAvatars(story),
    payload: { revision },
  });
}

export async function enqueueVisualAvatarGeneration(
  story: StoryState,
  assetId: string,
  force = false,
): Promise<void> {
  const revision = calculerRevisionNarrative(story);
  const forceToken = force ? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : undefined;
  await enqueueAutomation('visual.avatar.generate', {
    storyId: story.meta.id,
    dedupeKey: cleDedupeAvatar(story.meta.id, assetId, forceToken),
    payload: { revision, assetId, force },
  });
}

export async function enqueueVisualSceneGeneration(story: StoryState): Promise<void> {
  const revision = calculerRevisionNarrative(story);
  const forceToken = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await enqueueAutomation('visual.scene.generate', {
    storyId: story.meta.id,
    dedupeKey: cleDedupeScene(story, forceToken),
    payload: { revision },
  });
}

export function registerVisualAutomationHandlers(deps: VisualAutomationDeps): () => void {
  const unregisterSync = registerAutomationHandler('visual.avatars.sync', async (job) => {
    if (!job.storyId) return;
    const story = await deps.getStory(job.storyId);
    if (!story) return;
    const revision = typeof job.payload?.revision === 'string' ? job.payload.revision : '';
    if (revision && calculerRevisionNarrative(story) !== revision) return;
    await synchroniserAvatars(story, await deps.getSettings());
  });

  const unregisterAvatar = registerAutomationHandler('visual.avatar.generate', async (job) => {
    if (!job.storyId) return;
    const assetId = typeof job.payload?.assetId === 'string' ? job.payload.assetId : '';
    if (!assetId) return;
    const story = await deps.getStory(job.storyId);
    if (!story) return;
    const revision = typeof job.payload?.revision === 'string' ? job.payload.revision : '';
    if (revision && calculerRevisionNarrative(story) !== revision) {
      publierEvenementVisuel({
        type: 'avatar.error',
        storyId: story.meta.id,
        assetId,
        message: 'Le récit a changé avant la génération du portrait. Relance la demande.',
      });
      return;
    }
    try {
      const uri = await genererAvatar(story, await deps.getSettings(), assetId, job.payload?.force === true);
      publierEvenementVisuel({ type: 'avatar.ready', storyId: story.meta.id, assetId, uri });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Portrait impossible à générer.';
      publierEvenementVisuel({ type: 'avatar.error', storyId: story.meta.id, assetId, message });
      throw error;
    }
  });

  const unregisterScene = registerAutomationHandler('visual.scene.generate', async (job) => {
    if (!job.storyId) return;
    const story = await deps.getStory(job.storyId);
    if (!story) return;
    const revision = typeof job.payload?.revision === 'string' ? job.payload.revision : '';
    if (!revision) return;
    if (calculerRevisionNarrative(story) !== revision) {
      publierEvenementVisuel({
        type: 'scene.error',
        storyId: story.meta.id,
        revision,
        message: 'La scène a changé avant la génération. Relance l’illustration sur la scène actuelle.',
      });
      return;
    }
    try {
      const uri = await genererScene(story, await deps.getSettings());
      publierEvenementVisuel({ type: 'scene.ready', storyId: story.meta.id, revision, uri });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Illustration impossible à générer.';
      publierEvenementVisuel({ type: 'scene.error', storyId: story.meta.id, revision, message });
      throw error;
    }
  });

  return () => {
    unregisterScene();
    unregisterAvatar();
    unregisterSync();
  };
}
