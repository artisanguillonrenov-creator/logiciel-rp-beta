import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUDGET_LORE,
  classerLexical,
  rechercherLoreLexical,
  rechercherSouvenirsLexical,
  termesRecherche,
} from '../src/engine/rechercheLexicale';
import { prioriserLoreCanon, type ElyndorEntryChargee } from '../src/engine/loreLoader';
import type { Message } from '../src/types';

test('les termes ignorent accents, casse, mots vides et doublons', () => {
  assert.deepEqual(termesRecherche("L'Épée de la Reine et l'épée du Roi"), ["l'epee", 'reine', 'roi']);
});

test('le lore partageant le plus de termes passe en tête, réduit à un extrait', () => {
  const lore = [
    { id: 'a', titre: '[GUILDE] Guilde des Marchands', contenu: 'Les marchands contrôlent le port.' },
    { id: 'b', titre: '[MONDE] Les Nains', contenu: `${'Histoire ancienne. '.repeat(60)}Les forges de Zurich brûlent jour et nuit sous la montagne.` },
    { id: 'c', titre: '[MONDE] Les Sirènes', contenu: 'Chants et marées.' },
  ];
  const resultats = rechercherLoreLexical(lore, 'Je visite les forges des nains de Zurich');
  assert.equal(resultats[0].id, 'b');
  assert.ok(resultats[0].contenu.includes('forges de Zurich'));
  assert.ok(resultats[0].contenu.length <= BUDGET_LORE.maxCaracteresParResultat + 2);
  assert.ok(!resultats.some((r) => r.id === 'c'));
});

test('le budget plafonne le nombre et la taille des résultats', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ texte: `dragon rouge numéro ${i} `.repeat(20) }));
  const resultats = classerLexical({
    requete: 'dragon rouge',
    items,
    texteDe: (x) => x.texte,
    budget: { maxResultats: 3, maxCaracteres: 500, maxCaracteresParResultat: 200 },
  });
  assert.ok(resultats.length <= 3);
  assert.ok(resultats.reduce((n, r) => n + r.extrait.length, 0) <= 500);
});

test('les souvenirs retrouvent un vieux message pertinent', () => {
  const messages: Message[] = [
    { id: '1', role: 'user', content: 'Je cache la clé d’argent sous la dalle du temple.', timestamp: 1 },
    { id: '2', role: 'assistant', content: 'La pluie tombe sur le marché.', timestamp: 2 },
  ];
  const souvenirs = rechercherSouvenirsLexical(messages, 'Où est la clé d’argent ?');
  assert.equal(souvenirs[0]?.message.id, '1');
});

const royaume = (id: string, titre: string): ElyndorEntryChargee =>
  ({ id, titre, contenu: `Fiche ${titre}`, motsClesNegatifs: [], priority: 1, constant: false });

test('un royaume nommé dans la scène est ancré en tête, puis socle, puis pertinence', () => {
  const entrees = [royaume('paris', '[ROYAUME] Paris — Royaume Humain'), royaume('tokyo', '[ROYAUME] Tokyo — Empire des Hauts-Elfes')];
  const selection = [
    { id: 'socle', titre: '[MONDE] Présentation', contenu: '…' },
    { id: 'guilde', titre: '[GUILDE] Marchands', contenu: '…', score: 0.4 },
    { id: 'paris', titre: '[ROYAUME] Paris — Royaume Humain', contenu: '…', score: 0.1 },
  ];
  const resultat = prioriserLoreCanon('Je franchis les portes de Paris', selection, entrees);
  assert.deepEqual(resultat.map((e) => e.id), ['paris', 'socle', 'guilde']);
  assert.equal(resultat[0].score, undefined);
});
