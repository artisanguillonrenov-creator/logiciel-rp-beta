# Contribuer

Merci de l'intérêt porté à ce projet. Ce dépôt est une bêta active — voir [`Brief_Beta_Application_ClaudeCode.md`](Brief_Beta_Application_ClaudeCode.md) pour le cadrage produit avant toute contribution structurante.

## Avant de commencer

- Lisez [`AGENTS.md`](AGENTS.md) : ce dépôt cible **Expo SDK 57**, dont l'API a changé par rapport aux versions précédentes. Vérifiez toujours la documentation versionnée [docs.expo.dev/versions/v57.0.0](https://docs.expo.dev/versions/v57.0.0/) avant d'utiliser une API Expo.
- Le principe non négociable du projet : **le logiciel porte l'autorité (règles, mémoire, monde), le modèle ne fournit que le langage.** Toute contribution au moteur (`src/engine/`) doit préserver ce principe — voir les 7 règles immuables dans [`src/engine/rules.ts`](src/engine/rules.ts).

## Mise en place

```bash
npm install
npm start
```

Scanner le QR code avec **Expo Go**. Aucune clé API n'est nécessaire pour lancer l'app — elle se configure dans l'écran **Réglages** au premier lancement.

## Tests et vérifications locales

Avant toute pull request, exécutez localement ce que la CI vérifie (`.github/workflows/pr-validation.yml`) :

```bash
npm test              # tests unitaires (tests/)
npx tsc --noEmit       # vérification de types
npx expo export -p web # build web (détecte les erreurs de bundling)
```

## Conventions

- **Commits** : messages courts et descriptifs en français, à l'impératif présent (« Ajoute… », « Corrige… »), cohérents avec `git log`.
- **TypeScript strict** : pas de `any` non justifié ; les types partagés vivent dans `src/types/`.
- **Pas d'abstraction prématurée** : le moteur privilégie des modules explicites (`src/engine/*.ts`) plutôt que des couches génériques. Une modification ciblée est préférable à un refactor large non demandé.
- **Secrets** : aucune clé API ne doit jamais être codée en dur ou committée. Les clés utilisateur restent locales à l'appareil (AsyncStorage).
- **Contenu narratif** (`src/data/metamoteurs.json`, `src/data/elyndorLore.json`) : toute modification de fond doit rester cohérente avec le lore existant et ne pas introduire de contradiction avec les entrées `constant: true`.

## Pull requests

1. Créez une branche depuis `main` avec un nom descriptif.
2. Gardez la PR focalisée sur un seul sujet.
3. Décrivez le changement et, si pertinent, comment il a été testé (capture d'écran pour tout changement d'interface).
4. Assurez-vous que la CI (`pr-validation.yml`) passe avant de demander une revue.

## Identité visuelle

Les changements touchant `README.md`, `/docs` ou `/assets/brand` doivent respecter la charte définie dans [`docs/elyndor-visual-identity.md`](docs/elyndor-visual-identity.md). Cette charte ne s'applique pas à l'UI in-app, dont les tokens vivent dans `src/theme/theme.ts`.
