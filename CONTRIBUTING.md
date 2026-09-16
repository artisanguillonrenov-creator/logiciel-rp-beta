# Contribuer

Merci de l'intérêt porté à ce projet. Ce dépôt implémente une bêta
testable de l'application de jeu de rôle décrite dans
`Brief_Beta_Application_ClaudeCode.md` — voir le [README](README.md) pour
l'état actuel réel des fonctionnalités, qui a largement dépassé ce brief
d'origine.

## Avant de commencer

- Le code, les commentaires et les messages de commit de ce dépôt sont en
  **français**, comme le reste du projet.
- Lis `AGENTS.md` : Expo a changé de version depuis les connaissances de
  base des modèles — se référer à la documentation versionnée
  [Expo v57](https://docs.expo.dev/versions/v57.0.0/) avant d'écrire du
  code touchant à Expo.
- Le **principe fondateur** du projet est non négociable dans toute
  contribution touchant au moteur narratif : *le logiciel porte
  l'autorité (règles, mémoire, monde), le modèle ne fournit que le
  langage.* Une contribution qui laisserait le modèle décider du canon,
  de l'état du monde ou des actions du joueur à sa place va à l'encontre
  de ce principe.

## Mettre en place l'environnement

```bash
npm install
npm start
```

Scanner le QR code avec **Expo Go** (Android) pour tester en direct, sans
build ni compte développeur.

## Avant d'ouvrir une pull request

La CI (`.github/workflows/pr-validation.yml`) exécute automatiquement, sur
chaque pull request :

```bash
npm test              # tests (tests/)
npx tsc --noEmit       # vérification des types
npx expo export -p web # build web (détecte les erreurs de compilation)
```

Lance ces trois commandes en local avant de proposer une pull request —
c'est plus rapide que d'attendre le retour de la CI.

## Style de contribution

- Préfère des changements ciblés à des refontes larges non demandées.
- N'ajoute pas de gestion d'erreurs, de repli ou de validation pour des cas
  qui ne peuvent pas se produire.
- Les commentaires expliquent le *pourquoi* (une contrainte non évidente,
  un correctif à un cas précis), jamais le *quoi* — le code déjà présent
  dans ce dépôt suit cette convention, garde-la.
- Si ta contribution touche `src/data/elyndorLore.json` ou
  `src/data/metamoteurs.json`, vérifie que le format (entrées Elyndor ou
  format RISU, voir `src/engine/loreLoader.ts`) reste valide.

## Domaines où une contribution est particulièrement utile

- **Captures d'écran réelles** pour remplacer les reconstitutions
  schématiques de la section « Exemples » du README
  (`assets/branding/exemple-conversation.svg`) — voir la roadmap du
  README.
- **Tests** : la couverture actuelle (`tests/llmProvider.test.ts`) est
  volontairement minimale pour une bêta ; étendre la couverture au
  pipeline de mémoire (`src/engine/memory.ts`) ou à la sélection sémantique
  (`src/engine/loreLoader.ts`) est bienvenu.
- **Documentation** : `docs/` ne contient pour l'instant que la charte
  graphique du dépôt ; un guide d'architecture par module de
  `src/engine/` serait utile aux nouveaux contributeurs.

## Signaler un problème

Ouvre une issue en décrivant : ce qui était attendu, ce qui s'est produit,
et si possible les étapes pour reproduire (y compris le fournisseur LLM et
le modèle utilisés, puisque le comportement peut varier selon le modèle).
