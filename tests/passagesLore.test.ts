import assert from 'node:assert/strict';
import test from 'node:test';
import elyndorRaw from '../src/data/elyndorLore.json';
import { chargerLoreElyndor } from '../src/engine/loreLoader';
import { BUDGET_LORE_PASSAGES, construirePassages, decouperEnPassages, selectionnerPassages } from '../src/engine/passagesLore';

const LORE = chargerLoreElyndor(elyndorRaw as any);
const PASSAGES = construirePassages(LORE);

test('le découpage garde tout le texte en passages de 600 caractères au plus', () => {
  const texte = LORE.find((e) => e.titre.includes('Ratio de Vieillissement'))!.contenu;
  const passages = decouperEnPassages(texte);
  assert.ok(passages.length > 3);
  assert.ok(passages.every((p) => p.length <= 600));
  assert.equal(passages.join(' ').replace(/\s+/g, ''), texte.replace(/\s+/g, ''));
});

test('une elfe noire qui paraît 50 ans fait remonter la table d’âge, dans le budget', () => {
  const selection = selectionnerPassages(PASSAGES, "Je cherche une elfe noire qui a l'air d'avoir 50 ans, quel âge a-t-elle vraiment ?");
  const total = selection.reduce((n, e) => n + e.titre.length + e.contenu.length + 6, 0);
  assert.ok(total <= BUDGET_LORE_PASSAGES);
  const ratio = selection.find((e) => e.titre.includes('Ratio de Vieillissement'));
  assert.ok(ratio, 'la fiche Ratio de Vieillissement est retenue');
  assert.match(ratio!.contenu, /390 ans/);
});

test('un nom canonique cité remonte sa fiche grâce à l’ancre', () => {
  const zurich = LORE.find((e) => e.titre.includes('Zurich'))!;
  const selection = selectionnerPassages(PASSAGES, 'Nous arrivons enfin à la forteresse.', { ancres: new Set([zurich.id]) });
  assert.equal(selection[0].id, zurich.id);
});

test('une fiche ne place jamais plus de trois passages', () => {
  const selection = selectionnerPassages(PASSAGES, 'Paris, la Seine, le palais, la cathédrale, le marché aux esclaves de Paris', {
    ancres: new Set([LORE.find((e) => e.titre.includes('Paris — Royaume Humain'))!.id]),
  });
  for (const entree of selection) assert.ok(entree.contenu.split('\n…\n').length <= 3);
});
