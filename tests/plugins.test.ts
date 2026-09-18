import assert from 'node:assert/strict';
import test from 'node:test';
import { analyserPackJson } from '../src/engine/plugins';

test('un pack est limité en nombre et en taille d’entrée', () => {
  assert.throws(
    () => analyserPackJson('Trop gros', JSON.stringify(Array.from({ length: 51 }, () => ({ titre: 'x', contenu: 'y' })))),
    /ne peut pas dépasser 50 entrées/,
  );
  assert.throws(
    () => analyserPackJson('Trop long', JSON.stringify([{ titre: 'x', contenu: 'x'.repeat(6001) }])),
    /trop longue/,
  );
});

test('un nom de pack est borné sans modifier le contenu', () => {
  const plugin = analyserPackJson('n'.repeat(200), JSON.stringify([{ titre: 'Lieu', contenu: 'Description' }]));
  assert.equal(plugin.nom.length, 120);
  assert.equal(plugin.entrees[0].contenu, 'Description');
});
