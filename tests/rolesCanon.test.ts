import assert from 'node:assert/strict';
import test from 'node:test';
import elyndorRaw from '../src/data/elyndorLore.json';
import { chargerLoreElyndor } from '../src/engine/loreLoader';
import { construireRolesCanon, prenomRole, rolesDeLaVille } from '../src/engine/rolesCanon';

const ROLES = construireRolesCanon(chargerLoreElyndor(elyndorRaw as any));

test('l’annuaire lit les rôles fixés de Paris dans les fiches récurrentes', () => {
  const paris = rolesDeLaVille(ROLES, 'Paris');
  const par = Object.fromEntries(paris.map((r) => [r.role, r.nom]));
  assert.equal(par.maitresse_guilde, 'Séraphine Duvall');
  assert.equal(par.receptionniste, 'Margaux Fontaine');
  assert.equal(par.taverniere, 'Odette Vinchamps');
  assert.equal(par.souverain, 'Roi Henri Valmonde');
});

test('chaque capitale a sa maîtresse de guilde et le prénom d’usage ignore les titres', () => {
  assert.ok(ROLES.filter((r) => r.role === 'maitresse_guilde').length >= 14);
  const roi = rolesDeLaVille(ROLES, 'paris', ['souverain'])[0];
  assert.equal(prenomRole(roi), 'Henri');
});
