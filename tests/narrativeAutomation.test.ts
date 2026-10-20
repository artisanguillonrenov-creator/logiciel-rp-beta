import assert from 'node:assert/strict';
import test from 'node:test';
import { creerNouvelleHistoire } from '../src/engine/story';
import { calculerRevisionNarrative } from '../src/automation/storyRevision';
import {
  abonnerSauvegardesNarratives,
  publierSauvegardeNarrative,
  reinitialiserStoryEventsPourTests,
} from '../src/automation/storyEvents';
import { creerDepotHistoires } from '../src/storage/storyRepository';
import { migrerHistoire } from '../src/storage/storyMigration';
import type { HistoireStockee, StockageHistoires } from '../src/storage/storySerialization';
import {
  INTERVALLE_LORE_EMERGENT,
  besoinRattrapageNarratif,
  calculerRattrapageNarratif,
  etatSceneDu,
  loreEmergentDu,
} from '../src/automation/narrativePostprocess';

function histoire() {
  const story = creerNouvelleHistoire({
    personnageNom: 'William',
    personnageDescription: 'Voyageur',
    pointDeDepart: 'Paris',
    contexte: { lieu: 'Paris', ambiance: 'Sombre', dateChronique: '', objectifs: '' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
  });
  story.meta.id = 'story-auto';
  story.messages = [
    { id: 'u1', role: 'user', content: 'J’entre dans la ville.', timestamp: 1 },
    { id: 'a1', role: 'assistant', content: 'La porte se referme derrière toi.', timestamp: 2 },
  ];
  return story;
}

function ancienVide() {
  return {
    getAllKeys: async () => [] as string[],
    getItem: async () => null,
    removeItem: async () => {},
  };
}

function stockageMemoire(): StockageHistoires {
  const data = new Map<string, HistoireStockee>();
  return {
    lister: async () => [...data.values()].map((h) => JSON.parse(h.meta)),
    lire: async (id) => data.get(id) ? structuredClone(data.get(id)!) : null,
    ecrire: async (histoire, seulementSiAbsente = false) => {
      if (seulementSiAbsente && data.has(histoire.id)) return;
      data.set(histoire.id, structuredClone(histoire));
    },
    supprimer: async (id) => { data.delete(id); },
  };
}

test.afterEach(() => reinitialiserStoryEventsPourTests());

test('la révision narrative ignore les réactions mais change avec le texte', () => {
  const story = histoire();
  const initiale = calculerRevisionNarrative(story);
  story.messages[1].reaction = '❤️';
  assert.equal(calculerRevisionNarrative(story), initiale);
  story.messages[1].content = 'Le pont-levis se referme derrière toi.';
  assert.notEqual(calculerRevisionNarrative(story), initiale);
});

test('les événements de sauvegarde sont dédupliqués par révision narrative', () => {
  const story = histoire();
  const revisions: string[] = [];
  const unsubscribe = abonnerSauvegardesNarratives((event) => revisions.push(event.revision));
  publierSauvegardeNarrative(story);
  story.messages[0].epingle = true;
  publierSauvegardeNarrative(story);
  story.messages[0].content = 'Je traverse la porte.';
  publierSauvegardeNarrative(story);
  unsubscribe();
  assert.equal(revisions.length, 2);
  assert.notEqual(revisions[0], revisions[1]);
});

test('une écriture gardée ne peut pas écraser une révision narrative plus récente', async () => {
  const depot = creerDepotHistoires(ancienVide(), stockageMemoire(), migrerHistoire);
  const story = histoire();
  await depot.enregistrer(story);
  const revisionAncienne = calculerRevisionNarrative(story);
  const dateSession = story.meta.updatedAt;

  const appliquee = await depot.mettreAJourSi(
    story.meta.id,
    (courante) => calculerRevisionNarrative(courante) === revisionAncienne,
    (courante) => ({ ...courante, memoire: { ...courante.memoire, resume: 'Résumé calculé' } }),
  );
  assert.equal(appliquee?.memoire.resume, 'Résumé calculé');
  assert.equal(appliquee?.meta.updatedAt, dateSession);

  const plusRecente = (await depot.lire(story.meta.id))!;
  plusRecente.messages.push({ id: 'u2', role: 'user', content: 'Je continue.', timestamp: 3 });
  await depot.enregistrer(plusRecente);

  const rejetee = await depot.mettreAJourSi(
    story.meta.id,
    (courante) => calculerRevisionNarrative(courante) === revisionAncienne,
    (courante) => ({ ...courante, memoire: { ...courante.memoire, resume: 'État obsolète' } }),
  );
  assert.equal(rejetee, null);
  const finale = await depot.lire(story.meta.id);
  assert.equal(finale?.memoire.resume, 'Résumé calculé');
  assert.equal(finale?.messages.at(-1)?.id, 'u2');
});

const REGLAGES_APP = {
  openRouterApiKey: 'cle-test',
  model: 'fiction/modele:free',
  moteurInference: 'serveur' as const,
  fournisseurNarration: 'openrouter' as const,
  serveurLocalUrl: 'elyndor-cloud',
  serveurLocalModele: 'cydonia-24b-elyndor',
  profilContenu: 'adulte' as const,
};

/** Remplace le réseau : chaque appel est reconnu par sa consigne système. */
async function avecModeleSimule<T>(
  repondre: (systeme: string, utilisateur: string) => string,
  fn: (appels: string[]) => Promise<T>,
): Promise<T> {
  const sauvegarde = globalThis.fetch;
  const appels: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const corps = JSON.parse(String(init?.body));
    const systeme = corps.messages.find((m: { role: string }) => m.role === 'system')?.content ?? '';
    const utilisateur = corps.messages.filter((m: { role: string }) => m.role === 'user').map((m: { content: string }) => m.content).join('\n');
    appels.push(systeme);
    return Response.json({ choices: [{ message: { content: repondre(systeme, utilisateur) } }] });
  };
  try { return await fn(appels); } finally { globalThis.fetch = sauvegarde; }
}

function reponseSeparee(systeme: string): string {
  if (systeme.includes("Tu tiens l'état de la scène")) return '{"ville":"Paris","lieu":"porte nord","presents":["Garde"],"minutesEcoulees":5}';
  if (systeme.includes('LORE ÉMERGENT')) return '{"candidats":[]}';
  return '{}';
}

function messagesAlternes(nombre: number) {
  return Array.from({ length: nombre }, (_, i) => ({
    id: `m${i}`, role: i % 2 ? 'assistant' as const : 'user' as const, content: `Échange ${i} à Paris.`, timestamp: i,
  }));
}

test('le lore émergent attend trois messages d’écart, l’état de scène suit chaque message', () => {
  const story = histoire();
  story.loreEmergentDernierIndex = 0;
  story.messages = messagesAlternes(2);
  assert.equal(INTERVALLE_LORE_EMERGENT, 3);
  assert.equal(loreEmergentDu(story), false);
  assert.equal(etatSceneDu(story), true);
  story.messages = messagesAlternes(3);
  assert.equal(loreEmergentDu(story), true);
  story.scene = { ville: 'Paris', presents: [], majMessageIndex: 3 };
  assert.equal(etatSceneDu(story), false);
});

test('le rattrapage au démarrage ne se déclenche pas pour une scène jamais relevée seule', () => {
  const story = histoire();
  story.messages = messagesAlternes(2);
  story.loreEmergentDernierIndex = 0;
  assert.equal(besoinRattrapageNarratif(story), false);
  story.scene = { ville: 'Paris', presents: [], majMessageIndex: 0 };
  assert.equal(besoinRattrapageNarratif(story), true);
});

test('sous la cadence du lore, seul l’état de scène est relevé et le diagnostic l’indique', async () => {
  const story = histoire();
  story.messages = messagesAlternes(2);
  story.loreEmergentDernierIndex = 0;
  await avecModeleSimule(reponseSeparee, async (appels) => {
    const patch = (await calculerRattrapageNarratif(story, REGLAGES_APP))!;
    assert.equal(appels.length, 1);
    assert.match(appels[0], /état de la scène/);
    assert.equal(patch.loreEmergentDernierIndex, 0);
    assert.equal(patch.scene?.lieu, 'porte nord');
    assert.equal(patch.scene?.majMessageIndex, 2);
    assert.equal(patch.minutesEcoulees, 5);
    const lore = patch.diagnosticPostTraitement!.etapes.find((e) => e.nom === 'Lore émergent')!;
    assert.equal(lore.statut, 'ignoree');
    assert.match(lore.raison ?? '', /Cadence non atteinte : 2\/3/);
    assert.equal(patch.diagnosticPostTraitement!.etapes.find((e) => e.nom === 'État de scène')?.statut, 'ok');
  });
});

test('à la cadence atteinte, lore émergent et état de scène sont relevés ensemble', async () => {
  const story = histoire();
  story.messages = messagesAlternes(4);
  story.loreEmergentDernierIndex = 1;
  story.scene = { ville: 'Paris', presents: [], majMessageIndex: 2 };
  await avecModeleSimule(reponseSeparee, async (appels) => {
    const patch = (await calculerRattrapageNarratif(story, REGLAGES_APP))!;
    assert.equal(appels.length, 2);
    assert.equal(patch.loreEmergentDernierIndex, 4);
    assert.equal(patch.scene?.majMessageIndex, 4);
  });
});

test('sans nouveau message, rien n’est relancé', async () => {
  const story = histoire();
  story.messages = messagesAlternes(2);
  story.loreEmergentDernierIndex = 2;
  story.scene = { ville: 'Paris', presents: [], majMessageIndex: 2 };
  assert.equal(await calculerRattrapageNarratif(story, REGLAGES_APP), null);
});
