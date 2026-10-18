import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLES_SAMPLERS, reglagesNarrateurDefaut, samplersPourRequete, validerReglagesNarrateur,
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
  assert.equal('margeTokensEtat' in migree.profils.benchmark, false);
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

test('le contrôle final recalcule les tokens après suppression d une fin incomplète', async () => {
  let correctionsIA = 0;
  const sortie = await controlerLongueurNarration({
    texte: 'Une bonne phrase. Une fin sans', plage: { min: 12, max: 22 }, temperature: 0.7,
    compter: async texte => texte.length,
    reformuler: async () => { correctionsIA++; return 'Réponse réécrite.'; },
  });
  assert.equal(sortie.texte, 'Une bonne phrase.');
  assert.equal(sortie.tokens, 'Une bonne phrase.'.length);
  assert.equal(sortie.conforme, true);
  assert.equal(sortie.corrige, true);
  assert.equal(correctionsIA, 0);
});

test('une narration inférieure au minimum est publiée sans bloquer', async () => {
  const sortie = await controlerLongueurNarration({
    texte: 'Un récit court.', plage: { min: 140, max: 160 }, temperature: 0.7,
    compter: async texte => texte.length,
  });
  assert.equal(sortie.texte, 'Un récit court.');
  assert.equal(sortie.conforme, false);
});

test('tokenizer inaccessible : le récit peut continuer sans certification', async () => {
  const sortie = await controlerLongueurNarration({
    texte: 'Un récit complet.', plage: { min: 140, max: 160 }, temperature: 0.7,
    compter: async () => null,
  });
  assert.equal(sortie.texte, 'Un récit complet.');
  assert.equal(sortie.verification, 'indisponible');
});

test('sans tokenizer et sans phrase terminée, préserver un message non vide', async () => {
  let reformulations = 0;
  const sortie = await controlerLongueurNarration({
    texte: 'La porte commence à', plage: { min: 140, max: 160 }, temperature: 0.7,
    compter: async () => null,
    reformuler: async () => { reformulations++; return 'Autre réponse'; },
  });
  assert.equal(sortie.texte, 'La porte commence à');
  assert.equal(sortie.corrige, false);
  assert.equal(reformulations, 0);
});
