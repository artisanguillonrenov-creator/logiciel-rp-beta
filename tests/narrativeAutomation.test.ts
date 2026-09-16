import assert from 'node:assert/strict';
import test from 'node:test';
import { creerNouvelleHistoire } from '../src/engine/story';
import { calculerRevisionNarrative } from '../src/automation/storyRevision';
import {
  abonnerSauvegardesNarratives,
  publierSauvegardeNarrative,
  reinitialiserStoryEventsPourTests,
} from '../src/automation/storyEvents';
import { creerDepotHistoires } from '../src/storage/storyRepository';
import { migrerHistoire } from '../src/storage/storyMigration';
import type { HistoireStockee, StockageHistoires } from '../src/storage/storySerialization';

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
  story.meta.id = 'story-auto';
  story.messages = [
    { id: 'u1', role: 'user', content: 'J’entre dans la ville.', timestamp: 1 },
    { id: 'a1', role: 'assistant', content: 'La porte se referme derrière toi.', timestamp: 2 },
  ];
  return story;
}

function ancienVide() {
  return {
    getAllKeys: async () => [] as string[],
    getItem: async () => null,
    removeItem: async () => {},
  };
}

function stockageMemoire(): StockageHistoires {
  const data = new Map<string, HistoireStockee>();
  return {
    lister: async () => [...data.values()].map((h) => JSON.parse(h.meta)),
    lire: async (id) => data.get(id) ? structuredClone(data.get(id)!) : null,
    ecrire: async (histoire, seulementSiAbsente = false) => {
      if (seulementSiAbsente && data.has(histoire.id)) return;
      data.set(histoire.id, structuredClone(histoire));
    },
    supprimer: async (id) => { data.delete(id); },
  };
}

test.afterEach(() => reinitialiserStoryEventsPourTests());

test('la révision narrative ignore les réactions mais change avec le texte', () => {
  const story = histoire();
  const initiale = calculerRevisionNarrative(story);
  story.messages[1].reaction = '❤️';
  assert.equal(calculerRevisionNarrative(story), initiale);
  story.messages[1].content = 'Le pont-levis se referme derrière toi.';
  assert.notEqual(calculerRevisionNarrative(story), initiale);
});

test('les événements de sauvegarde sont dédupliqués par révision narrative', () => {
  const story = histoire();
  const revisions: string[] = [];
  const unsubscribe = abonnerSauvegardesNarratives((event) => revisions.push(event.revision));
  publierSauvegardeNarrative(story);
  story.messages[0].epingle = true;
  publierSauvegardeNarrative(story);
  story.messages[0].content = 'Je traverse la porte.';
  publierSauvegardeNarrative(story);
  unsubscribe();
  assert.equal(revisions.length, 2);
  assert.notEqual(revisions[0], revisions[1]);
});

test('une écriture gardée ne peut pas écraser une révision narrative plus récente', async () => {
  const depot = creerDepotHistoires(ancienVide(), stockageMemoire(), migrerHistoire);
  const story = histoire();
  await depot.enregistrer(story);
  const revisionAncienne = calculerRevisionNarrative(story);
  const dateSession = story.meta.updatedAt;

  const appliquee = await depot.mettreAJourSi(
    story.meta.id,
    (courante) => calculerRevisionNarrative(courante) === revisionAncienne,
    (courante) => ({ ...courante, memoire: { ...courante.memoire, resume: 'Résumé calculé' } }),
  );
  assert.equal(appliquee?.memoire.resume, 'Résumé calculé');
  assert.equal(appliquee?.meta.updatedAt, dateSession);

  const plusRecente = (await depot.lire(story.meta.id))!;
  plusRecente.messages.push({ id: 'u2', role: 'user', content: 'Je continue.', timestamp: 3 });
  await depot.enregistrer(plusRecente);

  const rejetee = await depot.mettreAJourSi(
    story.meta.id,
    (courante) => calculerRevisionNarrative(courante) === revisionAncienne,
    (courante) => ({ ...courante, memoire: { ...courante.memoire, resume: 'État obsolète' } }),
  );
  assert.equal(rejetee, null);
  const finale = await depot.lire(story.meta.id);
  assert.equal(finale?.memoire.resume, 'Résumé calculé');
  assert.equal(finale?.messages.at(-1)?.id, 'u2');
});
