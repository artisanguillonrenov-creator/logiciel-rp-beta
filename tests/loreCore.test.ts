import assert from 'node:assert/strict';
import test from 'node:test';
import { LORE_CORE, LORE_CORE_TAILLE } from '../src/data/loreCore';
import { BUDGET_SYSTEM_LOCAL, construireMessages } from '../src/engine/promptBuilder';
import { creerNouvelleHistoire } from '../src/engine/story';

function contexte() {
  const story = creerNouvelleHistoire({
    personnageNom: 'Ael',
    personnageDescription: 'Voyageuse elfe',
    pointDeDepart: 'Paris, sous la pluie.',
    contexte: { lieu: 'Paris', ambiance: 'Pluie', dateChronique: '', objectifs: 'Explorer' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
  });

  return {
    meta: story.meta,
    settings: story.settings,
    resume: 'Résumé saturant. '.repeat(500),
    faits: [],
    metamoteursSelectionnes: [],
    loreElyndor: [],
    messagesRecents: [],
    messageJoueur: 'Je marche dans Paris.',
    blocsContexte: 'Mémoire secondaire. '.repeat(500),
  };
}

test('le Lore Core reste compact entre 2000 et 4000 caractères', () => {
  assert.equal(LORE_CORE_TAILLE, LORE_CORE.length);
  assert.ok(LORE_CORE_TAILLE >= 2000);
  assert.ok(LORE_CORE_TAILLE <= 4000);
});

test('le Lore Core est injecté intégralement même avec le budget système local saturé', () => {
  const [systeme] = construireMessages(contexte(), { budgetSysteme: BUDGET_SYSTEM_LOCAL });
  assert.ok(systeme.content.length <= BUDGET_SYSTEM_LOCAL);
  assert.ok(systeme.content.includes(LORE_CORE));
});

test('le Lore Core ne dépend d aucune entrée de lore récupérée', () => {
  const ctx = contexte();
  ctx.loreElyndor = [];
  ctx.metamoteursSelectionnes = [];
  const [systeme] = construireMessages(ctx, { budgetSysteme: BUDGET_SYSTEM_LOCAL });
  assert.match(systeme.content, /\[LORE CORE — CANON GARANTI\]/);
  assert.match(systeme.content, /PRIMAUTÉ DU CANON/);
});
