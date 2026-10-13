# Recherche lexicale avancée

Ce document décrit cinq améliorations ajoutées au moteur lexical d'Elyndor. Elles viennent des grands moteurs de recherche (Lucene, Elasticsearch, Meilisearch, Snowball) et ont été intégrées sans changer les règles propres à Elyndor :

- les priorités P0, P1 et P2 ;
- les noms comparés mot pour mot ;
- les homonymes départagés par la ville ;
- la différence entre une fiche citée avec certitude et une fiche seulement évoquée ;
- l'absence de toute coupe silencieuse du canon.

| Amélioration | Où | Effet |
|---|---|---|
| **Racines françaises** | `texteRecherche.racineFrancaise` | Pluriels (chevaux → cheval), féminins (forgeronne → forgeron, princesse → prince), terminaisons verbales (gardait, gardée → gard) et consonne doublée (combattait → combat). Elles servent seulement au classement lexical, jamais à reconnaître un nom propre. |
| **Tolérance aux fautes sur les noms** | `loreLoader.extraireAncresDetaillees({ tolerance })`, `entitesScene` | Un nom mal écrit dans le message du joueur (« Seraphin », « Sylvanna ») retrouve sa fiche canonique en P0, avec la raison « nom proche (faute probable) ». Voir les garde-fous ci-dessous. |
| **Synonymes** | `synonymesLexicaux.ts`, éditeur dans Lorebook → « Synonymes de recherche » | « auberge » trouve la taverne. Un synonyme compte 0,7 fois un mot exact et ne crée jamais d'ancre canonique. Des groupes sont fournis par défaut et l'Atelier permet d'en ajouter (clé `@elyndor/concepteur/synonymes-v1`). |
| **Rareté des mots et BM25** | `loreScoring.statsCorpusLore` (passages du lore), `rechercheLexicale.classerLexical` (mémoire, souvenirs) | Pour le lore, un mot présent dans tout le lore compte peu et un mot rare de la question compte beaucoup (IDF). Pour la mémoire et les souvenirs, la fréquence est saturée et normalisée par la longueur (BM25, k1 = 1,2, b = 0,75) : un mot répété ou un texte très long n'écrase plus un texte court et précis. |
| **Proximité** | `loreScoring` et `classerLexical` | Des mots voisins dans la requête et retrouvés à trois mots ou moins l'un de l'autre dans le texte (« Guilde des Aventuriers ») valent plus que des mots éparpillés. La raison « mots proches » apparaît au diagnostic. |

## Garde-fous de la tolérance aux fautes

Un nom n'est rapproché d'une faute de frappe que si toutes ces conditions sont réunies :

- la fiche n'est pas déjà citée exactement ;
- le nom fait au moins 5 lettres ;
- l'écart est d'au plus 1 lettre jusqu'à 8 lettres, et d'au plus 2 au-delà ;
- la première lettre est la même ;
- au moins un des mots écrits n'existe pas dans le vocabulaire du lore. Ainsi, « porte » n'est jamais pris pour « Porta ».

La tolérance s'applique **uniquement au message du joueur**, pas au texte du narrateur ni à la mémoire. Le diagnostic concepteur indique chaque nom reconnu ainsi (« nom mal écrit reconnu »).

## Mesures

Les mesures viennent de `node .test-dist/tests/mesuresRecuperation.js`, sur 354 passages de lore :

| Étape | Avant | Après |
|---|---|---|
| Sélection du lore | 2 à 3 ms | 5 à 6 ms |
| Blocs de mémoire à 1 200 tours | environ 34 ms | environ 42 ms |
| Résolution des entités, tolérance comprise | — | environ 1 ms |

La légère hausse vient de l'analyse de proximité et des synonymes.

## Ce qui n'a pas été repris

- **L'élargissement automatique de la requête** : trop risqué pour le canon.
- **La fusion par rangs (RRF) entre recherche par mots et recherche par le sens** : utile seulement quand les embeddings sont disponibles.
