import assert from 'node:assert/strict';
import test from 'node:test';
import { construireBlocsContexte, formaterBlocsContexte, synchroniserMemoireNarrative } from '../src/engine/memoireNarrative';
import { creerNouvelleHistoire } from '../src/engine/story';
import type { Message, StoryState } from '../src/types';

function histoire(messages: [string, string][]): StoryState {
  const story = creerNouvelleHistoire({
    personnageNom: 'Ael',
    personnageDescription: 'Voyageuse',
    pointDeDepart: 'La porte nord',
    contexte: { lieu: 'Porte de Paris', ambiance: 'Brume', dateChronique: '', objectifs: 'Retrouver la caravane' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
  });
  const liste: Message[] = messages.flatMap(([joueur, narrateur], i) => [
    { id: `u${i}`, role: 'user' as const, content: joueur, timestamp: 1000 + i * 2 },
    { id: `a${i}`, role: 'assistant' as const, content: narrateur, timestamp: 1001 + i * 2 },
  ]);
  return {
    ...story,
    messages: liste,
    social: {
      engagements: [{ id: 'e1', type: 'promesse', description: 'Rendre la dague de Sylvana', partie: 'Sylvana', honore: false, rompu: false }],
      relations: [{ id: 'r1', nom: 'Sylvana', confiance: 2, respect: 1, peur: 0, affection: 1, hostilite: 0 }],
    },
  };
}

test('chaque échange joueur → narrateur devient un événement avec ses présents', () => {
  const story = histoire([
    ['Je salue la garde.', 'SYLVANA : « Tu es en retard. »\nLa brume enveloppe la porte.'],
    ['Je montre la carte volée.', 'BOREK : « Où as-tu trouvé ça ? »'],
  ]);
  const evenements = synchroniserMemoireNarrative(story);
  assert.equal(evenements.length, 2);
  assert.deepEqual(evenements[0].participants.sort(), ['Ael', 'SYLVANA']);
  assert.ok(evenements[1].participants.includes('BOREK'));
});

test('un PNJ ne se voit rappeler que les événements auxquels il a assisté', () => {
  const story = histoire([
    ['Je parle à Sylvana du trésor caché.', 'SYLVANA : « Je garderai le secret du trésor. »'],
    ['Je cache la clé sous la dalle, seul.', 'Personne ne te voit glisser la clé sous la dalle.'],
    ['Je retrouve Sylvana au marché.', 'SYLVANA : « Te voilà enfin. »'],
  ]);
  const { blocs, totalCaracteres } = construireBlocsContexte(story, 'Je demande à Sylvana ce qu’elle sait.');
  const memoirePnj = blocs.find((b) => b.type === 'npc_memory');
  assert.ok(memoirePnj?.texte.includes('secret du trésor'));
  assert.ok(!memoirePnj?.texte.includes('dalle'));
  assert.ok(blocs.some((b) => b.type === 'relation'));
  assert.ok(blocs.some((b) => b.type === 'engagement'));
  assert.equal(blocs[0].type, 'scene');
  assert.ok(totalCaracteres <= 1900);
  assert.match(formaterBlocsContexte(blocs), /Un PNJ ne doit pas connaître/);
});
