import assert from 'node:assert/strict';
import test from 'node:test';
import { resumerVerificationMiseAJour, type UpdateCheckSnapshot } from '../src/automation/updateCheckState';

function snapshot(disponible: boolean, checkedAt = 1000): UpdateCheckSnapshot {
  return {
    checkedAt,
    info: { versionActuelle: '1.0.0', derniereVersion: disponible ? '1.1.0' : '1.0.0', disponible, url: 'https://github.com/x' },
  };
}

test('la pastille ne s’affiche que si le résultat stocké annonce une version plus récente', () => {
  assert.equal(resumerVerificationMiseAJour(null).disponible, false);
  assert.equal(resumerVerificationMiseAJour(snapshot(false)).disponible, false);
  assert.equal(resumerVerificationMiseAJour(snapshot(true)).disponible, true);
});

test('une vérification échouée après le dernier succès est signalée sans effacer le résultat stocké', () => {
  const etat = resumerVerificationMiseAJour(snapshot(true, 1000), { at: 2000, ok: false, error: 'Hors ligne' });
  assert.equal(etat.erreur, 'Hors ligne');
  assert.equal(etat.disponible, true);
  assert.equal(etat.snapshot?.info.derniereVersion, '1.1.0');
});

test('un échec plus ancien que le dernier succès est ignoré', () => {
  assert.equal(resumerVerificationMiseAJour(snapshot(false, 3000), { at: 2000, ok: false, error: 'Hors ligne' }).erreur, undefined);
  assert.equal(resumerVerificationMiseAJour(snapshot(false, 3000), { at: 3000, ok: true }).erreur, undefined);
  assert.equal(resumerVerificationMiseAJour(null, { at: 1, ok: false }).erreur, 'Vérification impossible pour le moment.');
});
