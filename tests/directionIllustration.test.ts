import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REGLAGES_VISUELS_INITIAUX, validerReglagesVisuels,
} from '../src/concepteur/reglagesVisuels';
import {
  negatifCadrageIllustration,
  reglerDirectionIllustration,
  retirerMotsPortraitDuPromptCourt,
} from '../src/engine/directionIllustration';
import {
  construirePromptSdxl, formaterPromptImage, structureDeRepli,
} from '../src/engine/visualBible';

function scene() {
  return {
    ...structureDeRepli({
      profil: 'dialogue',
      personnages: [{
        nom: 'Vex’thara', apparence: 'elfe noire', tenue: 'armure', blessures: '',
        armesAccessoires: '', posture: 'debout', expression: 'méfiante', action: 'parle au marchand',
      }],
      texteScene: 'La guerrière parle à Maître Crossan sous les arches du marché aux esclaves.',
      lieu: 'loge marchande fortifiée',
    }),
    promptSdxl: 'cinematic portrait, (40 years old)1.2, dark elf woman, close-up portrait, merchant interior, dramatic lighting',
  };
}

test('les scènes 16:9 privilégient le décor et un plan large plutôt que le buste', () => {
  const avant = scene();
  const apres = reglerDirectionIllustration(avant, {...REGLAGES_VISUELS_INITIAUX});
  assert.equal(avant.camera.typePlan, 'plan rapproché poitrine sur deux personnages');
  assert.match(apres.camera.typePlan, /plan large de scène/);
  assert.match(apres.camera.composition, /lieu/);
  assert.equal(apres.decor.lieu, avant.decor.lieu);
  assert.deepEqual(apres.personnages, avant.personnages);
  assert.equal(apres.action, avant.action);
  assert.equal(apres.profil, avant.profil);
  const prompt = construirePromptSdxl(apres) ?? '';
  assert.match(prompt, /cinematic wide shot/);
  assert.match(prompt, /merchant interior/);
  assert.doesNotMatch(prompt, /close-up portrait/);
  assert.doesNotMatch(prompt, /cinematic portrait/);
  assert.match(formaterPromptImage(apres), /plan large de scène/);
  assert.match(negatifCadrageIllustration(REGLAGES_VISUELS_INITIAUX), /headshot/);
});

test('auto équilibré sans exclusion ne change pas le prompt du directeur artistique', () => {
  const avant = scene();
  const config = validerReglagesVisuels({
    ...REGLAGES_VISUELS_INITIAUX,
    cadrageIllustration: 'automatique',
    prioriteIllustration: 'equilibree',
    eviterPortraitScene: false,
    referencesPersonnagesScene: true,
  });
  const apres = reglerDirectionIllustration(avant, config);
  assert.strictEqual(apres, avant);
  assert.equal(negatifCadrageIllustration(config), '');
});

test('options de plan et priorité action restent sans invention de personnages', () => {
  const avant = scene();
  const apres = reglerDirectionIllustration(avant, {
    ...REGLAGES_VISUELS_INITIAUX,
    cadrageIllustration: 'ensemble',
    prioriteIllustration: 'action',
  });
  assert.match(apres.camera.typePlan, /très grand plan/);
  assert.match(construirePromptSdxl(apres) ?? '', /story action and interaction/);
  assert.equal(apres.personnages.length, 1);
  assert.deepEqual(apres.horsCadre, avant.horsCadre);
});

test('suppression limitée aux directives photographiques de portrait', () => {
  const result = retirerMotsPortraitDuPromptCourt(
    'cinematic portrait, dark elf female, close-up portrait, arched marketplace, wide shot',
  );
  assert.equal(result, 'dark elf female, arched marketplace, wide shot');
});
