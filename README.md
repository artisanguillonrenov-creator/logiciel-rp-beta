# Logiciel RP — Bêta

Bêta testable de l'application de jeu de rôle : le logiciel porte l'autorité (règles, mémoire, monde), le modèle ne fournit que le langage. Voir `Brief_Beta_Application_ClaudeCode.md` (fourni séparément) pour le cadrage complet ; ce dépôt implémente la version réduite décrite dans ce brief.

## Lancer la bêta

```bash
npm install
npm start
```

Puis scanner le QR code avec l'app **Expo Go** (Android) — aucun build, aucun compte développeur nécessaire.

## Configuration

Au premier lancement, aller dans **Réglages** et renseigner :
- une clé API [OpenRouter](https://openrouter.ai/) (jamais codée en dur, stockée uniquement en local sur l'appareil),
- un modèle (liste chargée depuis OpenRouter, ou identifiant saisi manuellement),
- optionnellement, une **clé API embeddings de secours** (voir section suivante) si OpenRouter n'en sert pas pour ton compte.

## Ce qui est implémenté (voir le brief bêta sections 1 et 5, et le brief Phase 2)

- **7 règles immuables** (`src/engine/rules.ts`) : injectées à chaque tour, priment sur tout le reste.
- **15 métamoteurs** (`src/data/metamoteurs.json`) et **lore Elyndor** (`src/data/elyndorLore.json`, 102 entrées) : chargés puis **sélectionnés par similarité sémantique (embeddings)** à chaque tour, pas par correspondance de mots-clés (brief Phase 2 — correctif direct à un cas observé où un PNJ mentionné avec un vocabulaire différent du lorebook ne déclenchait plus les bonnes fiches). Voir `src/engine/embeddings.ts` (calcul + cosinus), `src/storage/embeddingsStore.ts` (cache local, un embedding n'est recalculé que si le contenu de l'entrée a changé) et `src/engine/loreLoader.ts` (classement). Un socle de métamoteurs transverses et les entrées `constant: true` / la table Géographie et Races restent toujours actifs, comme avant ; l'exclusion par `negative_keys` reste une règle déterministe indépendante du score.
- **Embeddings** : essaie d'abord OpenRouter avec la clé déjà configurée ; si ce compte n'y a pas accès, bascule automatiquement sur une clé de secours (OpenAI `text-embedding-3-small`) si elle est renseignée dans Réglages.
- **Mémoire persistante simplifiée** (`src/engine/memory.ts`) : résumé glissant + liste de faits clés (personnages, lieux, promesses), régénérés ensemble tous les 8 messages via un appel modèle dédié, consultés à chaque tour.
- **Validation de sortie minimale** (`src/engine/validator.ts`) : un contrôle heuristique local (tournures qui décident à la place du joueur) + un contrôle par le modèle (continuité, canon, contradiction) sur chaque réponse. En cas de violation, une seule nouvelle tentative est effectuée (pas de réparation sophistiquée, conforme au brief section 5).

## Structure

```
src/
  data/            metamoteurs.json (15 métamoteurs), elyndorLore.json (lore Elyndor, 102 entrées)
  engine/          rules, embeddings, sélection de lore, mémoire, prompt, appel OpenRouter, validation, orchestration
  screens/         Démarrage, Création rapide, Conversation, Réglages
  navigation/      pile de navigation (4 écrans du brief)
  storage/         persistance locale (AsyncStorage) des histoires, réglages et cache d'embeddings
  theme/           styles fonctionnels minimaux (pas d'identité visuelle travaillée pour cette bêta)
```

## Ce qui est volontairement absent (brief section 2)

Détection matérielle, contrôle d'âge, licence, mises à jour/plugins, identité visuelle travaillée, portraits/musique/voix/images, bibliothèque de personas, branches multiples, traduction, parcours de création en 5 étapes.
