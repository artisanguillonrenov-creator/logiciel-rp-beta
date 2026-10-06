import assert from 'node:assert/strict';
import test from 'node:test';
import { fusionnerDoublonsLore, memeEntiteLore } from '../src/engine/loreEmergentDoublons';
import { listerPnjVisuels } from '../src/engine/visualState';
import { indexerLocuteurs } from '../src/engine/speakerIndex';
import type { EntreeLoreEmergent, StoryState } from '../src/types';

const pnj = (id: string, titre: string, contenu: string, premiereMention: number, statut: EntreeLoreEmergent['statut'] = 'provisoire'): EntreeLoreEmergent => ({
  id, categorie: 'pnj', titre, contenu, statut, premiereMention, dernierAcces: premiereMention,
});

// Fiches réellement obtenues dans la partie « Marchés aux esclaves ».
const fiches = [
  pnj('m1', 'Marcus', 'Marchand d’esclaves des couloirs souterrains de Paris.', 1),
  pnj('m2', 'Marcus', 'Accompagne William et N’Kala hors du marché.', 7, 'permanent'),
  pnj('e1', 'Elfe Noire (N’Kala)', 'Guerrière capturée lors d’un raid corsaire.', 4),
  pnj('n1', 'N’Kala', 'Elfe noire de vingt-deux ans, guerrière, désormais au service de William.', 5),
  pnj('n2', 'N\'Kala', 'Porte une lame courbe à la ceinture.', 9),
  pnj('m3', 'marcus', 'Le marchand.', 11),
];

test('les fiches d’un même PNJ sont fusionnées, la plus ancienne garde son identifiant', () => {
  const fusion = fusionnerDoublonsLore(fiches);
  assert.deepEqual(fusion.map((e) => e.titre), ['Marcus', 'N’Kala']);
  const [marcus, nkala] = fusion;
  assert.equal(marcus.id, 'm1');
  assert.deepEqual(marcus.alias, ['m2', 'm3']);
  assert.equal(marcus.statut, 'permanent');
  assert.equal(marcus.contenu, 'Marchand d’esclaves des couloirs souterrains de Paris.');
  assert.equal(nkala.id, 'e1');
  assert.deepEqual(nkala.alias, ['n1', 'n2']);
  assert.equal(nkala.dernierAcces, 9);
});

test('des PNJ différents ou de catégories différentes restent séparés', () => {
  assert.equal(memeEntiteLore(pnj('a', 'Marcus', '', 0), pnj('b', 'Marcel', '', 0)), false);
  assert.equal(memeEntiteLore(pnj('a', 'Marcus', '', 0), { categorie: 'lieu', titre: 'Marcus' }), false);
  assert.equal(fusionnerDoublonsLore([pnj('a', 'Kaelen', '', 0), pnj('b', 'Sylvana', '', 1)]).length, 2);
});

test('la réplique retrouve son PNJ une fois les doublons fusionnés', () => {
  const story = { meta: { personnageNom: 'William' }, loreEmergent: fiches } as unknown as StoryState;
  const visibles = listerPnjVisuels(story);
  assert.equal(visibles.length, 2);
  const index = indexerLocuteurs(visibles);
  assert.equal(index.get('marcus')?.id, 'm1');
  assert.equal(index.get('n’kala')?.id, 'e1');
});
