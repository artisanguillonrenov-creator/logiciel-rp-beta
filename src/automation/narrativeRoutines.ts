import type { AppSettings, StoryState } from '../types';
import { doitMettreAJourMemoire, mettreAJourMemoire } from '../engine/memory';
import { mettreAJourDirecteur } from '../engine/storyDirector';
import { mettreAJourMonde } from '../engine/worldSimulation';
import { mettreAJourSocial } from '../engine/socialDynamics';
import { mettreAJourLoreEmergent } from '../engine/emergentLore';
import { enqueueAutomation, registerAutomationHandler } from './kernel';
import { calculerRevisionNarrative } from './storyRevision';
import type { NarrativeStorySavedEvent } from './storyEvents';

export interface NarrativeAutomationDeps {
  getSettings(): Promise<AppSettings>;
  getStory(id: string): Promise<StoryState | null>;
  getStoryIds(): Promise<string[]>;
  updateStoryIf(
    id: string,
    predicate: (story: StoryState) => boolean,
    updater: (story: StoryState) => StoryState,
  ): Promise<StoryState | null>;
}

export type NarrativeDerivedPatch = Pick<
  StoryState,
  'memoire' | 'directeur' | 'monde' | 'social' | 'loreEmergent' | 'loreEmergentDernierIndex'
>;

export function besoinRattrapageNarratif(story: StoryState): boolean {
  return (
    doitMettreAJourMemoire(story.messages, story.memoire.dernierMessageIndexMaj) ||
    (story.loreEmergentDernierIndex ?? 0) < story.messages.length
  );
}

/**
 * Exécute les pipelines dérivés après la sauvegarde du tour. Ils sont donc
 * hors du chemin critique de génération : le joueur peut voir la réponse
 * avant mémoire/directeur/monde/social/lore. La garde de révision empêche
 * ensuite tout résultat calculé sur un transcript ancien d'écraser un tour
 * plus récent.
 */
export async function calculerRattrapageNarratif(
  story: StoryState,
  appSettings: AppSettings,
): Promise<NarrativeDerivedPatch | null> {
  const periodicDue = doitMettreAJourMemoire(story.messages, story.memoire.dernierMessageIndexMaj);
  const loreDepuisIndex = story.loreEmergentDernierIndex ?? 0;
  const loreDue = loreDepuisIndex < story.messages.length;
  if (!periodicDue && !loreDue) return null;

  let memoire = story.memoire;
  let directeur = story.directeur;
  let monde = story.monde;
  let social = story.social;
  let loreEmergent = story.loreEmergent;
  let loreEmergentDernierIndex = loreDepuisIndex;

  const periodicPromise = periodicDue
    ? Promise.all([
        mettreAJourMemoire({
          appSettings,
          memoireActuelle: story.memoire,
          messages: story.messages,
          personnageNom: story.meta.personnageNom,
        }),
        mettreAJourDirecteur({
          appSettings,
          directeurActuel: story.directeur,
          messages: story.messages,
          depuisIndex: story.memoire.dernierMessageIndexMaj,
        }),
        mettreAJourMonde({
          appSettings,
          mondeActuel: story.monde,
          messages: story.messages,
          depuisIndex: story.memoire.dernierMessageIndexMaj,
        }),
        mettreAJourSocial({
          appSettings,
          socialActuel: story.social,
          messages: story.messages,
          depuisIndex: story.memoire.dernierMessageIndexMaj,
        }),
      ])
    : null;

  const lorePromise = loreDue
    ? mettreAJourLoreEmergent({
        appSettings,
        existants: story.loreEmergent,
        messages: story.messages,
        depuisIndex: loreDepuisIndex,
        personnageNom: story.meta.personnageNom,
      })
    : null;

  if (periodicPromise) {
    [memoire, directeur, monde, social] = await periodicPromise;
  }
  if (lorePromise) {
    loreEmergent = await lorePromise;
    loreEmergentDernierIndex = story.messages.length;
  }

  return { memoire, directeur, monde, social, loreEmergent, loreEmergentDernierIndex };
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

    // Double vérification dans la même opération sérialisée que l'écriture :
    // si un nouveau tour ou une édition a eu lieu pendant les appels modèle,
    // les résultats calculés sur l'ancien transcript sont simplement jetés.
    await deps.updateStoryIf(
      job.storyId,
      (courante) => calculerRevisionNarrative(courante) === revision,
      (courante) => ({ ...courante, ...patch }),
    );
  });
}

/** Rattrape au démarrage les histoires qui auraient été fermées avant la fin d'un cycle. */
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
