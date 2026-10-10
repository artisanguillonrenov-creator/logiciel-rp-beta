import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyserInstantaneAtelier, creerConfigurationAtelier, creerInstantaneAtelier,
  modifierEtatAtelier, restaurerRevisionAtelier, validerConfigurationAtelier,
} from '../src/concepteur/configuration';

test('atelier : les profils démarrent séparément avec les réglages historiques', () => {
  const s = creerConfigurationAtelier(1000);
  assert.equal(s.profilActif, 'production');
  assert.equal(s.profils.production.budgetLorePassages, 2500);
  assert.equal(s.profils.test.maxSouvenirs, 3);
  assert.equal('margeTokensEtat' in s.profils.benchmark, false);
  assert.equal(s.historique.length, 0);
});

test('atelier : une modification de Test ne change pas Production', () => {
  const a = creerConfigurationAtelier(1000);
  const b = modifierEtatAtelier(a, {
    profilActif: 'test',
    profils: { ...a.profils, test: { ...a.profils.test, budgetLorePassages: 4000 } },
  }, 'Test A', 2000);
  assert.equal(b.profils.test.budgetLorePassages, 4000);
  assert.equal(b.profils.production.budgetLorePassages, 2500);
  assert.equal(b.numero, 2);
  assert.equal(b.historique[0].numero, 1);
  assert.equal(a.profils.test.budgetLorePassages, 2500);
  const r = restaurerRevisionAtelier(b, 1, 3000);
  assert.equal(r.profils.test.budgetLorePassages, 2500);
  assert.equal(r.numero, 3);
});

test('atelier : les paramètres hors bornes sont rejetés', () => {
  const a = creerConfigurationAtelier();
  assert.throws(() => modifierEtatAtelier(a, {
    ...a, profils: { ...a.profils, production: { ...a.profils.production, maxSouvenirs: 999 } },
  }, 'Hors limites'));
});

test('atelier : instantané portable sans secrets ni historiques de récit', () => {
  const a = creerConfigurationAtelier();
  const s = creerInstantaneAtelier(a, '1.30.0', 'commit-test');
  const json = JSON.stringify(s);
  assert.equal(s.format, 'elyndor-atelier-configuration');
  assert.equal(s.commitBundle, 'commit-test');
  assert.ok(!json.includes('openRouterApiKey'));
  assert.ok(!json.includes('runpod_api_key'));
  assert.ok(!json.includes('messages'));
  assert.deepEqual(analyserInstantaneAtelier(json).profils, a.profils);
});

test('atelier : rejette JSON malformé, formats arbitraires et versions inconnues', () => {
  const a = creerInstantaneAtelier(creerConfigurationAtelier(), '1.30', 'sha');
  assert.throws(() => analyserInstantaneAtelier('{oops'));
  assert.throws(() => analyserInstantaneAtelier(JSON.stringify({ ...a, schema: 999 })));
  assert.throws(() => analyserInstantaneAtelier(JSON.stringify({ ...a, format: 'autre' })));
  assert.throws(() => validerConfigurationAtelier({ ...creerConfigurationAtelier(), schema: 2 }));
});

test('atelier : historique borné à 20 révisions', () => {
  let conf = creerConfigurationAtelier();
  for (let i = 0; i < 30; i++) {
    conf = modifierEtatAtelier(conf, {
      ...conf,
      profils: { ...conf.profils, test: { ...conf.profils.test, budgetLorePassages: i % 2 ? 2500 : 2750 } },
    }, 'Tour ' + i, 100 + i);
  }
  assert.ok(conf.historique.length <= 20);
});


test('ancienne marge importée puis supprimée sans toucher aux autres réglages', () => {
  const s = creerConfigurationAtelier();
  const ancienne = JSON.parse(JSON.stringify(s));
  for (const profil of ['production', 'test', 'benchmark']) {
    ancienne.profils[profil].margeTokensEtat = 250;
  }
  const chargee = validerConfigurationAtelier(ancienne);
  assert.equal('margeTokensEtat' in chargee.profils.production, false);
  assert.equal(chargee.profils.production.narrateur.longueurs.moyenne.min, 215);
  assert.equal(chargee.profils.production.narrateur.longueurs.moyenne.max, 235);
  const snapshot = creerInstantaneAtelier(chargee, '1.30.0', 'test');
  assert.equal(JSON.stringify(snapshot).includes('margeTokensEtat'), false);
});
