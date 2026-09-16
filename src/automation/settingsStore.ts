import type { AppSettings } from '../types';

export type SettingsListener = (settings: AppSettings) => void;

let courant: AppSettings | null = null;
const auditeurs = new Set<SettingsListener>();

/**
 * Source de vérité réactive en mémoire pour les réglages déjà persistés par
 * settingsRepository. Le dépôt de stockage reste responsable des lectures et
 * écritures durables ; ce module ne fait qu'empêcher chaque écran de vivre
 * avec une copie isolée devenue obsolète.
 */
export function publierReglages(settings: AppSettings): AppSettings {
  courant = { ...settings };
  for (const auditeur of auditeurs) {
    try {
      auditeur(courant);
    } catch {
      // Un abonné défaillant ne doit jamais empêcher les autres briques de
      // recevoir la nouvelle configuration.
    }
  }
  return courant;
}

export function lireReglagesCourants(): AppSettings | null {
  return courant ? { ...courant } : null;
}

export function abonnerReglages(auditeur: SettingsListener, immediat = true): () => void {
  auditeurs.add(auditeur);
  if (immediat && courant) {
    auditeur({ ...courant });
  }
  return () => {
    auditeurs.delete(auditeur);
  };
}

// Exposé uniquement pour les tests purs du noyau.
export function reinitialiserSettingsStorePourTests(): void {
  courant = null;
  auditeurs.clear();
}
