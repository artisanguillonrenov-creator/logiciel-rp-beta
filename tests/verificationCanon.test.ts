import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contradictionProbable,
  corpusCanon,
  validerRepetitionHeuristique,
  verifierEntitesCanoniques,
} from '../src/engine/verificationCanon';
import { creerNouvelleHistoire } from '../src/engine/story';
import type { StoryState } from '../src/types';

function histoire(): StoryState {
  return creerNouvelleHistoire({
    personnageNom: 'Ael',
    personnageDescription: 'Voyageuse',
    pointDeDepart: 'La porte nord',
    contexte: { lieu: 'Paris', ambiance: '', dateChronique: '', objectifs: '' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
  });
}

const LORE = [{ titre: '[ROYAUME] Paris — Royaume Humain', contenu: 'La reine Isaure règne sur Paris. La Guilde des Marchands tient le port.' }];

test('un royaume ou un souverain inventé est signalé, le canon passe', () => {
  const corpus = corpusCanon(histoire(), 'Je salue la garde.', LORE);
  assert.ok(verifierEntitesCanoniques('La reine Isaure du Royaume Humain reçoit la Guilde des Marchands.', corpus).ok);
  const rapport = verifierEntitesCanoniques('Un émissaire du Royaume de Valdoria salue le roi Aldric.', corpus);
  assert.equal(rapport.ok, false);
  assert.deepEqual(rapport.checks.map((c) => c.nomCorrect), ['autorité locale', 'souverain local']);
  assert.ok(rapport.checks.every((c) => c.gravite === 'grave' && c.nom === 'canon'));
});

test('un nom apporté par le joueur fait autorité', () => {
  const corpus = corpusCanon(histoire(), 'Je cherche le temple du Culte de Morvane.', LORE);
  assert.ok(verifierEntitesCanoniques('Les fidèles du Culte de Morvane se taisent.', corpus).ok);
});

test('répétitions : paragraphe dupliqué ou réponse recopiée', () => {
  const story = histoire();
  const paragraphe = 'La pluie battait les pavés de la ruelle tandis que les lanternes vacillaient au vent du soir.';
  assert.equal(validerRepetitionHeuristique(`${paragraphe}\n\n${paragraphe}`, story).ok, false);
  const ancienne = `${paragraphe} ${'Les gardes observent la foule depuis les remparts de la ville endormie. '.repeat(3)}`;
  const avecHistorique = { ...story, messages: [{ id: 'a', role: 'assistant' as const, content: ancienne, timestamp: 1 }] };
  assert.equal(validerRepetitionHeuristique(ancienne, avecHistorique).ok, false);
  assert.ok(validerRepetitionHeuristique('Une réponse entièrement nouvelle, qui fait avancer la scène vers le marché aux épices.', avecHistorique).ok);
});

test('la validation par le modèle n’est déclenchée que par un retournement suspect avec des faits établis', () => {
  const story = histoire();
  const reponse = 'En réalité il n’avait jamais quitté la ville.';
  assert.equal(contradictionProbable(reponse, story), false);
  const avecFaits = { ...story, memoire: { ...story.memoire, faits: [{ id: 'f', type: 'autre' as const, texte: 'Borek a quitté la ville.', niveau: 'canon' as const, dernierAcces: 0 }] } };
  assert.equal(contradictionProbable(reponse, avecFaits), true);
  assert.equal(contradictionProbable('Borek revient au matin.', avecFaits), false);
});
