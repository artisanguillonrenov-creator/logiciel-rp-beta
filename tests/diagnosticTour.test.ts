import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ajouterEtapeDiagnostic,
  annulerDiagnosticTour,
  commencerDiagnosticTour,
  enregistrerAppelIADiagnostic,
  enregistrerEmbeddingsDiagnostic,
  terminerDiagnosticTour,
} from '../src/engine/diagnosticTour';

test.afterEach(() => annulerDiagnosticTour());

test('le diagnostic reste passif hors d’un tour actif', () => {
  ajouterEtapeDiagnostic('hors tour', 'test', 'ok', 12);
  enregistrerAppelIADiagnostic({
    composant: 'test',
    modele: 'modele',
    maxTokens: 100,
    dureeMs: 20,
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });
  assert.equal(terminerDiagnosticTour(), undefined);
});

test('trace le chemin, les usages IA et les embeddings d’un tour', () => {
  commencerDiagnosticTour('tour-test');
  ajouterEtapeDiagnostic('Recherche lore', 'recherche', 'ok', 15, undefined, ['3 entrées retenues']);
  ajouterEtapeDiagnostic('Validation LLM', 'validation', 'ignoree', 0, 'contradictionProbable() = false');

  enregistrerAppelIADiagnostic({
    composant: 'Narration RP',
    modele: 'elyndor-cloud',
    maxTokens: 700,
    dureeMs: 1234,
    usage: {
      prompt_tokens: 1000,
      completion_tokens: 200,
      total_tokens: 1200,
      prompt_tokens_details: { cached_tokens: 300 },
      completion_tokens_details: { reasoning_tokens: 25 },
    },
  });
  enregistrerEmbeddingsDiagnostic({
    composant: 'Requête de recherche',
    textes: 1,
    lots: 1,
    dureeMs: 40,
  });

  const diagnostic = terminerDiagnosticTour();
  assert.ok(diagnostic);
  assert.equal(diagnostic.id, 'tour-test');
  assert.equal(diagnostic.etapes.length, 2);
  assert.equal(diagnostic.etapes[1].statut, 'ignoree');
  assert.equal(diagnostic.etapes[1].raison, 'contradictionProbable() = false');
  assert.equal(diagnostic.appelsIA.length, 1);
  assert.equal(diagnostic.appelsIA[0].inputTokens, 1000);
  assert.equal(diagnostic.appelsIA[0].cachedInputTokens, 300);
  assert.equal(diagnostic.appelsIA[0].outputTokens, 200);
  assert.equal(diagnostic.appelsIA[0].reasoningTokens, 25);
  assert.equal(diagnostic.appelsIA[0].totalTokens, 1200);
  assert.equal(diagnostic.embeddings.length, 1);
  assert.equal(diagnostic.embeddings[0].textes, 1);
  assert.equal(diagnostic.embeddings[0].lots, 1);
});

test('un nouvel appel commencerDiagnosticTour isole le tour suivant', () => {
  commencerDiagnosticTour('ancien');
  ajouterEtapeDiagnostic('ancienne étape', 'test', 'ok');

  commencerDiagnosticTour('nouveau');
  ajouterEtapeDiagnostic('nouvelle étape', 'test', 'ok');

  const diagnostic = terminerDiagnosticTour();
  assert.ok(diagnostic);
  assert.equal(diagnostic.id, 'nouveau');
  assert.deepEqual(diagnostic.etapes.map((e) => e.nom), ['nouvelle étape']);
});
