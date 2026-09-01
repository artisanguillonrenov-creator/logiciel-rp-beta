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
- un modèle (liste chargée depuis OpenRouter, ou identifiant saisi manuellement).

## Ce qui est implémenté (voir le brief, sections 1 et 5)

- **7 règles immuables** (`src/engine/rules.ts`) : injectées à chaque tour, priment sur tout le reste.
- **15 métamoteurs** (`src/data/metamoteurs.json`) : chargés puis **sélectionnés par pertinence de scène** à chaque tour (`src/engine/loreLoader.ts`) — un socle de 4 métamoteurs transverses (Production, Continuité, Agentivité, Registre) toujours actif, complété par les métamoteurs dont le vocabulaire correspond au message du joueur et au contexte récent (combat, négociation, scène intime, etc.). Jamais les 15 systématiquement.
- **Mémoire persistante simplifiée** (`src/engine/memory.ts`) : résumé glissant + liste de faits clés (personnages, lieux, promesses), régénérés ensemble tous les 8 messages via un appel modèle dédié, consultés à chaque tour.
- **Lore Elyndor** (`src/data/elyndorLore.json`) : 102 entrées (monde, royaumes, races, systèmes, PNJ récurrents...), structurées en `primary_keys` / `secondary_keys` / `negative_keys` / `category` / `priority` / `constant`. Sélection par mots-clés (`src/engine/loreLoader.ts` : `chargerLoreElyndor` / `selectionnerLoreElyndor`) — les entrées `constant: true` (règles fondatrices du monde) sont toujours actives, les autres sont sélectionnées par correspondance de mots-clés (primaire compte double), avec exclusion par mot-clé négatif et priorité comme critère de départage.
- **Validation de sortie minimale** (`src/engine/validator.ts`) : un contrôle heuristique local (tournures qui décident à la place du joueur) + un contrôle par le modèle (continuité, canon, contradiction) sur chaque réponse. En cas de violation, une seule nouvelle tentative est effectuée (pas de réparation sophistiquée, conforme au brief section 5).

## Structure

```
src/
  data/            metamoteurs.json (15 métamoteurs), elyndorLore.json (lore Elyndor, 102 entrées)
  engine/          rules, sélection de lore, mémoire, prompt, appel OpenRouter, validation, orchestration
  screens/         Démarrage, Création rapide, Conversation, Réglages
  navigation/      pile de navigation (4 écrans du brief)
  storage/         persistance locale (AsyncStorage) des histoires et réglages
  theme/           styles fonctionnels minimaux (pas d'identité visuelle travaillée pour cette bêta)
```

## Ce qui est volontairement absent (brief section 2)

Détection matérielle, contrôle d'âge, licence, mises à jour/plugins, identité visuelle travaillée, portraits/musique/voix/images, bibliothèque de personas, branches multiples, traduction, parcours de création en 5 étapes.
