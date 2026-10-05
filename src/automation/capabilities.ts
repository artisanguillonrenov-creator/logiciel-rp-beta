import type { AppSettings } from '../types';
import { imagesElyndorCloudDisponibles } from '../engine/elyndorCloudImages';
import { ELYNDOR_CLOUD_MODELE_EMBEDDINGS } from '../engine/elyndorCloud';

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
  // Les images suivent le même principe que la narration : un modèle
  // servi par Elyndor Cloud, disponible dès que son endpoint est publié.
  const images = imagesElyndorCloudDisponibles();
  // Recherche sémantique (ObjectBox) via les embeddings Elyndor Cloud ; la
  // recherche lexicale reste le relais automatique en cas d'échec réseau.
  const embeddings = !!ELYNDOR_CLOUD_MODELE_EMBEDDINGS;
  const raisons: AppCapabilities['raisons'] = {
    inferenceLocale: 'Le moteur local a été retiré ; Elyndor utilise Elyndor Cloud.',
  };
  if (!embeddings) raisons.embeddings = 'Embeddings Elyndor Cloud désactivés ; Elyndor utilise la recherche lexicale locale.';
  if (!images) raisons.images = 'Elyndor Cloud n’expose pas encore de génération d’images.';

  return {
    fournisseur: 'elyndor-cloud',
    // La disponibilité réelle du pod est une question d'exécution réseau,
    // pas une capacité configurable : aucun ancien réglage ne peut désactiver
    // ou détourner le narrateur Cloud.
    narration: true,
    embeddings,
    images,
    avatars: images,
    traduction: true,
    inferenceLocale: false,
    contenuAdulte: settings.profilContenu === 'adulte',
    concepteur: settings.modeConcepteur === true,
    raisons,
  };
}
