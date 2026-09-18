import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUDGET_SYSTEM_LOCAL,
  construireMessages,
} from '../src/engine/promptBuilder';
import { creerNouvelleHistoire } from '../src/engine/story';

function contexte() {
  const story = creerNouvelleHistoire({
    personnageNom: 'Ael',
    personnageDescription: 'Voyageuse elfe'.repeat(30),
    pointDeDepart: 'Une ville sous la pluie'.repeat(20),
    contexte: { lieu: 'Porte nord', ambiance: 'Brumeuse', dateChronique: '', objectifs: 'Retrouver la caravane' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
  });
  return {
    meta: story.meta,
    settings: story.settings,
    resume: 'Résumé '.repeat(500),
    faits: Array.from({ length: 30 }, (_, i) => ({
      id: `f-${i}`, type: 'autre' as const, texte: `Fait établi ${i} `.repeat(40), niveau: 'canon' as const, dernierAcces: i,
    })),
    metamoteursSelectionnes: Array.from({ length: 15 }, (_, i) => ({ id: `m-${i}`, titre: `Meta ${i}`, contenu: `Instruction de scène ${i} `.repeat(150) })),
    loreElyndor: Array.from({ length: 20 }, (_, i) => ({ id: `l-${i}`, titre: `Lore ${i}`, contenu: `Détail de lore ${i} `.repeat(120), score: 0.9 })),
    messagesRecents: Array.from({ length: 10 }, (_, i) => ({ id: `msg-${i}`, role: i % 2 ? 'assistant' as const : 'user' as const, content: 'Message récent '.repeat(200), timestamp: i })),
    messageJoueur: 'Je regarde autour de moi. '.repeat(100),
  };
}

test('le budget local borne le prompt sans retirer les règles immuables', () => {
  const [systeme] = construireMessages(contexte(), { budgetSysteme: BUDGET_SYSTEM_LOCAL });
  assert.ok(systeme.content.length <= BUDGET_SYSTEM_LOCAL);
  assert.match(systeme.content, /AUTONOMIE DU JOUEUR STRICTE/);
  assert.match(systeme.content, /CONTRADICTIONS INTERDITES/);
});

test('les messages récents sont bornés individuellement', () => {
  const messages = construireMessages(contexte(), { budgetSysteme: BUDGET_SYSTEM_LOCAL });
  assert.ok(messages.slice(1, -1).every((message) => message.content.length <= 950));
  assert.ok(messages.at(-1)!.content.length <= 2030);
});
