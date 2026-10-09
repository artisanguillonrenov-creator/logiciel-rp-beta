# ATELIER CONCEPTEUR — Audit & fondations V1

## État confirmé du dépôt (9 octobre 2026)
- Branche de production : \`claude/new-session-glwy6e\`.
- Réglages joueurs existants : \`settingsRepository.ts\` via AsyncStorage, avec gestion dédiée des secrets et verrou \`verrouillerSurElyndorCloud\`. Conserver ces mécanismes, ne pas exposer les clés dans l'atelier.
- Réactivité existante : \`automation/settingsStore.ts\`; ne pas supprimer.
- M01–M15 : \`narrativeBehaviorKernel.ts\` et traces dans \`generateTurn.ts\`. Il s'agit d'un contrat conditionnel et non de 15 modules indépendants.
- Recherche : \`passagesLore.ts\` (2500 caractères par défaut) et \`searchHistorique.ts\` (3 souvenirs par défaut).
- Stockage : SQLite des histoires, AsyncStorage, ObjectBox et fichiers d'images ; gestionnaire privé Android existant.
- Journalisation : diagnostics de tour persistés dans les messages / journaux JSONL.

## Fondations livrées par cette version
- Un nouveau dépôt **séparé** \`@elyndor/concepteur/configuration-v1\` : ne migre, n'altère ni ne réécrit la base des histoires ou les clés API.
- Profils Production / Test / Benchmark, indépendants, avec validation stricte des valeurs, historique borné à 20 révisions et restauration.
- Quatre valeurs réglables et **réellement lues au prochain tour** quand \`modeConcepteur === true\` :
  - \`budgetLorePassages\` (1000–5000 caractères), affecte la sélection des passages et le prompt ;
  - \`maxSouvenirs\` (1–8), affecte la sélection lexicale et vectorielle ;
  - \`temperatureDelta\` (-0,3 à +0,3), ajuste la température de génération dans [0, 2] ;
  - \`margeTokensEtat\` (250–1000), ajuste le plafond de sortie du narrateur.
- Une console organisée en 12 rubriques métier + accès aux profils et instantanés. Les rubriques non câblées sont explicites ; aucun faux bouton RunPod.
- Export JSON partageable via Android et import JSON du presse-papier, avec contrôle de schéma et confirmation. L'export **configuration** ne contient ni secrets, ni conversations. Ce n'est pas encore l'export d'audit complet des performances.
- Aucune commande RunPod, édition de lore ou changement de modèle distant arbitraire n'est ouverte. L'administrateur backend aura besoin d'une API authentifiée et d'autorisations serveur avant tout contrôle des pods.

## Précisions de sécurité / intégration
- L'APK conserve Elyndor Cloud en unique fournisseur joueur ; le moteur applique les profils seulement lorsque le mode concepteur est activé.
- Si la configuration n'est pas disponible au moment d'une narration, les réglages historiques demeurent le repli. Une erreur d'écriture n'est pas masquée dans l'interface.
- Le \`commitBundle\` de l'instantané provient de \`EXPO_PUBLIC_GIT_SHA\` lorsque le workflow le fournit. Il identifie le JS produit : une mise à jour OTA peut changer cet identifiant ; **ce n'est pas une preuve du commit natif exact de l'APK**.
- **Ne jamais confondre « capacité implémentée » avec « exécutée au dernier tour ».** La télémétrie par méta-moteur et les compteurs natifs devront être ajoutés lors des phases suivantes.
- Import : copier le JSON complet dans le presse-papier puis confirmer dans l'app. La navigation directe vers un fichier JSON externe reste à développer.
- Le mode concepteur existant reste accessible depuis les réglages : verrouillage d'administration renforcé requis avant ouverture à des utilisateurs publics.

## Restant à développer
- Administration sécurisée RunPod / modèle cloud / profil d'inférence côté serveur.
- Instrumentation individuelle M01–M15, benchmarks et contrôle de pipeline.
- Éditeur de lorebook, préréglages visuels, sauvegarde/restauration des bases.
- Export **audit complet** (avec redaction/consentement), comparaison d'instantanés et import depuis un fichier.
- Signature/information native exacte de l'APK, migrations de schéma ultérieures.
- Administration des abonnements après lancement commercial.

## Tests
\`npm test\`, \`npx tsc --noEmit\`, \`npx expo export -p web\` dans GitHub Actions, puis build Android depuis la branche de production.
