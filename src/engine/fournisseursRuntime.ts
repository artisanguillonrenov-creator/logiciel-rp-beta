import type { AppSettings } from '../types';
import { MODELES_NARRATION_CLOUDFLARE, MODELE_CLOUDFLARE_PAR_DEFAUT } from './fournisseursNarrationGratuits';
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
  fournisseur: 'openrouter' | 'openai' | 'runpod' | 'serveur' | 'chatgpt' | 'cloudflare' | 'aihorde';
  url: string;
  model: string;
  apiKey: string;
}
export function resoudreRouteTexte(settings: AppSettings): RouteTexte {
  if (settings.moteurInference === 'cloudflare' || settings.fournisseurNarration === 'cloudflare') {
    const model = settings.modeleNarrationCloudflare || MODELE_CLOUDFLARE_PAR_DEFAUT;
    if (!MODELES_NARRATION_CLOUDFLARE.some(m => m.id === model)) {
      throw new Error('Modèle Cloudflare non autorisé par le catalogue gratuit Elyndor.');
    }
    const compte = settings.cloudflareAccountId?.trim() || '';
    if (!/^[a-z0-9]{32}$/i.test(compte) || !settings.cloudflareApiKey?.trim()) {
      throw new Error('Renseigne ton Account ID Cloudflare et ton jeton Workers AI.');
    }
    return {
      fournisseur: 'cloudflare',
      url: `https://api.cloudflare.com/client/v4/accounts/${compte}/ai/run/${model}`,
      model, apiKey: settings.cloudflareApiKey.trim(),
    };
  }
  if (settings.moteurInference === 'aihorde' || settings.fournisseurNarration === 'aihorde') {
    const model = settings.modeleNarrationHorde?.trim() || '';
    if (!model) throw new Error('Sélectionne un modèle narratif actif AI Horde.');
    return {
      fournisseur: 'aihorde', url: 'https://aihorde.net/api/v2/generate/text/async',
      model, apiKey: settings.aiHordeApiKey || '',
    };
  }
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
