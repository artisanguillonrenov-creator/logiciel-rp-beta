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

Aucune contradiction canonique nouvelle n’a été introduite ou résolue à cette étape.

Une **dette de test antérieure** a été constatée pendant la validation globale : `tests/contentProfile.test.ts` attend encore les anciens libellés `niveau extrême` / `niveau élevé`, alors que le code validé à l’étape 3 produit désormais des libellés de type `plafond extrême` / `plafond élevé`. Le fichier de test possède exactement le même SHA (`661915ad0b13e81cfe7d01f6660491f75f660b6d`) à la fin de l’étape 5 et pendant l’étape 6. Cette anomalie n’est donc pas causée par le Lore Core et n’a pas été corrigée hors périmètre.

## E — Risques

- Le Lore Core duplique volontairement un petit nombre d’invariants. Toute future modification d’un invariant de niveau 0 devra donc mettre à jour le Core afin d’éviter une divergence.
- Le système de récupération peut encore sélectionner une entrée détaillée déjà résumée dans le Core ; cette redondance éventuelle sera optimisée lors des étapes consacrées à la récupération et au budget de contexte.
- Le reste du prompt peut encore subir une troncature quand le budget est saturé. Le Core est placé avant cette zone dynamique afin de rester garanti ; la réorganisation complète du budget appartient à l’étape 13.

## F — Tests réalisés

Résultats observés en CI :

1. **PASS** — `LORE_CORE.length` est compris entre **2 000 et 4 000 caractères** ; valeur actuelle : **3 800**.
2. **PASS** — avec `BUDGET_SYSTEM_LOCAL = 12 000` et un contexte secondaire volontairement saturé, le prompt système contient le Lore Core **intégralement**.
3. **PASS** — avec `loreElyndor = []` et `metamoteursSelectionnes = []`, le Lore Core reste présent : sa présence ne dépend d’aucune récupération.
4. **PASS** — compilation de la suite de tests TypeScript (`tsc -p tsconfig.test.json`) incluant les fichiers modifiés par l’étape 6.
5. **PASS 3/3** — tests dédiés `loreCore.test.ts`.
6. **SUITE GLOBALE : 129/130 PASS** — l’unique échec est la dette de test `contentProfile.test.ts` décrite en section D, déjà présente avant l’étape 6 et sans lien avec les fichiers modifiés ici.

Le contrôle spécifique de l’étape 6 ne révèle donc aucune régression attribuable au Lore Core.

## G — Décision

**VALIDÉE**

Le critère de la directive est satisfait : le Lore Core est compact, contient les invariants essentiels et est injecté comme bloc garanti sans dépendre des embeddings, du classement sémantique, d’un top-N ou du hasard.

## Périmètre de l’étape

Cette étape ne modifie ni l’algorithme de récupération du lore, ni les ancres canoniques, ni les métamoteurs, ni le scope. Ces travaux restent réservés aux étapes ultérieures de la directive maître.
