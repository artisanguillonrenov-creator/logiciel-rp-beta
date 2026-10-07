import type { AppSettings, DiagnosticEtape, DiagnosticPostTraitement, Message, StoryState } from '../types';
import { doitMettreAJourMemoire, mettreAJourMemoire } from '../engine/memory';
import { mettreAJourDirecteur } from '../engine/storyDirector';
import { mettreAJourMonde } from '../engine/worldSimulation';
import { mettreAJourSocial } from '../engine/socialDynamics';
import { mettreAJourLoreEmergent } from '../engine/emergentLore';
import { filtrerTextePourProfil } from '../engine/contenuAdulte';
import { CAPITALES } from '../engine/canonElyndor';
import { avancerHorloge } from '../engine/noyauNarratif';
import { lireEtatScene, releverEtatScene } from '../engine/etatScene';
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
  'memoire' | 'directeur' | 'monde' | 'social' | 'loreEmergent' | 'loreEmergentDernierIndex' | 'scene'
> & { diagnosticPostTraitement?: DiagnosticPostTraitement; minutesEcoulees?: number };

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
  const debutPostTraitement = Date.now();
  const etapesDiagnostic: DiagnosticEtape[] = [];
  const mesurer = async <T>(nom: string, action: () => Promise<T>): Promise<T> => {
    const debut = Date.now();
    try {
      const resultat = await action();
      etapesDiagnostic.push({ nom, categorie: 'post-traitement', statut: 'ok', dureeMs: Date.now() - debut });
      return resultat;
    } catch (erreur) {
      etapesDiagnostic.push({
        nom,
        categorie: 'post-traitement',
        statut: 'erreur',
        dureeMs: Date.now() - debut,
        raison: erreur instanceof Error ? erreur.message : 'Erreur inconnue',
      });
      throw erreur;
    }
  };

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
        mesurer('Mémoire L0-L5', () => mettreAJourMemoire({
          appSettings,
          storyId: story.meta.id,
          memoireActuelle: story.memoire,
          messages: messagesSecurises,
          personnageNom,
        })),
        mesurer('Directeur narratif', () => mettreAJourDirecteur({
          appSettings,
          storyId: story.meta.id,
          directeurActuel: story.directeur,
          messages: messagesSecurises,
          depuisIndex: story.memoire.dernierMessageIndexMaj,
        })),
        mesurer('Simulation du monde', () => mettreAJourMonde({
          appSettings,
          storyId: story.meta.id,
          mondeActuel: story.monde,
          messages: messagesSecurises,
          depuisIndex: story.memoire.dernierMessageIndexMaj,
        })),
        mesurer('Social / engagements', () => mettreAJourSocial({
          appSettings,
          storyId: story.meta.id,
          socialActuel: story.social,
          messages: messagesSecurises,
          depuisIndex: story.memoire.dernierMessageIndexMaj,
        })),
      ])
    : null;

  const lorePromise = loreDue
    ? mesurer('Lore émergent', () => mettreAJourLoreEmergent({
        appSettings,
        storyId: story.meta.id,
        existants: story.loreEmergent,
        messages: messagesSecurises,
        depuisIndex: loreDepuisIndex,
        personnageNom,
      }))
    : null;

  // État de scène (ville, lieu, présents, temps écoulé) : à chaque tour,
  // comme le lore émergent, en parallèle et sans retarder l'affichage.
  const scenePromise = loreDue
    ? mesurer('État de scène', () => releverEtatScene({
        appSettings,
        storyId: story.meta.id,
        actuel: lireEtatScene(story, CAPITALES),
        messages: messagesSecurises,
        capitales: CAPITALES,
        personnageNom,
      })).catch(() => null)
    : null;

  if (!periodicDue) {
    const raison = `Cadence non atteinte : ${story.messages.length - story.memoire.dernierMessageIndexMaj}/8 messages depuis la dernière mise à jour.`;
    for (const nom of ['Mémoire L0-L5', 'Directeur narratif', 'Simulation du monde', 'Social / engagements']) {
      etapesDiagnostic.push({ nom, categorie: 'post-traitement', statut: 'ignoree', dureeMs: 0, raison });
    }
  }
  if (!loreDue) {
    etapesDiagnostic.push({ nom: 'Lore émergent', categorie: 'post-traitement', statut: 'ignoree', dureeMs: 0, raison: 'Aucun nouveau message à analyser.' });
  }

  if (periodicPromise) {
    [memoire, directeur, monde, social] = await periodicPromise;
  }
  if (lorePromise) {
    loreEmergent = await lorePromise;
    loreEmergentDernierIndex = story.messages.length;
  }
  const releve = scenePromise ? await scenePromise : null;

  return {
    memoire,
    directeur,
    monde,
    social,
    loreEmergent,
    loreEmergentDernierIndex,
    scene: releve?.scene ?? story.scene,
    minutesEcoulees: releve?.minutesEcoulees,
    diagnosticPostTraitement: {
      dureeTotaleMs: Date.now() - debutPostTraitement,
      etapes: etapesDiagnostic,
    },
  };
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
