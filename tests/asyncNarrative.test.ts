import assert from 'node:assert/strict';
import test from 'node:test';
import { creerNouvelleHistoire } from '../src/engine/story';
import { fusionnerEtatDerivePersistant, memeTranscriptNarratif } from '../src/engine/derivedState';
import { besoinRattrapageNarratif } from '../src/automation/narrativeRoutines';

function histoire(nombreMessages = 2) {
  const story = creerNouvelleHistoire({
    personnageNom: 'William',
    personnageDescription: 'Voyageur',
    pointDeDepart: 'Paris',
    contexte: { lieu: 'Paris', ambiance: 'Sombre', dateChronique: '', objectifs: '' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
  });
  story.meta.id = 'story-async';
  story.messages = Array.from({ length: nombreMessages }, (_, index) => ({
    id: `m-${index}`,
    role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
    content: `Message ${index}`,
    timestamp: index,
  }));
  return story;
}

test('un état dérivé persisté est repris sans remplacer le transcript ni les réglages courants', () => {
  const ecran = histoire();
  ecran.meta.contexte.ambiance = 'Pluvieuse';
  const persistee = structuredClone(ecran);
  persistee.memoire.resume = 'Résumé produit en arrière-plan';
  persistee.loreEmergentDernierIndex = persistee.messages.length;
  persistee.monde.flags.secret_ouvert = true;

  const fusionnee = fusionnerEtatDerivePersistant(ecran, persistee);
  assert.equal(fusionnee.memoire.resume, 'Résumé produit en arrière-plan');
  assert.equal(fusionnee.loreEmergentDernierIndex, 2);
  assert.equal(fusionnee.monde.flags.secret_ouvert, true);
  assert.equal(fusionnee.meta.contexte.ambiance, 'Pluvieuse');
  assert.deepEqual(fusionnee.messages, ecran.messages);
});

test('un état dérivé d’une autre révision est refusé', () => {
  const ecran = histoire();
  const persistee = structuredClone(ecran);
  persistee.messages[1].content = 'Une réponse plus récente';
  persistee.memoire.resume = 'Ne doit pas entrer';

  assert.equal(memeTranscriptNarratif(ecran, persistee), false);
  const fusionnee = fusionnerEtatDerivePersistant(ecran, persistee);
  assert.equal(fusionnee, ecran);
  assert.notEqual(fusionnee.memoire.resume, 'Ne doit pas entrer');
});

test('le lore non traité rend immédiatement le post-traitement nécessaire', () => {
  const story = histoire(2);
  story.loreEmergentDernierIndex = 0;
  assert.equal(besoinRattrapageNarratif(story), true);

  story.loreEmergentDernierIndex = story.messages.length;
  assert.equal(besoinRattrapageNarratif(story), false);
});

test('la cadence mémoire déclenche aussi le post-traitement même si le lore est à jour', () => {
  const story = histoire(8);
  story.loreEmergentDernierIndex = story.messages.length;
  story.memoire.dernierMessageIndexMaj = 0;
  assert.equal(besoinRattrapageNarratif(story), true);
});
