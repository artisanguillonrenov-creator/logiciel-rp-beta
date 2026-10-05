# ELYNDOR — V3 ÉTAPE 12 — KERNEL GARANTI SANS EMBEDDINGS

## A — Modifications effectuées

L'étape 12 de la directive d'origine demandait de garantir un socle de métamoteurs textuels lorsque les embeddings sont indisponibles.

Cette architecture est désormais remplacée par le Narrative Behavior Kernel V2.1 : les responsabilités M01 à M15 sont exécutées localement en TypeScript à chaque tour, avant l'appel au narrateur. Elles ne sont plus récupérées depuis `metamoteurs.json`, ne sont plus classées par similarité et ne dépendent d'aucun fournisseur d'embeddings.

Le prompt reçoit un seul `NarrativeContract` compact produit par le Kernel. Les embeddings restent facultatifs et servent uniquement à améliorer la récupération du lore et de la mémoire.

## B — Informations déplacées

Ancien fonctionnement :

`metamoteurs.json` → embeddings / sélection lexicale → blocs [MÉTA] dans le prompt.

Fonctionnement V3 + Kernel V2.1 :

`StoryState + initiative joueur + limites + état structuré` → M01–M15 locaux → `NarrativeContract` → narrateur.

## C — Informations supprimées

Aucun contenu canonique n'est supprimé.

Le besoin d'injecter un socle textuel de 7 ou 15 métamoteurs est déclaré obsolète dans le pipeline actif. `metamoteurs.json` peut rester comme archive/référence historique, mais il ne doit plus gouverner l'exécution d'un tour.

## D — Contradictions découvertes

La formulation originale de l'étape 12 supposait que les métamoteurs étaient encore des entrées récupérables. Cela contredit l'architecture V2.1 validée, où les 15 responsabilités sont permanentes et locales.

Cette étape est donc satisfaite par recalage architectural, pas par réintroduction des anciens blocs textuels.

## E — Risques

- Réintroduire `metamoteurs.json` dans `generateTurn.ts` recréerait une double autorité entre Kernel et prompt legacy.
- Utiliser les embeddings pour activer/désactiver M01–M15 violerait le principe de règles fondamentales indépendantes des embeddings.
- Tronquer excessivement le `NarrativeContract` retirerait au narrateur des contraintes pourtant calculées correctement par le Kernel.

## F — Tests réalisés / garde-fous

Les tests Kernel V2.1 déjà présents vérifient l'exécution locale de M01–M15, les invariants critiques, les cas transversaux et les six parcours longs A→F.

Le constructeur de prompt est recalé pour transporter le `NarrativeContract` dans une section dédiée `CONTRAT NARRATIF KERNEL V2.1`, sans l'ancienne limite de 620 caractères conçue pour les blocs textuels legacy.

Le fallback lexical du lore reste disponible quand les embeddings sont absents ; il n'a aucun effet sur l'activation du Kernel.

## G — Décision

**VALIDÉE PAR RECALAGE V2.1**

Critère de l'étape 12 : une panne d'embeddings ne doit pas changer le comportement fondamental du moteur narratif. Avec le Kernel V2.1, M01–M15 restent exécutés de la même manière, que la récupération du lore soit sémantique ou lexicale.
