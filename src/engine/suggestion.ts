import type { AppSettings, StoryState } from '../types';
import { appellerModele } from './openrouter';
import { construireCtxBase } from './generateTurn';
import { construireSystemPrompt } from './promptBuilder';

const NB_MESSAGES_CONTEXTE = 6;

// Exception ponctuelle à la règle 1 des RÈGLES_IMMUABLES ("ne jamais écrire
// à la place du joueur") : injectée en dernier dans le prompt système pour
// primer sur elle, comme instructionRegistreOverride (voir promptBuilder).
// Sans ce cadrage complet, un prompt minimal demandant au modèle d'écrire
// "à la première personne" une réplique de scène explicite le faisait
// s'interrompre en plein milieu (autocensure du modèle, pas une histoire de
// longueur de réponse) — voir la découverte du 3 sept. : une suggestion
// tronquée à 8 mots avec maxTokens=300 ne pouvait pas être un problème de
// plafond de tokens. En reprenant le même prompt système complet que
// genererTour/genererMessageOuverture (règles, personnage, résumé, faits,
// registre violence/romance établi), le modèle a la même autorisation
// explicite de continuer dans le registre déjà en place que pour le reste
// de l'histoire.
const INSTRUCTION_SUGGESTION = `[SUGGESTION DE RÉPLIQUE POUR {{user}} — EXCEPTION PONCTUELLE À LA RÈGLE 1]
{{user}} te demande lui-même, explicitement, un brouillon de sa prochaine réplique ou action — il pourra l'accepter, la modifier ou l'ignorer avant de l'envoyer. C'est l'unique cas où tu écris à sa place. Rédige UNE seule suggestion, à la première personne, une à deux phrases, dans le même registre que la scène en cours (aussi explicite que le reste de l'histoire si la scène l'est). Ne raconte pas la suite ni ce que font les autres personnages. Réponds uniquement avec le texte de la suggestion, sans guillemets ni préambule, et termine toujours ta phrase — ne t'interromps jamais avant la fin.`;

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

  // Pas de sélection de lore ici (calculerSelectionLore ferait des appels
  // réseau d'embeddings pour un simple brouillon) — seul le cadrage complet
  // du prompt système (règles, personnage, résumé, faits, registre) importe
  // pour éviter l'autocensure ; le lore lui-même n'est pas nécessaire à une
  // suggestion d'une à deux phrases.
  const ctxBase = construireCtxBase(story, '', appSettings, { metamoteursSelectionnes: [], loreElyndor: [], souvenirs: [] });
  const systemPrompt = construireSystemPrompt(ctxBase);

  const contenu = await appellerModele({
    apiKey: appSettings.openRouterApiKey,
    model: appSettings.model,
    moteurInference: appSettings.moteurInference,
    temperature: 0.9,
    maxTokens: 300,
    messages: [
      { role: 'system', content: `${systemPrompt}\n\n${INSTRUCTION_SUGGESTION}` },
      { role: 'user', content: contexte || story.meta.pointDeDepart },
    ],
  });

  return contenu.trim();
}
