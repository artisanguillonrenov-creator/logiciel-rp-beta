import assert from 'node:assert/strict';
import test from 'node:test';
import { REGLAGES_VISUELS_INITIAUX } from '../src/concepteur/reglagesVisuels';
import {
  preparerRequeteApercuImage,
  preparerRequetePortrait,
  preparerRequeteScene,
} from '../src/engine/requetesVisuelles';
import { personnageSceneVide, structureDeRepli } from '../src/engine/visualBible';
import type { ReferenceVisuelle } from '../src/engine/visualState';

test('aperçu scène : utilise immédiatement les réglages modifiés sans sauvegarde', () => {
  const modifies = {
    ...REGLAGES_VISUELS_INITIAUX,
    tailleScene: '1536x864' as const,
    pasScene: 28,
    guidanceScene: 6,
    graineScene: 1234,
    positifScene: 'cinematic diagonal action',
    negatifScene: 'flat static composition',
    negatifAdditionnel: 'bad logo',
    modulesScene: { cinema: 0.7, elyndor: 0.8 },
  };
  const requete = preparerRequeteApercuImage({
    prompt: 'dark elf warrior lunges at an orc in a ruined tavern',
    negatif: 'foggy faces',
    format: '16:9',
    profilScene: 'combat',
    reglages: modifies,
    profilContenu: 'adulte',
  });
  assert.equal(requete.format, '16:9');
  assert.equal(requete.size, '1536x864');
  assert.equal(requete.steps, 28);
  assert.equal(requete.guidance, 6);
  assert.equal(requete.seed, 1234);
  assert.equal(requete.modules?.cinema, 0.7);
  assert.equal(requete.modules?.elyndor, 0.8);
  assert.match(requete.promptCourt ?? '', /^elyndor style, Director Quentin Tarantino style, cinematic diagonal action/);
  assert.match(requete.promptCourt ?? '', /story action and interaction/);
  assert.match(requete.negatif ?? '', /flat static composition/);
  assert.match(requete.negatif ?? '', /bad logo/);
  assert.match(requete.negatif ?? '', /foggy faces/);
  assert.equal(requete.references.length, 0);
  assert.equal(REGLAGES_VISUELS_INITIAUX.positifScene, '');
});

test('aperçu portrait : ne réutilise ni les modules ni le cadrage de la scène', () => {
  const reglages = {
    ...REGLAGES_VISUELS_INITIAUX,
    taillePortrait: '960x1280' as const,
    pasPortrait: 33,
    guidancePortrait: 7,
    grainePortrait: 345,
    positifPortrait: 'sidelight face detail',
    negatifPortrait: 'blurred eye',
    modulesPortrait: { elyndor: 0.6 },
    modulesScene: { elyndor: 1.3 },
    pasScene: 11,
  };
  const requete = preparerRequeteApercuImage({
    prompt: 'silver-haired dark elf woman with golden eyes',
    format: '3:4',
    reglages,
    profilContenu: 'grand_public',
  });
  assert.equal(requete.format, '3:4');
  assert.equal(requete.size, '960x1280');
  assert.equal(requete.steps, 33);
  assert.equal(requete.guidance, 7);
  assert.equal(requete.seed, 345);
  assert.equal(requete.modules?.elyndor, 0.6);
  assert.match(requete.promptCourt ?? '', /cinematic portrait/);
  assert.match(requete.promptCourt ?? '', /sidelight face detail/);
  assert.doesNotMatch(requete.promptCourt ?? '', /environmental storytelling/);
  assert.match(requete.negatif ?? '', /blurred eye/);
  assert.match(requete.negatif ?? '', /nsfw/);
  assert.deepEqual(requete.references, []);
});

test('scène réelle : privilégie les portraits individuels et ne cite que les références transmises', () => {
  const refs: ReferenceVisuelle[] = [
    { type: 'joueur-avatar', uri: 'data:avatar', libelle: 'avatar William' },
    { type: 'joueur-portrait', uri: 'data:race', libelle: 'portrait race et sexe' },
    { type: 'pnj-principal', uri: 'data:sylvana', libelle: 'avatar Sylvana' },
    { type: 'scene-precedente', uri: 'data:ancienne', libelle: 'ancienne scène' },
  ];
  const structure = {
    ...structureDeRepli({
      profil: 'combat',
      personnages: [personnageSceneVide('William'), personnageSceneVide('Sylvana')],
      texteScene: 'William et Sylvana combattent ensemble sous la pluie.',
      lieu: 'Paris',
    }),
    promptSdxl: 'two armored fighters running in the rain, dynamic full scene',
  };
  const active = preparerRequeteScene(structure, refs, REGLAGES_VISUELS_INITIAUX, 'adulte');
  assert.deepEqual(active.references, [
    { role: 'personnage', image: 'data:avatar' },
    { role: 'personnage', image: 'data:sylvana' },
    { role: 'scene', image: 'data:ancienne' },
  ]);
  assert.match(active.prompt, /avatar William/);
  assert.match(active.prompt, /avatar Sylvana/);
  assert.doesNotMatch(active.prompt, /portrait race et sexe/);
  const sansReferences = preparerRequeteScene(structure, refs, {
    ...REGLAGES_VISUELS_INITIAUX,
    referencesPersonnagesScene: false,
    referencesScenePrecedente: false,
  }, 'adulte');
  assert.deepEqual(sansReferences.references, []);
  assert.doesNotMatch(sansReferences.prompt, /avatar William/);
  assert.doesNotMatch(sansReferences.prompt, /ancienne scène/);
});

test('portrait réel : transmet la référence de race séparément du cadrage 3:4', () => {
  const requete = preparerRequetePortrait(
    'Portrait de Sylvana',
    'dark elf woman, white braided hair',
    [{ role: 'race', image: 'data:race-elfe-noire' }],
    { ...REGLAGES_VISUELS_INITIAUX, poidsReferenceRacePortrait: 0.45 },
    'adulte',
  );
  assert.equal(requete.format, '3:4');
  assert.equal(requete.poidsRace, 0.45);
  assert.deepEqual(requete.references, [{ role: 'race', image: 'data:race-elfe-noire' }]);
});
