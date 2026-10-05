import type { AppSettings } from '../types';

/**
 * L'environnement ne décrit plus que la plateforme d'exécution. Les moteurs
 * sélectionnables et la présence d'un modèle local ont disparu avec le
 * passage Elyndor Cloud-only.
 */
export interface AutomationEnvironment {
  plateforme: 'web' | 'native';
}

export interface AppCapabilities {
  fournisseur: 'elyndor-cloud';
  narration: boolean;
  embeddings: boolean;
  images: boolean;
  avatars: boolean;
  traduction: boolean;
  inferenceLocale: boolean;
  contenuAdulte: boolean;
  concepteur: boolean;
  raisons: Partial<Record<'narration' | 'embeddings' | 'images' | 'traduction' | 'inferenceLocale', string>>;
}

/** Capacités réelles de l'application après le passage Cloud-only. */
export function calculerCapacites(
  settings: AppSettings,
  _env: AutomationEnvironment = { plateforme: 'native' },
): AppCapabilities {
  const raisons: AppCapabilities['raisons'] = {
    embeddings: 'La recherche sémantique distante a été retirée ; Elyndor utilise la recherche lexicale locale.',
    images: 'Elyndor Cloud n’expose pas encore de génération d’images.',
    inferenceLocale: 'Le moteur local a été retiré ; Elyndor utilise Elyndor Cloud.',
  };

  return {
    fournisseur: 'elyndor-cloud',
    // La disponibilité réelle du pod est une question d'exécution réseau,
    // pas une capacité configurable : aucun ancien réglage ne peut désactiver
    // ou détourner le narrateur Cloud.
    narration: true,
    embeddings: false,
    images: false,
    avatars: false,
    traduction: true,
    inferenceLocale: false,
    contenuAdulte: settings.profilContenu === 'adulte',
    concepteur: settings.modeConcepteur === true,
    raisons,
  };
}
