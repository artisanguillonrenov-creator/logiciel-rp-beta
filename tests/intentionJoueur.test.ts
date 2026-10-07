import assert from 'node:assert/strict';
import test from 'node:test';
import elyndorRaw from '../src/data/elyndorLore.json';
import { chargerLoreElyndor } from '../src/engine/loreLoader';
import { analyserIntention } from '../src/engine/intentionJoueur';
import { construireRolesCanon } from '../src/engine/rolesCanon';

const ROLES = construireRolesCanon(chargerLoreElyndor(elyndorRaw as any));

test('« Ok allons à la guilde » : déplacement vers la Guilde des Aventuriers', () => {
  const i = analyserIntention('Ok allons à la guilde', ROLES);
  assert.equal(i.deplacement, true);
  assert.equal(i.lieu?.type, 'guilde_aventuriers');
  assert.deepEqual(i.roles.sort(), ['maitresse_guilde', 'receptionniste']);
  assert.ok(i.fiches.includes('Maîtresses de Guilde'));
});

test('les autres guildes et lieux sont distingués', () => {
  assert.equal(analyserIntention('Je me rends à la Guilde des Ombres', ROLES).lieu?.type, 'guilde_ombres');
  assert.equal(analyserIntention("On file à l'auberge boire un coup", ROLES).lieu?.type, 'taverne');
  assert.equal(analyserIntention('Je demande audience au roi', ROLES).roles.includes('souverain'), true);
});

test('un PNJ fixé cité par son nom est repéré, une simple remarque n’est pas un déplacement', () => {
  const i = analyserIntention('Je salue Séraphine et lui tends mon rapport', ROLES);
  assert.equal(i.pnjCites[0]?.nom, 'Séraphine Duvall');
  assert.equal(analyserIntention('La guilde me doit encore de l’argent', ROLES).deplacement, false);
});

test('la requête d’ouverture du Marché aux Esclaves ne convoque pas la Guilde des Aventuriers', () => {
  const requete = [
    "[RECHERCHE D'OUVERTURE — PRIORITÉ CANON]",
    'Lieu exact : Marché aux esclaves de Paris',
    'Situation de départ : un marchand interpelle William.',
    'Priorités de recherche : territoire et pouvoir local, souverain ou autorité canonique, factions/guildes/religions applicables.',
  ].join('\n');
  const intention = analyserIntention(requete, ROLES);
  assert.equal(intention.lieu?.type, 'marche_esclaves');
  assert.ok(!intention.roles.includes('maitresse_guilde'));
  assert.ok(!intention.fiches.includes('Maîtresses de Guilde'));
});
