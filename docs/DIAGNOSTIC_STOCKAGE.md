# Diagnostic du stockage dans les paramètres concepteur

Accès : **Réglages concepteur** > activer le mode concepteur > **Fichiers et espace disque** > **Analyser le stockage**.

L'outil exécute une mesure Android native en lecture seule. Il affiche :
- le volume de stockage interne vu par Android (capacité totale et espace disponible) ;
- la somme des tailles des fichiers accessibles dans les répertoires privés de l'application et son répertoire externe privé ;
- les dossiers, fichiers et tailles, avec navigation par dossier et pagination (100 éléments/page) ;
- la date de modification et le chemin relatif d'un fichier sélectionné.

L'explorateur ne demande pas de permission pour accéder aux fichiers personnels de la tablette. Il n'ouvre, n'écrit, ne supprime ni ne déplace aucun fichier. Les chemins sont résolus côté Android et vérifiés comme appartenant aux racines autorisées. Les liens symboliques ne sont pas suivis. Si un dossier est inaccessible ou si un parcours dépasse 200 000 éléments, la mesure est signalée comme incomplète.

## Emplacements courants

Selon l'installation Android, on trouve :
- SQLite d'histoires : base `elyndor-histoires.db` (via expo-sqlite) ;
- AsyncStorage : fichiers de base `RKStorage` et leurs journaux ;
- ObjectBox : `files/elyndor-objectbox` ;
- illustrations : `files/scene-images` ;
- avatars : `files/pnj-avatars` ;
- diagnostics : `files/diagnostics`.

Le total calculé additionne les tailles logiques des fichiers accessibles et peut différer du chiffre Android « Données » (allocation des blocs, caches, réservations, autres emplacements). Il ne permet pas à lui seul de conclure que la limite AsyncStorage a été atteinte.

**Attention :** l'outil utilise deux nouvelles méthodes du module natif ObjectBox. Il faut installer un APK reconstruit ; une mise à jour OTA ne peut pas ajouter ces méthodes natives à une ancienne application.
