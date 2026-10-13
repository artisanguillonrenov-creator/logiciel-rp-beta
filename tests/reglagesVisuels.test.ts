import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NEGATIF_GLOBAL_PAR_DEFAUT,
  REGLAGES_VISUELS_INITIAUX,
  STYLE_PAR_DEFAUT,
  anciennesConsignesArchivees,
  migrerReglagesVisuels,
  modulesPourFormat,
  motsClesStyle,
  reglagesVisuelsInitiaux,
  repartirElements,
  restaurerStyleParDefaut,
  validerReglagesVisuels,
} from '../src/concepteur/reglagesVisuels';
import {
  CLE_REGLAGES_VISUELS_V1,
  CLE_REGLAGES_VISUELS_V3,
  creerDepotReglagesVisuels,
} from '../src/concepteur/reglagesVisuelsStore';

/** Configuration V2 réelle (schéma 1) avec consignes et négatifs personnalisés. */
const ANCIENNE = {
  schema: 1, preset: 'nerveux', intensite: 1.2, negatifAdditionnel: 'grain agressif',
  cadrageIllustration: 'ensemble', prioriteIllustration: 'action', eviterPortraitScene: false,
  referencesPersonnagesScene: true, referencesScenePrecedente: false,
  tailleScene: '1536x864', taillePortrait: '960x1280',
  pasScene: 30, pasPortrait: null, guidanceScene: 6.5, guidancePortrait: 4,
  graineScene: 42, grainePortrait: null, poidsReferenceRacePortrait: 0.6,
  modulesScene: { cinema: 0.7 }, modulesPortrait: { peau: 0.5 },
  positifScene: 'sharp focus, wide angle, rich detail', positifPortrait: 'sharp focus, soft rim light',
  negatifScene: 'blurry, cropped heads', negatifPortrait: 'blurry, double chin',
  consigneNarrateurScene: 'Ma consigne scène : (N years old)1.2 Lustify', consigneNarrateurPortrait: 'Ma consigne portrait',
};

function memoire(initial: Record<string, string> = {}) {
  const valeurs = new Map(Object.entries(initial));
  return {
    valeurs,
    stockage: () => ({
      getItem: async (cle: string) => valeurs.get(cle) ?? null,
      setItem: async (cle: string, valeur: string) => { valeurs.set(cle, valeur); },
    }),
  };
}

test('V17 — migration V2 → V3 sans perte : valeurs conservées, consignes archivées et inactives', () => {
  const { reglages, migre, notes } = migrerReglagesVisuels(ANCIENNE, 1000);
  assert.equal(migre, true);
  assert.equal(reglages.schema, 3);
  assert.equal(reglages.intensite, 1.2);
  assert.equal(reglages.cadrageIllustration, 'ensemble');
  assert.equal(reglages.prioriteIllustration, 'action');
  assert.equal(reglages.eviterPortraitScene, false);
  assert.equal(reglages.references.personnages, true);
  assert.equal(reglages.references.scenePrecedente, false);
  assert.deepEqual([reglages.scene.taille, reglages.portrait.taille], ['1536x864', '960x1280']);
  assert.deepEqual([reglages.scene.pas, reglages.scene.guidance, reglages.scene.graine], [30, 6.5, 42]);
  assert.deepEqual([reglages.portrait.guidance, reglages.portrait.poidsReferenceRace], [4, 0.6]);
  assert.deepEqual(reglages.scene.modules, { cinema: 0.7 });
  assert.deepEqual(reglages.portrait.modules, { peau: 0.5 });
  // Commun → global ; spécifique → précision de format (pas un second style).
  assert.equal(reglages.positif, 'sharp focus');
  assert.equal(reglages.scene.positif, 'wide angle, rich detail');
  assert.equal(reglages.portrait.positif, 'soft rim light');
  assert.match(reglages.negatif, /blurry/);
  assert.match(reglages.negatif, /grain agressif/);
  assert.equal(reglages.scene.negatif, 'cropped heads');
  assert.equal(reglages.portrait.negatif, 'double chin');
  // Aucune consigne parallèle active : une seule consigne universelle (d'origine).
  assert.equal(reglages.consigneExtraction, null);
  assert.equal('consigneNarrateurScene' in reglages, false);
  assert.deepEqual(anciennesConsignesArchivees(reglages).map((c) => c.texte), [ANCIENNE.consigneNarrateurScene, ANCIENNE.consigneNarrateurPortrait]);
  // Tout l'ancien objet est récupérable, y compris les modules implicites d'avant.
  assert.deepEqual({ ...reglages.archives[0].valeurs, modulesImplicites: undefined }, { ...ANCIENNE, modulesImplicites: undefined });
  assert.ok(notes.some((n) => /nerveux/.test(n)));
  assert.ok(notes.some((n) => /Consigne narrateur « scènes »/.test(n)));
  // Les modules implicites ne sont plus envoyés.
  assert.deepEqual(modulesPourFormat(reglages, 'scene'), { cinema: 0.7 });
});

test('migration idempotente et configuration V1 minimale', () => {
  const premiere = migrerReglagesVisuels(ANCIENNE, 1000).reglages;
  const seconde = migrerReglagesVisuels(premiere, 2000);
  assert.equal(seconde.migre, false);
  assert.deepEqual(seconde.reglages, premiere);
  const minimale = migrerReglagesVisuels({ schema: 1, preset: 'elyndor', intensite: 1, negatifAdditionnel: '' }).reglages;
  assert.equal(minimale.negatif, NEGATIF_GLOBAL_PAR_DEFAUT);
  assert.deepEqual(minimale.style, STYLE_PAR_DEFAUT);
  assert.deepEqual(repartirElements('a, b', 'b, c'), { commun: ['b'], scene: ['a'], portrait: ['c'] });
  assert.throws(() => migrerReglagesVisuels('texte'), /illisible/);
});

test('validation : valeurs hors limites refusées, défauts valides', () => {
  assert.deepEqual(validerReglagesVisuels(reglagesVisuelsInitiaux()), { ...REGLAGES_VISUELS_INITIAUX, archives: [] });
  assert.throws(() => validerReglagesVisuels({ ...reglagesVisuelsInitiaux(), intensite: 50 }));
  assert.throws(() => validerReglagesVisuels({ ...reglagesVisuelsInitiaux(), cadrageIllustration: 'selfie' }));
  assert.throws(() => validerReglagesVisuels({ ...reglagesVisuelsInitiaux(), modules: { 'nom invalide!': 1 } }));
  assert.throws(() => validerReglagesVisuels({ ...reglagesVisuelsInitiaux(), style: { ...STYLE_PAR_DEFAUT, motsCles: '' } }));
  assert.throws(() => validerReglagesVisuels({ ...reglagesVisuelsInitiaux(), scene: { ...reglagesVisuelsInitiaux().scene, taille: '640x480' } }));
});

test('V18 — restaurer le style ne touche à rien d’autre', () => {
  const personnalise = { ...migrerReglagesVisuels(ANCIENNE, 1000).reglages, style: { nom: 'Noir', motsCles: 'noir film', description: 'x' }, intensite: 0.8 };
  const restaure = restaurerStyleParDefaut(personnalise);
  assert.deepEqual(restaure.style, STYLE_PAR_DEFAUT);
  assert.equal(restaure.intensite, 1);
  assert.deepEqual({ ...restaure, style: null, intensite: null }, { ...personnalise, style: null, intensite: null });
});

test('intensité du style : sobre, normal, appuyé — le style reste le même', () => {
  const base = reglagesVisuelsInitiaux();
  const tous = motsClesStyle(base);
  assert.ok(tous.includes('Quentin Tarantino style cinematography'));
  assert.ok(motsClesStyle({ ...base, intensite: 0.7 }).length < tous.length);
  assert.deepEqual(motsClesStyle({ ...base, intensite: 1.3 }), [...tous, 'strongly stylized']);
});

test('V25 — réglages persistés et relus après redémarrage ; ancienne clé jamais modifiée', async () => {
  const disque = memoire({ [CLE_REGLAGES_VISUELS_V1]: JSON.stringify(ANCIENNE) });
  const depot = creerDepotReglagesVisuels(disque.stockage);
  const lus = await depot.lire();
  assert.equal(lus.scene.graine, 42);
  assert.ok(disque.valeurs.has(CLE_REGLAGES_VISUELS_V3));
  assert.equal(disque.valeurs.get(CLE_REGLAGES_VISUELS_V1), JSON.stringify(ANCIENNE));
  assert.ok(depot.notesMigration().length > 0);

  await depot.enregistrer({ ...lus, positif: 'volumetric fog', style: { ...lus.style, nom: 'Mon style' } });
  // « Redémarrage » : nouveau dépôt, même disque.
  const relu = await creerDepotReglagesVisuels(disque.stockage).lire();
  assert.equal(relu.positif, 'volumetric fog');
  assert.equal(relu.style.nom, 'Mon style');
  assert.ok(relu.majLe > 0);
  assert.equal(disque.valeurs.get(CLE_REGLAGES_VISUELS_V1), JSON.stringify(ANCIENNE));

  // Retour arrière : nouvelle conversion depuis l'ancienne configuration.
  const remigre = await creerDepotReglagesVisuels(disque.stockage).remigrer();
  assert.equal(remigre.positif, 'sharp focus');
});

test('installation neuve : défauts V3, style Tarantino, aucun module', async () => {
  const disque = memoire();
  const lus = await creerDepotReglagesVisuels(disque.stockage).lire();
  assert.equal(lus.style.nom, 'Cinéma façon Quentin Tarantino');
  assert.deepEqual(lus.modules, {});
  assert.equal(disque.valeurs.size, 0, 'aucune écriture à la simple lecture des défauts');
});

test('contenu corrompu : erreur remontée, rien n’est écrasé', async () => {
  const disque = memoire({ [CLE_REGLAGES_VISUELS_V3]: '{"schema":3,"style":null}' });
  await assert.rejects(creerDepotReglagesVisuels(disque.stockage).lire());
  assert.equal(disque.valeurs.get(CLE_REGLAGES_VISUELS_V3), '{"schema":3,"style":null}');
});
