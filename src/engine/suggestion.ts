import type { AppSettings, StoryState } from '../types';
import { appellerModele } from './openrouter';
import { libelleRomance, libelleViolence } from './promptBuilder';
import { INSTRUCTION_REGISTRE_GRAND_PUBLIC, plafonnerCurseurs } from './contenuAdulte';

const NB_MESSAGES_CONTEXTE = 6;

/**
 * Suggestion de réplique pour le joueur (Ajouts_A_Integrer.md #4, façon
 * "impersonate me" de Chub AI) : un brouillon que le joueur déclenche
 * lui-même, peut accepter, modifier ou ignorer — jamais une réponse que
 * l'IA impose dans le fil narratif. Distinct du railroading : ceci ne
 * produit rien tant que le joueur n'a pas appuyé sur le bouton, et le texte
 * atterrit dans son champ de saisie, pas dans la conversation.
 *
 * Deux ratés observés en usage réel, tous deux dus au prompt plutôt qu'à
 * maxTokens (voir historique du 3 sept.) :
 * - Un prompt trop nu (sans le registre violence/romance établi de
 *   l'histoire) faisait s'interrompre le modèle en cours de phrase sur une
 *   scène explicite (autocensure).
 * - Réutiliser tel quel le prompt système complet du narrateur ("Tu es le
 *   narrateur...") faisait l'effet inverse : le modèle continuait la scène
 *   à la place du PNJ plutôt que d'écrire UNE réplique du joueur — plus
 *   long, donc à nouveau tronqué par maxTokens.
 * Solution : un prompt dédié, minimal mais qui porte quand même le registre
 * établi (pour ne pas s'autocensurer), avec des règles strictes de forme et
 * la consigne posée en tout dernier message pour primer sur le contexte.
 */
export async function suggererRepliqueJoueur(story: StoryState, appSettings: AppSettings): Promise<string> {
  const contexte = story.messages
    .slice(-NB_MESSAGES_CONTEXTE)
    .map((m) => `${m.role === 'user' ? story.meta.personnageNom : 'Narrateur'} : ${m.content}`)
    .join('\n');

  const settings = plafonnerCurseurs(story.settings, appSettings.profilContenu);
  const registreTexte =
    appSettings.profilContenu === 'grand_public'
      ? INSTRUCTION_REGISTRE_GRAND_PUBLIC
      : `Registre établi pour cette histoire — violence : ${libelleViolence(settings.violence)} ; romance : ${libelleRomance(settings.romance)}. Tu peux être aussi direct et explicite que le reste de la conversation si la scène l'appelle, sans jamais t'interrompre en cours de phrase.`;

  const contenu = await appellerModele({
    apiKey: appSettings.openRouterApiKey,
    model: appSettings.model,
    moteurInference: appSettings.moteurInference,
    temperature: 0.8,
    // Le format est déjà contraint par la consigne (1-2 phrases, un seul
    // personnage) — cette marge sert seulement à ne jamais couper une
    // réplique légitime qui inclut une énumération ou une action avant le
    // dialogue (ex. "*Je m'appuie...* Je te propose... mon armurerie, mes
    // hommes, et une place à mes côtés."), déjà plus longue que 200 tokens
    // en pratique malgré la consigne de brièveté.
    maxTokens: 400,
    // Sur un modèle à raisonnement hybride (ex. DeepSeek V3.1+), le
    // raisonnement interne consomme le même budget maxTokens que la réponse
    // visible, de façon très variable d'un appel à l'autre — la coupure
    // observée en usage réel (à des endroits différents, sans lien avec la
    // valeur de maxTokens) correspondait à ce raisonnement invisible qui
    // grignotait tout le budget avant même d'écrire la suggestion. Une
    // suggestion d'une phrase n'a besoin d'aucun raisonnement caché.
    raisonnement: false,
    messages: [
      {
        role: 'system',
        content: `Tu assistes {{user}}, qui incarne ${story.meta.personnageNom} (${story.meta.personnageDescription}) dans un jeu de rôle textuel. Il te demande un brouillon de SA prochaine réplique ou action, qu'il pourra reprendre, modifier ou ignorer avant de l'envoyer.

${registreTexte}

Règles strictes de forme :
- Écris UNIQUEMENT ce que ${story.meta.personnageNom} dit ou fait, à la première personne ("je").
- Jamais ce que dit, fait ou ressent un autre personnage ; jamais la suite de la scène côté narrateur.
- Une phrase courte, deux au maximum. Pas de longue description.
- Réponds seulement avec le texte de la réplique/action — pas de guillemets système, pas de préambule, pas d'astérisques narrant un tiers.`,
      },
      {
        role: 'user',
        content: `[EXTRAIT RÉCENT DE LA SCÈNE]\n${contexte || story.meta.pointDeDepart}\n\n[TA TÂCHE]\nPropose une seule réplique ou action pour ${story.meta.personnageNom} qui ferait suite à cet extrait. Une à deux phrases maximum, rien d'autre.`,
      },
    ],
  });

  return contenu.trim();
}
