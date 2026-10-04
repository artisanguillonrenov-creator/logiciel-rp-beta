# Elyndor — Réconciliation V3 avec le Kernel narratif V2.1

## Décision architecturale

Les étapes V3 1 à 11 restent valides pour le canon, la granularité du lore, sa hiérarchie, le Lore Core, les cultures, conflits internes, relations diplomatiques, la récupération hybride et les ancres canoniques.

En revanche, toute partie de la directive qui suppose encore que les 15 métamoteurs sont des blocs textuels sélectionnés puis injectés dans le prompt est remplacée par l’architecture native M01–M15 exécutée localement par le Kernel V2.1.

## Recalage de l’étape 12

L’ancien objectif « garantir les métamoteurs sans embeddings » est désormais satisfait de façon plus forte : M01–M15 s’exécutent localement et ne dépendent ni des embeddings, ni du top-N, ni de la recherche lexicale. Le fichier historique `metamoteurs.json` ne doit pas redevenir une dépendance du pipeline narratif actif.

## Recalage des étapes suivantes

- Étape 13 — budget : budgéter le `NarrativeContract` V2.1, le Lore Core, l’état, la mémoire et le lore contextuel ; ne plus réserver un quota à quinze textes de métamoteurs.
- Étape 14 — propagation : M15 reste propriétaire de la circulation de l’information.
- Étape 15 — conséquences : respecter les propriétaires de domaine du Kernel, notamment M14 pour la résolution, M06 pour le physique, M04 pour le social, M05 pour engagements/institutions, M15 pour l’information et M11 pour les fils/rythme.
- Étapes 16 à 19 — monde vivant : alimenter l’état canonique et les propriétaires de domaine sans créer une seconde autorité concurrente.
- Étape 20 — lore émergent : conserver la validation avant promotion canonique.
- Étapes 21 à 25 — validation : tester ensemble V3 et Kernel V2.1.

## Interdiction d’intégration

Ne jamais remplacer `generateTurn.ts`, `promptBuilder.ts` ou le Kernel V2.1 par leurs variantes pré-Kernel provenant de la branche historique V3. Les apports V3 sont réintégrés sélectivement.
