import type { StoryState } from '../types';

/**
 * Les automatismes narratifs enrichissent une histoire sans modifier son
 * transcript. Quand l'écran conserve encore une ancienne copie en mémoire,
 * on peut donc reprendre l'état dérivé persisté uniquement si les messages
 * sont strictement les mêmes.
 *
 * Cette garde évite deux risques : utiliser une mémoire obsolète au tour
 * suivant, ou au contraire injecter l'état d'une autre révision dans une
 * édition/régénération en cours.
 */
export function memeTranscriptNarratif(a: StoryState, b: StoryState): boolean {
  if (a.meta.id !== b.meta.id || a.messages.length !== b.messages.length) return false;
  return a.messages.every((message, index) => {
    const autre = b.messages[index];
    return !!autre
      && message.id === autre.id
      && message.role === autre.role
      && message.content === autre.content;
  });
}

export function fusionnerEtatDerivePersistant(
  courante: StoryState,
  persistee: StoryState | null,
): StoryState {
  if (!persistee || !memeTranscriptNarratif(courante, persistee)) return courante;
  return {
    ...courante,
    memoire: persistee.memoire,
    directeur: persistee.directeur,
    monde: persistee.monde,
    social: persistee.social,
    loreEmergent: persistee.loreEmergent,
    loreEmergentDernierIndex: persistee.loreEmergentDernierIndex,
  };
}
