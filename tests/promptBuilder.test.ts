import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUDGET_CONVERSATION_DISTANT,
  BUDGET_CONVERSATION_LOCAL,
  BUDGET_SYSTEM_DISTANT,
  BUDGET_SYSTEM_LOCAL,
  construireMessages,
  selectionnerMessagesRecents,
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
    loreElyndor: Array.from({ length: 20 }, (_, i) => ({ id: `l-${i}`, titre: `Lore ${i}`, contenu: `Détail de lore ${i} `.repeat(120), score: 0.9 })),
    messagesRecents: Array.from({ length: 20 }, (_, i) => ({ id: `msg-${i}`, role: i % 2 ? 'assistant' as const : 'user' as const, content: `Message récent ${i} `.repeat(40), timestamp: i })),
    messageJoueur: 'Je regarde autour de moi. '.repeat(20),
  };
}

test('le budget local borne le prompt sans retirer les règles immuables', () => {
  const [systeme] = construireMessages(contexte(), { budgetSysteme: BUDGET_SYSTEM_LOCAL, budgetConversation: BUDGET_CONVERSATION_LOCAL });
  assert.ok(systeme.content.length <= BUDGET_SYSTEM_LOCAL);
  assert.match(systeme.content, /AUTONOMIE DU JOUEUR STRICTE/);
  assert.match(systeme.content, /CONTRADICTIONS INTERDITES/);
});

test('les messages récents sont conservés entiers sans limite fixe de dix messages', () => {
  const ctx = contexte();
  const messages = construireMessages(ctx, { budgetSysteme: BUDGET_SYSTEM_LOCAL, budgetConversation: 20000 });
  const recents = messages.slice(1, -1);
  assert.ok(recents.length > 10);
  assert.equal(recents.at(-1)!.content, ctx.messagesRecents.at(-1)!.content);
  assert.equal(messages.at(-1)!.content, ctx.messageJoueur);
});

test('un long message récent n’est jamais coupé en plein milieu', () => {
  const long = 'Narration complète. '.repeat(300);
  const ctx = {
    ...contexte(),
    messagesRecents: [{ id: 'long', role: 'assistant' as const, content: long, timestamp: 1 }],
    messageJoueur: 'Je réponds.',
  };
  const messages = construireMessages(ctx, { budgetSysteme: BUDGET_SYSTEM_LOCAL, budgetConversation: 2000 });
  assert.equal(messages[1].content, long);
});

test('la sélection récente est dynamique selon le budget global', () => {
  const messages = Array.from({ length: 30 }, (_, i) => ({
    id: `m-${i}`,
    role: i % 2 ? 'assistant' as const : 'user' as const,
    content: `court-${i}`,
    timestamp: i,
  }));
  const large = selectionnerMessagesRecents(messages, 5000);
  const petit = selectionnerMessagesRecents(messages, 150);
  assert.equal(large.length, 30);
  assert.ok(petit.length < large.length);
  assert.equal(petit.at(-1)!.id, 'm-29');
});

test('aucun marqueur technique de contexte tronqué n’est injecté dans le prompt', () => {
  const messages = construireMessages({ ...contexte(), blocsContexte: 'Bloc mémoire '.repeat(1000) }, { budgetSysteme: BUDGET_SYSTEM_LOCAL, budgetConversation: BUDGET_CONVERSATION_LOCAL });
  assert.ok(messages.every((message) => !message.content.includes('contexte tronqué')));
});

test('identité narrative en tête et style jamais tronqué, même en budget local saturé', () => {
  const [systeme] = construireMessages({ ...contexte(), blocsContexte: 'Bloc mémoire '.repeat(400) }, { budgetSysteme: BUDGET_SYSTEM_LOCAL, budgetConversation: BUDGET_CONVERSATION_LOCAL });
  assert.ok(systeme.content.length <= BUDGET_SYSTEM_LOCAL);
  assert.match(systeme.content, /POINT DE VUE: dans la narration uniquement/);
  assert.match(systeme.content, /\[STYLE & FILTRE SYSTEME\][\s\S]*Format des dialogues des PNJ/);
  assert.match(systeme.content, /\[MÉMOIRE NARRATIVE PERTINENTE\]/);
});

test('le registre Adulte (avec M08) reste entier dans l’en-tête, même avec mémoire et lore saturés', () => {
  const m08 = `[MÉTA] Registre et Style Narratif\n${'Règle de registre. '.repeat(90)}Quand la scène appelle le cru, rends-le.`;
  const [systeme] = construireMessages(
    { ...contexte(), blocsContexte: 'Bloc mémoire '.repeat(2000), registreAdulte: m08 },
    { budgetSysteme: BUDGET_SYSTEM_DISTANT, budgetConversation: BUDGET_CONVERSATION_DISTANT },
  );
  assert.ok(systeme.content.length <= BUDGET_SYSTEM_DISTANT);
  assert.ok(systeme.content.includes(m08));
  assert.match(systeme.content, /\[MÉMOIRE NARRATIVE PERTINENTE\]/);
});

test('les responsabilités V2.1 sont dans le prompt sans anciennes fiches textuelles', () => {
  const contrat = '[CONTRAT NARRATIF NATIF V2.1 — RESPONSABILITÉS ACTIVES]\nM01 Production de la réponse';
  const [systeme] = construireMessages(
    { ...contexte(), blocsContexte: 'Bloc mémoire '.repeat(2000), contratNarratif: contrat },
    { budgetSysteme: BUDGET_SYSTEM_DISTANT, budgetConversation: BUDGET_CONVERSATION_DISTANT },
  );
  assert.ok(systeme.content.length <= BUDGET_SYSTEM_DISTANT);
  assert.ok(systeme.content.includes(contrat));
  assert.ok(!systeme.content.includes('[MÉTAMOTEURS ACTIFS]'));
  assert.match(systeme.content, /AUTONOMIE DU JOUEUR STRICTE/);
  assert.ok(systeme.content.includes('[MÉMOIRE NARRATIVE PERTINENTE]'));
});

test('la fiche de création détaillée du joueur arrive entière au narrateur', () => {
  const base = contexte();
  const fin = 'DETAIL-FINAL-DE-LA-FICHE';
  const description = `Sexe : Homme\nRace / origine : Humain\nÂge : 39 ans\nApparence : ${'cicatrice, '.repeat(40)}\n${'Ancien chevalier déchu. '.repeat(70)}${fin}`;
  assert.ok(description.length > 2000 && description.length < 3000);
  const [systeme] = construireMessages({ ...base, meta: { ...base.meta, personnageDescription: description } }, { budgetSysteme: BUDGET_SYSTEM_DISTANT, budgetConversation: BUDGET_CONVERSATION_DISTANT });
  assert.ok(systeme.content.includes(fin));
});
