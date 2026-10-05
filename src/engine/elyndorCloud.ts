import type { AppSettings } from '../types';

/**
 * Connexion unique du narrateur Elyndor.
 *
 * L'application ne laisse plus l'utilisateur choisir un fournisseur, une clé
 * API, un modèle local ou un serveur réseau. Ces valeurs sont donc définies
 * une seule fois ici afin d'éviter les divergences entre les écrans et le
 * moteur narratif.
 */
export const ELYNDOR_CLOUD_URL = 'https://gzy9xft10gb3me-8000.proxy.runpod.net/v1';
export const ELYNDOR_CLOUD_MODELE = 'TheDrummer/Behemoth-X-123B-v2.1-GGUF:Q4_K_M';

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
    // Le générateur d'images existant dépend d'OpenRouter. Tant qu'Elyndor
    // Cloud n'expose pas son propre endpoint image, il doit rester désactivé.
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
