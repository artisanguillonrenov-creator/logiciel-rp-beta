# Elyndor Lab V1.1 — fondations locales

## Périmètre réel

Le module est accessible dans **Réglages → Réglages concepteur → Elyndor Lab — Code source** avec le mode Concepteur activé.

- Source intégrée : le script tools/elyndorLab/prepare-sources.cjs parcourt le checkout **au build** (npm prepare) et génère une table de sources texte dans src/lab/sourceSnapshot.generated.ts. Les répertoires .git, node_modules, dist et secrets nominaux sont exclus. Les actifs binaires sont listés mais **non embarqués en double**.
- Copie locale : modifications par recouvrement (overrides), stockées en JSON dans le répertoire privé de l'application Android, **indépendantes de GitHub** et des histoires.
- Interface : exploration par dossiers, création, édition et suppression de fichiers éditables, insertion par presse-papiers, autosauvegarde, précontrôles, instantanés et restauration de la copie source.
- Échange : export ZIP de **toutes les sources texte** locales, des changements et des versions ; import ZIP avec confirmation et instantané avant import ; protection contre les chemins relatifs malveillants et les secrets nommés.
- Sauvegardes : registre JSON en écriture par fichier temporaire et secours, et historique sans taille fixe.
- Aucun nouveau service distant, aucune clé API, aucune dépense RunPod.

## Limites explicites

La copie locale modifiée **ne remplace pas** le bundle JS exécuté par l'APK. Expo/Metro/Hermes et la mécanique de rechargement de modules ne sont pas intégrés à l'application de production. Le bouton « Mettre à jour » reste **désactivé** : pas de progression fictive ni de redémarrage prétendument réussi.

Le contrôle de JSON et des chemins n'est **pas** une compilation du projet. Le « vert » d'un contrôle JSON ne signifie pas que l'app peut tourner. Les fichiers Kotlin, Gradle, manifestes Android et changements de dépendances nécessitent un nouvel APK compatible.

La restauration proposée est celle de **la copie source locale**, pas encore une récupération automatique d'une application crashée au démarrage. Le vrai mode secours binaire devra être validé après faisabilité du chargeur.

Le ZIP contient l'état complet **du code texte disponible et éditable**, **pas** les portraits, images et autres actifs binaires. Le manifeste décrit les éléments non inclus. En vue d'un export de *tout* le dépôt à l'identique, il faudra étudier un mécanisme d'import/export d'actifs binaires et un contrôle mémoire adapté à la tablette.

## Vérifications exigées

1. npm ci doit produire un sourceSnapshot.generated.ts non vide.
2. npm test, TypeScript strict et export Web doivent passer en CI.
3. Sur tablette, vérifier le chargement hors ligne des dossiers et fichiers réels.
4. Modifier un fichier, fermer l'application, confirmer la persistance et restaurer un instantané.
5. Exporter le ZIP et le réimporter sans secret ni perte.
6. Vérifier l'arrêt propre si une archive ZIP est invalide.
7. **Avant tout développement d'activation à chaud**, réaliser un prototype indépendant démontrant compilation et chargement local du code sur tablette. Ne pas exposer un bouton actif avant cette preuve.

## Sécurité

Ne jamais exécuter par eval ou shell du code collé dans l'application, ni lui conférer implicitement les permissions Android de l'application principale. Toute future exécution exige un environnement contrôlé, une validation des capacités et une récupération hors du périmètre du patch.
