import assert from 'node:assert/strict';
import test from 'node:test';
import {
  annulerMesureTokens,
  commencerMesureTokens,
  cumulerUsages,
  enregistrerAppelSansUsage,
  enregistrerUsageAppel,
  terminerMesureTokens,
} from '../src/engine/mesureTokens';
import { appellerModele, configurationLLM } from '../src/engine/elyndorCloudClient';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; annulerMesureTokens(); });

test('cumule les usages OpenAI (cache et raisonnement compris) sur un tour', () => {
  commencerMesureTokens();
  enregistrerUsageAppel({ prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200, prompt_tokens_details: { cached_tokens: 300 } });
  enregistrerUsageAppel({ input_tokens: 50, output_tokens: 20, reasoning_output_tokens: 10 });
  assert.deepEqual(terminerMesureTokens(), {
    inputTokens: 1050, cachedInputTokens: 300, outputTokens: 220, reasoningTokens: 10, totalTokens: 1270, apiCalls: 2, complete: true,
  });
});

test('un appel sans usage rend la mesure partielle ; aucune mesure hors tour', () => {
  enregistrerUsageAppel({ total_tokens: 99 });
  commencerMesureTokens();
  enregistrerAppelSansUsage();
  const u = terminerMesureTokens();
  assert.equal(u?.apiCalls, 1);
  assert.equal(u?.complete, false);
  commencerMesureTokens();
  assert.equal(terminerMesureTokens(), undefined);
});

test('les appels narratifs alimentent la mesure du tour, quel que soit le fournisseur', async () => {
  configurationLLM({moteurInference:'openrouter',model:'openrouter/free',openRouterApiKey:'test'});
  globalThis.fetch = async () => Response.json({
    choices: [{ message: { content: 'ok' } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });
  commencerMesureTokens();
  await appellerModele({
    apiKey: '',
    model: '',
    messages: [],
    temperature: 1,
    maxTokens: 5,
  });
  assert.equal(terminerMesureTokens()?.totalTokens, 15);
});

test('le bilan d’une histoire compte les tours partiels', () => {
  const plein = { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1, reasoningTokens: 0, totalTokens: 2, apiCalls: 1, complete: true };
  const bilan = cumulerUsages([plein, undefined, { ...plein, complete: false }]);
  assert.equal(bilan.totalTokens, 4);
  assert.equal(bilan.toursPartiels, 1);
});
