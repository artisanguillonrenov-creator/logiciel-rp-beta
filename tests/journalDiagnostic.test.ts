import assert from 'node:assert/strict';
import test from 'node:test';
import { commencerDiagnosticTour, terminerDiagnosticTour } from '../src/engine/diagnosticTour';
import { construireExportDiagnostic, reglagesSansSecrets } from '../src/engine/exportDiagnostic';
import {
  definirPuitsJournal,
  journaliser,
  resumerReferences,
  type EntreeJournal,
} from '../src/engine/journalDiagnostic';
import type { AppSettings, StoryState } from '../src/types';

test('chaque entrée va dans le journal de l’histoire qui l’a produite, jamais dans celle affichée', () => {
  const recues: Array<[string, EntreeJournal]> = [];
  definirPuitsJournal((id, e) => recues.push([id, e]));

  journaliser('image', { statut: 'ok' }, undefined);
  assert.equal(recues.length, 0, 'sans histoire connue, rien n’est journalisé plutôt que mal rangé');

  // Tour joueur de l'histoire B pendant qu'une tâche de fond de A se termine.
  const tourB = commencerDiagnosticTour('diag-b', 'histoire-B');
  journaliser('appel-ia', { composant: 'Narration', reponse: 'Bonjour' }, 'histoire-B');
  journaliser('appel-ia', { composant: 'Mémoire' }, 'histoire-A');
  terminerDiagnosticTour();
  journaliser('image', { statut: 'erreur' }, 'histoire-B');

  assert.deepEqual(recues.map(([id]) => id), ['histoire-B', 'histoire-A', 'histoire-B']);
  assert.equal(recues[0][1].tourId, tourB.id);
  assert.equal(recues[1][1].tourId, undefined, 'la tâche de A ne prend pas le tour de B');
  assert.equal(recues[2][1].tourId, undefined, 'hors tour joueur');
  assert.match(recues[0][1].date, /^\d{4}-\d{2}-\d{2}T/);

  definirPuitsJournal(() => { throw new Error('disque plein'); });
  assert.doesNotThrow(() => journaliser('image', {}, 'histoire-B'), 'le diagnostic ne casse jamais le jeu');
  definirPuitsJournal(null);
});

test('les images de référence ne sont pas recopiées dans le journal', () => {
  assert.deepEqual(resumerReferences([{ role: 'personnage', image: 'data:image/png;base64,AAAA' }]), [{ role: 'personnage', taille: 26 }]);
});

test('l’export de diagnostic contient l’histoire, le journal et les versions, jamais de secret', () => {
  const settings = {
    profilContenu: 'adulte', openRouterApiKey: 'sk-secret', serveurLocalApiKey: 'x',
    codeDeverrouillage: '4321', langueInterface: 'fr', reglageFutur: 'inconnu',
  } as unknown as AppSettings;
  assert.deepEqual(Object.keys(reglagesSansSecrets(settings)).sort(), ['langueInterface', 'profilContenu']);

  const story = {
    meta: { id: 'h1', titre: 'Test' },
    messages: [
      { id: 'm1', role: 'user', content: 'Salut', timestamp: 1 },
      { id: 'm2', role: 'assistant', content: 'Bonjour', timestamp: 2, diagnosticTour: { id: 'd1' } },
    ],
  } as unknown as StoryState;
  const journal = [
    { type: 'appel-ia', date: '2026-10-06T10:00:00.000Z', statut: 'ok' },
    { type: 'image', date: '2026-10-06T10:01:00.000Z', statut: 'erreur' },
  ] as EntreeJournal[];
  const exp = construireExportDiagnostic({
    story, settings, journal,
    application: { version: '1.0.1', plateforme: 'android' },
    maintenant: new Date('2026-10-06T10:05:00Z'),
  }) as any;

  assert.equal(exp.format, 'elyndor-diagnostic');
  assert.equal(exp.histoire, story);
  assert.equal(exp.resume.reponsesNarrateur, 1);
  assert.equal(exp.resume.toursAvecDiagnostic, 1);
  assert.equal(exp.resume.imagesJournalisees, 1);
  assert.equal(exp.resume.erreursJournalisees, 1);
  assert.equal(exp.elyndorCloud.modeleImage, 'lustify-sdxl-v4');
  assert.doesNotMatch(JSON.stringify(exp), /sk-secret|4321/);
});
