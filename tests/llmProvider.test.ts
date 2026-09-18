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
} from '../src/engine/llmProvider';
import {
  cacheEmbeddingsCompatible,
  embeddingsDisponibles,
  identiteEmbeddingsConfiguree,
  obtenirEmbeddings,
} from '../src/engine/embeddings';
import { nettoyerRaisonnementInterne } from '../src/engine/responseSanitizer';
import { planifierTransactionCache } from '../src/storage/embeddingsCacheMutex';
import { appliquerPolitiqueRaisonnement, resoudreProfilRaisonnement } from '../src/engine/reasoningPolicy';

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

test('les requêtes fournisseur reçoivent un signal d’annulation', async () => {
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = async (_url, init) => {
    signal = init?.signal;
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  };
  await appelerChatDistant({
    fournisseur: 'openrouter', apiKey: 'or-key', model: 'modele/or', messages: [], temperature: 1, maxTokens: 5,
  });
  assert.ok(signal instanceof AbortSignal);
  assert.equal(signal?.aborted, false);
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
  assert.equal(requete?.body.model, 'Qwen-Qwen3-Embedding-8B');
  assert.deepEqual(resultat.vecteurs, [[1, 0]]);
  assert.equal(resultat.identiteCache, 'infermatic:Qwen-Qwen3-Embedding-8B');
  assert.notEqual(
    identiteEmbeddingsConfiguree(settings),
    identiteEmbeddingsConfiguree({ ...settings, moteurInference: 'openrouter', openRouterApiKey: 'or-key' }),
  );
});

test('Infermatic embeddings se replie sur E5 en tronquant les textes longs', async () => {
  const modeles: string[] = [];
  let texteE5 = '';
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    modeles.push(body.model);
    if (body.model === 'Qwen-Qwen3-Embedding-8B') return Response.json({ error: { message: 'indisponible' } }, { status: 404 });
    texteE5 = body.input[0];
    return Response.json({ data: [{ index: 0, embedding: [1] }] });
  };
  const resultat = await obtenirEmbeddings(['é'.repeat(5000)], {
    openRouterApiKey: '', model: '', moteurInference: 'infermatic', infermaticApiKey: 'k', infermaticModel: 'chat',
  });
  assert.deepEqual(modeles, ['Qwen-Qwen3-Embedding-8B', 'intfloat-multilingual-e5-base']);
  assert.ok(Array.from(texteE5).length <= 128);
  assert.equal(resultat.identiteCache, 'infermatic:intfloat-multilingual-e5-base');
  assert.equal(cacheEmbeddingsCompatible('infermatic:Qwen-Qwen3-Embedding-8B', {
    openRouterApiKey: '', model: '', moteurInference: 'infermatic', infermaticApiKey: 'k',
  }), true);
  assert.equal(cacheEmbeddingsCompatible('infermatic:intfloat-multilingual-e5-base', {
    openRouterApiKey: '', model: '', moteurInference: 'infermatic', infermaticApiKey: 'k',
  }), true);
});

test('la file Infermatic limite chat et embeddings à une requête active', async () => {
  let actifs = 0; let maximum = 0;
  globalThis.fetch = async (url) => {
    actifs++; maximum = Math.max(maximum, actifs);
    await new Promise((resolve) => setTimeout(resolve, 10));
    actifs--;
    return String(url).includes('/embeddings')
      ? Response.json({ data: [{ index: 0, embedding: [1] }] })
      : Response.json({ choices: [{ message: { content: 'ok' } }] });
  };
  const settings = { openRouterApiKey: '', model: '', moteurInference: 'infermatic' as const, infermaticApiKey: 'k', infermaticModel: 'm' };
  await Promise.all([
    appelerChatDistant({ fournisseur: 'infermatic', apiKey: 'k', model: 'm', messages: [], temperature: 1, maxTokens: 1 }),
    obtenirEmbeddings(['a'], settings),
    appelerChatDistant({ fournisseur: 'infermatic', apiKey: 'k', model: 'm', messages: [], temperature: 1, maxTokens: 1 }),
  ]);
  assert.equal(maximum, 1);
});

test('la file Infermatic ne sérialise pas OpenRouter', async () => {
  let actifs = 0; let maximum = 0;
  globalThis.fetch = async () => {
    actifs++; maximum = Math.max(maximum, actifs);
    await new Promise((resolve) => setTimeout(resolve, 10));
    actifs--;
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  };
  await Promise.all([
    appelerChatDistant({ fournisseur: 'openrouter', apiKey: 'k', model: 'm', messages: [], temperature: 1, maxTokens: 1 }),
    appelerChatDistant({ fournisseur: 'openrouter', apiKey: 'k', model: 'm', messages: [], temperature: 1, maxTokens: 1 }),
  ]);
  assert.equal(maximum, 2);
});

test('429 Infermatic respecte un retry borné', async () => {
  let appels = 0;
  globalThis.fetch = async () => {
    appels++;
    return appels === 1
      ? Response.json({}, { status: 429, headers: { 'Retry-After': '0' } })
      : Response.json({ choices: [{ message: { content: 'succès' } }] });
  };
  const data = await appelerChatDistant({ fournisseur: 'infermatic', apiKey: 'k', model: 'm', messages: [], temperature: 1, maxTokens: 1 });
  assert.equal(appels, 2);
  assert.equal(data.choices[0].message.content, 'succès');

  appels = 0;
  globalThis.fetch = async () => { appels++; return Response.json({}, { status: 429, headers: { 'Retry-After': '0' } }); };
  await assert.rejects(
    appelerChatDistant({ fournisseur: 'infermatic', apiKey: 'k', model: 'm', messages: [], temperature: 1, maxTokens: 1 }),
    (e: unknown) => e instanceof ErreurFournisseurLLM && e.statut === 429,
  );
  assert.equal(appels, 3);
});

test('les erreurs embeddings 400/401/403 ne révèlent aucun secret', async () => {
  for (const statut of [400, 401, 403]) {
    globalThis.fetch = async () => Response.json({ error: { message: 'Bearer SECRET_TEST / SECRET_TEST refusé' } }, { status: statut });
    await assert.rejects(
      obtenirEmbeddings(['x'], { openRouterApiKey: '', model: '', moteurInference: 'infermatic', infermaticApiKey: 'SECRET_TEST' }),
      (e: unknown) => e instanceof Error && !e.message.includes('SECRET_TEST'),
    );
  }
});

test('nettoie les blocs think sans toucher à la réponse finale', () => {
  assert.equal(nettoyerRaisonnementInterne('<think>a</think>RP<THINK>b</THINK> fin'), 'RP fin');
  assert.equal(nettoyerRaisonnementInterne('réponse</think>'), 'réponse');
  assert.equal(nettoyerRaisonnementInterne('avant<think>non fermé'), 'avant');
});

test('think est nettoyé avant le fallback JSON et les tool_calls restent intacts', async () => {
  const toolCalls = [{ type: 'function', function: { name: 'outil', arguments: '{}' } }];
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '<think>secret</think>', tool_calls: toolCalls } }] });
  const natif = await appelerChatDistantAvecOutils(
    { fournisseur: 'infermatic', apiKey: 'k', model: 'm', messages: [], temperature: 1, maxTokens: 1 }, [], [],
  );
  assert.equal(natif.contenu, '');
  assert.deepEqual(natif.appelsOutils, [{ nom: 'outil', arguments: {} }]);
});

test('le mutex cache évite une mise à jour perdue entre deux transactions', async () => {
  let index: string[] = [];
  const ajouter = (id: string) => planifierTransactionCache(async () => {
    const lu = [...index];
    await new Promise((resolve) => setTimeout(resolve, 5));
    index = [...lu, id];
  });
  await Promise.all([ajouter('lore-a'), ajouter('lore-b')]);
  assert.deepEqual(index, ['lore-a', 'lore-b']);
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
    return Response.json({ choices: [{ message: { content: '<think>raisonnement</think>Analyse\n{"appels":[{"outil":"changer_lieu","arguments":{"lieu":"tour"}}]}' } }] });
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

test('la politique de raisonnement OpenRouter coupe systématiquement le raisonnement natif, sans opt-in par appel', async () => {
  let corps: any;
  globalThis.fetch = async (_url, init) => {
    corps = JSON.parse(String(init?.body));
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  };
  await appelerChatDistant({ fournisseur: 'openrouter', apiKey: 'k', model: 'deepseek/deepseek-v3.2', messages: [], temperature: 1, maxTokens: 5 });
  assert.deepEqual(corps.reasoning, { enabled: false });
});

test("Infermatic n'a pas de paramètre natif : hidden repose sur le filtrage de la réponse", () => {
  const profil = resoudreProfilRaisonnement('infermatic', 'un-modele-quelconque');
  assert.equal(profil.reasoningPolicy, 'hidden');
  assert.equal(profil.reasoningRequestParameters, undefined);
  const openrouter = resoudreProfilRaisonnement('openrouter', 'un-modele-quelconque');
  assert.equal(openrouter.reasoningPolicy, 'disabled');
  assert.deepEqual(openrouter.reasoningRequestParameters, { reasoning: { enabled: false } });
});

test('un raisonnement natif (reasoning/reasoning_content/analysis/thinking) est toujours ignoré, jamais transmis', () => {
  const message: Record<string, unknown> = {
    content: 'Le récit continue.',
    reasoning: 'chaîne de pensée brute',
    reasoning_content: 'autre variante brute',
    reasoning_details: [{ type: 'text', text: 'détails' }],
    analysis: 'canal analysis brut',
    thinking: 'canal thinking brut',
  };
  appliquerPolitiqueRaisonnement(message, resoudreProfilRaisonnement('openrouter', 'gpt-oss-120b'));
  assert.deepEqual(message, { content: 'Le récit continue.' });
});

test('le filtrage OpenRouter agit aussi en repli si un modèle injecte son raisonnement dans content malgré le paramètre natif', async () => {
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '<think>chaîne de pensée</think>Récit visible.' } }] });
  const data = await appelerChatDistant({ fournisseur: 'openrouter', apiKey: 'k', model: 'deepseek/deepseek-v3.2', messages: [], temperature: 1, maxTokens: 5 });
  assert.equal(data.choices[0].message.content, 'Récit visible.');
});

test('appliquerPolitiqueRaisonnement refuse une politique "visible" (invariant RP)', () => {
  assert.throws(() => appliquerPolitiqueRaisonnement({ content: 'x' }, {
    supportsReasoning: true, reasoningPolicy: 'visible', balisesRaisonnement: [],
  }));
});

test('seules les balises déclarées sont retirées : pas de regex générique qui mangerait de la narration RP', () => {
  const narration = 'Il analysait la situation en silence, pensif, avant de répondre.';
  assert.equal(nettoyerRaisonnementInterne(narration, ['think', 'analysis']), narration);
  assert.equal(
    nettoyerRaisonnementInterne('<analysis>note interne</analysis>Bonjour à toi.', ['think', 'analysis']),
    'Bonjour à toi.',
  );
});
