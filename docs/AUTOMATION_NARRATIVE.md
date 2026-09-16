# Elyndor — Automatismes narratifs V2

## But

Relier les sauvegardes d'histoires au `AutomationKernel` sans doubler les appels modèle ni permettre à un résultat calculé sur un ancien transcript d'écraser un état plus récent.

## Révision narrative

Chaque histoire reçoit une empreinte déterministe calculée à partir de l'identité de l'histoire, du personnage et du triplet `id/role/content` de chaque message.

Les éléments purement UI (réaction, épingle, titre) ne changent pas cette empreinte et ne déclenchent donc pas de post-traitement inutile.

## Chaîne

`saveStory()` → sauvegarde durable → `storyEvents` → job `story.postprocess` → contrôle de révision → rattrapage éventuel → écriture gardée.

Le job ne transporte aucune clé API ni copie complète de l'histoire. Il conserve uniquement `storyId` et la révision attendue.

## Rattrapage

La routine vérifie :

- mémoire / directeur / monde / social : seulement si la cadence de mise à jour est réellement atteinte ;
- lore émergent : seulement si son curseur est derrière le nombre de messages.

Le flux historique de `generateTurn.ts` reste encore actif dans cette étape. Par conséquent un tour normal déjà entièrement traité provoque un job très léger qui constate simplement que tout est à jour. Le Kernel sert dès maintenant de filet de reprise après fermeture/interruption et de garde de concurrence.

## Protection contre l'état obsolète

Avant calcul, le handler vérifie que la révision persistée correspond au job.

Après les éventuels appels modèle, l'écriture repasse par `storyRepository.mettreAJourSi()`. La vérification de révision et l'écriture sont placées dans la même file sérialisée que toutes les autres sauvegardes. Si un nouveau tour ou une édition a été sauvegardé pendant le calcul, le patch ancien est abandonné.

Une maintenance automatique ne modifie pas `meta.updatedAt`, afin de ne pas faire apparaître une histoire comme récemment jouée uniquement parce qu'un traitement interne s'est terminé.

## Reprise au démarrage

Au démarrage, le provider parcourt les histoires et ne remet en file que celles dont un pipeline est réellement en retard. Cela couvre le cas limite où l'application a été fermée après la sauvegarde mais avant l'enqueue du job.

## Étape suivante

Quand ce garde-fou est validé en production, les post-traitements actuellement attendus dans `generateTurn.ts` pourront être sortis du chemin critique et confiés au job `story.postprocess`. La révision gardée ajoutée ici est le prérequis nécessaire pour faire cette migration sans course d'écriture.
