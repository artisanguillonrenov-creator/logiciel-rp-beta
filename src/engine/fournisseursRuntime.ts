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
  if (settings.moteurInference === 'chatgpt' || settings.fournisseurNarration === 'chatgpt') {
    return { fournisseur: 'chatgpt', url: 'https://elyndor-chatgpt-plus-gateway.onrender.com/chat', model: settings.chatgptModel || '', apiKey: '' };
  }
  if (settings.moteurInference === 'openai' || settings.fournisseurNarration === 'openai') {
    return {
      fournisseur: 'openai',
      url: 'https://api.openai.com/v1/chat/completions',
      model: settings.openAiModel || 'gpt-4.1-mini',
      apiKey: settings.openAiApiKey || '',
    };
  }
  if (settings.moteurInference === 'openrouter' || !settings.moteurInference) {
    return {
      fournisseur: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      model: settings.model || 'openrouter/free',
      apiKey: settings.openRouterApiKey || '',
    };
  }
  if (settings.moteurInference === 'serveur') {
    const nuage = !settings.serveurLocalUrl ||
      settings.serveurLocalUrl === ELYNDOR_CLOUD_REGLAGE_URL;
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
