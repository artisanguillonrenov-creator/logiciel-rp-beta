import assert from 'node:assert/strict';
import test from 'node:test';
import { normaliserReglagesFournisseurs } from '../src/engine/elyndorCloud';
import { resoudreRouteTexte } from '../src/engine/fournisseursRuntime';

test('OpenRouter choisi explicitement prend la place d’un ancien Elyndor Cloud', () => {
  const apres = normaliserReglagesFournisseurs({
    openRouterApiKey: 'cle-test', model: 'exemple/modele:free',
    moteurInference: 'serveur', fournisseurNarration: 'openrouter',
    serveurLocalUrl: 'elyndor-cloud', serveurLocalModele: 'cydonia-24b-elyndor',
  });
  assert.equal(apres.moteurInference, 'openrouter');
  assert.equal(apres.fournisseurNarration, 'openrouter');
  const route = resoudreRouteTexte(apres);
  assert.equal(route.fournisseur, 'openrouter');
  assert.equal(route.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(route.model, 'exemple/modele:free');
  assert.equal(route.apiKey, 'cle-test');
});

test('une ancienne installation Cloud sans choix explicite bascule vers OpenRouter gratuit', () => {
  const apres = normaliserReglagesFournisseurs({
    openRouterApiKey: '', model: 'cydonia-24b-elyndor',
    moteurInference: 'serveur', serveurLocalUrl: 'elyndor-cloud',
    serveurLocalModele: 'cydonia-24b-elyndor',
  });
  assert.equal(apres.fournisseurNarration, 'openrouter');
  assert.equal(apres.model, 'openrouter/free');
  assert.equal(resoudreRouteTexte(apres).fournisseur, 'openrouter');
});

test('RunPod ne se réactive que lorsqu’il est choisi explicitement', () => {
  const runpod = normaliserReglagesFournisseurs({
    openRouterApiKey: 'ancienne-cle', model: 'openrouter/free',
    moteurInference: 'openrouter', fournisseurNarration: 'runpod',
    serveurLocalUrl: 'https://ancien-serveur/v1',
  });
  assert.equal(runpod.moteurInference, 'serveur');
  assert.equal(runpod.serveurLocalUrl, 'elyndor-cloud');
  assert.equal(resoudreRouteTexte(runpod).fournisseur, 'runpod');
});
