import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appelerChatDistant,
  ErreurFournisseurLLM,
  listerModelesDistants,
  normaliserFournisseur,
  parserAppelsOutils,
} from '../src/engine/llmProvider.ts';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

test('une ancienne configuration sans fournisseur reste sur OpenRouter', () => {
  assert.equal(normaliserFournisseur(undefined), 'openrouter');
  assert.equal(normaliserFournisseur('valeur-inconnue'), 'openrouter');
});

test('Infermatic envoie URL, Bearer et ID de modèle exacts et parse content', async () => {
  let requete: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (url, init) => {
    requete = { url: String(url), init };
    return Response.json({ choices: [{ message: { content: '  récit  ' } }] });
  };
  const data = await appelerChatDistant({
    fournisseur: 'infermatic', apiKey: 'secret-test', model: 'Strawberrylemonade-L3-70B-v1.1-FP8-Dynamic',
    messages: [{ role: 'user', content: 'Bonjour' }], temperature: 0.7, maxTokens: 321,
  });
  assert.equal(requete?.url, 'https://api.totalgpt.ai/v1/chat/completions');
  assert.equal((requete?.init?.headers as Record<string, string>).Authorization, 'Bearer secret-test');
  assert.equal(JSON.parse(String(requete?.init?.body)).model, 'Strawberrylemonade-L3-70B-v1.1-FP8-Dynamic');
  assert.equal(data.choices[0].message.content.trim(), 'récit');
});

test('OpenRouter conserve son endpoint et ses en-têtes', async () => {
  let url = ''; let headers: Record<string, string> = {};
  globalThis.fetch = async (input, init) => {
    url = String(input); headers = init?.headers as Record<string, string>;
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  };
  await appelerChatDistant({ fournisseur: 'openrouter', apiKey: 'or-key', model: 'modele/or', messages: [], temperature: 1, maxTokens: 5 });
  assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(headers['X-Title'], 'Logiciel RP Beta');
});

test('401/403 ne révèle jamais la clé Infermatic', async () => {
  for (const statut of [401, 403]) {
    globalThis.fetch = async () => Response.json({ error: { message: 'secret-test refusé' } }, { status: statut });
    await assert.rejects(
      appelerChatDistant({ fournisseur: 'infermatic', apiKey: 'secret-test', model: 'm', messages: [], temperature: 1, maxTokens: 5 }),
      (e: unknown) => e instanceof ErreurFournisseurLLM && e.statut === statut && !e.message.includes('secret-test'),
    );
  }
});

test('le catalogue Infermatic authentifié conserve exactement les IDs', async () => {
  let authorization = '';
  globalThis.fetch = async (_url, init) => {
    authorization = (init?.headers as Record<string, string>).Authorization;
    return Response.json({ data: [{ id: 'Exact-ID/FP8' }, { id: 'autre', name: 'Autre modèle' }] });
  };
  const modeles = await listerModelesDistants('infermatic', 'catalog-key');
  assert.equal(authorization, 'Bearer catalog-key');
  assert.deepEqual(modeles.map((m) => m.id).sort(), ['Exact-ID/FP8', 'autre']);
});

test('les tool_calls valides sont parsés et les arguments invalides ignorés', () => {
  const appels = parserAppelsOutils({ tool_calls: [
    { type: 'function', function: { name: 'changer_lieu', arguments: '{"lieu":"tour"}' } },
    { type: 'function', function: { name: 'invalide', arguments: '{' } },
  ] });
  assert.deepEqual(appels, [{ nom: 'changer_lieu', arguments: { lieu: 'tour' } }]);
});
