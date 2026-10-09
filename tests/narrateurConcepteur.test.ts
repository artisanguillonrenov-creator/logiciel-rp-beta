import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLES_SAMPLERS, reglagesNarrateurDefaut, samplersPourRequete, validerReglagesNarrateur,
  consigneLongueur,
} from '../src/concepteur/reglagesNarrateur';
import { creerConfigurationAtelier, validerConfigurationAtelier, analyserInstantaneAtelier } from '../src/concepteur/configuration';
import { finDeNarrationComplete, plageRespectee, controlerLongueurNarration } from '../src/engine/controleLongueurNarration';

test('19 curseurs réels sont exposés et strictement validés', () => {
  const r = reglagesNarrateurDefaut();
  assert.equal(CLES_SAMPLERS.length, 19);
  assert.deepEqual(samplersPourRequete(r), {});
  const actifs = { ...r, samplersActifs: true };
  assert.equal(samplersPourRequete(actifs).dry_multiplier, 0.8);
  assert.equal(samplersPourRequete(actifs).repeat_last_n, 512);
  assert.throws(() => validerReglagesNarrateur({ ...r, samplers: { ...r.samplers, top_p: 42 } }));
});

test('la plage Court/Moyen/Long est configurable et exprimée en tokens', () => {
  const p = reglagesNarrateurDefaut().longueurs;
  assert.deepEqual(p.courte, { min: 140, max: 160 });
  assert.deepEqual(p.moyenne, { min: 215, max: 235 });
  assert.deepEqual(p.longue, { min: 280, max: 320 });
  assert.match(consigneLongueur('courte', p), /140 et 160 tokens/);
  assert.throws(() => validerReglagesNarrateur({ ...reglagesNarrateurDefaut(),
    longueurs: { ...p, courte: { min: 180, max: 160 } } }));
});

test('ancienne configuration V1 convertie sans suppression des réglages existants', () => {
  const ancienne = creerConfigurationAtelier();
  const serialisee = JSON.parse(JSON.stringify(ancienne));
  delete serialisee.profils.production.narrateur;
  delete serialisee.profils.test.narrateur;
  delete serialisee.profils.benchmark.narrateur;
  const migree = validerConfigurationAtelier(serialisee);
  assert.equal(migree.profils.production.narrateur.longueurs.courte.max, 160);
  assert.equal(migree.profils.benchmark.margeTokensEtat, 350);
  const ancienInstantane = JSON.stringify({
    format: 'elyndor-atelier-configuration', schema: 1, configuration: serialisee,
  });
  assert.equal(analyserInstantaneAtelier(ancienInstantane).profils.production.narrateur.samplersActifs, false);
});

test('clôture naturelle : pas de morceau de phrase laissé ouvert', () => {
  assert.equal(finDeNarrationComplete('Elle ouvrit la porte.'), true);
  assert.equal(finDeNarrationComplete('ELFE : « Tu es ici. »'), true);
  assert.equal(finDeNarrationComplete('Elle ouvrit la'), false);
  assert.equal(plageRespectee(160, { min: 140, max: 160 }), true);
  assert.equal(plageRespectee(161, { min: 140, max: 160 }), false);
});

test('contrôle final vérifie après correction, avant présentation au joueur', async () => {
  let corrections = 0;
  const mesure = async (texte: string) => texte.length;
  const sortie = await controlerLongueurNarration({
    texte: 'Bien trop court.', plage: { min: 18, max: 25 }, temperature: 0.7,
    compter: mesure,
    reformuler: async () => { corrections++; return 'Une phrase se termine.'; },
  });
  assert.equal(sortie.conforme, true);
  assert.equal(sortie.corrige, true);
  assert.equal(corrections, 1);
});

test('hors limite persistante : échouer au lieu de publier une réponse non conforme', async () => {
  await assert.rejects(controlerLongueurNarration({
    texte: 'Un récit court.', plage: { min: 140, max: 160 }, temperature: 0.7,
    compter: async texte => texte.length,
    reformuler: async () => 'Un récit court.',
  }), /hors fourchette/);
});

test('tokenizer inaccessible : ne jamais prétendre un comptage exact', async () => {
  const r = await controlerLongueurNarration({
    texte: 'Un récit complet.', plage: { min: 140, max: 160 }, temperature: 0.7,
    compter: async () => null,
  });
  assert.equal(r.conforme, false);
  assert.equal(r.verification, 'indisponible');
  assert.equal(r.texte, 'Un récit complet.');
});
