# Elyndor Lab — état de consolidation technique (branche isolée)

Référence : audit de reprise du 10 octobre 2026, PR #99 / ba047a8.
Branche du chantier : chatgpt/elyndor-lab-consolidation-20261010.
La branche de production n'est pas modifiée par ce chantier.

## Réalisé dans cette branche

- Import ZIP par défaut en **patch non destructif** : package.json ou manifeste présent ne provoque plus de suppression implicite des sources absentes.
- Prévalidation des chemins ZIP (dont chemins d'origine), collisions de casse, quantité et taille annoncées ; décompression textuelle par flux avec garde-fou sur la taille effectivement produite. Aucune écriture du registre de travail pendant la prévisualisation.
- ZIP Elyndor Lab schéma 2 avec références, empreintes de contrôle par fichier, vérification du manifeste et réimportation de l'historique compatible ; lecture conservatrice des anciens schémas 1 en mode patch.
- Export annulé quand la détection heuristique relève un secret potentiel dans le contenu d'un fichier. Ce n'est ni un audit exhaustif des secrets ni une garantie cryptographique ; les empreintes existantes détectent la corruption accidentelle seulement.
- Journal de révisions du brouillon et opérations de sauvegarde sérialisées ; l'interface n'indique "enregistré" que si la révision acquittée est la dernière ; navigation sensible et sortie du panneau déclenchent une écriture immédiate.
- Validation du snapshot d'import avant application, pour refuser une prévisualisation devenue obsolète. Affichage de tous les chemins concernés par l'import, plus seulement trois exemples.
- Copie en **véritables fichiers texte individuels** dans le stockage privé Android, avec index incrémental et tentative de reprise après interruption. Durant cette étape de migration, la copie physique est un **miroir**, pas encore la source de vérité : le registre JSON V1.1 reste conservé. Aucun fichier de jeu ni historique RP n'est modifié.
- Comparateur texte multi-blocs (LCS borné en mémoire ; repli sommaire pour grands textes).
- Tests supplémentaires écrits pour concurrence des révisions, chemins, manifestes, patchs et différences multi-blocs.

## Ce qui NE DOIT PAS être annoncé comme terminé

- Aucun npm test, tsc, export web ou test Android physique n'a encore été exécuté sur ces changements. Les nouveaux tests sont **écrits mais non exécutés**. Il peut donc subsister des erreurs de compilation et des problèmes d'intégration.
- Les binaires / portraits / images ne sont PAS inclus dans le ZIP : l'archive reste exclusivement une archive des sources texte, non un clone intégral du dépôt.
- Le système de fichiers physiques est un miroir reconstructible. La bascule complète sur un modèle fichier-par-fichier autoritaire avec migration prouvée n'est pas achevée.
- Une action **manuelle Android SAF** permet désormais de choisir un dossier hors de l'application pour sauvegarder le ZIP texte ; contrôle de présence du fichier après écriture. Cette fonction n'est pas encore testée sur appareil. Il n'y a PAS de sauvegarde automatique périodique, de vérification cryptographique externe ni de restauration native de l'application après désinstallation. La réimportation demeure liée à la référence de code.
- Chantiers indépendants/branches locales véritables, migration de références après OTA/APK, éditeur avancé, tests natifs end-to-end : toujours incomplets.
- Compilation locale TypeScript/Metro/Hermes et activation sans APK : toujours NON démontrées. Le bouton doit rester désactivé. La récupération native après un crash du bundle n'est pas implémentée.
- Aucune PR, fusion, publication OTA, build APK ni lancement RunPod.

## Contrôles requis avant d'envisager une fusion

1. npm ci, npm test, npx tsc --noEmit, npx expo export -p web.
2. Test d'import ZIP partiel contenant package.json, archive tronquée/malformée et archive hostile de taille mensongère.
3. Test de frappe rapide pendant une sauvegarde, navigation, fermeture, réouverture, reprise après corruption.
4. Essais Android sur la Galaxy Tab A11 : ouverture hors ligne, première matérialisation de centaines de fichiers, reprises, sauvegardes, export, réimport et faible mémoire.
5. Vérification indépendante que SQLite, parties, personnages, histoires et moteur narratif n'ont pas été altérés.
6. Contrôle des coûts mémoire de la copie physique et de l'archive complète avant d'envisager l'ajout des médias.
7. Révision sécurité du scanner de secrets et renforcement cryptographique des empreintes si besoin d'archives de confiance.

Ce fichier est un état honnête de code en cours de validation, pas un certificat de livraison.
