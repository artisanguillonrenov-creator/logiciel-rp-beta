import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CodexAppServerClient,
  ErreurCodexGateway,
  construireEntreeCodex,
  genererTexteCodex,
  obtenirClientCodex,
  reinitialiserClientsCodex,
  type CodexWebSocketLike,
} from '../src/engine/codexAppServerClient';
import { configurationLLM, normaliserFournisseur, modeleOverridePourFournisseur } from '../src/engine/llmProvider';
import { resoudreProfilRaisonnement, appliquerPolitiqueRaisonnement } from '../src/engine/reasoningPolicy';
import { creerDepotReglages, type ClesApi } from '../src/storage/settingsRepository';

// NOTE : ce fichier ne teste jamais openrouter.ts / generateTurn.ts, comme
// le reste de la suite — ces modules importent (via localInference.ts) le
// module natif expo-litert-lm, qui casse sous `node --test` (voir
// localInference.web.ts pour l'équivalent web). Le dispatcher de
// providers dans openrouter.ts (branches 'codex'/'local' d'appellerModele)
// est donc volontairement laissé hors de cette suite automatisée, comme le
// dispatch 'local' préexistant.

// ---------------------------------------------------------------------
// Faux serveur Codex App Server : un WebSocket simulé qui répond aux
// requêtes JSON-RPC via une table de gestionnaires par méthode, et permet
// d'émettre des notifications à la demande (streaming, login, etc.).
// ---------------------------------------------------------------------

type Gestionnaire = (params: any, id?: number) => any;

/** Sentinelle : le gestionnaire simule un gateway qui ne répond jamais
 * (pour exercer les délais d'attente). */
const SANS_REPONSE = Symbol('sans-reponse');

class ErreurSimulee extends Error {
  code: number;
  constructor(message: string, code = -32000) {
    super(message);
    this.code = code;
  }
}

class SocketSimule implements CodexWebSocketLike {
  readyState = 0;
  onopen: ((ev?: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;
  onclose: ((ev?: unknown) => void) | null = null;
  envoyes: any[] = [];
  private fermee = false;

  constructor(private gestionnaires: Record<string, Gestionnaire>, private ouvrirImmediatement = true) {
    if (ouvrirImmediatement) queueMicrotask(() => this.ouvrir());
  }

  ouvrir() {
    if (this.fermee) return;
    this.readyState = 1;
    this.onopen?.();
  }

  send(data: string) {
    const message = JSON.parse(data);
    this.envoyes.push(message);
    if (message.id === undefined) return; // notification, pas de réponse.
    queueMicrotask(() => {
      const gestionnaire = this.gestionnaires[message.method];
      if (!gestionnaire) {
        this.emettre({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Méthode inconnue : ${message.method}` } });
        return;
      }
      try {
        const resultat = gestionnaire(message.params, message.id);
        if (resultat === SANS_REPONSE) return;
        this.emettre({ jsonrpc: '2.0', id: message.id, result: resultat ?? {} });
      } catch (e) {
        const erreur = e instanceof ErreurSimulee ? e : new ErreurSimulee(String(e));
        this.emettre({ jsonrpc: '2.0', id: message.id, error: { code: erreur.code, message: erreur.message } });
      }
    });
  }

  emettre(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  emettreNotification(methode: string, params: unknown) {
    this.emettre({ jsonrpc: '2.0', method: methode, params });
  }

  close() {
    if (this.fermee) return;
    this.fermee = true;
    this.readyState = 3;
    this.onclose?.();
  }
}

function creerClient(
  gestionnaires: Record<string, Gestionnaire>,
  options?: { token?: string; requestTimeoutMs?: number; connectTimeoutMs?: number; turnTimeoutMs?: number; ouvrirImmediatement?: boolean },
) {
  let socket: SocketSimule;
  const token = options?.token ?? 'secret-gateway-token';
  const client = new CodexAppServerClient({
    url: 'wss://gateway.test/codex',
    token,
    requestTimeoutMs: options?.requestTimeoutMs,
    connectTimeoutMs: options?.connectTimeoutMs,
    turnTimeoutMs: options?.turnTimeoutMs,
    webSocketFactory: () => {
      socket = new SocketSimule(
        { initialize: () => ({}), ...gestionnaires },
        options?.ouvrirImmediatement ?? true,
      );
      return socket;
    },
  });
  return { client, token, getSocket: (): SocketSimule => socket! };
}

test.afterEach(() => reinitialiserClientsCodex());

// --- 1. Fournisseur / migration -----------------------------------------

test('un ancien AppSettings sans champ codex normalise toujours sur openrouter', () => {
  assert.equal(normaliserFournisseur(undefined), 'openrouter');
  assert.equal(normaliserFournisseur('codex'), 'codex');
});

test('configurationLLM renvoie une configuration Codex sans apiKey OpenAI, avec gateway/token/modèle', () => {
  const settings = {
    openRouterApiKey: '', model: 'ancien', moteurInference: 'codex' as const,
    codexGatewayUrl: 'wss://mon-gateway.example/codex', codexGatewayToken: 'gw-token', codexModel: 'gpt-5.6-sol', codexReasoningEffort: 'high',
  };
  const config = configurationLLM(settings);
  assert.deepEqual(config, {
    moteurInference: 'codex', apiKey: '', model: 'gpt-5.6-sol',
    gatewayUrl: 'wss://mon-gateway.example/codex', gatewayToken: 'gw-token', reasoningEffort: 'high',
  });
});

test('un override de modèle appartenant à Codex ne fuite pas vers OpenRouter/Infermatic et vice-versa', () => {
  const codex = { openRouterApiKey: '', model: 'or-model', moteurInference: 'codex' as const, codexGatewayUrl: 'wss://g', codexGatewayToken: 't', codexModel: 'gpt-5.6-sol' };
  assert.equal(modeleOverridePourFournisseur(codex, 'ancien-modele-openrouter'), undefined);
  assert.equal(modeleOverridePourFournisseur(codex, 'gpt-5.6-terra', 'codex'), 'gpt-5.6-terra');
  assert.equal(modeleOverridePourFournisseur(codex, 'gpt-5.6-terra', 'infermatic'), undefined);
});

test('le token de gateway Codex est traité comme un secret par le dépôt de réglages, comme les clés API', async () => {
  const etat: { cles: ClesApi | null; raw: string | null } = { cles: null, raw: null };
  const stockage = { getItem: async () => etat.raw, setItem: async (_c: string, v: string) => { etat.raw = v; } };
  const coffre = { lire: async () => etat.cles, ecrire: async (v: ClesApi) => { etat.cles = v; } };
  const depot = creerDepotReglages(stockage, coffre, { openRouterApiKey: '', model: 'm' });
  await depot.enregistrer({ openRouterApiKey: '', model: 'm', moteurInference: 'codex', codexGatewayUrl: 'wss://g', codexGatewayToken: 'ultra-secret' });
  assert.ok(!etat.raw!.includes('ultra-secret'));
  assert.equal(etat.cles?.codexGatewayToken, 'ultra-secret');
  assert.equal((await depot.lire()).codexGatewayToken, 'ultra-secret');
});

// --- 2. Poignée de main / initialize -------------------------------------

test('la connexion envoie initialize puis la notification initialized', async () => {
  const { client, getSocket } = creerClient({});
  await client.ensureConnected();
  const socket = getSocket();
  assert.equal(socket.envoyes[0].method, 'initialize');
  assert.equal(socket.envoyes[0].params.auth.token, 'secret-gateway-token');
  assert.equal(socket.envoyes[1].method, 'initialized');
  assert.equal(socket.envoyes[1].id, undefined);
  assert.equal(client.estConnecte, true);
});

test('initialize déclare explicitement aucun outil de développement Codex', async () => {
  const { client, getSocket } = creerClient({});
  await client.ensureConnected();
  const capabilities = getSocket().envoyes[0].params.capabilities;
  assert.deepEqual(capabilities, { tools: false, terminal: false, shell: false, fileEdits: false, mcp: false, skills: false });
});

// --- 3. account/read ------------------------------------------------------

test('account/read fait toujours autorité, jamais un booléen local', async () => {
  const { client } = creerClient({
    'account/read': () => ({ connected: true, accountId: 'acc-1', email: 'joueur@example.com', plan: 'Plus' }),
  });
  const compte = await client.accountRead();
  assert.deepEqual(compte, { connected: true, accountId: 'acc-1', email: 'joueur@example.com', plan: 'Plus' });
});

test('account/read reflète un compte non connecté sans planter', async () => {
  const { client } = creerClient({ 'account/read': () => ({ connected: false }) });
  assert.deepEqual(await client.accountRead(), { connected: false });
});

// --- 4. device-code login --------------------------------------------------

test('account/login/start retourne le code à afficher au joueur', async () => {
  const { client } = creerClient({
    'account/login/start': () => ({ loginId: 'login-1', verificationUrl: 'https://chatgpt.com/device', userCode: 'ABCD-EFGH' }),
  });
  const login = await client.accountLoginStart();
  assert.deepEqual(login, { loginId: 'login-1', verificationUrl: 'https://chatgpt.com/device', userCode: 'ABCD-EFGH' });
});

test('login réussi : la notification de fin déclenche un account/read et résout le compte connecté', async () => {
  const { client, getSocket } = creerClient({
    'account/read': () => ({ connected: true, accountId: 'acc-9', plan: 'Pro' }),
  });
  await client.ensureConnected();
  const promesse = client.waitForLoginOutcome('login-1');
  getSocket().emettreNotification('account/login/completed', { loginId: 'login-1', status: 'success' });
  assert.deepEqual(await promesse, { connected: true, accountId: 'acc-9', plan: 'Pro' });
});

test('login échoué : rejette avec un message explicite, sans planter', async () => {
  const { client, getSocket } = creerClient({});
  await client.ensureConnected();
  const promesse = client.waitForLoginOutcome('login-1');
  getSocket().emettreNotification('account/login/status', { loginId: 'login-1', status: 'error' });
  await assert.rejects(promesse, /Échec de la connexion ChatGPT/);
});

test('login expiré : message dédié invitant à reconnecter le compte', async () => {
  const { client, getSocket } = creerClient({});
  await client.ensureConnected();
  const promesse = client.waitForLoginOutcome('login-1');
  getSocket().emettreNotification('account/login/status', { loginId: 'login-1', status: 'expired' });
  await assert.rejects(promesse, /Connexion ChatGPT expirée/);
});

test('une notification pour un autre loginId est ignorée', async () => {
  const { client, getSocket } = creerClient({
    'account/read': () => ({ connected: true }),
  });
  await client.ensureConnected();
  const promesse = client.waitForLoginOutcome('login-1');
  getSocket().emettreNotification('account/login/completed', { loginId: 'login-AUTRE', status: 'success' });
  getSocket().emettreNotification('account/login/completed', { loginId: 'login-1', status: 'success' });
  assert.deepEqual(await promesse, { connected: true });
});

test('accountLoginCancel tolère un gateway qui n’expose pas cette méthode', async () => {
  const { client } = creerClient({
    'account/login/cancel': () => { throw new ErreurSimulee('non supporté', -32601); },
  });
  await assert.doesNotReject(client.accountLoginCancel('login-1'));
});

// --- 5. logout --------------------------------------------------------------

test('logout appelle account/logout', async () => {
  let appele = false;
  const { client } = creerClient({ 'account/logout': () => { appele = true; return {}; } });
  await client.accountLogout();
  assert.equal(appele, true);
});

// --- 6. model/list + pagination ---------------------------------------------

test('model/list retourne les modèles réellement fournis par le compte, jamais une liste codée en dur', async () => {
  const { client } = creerClient({
    'model/list': () => ({ models: [{ id: 'gpt-5.6-sol', displayName: 'Sol', supportedReasoningEfforts: ['low', 'high'] }] }),
  });
  const modeles = await client.modelList();
  assert.deepEqual(modeles, [{ id: 'gpt-5.6-sol', displayName: 'Sol', supportedReasoningEfforts: ['low', 'high'] }]);
});

test('model/list paginé agrège toutes les pages via nextCursor', async () => {
  let appels = 0;
  const { client } = creerClient({
    'model/list': (params) => {
      appels++;
      if (!params?.cursor) return { models: [{ id: 'modele-a' }], nextCursor: 'page-2' };
      assert.equal(params.cursor, 'page-2');
      return { models: [{ id: 'modele-b' }] };
    },
  });
  const modeles = await client.modelList();
  assert.equal(appels, 2);
  assert.deepEqual(modeles.map((m) => m.id), ['modele-a', 'modele-b']);
});

test('model/list ignore silencieusement les entrées sans id exploitable', async () => {
  const { client } = creerClient({ 'model/list': () => ({ models: [{ id: '' }, { nom: 'sans-id' }, { id: 'valide' }] }) });
  const modeles = await client.modelList();
  assert.deepEqual(modeles.map((m) => m.id), ['valide']);
});

// --- 7. streaming + turn/completed -------------------------------------------

test('genererTexteCodex crée un thread isolé, envoie le contexte RP et streame la réponse', async () => {
  const threads: any[] = [];
  let socket: SocketSimule;
  const promesse = genererTexteCodex({
    gatewayUrl: 'wss://gateway.test/codex',
    gatewayToken: 'secret-gateway-token',
    model: 'gpt-5.6-sol',
    messages: [
      { role: 'system', content: 'Tu es le narrateur RP.' },
      { role: 'user', content: 'Le héros entre dans la taverne.' },
    ],
    webSocketFactory: () => {
      socket = new SocketSimule({
        initialize: () => ({}),
        'thread/start': (params) => {
          threads.push(params);
          return { threadId: 'thread-1' };
        },
        'turn/start': () => ({ turnId: 'turn-1' }),
      });
      return socket;
    },
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(threads[0].instructions, 'Tu es le narrateur RP.');
  assert.equal(threads[0].tools.length, 0);

  socket!.emettreNotification('turn/agentMessageDelta', { turnId: 'turn-1', delta: 'Le tavernier lève ' });
  socket!.emettreNotification('turn/agentMessageDelta', { turnId: 'turn-1', delta: 'les yeux.' });
  socket!.emettreNotification('turn/completed', { turnId: 'turn-1' });

  assert.equal(await promesse, 'Le tavernier lève les yeux.');
});

test('turn/completed avec un texte explicite prime sur les deltas accumulés', async () => {
  const { client, getSocket } = creerClient({
    'thread/start': () => ({ threadId: 't1' }),
    'turn/start': () => ({ turnId: 'tu1' }),
  });
  await client.ensureConnected();
  const thread = { threadId: 't1' };
  const promesse = client.turnStart(thread, 'contexte', { model: 'gpt-5.6-sol' });
  await new Promise((r) => setImmediate(r));
  getSocket().emettreNotification('turn/agentMessageDelta', { turnId: 'tu1', delta: 'brouillon' });
  getSocket().emettreNotification('turn/completed', { turnId: 'tu1', text: 'Texte final propre.' });
  assert.equal(await promesse, 'Texte final propre.');
});

test('turn/failed rejette avec le message du gateway, masqué de tout secret', async () => {
  const { client, getSocket } = creerClient({
    'thread/start': () => ({ threadId: 't1' }),
    'turn/start': () => ({ turnId: 'tu1' }),
  });
  await client.ensureConnected();
  const promesse = client.turnStart({ threadId: 't1' }, 'x', { model: 'm' });
  await new Promise((r) => setImmediate(r));
  getSocket().emettreNotification('turn/failed', { turnId: 'tu1', message: 'Bearer secret-gateway-token refusé' });
  await assert.rejects(promesse, (e: unknown) => e instanceof ErreurCodexGateway && !e.message.includes('secret-gateway-token'));
});

test('une notification pour un autre tour est ignorée', async () => {
  const { client, getSocket } = creerClient({
    'thread/start': () => ({ threadId: 't1' }),
    'turn/start': () => ({ turnId: 'tu1' }),
  });
  await client.ensureConnected();
  const promesse = client.turnStart({ threadId: 't1' }, 'x', { model: 'm' });
  await new Promise((r) => setImmediate(r));
  getSocket().emettreNotification('turn/agentMessageDelta', { turnId: 'AUTRE-TOUR', delta: 'intrus' });
  getSocket().emettreNotification('turn/completed', { turnId: 'tu1', text: 'bonne réponse' });
  assert.equal(await promesse, 'bonne réponse');
});

// --- 8. interruption / abort -------------------------------------------------

test('interrompre un tour envoie turn/interrupt et rejette proprement', async () => {
  let interruptionRecue: any;
  const { client, getSocket } = creerClient({
    'thread/start': () => ({ threadId: 't1' }),
    'turn/start': () => ({ turnId: 'tu1' }),
    'turn/interrupt': (params) => { interruptionRecue = params; return {}; },
  });
  await client.ensureConnected();
  const controleur = new AbortController();
  const promesse = client.turnStart({ threadId: 't1' }, 'x', { model: 'm', signal: controleur.signal });
  await new Promise((r) => setImmediate(r));
  controleur.abort();
  await assert.rejects(promesse, /annulée/);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(interruptionRecue, { threadId: 't1', turnId: 'tu1' });
  void getSocket();
});

// --- 9. timeouts --------------------------------------------------------------

test('une requête sans réponse dépasse son délai et rejette', async () => {
  const { client } = creerClient({ 'account/read': () => SANS_REPONSE }, { requestTimeoutMs: 20 });
  await assert.rejects(client.accountRead(), /Délai dépassé/);
});

test('un tour sans notification finale dépasse son délai dédié', async () => {
  const { client } = creerClient(
    { 'thread/start': () => ({ threadId: 't1' }), 'turn/start': () => ({ turnId: 'tu1' }) },
    { turnTimeoutMs: 20 },
  );
  await client.ensureConnected();
  await assert.rejects(client.turnStart({ threadId: 't1' }, 'x', { model: 'm' }), /Délai dépassé/);
});

// --- 10. WebSocket coupé / reconnexion ---------------------------------------

test('une coupure WebSocket rejette les requêtes en attente', async () => {
  const { client, getSocket } = creerClient({ 'account/read': () => SANS_REPONSE });
  const promesse = client.accountRead();
  await new Promise((r) => setImmediate(r));
  getSocket().close();
  await assert.rejects(promesse, /interrompue/);
  assert.equal(client.estConnecte, false);
});

test('une coupure pendant un tour en attente de streaming rejette sans attendre le délai complet', async () => {
  const { client, getSocket } = creerClient({
    'thread/start': () => ({ threadId: 't1' }), 'turn/start': () => ({ turnId: 'tu1' }),
  }, { turnTimeoutMs: 60_000 });
  await client.ensureConnected();
  const promesse = client.turnStart({ threadId: 't1' }, 'x', { model: 'm' });
  await new Promise((r) => setImmediate(r));
  getSocket().close();
  await assert.rejects(promesse, /interrompue/);
});

test('ensureConnected reconnecte et rejoue initialize après une coupure', async () => {
  let connexions = 0;
  const client = new CodexAppServerClient({
    url: 'wss://gateway.test/codex',
    token: 't',
    webSocketFactory: () => {
      connexions++;
      return new SocketSimule({ initialize: () => ({}) });
    },
  });
  await client.ensureConnected();
  assert.equal(client.estConnecte, true);
  (client as any).socket.close();
  assert.equal(client.estConnecte, false);
  await client.ensureConnected();
  assert.equal(connexions, 2);
  assert.equal(client.estConnecte, true);
});

test('des appels ensureConnected concurrents ne créent qu’une seule connexion', async () => {
  let connexions = 0;
  const client = new CodexAppServerClient({
    url: 'wss://gateway.test/codex',
    token: 't',
    webSocketFactory: () => {
      connexions++;
      return new SocketSimule({ initialize: () => ({}) });
    },
  });
  await Promise.all([client.ensureConnected(), client.ensureConnected(), client.ensureConnected()]);
  assert.equal(connexions, 1);
});

// --- 11. Sécurité : aucune fuite du token / WSS obligatoire -------------------

test('aucun message envoyé au gateway, en dehors de auth.token à l’initialisation, ne contient le token', async () => {
  const { client, getSocket } = creerClient({
    'account/read': () => ({ connected: true }),
    'thread/start': () => ({ threadId: 't1' }),
  });
  await client.accountRead();
  await client.threadStart('instructions', 'gpt-5.6-sol');
  const socket = getSocket();
  for (const message of socket.envoyes) {
    if (message.method === 'initialize') continue;
    assert.ok(!JSON.stringify(message).includes('secret-gateway-token'));
  }
});

test('une erreur de connexion ne révèle jamais le token dans son message', async () => {
  const { client } = creerClient({
    'account/read': () => { throw new ErreurSimulee('Bearer secret-gateway-token invalide'); },
  });
  await assert.rejects(client.accountRead(), (e: unknown) => e instanceof ErreurCodexGateway && !e.message.includes('secret-gateway-token'));
});

test('ws:// non chiffré est refusé pour un hôte distant', () => {
  assert.throws(
    () => new CodexAppServerClient({ url: 'ws://gateway.example.com/codex', token: 't' }),
    /wss:\/\//,
  );
});

test('ws:// reste toléré pour un gateway local en bêta personnelle', () => {
  assert.doesNotThrow(() => new CodexAppServerClient({ url: 'ws://127.0.0.1:8787/codex', token: 't' }));
});

// --- 12. Raisonnement jamais affiché -----------------------------------------

test('les notifications de raisonnement sont ignorées à la racine du transport, jamais transmises', async () => {
  const { client, getSocket } = creerClient({});
  await client.ensureConnected();
  const recues: string[] = [];
  client.onNotification((methode) => recues.push(methode));
  getSocket().emettreNotification('turn/reasoningDelta', { text: 'chaîne de pensée' });
  getSocket().emettreNotification('turn/analysisDelta', { text: 'analyse interne' });
  getSocket().emettreNotification('turn/thinking', { text: 'brouillon interne' });
  getSocket().emettreNotification('turn/agentMessageDelta', { turnId: 'x', delta: 'texte visible' });
  assert.deepEqual(recues, ['turn/agentMessageDelta']);
});

test('un texte final qui contiendrait quand même des balises de raisonnement est nettoyé', async () => {
  let socket: SocketSimule;
  const promesse = genererTexteCodex({
    gatewayUrl: 'wss://gateway.test/codex',
    gatewayToken: 'secret-gateway-token-2',
    model: 'gpt-5.6-sol',
    messages: [{ role: 'user', content: 'Continue le récit.' }],
    webSocketFactory: () => {
      socket = new SocketSimule({
        initialize: () => ({}),
        'thread/start': () => ({ threadId: 't1' }),
        'turn/start': () => ({ turnId: 'tu1' }),
      });
      return socket;
    },
  });
  await new Promise((r) => setImmediate(r));
  socket!.emettreNotification('turn/completed', { turnId: 'tu1', text: '<think>je planifie la scène</think>Le récit continue.' });
  assert.equal(await promesse, 'Le récit continue.');
});

test('resoudreProfilRaisonnement("codex", …) est toujours hidden, quel que soit le modèle', () => {
  const profil = resoudreProfilRaisonnement('codex', 'gpt-5.6-sol');
  assert.equal(profil.reasoningPolicy, 'hidden');
  assert.equal(profil.supportsReasoning, true);
  assert.equal(profil.reasoningRequestParameters, undefined);
  assert.doesNotThrow(() => appliquerPolitiqueRaisonnement({ content: 'x' }, profil));
});

// --- 13. Adaptateur ChatMessage[] → entrée Codex ------------------------------

test('construireEntreeCodex place le prompt système en instructions, prioritaire, jamais dans l’historique', () => {
  const { instructions, input } = construireEntreeCodex([
    { role: 'system', content: 'Règles RP.' },
    { role: 'user', content: 'Bonjour' },
    { role: 'assistant', content: 'Salut, aventurier.' },
    { role: 'user', content: 'Que vois-je ?' },
  ]);
  assert.equal(instructions, 'Règles RP.');
  assert.ok(input.includes('Bonjour'));
  assert.ok(input.includes('Salut, aventurier.'));
  assert.ok(!input.includes('Règles RP.'));
});

test('genererTexteCodex échoue explicitement sans gateway ni modèle configurés', async () => {
  await assert.rejects(
    genererTexteCodex({ gatewayUrl: '', gatewayToken: '', model: 'm', messages: [{ role: 'user', content: 'x' }] }),
    /Aucun gateway Codex configuré/,
  );
  await assert.rejects(
    genererTexteCodex({ gatewayUrl: 'wss://g', gatewayToken: 't', model: '', messages: [{ role: 'user', content: 'x' }] }),
    /Aucun modèle Codex sélectionné/,
  );
});

// --- 14. Client partagé --------------------------------------------------------

test('obtenirClientCodex réutilise la même connexion pour un même couple gateway/token', () => {
  const a = obtenirClientCodex('wss://g', 't', () => new SocketSimule({}));
  const b = obtenirClientCodex('wss://g', 't', () => new SocketSimule({}));
  const c = obtenirClientCodex('wss://g', 'autre-token', () => new SocketSimule({}));
  assert.equal(a, b);
  assert.notEqual(a, c);
});
