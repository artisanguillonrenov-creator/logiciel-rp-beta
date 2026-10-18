import assert from 'node:assert/strict';
import test from 'node:test';
import { genererNarrationAvecCloture } from '../src/engine/clotureNarration';
import { controlerLongueurNarration } from '../src/engine/controleLongueurNarration';
import type { AppelModeleOptions } from '../src/engine/elyndorCloudClient';

const options: AppelModeleOptions = {
  apiKey: '', model: '', temperature: 0.85,
  messages: [
    { role: 'system', content: 'Narrateur du monde Elyndor.' },
    { role: 'user', content: 'Continue la scène.' },
  ],
};

test('le moteur fixe MAX sans injecter de longueur dans le prompt', async () => {
  const appels: AppelModeleOptions[] = [];
  const sortie = await genererNarrationAvecCloture(options, { min: 215, max: 235 },
    async requete => { appels.push(requete); return ' La porte du château reste fermée. '; });
  assert.equal(appels.length, 1);
  assert.equal(appels[0].maxTokens, 235);
  assert.deepEqual(appels[0].messages, options.messages);
  assert.equal(appels[0].messages[0].content, 'Narrateur du monde Elyndor.');
  assert.equal(appels[0].messages[1].content, 'Continue la scène.');
  assert.equal(sortie, 'La porte du château reste fermée.');
});

test('une réponse courte reste jouable sans seconde requête ni message technique', async () => {
  let nombreAppels = 0;
  const sortie = await genererNarrationAvecCloture(options, { min: 215, max: 235 },
    async () => { nombreAppels++; return 'La porte claque.'; });
  assert.equal(nombreAppels, 1);
  assert.equal(sortie, 'La porte claque.');
});

test('la borne de longueur change seulement maxTokens, sans changer les messages', async () => {
  const longueurs = [
    { min: 140, max: 160 },
    { min: 215, max: 235 },
    { min: 280, max: 320 },
  ];
  for (const plage of longueurs) {
    let recu: AppelModeleOptions | undefined;
    await genererNarrationAvecCloture(options, plage, async requete => {
      recu = requete;
      return 'Fin de scène.';
    });
    assert.equal(recu?.maxTokens, plage.max);
    assert.deepEqual(recu?.messages, options.messages);
  }
});

test('le comptage reste informatif et ne rejette pas une réponse trop courte', async () => {
  const sortie = await genererNarrationAvecCloture(options, { min: 215, max: 235 },
    async () => 'La porte reste ouverte.');
  const controle = await controlerLongueurNarration({
    texte: sortie, plage: { min: 215, max: 235 }, temperature: 0.85,
    compter: async () => 12,
  });
  assert.equal(controle.texte, sortie);
  assert.equal(controle.conforme, false);
  assert.equal(controle.corrige, false);
});

test('une fourchette invalide est refusée avant tout appel IA', async () => {
  let appels = 0;
  await assert.rejects(
    genererNarrationAvecCloture(options, { min: 235, max: 215 },
      async () => { appels++; return 'Texte'; }),
    /Fourchette narrative incorrecte/,
  );
  assert.equal(appels, 0);
});
