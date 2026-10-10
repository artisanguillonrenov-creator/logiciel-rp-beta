import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUDGET_ETAT_TECHNIQUE,
  genererDeltaEtatSepare,
  lireDeltaEtatSepare,
  optionsDeltaEtatSepare,
} from '../src/engine/deltaEtatSepare';
import { MARQUEUR_ETAT, FIN_ETAT } from '../src/engine/noyauNarratif';
import {
  controlerLongueurNarration,
  plageRespectee,
} from '../src/engine/controleLongueurNarration';

const entree = {
  narrationValidee: 'SYLVANA : « Je conserve ton épée. »',
  messageJoueur: 'Je donne mon épée à Sylvana.',
  contexteCanonique: 'L’épée appartient à William.',
  storyId: 'histoire-test',
};

test('état séparé : son quota n augmente jamais la narration visible', async () => {
  const options = optionsDeltaEtatSepare(entree);
  assert.equal(options.maxTokens, BUDGET_ETAT_TECHNIQUE);
  assert.equal(options.storyId, 'histoire-test');
  assert.equal(options.messages.length, 2);
  assert.match(options.messages[1].content, /SYLVANA/);
  assert.match(options.messages[0].content, /objet JSON compact/);
  assert.match(options.messages[0].content, /ni la réécrire/);
});

test('état séparé : JSON brut et enveloppe V12 lus sans fuite dans le récit', async () => {
  const delta = { events: [{ type: 'transfer', summary: 'Sylvana reçoit une épée.' }] };
  assert.deepEqual(lireDeltaEtatSepare(JSON.stringify(delta)), delta);
  assert.deepEqual(lireDeltaEtatSepare('```json\n' + JSON.stringify(delta) + '\n```'), delta);
  assert.deepEqual(lireDeltaEtatSepare(MARQUEUR_ETAT + JSON.stringify(delta) + FIN_ETAT), delta);
  assert.equal(lireDeltaEtatSepare('SYLVANA marche dans la rue.'), null);
  assert.equal(lireDeltaEtatSepare('[]'), null);
});

test('état séparé : erreur réseau = repli heuristique sans bloquer la narration validée', async () => {
  const delta = await genererDeltaEtatSepare(entree, async () => { throw new Error('hors réseau'); });
  assert.equal(delta, null);
});

test('état séparé : transmet uniquement le récit FINAL à la génération technique', async () => {
  let narr: string | undefined;
  const delta = await genererDeltaEtatSepare(entree, async options => {
    narr = options.messages.at(-1)?.content;
    return JSON.stringify({ events: [{ type: 'transfer', summary: 'Sylvana reçoit une épée.' }] });
  });
  assert.ok(narr?.includes(entree.narrationValidee));
  assert.ok(delta?.events);
});

test('fourchette : le contrôle refuse strictement tout nombre extérieur', async () => {
  assert.equal(plageRespectee(215, { min: 215, max: 235 }), true);
  assert.equal(plageRespectee(235, { min: 215, max: 235 }), true);
  assert.equal(plageRespectee(214, { min: 215, max: 235 }), false);
  assert.equal(plageRespectee(236, { min: 215, max: 235 }), false);
  await assert.rejects(controlerLongueurNarration({
    texte: 'La réponse est complète.',
    plage: { min: 215, max: 235 },
    temperature: 0.85,
    compter: async () => null,
    reformuler: async () => { throw new Error('Ne jamais régénérer sans tokenizer'); },
  }), /Comptage exact/);
});

test('fourchette : après deux essais infructueux, aucune narration hors plage publiée', async () => {
  let tentatives = 0;
  await assert.rejects(controlerLongueurNarration({
    texte: 'La réponse est complète.',
    plage: { min: 215, max: 235 },
    temperature: 0.85,
    compter: async () => 445,
    reformuler: async () => { tentatives++; return 'Une autre réponse entière.'; },
  }), /445 tokens, attendu 215–235/);
  assert.equal(tentatives, 2);
});
