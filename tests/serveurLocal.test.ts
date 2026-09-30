import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appelerServeurAvecOutils,
  connecterServeurLocal,
  ErreurServeurLocal,
  genererTexteServeur,
  normaliserUrlServeur,
  resoudreModeleServeur,
} from '../src/engine/serveurLocal';
import { configurationLLM, normaliserFournisseur } from '../src/engine/llmProvider';
import type { ToolDefinition } from '../src/engine/openrouter';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

const config = { baseUrl: 'http://192.168.1.25:1234/v1', model: 'qwen3.5-9b' };

test('l’adresse du serveur tolère les saisies approximatives', () => {
  assert.equal(normaliserUrlServeur(''), 'http://127.0.0.1:1234/v1');
  assert.equal(normaliserUrlServeur('192.168.1.25:1234'), 'http://192.168.1.25:1234/v1');
  assert.equal(normaliserUrlServeur('http://localhost:11434/v1/'), 'http://localhost:11434/v1');
  assert.equal(normaliserUrlServeur('http://127.0.0.1:1234/v1/chat/completions'), 'http://127.0.0.1:1234/v1');
});

test('le nom du fichier GGUF retrouve l’identifiant exposé par le runtime', () => {
  const modeles = [
    { id: 'qwen3.5-9b', nom: 'qwen3.5-9b' },
    { id: 'text-embedding-nomic-embed-text-v1.5', nom: 'nomic' },
  ];
  assert.equal(resoudreModeleServeur('Qwen3.5-9B-Q4_K_M.gguf', modeles), 'qwen3.5-9b');
  assert.equal(resoudreModeleServeur('qwen3.5-9b', modeles), 'qwen3.5-9b');
  assert.equal(resoudreModeleServeur('C:\\Models\\qwen3.5-9b.gguf', modeles), 'qwen3.5-9b');
  assert.equal(resoudreModeleServeur('mistral', modeles), null);
  assert.equal(resoudreModeleServeur('', [modeles[0]]), 'qwen3.5-9b');
  assert.equal(resoudreModeleServeur('', modeles), null);
});

test('un nom ambigu n’est jamais résolu au hasard', () => {
  const modeles = [{ id: 'qwen3.5-9b@q4_k_m', nom: 'a' }, { id: 'qwen3.5-9b@q8_0', nom: 'b' }];
  assert.equal(resoudreModeleServeur('qwen3.5-9b', modeles), null);
  assert.equal(resoudreModeleServeur('Qwen3.5-9B@Q8_0', modeles), 'qwen3.5-9b@q8_0');
});

test('la connexion liste /models et explique l’absence de correspondance', async () => {
  let url = '';
  globalThis.fetch = async (input) => {
    url = String(input);
    return Response.json({ data: [{ id: 'qwen3.5-9b' }, { id: 'gemma-3-12b' }] });
  };
  const resultat = await connecterServeurLocal(config, 'Qwen3.5-9B-Q4_K_M.gguf');
  assert.equal(url, 'http://192.168.1.25:1234/v1/models');
  assert.equal(resultat.modele, 'qwen3.5-9b');
  await assert.rejects(connecterServeurLocal(config, 'llama'), /gemma-3-12b, qwen3.5-9b/);
});

test('génération : corps OpenAI, reasoning_effort bas, budget relevé et raisonnement filtré', async () => {
  let corps: any; let entetes: Record<string, string> = {};
  globalThis.fetch = async (_url, init) => {
    corps = JSON.parse(String(init?.body));
    entetes = init?.headers as Record<string, string>;
    return Response.json({
      choices: [{ message: { content: '<think>plan</think>  La porte grince.  ', reasoning_content: 'secret' } }],
    });
  };
  const texte = await genererTexteServeur({
    config: { ...config, apiKey: 'cle-lan' },
    messages: [{ role: 'user', content: 'J’ouvre la porte.' }],
    temperature: 0.8,
    maxTokens: 700,
  });
  assert.equal(texte, 'La porte grince.');
  assert.equal(corps.model, 'qwen3.5-9b');
  assert.equal(corps.reasoning_effort, 'low');
  assert.equal(corps.stream, false);
  assert.equal(corps.max_tokens, 4096);
  assert.equal(entetes.Authorization, 'Bearer cle-lan');
});

test('un modèle sans raisonnement garde le budget demandé et aucune clé n’est envoyée', async () => {
  let corps: any; let entetes: Record<string, string> = {};
  globalThis.fetch = async (_url, init) => {
    corps = JSON.parse(String(init?.body));
    entetes = init?.headers as Record<string, string>;
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  };
  await genererTexteServeur({ config: { ...config, model: 'gemma-3-12b' }, messages: [], temperature: 1, maxTokens: 300 });
  assert.equal(corps.max_tokens, 300);
  assert.equal(entetes.Authorization, undefined);
});

test('une réponse faite uniquement de raisonnement produit une erreur explicite', async () => {
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '', reasoning_content: 'je réfléchis…' } }] });
  await assert.rejects(
    genererTexteServeur({ config, messages: [], temperature: 1, maxTokens: 300 }),
    /raisonnement interne/,
  );
});

test('serveur injoignable : message utile plutôt qu’un TypeError opaque', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(
    genererTexteServeur({ config, messages: [], temperature: 1, maxTokens: 300 }),
    (e: unknown) => e instanceof ErreurServeurLocal && /Impossible de joindre le serveur local/.test(e.message),
  );
});

const outil: ToolDefinition = {
  composant: 'monde', nom: 'deplacer_pnj', description: 'Déplace un PNJ',
  parametres: { pnj: { type: 'string' } }, requis: ['pnj'],
};

test('outils : tool_calls natifs, puis repli JSON si le runtime refuse le champ tools', async () => {
  globalThis.fetch = async () => Response.json({
    choices: [{ message: { content: '', tool_calls: [{ type: 'function', function: { name: 'deplacer_pnj', arguments: '{"pnj":"Aela"}' } }] } }],
  });
  const natif = await appelerServeurAvecOutils({ config, messages: [], temperature: 0.2, maxTokens: 600 }, [outil], [{}]);
  assert.deepEqual(natif.appelsOutils, [{ nom: 'deplacer_pnj', arguments: { pnj: 'Aela' } }]);

  const corps: any[] = [];
  globalThis.fetch = async (_url, init) => {
    corps.push(JSON.parse(String(init?.body)));
    if (corps.length === 1) return Response.json({ error: { message: 'tools non supporté' } }, { status: 400 });
    return Response.json({ choices: [{ message: { content: '{"appels":[{"outil":"deplacer_pnj","arguments":{"pnj":"Aela"}}]}' } }] });
  };
  const repli = await appelerServeurAvecOutils({ config, messages: [{ role: 'user', content: 'go' }], temperature: 0.2, maxTokens: 600 }, [outil], [{}]);
  assert.deepEqual(repli.appelsOutils, [{ nom: 'deplacer_pnj', arguments: { pnj: 'Aela' } }]);
  assert.ok(corps[0].tools);
  assert.equal(corps[1].tools, undefined);
});

test('configurationLLM transporte l’adresse et le modèle du serveur local', () => {
  assert.equal(normaliserFournisseur('serveur'), 'serveur');
  const conf = configurationLLM({
    openRouterApiKey: 'or', model: 'modele/or', moteurInference: 'serveur',
    serveurLocalUrl: '192.168.1.25:1234', serveurLocalModele: 'qwen3.5-9b',
  });
  assert.deepEqual(conf, {
    apiKey: '', model: 'qwen3.5-9b', moteurInference: 'serveur', baseUrl: 'http://192.168.1.25:1234/v1',
  });
});
