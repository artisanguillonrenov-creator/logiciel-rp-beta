import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoryState } from '../src/types';
import {
  construireContextBlocks,
  synchroniserMemoireNarrative,
} from '../src/engine/narrative/persistentMemory';

function histoire(): StoryState {
  return {
    version: 9,
    meta: {
      id: 'story-v10',
      personnageNom: 'William',
      personnageDescription: 'Aventurier humain',
      pointDeDepart: 'Marché de Paris',
      contexte: {
        lieu: 'Marché de Paris',
        ambiance: 'Tendue',
        dateChronique: 'Jour 18 — soirée',
        objectifs: 'Comprendre la créature sous l’estrade',
      },
      createdAt: 1,
      updatedAt: 5,
    },
    messages: [
      {
        id: 'u1', role: 'user', timestamp: 1,
        content: "J'observe ce qui sort de sous l'estrade.",
      },
      {
        id: 'a1', role: 'assistant', timestamp: 2,
        content: "Une créature surgit sous l'estrade. SELYRA : « Je l'ai vue. Reste derrière moi. » La foule recule.",
      },
      {
        id: 'u2', role: 'user', timestamp: 3,
        content: 'Je quitte le marché et parle au tavernier.',
      },
      {
        id: 'a2', role: 'assistant', timestamp: 4,
        content: 'Le tavernier essuie un verre sans savoir ce qui s’est passé sous l’estrade.',
      },
    ],
    memoire: {
      resume: 'Une créature a provoqué la panique au marché.',
      dernierMessageIndexMaj: 4,
      faits: [
        {
          id: 'fact-creature',
          type: 'autre',
          texte: 'Une créature inconnue a surgi sous l’estrade du marché de Paris.',
          niveau: 'canon',
          dernierAcces: 2,
        },
      ],
    },
    loreEmergent: [
      {
        id: 'pnj-selyra',
        categorie: 'pnj',
        titre: 'Selyra',
        contenu: 'Guerrière présente au marché.',
        statut: 'permanent',
        premiereMention: 1,
        dernierAcces: 1,
      },
    ],
    settings: {
      creativite: 'moyenne',
      longueur: 'moyenne',
      ton: 'sombre_realiste',
      violence: 'modere',
      romance: 'aucun',
      humour: 'faible',
      liberteJoueur: 'elevee',
      rythme: 'normal',
    },
    directeur: { arcActuel: '', tension: 'calme', dernierBeatIndex: 4, beats: [] },
    monde: {
      zones: [
        { id: 'paris-marche', nom: 'Marché de Paris', niveau: 'active', description: 'Marché agité après un incident.', dernierAcces: 4 },
      ],
      flags: {}, compteurs: {}, declencheurs: [],
    },
    social: {
      engagements: [
        { id: 'promesse-selyra', type: 'promesse', description: 'Retrouver Selyra après l’incident.', partie: 'Selyra', honore: false, rompu: false },
      ],
      relations: [
        { id: 'rel-selyra', nom: 'Selyra', confiance: 2, respect: 2, peur: 0, affection: 1, hostilite: 0 },
      ],
    },
  };
}

test('V10 construit un Event Ledger déterministe depuis le transcript', () => {
  const ledger = synchroniserMemoireNarrative(histoire());
  assert.equal(ledger.evenements.length, 2);
  assert.equal(ledger.dernierMessageIndex, 4);
  assert.ok(ledger.evenements[0].participants.some((nom) => nom.toLowerCase() === 'selyra'));
  assert.match(ledger.evenements[0].resultat, /créature surgit/i);
});

test('V10 reconstruit le ledger après édition au lieu de garder un souvenir périmé', () => {
  const story = histoire();
  story.memoireNarrative = synchroniserMemoireNarrative(story);
  story.messages[1] = {
    ...story.messages[1],
    content: 'Un chien apeuré sort de sous l’estrade. SELYRA : « Ce n’est pas la créature. »',
  };
  const ledger = synchroniserMemoireNarrative(story);
  assert.match(ledger.evenements[0].resultat, /chien apeuré/i);
  assert.doesNotMatch(ledger.evenements[0].resultat, /Une créature surgit/i);
});

test('V10 sélectionne mémoire PNJ, canon, relation et événements dans un budget borné', () => {
  const story = histoire();
  story.memoireNarrative = synchroniserMemoireNarrative(story);
  const selection = construireContextBlocks(story, 'Que sait Selyra de la créature du marché ?');

  assert.ok(selection.totalChars <= 1900);
  assert.ok(selection.blocks.some((bloc) => bloc.type === 'npc_memory' && /Selyra/i.test(bloc.text)));
  assert.ok(selection.blocks.some((bloc) => bloc.type === 'canon' && /créature/i.test(bloc.text)));
  assert.ok(selection.blocks.some((bloc) => bloc.type === 'relation' && /confiance/i.test(bloc.text)));
  assert.ok(selection.blocks.some((bloc) => bloc.type === 'event'));
});
