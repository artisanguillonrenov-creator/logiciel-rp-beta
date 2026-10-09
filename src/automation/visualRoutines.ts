import type { AppSettings, StoryState } from '../types';
import {
  collecterReferencesScene,
  genererImageScene,
  obtenirOuGenererAvatarJoueur,
  obtenirOuGenererAvatarPnj,
} from '../engine/images';
import { demanderDirectionArtistique, textesNarratifsEtablis } from '../engine/directionArtistique';
import { construireContexteNarrateurPourIllustration } from '../engine/generateTurn';
import { appliquerModeRegeneration, consoliderAvecEtatVisuel } from '../engine/visualBible';
import {
  ajouterSceneIllustree,
  appliquerChangementsVisuels,
  lireEtatVisuel,
  listerPnjVisuels,
  resoudrePersonnagesVisibles,
  type EtatVisuelHistoire,
  type ModeIllustration,
  type SceneIllustree,
} from '../engine/visualState';
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

const MODES_ILLUSTRATION: readonly ModeIllustration[] = [
  'nouvelle', 'regenerer', 'autre-cadrage', 'autre-angle', 'autre-composition',
];

export interface VisualAutomationDeps {
  getSettings(): Promise<AppSettings>;
  getStory(id: string): Promise<StoryState | null>;
  updateStoryIf(
    id: string,
    predicate: (story: StoryState) => boolean,
    updater: (story: StoryState) => StoryState,
  ): Promise<StoryState | null>;
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

  const pnj = listerPnjVisuels(story).find((entree) => entree.id === assetId || entree.alias?.includes(assetId));
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
  // sans perdre le portrait précédent si la génération échoue.
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

/**
 * Pipeline V2 d'une illustration de scène :
 * état narratif + état visuel + personnages visibles + références de scènes récentes
 * → direction artistique (modèle narratif) → prompt structuré → image 16:9
 * → mise à jour de l'état visuel → conservation de toutes les scènes.
 *
 * Une régénération (mode ≠ 'nouvelle') réutilise le canon visuel enregistré
 * pour cette révision : mêmes personnages, apparences, lieu et moment ; seule
 * la mise en scène change et l'état visuel n'est pas réanalysé.
 */
async function genererScene(
  story: StoryState,
  settings: AppSettings,
  mode: ModeIllustration,
  deps: VisualAutomationDeps,
): Promise<string> {
  verifierCapaciteImages(settings);
  const revision = calculerRevisionNarrative(story);
  const etatInitial = lireEtatVisuel(story);
  const existante = etatInitial.scenesIllustrees.find((scene) => scene.revision === revision);
  const precedentes = etatInitial.scenesIllustrees.filter((scene) => scene.revision !== revision);

  let etat: EtatVisuelHistoire;
  let scene: SceneIllustree;
  if (mode !== 'nouvelle' && existante) {
    const variante = existante.regenerations + 1;
    etat = etatInitial;
    scene = {
      ...existante,
      // Les identités sont re-résolues pour retrouver un avatar créé depuis.
      personnagesVisibles: resoudrePersonnagesVisibles(story, existante.personnagesVisibles.map((p) => p.nom)),
      structure: appliquerModeRegeneration(existante.structure, mode, variante),
      regenerations: variante,
      creeLe: Date.now(),
    };
  } else {
    // Même contexte que pour répondre au joueur ; sans lui (lore ou
    // embeddings indisponibles), la direction garde son contexte propre.
    const contexteNarrateur = await construireContexteNarrateurPourIllustration(story, settings).catch(() => undefined);
    const direction = await demanderDirectionArtistique(story, settings, undefined, contexteNarrateur);
    const resultat = appliquerChangementsVisuels(
      etatInitial,
      direction.changements,
      textesNarratifsEtablis(story, etatInitial.derniereAnalyseIndex),
      story.messages.length,
      (nom) => resoudrePersonnagesVisibles(story, [nom])[0]?.assetId,
    );
    etat = { ...resultat.etat, derniereAnalyseIndex: story.messages.length };
    scene = {
      revision,
      messageIndex: story.messages.length,
      creeLe: Date.now(),
      profil: direction.structure.profil,
      personnagesVisibles: direction.visibles,
      structure: consoliderAvecEtatVisuel(direction.structure, etat),
      regenerations: 0,
    };
  }

  const references = await collecterReferencesScene(story, scene.personnagesVisibles, precedentes);
  const dataUrl = await genererImageScene(scene.structure, references, settings.profilContenu, story.meta.id);

  const uri = await enregistrerIllustrationScene(story.meta.id, revision, dataUrl);

  // Mise à jour inconditionnelle (pas de garde de révision) : l'illustration
  // existe désormais même si le joueur a poursuivi entre-temps, et l'état
  // visuel ne dépend que des événements déjà analysés.
  await deps.updateStoryIf(story.meta.id, () => true, (courante) => {
    const actuel = lireEtatVisuel(courante);
    const base = actuel.sequence > etatInitial.sequence ? actuel : etat;
    return {
      ...courante,
      etatVisuel: {
        ...base,
        sequence: Math.max(actuel.sequence, etat.sequence) + 1,
        scenesIllustrees: ajouterSceneIllustree(actuel.scenesIllustrees, scene).scenes,
      },
    };
  });
  return uri;
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

export async function enqueueVisualSceneGeneration(
  story: StoryState,
  mode: ModeIllustration = 'nouvelle',
): Promise<void> {
  const revision = calculerRevisionNarrative(story);
  const forceToken = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await enqueueAutomation('visual.scene.generate', {
    storyId: story.meta.id,
    dedupeKey: cleDedupeScene(story, forceToken),
    payload: { revision, mode },
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
      const mode = MODES_ILLUSTRATION.find((m) => m === job.payload?.mode) ?? 'nouvelle';
      const uri = await genererScene(story, await deps.getSettings(), mode, deps);
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
