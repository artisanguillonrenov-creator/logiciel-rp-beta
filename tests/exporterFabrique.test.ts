import assert from 'node:assert/strict';
import test from 'node:test';
import { echantillonAEcarter } from '../tools/fabrique/exporter';

test('un échantillon sexuel avec un indice de minorité est écarté du jeu d’entraînement', () => {
  assert.equal(echantillonAEcarter('Elle se déshabille, nue devant lui. Une enfant les observe depuis la porte.'), true);
  assert.equal(echantillonAEcarter('Il caresse ses seins ; elle a 16 ans.'), true);
  assert.equal(echantillonAEcarter('Elle est nue, une femme de 35 ans aux cheveux noirs.'), false);
  assert.equal(echantillonAEcarter('Les enfants jouent sur la place pendant que le marchand crie ses prix.'), false);
});

test('les mots accentués sont reconnus', () => {
  assert.equal(echantillonAEcarter('Une écolière regarde la scène pendant qu’il la pénètre.'), true);
});
