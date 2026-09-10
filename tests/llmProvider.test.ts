import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appelerChatDistant,
  appelerChatDistantAvecOutils,
  configurationLLM,
  ErreurFournisseurLLM,
  listerModelesDistants,
  normaliserFournisseur,
  modeleOverridePourFournisseur,
  parserAppelsOutils,
} from '../src/engine/llmProvider.ts';
import {
  cacheEmbeddingsCompatible,
  embeddingsDisponibles,
  identiteEmbeddingsConfiguree,
  obtenirEmbeddings,
} from '../src/engine/embeddings.ts';

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

test('Infermatic-only dispose des embeddings nécessaires au lore et aux métamoteurs', async () => {
  const settings = {
    openRouterApiKey: '', model: 'ancien', moteurInference: 'infermatic' as const,
    infermaticApiKey: 'infermatic-only', infermaticModel: 'narrateur',
  };
  assert.equal(embeddingsDisponibles(settings), true);
  let requete: { url: string; body: any; authorization: string } | undefined;
  globalThis.fetch = async (url, init) => {
    requete = {
      url: String(url), body: JSON.parse(String(init?.body)),
      authorization: (init?.headers as Record<string, string>).Authorization,
    };
    return Response.json({ data: [{ index: 0, embedding: [1, 0] }] });
  };
  const resultat = await obtenirEmbeddings(['quête à Elyndor'], settings);
  assert.equal(requete?.url, 'https://api.totalgpt.ai/v1/embeddings');
  assert.equal(requete?.authorization, 'Bearer infermatic-only');
  assert.equal(requete?.body.model, 'intfloat-multilingual-e5-base');
  assert.deepEqual(resultat.vecteurs, [[1, 0]]);
  assert.equal(resultat.identiteCache, 'infermatic:intfloat-multilingual-e5-base');
  assert.notEqual(
    identiteEmbeddingsConfiguree(settings),
    identiteEmbeddingsConfiguree({ ...settings, moteurInference: 'openrouter', openRouterApiKey: 'or-key' }),
  );
});

test('le cache OpenAI fallback reste compatible avec une configuration OpenRouter', async () => {
  const settings = {
    openRouterApiKey: 'or-key', model: 'chat', moteurInference: 'openrouter' as const,
    embeddingsApiKey: 'openai-key',
  };
  let appels = 0;
  globalThis.fetch = async (url) => {
    appels++;
    if (String(url).includes('openrouter.ai')) {
      return Response.json({ error: { message: 'embeddings indisponibles' } }, { status: 400 });
    }
    return Response.json({ data: [{ index: 0, embedding: [0, 1] }] });
  };
  const resultat = await obtenirEmbeddings(['lore'], settings);
  assert.equal(appels, 2);
  assert.equal(resultat.identiteCache, 'openai:text-embedding-3-small');
  // C'est la décision utilisée par assurerEmbeddings au tour suivant : un
  // cache compatible est servi directement, sans rappeler obtenirEmbeddings.
  assert.equal(cacheEmbeddingsCompatible(resultat.identiteCache, settings), true);
});

test('un rejet de tool_choice Infermatic se replie sur le JSON-en-prose', async () => {
  let nombreAppels = 0;
  globalThis.fetch = async (_url, init) => {
    nombreAppels++;
    const body = JSON.parse(String(init?.body));
    if (nombreAppels === 1) {
      assert.equal(body.tool_choice, 'auto');
      return Response.json({ error: { message: 'tool_choice unsupported' } }, { status: 400 });
    }
    assert.equal(body.tools, undefined);
    assert.match(body.messages.at(-1).content, /Outils disponibles/);
    return Response.json({ choices: [{ message: { content: 'Analyse\n{"appels":[{"outil":"changer_lieu","arguments":{"lieu":"tour"}}]}' } }] });
  };
  const outils = [{ composant: 'monde', nom: 'changer_lieu', description: 'Change le lieu', parametres: { lieu: { type: 'string' as const } }, requis: ['lieu'] }];
  const resultat = await appelerChatDistantAvecOutils(
    { fournisseur: 'infermatic', apiKey: 'k', model: 'm', messages: [], temperature: 0.2, maxTokens: 50 },
    outils,
    [{ type: 'function' }],
  );
  assert.equal(nombreAppels, 2);
  assert.deepEqual(resultat.appelsOutils, [{ nom: 'changer_lieu', arguments: { lieu: 'tour' } }]);
});

test('traduction et overrides résolvent le fournisseur sélectionné sans fuite inter-provider', () => {
  const infermatic = { openRouterApiKey: '', model: 'or-model', moteurInference: 'infermatic' as const, infermaticApiKey: 'inf-key', infermaticModel: 'inf-model' };
  assert.deepEqual(configurationLLM(infermatic), { apiKey: 'inf-key', model: 'inf-model', moteurInference: 'infermatic' });
  assert.equal(modeleOverridePourFournisseur(infermatic, 'ancien-modele-openrouter'), undefined);
  assert.equal(modeleOverridePourFournisseur(infermatic, 'modele-inf', 'infermatic'), 'modele-inf');
});
