import type { AppSettings, Message, StoryState } from '../types';
import { doitMettreAJourMemoire, mettreAJourMemoire } from '../engine/memory';
import { mettreAJourDirecteur } from '../engine/storyDirector';
import { mettreAJourMonde } from '../engine/worldSimulation';
import { mettreAJourSocial } from '../engine/socialDynamics';
import { mettreAJourLoreEmergent } from '../engine/emergentLore';
import { filtrerTextePourProfil } from '../engine/contenuAdulte';
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
  afterNarrativeUpdate?(story: StoryState): Promise<void> | void;
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

function messagesPourProfil(messages: Message[], appSettings: AppSettings): Message[] {
  if (appSettings.profilContenu === 'adulte') return messages;
  return messages.map((message) => ({
    ...message,
    content: filtrerTextePourProfil(message.content, appSettings.profilContenu)
      || '[Contenu antérieur masqué par le profil Grand public.]',
  }));
}

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

  const messagesSecurises = messagesPourProfil(story.messages, appSettings);
  const personnageNom = filtrerTextePourProfil(story.meta.personnageNom, appSettings.profilContenu) || 'Personnage';

  const periodicPromise = periodicDue
    ? Promise.all([
        mettreAJourMemoire({
          appSettings,
          memoireActuelle: story.memoire,
          messages: messagesSecurises,
          personnageNom,
        }),
        mettreAJourDirecteur({
          appSettings,
          directeurActuel: story.directeur,
          messages: messagesSecurises,
          depuisIndex: story.memoire.dernierMessageIndexMaj,
        }),
        mettreAJourMonde({
          appSettings,
          mondeActuel: story.monde,
          messages: messagesSecurises,
          depuisIndex: story.memoire.dernierMessageIndexMaj,
        }),
        mettreAJourSocial({
          appSettings,
          socialActuel: story.social,
          messages: messagesSecurises,
          depuisIndex: story.memoire.dernierMessageIndexMaj,
        }),
      ])
    : null;

  const lorePromise = loreDue
    ? mettreAJourLoreEmergent({
        appSettings,
        existants: story.loreEmergent,
        messages: messagesSecurises,
        depuisIndex: loreDepuisIndex,
        personnageNom,
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

    const miseAJour = await deps.updateStoryIf(
      job.storyId,
      (courante) => calculerRevisionNarrative(courante) === revision,
      (courante) => ({ ...courante, ...patch }),
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
