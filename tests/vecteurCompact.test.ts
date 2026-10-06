import assert from 'node:assert/strict';
import test from 'node:test';
import { decoderVecteur, encoderVecteur } from '../src/storage/vecteurCompact';

test('un vecteur bge-m3 survit à l’aller-retour compact, en un quart de la taille JSON', () => {
  const vecteur = Array.from({ length: 1024 }, (_, i) => Math.sin(i * 0.37) * 0.05);
  const compact = encoderVecteur(vecteur);
  const relu = decoderVecteur(compact);
  assert.equal(relu.length, 1024);
  for (let i = 0; i < vecteur.length; i++) assert.ok(Math.abs(relu[i] - vecteur[i]) < 1e-7);
  assert.ok(compact.length < JSON.stringify(vecteur).length / 3);
  // 265 entrées de lore tiennent largement sous le plafond AsyncStorage Android (6 Mo).
  assert.ok(compact.length * 265 < 1.5e6);
});

test('les longueurs non multiples de 3 octets sont décodées sans perte', () => {
  for (const v of [[1], [0.5, -2], [1, 2, 3], [-0.25, 7, 9.5, 1e-3]]) {
    assert.deepEqual(decoderVecteur(encoderVecteur(v)).map((x) => Number(x.toFixed(6))), v);
  }
});
