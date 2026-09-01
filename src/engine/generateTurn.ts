import metamoteursRaw from '../data/metamoteurs.json';
import elyndorRaw from '../data/elyndorLore.json';
import type { AppSettings, Message, StoryState } from '../types';
import { chargerLorebook, chargerMetamoteurs, selectionnerMetamoteurs, selectionnerParMotsCles } from './loreLoader';
import {
  construireMessages,
  maxTokensPourLongueur,
  temperaturePourCreativite,
} from './promptBuilder';
import { appellerModele } from './openrouter';
import { doitMettreAJourMemoire, mettreAJourMemoire } from './memory';
import { fusionnerValidations, validerAgentiviteHeuristique, validerReponseLLM } from './validator';

const METAMOTEURS = chargerMetamoteurs(metamoteursRaw as any);
const LORE_ELYNDOR = chargerLorebook(elyndorRaw as any);

function genererId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface ResultatTour {
  story: StoryState;
  aEteCorrige: boolean;
}

/**
 * Flux de génération d'un tour (brief section 5) :
 * message joueur → sélection des métamoteurs pertinents → construction du
 * contexte → appel API → vérification basique → une nouvelle tentative si
 * violation → affichage. Puis mise à jour périodique de la mémoire.
 */
export async function genererTour(
  story: StoryState,
  appSettings: AppSettings,
  messageJoueur: string,
): Promise<ResultatTour> {
  const texteContexte = [
    story.meta.personnageDescription,
    story.meta.pointDeDepart,
    ...story.messages.slice(-6).map((m) => m.content),
    messageJoueur,
  ].join('\n');

  const metamoteursSelectionnes = selectionnerMetamoteurs(METAMOTEURS, texteContexte);
  const loreElyndor = selectionnerParMotsCles(LORE_ELYNDOR, texteContexte);

  const ctxBase = {
    meta: story.meta,
    settings: story.settings,
    resume: story.memoire.resume,
    faits: story.memoire.faits,
    metamoteursSelectionnes,
    loreElyndor,
    messagesRecents: story.messages,
    messageJoueur,
  };

  const temperature = temperaturePourCreativite(story.settings.creativite);
  const maxTokens = maxTokensPourLongueur(story.settings.longueur);

  let reponse = await appellerModele({
    apiKey: appSettings.openRouterApiKey,
    model: appSettings.model,
    messages: construireMessages(ctxBase),
    temperature,
    maxTokens,
  });

  const heuristique = validerAgentiviteHeuristique(reponse);
  const llm = await validerReponseLLM({
    apiKey: appSettings.openRouterApiKey,
    model: appSettings.model,
    reponse,
    faits: story.memoire.faits,
    meta: story.meta,
  });
  const validation = fusionnerValidations(heuristique, llm);

  let aEteCorrige = false;
  if (!validation.ok) {
    aEteCorrige = true;
    const noteCorrection = `La tentative précédente a été rejetée pour la ou les raisons suivantes : ${validation.raisons.join(
      ' ',
    )} Corrige ces points dans ta nouvelle réponse, sans les mentionner explicitement au joueur.`;
    reponse = await appellerModele({
      apiKey: appSettings.openRouterApiKey,
      model: appSettings.model,
      messages: construireMessages({ ...ctxBase, noteCorrection }),
      temperature,
      maxTokens,
    });
  }

  const messageUtilisateur: Message = {
    id: genererId(),
    role: 'user',
    content: messageJoueur,
    timestamp: Date.now(),
  };
  const messageAssistant: Message = {
    id: genererId(),
    role: 'assistant',
    content: reponse,
    timestamp: Date.now(),
  };

  const messages = [...story.messages, messageUtilisateur, messageAssistant];
  let memoire = story.memoire;
  if (doitMettreAJourMemoire(messages, memoire.dernierMessageIndexMaj)) {
    memoire = await mettreAJourMemoire({
      apiKey: appSettings.openRouterApiKey,
      model: appSettings.model,
      memoireActuelle: memoire,
      messages,
      personnageNom: story.meta.personnageNom,
    });
  }

  return {
    story: { ...story, messages, memoire },
    aEteCorrige,
  };
}

/**
 * Régénère uniquement la dernière réponse du narrateur (bouton "régénérer"),
 * en repartant du dernier message du joueur.
 */
export async function regenererDernierTour(story: StoryState, appSettings: AppSettings): Promise<ResultatTour> {
  const messages = [...story.messages];
  const dernier = messages[messages.length - 1];
  if (!dernier || dernier.role !== 'assistant') {
    throw new Error('Aucune réponse à régénérer.');
  }
  const avantDernier = messages[messages.length - 2];
  if (!avantDernier || avantDernier.role !== 'user') {
    throw new Error('Aucun message joueur associé à régénérer.');
  }

  const storySansDernierEchange: StoryState = {
    ...story,
    messages: messages.slice(0, -2),
    memoire: {
      ...story.memoire,
      dernierMessageIndexMaj: Math.min(story.memoire.dernierMessageIndexMaj, messages.length - 2),
    },
  };

  return genererTour(storySansDernierEchange, appSettings, avantDernier.content);
}
