import test from 'node:test';
import assert from 'node:assert/strict';
import { REGLAGES_VISUELS_INITIAUX, appliquerPresetVisuel, enrichirNegatifVisuel, validerReglagesVisuels } from '../src/concepteur/reglagesVisuels';
test('visuel : valeurs par défaut identiques aux modules du générateur existant',()=>{
 const modules={ peau:0.4, elyndor:1.2, tarantino:0.35, cinema:0.5 };
 assert.deepEqual(appliquerPresetVisuel(modules, {...REGLAGES_VISUELS_INITIAUX}),modules);
 assert.equal(enrichirNegatifVisuel('watermark', {...REGLAGES_VISUELS_INITIAUX}),'watermark');
});
test('visuel : intensité et preset influencent directement les poids envoyables au modèle',()=>{
 const modules={elyndor:1.2,tarantino:0.5,cinema:0.5};
 const v={...REGLAGES_VISUELS_INITIAUX,preset:'nerveux' as const,intensite:1.2};
 const r=appliquerPresetVisuel(modules,v);
 assert.equal(r.elyndor,1.44);assert.equal(r.tarantino,0.75);assert.equal(r.cinema,0.63);
 assert.equal(modules.elyndor,1.2);
 assert.equal(enrichirNegatifVisuel('watermark',{...v,negatifAdditionnel:'flou'}),'watermark, flou');
});
test('visuel : import incompatible ou démesuré refusé',()=>{
 assert.throws(()=>validerReglagesVisuels({...REGLAGES_VISUELS_INITIAUX,intensite:50}));
 assert.throws(()=>validerReglagesVisuels({...REGLAGES_VISUELS_INITIAUX,preset:'desactiver_securite'}));
 assert.throws(()=>validerReglagesVisuels({...REGLAGES_VISUELS_INITIAUX,negatifAdditionnel:'a'.repeat(351)}));
});

test('visuel : migration des anciennes préférences conservées et nouvelles options de scènes appliquées', () => {
  const oldConfig = { schema: 1, preset: 'nerveux', intensite: 1.2, negatifAdditionnel: 'grain agressif' };
  const restored = validerReglagesVisuels(oldConfig);
  assert.equal(restored.preset, 'nerveux');
  assert.equal(restored.intensite, 1.2);
  assert.equal(restored.negatifAdditionnel, 'grain agressif');
  assert.equal(restored.cadrageIllustration, 'large');
  assert.equal(restored.prioriteIllustration, 'decor');
  assert.equal(restored.eviterPortraitScene, true);
  assert.equal(restored.referencesPersonnagesScene, false);
});

test('visuel : refus des choix inconnus et maintien des réglages existants', () => {
  assert.throws(() => validerReglagesVisuels({...REGLAGES_VISUELS_INITIAUX, cadrageIllustration: 'selfie'}));
  assert.throws(() => validerReglagesVisuels({...REGLAGES_VISUELS_INITIAUX, prioriteIllustration: 'headshot'}));
  assert.throws(() => validerReglagesVisuels({...REGLAGES_VISUELS_INITIAUX, referencesPersonnagesScene: 'oui'}));
  assert.deepEqual(validerReglagesVisuels({...REGLAGES_VISUELS_INITIAUX}), REGLAGES_VISUELS_INITIAUX);
});

test('anciens réglages visuels conservés, nouveaux contrôles de scène initialisés',()=>{
  const ancien={schema:1,preset:'nerveux',intensite:1.2,negatifAdditionnel:'artefacts'};
  const v=validerReglagesVisuels(ancien);
  assert.equal(v.preset,'nerveux');
  assert.equal(v.intensite,1.2);
  assert.equal(v.negatifAdditionnel,'artefacts');
  assert.equal(v.cadrageIllustration,'large');
  assert.equal(v.prioriteIllustration,'decor');
  assert.equal(v.eviterPortraitScene,true);
  assert.equal(v.referencesPersonnagesScene,false);
  assert.throws(()=>validerReglagesVisuels({...v,cadrageIllustration:'portrait'}));
  assert.throws(()=>validerReglagesVisuels({...v,referencesPersonnagesScene:'oui'}));
});
