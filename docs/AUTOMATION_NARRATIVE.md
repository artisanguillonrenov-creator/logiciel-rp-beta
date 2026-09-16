# Elyndor — Automatismes narratifs V3

## But

Sortir mémoire, directeur narratif, simulation du monde, dynamique sociale et lore émergent du temps d’attente du joueur, sans perdre la cohérence ni permettre à un résultat ancien d’écraser un tour plus récent.

## Chaîne active

`genererTour()` s’arrête désormais dès que la réponse est générée, validée et ajoutée au transcript.

La suite est :

`réponse prête` → affichage UI → `saveStory()` → sauvegarde durable → `storyEvents` → job `story.postprocess` → contrôle de révision → pipelines dérivés → écriture gardée.

Le job ne transporte aucune clé API ni copie complète de l’histoire. Il conserve uniquement `storyId` et la révision attendue.

## Révision narrative

Chaque histoire possède une empreinte déterministe calculée à partir de l’identité de l’histoire, du personnage et du triplet `id/role/content` de chaque message.

Les éléments purement UI (réaction, épingle, titre) ne changent pas cette empreinte et ne déclenchent donc pas de post-traitement inutile.

Avant calcul, le handler vérifie que la révision persistée correspond au job. Après les éventuels appels modèle, l’écriture repasse par `storyRepository.mettreAJourSi()`. Si un nouveau tour ou une édition a été sauvegardé entre-temps, le patch ancien est abandonné.

## Pipelines en arrière-plan

Le job `story.postprocess` traite :

- mémoire / directeur / monde / social quand leur cadence de mise à jour est atteinte ;
- lore émergent à chaque nouvelle portion de transcript non encore analysée.

Ces traitements ne bloquent plus le retour de `genererTour()`.

## Synchronisation du tour suivant

L’écran peut encore conserver en mémoire la copie de l’histoire qui existait juste après l’affichage de la réponse, alors que le Kernel a déjà enrichi la sauvegarde en arrière-plan.

Avant chaque nouveau tour, `generateTurn.ts` relit donc la sauvegarde et fusionne uniquement les champs dérivés si le transcript persistant est strictement identique au transcript de l’écran.

Cette fusion concerne :

- mémoire ;
- directeur ;
- monde ;
- social ;
- lore émergent et son curseur.

Aucun message, réglage de scène ou métadonnée utilisateur n’est remplacé par cette synchronisation.

## Régénération

La régénération synchronise d’abord les champs dérivés, puis retire le dernier échange et rembobine les curseurs concernés avant de repasser par le même flux critique. Le nouveau transcript déclenche ensuite son propre job de post-traitement après sauvegarde.

## Reprise après interruption

Au démarrage, le provider parcourt les histoires et remet en file celles dont un pipeline est encore en retard. Cela couvre le cas où l’application a été fermée après la sauvegarde du tour mais avant la fin du post-traitement.

Les jobs laissés `running` par un crash sont eux-mêmes restaurés en `pending` par l’AutomationKernel.

## Invariants

- la réponse du narrateur n’attend jamais mémoire/directeur/monde/social/lore ;
- la sauvegarde du transcript précède toujours le post-traitement ;
- une maintenance automatique ne modifie pas `meta.updatedAt` ;
- un résultat calculé sur une ancienne révision ne peut pas écraser la nouvelle ;
- une lecture de synchronisation défaillante n’empêche pas la narration ;
- le mode concepteur conserve une commande de mise à jour forcée synchrone pour le diagnostic.

## Suite

La prochaine couche pourra déplacer les automatismes visuels (portraits PNJ/joueur et illustrations) vers des jobs dédiés fondés sur le même résolveur de capacités, avec cache, déduplication et diagnostic centralisés.
