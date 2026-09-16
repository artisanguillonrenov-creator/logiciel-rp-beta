import assert from 'node:assert/strict';
import test from 'node:test';
import { creerNouvelleHistoire } from '../src/engine/story';
import {
  ID_AVATAR_JOUEUR_VISUEL,
  cleDedupeAvatar,
  cleDedupeScene,
  cleDedupeSynchronisationAvatars,
  listerIdsPnjVisuels,
} from '../src/automation/visualPlanning';
import {
  abonnerEvenementsVisuels,
  publierEvenementVisuel,
  reinitialiserEvenementsVisuelsPourTests,
} from '../src/automation/visualEvents';

function histoire() {
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
  story.meta.id = 'story-visuelle';
  story.messages = [
    { id: 'u1', role: 'user', content: 'J’entre.', timestamp: 1 },
    { id: 'a1', role: 'assistant', content: 'Sylvana apparaît.', timestamp: 2 },
  ];
  story.loreEmergent = [
    { id: 'pnj-sylvana', categorie: 'pnj', titre: 'Sylvana', contenu: 'Elfe noire.', statut: 'provisoire', premiereMention: 1, dernierAcces: 2 },
    { id: 'pnj-joueur', categorie: 'pnj', titre: 'William', contenu: 'Doublon historique.', statut: 'provisoire', premiereMention: 1, dernierAcces: 2 },
    { id: 'lieu-paris', categorie: 'lieu', titre: 'Paris', contenu: 'Ville.', statut: 'permanent', premiereMention: 1, dernierAcces: 2 },
  ];
  return story;
}

test.afterEach(() => reinitialiserEvenementsVisuelsPourTests());

test('la planification visuelle exclut le joueur et les entrées non-PNJ', () => {
  assert.deepEqual(listerIdsPnjVisuels(histoire()), ['pnj-sylvana']);
  assert.equal(ID_AVATAR_JOUEUR_VISUEL, '__joueur__');
});

test('les clés de déduplication sont stables par révision et différencient un forçage', () => {
  const story = histoire();
  const sync1 = cleDedupeSynchronisationAvatars(story);
  const sync2 = cleDedupeSynchronisationAvatars(story);
  assert.equal(sync1, sync2);

  assert.equal(cleDedupeAvatar(story.meta.id, 'pnj-sylvana'), cleDedupeAvatar(story.meta.id, 'pnj-sylvana'));
  assert.notEqual(
    cleDedupeAvatar(story.meta.id, 'pnj-sylvana', 'force-1'),
    cleDedupeAvatar(story.meta.id, 'pnj-sylvana', 'force-2'),
  );
  assert.notEqual(cleDedupeScene(story, 'a'), cleDedupeScene(story, 'b'));
});

test('le bus visuel publie puis se désabonne sans effet résiduel', () => {
  const recus: string[] = [];
  const unsubscribe = abonnerEvenementsVisuels((event) => recus.push(event.type));
  publierEvenementVisuel({ type: 'avatar.ready', storyId: 'story-visuelle', assetId: 'pnj-sylvana', uri: 'file://portrait.png' });
  unsubscribe();
  publierEvenementVisuel({ type: 'scene.ready', storyId: 'story-visuelle', revision: '2:abc', uri: 'file://scene.png' });
  assert.deepEqual(recus, ['avatar.ready']);
});
