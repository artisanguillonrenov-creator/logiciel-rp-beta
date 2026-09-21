import express from 'express';
import cors from 'cors';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://celadon-duckanoo-306626.netlify.app';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TURN_TIMEOUT_MS = 180_000;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin(origin, cb) {
    if (!origin || origin === ALLOWED_ORIGIN || origin === 'http://localhost:8081' || origin === 'http://localhost:19006') {
      cb(null, true);
      return;
    }
    cb(new Error('Origin non autorisée'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

class CodexRpc {
  constructor() {
    this.proc = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.ready = false;
    this.startPromise = null;
  }

  async ensureStarted() {
    if (this.ready && this.proc && !this.proc.killed) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.start();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async start() {
    this.ready = false;
    const proc = spawn('codex', ['app-server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    this.proc = proc;

    proc.stderr.on('data', (chunk) => {
      const text = String(chunk).trim();
      if (text) console.error('[codex]', text.slice(0, 2000));
    });

    const rl = readline.createInterface({ input: proc.stdout });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        console.error('[codex] JSON invalide:', line.slice(0, 500));
        return;
      }

      if (msg.id !== undefined && msg.id !== null) {
        const waiter = this.pending.get(msg.id);
        if (waiter) {
          this.pending.delete(msg.id);
          clearTimeout(waiter.timer);
          if (msg.error) waiter.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else waiter.resolve(msg.result);
        }
        return;
      }

      for (const listener of this.listeners) {
        try { listener(msg); } catch (err) { console.error('[gateway listener]', err); }
      }
    });

    const exitPromise = new Promise((_, reject) => {
      proc.once('error', reject);
      proc.once('exit', (code, signal) => {
        this.ready = false;
        const err = new Error(`Codex app-server arrêté (code=${code}, signal=${signal})`);
        for (const waiter of this.pending.values()) {
          clearTimeout(waiter.timer);
          waiter.reject(err);
        }
        this.pending.clear();
        reject(err);
      });
    });

    await Promise.race([
      (async () => {
        await this.requestRaw('initialize', {
          clientInfo: {
            name: 'elyndor_rp_gateway',
            title: 'Elyndor RP',
            version: '0.2.0',
          },
          capabilities: { experimentalApi: true },
        }, 20_000);
        this.notify('initialized', {});
        this.ready = true;
      })(),
      exitPromise,
    ]);
  }

  requestRaw(method, params = {}, timeoutMs = 30_000) {
    if (!this.proc?.stdin?.writable) return Promise.reject(new Error('Codex app-server indisponible'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout RPC Codex: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.proc.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    });
  }

  async request(method, params = {}, timeoutMs = 30_000) {
    await this.ensureStarted();
    return this.requestRaw(method, params, timeoutMs);
  }

  notify(method, params = {}) {
    if (!this.proc?.stdin?.writable) return;
    this.proc.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  onNotification(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

const codex = new CodexRpc();
const sessions = new Map();
const loginToSession = new Map();

function makeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(token);
      if (session.loginId) loginToSession.delete(session.loginId);
    }
  }
}
setInterval(cleanupSessions, 30 * 60 * 1000).unref();

codex.onNotification((msg) => {
  if (msg.method === 'account/login/completed') {
    const loginId = msg.params?.loginId;
    const token = loginToSession.get(loginId);
    if (!token) return;
    const session = sessions.get(token);
    if (!session) return;
    session.loginCompleted = true;
    session.authorized = Boolean(msg.params?.success);
    session.loginError = msg.params?.error || null;
  }

  if (msg.method === 'account/updated') {
    for (const session of sessions.values()) {
      if (session.authorized) {
        session.authMode = msg.params?.authMode ?? session.authMode;
        session.planType = msg.params?.planType ?? session.planType;
      }
    }
  }
});

function bearer(req) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] || null;
}

function requireSession(req, res, next) {
  const token = bearer(req);
  const session = token ? sessions.get(token) : null;
  if (!session) {
    res.status(401).json({ error: 'Session Elyndor absente ou expirée.' });
    return;
  }
  if (!session.authorized) {
    res.status(401).json({ error: session.loginError || 'Connexion ChatGPT non terminée.' });
    return;
  }
  req.elyndorSession = session;
  next();
}

function flattenMessages(messages) {
  const safe = Array.isArray(messages) ? messages : [];
  return safe
    .filter((m) => m && typeof m.content === 'string')
    .map((m) => {
      const role = m.role === 'system' ? 'INSTRUCTIONS SYSTÈME' : m.role === 'assistant' ? 'NARRATEUR' : 'JOUEUR';
      return `[${role}]\n${m.content}`;
    })
    .join('\n\n');
}

function entierUsage(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// Codex app-server émet l'usage séparément via thread/tokenUsage/updated.
// La passerelle le convertit au format OpenAI-compatible déjà compris par
// les autres fournisseurs d'Elyndor. cached/reasoning sont des sous-totaux,
// pas des tokens à ajouter une seconde fois au total.
function normaliserUsageCodex(tokenUsage) {
  const brut = tokenUsage?.last || tokenUsage?.total || tokenUsage;
  if (!brut || typeof brut !== 'object') return null;
  const input = entierUsage(brut.inputTokens ?? brut.input_tokens);
  const cached = entierUsage(brut.cachedInputTokens ?? brut.cached_input_tokens);
  const output = entierUsage(brut.outputTokens ?? brut.output_tokens);
  const reasoning = entierUsage(brut.reasoningOutputTokens ?? brut.reasoning_output_tokens);
  const total = entierUsage(brut.totalTokens ?? brut.total_tokens) || input + output;
  if (!input && !output && !total && !cached && !reasoning) return null;
  return {
    prompt_tokens: input,
    completion_tokens: output,
    total_tokens: total,
    prompt_tokens_details: { cached_tokens: cached },
    completion_tokens_details: { reasoning_tokens: reasoning },
  };
}

async function generateNarration({ messages, model, effort = 'low' }) {
  const prompt = `${flattenMessages(messages)}\n\n[CONSIGNE PASSERELLE]\nRespecte strictement les instructions et le format de sortie demandés ci-dessus. N'utilise aucun outil, n'exécute aucune commande et n'expose pas ton raisonnement interne. Retourne uniquement le contenu final demandé.`;

  const started = await codex.request('thread/start', {
    ...(model ? { model } : {}),
    serviceName: 'elyndor_rp',
  }, 30_000);
  const threadId = started?.thread?.id;
  if (!threadId) throw new Error('Codex n’a pas renvoyé de threadId.');

  let text = '';
  let fallbackText = '';
  let turnId = null;
  let usage = null;
  let finishResolve;
  let finishReject;
  const finished = new Promise((resolve, reject) => {
    finishResolve = resolve;
    finishReject = reject;
  });
  const timeout = setTimeout(() => finishReject(new Error('Timeout de génération GPT.')), TURN_TIMEOUT_MS);

  const off = codex.onNotification((msg) => {
    const params = msg.params || {};
    const notificationThreadId = params.threadId || params.thread?.id;
    if (notificationThreadId && notificationThreadId !== threadId) return;

    if (msg.method === 'item/agentMessage/delta') {
      const delta = params.delta;
      if (typeof delta === 'string') text += delta;
      else if (typeof delta?.text === 'string') text += delta.text;
    }

    if (msg.method === 'item/completed') {
      const item = params.item;
      if (item?.type === 'agentMessage') {
        if (typeof item.text === 'string') fallbackText = item.text;
        if (typeof item.content === 'string') fallbackText = item.content;
        if (Array.isArray(item.content)) {
          fallbackText = item.content.map((x) => x?.text).filter(Boolean).join('');
        }
      }
    }

    if (msg.method === 'thread/tokenUsage/updated') {
      const usageTurnId = params.turnId;
      if (!turnId || !usageTurnId || usageTurnId === turnId) {
        usage = normaliserUsageCodex(params.tokenUsage) || usage;
      }
    }

    if (msg.method === 'turn/completed') {
      const id = params.turn?.id || params.turnId;
      if (!turnId || !id || id === turnId) {
        // L'usage est une notification distincte. Une très courte grâce évite
        // de supprimer le thread avant une mise à jour d'usage adjacente.
        setTimeout(finishResolve, 30);
      }
    }
  });

  try {
    const turn = await codex.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: prompt }],
      ...(model ? { model } : {}),
      effort,
      approvalPolicy: 'never',
      sandboxPolicy: { type: 'readOnly' },
    }, 30_000);
    turnId = turn?.turn?.id || null;
    await finished;
    const finalText = (text || fallbackText).trim();
    if (!finalText) throw new Error('GPT a terminé sans réponse exploitable.');
    return { content: finalText, threadId, turnId, usage };
  } finally {
    clearTimeout(timeout);
    off();
    codex.request('thread/delete', { threadId }, 10_000).catch(() => {});
  }
}

app.get('/health', async (_req, res) => {
  try {
    await codex.ensureStarted();
    res.json({ ok: true, codexReady: true, gateway: 'elyndor-chatgpt-plus' });
  } catch (error) {
    res.status(503).json({ ok: false, codexReady: false, error: error.message });
  }
});

app.post('/auth/device/start', async (_req, res) => {
  try {
    const result = await codex.request('account/login/start', { type: 'chatgptDeviceCode' }, 30_000);
    const sessionToken = makeToken();
    const session = {
      createdAt: Date.now(),
      loginId: result?.loginId || null,
      authorized: false,
      loginCompleted: false,
      loginError: null,
      authMode: null,
      planType: null,
    };
    sessions.set(sessionToken, session);
    if (session.loginId) loginToSession.set(session.loginId, sessionToken);
    res.json({
      type: result?.type,
      loginId: result?.loginId,
      verificationUrl: result?.verificationUrl,
      userCode: result?.userCode,
      sessionToken,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/auth/status', async (req, res) => {
  const token = bearer(req);
  const session = token ? sessions.get(token) : null;
  if (!session) {
    res.status(401).json({ connected: false, error: 'Session absente ou expirée.' });
    return;
  }
  try {
    if (session.authorized) {
      const account = await codex.request('account/read', { refreshToken: false }, 15_000);
      session.planType = account?.account?.planType ?? session.planType;
      session.authMode = account?.account?.type ?? session.authMode;
    }
    res.json({
      connected: Boolean(session.authorized),
      completed: Boolean(session.loginCompleted),
      error: session.loginError,
      planType: session.planType,
      authMode: session.authMode,
    });
  } catch (error) {
    res.status(500).json({ connected: false, error: error.message });
  }
});

app.get('/account', requireSession, async (_req, res) => {
  try {
    const result = await codex.request('account/read', { refreshToken: false }, 15_000);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/limits', requireSession, async (_req, res) => {
  try {
    const result = await codex.request('account/rateLimits/read', {}, 15_000);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/usage', requireSession, async (_req, res) => {
  try {
    const result = await codex.request('account/usage/read', {}, 15_000);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/models', requireSession, async (_req, res) => {
  try {
    const result = await codex.request('model/list', { limit: 50, includeHidden: false }, 20_000);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/chat', requireSession, async (req, res) => {
  try {
    const { messages, model, effort } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages doit contenir au moins un message.' });
      return;
    }
    const result = await generateNarration({ messages, model, effort });
    res.json({
      choices: [{ message: { role: 'assistant', content: result.content } }],
      model: model || null,
      usage: result.usage,
    });
  } catch (error) {
    console.error('[chat]', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/auth/logout', requireSession, async (req, res) => {
  try {
    await codex.request('account/logout', {}, 15_000);
  } catch {}
  const token = bearer(req);
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  console.error('[http]', err);
  res.status(500).json({ error: err.message || 'Erreur passerelle.' });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Elyndor ChatGPT Plus gateway listening on ${PORT}`);
  try {
    await codex.ensureStarted();
    console.log('Codex app-server ready');
  } catch (error) {
    console.error('Codex app-server startup failed:', error);
  }
});