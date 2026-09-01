import type { AppSettings, StoryState } from '../types';
import { appellerModele } from './openrouter';

const NB_MESSAGES_CONTEXTE = 6;

/**
 * Suggestion de réplique pour le joueur (Ajouts_A_Integrer.md #4, façon
 * "impersonate me" de Chub AI) : un brouillon que le joueur déclenche
 * lui-même, peut accepter, modifier ou ignorer — jamais une réponse que
 * l'IA impose dans le fil narratif. Distinct du railroading : ceci ne
 * produit rien tant que le joueur n'a pas appuyé sur le bouton, et le texte
 * atterrit dans son champ de saisie, pas dans la conversation.
 */
export async function suggererRepliqueJoueur(story: StoryState, appSettings: AppSettings): Promise<string> {
  const contexte = story.messages
    .slice(-NB_MESSAGES_CONTEXTE)
    .map((m) => `${m.role === 'user' ? story.meta.personnageNom : 'Narrateur'} : ${m.content}`)
    .join('\n');

  const contenu = await appellerModele({
    apiKey: appSettings.openRouterApiKey,
    model: appSettings.model,
    moteurInference: appSettings.moteurInference,
    temperature: 0.9,
    maxTokens: 150,
    messages: [
      {
        role: 'system',
        content: `Tu proposes UNE seule suggestion de réplique ou d'action pour le joueur qui incarne ${story.meta.personnageNom} (${story.meta.personnageDescription}). À la première personne, cohérente avec la scène en cours, une à deux phrases. Ne raconte pas la suite ni ce que font les autres personnages — seulement ce que ${story.meta.personnageNom} pourrait dire ou faire ensuite. Réponds uniquement avec le texte de la suggestion, sans guillemets ni préambule.`,
      },
      { role: 'user', content: contexte || story.meta.pointDeDepart },
    ],
  });

  return contenu.trim();
}
