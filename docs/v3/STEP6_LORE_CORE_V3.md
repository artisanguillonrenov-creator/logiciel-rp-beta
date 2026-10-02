# ELYNDOR — V3 ÉTAPE 6 — LORE CORE COMPACT

## A — Modifications effectuées

- Création de `src/data/loreCore.ts` contenant un **Lore Core canonique compact de 3 800 caractères**.
- Le Core synthétise uniquement les invariants déjà établis : identité d’Elyndor, géographie et territoires raciaux, technologie médiévale, magie, histoire en cinq ères, Réveil des Voiles, Portes Astra, monnaie, vieillissement fondamental, mortalité/consentement joueur, primauté du canon et distinction fait/rumeur.
- `src/engine/promptBuilder.ts` importe directement `LORE_CORE` et l’insère dans l’en-tête du prompt système, avant les blocs récupérés dynamiquement.
- Le Core n’est pas sélectionné par embedding, score sémantique, recherche lexicale, priorité, top-N ou hasard.
- Ajout de `tests/loreCore.test.ts` afin de verrouiller la taille et la présence garantie du Core, y compris avec le budget système local saturé et sans aucune entrée de lore récupérée.

## B — Informations déplacées

Aucune information canonique n’a été déplacée hors de ses entrées d’origine. Le Lore Core est une **projection compacte et garantie** des invariants existants, destinée au prompt système. Les entrées détaillées restent la source canonique complète.

## C — Informations supprimées

Aucune.

## D — Contradictions découvertes

Aucune contradiction canonique nouvelle n’a été introduite ou résolue à cette étape. Le Core reprend les corrections déjà validées aux étapes précédentes, notamment le vieillissement en deux phases et la séparation entre faits canoniques et intensité narrative.

## E — Risques

- Le Lore Core duplique volontairement un petit nombre d’invariants. Toute future modification d’un invariant de niveau 0 devra donc mettre à jour le Core afin d’éviter une divergence.
- Le système de récupération peut encore sélectionner une entrée détaillée déjà résumée dans le Core ; cette redondance éventuelle sera optimisée lors des étapes consacrées à la récupération et au budget de contexte.
- Le reste du prompt peut encore subir une troncature quand le budget est saturé. Le Core est placé avant cette zone dynamique afin de rester garanti ; la réorganisation complète du budget appartient à l’étape 13.

## F — Tests réalisés

Tests automatiques ajoutés :

1. `LORE_CORE.length` doit rester compris entre **2 000 et 4 000 caractères** ; valeur actuelle : **3 800**.
2. Avec `BUDGET_SYSTEM_LOCAL = 12 000` et un contexte secondaire volontairement saturé, le prompt système doit contenir le Lore Core **intégralement**.
3. Avec `loreElyndor = []` et `metamoteursSelectionnes = []`, le Lore Core doit toujours être présent : sa présence ne dépend donc d’aucune récupération.
4. La suite `npm test` doit réussir.
5. `npx tsc --noEmit` doit réussir.

## G — Décision

**VALIDÉE** si l’ensemble des tests automatisés et TypeScript passe sur GitHub Actions.

## Périmètre de l’étape

Cette étape ne modifie ni l’algorithme de récupération du lore, ni les ancres canoniques, ni les métamoteurs, ni le scope. Ces travaux restent réservés aux étapes ultérieures de la directive maître.
