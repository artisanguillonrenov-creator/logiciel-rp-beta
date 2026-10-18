import type { AppSettings } from '../types';
import {
 ELYNDOR_CLOUD_MODELE, ELYNDOR_CLOUD_REGLAGE_URL,
 urlNarrationElyndorCloud,
} from './elyndorCloud';

let actifs: AppSettings = {
  openRouterApiKey: '', model: 'openrouter/free', moteurInference: 'openrouter',
  fournisseurImages: 'desactive', fournisseurEmbeddings: 'desactive',
  autoriserImagesPayantes: false,
};

export function activerReglagesFournisseurs(value: AppSettings): void {
  actifs = { ...value };
}
export function reglagesFournisseursActifs(): AppSettings {
  return actifs;
}

export interface RouteTexte {
  fournisseur: 'openrouter' | 'openai' | 'runpod' | 'serveur' | 'chatgpt';
  url: string;
  model: string;
  apiKey: string;
}
export function resoudreRouteTexte(settings: AppSettings): RouteTexte {
  // Le choix explicite de l'utilisateur prime sur les anciens réglages du moteur.
  // La présence d'une ancienne URL Elyndor Cloud ne peut réactiver RunPod.
  const mode = settings.fournisseurNarration ?? (
    settings.moteurInference === 'chatgpt' ? 'chatgpt'
      : settings.moteurInference === 'openai' ? 'openai'
      : settings.moteurInference === 'serveur'
        ? (!settings.serveurLocalUrl || settings.serveurLocalUrl === ELYNDOR_CLOUD_REGLAGE_URL ? 'runpod' : 'serveur')
        : 'openrouter'
  );
  if (mode === 'chatgpt') {
    return { fournisseur: 'chatgpt', url: 'https://elyndor-chatgpt-plus-gateway.onrender.com/chat', model: settings.chatgptModel || '', apiKey: '' };
  }
  if (mode === 'openai') {
    return {
      fournisseur: 'openai',
      url: 'https://api.openai.com/v1/chat/completions',
      model: settings.openAiModel || 'gpt-4.1-mini',
      apiKey: settings.openAiApiKey || '',
    };
  }
  if (mode === 'openrouter') {
    return {
      fournisseur: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      model: settings.model || 'openrouter/free',
      apiKey: settings.openRouterApiKey || '',
    };
  }
  if (mode === 'serveur' || mode === 'runpod') {
    const nuage = mode === 'runpod';
    return {
      fournisseur: nuage ? 'runpod' : 'serveur',
      url: nuage ? urlNarrationElyndorCloud() + '/chat/completions' :
        settings.serveurLocalUrl!.replace(/\/+$/, '') + '/chat/completions',
      model: nuage ? ELYNDOR_CLOUD_MODELE :
        (settings.serveurLocalModele || settings.model),
      apiKey: nuage ? '' : (settings.serveurLocalApiKey || ''),
    };
  }
  throw new Error('Fournisseur narratif non configuré ou non disponible.');
}
