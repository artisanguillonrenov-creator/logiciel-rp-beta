import type { AppSettings } from '../types';

/**
 * Connexion unique du narrateur Elyndor.
 *
 * L'application ne laisse plus l'utilisateur choisir un fournisseur, une clé
 * API, un modèle local ou un serveur réseau. Ces valeurs sont donc définies
 * une seule fois ici afin d'éviter les divergences entre les écrans et le
 * moteur narratif.
 */
/**
 * Pod Runpod (GPU A40) qui sert la narration (port 8000, llama.cpp +
 * Anubis 70B v1.2 Q3_K_M) et les images (port 7860, Lustify SDXL v4).
 * Installé sur le volume réseau `elyndor-cloud` (infra/runpod/) : le pod
 * s'arrête seul après 30 min d'inactivité et redémarre sans réinstallation.
 */
export const ELYNDOR_CLOUD_POD = 'dttm6j1bex3051';
export const ELYNDOR_CLOUD_URL = `https://${ELYNDOR_CLOUD_POD}-8000.proxy.runpod.net/v1`;
/** Alias exposé par llama-server (--alias). */
export const ELYNDOR_CLOUD_MODELE = 'anubis-70b-v1.2';
/**
 * Embeddings de la recherche sémantique (ObjectBox) : bge-m3, servi par le
 * même pod que les images (port 7860). null = recherche lexicale seule.
 */
export const ELYNDOR_CLOUD_EMBEDDINGS_URL = `https://${ELYNDOR_CLOUD_POD}-7860.proxy.runpod.net/v1`;
export const ELYNDOR_CLOUD_MODELE_EMBEDDINGS: string | null = 'bge-m3';

/**
 * Normalise aussi les anciennes sauvegardes. Les anciens secrets sont vidés :
 * aucune connexion OpenRouter, Infermatic, locale ou serveur local ne doit
 * pouvoir être réactivée depuis un réglage hérité.
 *
 * Le moteur `serveur` reste uniquement comme détail de compatibilité interne
 * avec le client OpenAI-compatible déjà éprouvé. Il ne correspond plus à un
 * mode sélectionnable dans l'application.
 */
export function verrouillerSurElyndorCloud(settings: AppSettings): AppSettings {
  return {
    ...settings,
    openRouterApiKey: '',
    model: ELYNDOR_CLOUD_MODELE,
    infermaticApiKey: undefined,
    infermaticModel: undefined,
    embeddingsApiKey: undefined,
    conserverClesWeb: false,
    moteurInference: 'serveur',
    serveurLocalUrl: ELYNDOR_CLOUD_URL,
    serveurLocalModele: ELYNDOR_CLOUD_MODELE,
    serveurLocalApiKey: undefined,
    // Réglages hérités de l'ancien générateur d'images tiers : jamais relus.
    // Les images dépendent uniquement du pod Elyndor Cloud (elyndorCloudImages.ts).
    genererImagesActive: false,
    modeleImagesGratuit: false,
  };
}

/**
 * Vérifie la forme canonique complète, pas seulement la cible réseau. Cela
 * force la migration à effacer aussi les anciens modèles, clés de secours et
 * options OpenRouter qui pourraient encore dormir dans une installation mise
 * à jour.
 */
export function reglagesSontElyndorCloud(settings: AppSettings): boolean {
  return settings.moteurInference === 'serveur'
    && settings.model === ELYNDOR_CLOUD_MODELE
    && settings.serveurLocalUrl === ELYNDOR_CLOUD_URL
    && settings.serveurLocalModele === ELYNDOR_CLOUD_MODELE
    && !settings.serveurLocalApiKey
    && !settings.openRouterApiKey
    && !settings.infermaticApiKey
    && !settings.infermaticModel
    && !settings.embeddingsApiKey
    && settings.conserverClesWeb !== true
    && settings.genererImagesActive !== true
    && settings.modeleImagesGratuit !== true;
}
