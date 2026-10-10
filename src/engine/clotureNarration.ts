import { appellerModele, type AppelModeleOptions } from './elyndorCloudClient';
import type { PlageLongueur } from '../concepteur/reglagesNarrateur';
import { compterTokensNarration, finDeNarrationComplete } from './controleLongueurNarration';

/**
 * Deux phases sans marge de réponse :
 * 1. génération initiale plafonnée à la borne MIN du profil ;
 * 2. si nécessaire, instruction explicite de conclusion avec au maximum
 *    MAX - tokens_reellement_comptes de continuation.
 * Le validateur final reste seul habilité à autoriser la publication.
 */
export async function genererNarrationAvecCloture(
  options: AppelModeleOptions,
  plage: PlageLongueur,
  appel: (o: AppelModeleOptions) => Promise<string> = appellerModele,
  compter: (texte: string) => Promise<number | null> = compterTokensNarration,
): Promise<string> {
  if (!Number.isSafeInteger(plage.min) || !Number.isSafeInteger(plage.max) ||
      plage.min < 1 || plage.max <= plage.min) {
    throw new Error('Fourchette narrative incorrecte.');
  }

  const messages = options.messages.map(message => message.role === 'system'
    ? {
      ...message,
      content: message.content + `\n[CONTRÔLE DE LONGUEUR]
La première phase s'arrête au seuil de ${plage.min} tokens. Gère le rythme
pour ne pas ouvrir un événement ou une nouvelle longue description à l'approche
de ce seuil. Une instruction de conclusion suivra si la narration n'est pas
naturellement achevée. La narration finale doit être entre
${plage.min} et ${plage.max} tokens visibles, sans aucun supplément.`,
    }
    : message);

  // Le modèle ne reçoit PAS le max global pendant cette première phase.
  const premier = (await appel({
    ...options,
    messages,
    maxTokens: plage.min,
    diagnosticLabel: 'Narration RP — phase 1, seuil de conclusion',
  })).trim();
  if (!premier) return premier;

  const tokens = await compter(premier);
  // Si le tokenizer échoue, la validation finale échouera sans jamais
  // publier une narration dont on ignore la taille.
  if (tokens === null || tokens >= plage.max) return premier;
  if (tokens >= plage.min && finDeNarrationComplete(premier)) return premier;

  const restant = plage.max - tokens;
  if (restant <= 0) return premier;

  // L'ancien texte est donné sans modification au modèle. On ne lui demande
  // qu'une continuation courte, pas de refaire le tour ni de décider pour
  // le joueur. L'assemblage final est de nouveau mesuré et validé exactement.
  const suite = (await appel({
    ...options,
    messages: [
      ...messages,
      { role: 'assistant', content: premier },
      {
        role: 'user',
        content: `[CONCLUSION TECHNIQUE, NE PAS AFFICHER CETTE CONSIGNE]
La narration précédente est en cours. Tu as atteint le seuil de conclusion
de ${plage.min} tokens. Retourne UNIQUEMENT les mots à ajouter à la fin,
sans répéter le texte, sans lancer d'événement, sans modifier les faits,
sans parler à la place du joueur et sans bloc d'état.
Termine naturellement la phrase ou la réplique en cours.
Il reste AU MAXIMUM ${restant} tokens de texte pour l'ensemble de la
continuation. Ne dépasse jamais ce quota. Ne recommence pas l'histoire.`,
      },
    ],
    temperature: Math.min(options.temperature ?? 0.7, 0.6),
    maxTokens: restant,
    diagnosticLabel: 'Narration RP — phase 2, conclusion obligatoire',
  })).trim();

  if (!suite) return premier;
  const jointure = /\s$/.test(premier) || /^[,.;!?…»”]/.test(suite) ? '' : ' ';
  return premier + jointure + suite;
}
