import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { getSettings } from '../storage/storage';
import { modeleLocalTelecharge } from '../storage/modeleLocalStore';
import { abonnerReglages } from './settingsStore';
import { calculerCapacites } from './capabilities';
import {
  initializeAutomationKernel,
  processAutomationQueue,
  setAutomationCapabilities,
} from './kernel';
import { enqueueUpdateCheckIfDue, registerBuiltInAutomationHandlers } from './routines';

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

/**
 * Monte une seule fois le noyau d'automatismes au niveau racine :
 * - restaure les jobs interrompus après fermeture/crash ;
 * - garde les capacités synchronisées avec chaque sauvegarde de réglages ;
 * - traite les jobs persistants en attente ;
 * - vérifie les mises à jour au retour au premier plan, avec TTL.
 */
export default function AutomationProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let actif = true;
    const unregisterHandlers = registerBuiltInAutomationHandlers();
    const unsubscribeSettings = abonnerReglages((settings) => {
      if (actif) recalculerCapacites(settings);
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
      unsubscribeSettings();
      unregisterHandlers();
    };
  }, []);

  return <>{children}</>;
}
