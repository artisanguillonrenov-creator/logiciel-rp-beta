import type { StoryState } from '../types';

/**
 * Empreinte déterministe de la partie de l'histoire dont dépendent les
 * post-traitements narratifs. Elle ignore volontairement les réactions,
 * épingles et autres métadonnées d'interface : ces changements ne rendent
 * pas une analyse mémoire/monde/social obsolète.
 */
export function calculerRevisionNarrative(story: StoryState): string {
  let hash = 0x811c9dc5;
  const ajouter = (texte: string) => {
    for (let i = 0; i < texte.length; i++) {
      hash ^= texte.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
  };

  ajouter(story.meta.id);
  ajouter('\u0000');
  ajouter(story.meta.personnageNom);
  ajouter('\u0000');
  for (const message of story.messages) {
    ajouter(message.id);
    ajouter('|');
    ajouter(message.role);
    ajouter('|');
    ajouter(message.content);
    ajouter('\u0001');
  }

  return `${story.messages.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
