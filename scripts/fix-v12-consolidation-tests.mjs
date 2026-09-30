import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Patch introuvable: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Patch ambigu: ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}
function replaceRange(source, start, end, replacement, label) {
  const a = source.indexOf(start);
  if (a < 0) throw new Error(`Début introuvable: ${label}`);
  const b = source.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`Fin introuvable: ${label}`);
  return source.slice(0, a) + replacement + '\n\n' + source.slice(b);
}

// Une histoire neuve doit déjà avoir un core V12 normalisé. Sinon le premier
// rechargement change migration.legacyImported et fait apparaître une fausse
// modification de sauvegarde.
{
  const path = 'src/engine/story.ts';
  let s = read(path);
  s = replaceOnce(
    s,
    "import { creerNarrativeCoreV12 } from './narrative/narrativeCoreV12';",
    "import { assurerNarrativeCoreV12, creerNarrativeCoreV12 } from './narrative/narrativeCoreV12';",
    'story import ensure core',
  );
  s = replaceOnce(
    s,
    "  const maintenant = Date.now();\n  return {\n    version: VERSION_SCHEMA_HISTOIRE,",
    "  const maintenant = Date.now();\n  const story: StoryState = {\n    version: VERSION_SCHEMA_HISTOIRE,",
    'story create stable object',
  );
  s = replaceOnce(
    s,
    "    narrativeCore: creerNarrativeCoreV12(),\n  };\n}",
    "    narrativeCore: creerNarrativeCoreV12(),\n  };\n  return assurerNarrativeCoreV12(story);\n}",
    'story normalize fresh core',
  );
  write(path, s);
}

// Narrative OS V1 a volontairement remplacé les embeddings réseau par un
// hashing vectoriel local déterministe. Les anciens tests Infermatic/OpenAI
// testaient donc un comportement supprimé, pas une régression.
{
  const path = 'tests/llmProvider.test.ts';
  let s = read(path);

  s = replaceRange(
    s,
    "test('Infermatic-only dispose des embeddings nécessaires au lore et aux métamoteurs'",
    "test('la file Infermatic limite chat et embeddings à une requête active'",
    `test('les embeddings du Narrative OS sont locaux, disponibles et déterministes', async () => {
  const settings = {
    openRouterApiKey: '', model: 'ancien', moteurInference: 'infermatic' as const,
    infermaticApiKey: 'infermatic-only', infermaticModel: 'narrateur',
  };
  let appelsReseau = 0;
  globalThis.fetch = async () => {
    appelsReseau++;
    throw new Error('Un embedding local ne doit jamais appeler le réseau');
  };

  assert.equal(embeddingsDisponibles(settings), true);
  const premier = await obtenirEmbeddings(['quête à Elyndor'], settings);
  const second = await obtenirEmbeddings(['quête à Elyndor'], {
    ...settings, moteurInference: 'openrouter', openRouterApiKey: 'or-key',
  });

  assert.equal(appelsReseau, 0);
  assert.equal(premier.fournisseur, 'local');
  assert.equal(premier.identiteCache, 'local:hashing-v1:512');
  assert.equal(identiteEmbeddingsConfiguree(settings), 'local:hashing-v1:512');
  assert.equal(premier.vecteurs[0].length, 512);
  assert.deepEqual(premier.vecteurs, second.vecteurs);
  assert.equal(cacheEmbeddingsCompatible('local:hashing-v1:512', settings), true);
  assert.equal(cacheEmbeddingsCompatible('infermatic:ancien-modele', settings), false);
});`,
    'obsolete remote embedding tests',
  );

  s = replaceRange(
    s,
    "test('la file Infermatic limite chat et embeddings à une requête active'",
    "test('la file Infermatic ne sérialise pas OpenRouter'",
    `test('la file Infermatic limite les appels chat distants à une requête active', async () => {
  let actifs = 0; let maximum = 0;
  globalThis.fetch = async () => {
    actifs++; maximum = Math.max(maximum, actifs);
    await new Promise((resolve) => setTimeout(resolve, 10));
    actifs--;
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  };
  await Promise.all([
    appelerChatDistant({ fournisseur: 'infermatic', apiKey: 'k', model: 'm', messages: [], temperature: 1, maxTokens: 1 }),
    appelerChatDistant({ fournisseur: 'infermatic', apiKey: 'k', model: 'm', messages: [], temperature: 1, maxTokens: 1 }),
  ]);
  assert.equal(maximum, 1);
});`,
    'Infermatic chat queue without local embeddings',
  );

  s = replaceRange(
    s,
    "test('les erreurs embeddings 400/401/403 ne révèlent aucun secret'",
    "test('nettoie les blocs think sans toucher à la réponse finale'",
    `test('les embeddings locaux ne transmettent jamais les clés API', async () => {
  let appelsReseau = 0;
  globalThis.fetch = async () => {
    appelsReseau++;
    throw new Error('réseau interdit');
  };
  const resultat = await obtenirEmbeddings(['x'], {
    openRouterApiKey: 'SECRET_OR', model: 'chat', moteurInference: 'infermatic', infermaticApiKey: 'SECRET_INF',
  });
  assert.equal(appelsReseau, 0);
  assert.equal(resultat.identiteCache, 'local:hashing-v1:512');
});`,
    'obsolete embedding HTTP error test',
  );

  s = replaceRange(
    s,
    "test('le cache OpenAI fallback reste compatible avec une configuration OpenRouter'",
    "test('un rejet de tool_choice Infermatic se replie sur le JSON-en-prose'",
    `test('le cache d embeddings ne mélange pas les anciennes identités réseau avec le hashing local', async () => {
  const settings = {
    openRouterApiKey: 'or-key', model: 'chat', moteurInference: 'openrouter' as const,
    embeddingsApiKey: 'openai-key',
  };
  const resultat = await obtenirEmbeddings(['lore'], settings);
  assert.equal(resultat.identiteCache, 'local:hashing-v1:512');
  assert.equal(cacheEmbeddingsCompatible(resultat.identiteCache, settings), true);
  assert.equal(cacheEmbeddingsCompatible('openai:text-embedding-3-small', settings), false);
});`,
    'obsolete OpenAI embedding fallback test',
  );

  write(path, s);
}

// Le schéma persistant autoritatif est désormais V12.
{
  const path = 'tests/storage.test.ts';
  let s = read(path);
  s = replaceOnce(s, '  assert.equal(migree.version, 9);', '  assert.equal(migree.version, 12);', 'storage schema expectation');
  write(path, s);
}

console.log('Tests et création d’histoire alignés sur Narrative OS local + schéma V12.');
