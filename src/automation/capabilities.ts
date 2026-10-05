import type { AppSettings, MoteurInference } from '../types';

/**
 * L'environnement ne décrit plus que la plateforme d'exécution. Les moteurs
 * sélectionnables et la présence d'un modèle local ont disparu avec le
 * passage Elyndor Cloud-only.
 */
export interface AutomationEnvironment {
  plateforme: 'web' | 'native';
}

export interface AppCapabilities {
  fournisseur: MoteurInference;
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

/**
 * Capacités réelles de l'application après le passage Cloud-only.
 *
 * Le type historique `MoteurInference` ne possède pas encore de valeur
 * `cloud` : `serveur` reste donc uniquement l'identifiant interne de
 * compatibilité utilisé par les anciennes sauvegardes. Il ne représente plus
 * un serveur local sélectionnable par l'utilisateur.
 */
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
    fournisseur: 'serveur',
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
