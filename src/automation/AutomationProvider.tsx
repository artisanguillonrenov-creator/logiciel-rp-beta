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
import {
  enqueueLifecycleSweep,
  registerLifecycleAutomationHandlers,
  type LifecycleAutomationDeps,
} from './lifecycleRoutines';

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

const getStoryIds = async () => (await getStoriesIndex()).map((meta) => meta.id);

const visualDeps: VisualAutomationDeps = {
  getSettings,
  getStory,
};

const narrativeDeps: NarrativeAutomationDeps = {
  getSettings,
  getStory,
  getStoryIds,
  updateStoryIf,
  afterNarrativeUpdate: enqueueVisualAvatarSync,
};

const lifecycleDeps: LifecycleAutomationDeps = {
  getStoryIds,
};

export default function AutomationProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let actif = true;
    const unregisterHandlers = registerBuiltInAutomationHandlers();
    const unregisterLifecycleHandlers = registerLifecycleAutomationHandlers(lifecycleDeps);
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
        // Le noyau ne doit jamais empêcher l'application de démarrer.
      }
      if (!actif) return;

      // Répare d'abord les suppressions incomplètes des sessions précédentes,
      // puis rattrape les pipelines narratifs encore en retard.
      await enqueueLifecycleSweep().catch(() => {});
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
      void getSettings().then(recalculerCapacites).catch(() => {});
    });

    return () => {
      actif = false;
      subscription.remove();
      unsubscribeStories();
      unsubscribeSettings();
      unregisterNarrativeHandlers();
      unregisterVisualHandlers();
      unregisterLifecycleHandlers();
      unregisterHandlers();
    };
  }, []);

  return <>{children}</>;
}
