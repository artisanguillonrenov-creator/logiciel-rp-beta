# Elyndor — Fournisseur ChatGPT / Codex (Codex App Server)

## Statut

**Expérimental.** Le transport WebSocket JSON-RPC de Codex App Server n'est
pas (encore) une interface stable ni documentée publiquement comme
définitive par OpenAI/Codex. Les noms de méthodes utilisés ci-dessous
(`account/read`, `model/list`, `thread/start`, `turn/start`, …) sont ceux
attendus par `src/engine/codexAppServerClient.ts` : si une version future de
`codex app-server` change son protocole, seul ce fichier doit être ajusté —
le reste du moteur RP n'en dépend jamais directement (voir Architecture).
Ne pas considérer cette intégration comme une base de production figée.

## Objectif

Utiliser le compte ChatGPT/Codex de l'utilisateur comme narrateur RP,
**sans** API OpenAI classique et **sans** demander de clé API OpenAI.
L'authentification se fait par le flux de connexion par code d'appareil
(« device code ») de ChatGPT, géré entièrement par Codex App Server.

## Architecture

```
Application RP mobile
        │
        │ WSS / JSON-RPC
        ▼
Codex App Server / Gateway   (service séparé, jamais exécuté par le JS de l'app)
        │
        ▼
Compte ChatGPT/Codex
```

- L'application Expo/React Native ne lance **jamais** `codex app-server`
  elle-même : elle se connecte à un gateway distant (ou local, mais en tant
  que *service séparé* — voir « Bêta personnelle » ci-dessous).
- `src/engine/codexAppServerClient.ts` est le seul module qui parle
  directement ce protocole. Il expose un point d'entrée unique,
  `genererTexteCodex()`, branché dans le dispatcher de providers de
  `src/engine/openrouter.ts` (fonction `appellerModele`) — le reste du
  moteur RP (mémoire, lorebook, Story Director, World Simulation,
  validateur…) continue d'appeler cette même fonction commune, sans jamais
  savoir qu'il parle à Codex plutôt qu'à OpenRouter/Infermatic.
- **Codex ne remplace que le backend de génération de texte.** Toute la
  mémoire narrative (L0-L5, lorebook, lore émergent, Story Director, World
  Simulation, relations/réputation, engagements) reste gérée par
  l'application. Chaque appel RP crée un **thread Codex isolé et jetable** :
  le contexte envoyé est uniquement celui construit par
  `promptBuilder.ts`/`generateTurn.ts`, et ce thread n'est jamais relu comme
  mémoire — sinon on obtiendrait deux mémoires narratives en parallèle,
  source de doublons et d'incohérences.
- Aucun outil de développement Codex n'est activé : pas de terminal, pas de
  shell, pas de modification de fichiers, pas de Skills/MCP. Le moteur RP
  possède déjà ses propres mécanismes d'outils (`tools.ts`,
  `toolCallingJson.ts`) ; Codex n'a rien à lire ou exécuter côté serveur.

## Installer Codex CLI / App Server

1. Installer le CLI Codex sur la machine qui hébergera le gateway (suivre la
   documentation officielle OpenAI Codex — hors périmètre de ce document,
   susceptible de changer).
2. Vérifier que la sous-commande `app-server` est disponible (JSON-RPC via
   stdio ou WebSocket selon la version installée).
3. Le CLI gère l'authentification ChatGPT lui-même (device code flow) via
   les méthodes `account/*` exposées en JSON-RPC — l'application RP ne fait
   que relayer ce flux, elle ne stocke jamais les tokens OAuth ChatGPT.

## Le gateway

`codex app-server` communique nativement en JSON-RPC (typiquement sur
stdio). L'application RP mobile ne peut pas ouvrir de connexion stdio : il
faut donc un petit **gateway WebSocket** intermédiaire qui :

- relaie les messages JSON-RPC entre une connexion WebSocket et le
  processus `codex app-server` (ou plusieurs, un par session) ;
- exige un token bearer à la connexion (voir « Sécurité ») ;
- termine le TLS (WSS) — directement, ou derrière un reverse proxy
  (nginx/Caddy) qui fait le TLS et relaie en clair vers le processus local.

Ce gateway est un **service séparé** du reste de l'application. Il n'est pas
fourni par ce dépôt : c'est une pièce d'infrastructure à écrire ou à
réutiliser séparément, propre à l'environnement de déploiement de
l'utilisateur.

### Bêta personnelle

Pour un usage personnel, le gateway peut tourner sur la même machine que
tout autre service déjà utilisé (ex. Hermes) — mais il doit rester un
**processus séparé**, avec son propre port et son propre token. Ne jamais
faire dépendre le moteur RP du fonctionnement d'un autre service : si le
gateway Codex est arrêté, seul le fournisseur Codex doit être affecté (voir
« Comportement en cas de panne »), pas le reste de l'application.

## Authentification ChatGPT

1. Dans l'application, Réglages → IA & connexion → ChatGPT / Codex → *Se
   connecter avec ChatGPT*.
2. L'application appelle `account/login/start` sur le gateway, qui renvoie
   `loginId`, `verificationUrl` et `userCode`.
3. Une modale affiche le code, avec *Copier le code* et *Ouvrir la page de
   connexion* (ouvre `verificationUrl` dans le navigateur).
4. L'utilisateur valide sur la page ChatGPT ouverte dans le navigateur.
5. Le gateway notifie la fin du flux ; l'application relit alors
   systématiquement l'état réel via `account/read` — **jamais** un simple
   booléen local sauvegardé. À chaque reconnexion au gateway, le même
   `account/read` fait autorité.
6. *Se déconnecter* appelle `account/logout`.

## Sécurisation WSS

- **WSS obligatoire** pour toute connexion qui sort de la machine locale.
  `ws://` non chiffré n'est toléré que pour un gateway `localhost`/
  `127.0.0.1` (bêta personnelle sur la même machine que l'appareil de
  développement/l'émulateur) — voir `codexAppServerClient.ts`, qui refuse
  explicitement tout `ws://` vers un hôte distant.
- Le gateway doit exiger un **token bearer/capability token** à la
  connexion WebSocket (envoyé par le client dans les paramètres de
  `initialize`, jamais en clair dans l'URL ni loggé).
- Ce token protège l'accès au **gateway**, pas directement au compte
  ChatGPT (qui reste géré par les tokens OAuth internes de Codex App
  Server, jamais transmis à l'application RP).

## Token de connexion (côté application)

- `codexGatewayUrl` : URL du gateway (`wss://…`), réglage non sensible.
- `codexGatewayToken` : traité exactement comme une clé API — stocké dans
  Expo SecureStore sur Android/iOS (jamais en `AsyncStorage`), voir
  `src/storage/apiKeysStore.ts` et `src/storage/settingsRepository.ts`.
- `codexModel` : uniquement un ID renvoyé par `model/list` pour le compte
  connecté — jamais une valeur codée en dur dans l'application.
- `codexReasoningEffort` : optionnel, dérivé de
  `supportedReasoningEfforts` renvoyé par `model/list` pour le modèle
  choisi.

Ces réglages avancés (URL + token du gateway) vivent dans *Paramètres
avancés*, pas dans l'écran normal de Réglages.

## Connexion de l'application

Réglages → IA & connexion → *ChatGPT / Codex* → configurer l'URL/le token du
gateway dans *Paramètres avancés* → *Se connecter avec ChatGPT* → choisir un
modèle dans la liste chargée dynamiquement (*Parcourir les modèles*) →
*Enregistrer*. Le modèle choisi devient alors le narrateur RP pour les
histoires qui n'ont pas d'override de modèle propre.

## Dépannage

| Symptôme | Cause probable | Comportement de l'application |
| --- | --- | --- |
| « Connexion à ChatGPT/Codex impossible. » | Gateway injoignable (arrêté, mauvaise URL, réseau) | Réglages et conversation en cours conservés tels quels ; aucune suppression. |
| « Connexion ChatGPT expirée. Reconnecte ton compte. » | Session ChatGPT expirée côté Codex App Server | Relance le flux de connexion depuis Réglages. |
| « Le modèle précédemment sélectionné n'est plus disponible. » | Le modèle a disparu du catalogue du compte | Le modèle sauvegardé est conservé tel quel jusqu'à nouvelle sélection explicite ; pas de plantage. |
| `model/list` échoue | Panne temporaire du gateway ou du compte | Le modèle déjà sauvegardé est conservé ; l'erreur est seulement affichée. |
| Aucun texte de raisonnement ne doit jamais apparaître | — | Garanti à deux niveaux : le transport ignore toute notification dont la méthode évoque `reasoning`/`analysis`/`thinking`, et le texte final repasse par le même filtrage que les autres fournisseurs (`reasoningPolicy.ts`). |

## Limites connues (V1)

- Aucun outil agentique Codex (terminal, shell, fichiers, MCP, Skills) —
  volontairement désactivé, voir Architecture.
- Pas de function calling natif Codex pour les méta-moteurs internes
  (Story Director, World Simulation…) : repli JSON-en-prose, comme pour le
  moteur local.
- Les noms exacts des méthodes JSON-RPC (`turn/agentMessageDelta`,
  `turn/completed`, …) sont une approximation documentée du protocole
  Codex App Server et peuvent nécessiter un ajustement selon la version du
  gateway utilisée — voir le statut expérimental en tête de document.
