# CODEX — MISSION UNIQUE DE CONSOLIDATION ELYNDOR LAB

Date : 10 octobre 2026
Dépôt : https://github.com/artisanguillonrenov-creator/logiciel-rp-beta
Branche documentaire contenant cette mission : docs/codex-elyndor-lab-mission-20261010
Branche de référence initiale : claude/new-session-glwy6e
Commit de référence audité : ba047a8928d217bc8573344b5f61f3782bd54509
Mission préparée pour Codex, et non pour exécution directe par l'assistant qui a rédigé ce document.

## 0. AUTORITÉ, SÉPARATION DES RÔLES ET RÈGLES NON NÉGOCIABLES

Ce document est un cahier des charges. Sa présence dans GitHub n'autorise aucune exécution autonome. L'autorisation de Codex commence uniquement lorsque le propriétaire lui adresse une consigne explicite de lancement.

Quand le propriétaire lance cette mission dans Codex : réaliser UN CHANTIER D'INGÉNIERIE COHÉRENT, couvrant le périmètre ci-dessous, dans une branche de travail isolée. Ne pas demander un nouvel accord à chaque sous-lot. En revanche, arrêter une opération qui menace des données existantes, modifie la production, suppose une aptitude technique non démontrée ou exigerait une intervention extérieure supplémentaire.

Règles absolues :
- Ne jamais modifier directement la branche principale claude/new-session-glwy6e.
- Ne jamais fusionner une branche ni activer l'auto-merge, ni déployer en production, ni publier une OTA ou un APK, sans APPROBATION EXPLICITE distincte du propriétaire.
- Ne pas ouvrir de pull request sans approbation explicite : les workflows pull_request déclenchent des vérifications et une prélecture web publiable. Les tests autonomes dans l'environnement Codex restent autorisés durant le chantier.
- Ne pas déclencher GitHub Actions manuellement, ne pas modifier de secrets, tokens, permissions ou protections GitHub, ne pas acheter de ressources ni démarrer RunPod.
- Ne pas altérer les historiques RP, SQLite, personnages, mondes, configurations, moteurs narratifs ou médias utilisateurs. Pas de réinitialisation destructrice ni de migration silencieuse.
- Ne pas promettre une compilation TypeScript locale, un chargement de code exécutable à chaud, un terminal Android arbitraire ou une récupération native tant que le dispositif n'a pas été réellement démontré et testé sur la tablette cible.
- Ne pas utiliser eval, nouveau code arbitraire exécuté avec les privilèges de l'application, mécanisme de chargement non signé, shell caché ou contournement de la sécurité Android.
- Aucun ordinateur à disposition du propriétaire : uniquement une tablette Android Galaxy Tab A11. Toute opération utilisateur doit être réalisable depuis cette tablette ou directement dans Codex/GitHub en ligne. Aucune commande à copier dans un terminal local ne peut être exigée.
- Respecter le fichier AGENTS.md du dépôt et consulter la documentation versionnée Expo 57 avant de changer le code.
- Les méta-moteurs narratifs sont codés dans l'application : les anciens méta-moteurs texte désactivés ne doivent pas être réintroduits.
- Pas de modification de l'expérience RP hors des interfaces nécessaires au laboratoire et de ses contrats de persistance.

Exécution : partir de la branche documentaire contenant la présente mission (en conservant son fichier), examiner la référence actuelle, puis créer une nouvelle branche technique séparée, par exemple codex/elyndor-lab-consolidation-20261010. Utiliser cette branche exclusivement pour les changements. Si la branche principale a bougé depuis ba047a8, comparer les changements et travailler sur la base la plus récente sans écraser de code tiers. Si un changement contradictoire ou destructeur apparaît, le signaler et stopper cette partie.

## 1. OBJECTIF PRODUIT À ATTEINDRE

Faire évoluer Elyndor Lab V1.1, actuellement prototype de consultation et d'édition de textes, en atelier robuste et utilisable sur tablette pour explorer, éditer, versionner, sauvegarder et exporter/restaurer une copie locale réelle des sources et médias. Protéger totalement la production RP et permettre une récupération des données en cas d'erreur.

L'atelier actuel n'est PAS un véritable IDE autonome. Son bouton de mise à jour locale est désactivé et doit le rester en l'absence de preuve suffisante. La faisabilité de compilation/activation sans APK constitue une étude et un prototype indépendants, PAS un résultat garanti.

Définition de la réussite :
1. Les sources manipulées sont de véritables fichiers locaux indépendants ou le propriétaire valide explicitement une solution de remplacement objectivement équivalente ; un JSON monolithique déguisé en arborescence n'est pas conforme.
2. Les modifications rapides, changements de vue, verrouillages, interruptions et relances n'entraînent aucune perte silencieuse de travail.
3. Le système sait exporter/importer réellement ses données et son historique avec inventaire, sécurité, intégrité et confirmation explicite pour toute opération destructive.
4. Les médias, le code et les informations de provenance peuvent être sauvegardés et transférés depuis la tablette sans ordinateur ; les éventuelles dépendances et exclusions sont indiquées honnêtement.
5. L'application RP fonctionne exactement comme avant ; une panne du laboratoire ne détruit ni partie ni application.
6. Les validations sont testées de façon reproductible, notamment en environnement Android réel lorsque disponible ; les tests non effectués restent explicitement NON VÉRIFIÉS.

## 2. BASE FACTUELLE ET FICHIERS À AUDITER À NOUVEAU

Audit antérieur : PR #99 fusionnée le 10/10/2026 ; commit ba047a8928d217bc8573344b5f61f3782bd54509. Au dernier contrôle, la branche principale pointait exactement sur ce commit, sans nouveaux changements. Ce contrôle n'est pas intemporel : vérifier avant d'intervenir. Le build de la PR a réussi (294 tests totaux, compilation TypeScript et export web). QUATRE tests unitaires seulement portent sur Elyndor Lab, sans validation établie sur Galaxy Tab A11.

Fichiers clefs :
- src/components/ElyndorLabPanel.tsx : UI tactile à sept onglets, autosauvegarde, import/versions.
- src/lab/workspaceCore.ts : chemins, deltas, versions, suppression logique, précontrôles.
- src/lab/workspaceStore.ts : workspace.json, sauvegarde et fichier temporaire.
- src/lab/depotSources.ts : sources-base.json et sources-base.backup.json.
- src/lab/archives.ts : ZIP texte, import et export.
- src/lab/diff.ts : comparaison sommaire.
- tools/elyndorLab/prepare-sources.cjs : génération de l'instantané au npm prepare.
- src/lab/sourceSnapshot.generated.ts : substitut vide dans Git, peuplé uniquement au build.
- tests/elyndorLab.test.ts : quatre tests.
- docs/ELYNDOR_LAB_V1_1.md : limitations publiées.
- src/screens/DesignerSettingsScreen.tsx, src/navigation/types.ts et package.json.

Le build précédemment décrit annonçait 352 fichiers source texte et 70 chemins binaires. Cela n'est ni la preuve d'une extraction physique fichier par fichier sur Android, ni un inventaire exhaustif du dépôt : certains répertoires sont ignorés. Inspecter les modules natifs et les exclusions actuelles.

Les faits suivants ont été revérifiés dans le code au 10/10/2026 :
- Dans archives.ts, le drapeau « complet » vaut estLab OU présence de package.json ; une archive partielle avec package.json peut donc supprimer logiquement tous les autres fichiers de la référence via supprimerFichier.
- Le ZIP texte liste des binaires non inclus ; son import n'hydrate pas complètement l'historique exporté.
- Dans ElyndorLabPanel.tsx, sauvegarderBrouillon attend une écriture asynchrone puis réinitialise editionModifiee ; une frappe après la capture de l'état peut être perdue ou marquée sauvegardée à tort. Le délai de 1200 ms et les navigations ajoutent des risques.
- L'aperçu d'import n'affiche que trois exemples par catégorie de changement et ne montre pas la liste exhaustive des suppressions.
- La base locale est un gros JSON et le travail un registre JSON ; pas un arbre de fichiers source individuels.
- Les contrôles ne compilent pas le projet. Le bouton d'activation est désactivé. Le secours restaure des sources, pas une application qui plante au démarrage.
- workspaceStore sérialise certaines écritures sur une promesse, mais cela ne résout pas les révisions obsolètes dans l'interface.
- Les filtres de secrets sont surtout fondés sur les noms de fichiers, et JSZip décompresse le texte avant le contrôle du volume décompressé total.
- L'absence de validation complète sur appareil demeure une limite.

Ne pas interpréter « risque confirmé par inspection » comme « panne réellement reproduite sur Android ». Vérifier et documenter cette distinction.

## 3. CHANTIER UNIQUE — ORDRE TECHNIQUE DE DÉPENDANCE

### A. État initial et conservation

Auditer la branche, les composants, les migrations, les flux de navigation et la persistance des données RP. Identifier le contrat de stockage existant, les références d'APK/OTA et les données que le laboratoire n'a pas le droit de toucher. Établir avant les changements un inventaire et une stratégie explicite de migration des installations V1.1. Prévoir rollback, vérification d'intégrité et reprise en cas d'échec partiel. Ne pas détruire les anciennes données tant qu'une restauration vérifiée n'existe pas.

### B. P0 : import ZIP non destructif

Importer par défaut en MODE PATCH, donc aucune suppression implicite lorsque des fichiers manquent dans l'archive, même si package.json ou un manifeste de laboratoire est présent.

Un mode de synchronisation complète n'est autorisé qu'avec manifeste versionné et validé, référentiel et empreintes concordants, inventaire précis des fichiers fournis/absents, aperçu complet des suppressions, confirmation destructive renforcée et sauvegarde restaurable préalable. Refuser toute archive mensongère, contradictoire, tronquée, vide, ambiguë, avec chemins inattendus ou incompatible. Séparer strictement l'analyse de l'application effective : aucune écriture durant la phase d'inspection.

L'interface doit afficher TOUS les fichiers impactés, avec possibilité de défiler ou filtrer ; pas uniquement trois exemples et un total. Offrir explicitement annulation sans aucune modification.

### C. P0 : autosauvegarde et persistance transactionnelle

Adopter révisions monotones par document, instantané immuable, file d'écriture ordonnée et confirmation de la seule révision réellement persistée. Empêcher les accusés obsolètes d'effacer une modification plus récente. Gérer navigation, mise en arrière-plan, verrouillage écran, fermeture rapide, double clic, changement de fichier, import, restauration et erreurs d'écriture.

Lors d'une transition, garantir la persistance ou afficher une alerte de travail non sauvegardé sans perte silencieuse. Vérifier la cohérence entre état affiché et état disque ; introduire des tests de concurrence. Séparer données de travail, sauvegarde, métadonnées et fichiers temporaires, avec atomicité/stratégie de journalisation adaptée à Android.

### D. P0 : sûreté du ZIP et contrôle des secrets

Valider les chemins (traversal, absolus, encodages, collisions, casse, doublons), le schéma, les références, les empreintes et les longueurs. Imposer des garde-fous documentés avant toute extraction massive, en particulier limites de taille décompressée par entrée, total, nombre de fichiers et ratios ; ne pas charger en mémoire une archive hostile avant validation. Si JSZip ne permet pas de garantir ces contraintes, employer une approche adaptée ou refuser les fichiers sans prétendre être protégé.

Scanner les sources exportées à la recherche de secrets présents dans le CONTENU, pas seulement dans des noms sensibles. Prévoir exclusion, masquage et revue visible avant partage. Un texte rassurant ne remplace pas un contrôle réel. Aucune donnée sensible ni aucun historique RP utilisateur ne doivent se retrouver dans une archive de sources sans consentement explicite et périmètre identifié.

Assurer round-trip ZIP : export, import, validation de l'intégrité, erreurs lisibles et restauration complète.

### E. P0 : sauvegarde externe et restauration

Offrir la sauvegarde et restauration durables hors du stockage privé de l'application, via interfaces Android adaptées (SAF ou autre mécanisme documenté). Ne jamais promettre qu'une sauvegarde interne survit à la désinstallation. Séparer sauvegarde de travail, données de jeu et versions. Prévoir export vers dossier choisi, contrôle de présence/empreinte, import de secours, gestion des permissions et scénarios de corruption/interruption. Éviter toute suppression automatisée des sauvegardes de secours.

### F. P1 : stockage local réellement exploitable

Remplacer ou compléter la base monolithique sources-base.json et les overrides JSON par une arborescence de fichiers locaux individuels dans un espace d'application dédié ; conserver index, métadonnées, empreintes, origine Git et journal de transactions. Ne pas recopier systématiquement tout le dépôt à chaque version. Utiliser écriture par fichier/stockage incrémental, lecture paginée ou progressive. Préserver la continuité avec les données V1.1 via migration explicite et sauvegarde préalable.

Permettre lecture, modification, création, renommage, déplacement et suppression contrôlée des fichiers et dossiers ; distinguer la référence immuable, les changements en cours et les versions. Ne jamais écrire directement dans le bundle exécuté ou l'arborescence du système Android.

Les quotas/protections de mémoire et d'espace doivent être justifiés par la capacité réelle du matériel, et non par des limites arbitraires ; ne jamais retirer les protections anti-archive-hostile.

### G. P1 : archive complète, médias et historique

Construire un inventaire exhaustif des sources et actifs du dépôt, y compris les médias, en distinguant les exclus intentionnels, dépendances externes, fichiers générés et informations privées. Rendre possible un export fidèle de la copie locale : sources, binaires, fichiers inchangés, suppressions, manifeste, référence, empreintes, schéma, versions et historique utile. Si les médias ne sont pas physiquement disponibles dans l'APK, concevoir un moyen sécurisé et compatible tablette de les obtenir (par exemple artefact de préparation vérifiable, import depuis GitHub ou archive préparée au build), sans prétendre que le catalogue de chemins contient les octets.

Prévenir chargements mémoire gigantesques : traitement par morceaux ou approche techniquement justifiée. Un import inverse dans un espace vierge doit restaurer les octets et versions correspondants. Les incompatibilités ou exclusions doivent être affichées avant validation.

### H. P1 : branches locales, versions et réconciliation après mise à jour

Créer des chantiers expérimentaux isolés avec vrai état indépendant, branche stable protégée, historique restaurable, suppression contrôlée, identifiants non collisionnels, aperçu de diff multi-blocs, possibilité de revenir en arrière.

Après mise à jour APK/OTA, vérifier empreintes/références de la base ancienne et nouvelle, compatibilité de schéma et modules natifs. Proposer migration ou rapprochement à trois voies (base ancienne, changement local, base nouvelle) sans écrasement silencieux. Si conflit, demander un choix explicite et conserver les deux versions.

### I. P1 : éditeur tactile et diagnostics honnêtes

Améliorer un éditeur adapté à Galaxy Tab A11 (recherche globale, recherche/remplacement si fiable, visibilité des lignes, navigation, affichage des erreurs, diff multi-blocs, presse-papiers, gestion des longues sources et accessibilité tactile). Ne pas sacrifier la fiabilité pour la décoration.

Ajouter un journal explicite des opérations critiques et résultats de tests, avec erreurs et possibilités de récupération ; éviter les secrets dans les logs. Distinguer précontrôle de syntaxe, véritable vérification TypeScript, simulation de test, exécution Android, validation de version. Ne jamais annoncer « code activé » ou « tests réussis » si seule une validation de JSON a tourné.

### J. P2 : faisabilité de l'activation locale sans APK

Avant de promettre un bouton « Mettre à jour », mener une étude et, si faisable, un prototype ISOLÉ du bundle RP principal. Expo 57, React Native 0.86.3, Hermes, modules natifs Android et appareil Galaxy Tab A11 sont les contraintes de départ.

Démontrer sur le matériel cible, et non seulement dans Node/Linux, la transpilation, le bundling, la compatibilité des importations/assets, la validation du code, l'isolation d'exécution et une stratégie de rollback résistante à un crash au démarrage. Évaluer taille, durée, mémoire, compatibilité OTA et restrictions natives. Aucune exécution de code fourni par des archives non vérifiées avec les privilèges du processus RP.

Si non démontré : conserver le bouton désactivé, proposer uniquement un processus distant sûr (CI/build/APK/OTA après autorisation) ou une option technique bornée, clairement présentée comme alternative. Les modifications Kotlin, Gradle, permissions et dépendances natives exigent un APK reconstruit ; ne pas prétendre le contraire.

### K. Protection de la production et mode secours réel

Le moteur narratif, les sauvegardes de parties/personnages/histoires et le stockage RP sont hors périmètre de modification. Pour tout système expérimental d'activation, prévoir un socle stable qui ne dépend pas du bundle modifiable, sélection du dernier état sain, rollback après panne simulée en environnement de test et récupération des sources même en cas d'erreur. Un onglet React Native au sein du même bundle n'est pas un mécanisme indépendant de récupération après crash. Ne pas activer de pipeline à risque sans validation.

## 4. ESSAIS OBLIGATOIRES ET CRITÈRES D'ACCEPTATION

Compléter les quatre tests unitaires existants par tests unitaires, tests de composants, intégration disque/ZIP et essais Android.

T01. Importer ZIP partiel avec package.json et src/engine/example.ts : aucun fichier de base absent n'est supprimé.
T02. Importer manifeste absent, mensonger, tronqué, incompatible ou fichiers malveillants : rejet avant toute mutation et sans perte de brouillons.
T03. Petit ZIP compressé contenant données décompressées immenses ou milliers d'entrées : rejet avant épuisement mémoire.
T04. Frappe rapide pendant écriture, changement d'onglet, verrouillage écran puis réouverture : dernière révision conservée ou erreur explicite sans marquage trompeur.
T05. Version A, modification B, création C, restauration A, export ZIP : fichiers et historique exacts.
T06. Dernière écriture tronquée/corrompue, redémarrage : récupération de l'état sain et aucune réinitialisation silencieuse.
T07. Mise à jour de l'APK/OTA avec chantier en cours : conservation de l'ancien travail, diff et conflits identifiés.
T08. Fichier Kotlin/Gradle ou dépendance native modifiée : affichage non ambigu « reconstruction APK requise ».
T09. Export sources + médias + historique puis import dans environnement vierge : empreintes identiques et inventaire complet ou exclusions explicitement documentées.
T10. Essai hors ligne, faible mémoire, manque réel de stockage et interruption de processus sur la tablette Galaxy Tab A11.
T11. Secret artificiel dans contenu d'un fichier au nom ordinaire : aucune fuite dans l'archive partageable sans alerte/consentement adapté.
T12. Histoires, personnages, parties, paramètres et autres données RP préexistantes restent intacts pour tous les parcours.
T13. Import avec centaines de suppressions prévues : aperçu exhaustif, consentement renforcé et annulation non destructive.
T14. Deux sauvegardes asynchrones inversées en temps d'achèvement : l'état le plus récent gagne, pas d'effacement du drapeau dirty.
T15. ZIP avec entrées dupliquées, traversal, collisions de casse, chemins absolus, encodages invalides : rejet sûr.
T16. Crash volontaire d'un prototype d'activation en environnement isolé : retour à un environnement stable démontré, sinon bouton désactivé.

Tester également npm ci, npm test, npx tsc --noEmit et npx expo export -p web, si l'environnement les permet. Une réussite Linux/CI ne remplace pas un essai physique Android. NE JAMAIS inventer des tests passés ou un APK installé. Si un test réel sur la tablette ne peut être effectué par Codex, le déclarer comme attente de validation utilisateur, avec un protocole tactile minimaliste.

## 5. CHOIX D'ARCHITECTURE ET LIVRABLES

Fournir une solution conçue pour une tablette, non une surcouche cosmétique :
- Un schéma clair des flux : référence, fichiers locaux, modifications, branches, versions, sauvegardes, export, import, migration et rollback.
- Compatibilité/migration V1.1 et préservation des données RP.
- Liste exhaustive des fichiers touchés, justification des changements, et des nouvelles dépendances/permissions natives.
- Matrice des protections et des tests effectivement exécutés avec leurs résultats.
- Inventaire de tout ce qui demeure impossible, limité ou non vérifié, notamment activation locale, secours natif et essai physique.
- Une seule synthèse finale : objectifs atteints, risques restants, preuves et étapes de validation exclusivement nécessaires sur la tablette.
- Code et tests dans UNE branche isolée, sans merge, sans création de PR, sans lancement d'Actions ou publication. Indiquer le nom de la branche pour examen.

Arrêts obligatoires : découverte de risque de perte de données existantes impossible à neutraliser ; incompatibilité irréductible avec Expo/Android ; nécessité de changer directement la branche principale ; opération de publication, activation d'un service payant ou manipulation de secrets. Dans ces cas, protéger l'existant et rendre un diagnostic motivé au lieu d'improviser.

## 6. SÉQUENCE D'EXÉCUTION POUR CODEX

1. Lire ce document ENTIER et AGENTS.md ; confirmer dépôt, branche, état actuel, workflows et comparaisons.
2. Faire un audit de conformité initial en lecture seule et classifier les écarts entre ce document et la réalité du dépôt. Réduire les doublons, identifier les dépendances, puis fixer un plan interne unique.
3. Créer sa branche technique propre à partir de la base actuelle appropriée, en conservant le document de mission pour traçabilité.
4. Implémenter dans l'ordre des dépendances : P0 avant P1, puis faisabilité P2. Un seul chantier, sans livraisons fragmentées au propriétaire.
5. Exécuter les tests disponibles et documenter honnêtement ceux nécessitant un appareil ou des autorisations. Ne pas annoncer que tout est terminé si les critères essentiels échouent.
6. Terminer sur la branche technique et remettre le rapport. Ne pas ouvrir de PR, ne pas fusionner, ne pas publier et ne pas toucher à la branche principale sans nouvelle approbation explicite.

NOTE IMPORTANTE : le fait de lire une mission sur une branche ne change PAS la branche principale et ne doit jamais être traité comme une instruction implicite de déployer. Le propriétaire exige une distinction stricte entre préparation, développement isolé, revue, fusion et mise en production.
