import { masquerSecrets, nettoyerRaisonnementInterne } from './responseSanitizer';
import { resoudreProfilRaisonnement } from './reasoningPolicy';
import type { ChatMessage } from './openrouter';

/**
 * Client Codex App Server / Gateway — connexion WSS + JSON-RPC 2.0.
 *
 * Ce fichier est le SEUL endroit du projet qui parle directement au Codex
 * App Server. Il ne fait tourner aucun `codex app-server` en local : il se
 * connecte à un gateway distant (ou sur la même machine, mais toujours en
 * tant que service séparé — voir docs/CODEX_GATEWAY.md) via WebSocket.
 *
 * Ce client est un pur transport de GÉNÉRATION DE TEXTE :
 * - aucun outil de développement n'est jamais activé (pas de terminal, pas
 *   de shell, pas de modification de fichiers, pas de Skills/MCP) ;
 * - aucune donnée n'est lue depuis l'historique des threads Codex comme
 *   mémoire narrative — chaque appel RP crée un thread isolé, jetable ;
 * - aucun raisonnement interne (reasoning/analysis/thinking) n'est jamais
 *   exposé à l'appelant, quelle que soit la notification reçue.
 */

export class ErreurCodexGateway extends Error {
  readonly code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = 'ErreurCodexGateway';
    this.code = code;
  }
}

/** Interface minimale requise d'un WebSocket — satisfaite par le WebSocket
 * global (RN, navigateur, Node ≥ 22) et par n'importe quel mock de test. */
export interface CodexWebSocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev?: unknown) => void) | null;
}

export type CodexWebSocketFactory = (url: string, protocols?: string[]) => CodexWebSocketLike;

function fabriqueWebSocketParDefaut(url: string): CodexWebSocketLike {
  const Ctor = (globalThis as any).WebSocket;
  if (!Ctor) {
    throw new ErreurCodexGateway("Aucune implémentation WebSocket disponible sur cette plateforme.");
  }
  return new Ctor(url);
}

/** WSS obligatoire, sauf pour un gateway local (même esprit que Hermes en
 * bêta personnelle — voir docs/CODEX_GATEWAY.md, section sécurité). */
function verifierUrlSecurisee(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ErreurCodexGateway('URL de gateway Codex invalide.');
  }
  if (parsed.protocol === 'wss:') return;
  if (parsed.protocol === 'ws:' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) return;
  throw new ErreurCodexGateway(
    'Le gateway Codex doit être joint en wss:// (chiffré). ws:// non chiffré n’est autorisé que pour un gateway local (localhost).',
  );
}

export interface CodexAccountInfo {
  connected: boolean;
  accountId?: string;
  email?: string;
  plan?: string;
}

export interface CodexModelInfo {
  id: string;
  displayName?: string;
  supportedReasoningEfforts?: string[];
}

export interface CodexLoginStart {
  loginId: string;
  verificationUrl: string;
  userCode: string;
}

export type CodexLoginOutcome = 'success' | 'error' | 'expired' | 'cancelled';

export interface CodexThreadHandle {
  threadId: string;
}

export interface CodexClientOptions {
  url: string;
  token: string;
  webSocketFactory?: CodexWebSocketFactory;
  /** Délai maximal pour une requête JSON-RPC ordinaire (compte, modèles…). */
  requestTimeoutMs?: number;
  /** Délai maximal pour la poignée de main initiale (connect + initialize). */
  connectTimeoutMs?: number;
  /** Délai maximal d'inactivité pour un tour narratif complet. */
  turnTimeoutMs?: number;
}

interface RequetePendante {
  resolve: (valeur: any) => void;
  reject: (erreur: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type EcouteurNotification = (methode: string, params: unknown) => void;

const DELAI_REQUETE_DEFAUT_MS = 20_000;
const DELAI_CONNEXION_DEFAUT_MS = 15_000;
const DELAI_TOUR_DEFAUT_MS = 90_000;

// Toute notification dont la méthode évoque un canal de raisonnement interne
// est ignorée à la racine du transport — avant même d'atteindre le code
// appelant. C'est une protection en profondeur : la politique de
// raisonnement (reasoningPolicy.ts) filtre déjà le texte final, mais ce
// client ne doit jamais faire remonter ces événements, même bruts.
const MOTIF_NOTIFICATION_RAISONNEMENT = /reasoning|thinking|analysis|chain[-_]?of[-_]?thought/i;

// Méthodes de tour narratif reconnues (approximation documentée du
// protocole Codex App Server — voir docs/CODEX_GATEWAY.md, "transport
// expérimental"). Le préfixe `turn/` suffit à router vers le gestionnaire de
// tour en cours ; ces constantes précisent les intitulés attendus.
const METHODE_MESSAGE_DELTA = /^turn\/agent[-_]?message[-_]?delta$/i;
const METHODE_TOUR_COMPLETE = /^turn\/completed$/i;
const METHODE_TOUR_ECHEC = /^turn\/(failed|error)$/i;

/** Pseudo-méthode émise localement (jamais reçue du serveur) quand la
 * connexion WebSocket tombe pendant qu'un tour est en attente. */
const MESSAGE_INTERNE_CONNEXION_FERMEE = '__connection_closed__';

export class CodexAppServerClient {
  private readonly url: string;
  private readonly token: string;
  private readonly creerWebSocket: CodexWebSocketFactory;
  private readonly delaiRequeteMs: number;
  private readonly delaiConnexionMs: number;
  private readonly delaiTourMs: number;

  private socket: CodexWebSocketLike | null = null;
  private prochainId = 1;
  private readonly requetesPendantes = new Map<number, RequetePendante>();
  private readonly ecouteurs = new Set<EcouteurNotification>();
  private connexionEnCours: Promise<void> | null = null;
  private initialise = false;

  constructor(options: CodexClientOptions) {
    verifierUrlSecurisee(options.url);
    this.url = options.url;
    this.token = options.token;
    this.creerWebSocket = options.webSocketFactory ?? ((u) => fabriqueWebSocketParDefaut(u));
    this.delaiRequeteMs = options.requestTimeoutMs ?? DELAI_REQUETE_DEFAUT_MS;
    this.delaiConnexionMs = options.connectTimeoutMs ?? DELAI_CONNEXION_DEFAUT_MS;
    this.delaiTourMs = options.turnTimeoutMs ?? DELAI_TOUR_DEFAUT_MS;
  }

  private masquer(texte: string): string {
    return masquerSecrets(texte, [this.token]);
  }

  get estConnecte(): boolean {
    return this.initialise && this.socket !== null && this.socket.readyState === 1;
  }

  /** Connecte si nécessaire et rejoue `initialize` → notification `initialized`.
   * Idempotent : un appel concurrent réutilise la même connexion en cours. */
  async ensureConnected(): Promise<void> {
    if (this.estConnecte) return;
    if (this.connexionEnCours) return this.connexionEnCours;
    this.connexionEnCours = this.connecter().finally(() => {
      this.connexionEnCours = null;
    });
    return this.connexionEnCours;
  }

  private async connecter(): Promise<void> {
    this.initialise = false;
    const socket = this.creerWebSocket(this.url, ['bearer']);
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ErreurCodexGateway('Connexion à ChatGPT/Codex impossible (délai dépassé).'));
      }, this.delaiConnexionMs);
      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(new ErreurCodexGateway('Connexion à ChatGPT/Codex impossible.'));
      };
    });

    socket.onmessage = (ev) => this.traiterMessage(ev.data);
    socket.onclose = () => this.gererFermeture();
    socket.onerror = () => {
      // Les erreurs post-connexion sont gérées via onclose (les
      // implémentations WebSocket ferment toujours après une erreur).
    };

    await this.requeteBrute('initialize', {
      clientInfo: { name: 'logiciel-rp-beta', version: '1' },
      // Déclaration explicite : ce client ne veut JAMAIS d'outils
      // agentiques côté Codex (pas de terminal/shell/fichiers/MCP/Skills).
      // Le moteur RP possède déjà ses propres mécanismes d'outils.
      capabilities: {
        tools: false,
        terminal: false,
        shell: false,
        fileEdits: false,
        mcp: false,
        skills: false,
      },
      auth: { token: this.token },
    });
    this.envoyerNotification('initialized', {});
    this.initialise = true;
  }

  private gererFermeture(): void {
    this.initialise = false;
    this.socket = null;
    const erreur = new ErreurCodexGateway('Connexion à ChatGPT/Codex interrompue.');
    for (const [, pendante] of this.requetesPendantes) {
      clearTimeout(pendante.timer);
      pendante.reject(erreur);
    }
    this.requetesPendantes.clear();
    // Signal interne (pas un vrai message JSON-RPC) : prévient tout
    // écouteur en cours — notamment turnStart — qu'il ne recevra plus rien
    // sur cette connexion, plutôt que d'attendre le délai d'inactivité.
    for (const ecouteur of this.ecouteurs) {
      try {
        ecouteur(MESSAGE_INTERNE_CONNEXION_FERMEE, {});
      } catch {
        // Un écouteur défaillant ne doit jamais casser le transport.
      }
    }
  }

  disconnect(): void {
    const socket = this.socket;
    this.socket = null;
    this.initialise = false;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        // Rien à faire : la connexion est déjà considérée terminée.
      }
    }
    const erreur = new ErreurCodexGateway('Connexion Codex fermée.');
    for (const [, pendante] of this.requetesPendantes) {
      clearTimeout(pendante.timer);
      pendante.reject(erreur);
    }
    this.requetesPendantes.clear();
  }

  /** Abonnement générique aux notifications JSON-RPC (login, streaming…). */
  onNotification(ecouteur: EcouteurNotification): () => void {
    this.ecouteurs.add(ecouteur);
    return () => this.ecouteurs.delete(ecouteur);
  }

  private traiterMessage(data: unknown): void {
    let message: any;
    try {
      message = JSON.parse(typeof data === 'string' ? data : String(data));
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') return;

    if (typeof message.id !== 'undefined' && (message.result !== undefined || message.error !== undefined)) {
      const pendante = this.requetesPendantes.get(message.id);
      if (!pendante) return;
      this.requetesPendantes.delete(message.id);
      clearTimeout(pendante.timer);
      if (message.error) {
        pendante.reject(
          new ErreurCodexGateway(this.masquer(message.error.message || 'Erreur Codex inconnue.'), message.error.code),
        );
      } else {
        pendante.resolve(message.result);
      }
      return;
    }

    if (typeof message.method === 'string') {
      if (MOTIF_NOTIFICATION_RAISONNEMENT.test(message.method)) return;
      for (const ecouteur of this.ecouteurs) {
        try {
          ecouteur(message.method, message.params);
        } catch {
          // Un écouteur défaillant ne doit jamais casser le transport.
        }
      }
    }
  }

  private envoyerNotification(methode: string, params: unknown): void {
    if (!this.socket) throw new ErreurCodexGateway('Connexion à ChatGPT/Codex impossible.');
    this.socket.send(JSON.stringify({ jsonrpc: '2.0', method: methode, params }));
  }

  /** Requête JSON-RPC brute, sans garantir la connexion au préalable —
   * réservée à la poignée de main `initialize`. */
  private requeteBrute(methode: string, params: unknown): Promise<any> {
    if (!this.socket) return Promise.reject(new ErreurCodexGateway('Connexion à ChatGPT/Codex impossible.'));
    const id = this.prochainId++;
    const socket = this.socket;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.requetesPendantes.delete(id);
        reject(new ErreurCodexGateway(`Délai dépassé pour « ${methode} ».`));
      }, this.delaiConnexionMs);
      this.requetesPendantes.set(id, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ jsonrpc: '2.0', id, method: methode, params }));
      } catch (e) {
        this.requetesPendantes.delete(id);
        clearTimeout(timer);
        reject(new ErreurCodexGateway(this.masquer(e instanceof Error ? e.message : String(e))));
      }
    });
  }

  /** Requête JSON-RPC standard : assure la connexion, applique le délai par défaut. */
  private async requete(methode: string, params: unknown, delaiMs = this.delaiRequeteMs): Promise<any> {
    await this.ensureConnected();
    if (!this.socket) throw new ErreurCodexGateway('Connexion à ChatGPT/Codex impossible.');
    const id = this.prochainId++;
    const socket = this.socket;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.requetesPendantes.delete(id);
        reject(new ErreurCodexGateway(`Délai dépassé pour « ${methode} ».`));
      }, delaiMs);
      this.requetesPendantes.set(id, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ jsonrpc: '2.0', id, method: methode, params }));
      } catch (e) {
        this.requetesPendantes.delete(id);
        clearTimeout(timer);
        reject(new ErreurCodexGateway(this.masquer(e instanceof Error ? e.message : String(e))));
      }
    });
  }

  // ---------------------------------------------------------------------
  // Compte ChatGPT
  // ---------------------------------------------------------------------

  /** Source de vérité de l'état de connexion — jamais un booléen persisté. */
  async accountRead(): Promise<CodexAccountInfo> {
    const resultat = await this.requete('account/read', {});
    const info: CodexAccountInfo = { connected: !!resultat?.connected };
    if (typeof resultat?.accountId === 'string') info.accountId = resultat.accountId;
    if (typeof resultat?.email === 'string') info.email = resultat.email;
    if (typeof resultat?.plan === 'string') info.plan = resultat.plan;
    return info;
  }

  async accountLoginStart(): Promise<CodexLoginStart> {
    const resultat = await this.requete('account/login/start', {});
    if (!resultat?.loginId || !resultat?.verificationUrl || !resultat?.userCode) {
      throw new ErreurCodexGateway('Réponse de connexion ChatGPT invalide.');
    }
    return { loginId: resultat.loginId, verificationUrl: resultat.verificationUrl, userCode: resultat.userCode };
  }

  async accountLoginCancel(loginId: string): Promise<void> {
    try {
      await this.requete('account/login/cancel', { loginId });
    } catch (e) {
      // Certains gateways n'exposent pas cette méthode : l'annulation reste
      // best-effort côté client (la modale se ferme quoi qu'il arrive).
      if (e instanceof ErreurCodexGateway && e.code === -32601) return;
      throw e;
    }
  }

  async accountLogout(): Promise<void> {
    await this.requete('account/logout', {});
  }

  /** Attend l'issue d'une connexion ChatGPT démarrée via accountLoginStart,
   * puis relit l'état réel du compte (jamais un simple booléen local). */
  waitForLoginOutcome(loginId: string, options?: { signal?: AbortSignal }): Promise<CodexAccountInfo> {
    return new Promise((resolve, reject) => {
      let terminee = false;
      const desabonner = this.onNotification((methode, params: any) => {
        if (terminee) return;
        if (methode === MESSAGE_INTERNE_CONNEXION_FERMEE) {
          finir(new ErreurCodexGateway('Connexion à ChatGPT/Codex interrompue.'));
          return;
        }
        if (!/^account\/login/i.test(methode)) return;
        if (params?.loginId && params.loginId !== loginId) return;
        const statut: CodexLoginOutcome | undefined = params?.status;
        if (!statut || statut === 'success') {
          if (methode.toLowerCase().includes('complete') || statut === 'success') {
            terminer();
          }
          return;
        }
        if (statut === 'error' || statut === 'expired' || statut === 'cancelled') {
          finir(new ErreurCodexGateway(
            statut === 'expired'
              ? 'Connexion ChatGPT expirée. Reconnecte ton compte.'
              : statut === 'cancelled'
                ? 'Connexion ChatGPT annulée.'
                : 'Échec de la connexion ChatGPT.',
          ));
        }
      });

      const onAbort = () => finir(new ErreurCodexGateway('Connexion ChatGPT annulée.'));
      options?.signal?.addEventListener('abort', onAbort, { once: true });

      function finir(erreur: Error) {
        if (terminee) return;
        terminee = true;
        desabonner();
        options?.signal?.removeEventListener('abort', onAbort);
        reject(erreur);
      }
      const terminer = () => {
        if (terminee) return;
        terminee = true;
        desabonner();
        options?.signal?.removeEventListener('abort', onAbort);
        this.accountRead().then(resolve, reject);
      };
    });
  }

  // ---------------------------------------------------------------------
  // Modèles
  // ---------------------------------------------------------------------

  async modelList(): Promise<CodexModelInfo[]> {
    const modeles: CodexModelInfo[] = [];
    let curseur: string | undefined;
    do {
      const resultat = await this.requete('model/list', curseur ? { cursor: curseur } : {});
      const page = Array.isArray(resultat?.models) ? resultat.models : Array.isArray(resultat) ? resultat : [];
      for (const m of page) {
        if (typeof m?.id !== 'string' || !m.id.trim()) continue;
        modeles.push({
          id: m.id,
          displayName: typeof m.displayName === 'string' ? m.displayName : undefined,
          supportedReasoningEfforts: Array.isArray(m.supportedReasoningEfforts) ? m.supportedReasoningEfforts : undefined,
        });
      }
      curseur = typeof resultat?.nextCursor === 'string' ? resultat.nextCursor : undefined;
    } while (curseur);
    return modeles;
  }

  // ---------------------------------------------------------------------
  // Thread + tour narratif
  // ---------------------------------------------------------------------

  /** Thread isolé et jetable pour UN appel RP — jamais réutilisé comme
   * mémoire canonique (voir en-tête de fichier). */
  async threadStart(instructions: string | undefined, model: string): Promise<CodexThreadHandle> {
    const resultat = await this.requete('thread/start', {
      model,
      instructions,
      // Aucun outil agentique : le moteur RP fournit déjà tout le contexte
      // nécessaire, Codex n'a rien à lire/exécuter de son côté.
      tools: [],
      sandboxPolicy: 'none',
      approvalPolicy: 'never',
    });
    if (!resultat?.threadId) throw new ErreurCodexGateway('Le gateway Codex n’a pas retourné de thread.');
    return { threadId: resultat.threadId };
  }

  /** Lance un tour narratif et résout avec le SEUL texte destiné au joueur
   * (jamais le raisonnement, jamais les événements internes Codex). */
  async turnStart(
    thread: CodexThreadHandle,
    input: string,
    options: { model: string; reasoningEffort?: string; signal?: AbortSignal },
  ): Promise<string> {
    const resultat = await this.requete('turn/start', {
      threadId: thread.threadId,
      model: options.model,
      reasoningEffort: options.reasoningEffort,
      input: [{ role: 'user', content: [{ type: 'input_text', text: input }] }],
    });
    const turnId: string | undefined = resultat?.turnId;

    let texte = '';
    let capteReponseSynchrone = typeof resultat?.text === 'string' && resultat.text.trim();
    if (capteReponseSynchrone) texte = resultat.text.trim();

    if (!turnId) {
      if (texte) return texte;
      throw new ErreurCodexGateway('Le gateway Codex n’a pas démarré de tour.');
    }

    return new Promise<string>((resolve, reject) => {
      let reglee = false;
      const timer = setTimeout(() => {
        regler(() => reject(new ErreurCodexGateway('Délai dépassé en attendant la réponse de Codex.')));
      }, this.delaiTourMs);

      const desabonner = this.onNotification((methode, params: any) => {
        if (reglee) return;
        if (methode === MESSAGE_INTERNE_CONNEXION_FERMEE) {
          regler(() => reject(new ErreurCodexGateway('Connexion à ChatGPT/Codex interrompue.')));
          return;
        }
        if (params?.turnId && params.turnId !== turnId) return;
        if (METHODE_MESSAGE_DELTA.test(methode)) {
          const morceau = typeof params?.delta === 'string' ? params.delta : typeof params?.text === 'string' ? params.text : '';
          texte += morceau;
          return;
        }
        if (METHODE_TOUR_COMPLETE.test(methode)) {
          const finalTexte = typeof params?.text === 'string' && params.text.trim() ? params.text.trim() : texte.trim();
          regler(() => resolve(finalTexte));
          return;
        }
        if (METHODE_TOUR_ECHEC.test(methode)) {
          regler(() => reject(new ErreurCodexGateway(this.masquer(params?.message || 'Le tour Codex a échoué.'))));
        }
      });

      const onAbort = () => {
        this.turnInterrupt(thread, turnId).catch(() => {});
        regler(() => reject(new ErreurCodexGateway('Génération Codex annulée.')));
      };
      options.signal?.addEventListener('abort', onAbort, { once: true });

      const regler = (action: () => void) => {
        if (reglee) return;
        reglee = true;
        clearTimeout(timer);
        desabonner();
        options.signal?.removeEventListener('abort', onAbort);
        action();
      };
    });
  }

  async turnInterrupt(thread: CodexThreadHandle, turnId: string): Promise<void> {
    try {
      await this.requete('turn/interrupt', { threadId: thread.threadId, turnId });
    } catch {
      // Best-effort : une interruption qui échoue ne doit pas remonter au
      // joueur, l'appel principal est déjà en train d'être abandonné.
    }
  }
}

// ---------------------------------------------------------------------
// Client partagé — une connexion WS par couple (gateway, token), réutilisée
// entre les tours narratifs successifs plutôt que rouverte à chaque appel.
// Seul le THREAD est jetable par appel RP (voir threadStart), pas la
// connexion elle-même.
// ---------------------------------------------------------------------

const clientsPartages = new Map<string, CodexAppServerClient>();

function obtenirClientPartage(
  gatewayUrl: string,
  gatewayToken: string,
  webSocketFactory?: CodexWebSocketFactory,
): CodexAppServerClient {
  const cle = `${gatewayUrl}::${gatewayToken}`;
  let client = clientsPartages.get(cle);
  if (!client) {
    client = new CodexAppServerClient({ url: gatewayUrl, token: gatewayToken, webSocketFactory });
    clientsPartages.set(cle, client);
  }
  return client;
}

/** Donne accès au client partagé pour l'écran de réglages (compte,
 * connexion, liste des modèles) sans dupliquer la logique de cache. */
export function obtenirClientCodex(
  gatewayUrl: string,
  gatewayToken: string,
  webSocketFactory?: CodexWebSocketFactory,
): CodexAppServerClient {
  return obtenirClientPartage(gatewayUrl, gatewayToken, webSocketFactory);
}

/** Ferme et oublie tous les clients Codex partagés — tests, déconnexion
 * explicite, ou changement de gateway. */
export function reinitialiserClientsCodex(): void {
  for (const client of clientsPartages.values()) client.disconnect();
  clientsPartages.clear();
}

export interface OptionsGenerationCodex {
  gatewayUrl: string;
  gatewayToken: string;
  model: string;
  reasoningEffort?: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  webSocketFactory?: CodexWebSocketFactory;
}

/**
 * Point d'entrée utilisé par le dispatcher de providers (openrouter.ts) —
 * crée un thread Codex isolé, envoie UNIQUEMENT le contexte construit par le
 * moteur RP (system prompt + historique déjà filtré par promptBuilder.ts) et
 * retourne le seul texte destiné au joueur. Ne réutilise jamais le thread
 * comme mémoire : chaque appel en crée un nouveau.
 */
export async function genererTexteCodex(options: OptionsGenerationCodex): Promise<string> {
  if (!options.gatewayUrl) {
    throw new ErreurCodexGateway('Aucun gateway Codex configuré. Connecte ChatGPT dans Réglages.');
  }
  if (!options.model) {
    throw new ErreurCodexGateway('Aucun modèle Codex sélectionné. Choisis-en un dans Réglages.');
  }
  const client = obtenirClientPartage(options.gatewayUrl, options.gatewayToken, options.webSocketFactory);
  const { instructions, input } = construireEntreeCodex(options.messages);
  if (!instructions && !input.trim()) {
    throw new ErreurCodexGateway('Aucun contenu à envoyer à Codex.');
  }
  const thread = await client.threadStart(instructions, options.model);
  const texte = await client.turnStart(thread, input || instructions || '', {
    model: options.model,
    reasoningEffort: options.reasoningEffort,
    signal: options.signal,
  });
  // Repli défensif : même si le transport a déjà ignoré tout événement de
  // raisonnement (voir MOTIF_NOTIFICATION_RAISONNEMENT), le texte final
  // repasse par le même filtrage que les autres fournisseurs au cas où le
  // modèle l'aurait injecté directement dans le contenu visible.
  const profil = resoudreProfilRaisonnement('codex', options.model);
  const nettoye = nettoyerRaisonnementInterne(texte, profil.balisesRaisonnement);
  if (!nettoye.trim()) throw new ErreurCodexGateway('Réponse vide reçue de Codex.');
  return nettoye.trim();
}

/** Adaptateur ChatMessage[] → entrée Codex (voir en-tête de fichier, section
 * 11 du chantier). Le prompt système construit par l'application reste
 * prioritaire : il devient les `instructions` du thread, jamais un simple
 * message parmi d'autres. Chaque appel RP crée un thread isolé (pas de
 * mémoire Codex entre les tours), donc l'historique récent est reconstitué
 * en texte dans l'entrée du tour plutôt que réparti sur plusieurs tours. */
export function construireEntreeCodex(messages: ChatMessage[]): { instructions?: string; input: string } {
  const systemes = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const reste = messages.filter((m) => m.role !== 'system');
  const transcript = reste
    .map((m) => `${m.role === 'assistant' ? 'Narrateur' : 'Joueur'} : ${m.content}`)
    .join('\n\n');
  return {
    instructions: systemes.join('\n\n') || undefined,
    input: transcript,
  };
}
