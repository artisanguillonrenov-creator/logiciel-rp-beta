# ELYNDOR — V3 ÉTAPE 10 — RÉCUPÉRATION HYBRIDE DU LORE

## A — Modifications effectuées

- Conservation et exploitation effective de `primary_keys`, `secondary_keys`, `negative_keys`, priorité, catégorie et scope.
- Ajout d'un `scope` à chaque entrée statique avec les valeurs : GLOBAL, CONTINENT, REGION, CITY, FACTION, CHARACTER, SCENE.
- Ajout d'un score hybride partagé entre le mode embeddings et le fallback lexical.
- Ajout d'un seuil minimum : une entrée sous le seuil n'est pas injectée.
- Suppression du comportement « top 18 automatique » : maximum **8 entrées contextuelles**.
- Aucun plancher artificiel : si seulement 3 entrées passent le seuil, seules ces 3 entrées sont injectées.
- Lore Core conservé en plus des entrées contextuelles, y compris en fallback lexical.
- Les ancres canoniques existantes ne sont pas généralisées ici : cette généralisation reste réservée à l'étape 11.

## B — Informations déplacées

Aucune information canonique déplacée. Les métadonnées existantes sont désormais transportées jusqu'au moteur de score au lieu d'être perdues au chargement.

## C — Informations supprimées

Aucune information de lore supprimée. Seul le mécanisme de sélection « prendre jusqu'aux 18 meilleurs résultats sans seuil commun » est remplacé.

## D — Contradictions découvertes

- Un ancien test du registre Adulte attendait encore le vocabulaire « niveau » alors que le moteur validé utilise désormais « plafond » ; assertion mise à jour sans modifier le comportement du moteur.

- Le chemin embeddings et le fallback lexical utilisaient deux logiques et deux plafonds différents.
- Les clés positives existaient dans le JSON mais n'étaient plus utilisées par le moteur sémantique.
- Le fallback lexical ne garantissait pas le Lore Core.

## E — Risques

- Un seuil trop élevé pourrait sous-récupérer certaines scènes très implicites ; les poids sont centralisés dans `loreScoring.ts` pour être ajustables sans toucher au canon.
- Les scopes ajoutés sont des métadonnées de récupération, pas de nouveaux faits narratifs.
- L'étape 11 devra compléter ce système par des ancres canoniques explicites pour les noms propres importants.

## F — Tests réalisés

- Tests unitaires du score hybride, clés positives/négatives, scope, seuil, plafond à 8 et Lore Core.
- `npm test`.
- `npx tsc --noEmit`.
- Garde-fou : 265 entrées avant/après ; contenu canonique inchangé hors ajout du champ scope et du journal de correction.
- Garde-fou : chaque scope appartient à la liste autorisée.
- Garde-fou : plage UID 102–117 toujours libre.

## G — Décision

**VALIDÉE**

Migration Step 10 : **PASS**. Tests unitaires : **PASS**. Validation TypeScript : **PASS**. Garde-fous structurels : **PASS**.
