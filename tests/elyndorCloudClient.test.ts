import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appellerModele,
  configurationLLM,
} from '../src/engine/elyndorCloudClient';
import {
  ELYNDOR_CLOUD_MODELE,
  ELYNDOR_CLOUD_URL,
} from '../src/engine/elyndorCloud';
import {
  cacheEmbeddingsCompatible,
  embeddingsDisponibles,
  identiteEmbeddingsConfiguree,
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
  moteurInference: 'infermatic',
  serveurLocalUrl: 'http://192.168.1.5:1234/v1',
  serveurLocalModele: 'modele-local',
  serveurLocalApiKey: 'ancienne-cle-serveur',
};

test('la configuration impose toujours Elyndor Cloud', () => {
  const config = configurationLLM(anciensReglages, 'override-historique');
  assert.equal(config.model, ELYNDOR_CLOUD_MODELE);
  assert.equal(config.baseUrl, ELYNDOR_CLOUD_URL);
  assert.equal(config.apiKey, '');
  assert.equal(config.moteurInference, 'serveur');
});

test('un appel ignore les anciens fournisseurs et vise uniquement Elyndor Cloud', async () => {
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

test('les embeddings distants restent définitivement désactivés', () => {
  assert.equal(embeddingsDisponibles(anciensReglages), false);
  assert.equal(identiteEmbeddingsConfiguree(anciensReglages), null);
  assert.equal(cacheEmbeddingsCompatible('openrouter:ancien', anciensReglages), false);
  assert.equal(cacheEmbeddingsCompatible(null, anciensReglages), true);
});
