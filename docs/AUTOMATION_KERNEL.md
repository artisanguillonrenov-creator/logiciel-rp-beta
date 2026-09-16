# Elyndor — Automation Kernel V1

## Objectif

Le noyau d’automatismes relie les réglages persistés, les capacités réellement disponibles et les routines asynchrones de l’application sans déplacer l’autorité du moteur narratif.

## Chaîne de réglages

`SettingsScreen / LangueProvider / autres écrans` → `saveSettings()` → `settingsRepository` → `settingsStore` → `Capability Resolver` → composants abonnés.

Le stockage durable reste la source de persistance. Le `settingsStore` est uniquement la source de vérité réactive en mémoire : une sauvegarde réussie y est publiée immédiatement, ce qui évite les copies obsolètes conservées par certains providers.

## Capacités centralisées

Le résolveur calcule les capacités effectives suivantes :

- narration ;
- embeddings ;
- images et portraits ;
- traduction ;
- inférence locale ;
- profil adulte ;
- mode concepteur.

Une capacité est dérivée des réglages ET des prérequis réels. Exemple : `genererImagesActive=true` ne suffit pas ; la génération d’images actuelle exige aussi une clé OpenRouter.

## File persistante

Les jobs sont conservés sous `@rp_beta/automation_jobs/v1` avec les états :

- `pending` ;
- `running` ;
- `completed` ;
- `failed`.

Un job peut avoir une `dedupeKey`. Tant qu’un job portant cette clé est en attente ou en cours, un second enqueue renvoie le job existant au lieu d’en créer un doublon.

Au démarrage, tout job resté `running` est remis en `pending`. Une fermeture ou un crash n’abandonne donc plus silencieusement une routine.

## Routines V1

### `updates.check`

Déclencheurs :

- démarrage de l’application ;
- retour au premier plan.

Cadence : maximum une vérification toutes les 6 heures grâce à un TTL persistant.

Cette routine réutilise `verifierMiseAJour()` ; elle ne télécharge ni n’installe automatiquement une version.

## Routines narratives existantes

Mémoire, directeur narratif, monde, social et lore émergent restent actuellement orchestrés dans `generateTurn.ts`. Ils sont déjà fonctionnels et cohérents entre eux ; V1 ne les déplace pas dans la file afin d’éviter une régression de concurrence entre deux tours.

La prochaine migration doit respecter l’ordre suivant :

1. réponse validée ;
2. sauvegarde durable du tour ;
3. post-traitements sérialisés par histoire ;
4. fusion de l’état dérivé seulement si la révision de l’histoire est toujours courante.

Aucune routine narrative ne doit être rendue véritablement asynchrone avant l’ajout de cette protection de révision.

## Diagnostic

L’écran concepteur expose :

- nombre de jobs en attente / en cours / en erreur / terminés ;
- nombre de jobs restaurés après interruption ;
- dernière erreur du noyau ;
- capacités effectives du narrateur, des embeddings, des images, de la traduction et du modèle local.

Les jobs en erreur peuvent être remis en attente depuis cet écran.

## Invariants

- une erreur d’automatisme ne doit jamais empêcher l’application de démarrer ;
- aucune clé API n’est copiée dans la file de jobs ;
- les handlers s’exécutent en série dans le processus courant ;
- le stockage sécurisé existant des clés reste inchangé ;
- aucune fusion GitHub n’est automatique ;
- le noyau ne modifie pas les règles, le lore ou les métamoteurs de lui-même.
