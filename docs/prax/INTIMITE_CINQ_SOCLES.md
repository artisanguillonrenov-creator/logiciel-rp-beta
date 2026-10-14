# Prax-Elyndor : cinq socles natifs de simulation adulte

**Périmètre** : uniquement Prax, pas la bibliothèque universelle sur laquelle travaille Claude Code. Tous les faits et les conséquences sont stockés dans State, les actions s'exécutent par ses pratiques et son planificateur.

## Socles inclus
1. Interactions et consentement : 9 catégories × 6 étapes déjà dans intimacy.ts, avec acceptation indépendante du PNJ, refus et retrait.
2. Catalogue d'actions : 30 catégories supplémentaires × 6 étapes dans intimacyComplete.ts ; libellés techniques d'actions affectives, sensuelles et sexuelles adultes.
3. Physiologie fictive : propriétés biologiques configurées depuis le canon, contraception connue, tirage reproductif déterministe par le dé Prax avec identifiant d'événement pour empêcher les répétitions, étapes de grossesse liées au calendrier du monde.
4. Psychologie / sociétés : 20 approches sociales × 3 réponses, goûts, limites, orientation, intérêt romantique, effets sur les scores relationnels natifs, discrétion et témoins factuellement attestés.
5. Narration factuelle : libellés narratifs sobres validés contre les faits de Prax, reconnaissance française préliminaire qui ne déclenche aucune action.

## Installation
- Importer installCompleteAdultWorld depuis src/prax/vocab/intimacyComplete.
- Appeler la fonction dans la construction du monde Prax préexistant (avant le déroulement des actions).
- Employer verifyAdult (intimacy.ts) uniquement sur des âges établis par le lore ; appeler placeAdult pour la position.
- Les PNJ choisissent via le planificateur du State ; NE JAMAIS leur attribuer automatiquement la réponse déduite de la phrase du joueur.
- Toutes les préférences/traits sont à configurer depuis les personnages et leur expérience, pas imposées par le narrateur.

## Limitations et sécurité d'intégration
- Le rapport oral, vaginal ou anal est représenté comme **type technique**, sans production de prose pornographique graphique.
- Les chiffres de reproduction sont fictifs et ne constituent aucune estimation médicale.
- La fonction resolveFictionalConception suppose qu'un événement vaginal unique a réellement eu lieu ; son identifiant doit être attribué par l'orchestrateur du monde de confiance et lié à une vraie session.
- Comme pour intimacy.ts, si un autre système modifie directement la position, les restrictions ou les faits Prax, il devra appeler invalidateAllAdultAgreements ; à terme centraliser l'invalidation à la frontière du noyau.
- La narration ne doit jamais inventer une acceptation, une grossesse ou un témoin.
- Le parsing par mots-clés n'est pas une compréhension exhaustive de la langue française : résultat consultatif uniquement.
- Les actions sociales ne garantissent pas une romance ni une acceptation.
- Le catalogue n'est pas une description de toutes les sexualités humaines ; l'architecture permet l'extension.
- Tests GitHub et performances Hermes sont obligatoires avant fusion.

## Attribution et réutilisation
Code original sous MIT. Aucune copie de code de Lilith's Throne (licence restrictive), AIF (GPL), Sexbound (GPL) ou LifePlay (AGPL).
Concepts examinés : Prax BSD-3, Heartmorrow Unlicense, BRING Apache-2.
