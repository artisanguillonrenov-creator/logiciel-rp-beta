import assert from 'node:assert/strict';
import test from 'node:test';
import { calculerCapacites } from '../src/automation/capabilities';
import {
  abonnerReglages,
  lireReglagesCourants,
  publierReglages,
  reinitialiserSettingsStorePourTests,
} from '../src/automation/settingsStore';
import { createAutomationJobRepository } from '../src/automation/jobRepositoryCore';
import { listerStoryIdsOrphelins } from '../src/automation/lifecyclePlanning';

const baseSettings = {
  openRouterApiKey: '',
  model: 'narrateur',
  profilContenu: 'grand_public' as const,
  moteurInference: 'openrouter' as const,
};

test.afterEach(() => {
  reinitialiserSettingsStorePourTests();
});

test('le SettingsStore publie chaque configuration sauvegardée aux abonnés', () => {
  const recus: string[] = [];
  const unsubscribe = abonnerReglages((settings) => recus.push(settings.model), false);
  publierReglages({ ...baseSettings, model: 'modele-a' });
  publierReglages({ ...baseSettings, model: 'modele-b' });
  unsubscribe();
  publierReglages({ ...baseSettings, model: 'modele-c' });

  assert.deepEqual(recus, ['modele-a', 'modele-b']);
  assert.equal(lireReglagesCourants()?.model, 'modele-c');
});

test('les capacités imposent Elyndor Cloud même avec d’anciens réglages OpenRouter', () => {
  const caps = calculerCapacites({
    ...baseSettings,
    openRouterApiKey: 'ancienne-cle',
    genererImagesActive: true,
  }, { plateforme: 'web' });

  assert.equal(caps.fournisseur, 'serveur');
  assert.equal(caps.narration, true);
  assert.equal(caps.embeddings, false);
  assert.equal(caps.images, false);
  assert.equal(caps.avatars, false);
  assert.equal(caps.inferenceLocale, false);
  assert.match(caps.raisons.embeddings ?? '', /lexicale locale/);
  assert.match(caps.raisons.images ?? '', /Elyndor Cloud/);
});

test('les anciens réglages Infermatic ou serveur local ne changent aucune capacité Cloud', () => {
  const caps = calculerCapacites({
    ...baseSettings,
    moteurInference: 'infermatic',
    infermaticApiKey: 'inf-key',
    infermaticModel: 'ancien-modele',
    serveurLocalUrl: 'http://192.168.1.2:1234/v1',
    serveurLocalModele: 'ancien-local',
    embeddingsApiKey: 'ancienne-cle-embeddings',
    genererImagesActive: true,
  }, { plateforme: 'native', modeleLocalPresent: true });

  assert.equal(caps.fournisseur, 'serveur');
  assert.equal(caps.narration, true);
  assert.equal(caps.traduction, true);
  assert.equal(caps.embeddings, false);
  assert.equal(caps.images, false);
  assert.equal(caps.inferenceLocale, false);
  assert.match(caps.raisons.inferenceLocale ?? '', /moteur local a été retiré/);
});

test('les capacités Cloud conservent seulement les choix fonctionnels du profil', () => {
  const caps = calculerCapacites({
    ...baseSettings,
    profilContenu: 'adulte',
    modeConcepteur: true,
  }, { plateforme: 'native' });

  assert.equal(caps.contenuAdulte, true);
  assert.equal(caps.concepteur, true);
  assert.equal(caps.narration, true);
  assert.equal(caps.traduction, true);
});

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { data.set(key, value); },
  };
}

test('la file persistante déduplique un job actif puis autorise un nouveau job après terminaison', async () => {
  let now = 1000;
  const repo = createAutomationJobRepository(memoryStorage(), () => now++);
  const premier = await repo.enqueue({ type: 'updates.check', dedupeKey: 'update:1' });
  const doublon = await repo.enqueue({ type: 'updates.check', dedupeKey: 'update:1' });
  assert.equal(doublon.id, premier.id);

  await repo.markRunning(premier.id);
  await repo.markCompleted(premier.id);
  const suivant = await repo.enqueue({ type: 'updates.check', dedupeKey: 'update:1' });
  assert.notEqual(suivant.id, premier.id);
});

test('un job interrompu en running revient en pending au prochain démarrage', async () => {
  let now = 2000;
  const repo = createAutomationJobRepository(memoryStorage(), () => now++);
  const job = await repo.enqueue({ type: 'memory.update', storyId: 'story-1' });
  await repo.markRunning(job.id);
  assert.equal((await repo.list())[0].status, 'running');

  const recovered = await repo.recoverInterrupted();
  const restored = (await repo.list())[0];
  assert.equal(recovered, 1);
  assert.equal(restored.status, 'pending');
  assert.match(restored.lastError ?? '', /Interrompu/);
});

test('supprimer une histoire retire tous ses jobs sans toucher aux autres', async () => {
  let now = 3000;
  const repo = createAutomationJobRepository(memoryStorage(), () => now++);
  await repo.enqueue({ type: 'story.postprocess', storyId: 'story-a' });
  await repo.enqueue({ type: 'visual.avatar.generate', storyId: 'story-a' });
  await repo.enqueue({ type: 'story.postprocess', storyId: 'story-b' });
  await repo.enqueue({ type: 'updates.check' });

  const removed = await repo.removeByStoryId('story-a');
  const restants = await repo.list();
  assert.equal(removed, 2);
  assert.deepEqual(restants.map((job) => job.storyId ?? 'global'), ['story-b', 'global']);
});

test('le sweep repère les storyId orphelins une seule fois', () => {
  const jobs = [
    { id: '1', type: 'a', storyId: 'story-ok', status: 'pending' as const, attempts: 0, createdAt: 1 },
    { id: '2', type: 'b', storyId: 'story-old', status: 'failed' as const, attempts: 1, createdAt: 2 },
    { id: '3', type: 'c', storyId: 'story-old', status: 'pending' as const, attempts: 0, createdAt: 3 },
    { id: '4', type: 'global', status: 'pending' as const, attempts: 0, createdAt: 4 },
  ];
  assert.deepEqual(listerStoryIdsOrphelins(jobs, ['story-ok']), ['story-old']);
});
