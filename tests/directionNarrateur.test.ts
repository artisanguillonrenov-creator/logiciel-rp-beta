import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppSettings } from '../src/types';
import { creerNouvelleHistoire } from '../src/engine/story';
import { messagesDirection, promptSdxlTropCourt } from '../src/engine/directionArtistique';

function histoire() {
  const story = creerNouvelleHistoire({
    personnageNom: 'William',
    personnageDescription: 'Voyageur balafré',
    pointDeDepart: 'Paris',
    contexte: { lieu: 'Paris', ambiance: 'Sombre', dateChronique: '', objectifs: '' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
  });
  story.messages = [
    { id: 'u1', role: 'user', content: 'Ok allons à la guilde', timestamp: 1 },
    { id: 'a1', role: 'assistant', content: 'Séraphine Duvall lève les yeux de son registre.', timestamp: 2 },
  ];
  return story;
}

const reglages = { profilContenu: 'adulte' } as AppSettings;

test('la direction artistique reprend le contexte complet du narrateur et sa dernière scène', () => {
  const messages = messagesDirection(histoire(), reglages, 'CONTEXTE DU NARRATEUR');
  assert.equal(messages[0].content, 'CONTEXTE DU NARRATEUR');
  assert.match(messages[1].content, /PAUSE DANS LE RÉCIT/);
  assert.match(messages[1].content, /Séraphine Duvall lève les yeux/);
  assert.match(messages[1].content, /Réponds UNIQUEMENT avec ce JSON strict/);
  // Personnage et mémoire sont déjà dans le contexte du narrateur.
  assert.doesNotMatch(messages[1].content, /\[PERSONNAGE DU JOUEUR/);
});

test('sans contexte du narrateur, la direction garde son contexte propre', () => {
  const messages = messagesDirection(histoire(), reglages);
  assert.match(messages[0].content, /\[PERSONNAGE DU JOUEUR — William\]/);
  assert.doesNotMatch(messages[1].content, /PAUSE DANS LE RÉCIT/);
});

test('un prompt image d’une seule phrase est redemandé au narrateur', () => {
  assert.equal(promptSdxlTropCourt(undefined), true);
  assert.equal(promptSdxlTropCourt('Medium shot of a scarred human man in plate armor before a smiling woman.'), true);
  assert.equal(promptSdxlTropCourt(Array(90).fill('word').join(' ')), false);
});
