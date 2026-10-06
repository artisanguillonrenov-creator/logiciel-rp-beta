import assert from 'node:assert/strict';
import test from 'node:test';
import { resoudreProfilRaisonnement } from '../src/engine/reasoningPolicy';
import { nettoyerRaisonnementInterne } from '../src/engine/responseSanitizer';
import { ELYNDOR_CLOUD_MODELE } from '../src/engine/elyndorCloud';

test('le raisonnement <thinking> du narrateur Elyndor Cloud est retiré du texte RP', () => {
  const { balisesRaisonnement } = resoudreProfilRaisonnement('serveur', ELYNDOR_CLOUD_MODELE);
  const brut = '<thinking>Le joueur attaque, Drek doit mourir.</thinking>\n*La dague perce la gorge de Drek.*';
  assert.equal(nettoyerRaisonnementInterne(brut, balisesRaisonnement), '*La dague perce la gorge de Drek.*');
});
