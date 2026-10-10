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

function mots(texte: string): Promise<number> {
  return Promise.resolve(texte.trim().split(/\s+/).filter(Boolean).length);
}

test('le seuil MIN déclenche une nouvelle phase limitée à MAX - MIN', async () => {
  const appels: AppelModeleOptions[] = [];
  const sortie = await genererNarrationAvecCloture(options, { min: 5, max: 9 },
    async appel => {
      appels.push(appel);
      return appels.length === 1 ? 'La porte du château reste' : 'fermée.';
    }, mots);
  assert.equal(appels.length, 2);
  assert.equal(appels[0].maxTokens, 5);
  assert.equal(appels[1].maxTokens, 4);
  assert.match(appels[1].messages.at(-1)?.content ?? '', /conclusion/i);
  assert.equal(sortie, 'La porte du château reste fermée.');
  assert.equal(await mots(sortie), 6);
});

test('une réponse déjà complète à MIN ne consomme aucun second appel', async () => {
  let nombreAppels = 0;
  const sortie = await genererNarrationAvecCloture(options, { min: 3, max: 8 },
    async () => { nombreAppels++; return 'La porte claque.'; }, mots);
  assert.equal(nombreAppels, 1);
  assert.equal(sortie, 'La porte claque.');
});

test('la plage 215–235 garde ses bornes et sa continuation max 20', async () => {
  const appels: AppelModeleOptions[] = [];
  const brouillon = 'La '.repeat(214) + 'suite';
  const sortie = await genererNarrationAvecCloture(options, { min: 215, max: 235 },
    async opts => {
      appels.push(opts);
      return appels.length === 1 ? brouillon : 's’achève.';
    }, mots);
  assert.equal(appels[0].maxTokens, 215);
  assert.equal(appels[1].maxTokens, 20);
  assert.equal(await mots(sortie), 216);
  const controle = await controlerLongueurNarration({
    texte: sortie, plage: { min: 215, max: 235 }, temperature: 0.85,
    compter: mots,
    reformuler: async () => { throw new Error('Pas besoin de régénérer'); },
  });
  assert.equal(controle.conforme, true);
});

test('si le tokenizer échoue, la phase 2 ne consomme pas de GPU pour rien', async () => {
  let nombreAppels = 0;
  const sortie = await genererNarrationAvecCloture(options, { min: 215, max: 235 },
    async () => { nombreAppels++; return 'La porte reste ouverte.'; },
    async () => null);
  assert.equal(nombreAppels, 1);
  const controle = await controlerLongueurNarration({
    texte: sortie, plage: { min: 215, max: 235 }, temperature: 0.85,
    compter: async () => null,
  });
  assert.equal(controle.texte, sortie);
  assert.equal(controle.verification, 'indisponible');
  assert.equal(controle.conforme, false);
});
