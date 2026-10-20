import assert from 'node:assert/strict';
import test from 'node:test';
import { createAutomationJobRepository } from '../src/automation/jobRepositoryCore';
import {
  CONSERVATION_ECHECS_MS,
  DELAI_MAX_TACHE_IMAGE_MS,
  DELAI_MAX_TACHE_TEXTE_MS,
  createAutomationKernel,
  delaiMaxTache,
  fileDeTache,
} from '../src/automation/kernelCore';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { data.set(key, value); },
  };
}

/** Horloge et minuteries entièrement simulées : aucun test n'attend réellement. */
function horlogeSimulee(depart = 1_000_000) {
  let instant = depart;
  let suivant = 0;
  const minuteries = new Map<number, { echeance: number; rappel: () => void }>();
  return {
    now: () => instant,
    setTimer: (rappel: () => void, ms: number) => {
      const id = ++suivant;
      minuteries.set(id, { echeance: instant + ms, rappel });
      return () => { minuteries.delete(id); };
    },
    avancer(ms: number) {
      instant += ms;
      for (const [id, minuterie] of [...minuteries]) {
        if (minuterie.echeance > instant) continue;
        minuteries.delete(id);
        minuterie.rappel();
      }
    },
    enAttente: () => minuteries.size,
  };
}

async function laisserTourner(condition: () => boolean | Promise<boolean>, essais = 200): Promise<void> {
  for (let i = 0; i < essais; i++) {
    if (await condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('Condition jamais atteinte.');
}

function noyau() {
  const horloge = horlogeSimulee();
  const repo = createAutomationJobRepository(memoryStorage(), horloge.now);
  const kernel = createAutomationKernel(repo, { now: horloge.now, setTimer: horloge.setTimer });
  return { horloge, repo, kernel };
}

test('le délai maximum dépend de la famille de tâche', () => {
  assert.equal(fileDeTache('visual.scene.generate'), 'image');
  assert.equal(fileDeTache('story.postprocess'), 'texte');
  assert.equal(fileDeTache('maintenance.orphans.sweep'), 'texte');
  assert.equal(delaiMaxTache('updates.check'), DELAI_MAX_TACHE_TEXTE_MS);
  assert.equal(delaiMaxTache('visual.avatar.generate'), DELAI_MAX_TACHE_IMAGE_MS);
  assert.equal(DELAI_MAX_TACHE_TEXTE_MS, 3 * 60 * 1000);
  assert.equal(DELAI_MAX_TACHE_IMAGE_MS, 5 * 60 * 1000);
});

test('une tâche qui dépasse son délai est interrompue et la file continue', async () => {
  const { horloge, repo, kernel } = noyau();
  let signalRecu: AbortSignal | null = null;
  const termines: string[] = [];
  kernel.registerAutomationHandler('story.postprocess', (_job, { signal }) => {
    signalRecu = signal;
    return new Promise(() => {});
  });
  kernel.registerAutomationHandler('updates.check', async () => { termines.push('updates.check'); });

  const bloquee = await kernel.enqueueAutomation('story.postprocess', { storyId: 's1' });
  await kernel.enqueueAutomation('updates.check');
  await laisserTourner(async () => (await repo.list()).some((job) => job.status === 'running'));

  horloge.avancer(DELAI_MAX_TACHE_TEXTE_MS);
  await laisserTourner(() => termines.length === 1);
  await kernel.processAutomationQueue();

  const echouee = (await repo.list()).find((job) => job.id === bloquee.id)!;
  assert.equal(signalRecu!.aborted, true);
  assert.match(echouee.lastError ?? '', /Délai maximum dépassé \(3 min\)/);
  // Première tentative : la tâche est reprogrammée, pas abandonnée.
  assert.equal(echouee.status, 'pending');
  assert.equal(echouee.nextAttemptAt, horloge.now() + 30_000);
  assert.equal(kernel.getAutomationDiagnostics().lastRuns['story.postprocess'].ok, false);
});

test('une tâche échouée est relancée automatiquement avec un délai croissant', async () => {
  const { horloge, repo, kernel } = noyau();
  let appels = 0;
  kernel.registerAutomationHandler('story.postprocess', async () => {
    appels++;
    if (appels < 3) throw new Error(`panne ${appels}`);
  });

  const job = await kernel.enqueueAutomation('story.postprocess', { storyId: 's1' });
  await kernel.processAutomationQueue();
  let etat = (await repo.list())[0];
  assert.equal(appels, 1);
  assert.equal(etat.status, 'pending');
  assert.equal(etat.lastError, 'panne 1');
  assert.equal(kernel.getAutomationDiagnostics().retryingJobs, 1);

  // Avant l'échéance de 30 s, rien ne repart.
  horloge.avancer(29_000);
  await kernel.processAutomationQueue();
  assert.equal(appels, 1);

  horloge.avancer(1_000);
  await laisserTourner(() => appels === 2);
  await laisserTourner(async () => (await repo.list())[0].lastError === 'panne 2');
  etat = (await repo.list())[0];
  assert.equal(etat.status, 'pending');
  assert.equal(etat.nextAttemptAt, horloge.now() + 120_000);

  horloge.avancer(120_000);
  await laisserTourner(async () => (await repo.list())[0].status === 'completed');
  etat = (await repo.list())[0];
  assert.equal(etat.id, job.id);
  assert.equal(etat.attempts, 3);
  assert.equal(appels, 3);
});

test('au-delà de trois tentatives la tâche reste en échec définitif', async () => {
  const { horloge, repo, kernel } = noyau();
  let appels = 0;
  kernel.registerAutomationHandler('story.postprocess', async () => {
    appels++;
    throw new Error('toujours en panne');
  });

  await kernel.enqueueAutomation('story.postprocess', { storyId: 's1' });
  await kernel.processAutomationQueue();
  horloge.avancer(30_000);
  await laisserTourner(() => appels === 2);
  await laisserTourner(async () => {
    const job = (await repo.list())[0];
    return job.status === 'pending' && job.attempts === 2;
  });
  horloge.avancer(120_000);
  await laisserTourner(async () => (await repo.list())[0].status === 'failed');

  const etat = (await repo.list())[0];
  assert.equal(appels, 3);
  assert.equal(etat.attempts, 3);
  assert.match(etat.lastError ?? '', /toujours en panne \(échec définitif après 3 tentative\(s\)\)/);
  assert.equal(horloge.enAttente(), 0, 'aucune relance ne doit rester programmée');

  horloge.avancer(10 * 60_000);
  await kernel.processAutomationQueue();
  assert.equal(appels, 3);
  assert.equal(kernel.getAutomationDiagnostics().failedJobs, 1);
});

test('la relance manuelle remet le compteur de tentatives à zéro', async () => {
  const { repo, kernel } = noyau();
  let reussir = false;
  kernel.registerAutomationHandler('updates.check', async () => {
    if (!reussir) throw new Error('hors ligne');
  });
  const job = await kernel.enqueueAutomation('updates.check');
  await kernel.processAutomationQueue();
  await repo.markRunning(job.id);
  await repo.markRunning(job.id);
  await repo.markFailed(job.id, 'hors ligne');
  assert.equal((await repo.list())[0].attempts, 3);

  reussir = true;
  const relancees = await repo.retryFailed();
  const remise = (await repo.list())[0];
  assert.equal(relancees, 1);
  assert.equal(remise.status, 'pending');
  assert.equal(remise.attempts, 0);
  assert.equal(remise.nextAttemptAt, undefined);

  await kernel.processAutomationQueue();
  assert.equal((await repo.list())[0].status, 'completed');
});

test('le démarrage purge les échecs de plus de sept jours et garde les récents', async () => {
  const horloge = horlogeSimulee();
  const repo = createAutomationJobRepository(memoryStorage(), horloge.now);
  const ancien = await repo.enqueue({ type: 'story.postprocess', storyId: 'vieux' });
  await repo.markFailed(ancien.id, 'panne ancienne');
  horloge.avancer(CONSERVATION_ECHECS_MS + 1);
  const recent = await repo.enqueue({ type: 'story.postprocess', storyId: 'recent' });
  await repo.markFailed(recent.id, 'panne récente');
  await repo.enqueue({ type: 'updates.check' });

  const kernel = createAutomationKernel(repo, { now: horloge.now, setTimer: horloge.setTimer });
  await kernel.initializeAutomationKernel();

  const restants = await repo.list();
  assert.deepEqual(restants.map((job) => job.storyId ?? job.type), ['recent', 'updates.check']);
  assert.equal(kernel.getAutomationDiagnostics().purgedFailedJobs, 1);
  assert.equal(kernel.getAutomationDiagnostics().failedJobs, 1);
});

test('une tâche image bloquée n’empêche pas une tâche texte de se terminer', async () => {
  const { horloge, repo, kernel } = noyau();
  let libererImage: () => void = () => {};
  const termines: string[] = [];
  kernel.registerAutomationHandler('visual.scene.generate', () => new Promise<void>((resolve) => {
    libererImage = () => { termines.push('image'); resolve(); };
  }));
  kernel.registerAutomationHandler('story.postprocess', async () => { termines.push('texte'); });

  // L'image est en file avant le texte : avec une file unique, le texte attendrait.
  await kernel.enqueueAutomation('visual.scene.generate', { storyId: 's1' });
  await kernel.enqueueAutomation('story.postprocess', { storyId: 's1' });
  await laisserTourner(() => termines.includes('texte'));

  const jobs = await repo.list();
  assert.equal(jobs.find((job) => job.type === 'visual.scene.generate')?.status, 'running');
  assert.equal(jobs.find((job) => job.type === 'story.postprocess')?.status, 'completed');
  const diagnostics = kernel.getAutomationDiagnostics();
  assert.equal(diagnostics.files.image.runningJobs, 1);
  assert.equal(diagnostics.files.texte.runningJobs, 0);
  assert.equal(diagnostics.files.texte.pendingJobs, 0);

  libererImage();
  await kernel.processAutomationQueue();
  assert.deepEqual(termines, ['texte', 'image']);
  assert.equal(horloge.enAttente(), 0);
});

test('chaque file traite une seule tâche à la fois', async () => {
  const { kernel } = noyau();
  let actifsImage = 0;
  let maxImage = 0;
  let actifsTexte = 0;
  let maxTexte = 0;
  const suivre = (file: 'image' | 'texte') => async () => {
    if (file === 'image') maxImage = Math.max(maxImage, ++actifsImage);
    else maxTexte = Math.max(maxTexte, ++actifsTexte);
    await new Promise((resolve) => setImmediate(resolve));
    if (file === 'image') actifsImage--;
    else actifsTexte--;
  };
  kernel.registerAutomationHandler('visual.avatar.generate', suivre('image'));
  kernel.registerAutomationHandler('maintenance.story.cleanup', suivre('texte'));
  for (let i = 0; i < 3; i++) {
    await kernel.enqueueAutomation('visual.avatar.generate', { storyId: `s${i}` });
    await kernel.enqueueAutomation('maintenance.story.cleanup', { storyId: `s${i}` });
  }
  await kernel.processAutomationQueue();
  assert.equal(maxImage, 1);
  assert.equal(maxTexte, 1);
  assert.equal(kernel.getAutomationDiagnostics().completedJobs, 6);
});
