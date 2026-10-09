# Diagnostic du stockage dans les paramètres concepteur

Accès : **Réglages concepteur** > activer le mode concepteur > **Fichiers et espace disque** > **Analyser le stockage**.

L'outil effectue l'inventaire en lecture seule et propose des actions de maintenance confirmées. Il affiche :
- le volume de stockage interne vu par Android (capacité totale et espace disponible) ;
- la somme des tailles des fichiers accessibles dans les répertoires privés de l'application et son répertoire externe privé ;
- les dossiers, fichiers et tailles, avec navigation par dossier et pagination (100 éléments/page) ;
- la date de modification et le chemin relatif d'un fichier sélectionné.

L'explorateur ne demande pas de permission pour accéder aux fichiers personnels de la tablette. La navigation et l'inventaire n'ouvrent et ne modifient jamais les fichiers. Les **actions volontaires**, soumises à confirmation, sont limitées aux fichiers images PNG (`scene-images`, `pnj-avatars`) et aux fichiers de diagnostics JSONL. Les bases SQLite, ObjectBox, AsyncStorage et les sauvegardes de conversations ne sont jamais supprimables depuis cette interface.

## Gérer les fichiers

- Sélectionner un PNG > **Enregistrer l'image dans la galerie** : crée une copie dans **Images/Elyndor**, via Android MediaStore, sans supprimer la source (Android 10+).
- Sélectionner un PNG ou un diagnostic JSONL > **Supprimer ce fichier** : confirmation irréversible avant suppression ; les images encore utilisées par un récit risquent de ne plus s'afficher.
- **Supprimer les diagnostics de plus de 30 jours** : aperçu du nombre/taille, puis confirmation.
- **Supprimer tous les diagnostics** : aperçu du nombre/taille, puis confirmation ; les journaux actifs pourront réapparaître lors de nouvelles opérations.

La suppression est vérifiée côté Kotlin avec chemin canonique, liste blanche de dossiers et extensions, interdiction de traverser les dossiers et de suivre les symlinks. Aucun dossier entier ni base de données ne peut être supprimé. Les chemins sont résolus côté Android et vérifiés comme appartenant aux racines autorisées. Les liens symboliques ne sont pas suivis. Si un dossier est inaccessible ou si un parcours dépasse 200 000 éléments, la mesure est signalée comme incomplète.

## Emplacements courants

Selon l'installation Android, on trouve :
- SQLite d'histoires : base `elyndor-histoires.db` (via expo-sqlite) ;
- AsyncStorage : fichiers de base `RKStorage` et leurs journaux ;
- ObjectBox : `files/elyndor-objectbox` ;
- illustrations : `files/scene-images` ;
- avatars : `files/pnj-avatars` ;
- diagnostics : `files/diagnostics`.

Le total calculé additionne les tailles logiques des fichiers accessibles et peut différer du chiffre Android « Données » (allocation des blocs, caches, réservations, autres emplacements). Il ne permet pas à lui seul de conclure que la limite AsyncStorage a été atteinte.

**Attention :** l'outil utilise des méthodes du module natif ObjectBox, dont les méthodes d'export/maintenance ajoutées à la suite du diagnostic. Il faut installer un APK reconstruit ; une mise à jour OTA ne peut pas ajouter ces méthodes natives à une ancienne application.
