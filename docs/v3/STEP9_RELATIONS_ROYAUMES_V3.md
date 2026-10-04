# ELYNDOR — V3 ÉTAPE 9 — RELATIONS ENTRE ROYAUMES

## A — Modifications effectuées

- Ajout de **9 entrées atomiques RELATION_ROYAUME**, correspondant uniquement aux relations bilatérales déjà importantes dans le canon existant.
- Chaque bloc contient : intérêt commun, conflit, dépendance, peur, ressource stratégique, dette, ligne rouge, état diplomatique et conséquences narratives.
- Lorsqu'un élément n'était pas établi dans le canon (notamment certaines dettes ou lignes rouges), la fiche le signale explicitement au lieu d'inventer un fait diplomatique.
- Chaque relation est **lore_level 1 / priorité 27**, non constante.
- Aucune nouvelle guerre, alliance, dette historique ou institution diplomatique n'a été créée.

## B — Informations déplacées

Aucune. Les nouvelles entrées structurent des relations déjà présentes dans les fiches ROYAUME et CULTURE sans retirer leur formulation d'origine.

## C — Informations supprimées

Aucune.

## D — Contradictions découvertes

Aucune contradiction critique nouvelle. Certaines relations importantes ne documentaient pas de dette ou de ligne rouge précise ; ces absences restent explicitement marquées comme non établies dans le canon.

## E — Risques

- Ces blocs ajoutent du volume au lore ; l'étape 10 devra sélectionner uniquement la relation pertinente à la scène.
- Un état diplomatique décrit ici ne doit pas évoluer automatiquement sans événement : les étapes ultérieures sur propagation, conséquences et tensions feront évoluer ces relations.
- Les champs non établis ne doivent pas être remplis automatiquement par le narrateur comme s'ils étaient déjà canoniques.

## F — Tests réalisés

- Base avant migration : **256 entrées**.
- Base après migration : **265 entrées**.
- **9** relations bilatérales exactement.
- Les **256 objets préexistants sont inchangés**.
- UID ajoutés : **272 à 280** ; unicité vérifiée ; plage 102–117 toujours réservée.
- Chaque relation contient les 8 champs imposés par la directive + un champ de conséquences narratives.
- Taille maximale imposée : **1 500 caractères** par relation.
- Validation TypeScript et garde-fous structurels exécutés par le workflow avant commit.

### Relations structurées

| UID | Relation | Taille |
|---:|---|---:|
| 272 | PARIS_TOKYO — Paris ↔ Tokyo — Rivalité commerciale et Portes Astra | 992 |
| 273 | TOKYO_DELHI — Tokyo ↔ Delhi — Frontière elfique contestée | 1003 |
| 274 | TOKYO_LAGOS — Tokyo ↔ Lagos — Rancune des Voiles | 1020 |
| 275 | OSLO_ISTANBUL — Oslo ↔ Istanbul — Alliance commerciale | 861 |
| 276 | ISTANBUL_ZURICH — Istanbul ↔ Zurich — Routes montagneuses disputées | 1033 |
| 277 | JOHANNESBURG_BOGOTA — Johannesburg ↔ Bogotá — Respect ancien | 1006 |
| 278 | MEXICO_NEW_YORK — Mexico ↔ New York — Rivalité frontalière | 982 |
| 279 | NEW_YORK_BOGOTA — New York ↔ Bogotá — Alliance instinctive | 966 |
| 280 | SYDNEY_AUCKLAND — Sydney ↔ Auckland — Alliance maritime et rivalité de prestige | 900 |

## G — Décision

**VALIDÉE**

Migration Step 9 : **PASS**. Validation TypeScript : **PASS**. Garde-fous structurels : **PASS**.

## Frontière avec l'étape 10

Aucune modification du moteur de récupération n'est réalisée ici. Les clés, catégories, seuils, scopes et scores hybrides restent réservés à l'étape 10.
