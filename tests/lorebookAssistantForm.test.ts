import test from 'node:test';
import assert from 'node:assert/strict';
import { preparerFicheLoreProposee } from '../src/concepteur/lorebookAssistantForm';
import type { FicheEditable } from '../src/concepteur/lorebookModele';

const original: FicheEditable = {
  titre: 'Marchands récurrents', contenu: 'Marchands ordinaires des capitales.',
  category: 'PERSONNAGE', priority: 70, constant: false, actif: true, scope: 'CHARACTER',
  primaryKeys: ['Marchands populaires'], secondaryKeys: ['Marchands des villes'],
  negativeKeys: [], dossiers: ['Personnages/Commerçants'],
};

test('une proposition remplit tous les champs techniques sans sauvegarder', () => {
  const entree = preparerFicheLoreProposee(original, {
    titre: 'Artisans des capitales', contenu: 'Les artisans travaillent dans les quatorze capitales.',
    category: 'ARTISAN', priority: 65, constant: false, actif: true, scope: 'CITY',
    dossiers: ['Artisanat/Capitales'],
    primaryKeys: ['Artisans des capitales', 'Maîtres artisans de Paris'],
    secondaryKeys: ['Ateliers populaires', 'Ouvriers des quartiers'],
    negativeKeys: ['Artisans de la Guilde noire'],
  });
  assert.equal(entree.titre, 'Artisans des capitales');
  assert.equal(entree.contenu, 'Les artisans travaillent dans les quatorze capitales.');
  assert.equal(entree.category, 'ARTISAN');
  assert.equal(entree.priority, 65);
  assert.equal(entree.scope, 'CITY');
  assert.equal(entree.actif, true);
  assert.equal(entree.constant, false);
  assert.deepEqual(entree.dossiers, ['Artisanat/Capitales']);
  assert.deepEqual(entree.primaryKeys, ['Artisans des capitales', 'Maîtres artisans de Paris']);
  assert.deepEqual(entree.secondaryKeys, ['Ateliers populaires', 'Ouvriers des quartiers']);
  assert.deepEqual(entree.negativeKeys, ['Artisans de la Guilde noire']);
  assert.deepEqual(original.primaryKeys, ['Marchands populaires']);
});

test('les expressions de recherche identiques ne se répètent pas entre listes', () => {
  const entree = preparerFicheLoreProposee(original, {
    contenu: 'Marchands dans les quartiers populaires.',
    primaryKeys: ['Marchands populaires', 'marchands populaires', 'Paris'],
    secondaryKeys: [' PARIS ', 'Rues marchandes'],
    negativeKeys: ['rues marchandes', 'Autre maison'],
  });
  assert.deepEqual(entree.primaryKeys, ['Marchands populaires', 'Paris']);
  assert.deepEqual(entree.secondaryKeys, ['Rues marchandes']);
  assert.deepEqual(entree.negativeKeys, ['Autre maison']);
});

test('les données non proposées conservent les réglages existants et le titre sert de clé', () => {
  const entree = preparerFicheLoreProposee({ ...original, primaryKeys: [], secondaryKeys: [] }, {
    titre: 'Forgeron de Tokyo', contenu: 'Un forgeron entretient son atelier.',
    primaryKeys: [],
    secondaryKeys: [],
    negativeKeys: [],
  });
  assert.deepEqual(entree.primaryKeys, ['Forgeron de Tokyo']);
  assert.deepEqual(entree.secondaryKeys, []);
  assert.deepEqual(entree.negativeKeys, []);
  assert.equal(entree.actif, true);
  assert.equal(entree.priority, 70);
  assert.equal(entree.scope, 'CHARACTER');
  assert.deepEqual(entree.dossiers, original.dossiers);
});

test('les listes de mots-clés sont limitées à la capacité validée par la fiche', () => {
  const entree = preparerFicheLoreProposee(original, {
    contenu: 'Grande collection.',
    primaryKeys: Array.from({ length: 45 }, (_, i) => 'Personnage ' + i),
    secondaryKeys: Array.from({ length: 40 }, (_, i) => 'Surnom ' + i),
  });
  assert.equal(entree.primaryKeys.length, 32);
  assert.equal(entree.secondaryKeys.length, 32);
});

test('une proposition sans contenu narratif est rejetée sans toucher à la fiche originale', () => {
  assert.throws(() => preparerFicheLoreProposee(original, { titre: 'Vide' }), /Contenu requis/);
  assert.equal(original.contenu, 'Marchands ordinaires des capitales.');
});
