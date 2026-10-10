# MISSION UNIQUE CODEX — ELYNDOR LAB V1.1
Date : 10 octobre 2026
Projet : artisanguillonrenov-creator/logiciel-rp-beta
Branche initiale de référence : claude/new-session-glwy6e
Statut : directive de réalisation, non preuve de faisabilité ni code déjà réalisé.

## 0. Instruction impérative pour l'agent

Réalise ce chantier aussi complètement que le permet une seule tâche de développement, sur UNE BRANCHE DE TRAVAIL ISOLÉE, sans fusionner dans la branche principale, sans déployer automatiquement la version expérimentale et sans toucher aux données des utilisateurs.

Lis le dépôt réel et AGENTS.md avant de coder. Suis les instructions spécifiques à Expo SDK 57 (https://docs.expo.dev/versions/v57.0.0/). Inspecte les interfaces, les dépendances, les workflows et les stockages actuels : ne remplace pas arbitrairement les composants existants et ne te fonde pas sur le README sans vérification car certains passages peuvent être anciens.

L'utilisateur travaille exclusivement depuis une tablette Android Galaxy Tab A11. Il n'a pas de PC pour ce chantier, aucun pod RunPod et ne souhaite AUCUN service de développement à distance dans le fonctionnement futur du laboratoire. Il peut cependant confier la construction initiale à Codex Cloud. Évite de lui demander des commandes de terminal, de très longs copier-coller ou des validations intermédiaires inutiles. Livrer une PR avec résultats et limitations vérifiés.

PRIORITÉ ABSOLUE : NE PAS FAIRE SEMBLANT QUE DU CODE TSX EST EXÉCUTABLE À CHAUD. Une copie de fichiers éditable n'est pas un bundle React Native exécutable. Aucun message « mise à jour réussie », aucun test « vert » fictif et aucun bouton qui simule une compilation.

## 1. Produit souhaité

Elyndor Lab sera une rubrique du Module Concepteur existant, inspirée de l'explorateur de fichiers de GitHub, adaptée au tactile, thème bleu nuit/or du projet. L'utilisateur navigue dans la copie locale du code source, choisit un fichier, voit son contenu, peut modifier, créer, renommer, déplacer ou supprimer dans un espace de travail protégé, coller un correctif préparé par ChatGPT/Claude Code, enregistrer son brouillon, comparer avant/après et exécuter les tests disponibles. Les essais restent indépendants du dépôt GitHub tant qu'il ne décide pas d'en exporter les résultats pour audit et intégration finale.

Prévoir sept espaces (onglets ou écrans fluides, sans doublonner les réglages actuels) :
1. Explorateur : dossiers, fichiers, recherche, fil d'Ariane, actions contextuelles, création dans le dossier choisi.
2. Éditeur/Terminal : lecture/édition du vrai contenu texte, copier/coller tactile, édition plein écran, recherche, lignes si possible, zone de journal technique pour les commandes réellement prises en charge, comparaison diff.
3. Tests : vérification de la syntaxe et de ce qui peut vraiment être testé localement ; statuts distincts PAS TESTÉ / VALIDE / ÉCHEC / NON PRIS EN CHARGE.
4. Mise à jour : préflight, sauvegarde, progression réelle et activation uniquement si un mécanisme d'exécution compatible existe et a été démontré ; sinon explication explicite et option d'export.
5. Versions : instantanés, versions brouillon / expérimentale / stable, sélection, comparaison et restauration de l'espace de travail.
6. Récupération : écran de secours indépendant des plugins expérimentaux ; rollback réel du contenu du laboratoire et, seulement si techniquement possible, du runtime activé.
7. Import/Export : ZIP complet du projet local, changements en cours, journal, diffs, tests et métadonnées, dans la limite des sources effectivement disponibles. Import de correctifs ou ZIP avec prévisualisation des différences.

## 2. Portée réaliste et catégorisation

La majorité des opérations locales est indépendante de la compilation : afficher, modifier, sauvegarder, comparer, versionner, restaurer, importer et exporter le code source. Cette partie DOIT fonctionner réellement sur Android.

Ne pas affirmer que la compilation arbitraire d'un projet Expo/React Native ou le remplacement de modules TSX depuis une app Expo installée est réalisable en pur JS. Auditer les mécanismes réellement disponibles dans ce dépôt et Expo SDK 57, identifier les limites du runtimeFingerprint, de Metro, de Hermes, des modules natifs, de expo-updates, des signatures et des contraintes Android.

Classer chaque tentative d'application :
- LOCAL_EDITABLE : fichier consultable/éditable/archivable ; pas nécessairement exécutable.
- LOCAL_TESTABLE : contrôles authentiquement disponibles côté appareil.
- LOCAL_APPLICABLE : exécution/activation démontrée sans tromperie pour une catégorie précise de correctifs sûrs et un runtime compatible.
- GPT_CLAUDE_REQUIRED : opération au-delà des outils locaux ; indiquer « Nécessite GPT ou Claude pour cette opération », avec bouton « Exporter le code source complet ».
- NATIVE_REBUILD_REQUIRED : changement Java/Kotlin, configuration native, permissions, plugins/modules natifs ; exiger nouveau build APK, ne jamais annoncer un hot reload.

Si aucun mécanisme fiable de chargement arbitraire des TS/TSX n'est possible, NE PAS improviser eval, injection arbitraire, remote code loading ou faux bouton de mise à jour. Fournir une interface explicite « modification enregistrée, activation indisponible sur cet appareil » avec export complet pour la reprise par GPT/Claude. Si un sous-système peut réellement être modifié à chaud via hooks déclaratifs/sandboxés prévus et testables, l'implémenter seulement après preuve de sécurité et détailler la portée exacte.

## 3. Réalité du dépôt à inspecter

Au 10/10/2026, le repo public contient Expo 57, React Native 0.86.3, React 19.2.3, TypeScript 6, expo-file-system, expo-sharing, expo-updates, expo-sqlite, AsyncStorage, SecureStore, JSZip ; leur version doit être vérifiée dans package.json. Les paramètres et les clés sont répartis entre AsyncStorage et SecureStore ; la base des histoires est SQLite, avec d'autres stockages de cache et module ObjectBox natif.

Intégration de préférence dans src/screens/DesignerSettingsScreen.tsx et src/navigation/types.ts, sans exposer le Lab dans le parcours joueur ordinaire. Réutiliser les composants et tokens de src/theme/theme.ts. Le module AtelierConfigurationPanel et depotConfiguration montrent une approche existante d'historique ; ne pas mélanger son historique de réglages avec les instantanés du code source. Ne pas modifier le noyau narratif ou les fournisseurs d'images en dehors des adaptations nécessaires au Lab.

L'explorateur existant src/components/StorageExplorer.tsx affiche des fichiers de stockage privé, et non le projet source ; ne PAS le transformer sans préserver ses fonctions. La maintenance actuelle ne télécharge pas de mise à jour binaire. Le workflow GitHub .github/workflows/eas-update.yml publie des OTA depuis la branche principale : une branche isolée évite une publication accidentelle.

## 4. Copie locale, import initial, synchronisation et exhaustivité

L'APK ne contient normalement pas les fichiers TypeScript sources sous forme directement éditable. Mettre en place une vraie initialisation de la copie locale depuis un paquet de sources versionné embarqué si les limites de poids et de distribution le permettent, OU par import initial d'un ZIP de sources sur la tablette. Le choix doit être fondé sur un audit chiffré du nombre/poids des fichiers, sur des limites mémoire et sur le fonctionnement hors ligne.

Ne jamais afficher « projet complet » si des fichiers manquent. Inclure un manifeste avec commit de référence, date, couverture des sources, inventaire, tailles, hash, chemins normalisés et compatibilité du runtime. Différencier fichiers texte et binaires, et ne pas forcer de chargement intégral d'images en RAM. Le projet doit rester accessible hors ligne une fois initialisé.

Créer un espace de travail du laboratoire distinct du répertoire des histoires, des médias, des caches des moteurs et des secrets. Ne jamais écrire dans les chemins de production du moteur narratif. Empêcher les chemins relatifs ../, chemins absolus, liens suspects, Zip Slip et toute sortie hors racine. Refuser ZIP bomb, duplications ambiguës, archives trop grandes pour les ressources mesurées et entrées malformées. Prévoir des limites de sécurité explicites, sans réintroduire les faux blocages de stockage d'images de l'application.

Les opérations de création/suppression/renommage/move doivent être traçables, réversibles et sérialisées ou transactionnelles ; pas de corruption si fermeture au milieu de l'opération. Conserver les modifications non sauvegardées en brouillon.

## 5. Gestion des versions, rollback et protection des données

Utiliser une structure légère : instantanés cohérents + différences ou blobs dédupliqués si nécessaire, avec identifiants et métadonnées. Un instantané global couvre TOUS les fichiers d'une expérience, y compris ajouts/suppressions/déplacements, pas uniquement le fichier courant. Identifier le commit initial et les empreintes ; détecter les divergences lors d'import ou synchronisation ultérieure.

États : brouillon, expérimentale, stable. L'utilisateur confirme explicitement « Déclarer cette version stable ». Une version connue comme saine reste verrouillée contre les suppressions accidentelles. Proposer restaurer une version sélectionnée ; préserver le travail actuel via snapshot préalable. Versions parallèles/branches locales pour travailler séparément sur images, mémoire, narration, UI.

Les histoires, personnages, paramètres et API keys ne doivent pas être modifiés par les restaurations de code. Les migrations SQLite ou ObjectBox exigeraient sauvegarde/restauration distincte ; ne pas les prétendre réversibles gratuitement.

Le vrai écran de secours doit rester hors du code éditable/chargé expérimentalement. Tester les interruptions et échecs du Lab ; ne pas promettre de réparer une corruption native Android par du JavaScript.

## 6. Tests, progressions et diagnostics fiables

Tests réels possibles : lecture, écriture, comparaison, validations de schéma/manifeste, imports/exports, vérification hash, conflits, restaurations, annulations. Les tests de syntaxe TS/TSX, la compilation et l'activation ne sont activés que si une implémentation réellement fonctionnelle existe. Afficher « non exécuté » sinon.

Ne jamais fabriquer de progrès arbitraire. Progression par nombre d'éléments/bytes traités ou étapes réelles, avec état courant, erreurs précises, journal exportable et annulation sûre lorsque possible.

Simuler des erreurs seulement dans des tests automatisés explicites, pas dans l'interface livrée. Les écrans ne doivent pas présenter de fonctions trompeuses activées.

## 7. Export intégral et import du résultat d'un assistant

Export ZIP en un geste de l'état complet DE LA COPIE LOCALE, dont les fichiers d'origine, nouveaux, renommés, modifiés, supprimés (via manifeste), les brouillons sauvegardés, les versions locales, les diffs et diagnostics. Inclure l'état de la modification en cours et suffisamment de provenance pour reconstruire la situation et rapprocher GitHub lors de l'intégration.

Prévenir toute fuite de secrets : exclure fichiers .env, clés, tokens, mots de passe, base de conversations, médias personnels non nécessaires et chemins hors espace source. Utiliser expo-sharing / API Android de partage ou sélecteur de documents approprié ; proposer également sauvegarde dans un emplacement hors de l'espace privé de l'application pour survivre à une désinstallation.

Import : fichiers fournis par GPT ou Claude, ou ZIP complet. Montrer chemin, additions, suppressions, renames, diffs et conflits AVANT confirmation. Versionner et enregistrer avant d'importer. L'utilisateur ne doit pas avoir à coller un long programme dans le chat pour initialiser ou récupérer son travail.

## 8. Contraintes de sécurité

Un terminal dans Elyndor Lab est une interface guidée de modifications et de diagnostics, PAS un shell Android privilégié ni un évaluateur JS arbitraire. Tout appel interne doit suivre une liste d'opérations explicitement autorisées. Interdire l'accès libre au stockage d'autres applications, aux API keys, aux données des joueurs ou aux commandes système. Filtrer ou refuser les opérations non prises en charge ; afficher des erreurs compréhensibles en français. Confirmer les suppressions et conflits.

Protéger l'accès au Lab avant une ouverture commerciale. Ne pas introduire d'exécution de fichiers non fiables via eval, Function, dynamic import arbitraire ou WebView non cloisonné.

## 9. Ergonomie Android tablette

Portrait prioritaire, interface tactile, éléments cliquables >= 48dp, listes de centaines de fichiers performantes, recherche par nom/chemin, aperçu progressif, zone d'édition redimensionnable et plein écran, navigation par fil d'Ariane, retour Android respecté. Gestion du clavier, presse-papier, grandes tailles de fichiers et relance de session. Thème existant bleu nuit/or, français.

## 10. Critères d'acceptation vérifiables

1. Depuis la rubrique Concepteur, l'utilisateur ouvre Elyndor Lab.
2. Il initialise une copie locale réelle des sources et peut la parcourir sans accès réseau une fois importée.
3. Il ouvre un fichier TS/TSX existant et voit son VRAI contenu ; il peut le modifier, créer un fichier, enregistrer, quitter et retrouver son travail.
4. Il voit un diff honnête des modifications ; ajouts/suppressions/moves sont pris en compte.
5. Il crée deux expériences locales indépendantes et restaure une version sans écraser l'autre.
6. Il exporte un ZIP vérifiable, avec manifeste et état complet de la copie, puis peut réimporter l'archive dans un espace vierge ou une variante en voyant les conflits.
7. Toutes les fonctionnalités de l'application existante et les histoires restent intactes.
8. Aucun bouton ne prétend compiler ou appliquer du code si cela n'a pas été réellement démontré sur Android.
9. En cas de limite de ressources/outils, le message « Nécessite GPT ou Claude pour cette opération » apparaît avec export complet, sans bloquer l'édition.
10. L'échec/interruption d'une opération de Lab ne détruit ni la version stable ni les données narratives.

## 11. Méthode de travail attendue, ONE SHOT

A. Auditer le repo et rédiger brièvement les preuves techniques (notamment la réalité des mises à jour locales sans APK).
B. Choisir l'architecture viable et l'expliquer dans docs/ELYNDOR_LAB_ARCHITECTURE.md avec matrice de compatibilité, risques et limites.
C. Implémenter d'un seul chantier les fonctions réelles réalisables, les tests, les protections, les écrans et l'export/import, sans s'arrêter à des maquettes ni à une simple note technique.
D. Exécuter npm test, npx tsc --noEmit et npx expo export -p web si l'environnement le permet ; rendre visibles les échecs et corriger les régressions.
E. Ajouter tests de sécurité ZIP path traversal, non-écrasement du projet principal, brouillons, diff, rollback et erreurs d'I/O ; tester UI/navigation quand possible.
F. Ouvrir UNE pull request vers la branche claude/new-session-glwy6e, avec liste des modifications, tests, fonctions réellement utilisables sur Android, celles non prouvées et instructions de livraison. Ne PAS fusionner ni déployer/installer sans validation.

Si la compilation Android physique ou la preuve d'activation locale exigent du matériel non disponible dans l'environnement Codex, indiquer clairement « non testé sur Galaxy Tab A11 », conserver les opérations non prouvées désactivées et livrer le laboratoire de fichiers utilisable, au lieu de prétendre que le produit complet est fini.

## 12. Ne jamais faire

- Ne pas toucher au dépôt principal par des commits directs, fusion ou publication OTA.
- Ne pas remplacer les réglages d'Elyndor par un nouveau panneau de réglages.
- Ne pas confondre export de configuration JSON existant et export complet des sources du projet.
- Ne pas promettre un hot reload universel TypeScript, Java/Kotlin ou des migrations SQLite sans mécanisme validé.
- Ne pas produire seulement un plan, une démo statique ou des boutons fictifs à la place du chantier réalisable.
- Ne pas injecter des scripts arbitraires dans l'APK.
- Ne pas exposer de clés API, histoires privées ou données utilisateurs.
- Ne pas demander un PC, RunPod ou une infrastructure distante pour les opérations utilisateur locales.

## 13. Livrables

- Code sur branche de PR.
- Interface Elyndor Lab accessible depuis le Module Concepteur.
- Copie locale réelle, éditeur, versions, diff, import/export, diagnostics fiables et récupération proportionnée à ce qui est réellement possible.
- Batteries de tests et documentation de fonctionnement.
- Audit de faisabilité avec verdict explicite sur la compilation/activation TSX sans APK en local, séparant ce qui est prouvé de ce qui reste impossible ou non testé.
- PR non fusionnée, prête à être revue.

Ce document est la SOURCE UNIQUE de directives pour le chantier Elyndor Lab V1.1, pas un ordre de publier l'application.