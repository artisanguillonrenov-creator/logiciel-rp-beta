import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyserCorpsReponse,
  appellerModele,
  configurationLLM,
} from '../src/engine/elyndorCloudClient';
import {
  ELYNDOR_CLOUD_MODELE,
  ELYNDOR_CLOUD_POD_PAR_DEFAUT,
  assurerPodElyndorCloud,
  definirPodElyndorCloud,
  lirePodDepuisConfig,
  podElyndorCloud,
  urlNarrationElyndorCloud,
  urlServeurImagesElyndorCloud,
} from '../src/engine/elyndorCloud';

// Pod fixé : les tests ne doivent pas aller lire la configuration publiée.
definirPodElyndorCloud(ELYNDOR_CLOUD_POD_PAR_DEFAUT);
const ELYNDOR_CLOUD_URL = urlNarrationElyndorCloud();
const ELYNDOR_CLOUD_EMBEDDINGS_URL = urlServeurImagesElyndorCloud();
import {
  cacheEmbeddingsCompatible,
  embeddingsDisponibles,
  identiteEmbeddingsConfiguree,
  obtenirEmbeddings,
} from '../src/engine/embeddings';

// Invariant d'architecture : aucun ancien réglage ne doit pouvoir détourner
// un appel narratif hors du client Elyndor Cloud unique. Ce test constitue
// le garde-fou final contre la réintroduction d'un fournisseur historique.
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

const anciensReglages: any = {
  openRouterApiKey: 'ancienne-cle-openrouter',
  model: 'ancien-modele',
  infermaticApiKey: 'ancienne-cle-infermatic',
  infermaticModel: 'ancien-infermatic',
  embeddingsApiKey: 'ancienne-cle-embeddings',
  moteurInference: 'serveur',
  serveurLocalUrl: 'elyndor-cloud',
  serveurLocalModele: 'cydonia-24b-elyndor',
  fournisseurEmbeddings: 'runpod',
  serveurLocalApiKey: 'ancienne-cle-serveur',
};

test('une configuration RunPod explicite préserve Cydonia', () => {
  const config = configurationLLM(anciensReglages, 'override-historique');
  assert.equal(config.model, ELYNDOR_CLOUD_MODELE);
  assert.equal(config.baseUrl, ELYNDOR_CLOUD_URL);
  assert.equal(config.apiKey, '');
  assert.equal(config.moteurInference, 'serveur');
});

test('une configuration RunPod ne laisse pas les options d’appel détourner le routage', async () => {
  let requete: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    requete = { url: String(input), init };
    return Response.json({
      choices: [{ message: { content: '  réponse Elyndor  ' } }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    });
  };

  const texte = await appellerModele({
    apiKey: 'ne-doit-jamais-partir',
    model: 'ne-doit-jamais-partir',
    moteurInference: 'infermatic',
    baseUrl: 'http://serveur-local-interdit/v1',
    messages: [{ role: 'user', content: 'Bonjour' }],
    temperature: 0.4,
    maxTokens: 123,
  });

  assert.equal(texte, 'réponse Elyndor');
  assert.equal(requete?.url, `${ELYNDOR_CLOUD_URL}/chat/completions`);
  const headers = requete?.init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, undefined);
  const body = JSON.parse(String(requete?.init?.body));
  assert.equal(body.model, ELYNDOR_CLOUD_MODELE);
  assert.equal(body.temperature, 0.4);
  assert.equal(body.max_tokens, 123);
  assert.equal(String(requete?.init?.body).includes('ne-doit-jamais-partir'), false);
  assert.equal(String(requete?.init?.body).includes('serveur-local-interdit'), false);
});

test('les embeddings explicitement activés utilisent uniquement bge-m3 RunPod', () => {
  assert.equal(embeddingsDisponibles(anciensReglages), true);
  assert.equal(identiteEmbeddingsConfiguree(anciensReglages), 'elyndor-cloud:bge-m3');
  // Un cache OpenRouter/Infermatic d'un autre modèle n'est jamais mélangé aux vecteurs bge-m3.
  assert.equal(cacheEmbeddingsCompatible('openrouter:ancien', anciensReglages), false);
  assert.equal(cacheEmbeddingsCompatible('elyndor-cloud:bge-m3', anciensReglages), true);
  assert.equal(cacheEmbeddingsCompatible(null, anciensReglages), true);
});

test('les embeddings RunPod sont demandés par lots et remis dans l’ordre', async () => {
  const appels: { url: string; body: any }[] = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    appels.push({ url: String(url), body });
    // Réponse volontairement dans le désordre : l'index fait foi.
    const data = body.input.map((_: string, i: number) => ({ index: i, embedding: [i + 1, 0.5] })).reverse();
    return new Response(JSON.stringify({ data }), { status: 200 });
  }) as typeof fetch;
  try {
    const textes = Array.from({ length: 40 }, (_, i) => `texte ${i}`);
    const resultat = await obtenirEmbeddings(textes, anciensReglages);
    assert.equal(appels.length, 2);
    assert.equal(appels[0].url, `${ELYNDOR_CLOUD_EMBEDDINGS_URL}/embeddings`);
    assert.equal(appels[0].body.model, 'bge-m3');
    assert.equal(appels[0].body.input.length, 32);
    assert.equal(resultat.vecteurs.length, 40);
    assert.deepEqual(resultat.vecteurs[0], [1, 0.5]);
    assert.deepEqual(resultat.vecteurs[33], [2, 0.5]);
    assert.equal(resultat.identiteCache, 'elyndor-cloud:bge-m3');
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('un service d’embeddings injoignable lève une erreur, ce qui déclenche le relais lexical', async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (async () => new Response('bad gateway', { status: 502 })) as typeof fetch;
  try {
    await assert.rejects(obtenirEmbeddings(['x'], anciensReglages), /502/);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('une réponse en flux SSE est recomposée : contenu, finish_reason et usage', async () => {
  const flux = [
    'data: {"choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}',
    '',
    'data: {"choices":[{"delta":{"content":"La pluie "},"finish_reason":null}]}',
    'data: {"choices":[{"delta":{"content":"tombe sur"},"finish_reason":null}]}',
    'data: {"choices":[{"delta":{},"finish_reason":"length"}]}',
    'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":5,"total_tokens":17}}',
    'data: [DONE]',
  ].join('\n');
  const data = analyserCorpsReponse(flux);
  assert.equal(data.choices[0].message.content, 'La pluie tombe sur');
  assert.equal(data.choices[0].finish_reason, 'length');
  assert.equal(data.usage.total_tokens, 17);

  // Réponse JSON classique (serveur sans streaming) : inchangée.
  assert.equal(analyserCorpsReponse('{"choices":[{"message":{"content":"ok"}}]}').choices[0].message.content, 'ok');
  // Erreur transmise dans le flux.
  assert.throws(() => analyserCorpsReponse('data: {"error":{"message":"context overflow"}}'), /context overflow/);
});

test('la narration est demandée en streaming, les appels à outils non', async () => {
  const corps: any[] = [];
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    corps.push(JSON.parse(String(init?.body)));
    return new Response('data: {"choices":[{"delta":{"content":"Bonjour."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n', { status: 200 });
  }) as typeof fetch;
  try {
    const texte = await appellerModele({ ...configurationLLM(anciensReglages), messages: [{ role: 'user', content: 'x' }] });
    assert.equal(texte, 'Bonjour.');
    assert.equal(corps[0].stream, true);
    assert.deepEqual(corps[0].stream_options, { include_usage: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('le pod est lu dans la configuration publiée, avec repli sur le pod intégré', async () => {
  assert.equal(lirePodDepuisConfig({ pod: 'mjp2vk70p1sw4g' }), 'mjp2vk70p1sw4g');
  assert.equal(lirePodDepuisConfig({ pod: 'https://exemple.com/' }), null);
  assert.equal(lirePodDepuisConfig(null), null);

  assert.equal(definirPodElyndorCloud('nouveaupod123'), true);
  assert.equal(urlNarrationElyndorCloud(), 'https://nouveaupod123-8000.proxy.runpod.net/v1');
  assert.equal(urlServeurImagesElyndorCloud(), 'https://nouveaupod123-7860.proxy.runpod.net/v1');
  assert.equal(definirPodElyndorCloud('../evil'), false);
  assert.equal(podElyndorCloud(), 'nouveaupod123');
  // Déjà chargé : aucune nouvelle lecture réseau.
  assert.equal(await assurerPodElyndorCloud(async () => { throw new Error('ne doit pas être appelé'); }), 'nouveaupod123');
  definirPodElyndorCloud(ELYNDOR_CLOUD_POD_PAR_DEFAUT);
});


test('samplers narratifs explicitement activés sont réellement placés dans la requête llama.cpp', async () => {
  let body: any;
  globalThis.fetch = async (_, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ choices: [{ message: { content: 'Le monde reste cohérent.' }, finish_reason: 'stop' }] });
  };
  await appellerModele({
    apiKey: '', model: '', messages: [{ role: 'user', content: 'Une scène.' }],
    samplers: { top_k: 72, min_p: 0.08, dry_multiplier: 1.2, repeat_last_n: 512 },
  });
  assert.equal(body.top_k, 72);
  assert.equal(body.min_p, 0.08);
  assert.equal(body.dry_multiplier, 1.2);
  assert.equal(body.repeat_last_n, 512);
  assert.equal(body.temperature, 0.9);
  assert.equal(body.model, ELYNDOR_CLOUD_MODELE);
});

test('OpenRouter gratuit reçoit la bonne clé, aucun sampler propriétaire ni appel RunPod', async () => {
  let url='';let body:any;let headers:any;
  configurationLLM({openRouterApiKey:'cle-test',model:'openrouter/free',
    moteurInference:'openrouter',fournisseurEmbeddings:'desactive'});
  globalThis.fetch=async (input,init) => {
    url=String(input);headers=init?.headers;
    body=JSON.parse(String(init?.body));
    return Response.json({choices:[{message:{content:'Une réponse.'},finish_reason:'stop'}]});
  };
  const sortie=await appellerModele({apiKey:'',model:'',messages:[{role:'user',content:'Bonjour'}],
    samplers:{top_k:99,dry_multiplier:1.2}});
  assert.equal(sortie,'Une réponse.');
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(headers.Authorization,'Bearer cle-test');
  assert.equal(body.model,'openrouter/free');
  assert.equal(body.top_k,undefined);
  assert.equal(body.dry_multiplier,undefined);
});

test('sans clé OpenRouter un appel est bloqué avant toute connexion', async () => {
  configurationLLM({openRouterApiKey:'',model:'openrouter/free',moteurInference:'openrouter'});
  let appels=0;
  globalThis.fetch=async()=>{appels++;return Response.json({});};
  await assert.rejects(appellerModele({apiKey:'',model:'',messages:[{role:'user',content:'x'}]}),/clé OpenRouter/i);
  assert.equal(appels,0);
});
