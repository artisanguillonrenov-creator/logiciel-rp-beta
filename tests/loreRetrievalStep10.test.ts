import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerScoreHybrideLore, MAX_LORE_CONTEXTUEL, SEUIL_LORE_HYBRIDE } from '../src/engine/loreScoring';
import { rechercherLoreLexical } from '../src/engine/rechercheLexicale';
import { selectionnerLoreElyndorSemantique, type ElyndorEntryChargee } from '../src/engine/loreLoader';
import type { LoreEntry } from '../src/types';

function chargee(id: string, titre: string, overrides: Partial<ElyndorEntryChargee> = {}): ElyndorEntryChargee {
  return {
    id,
    titre,
    contenu: 'Informations canoniques ciblées pour cette fiche.',
    motsClesNegatifs: [],
    primaryKeys: [],
    secondaryKeys: [],
    negativeKeys: [],
    priority: 50,
    constant: false,
    category: 'ROYAUME',
    scope: 'CITY',
    ...overrides,
  };
}

test('primary_keys et scope renforcent une fiche explicitement pertinente', () => {
  const cible = calculerScoreHybrideLore({
    titre: '[ROYAUME] Paris', contenu: 'Capitale humaine.', primaryKeys: ['Paris'], priority: 20, category: 'ROYAUME', scope: 'CITY',
  }, 'Je retourne à Paris pour rencontrer la cour.');
  const generique = calculerScoreHybrideLore({
    titre: '[MONDE] Commerce', contenu: 'Les routes relient les capitales.', priority: 20, category: 'MONDE', scope: 'GLOBAL',
  }, 'Je retourne à Paris pour rencontrer la cour.');
  assert.ok(cible.score > generique.score);
  assert.ok(cible.score >= SEUIL_LORE_HYBRIDE);
});

test('negative_keys excluent une fiche même avec une clé positive', () => {
  const score = calculerScoreHybrideLore({
    titre: '[ROYAUME] Paris', contenu: 'Paris', primaryKeys: ['Paris'], negativeKeys: ['hors canon'], scope: 'CITY',
  }, 'Paris hors canon');
  assert.equal(score.score, 0);
});

test('le fallback lexical ne remplit pas artificiellement le quota', () => {
  const entries: LoreEntry[] = [
    { id: 'a', titre: '[MONDE] Navigation', contenu: 'Ports et marées.' },
    { id: 'b', titre: '[MONDE] Agriculture', contenu: 'Moissons et greniers.' },
  ];
  assert.deepEqual(rechercherLoreLexical(entries, 'rituel draconique des glaces'), []);
});

test('le fallback lexical plafonne à 8 résultats contextuels', () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    titre: '[ROYAUME] Paris secteur ' + i,
    contenu: 'Paris capitale cour commerce.',
    primaryKeys: ['Paris'],
    priority: i,
    constant: false,
    category: 'ROYAUME',
    scope: 'CITY',
  })) as unknown as LoreEntry[];
  const resultats = rechercherLoreLexical(entries, 'Paris');
  assert.equal(resultats.length, MAX_LORE_CONTEXTUEL);
});

test('Lore Core est ajouté en plus des résultats contextuels', () => {
  const entries = [
    { id: 'core', titre: '[MONDE] Géographie et Races', contenu: 'Socle.', constant: false },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: 'c' + i, titre: '[ROYAUME] Paris ' + i, contenu: 'Paris.', primaryKeys: ['Paris'], priority: i, category: 'ROYAUME', scope: 'CITY', constant: false,
    })),
  ] as unknown as LoreEntry[];
  const resultats = rechercherLoreLexical(entries, 'Paris');
  assert.equal(resultats[0].id, 'core');
  assert.equal(resultats.length, MAX_LORE_CONTEXTUEL + 1);
});

test('la sélection sémantique applique seuil et plafond au lieu du top 18 automatique', () => {
  const entries = Array.from({ length: 12 }, (_, i) => chargee('e' + i, '[MONDE] Entrée ' + i, { category: 'MONDE', scope: 'GLOBAL' }));
  const vecteurs = Object.fromEntries(entries.map((e) => [e.id, [1, 0]]));
  const resultats = selectionnerLoreElyndorSemantique(entries, 'sujet pertinent', [1, 0], vecteurs);
  assert.equal(resultats.length, MAX_LORE_CONTEXTUEL);

  const faibles = Object.fromEntries(entries.map((e) => [e.id, [0, 1]]));
  const filtres = selectionnerLoreElyndorSemantique(entries, 'sujet sans correspondance', [1, 0], faibles);
  assert.equal(filtres.length, 0);
});
