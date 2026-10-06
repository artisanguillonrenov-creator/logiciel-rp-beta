import assert from 'node:assert/strict';
import test from 'node:test';
import { commencerDiagnosticTour, terminerDiagnosticTour } from '../src/engine/diagnosticTour';
import { construireExportDiagnostic, reglagesSansSecrets } from '../src/engine/exportDiagnostic';
import {
  definirHistoireJournal,
  definirPuitsJournal,
  journaliser,
  resumerReferences,
  type EntreeJournal,
} from '../src/engine/journalDiagnostic';
import type { AppSettings, StoryState } from '../src/types';

test('le journal rattache chaque entrée à l’histoire ouverte et au tour en cours', () => {
  const recues: Array<[string, EntreeJournal]> = [];
  definirPuitsJournal((id, e) => recues.push([id, e]));

  definirHistoireJournal(null);
  journaliser('image', { statut: 'ok' });
  assert.equal(recues.length, 0, 'sans histoire ouverte, rien n’est journalisé');

  definirHistoireJournal('histoire-1');
  const tour = commencerDiagnosticTour('diag-test');
  journaliser('appel-ia', { composant: 'Narration', reponse: 'Bonjour' });
  terminerDiagnosticTour();
  journaliser('image', { statut: 'erreur' });

  assert.equal(recues.length, 2);
  assert.equal(recues[0][0], 'histoire-1');
  assert.equal(recues[0][1].tourId, tour.id);
  assert.equal(recues[0][1].reponse, 'Bonjour');
  assert.equal(recues[1][1].tourId, undefined, 'hors tour joueur (tâche de fond)');
  assert.match(recues[1][1].date, /^\d{4}-\d{2}-\d{2}T/);

  definirPuitsJournal(() => { throw new Error('disque plein'); });
  assert.doesNotThrow(() => journaliser('image', {}), 'le diagnostic ne casse jamais le jeu');
  definirPuitsJournal(null);
  definirHistoireJournal(null);
});

test('les images de référence ne sont pas recopiées dans le journal', () => {
  assert.deepEqual(resumerReferences([{ role: 'personnage', image: 'data:image/png;base64,AAAA' }]), [{ role: 'personnage', taille: 26 }]);
});

test('l’export de diagnostic contient l’histoire, le journal et les versions, jamais de secret', () => {
  const settings = { profilContenu: 'adulte', openRouterApiKey: 'sk-secret', serveurLocalApiKey: 'x', langue: 'fr' } as unknown as AppSettings;
  assert.deepEqual(Object.keys(reglagesSansSecrets(settings)).sort(), ['langue', 'profilContenu']);

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
  assert.equal(exp.elyndorCloud.modeleImage, 'big-lust-v16');
  assert.doesNotMatch(JSON.stringify(exp), /sk-secret/);
});
