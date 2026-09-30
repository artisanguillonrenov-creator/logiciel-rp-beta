import assert from 'node:assert/strict';
import test from 'node:test';
import { ancresCanoniques, prioriserLoreCanon, verifierEntitesCanoniques } from '../src/engine/canonGuard';
import type { LoreEntry, StoryState } from '../src/types';

function storyVide(): StoryState {
  return {
    version: 12,
    meta: {
      id: 'test', personnageNom: 'William', personnageDescription: '', pointDeDepart: '',
      contexte: { lieu: 'Paris', ambiance: '', dateChronique: '', objectifs: '' },
      createdAt: 1, updatedAt: 1,
    },
    messages: [],
    memoire: { resume: '', faits: [], dernierMessageIndexMaj: 0 },
    loreEmergent: [],
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
    directeur: { arcActuel: '', tension: 'calme', dernierBeatIndex: 0, beats: [] },
    monde: { zones: [], flags: {}, compteurs: {}, declencheurs: [] },
    social: { engagements: [], relations: [] },
  };
}

test('une requête territoriale remonte le royaume canonique avant le lore ordinaire', () => {
  const ancres = ancresCanoniques('Je suis à Paris, dans le royaume local.');
  assert.ok(ancres.length >= 1);
  assert.ok(ancres.every((e) => e.titre.startsWith('[ROYAUME] ')));

  const ordinaire: LoreEntry = { id: 'autre', titre: '[TEST] Autre', contenu: 'Autre contenu', score: 0.99 };
  const resultat = prioriserLoreCanon('Je suis à Paris, dans le royaume local.', [ordinaire]);
  assert.ok(resultat.length >= 2);
  assert.notEqual(resultat[0].id, 'autre');
  assert.equal(new Set(resultat.map((e) => e.id)).size, resultat.length);
});

test('une macro-entité inventée est bloquée et devient patchable localement', () => {
  const rapport = verifierEntitesCanoniques(
    'Le Roi Zorgath exige que tous obéissent à la Guilde des Astres Pourpres.',
    storyVide(),
    'Je regarde autour de moi.',
  );
  assert.equal(rapport.ok, false);
  assert.ok(rapport.checks.some((c) => c.nom === 'canon' && c.nomCorrect === 'souverain local'));
  assert.ok(rapport.checks.some((c) => c.nom === 'canon' && c.nomCorrect === 'institution locale'));
});

test('une entité déjà établie dans le transcript n’est pas rejetée', () => {
  const story = storyVide();
  story.messages.push({ id: 'm1', role: 'assistant', content: 'Le Roi Zorgath règne ici.', timestamp: 1 });
  const rapport = verifierEntitesCanoniques('Le Roi Zorgath entre dans la salle.', story, 'Je l’attends.');
  assert.equal(rapport.ok, true);
});
