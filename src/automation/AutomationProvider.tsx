import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { getSettings, getStoriesIndex, getStory, updateStoryIf } from '../storage/storage';
import { modeleLocalTelecharge } from '../storage/modeleLocalStore';
import { abonnerReglages } from './settingsStore';
import { abonnerSauvegardesNarratives } from './storyEvents';
import { calculerCapacites } from './capabilities';
import {
  initializeAutomationKernel,
  processAutomationQueue,
  setAutomationCapabilities,
} from './kernel';
import { enqueueUpdateCheckIfDue, registerBuiltInAutomationHandlers } from './routines';
import {
  enqueueNarrativeCatchupOnStartup,
  enqueueNarrativePostprocess,
  registerNarrativeAutomationHandlers,
  type NarrativeAutomationDeps,
} from './narrativeRoutines';
import {
  enqueueVisualAvatarSync,
  registerVisualAutomationHandlers,
  type VisualAutomationDeps,
} from './visualRoutines';

function recalculerCapacites(settings: Awaited<ReturnType<typeof getSettings>>): void {
  let modeleLocalPresent = false;
  if (Platform.OS !== 'web') {
    try {
      modeleLocalPresent = modeleLocalTelecharge();
    } catch {
      modeleLocalPresent = false;
    }
  }
  setAutomationCapabilities(
    calculerCapacites(settings, {
      plateforme: Platform.OS === 'web' ? 'web' : 'native',
      modeleLocalPresent,
    }),
  );
}

const visualDeps: VisualAutomationDeps = {
  getSettings,
  getStory,
};

const narrativeDeps: NarrativeAutomationDeps = {
  getSettings,
  getStory,
  getStoryIds: async () => (await getStoriesIndex()).map((meta) => meta.id),
  updateStoryIf,
  // Le lore émergent est produit par le post-traitement narratif. On ne
  // planifie donc les portraits qu'après confirmation de cette écriture :
  // la routine visuelle voit immédiatement les nouveaux PNJ du tour.
  afterNarrativeUpdate: enqueueVisualAvatarSync,
};

/**
 * Monte une seule fois le noyau d'automatismes au niveau racine :
 * - restaure les jobs interrompus après fermeture/crash ;
 * - garde les capacités synchronisées avec chaque sauvegarde de réglages ;
 * - relie chaque nouvelle révision narrative aux routines de post-traitement ;
 * - orchestre les automatismes visuels après le post-traitement narratif ;
 * - traite les jobs persistants en attente ;
 * - vérifie les mises à jour au retour au premier plan, avec TTL.
 */
export default function AutomationProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let actif = true;
    const unregisterHandlers = registerBuiltInAutomationHandlers();
    const unregisterVisualHandlers = registerVisualAutomationHandlers(visualDeps);
    const unregisterNarrativeHandlers = registerNarrativeAutomationHandlers(narrativeDeps);
    const unsubscribeSettings = abonnerReglages((settings) => {
      if (actif) recalculerCapacites(settings);
    });
    const unsubscribeStories = abonnerSauvegardesNarratives((event) => {
      if (!actif) return;
      void enqueueNarrativePostprocess(event).catch(() => {});
    });

    const demarrer = async () => {
      await initializeAutomationKernel();
      try {
        const settings = await getSettings();
        if (actif) recalculerCapacites(settings);
      } catch {
        // L'écran racine/réglages gère déjà les erreurs de stockage ; le
        // noyau ne doit pas empêcher l'application de démarrer.
      }
      if (!actif) return;
      // Une fermeture a pu survenir après la sauvegarde d'un tour mais avant
      // l'enqueue du job. Le scan de démarrage ne retient que les histoires
      // dont au moins un pipeline narratif est réellement en retard.
      await enqueueNarrativeCatchupOnStartup(narrativeDeps).catch(() => 0);
      await enqueueUpdateCheckIfDue().catch(() => false);
      void processAutomationQueue();
    };
    void demarrer();

    const subscription = AppState.addEventListener('change', (etat) => {
      if (etat !== 'active') return;
      void enqueueUpdateCheckIfDue()
        .catch(() => false)
        .finally(() => { void processAutomationQueue(); });
      // Une app restée ouverte peut avoir importé/supprimé un modèle local :
      // la prochaine publication de settings n'est pas garantie, donc on
      // relit les réglages au retour premier plan pour recalculer la capacité.
      void getSettings().then(recalculerCapacites).catch(() => {});
    });

    return () => {
      actif = false;
      subscription.remove();
      unsubscribeStories();
      unsubscribeSettings();
      unregisterNarrativeHandlers();
      unregisterVisualHandlers();
      unregisterHandlers();
    };
  }, []);

  return <>{children}</>;
}
