# ELYNDOR — ÉTAPE 1 TERMINÉE : GEL & CARTOGRAPHIE V3

## 1. Référence figée

- Dépôt : `artisanguillonrenov-creator/logiciel-rp-beta`
- Branche source au moment du gel : `claude/new-session-glwy6e`
- Commit figé : `2a3cb1e6c480308578b2908904da429b8df186ea`
- Message du commit : `Bascule en recherche lexicale si les embeddings échouent`
- Branche de sauvegarde créée : `ELYNDOR_PRE_V3_REFERENCE`
- `elyndorLore.json` figé : SHA GitHub `e65e9eabe768da8c99cfe59bfa1b9f8d2459dfea`
- Nombre d'entrées déclaré et vérifié : **102** (`id` 0 à 101).

La branche `ELYNDOR_PRE_V3_REFERENCE` est un instantané du dépôt entier à ce commit. Elle couvre donc également les fichiers de référence exigés par la directive : `metamoteurs.json`, `loreLoader.ts`, `rechercheLexicale.ts`, `generateTurn.ts`, `promptBuilder.ts`, `verificationCanon.ts`, `emergentLore.ts` et `contenuAdulte.ts`.

## 2. Répartition du lore

- **CULTURE** : 4
- **GABARIT** : 7
- **GUILDE** : 4
- **MONDE** : 39
- **MÉCANIQUE** : 7
- **PHYSIQUE** : 1
- **PROFIL** : 1
- **PROFIL RACIAL** : 15
- **ROYAUME** : 14
- **RÉCURRENT** : 7
- **SYSTÈME** : 3

## 3. Statuts d'audit temporaires

- **REWRITE** : 14
- **KEEP** : 61
- **CORRECT** : 13
- **MOVE_TO_ENGINE** : 7
- **SPLIT** : 7

> Ces statuts sont des marqueurs de migration. Ils ne modifient pas le canon. `REWRITE` signifie « réorganiser sans perte d'information », `MOVE_TO_ENGINE` signifie « logique dynamique probablement mieux placée dans les métamoteurs/moteur », et `SPLIT` signifie « découper en unités récupérables ».

## 4. Diagnostic des métadonnées

- `sticky = 0` et `cooldown = 0` sur les entrées examinées.
- Les six entrées marquées `constant: true` sont : **0, 1, 2, 12, 13, 101**.
- Les entrées récurrentes 94 à 100 ont une priorité `30`; l'entrée 37 a `50`; les trois entrées de socle 0/1/2 ont `5/6/7`; la majorité du reste est à `100`.
- `secondary_keys` et `negative_keys` sont vides dans l'ensemble de la cartographie observée ; le signal authored utile repose surtout sur `primary_keys`.
- La colonne « PK repères » ci-dessous condense les alias principaux pour lisibilité. Les tableaux `primary_keys` complets restent intégralement préservés dans la branche figée.

## 5. Inventaire complet des 102 entrées

| ID | Catégorie | Titre | Prio | Constant | Taille approx. | Scope actuel | PK repères | Dépendances principales | Statut | Motif d'audit |
|---:|---|---|---:|:---:|---|---|---|---|---|---|
| 0 | MONDE | Présentation d'Elyndor | 5 | oui | ≈ 2–4 kcar | GLOBAL | Elyndor; monde; univers; dark fantasy | 1,3,8,12,13,101 | REWRITE | Mélange présentation canonique, ton narratif, normes adultes et directives au narrateur. |
| 1 | MONDE | Paramètres d'Elyndor | 6 | oui | ≈ 0,5–1,5 kcar | GLOBAL | paramètres; règles du monde | 40,48; M08/settings | REWRITE | Mélange invariants technologiques/mort/monnaie avec paramètre d'intensité narrative maximale. |
| 2 | MONDE | Le Réveil des Voiles — Conflit Central | 7 | oui | ≈ 0,5–1,5 kcar | GLOBAL | Voiles; fissure; réveil; corruption; menace mondiale | 5,4,8,81,35 | REWRITE | Conflit central solide ; séparer à terme faits du monde et consignes de mise en scène. |
| 3 | MONDE | Géographie et Races | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | continent; région; race; territoire; carte | 19–32,53–67 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 4 | MONDE | Système de Magie | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | magie; sort; mage; rituel; enchantement | 35,81,83 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 5 | MONDE | Histoire d'Elyndor | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | histoire; ère; Guerre des Voiles; origines | 2,8,68,81 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 6 | MONDE | Longévité des Races | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | longévité; espérance de vie; durée de vie | 7,88 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 7 | MONDE | Ratio de Vieillissement | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | apparence; âge apparent; vieillissement | 6,78,88 | CORRECT | Formule âge réel ÷ ratio incompatible avec les seuils d'âge adulte de plusieurs races. |
| 8 | MONDE | Portes Astra | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | Porte Astra; portail; téléportation; réseau Astra | 2,47,98 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 9 | MONDE | Géopolitique Actuelle | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | tension; alliance; rivalité; diplomatie | 19–32,8 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 10 | MONDE | Ordre Public et Milices | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | garde; patrouille; arrestation; milice | 38,36 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 11 | MONDE | Dynamiques Sociales | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | discrimination; statut; classe; société | 37,69; métamoteurs sociaux | REWRITE | Contient faits sociaux canoniques + directives comportementales proches des métamoteurs. |
| 12 | MONDE | Mœurs Vestimentaires Féminines | 100 | oui | ≈ 2–4 kcar | GLOBAL | tenue; vêtement; robe; dénudée | 13,71,93,101 | REWRITE | Norme vestimentaire globale absolue ; chevauche registre, culture et canon physique. |
| 13 | MONDE | Mœurs Sexuelles d'Elyndor | 100 | oui | ≈ 2–4 kcar | GLOBAL | sexe; désir; séduction; intime | 12; M08/settings | REWRITE | Mœurs canoniques + règles de narration/consentement ; chevauche M08 et paramètres de session. |
| 14 | MONDE | Cuisine et Nourriture | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | repas; cuisine; boire; nourriture | 23,28,84,49 | CORRECT | À aligner avec le canon café/ressources commerciales. |
| 15 | MONDE | Médecine et Soins | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | soigner; blessure; guérisseur; maladie | 40,87 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 16 | MONDE | Voyage et Hébergement | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | auberge; route; voyage; cheval | 47,49,8 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 17 | MONDE | Temps, Saisons et Fêtes | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | saison; hiver; été; fête | 16,47,76 | CORRECT | Quatre saisons globales incompatibles avec la géographie terrestre nord/sud. |
| 18 | MONDE | Langues d'Elyndor | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | langue; accent; dialecte; interprète | 53–67 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 19 | ROYAUME | Paris — Royaume Humain | 100 | non | ≈ 1–2 kcar | CITY/REGION | Paris; souverain local; capitale; religion | 33,36,8,99 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 20 | ROYAUME | Tokyo — Empire des Hauts-Elfes | 100 | non | ≈ 1–2 kcar | CITY/REGION | Tokyo; souverain local; capitale; religion | 35,8,99 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 21 | ROYAUME | Delhi — Royaume des Elfes Noirs | 100 | non | ≈ 1–2 kcar | CITY/REGION | Delhi; souverain local; capitale; religion | 35,72,99 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 22 | ROYAUME | Oslo — Confédération des Valkyries | 100 | non | ≈ 1–2 kcar | CITY/REGION | Oslo; souverain local; capitale; religion | 72,99 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 23 | ROYAUME | Istanbul — Les Sultanats | 100 | non | ≈ 1–2 kcar | CITY/REGION | Istanbul; souverain local; capitale; religion | 34,8,99 | CORRECT | Le 'monopole café' doit être harmonisé avec Bogotá et la flore. |
| 24 | ROYAUME | Lagos — Matriarcat des Amazones Sombres | 100 | non | ≈ 1–2 kcar | CITY/REGION | Lagos; souverain local; capitale; religion | 2,81,99 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 25 | ROYAUME | Johannesburg — Confédération des Orques Nobles | 100 | non | ≈ 1–2 kcar | CITY/REGION | Johannesburg; souverain local; capitale; religion | 69,99 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 26 | ROYAUME | Mexico — Territoires Orcs | 100 | non | ≈ 1–2 kcar | CITY/REGION | Mexico; souverain local; capitale; religion | 43,52,100 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 27 | ROYAUME | New York — Territoires des Hommes-Bêtes | 100 | non | ≈ 1–2 kcar | CITY/REGION | New York; souverain local; capitale; religion | 62,100 | CORRECT | Résidu éditorial 'Skrulls... non' + détection du mensonge trop absolue. |
| 28 | ROYAUME | Bogotá — Tribus Primales | 100 | non | ≈ 1–2 kcar | CITY/REGION | Bogotá; souverain local; capitale; religion | 63,81,100 | CORRECT | Production de café des hauteurs à harmoniser avec le monopole d'Istanbul. |
| 29 | ROYAUME | Sydney — Royaume des Sirènes | 100 | non | ≈ 1–2 kcar | CITY/REGION | Sydney; souverain local; capitale; religion | 64,100 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 30 | ROYAUME | Auckland — Royaume des Naga Marines | 100 | non | ≈ 1–2 kcar | CITY/REGION | Auckland; souverain local; capitale; religion | 65,100 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 31 | ROYAUME | Zurich — Royaume des Nains | 100 | non | ≈ 1–2 kcar | CITY/REGION | Zurich; souverain local; capitale; religion | 48,50,100 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 32 | ROYAUME | Katmandou — Territoire des Géantes | 100 | non | ≈ 1–2 kcar | CITY/REGION | Katmandou; souverain local; capitale; religion | 67,100 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 33 | GUILDE | Guilde des Aventuriers | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/FACTION | guilde des aventuriers; rang; mission; contrat | 94,95; Engagements | CORRECT | Référence permanente à Sir William comme unique Légendaire malgré son exclusion annoncée du lore statique. |
| 34 | GUILDE | Guilde des Marchands | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/FACTION | guilde des marchands; commerce; caravane; lettre de crédit | 23,48 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 35 | GUILDE | Ordre des Mages | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/FACTION | ordre des mages; magie régulée; licence; renégat | 4,2 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 36 | GUILDE | Guilde des Ombres | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/FACTION | guilde des ombres; pègre; assassin; marché noir | 10,90 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 37 | SYSTÈME | Esclavage | 50 | non | ≈ 1–2 kcar | GLOBAL/ENGINE-MIX | esclave; esclavage; maître; collier | 52,85,39; moteur social | REWRITE | Mélange légalité de l'esclavage (canon) et axes internes de relation/soumission (moteur). |
| 38 | SYSTÈME | Justice | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/ENGINE-MIX | procès; tribunal; juge; verdict | 10,42 | REWRITE | Mélange institutions juridiques canoniques et protocole de résolution narratif. |
| 39 | SYSTÈME | Captivité — Évolution Temporelle | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/ENGINE-MIX | captivité; longue servitude; s'habitue | 37; moteur social | MOVE_TO_ENGINE | Progression de captivité = logique dynamique de moteur, pas vérité encyclopédique statique. |
| 40 | MÉCANIQUE | Paliers de Blessure — Déclencheurs | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/ENGINE-MIX | blessé; grave; saigne; fracture | 15; moteur conséquences | MOVE_TO_ENGINE | Déclencheurs et transitions de blessures = mécanique d'exécution. |
| 41 | MÉCANIQUE | Règle de Négociation | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/ENGINE-MIX | négocie; marchande; rabais; prix | 34,49,52; moteur PNJ | MOVE_TO_ENGINE | Algorithme de négociation = comportement moteur. |
| 42 | MÉCANIQUE | Protocole de Décès d'un PNJ | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/ENGINE-MIX | mort; décès; funérailles; héritage | 38; continuité | MOVE_TO_ENGINE | Propagation et cascade après décès = moteur de conséquences. |
| 43 | MÉCANIQUE | Échelle des Conflits Armés | 100 | non | ≈ 1–2 kcar | GLOBAL/ENGINE-MIX | bataille; armée; guerre; siège | 9,72,73 | REWRITE | Échelle militaire canonique utile, mais règles de résolution d'une guerre relèvent partiellement du moteur. |
| 44 | MÉCANIQUE | Apprentissage de Compétences | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/ENGINE-MIX | apprendre; entraînement; formation | 73; mémoire progression | REWRITE | Durées/coûts = canon ; règles de progression/ellipse = moteur. |
| 45 | MÉCANIQUE | Conflits PNJ contre PNJ | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/ENGINE-MIX | PNJ s'affrontent; rivaux; duel | 74; moteur personnages | MOVE_TO_ENGINE | Arbitrage PNJ contre PNJ = règle narrative directe. |
| 46 | MÉCANIQUE | Possession et Gestion de Biens | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/ENGINE-MIX | propriété; domaine; boutique; revenus | 48,51; simulation hors écran | REWRITE | Prix/propriété = canon ; évolution hors écran = moteur de simulation. |
| 47 | MONDE | Distances entre Capitales | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | distance; durée du voyage; trajet | 16,8,17 | CORRECT | Durées à vérifier géographiquement ; certaines estimations semblent trop courtes. |
| 48 | MONDE | Monnaie d'Elyndor | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | or; argent; cuivre; monnaie | 49–52,46 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 49 | MONDE | Prix Indicatifs — Vie Quotidienne | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | coût; addition; tarif; prix repas | 48,14,16 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 50 | MONDE | Prix de l'Équipement | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | arme; armure; équipement; réparation | 48,97 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 51 | MONDE | Salaires et Métiers Courants | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | salaire; revenu; métier; travail | 48,33 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 52 | MONDE | Prix des Esclaves par Profil | 100 | non | ≈ 1–2 kcar | GLOBAL | prix esclave; enchères; valeur marchande | 37,85,48 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 53 | PROFIL RACIAL | Humains | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Humains; race; culture; territoire | 3,19 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 54 | PROFIL RACIAL | Hauts-Elfes | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Hauts-Elfes; race; culture; territoire | 3,20,7 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 55 | PROFIL RACIAL | Elfes Noirs | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Elfes Noirs; race; culture; territoire | 3,21,7 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 56 | PROFIL RACIAL | Valkyries | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Valkyries; race; culture; territoire | 3,22,7 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 57 | PROFIL RACIAL | Amazones Nordiques | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Amazones Nordiques; race; culture; territoire | 3,22,7 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 58 | PROFIL RACIAL | Sultanats | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Sultanats; race; culture; territoire | 3,23 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 59 | PROFIL RACIAL | Amazones Sombres | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Amazones Sombres; race; culture; territoire | 3,24,2 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 60 | PROFIL RACIAL | Orques Nobles | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Orques Nobles; race; culture; territoire | 3,25 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 61 | PROFIL RACIAL | Orcs | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Orcs; race; culture; territoire | 3,26 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 62 | PROFIL RACIAL | Hommes-Bêtes | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Hommes-Bêtes; race; culture; territoire | 3,27 | CORRECT | Remplacer 'mensonge se flaire' par lecture de stress/indices physiologiques, sans omniscience. |
| 63 | PROFIL RACIAL | Tribus Primales | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Tribus Primales; race; culture; territoire | 3,28 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 64 | PROFIL RACIAL | Sirènes | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Sirènes; race; culture; territoire | 3,29 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 65 | PROFIL RACIAL | Naga Marines | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Naga Marines; race; culture; territoire | 3,30,7 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 66 | PROFIL RACIAL | Nains | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Nains; race; culture; territoire | 3,31,7 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 67 | PROFIL RACIAL | Géantes | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Géantes; race; culture; territoire | 3,32,7 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 68 | PROFIL | Sang-Mêlé | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/RACE | Sang-Mêlé; race; culture; territoire | 5,69 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 69 | MONDE | Sang-Mêlé — Rapports Raciaux | 100 | non | ≈ 1–2 kcar | GLOBAL | Sang-Mêlé — Rapports Raciaux; race; culture; territoire | 68,19–32 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 70 | GABARIT | Noms par Race | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/TEMPLATE | nom; prénom; nommée | 53–68 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 71 | GABARIT | Variations Physiques par Race | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/TEMPLATE | apparence; silhouette; traits du visage | 53–68,101 | REWRITE | Chevauche fortement les profils raciaux et le canon physique féminin. |
| 72 | GABARIT | Unités Militaires par Capitale | 100 | non | ≈ 1–2 kcar | GLOBAL/TEMPLATE | régiment; unité d'élite; armée | 19–32,73 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 73 | GABARIT | Hiérarchies Militaires | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/TEMPLATE | grade; officier; capitaine; hiérarchie | 72,43,51 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 74 | GABARIT | Réactions à la Douleur | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/TEMPLATE | douleur; encaisse; grimace; souffre | 53–68; archétypes | MOVE_TO_ENGINE | Réaction à la douleur pilotée par archétype/culture = logique de caractérisation moteur. |
| 75 | GABARIT | Affluence par Lieu et Moment | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/TEMPLATE | foule; affluence; bondé; désert | 10,14,16,17 | MOVE_TO_ENGINE | Affluence dynamique selon lieu/heure/météo = générateur de scène plutôt que canon fixe. |
| 76 | GABARIT | Cérémonies Officielles | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/TEMPLATE | cérémonie; mariage; exécution; couronnement | 19–32,79,80 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 77 | CULTURE | Vie Civile des Races | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/CULTURE | civil; artisan; quotidien; petites gens | 53–68 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 78 | CULTURE | Rites de Passage | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/CULTURE | rite de passage; majorité; initiation | 6,7,88,53–67 | CORRECT | Doit être recalé avec le futur système de maturation/vieillissement. |
| 79 | CULTURE | Famille et Transmission | 100 | non | ≈ 1–2 kcar | GLOBAL/CULTURE | famille; mariage; héritage; lignée | 53–68,89 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 80 | CULTURE | Spiritualité Quotidienne | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL/CULTURE | prie; superstition; bénédiction; croyance | 19–32 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 81 | MONDE | Zones Corrompues | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | zone corrompue; corruption; fissure | 2,4,83 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 82 | MONDE | Bestiaire et Dangers Naturels | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | monstre; prédateur; bête sauvage | 81,83 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 83 | MONDE | Créatures Signatures | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | écorcheur; hurleuse; morte-brume; Voiles | 81,35 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 84 | MONDE | Faune et Flore Domestiques | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | cheval; bétail; récolte; ferme | 14,23,28 | CORRECT | Mentionne café monopole des Sultanats : contradiction à résoudre avec Bogotá. |
| 85 | MONDE | Marchés aux Esclaves | 100 | non | ≈ 1–2 kcar | GLOBAL | marché aux esclaves; enchères; vente | 37,52,19–32 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 86 | MONDE | Infrastructure Urbaine | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | rue; égout; fontaine; éclairage | 1,19–32 | CORRECT | Clarifier frontière entre ingénierie médiévale, magie et technologie interdite. |
| 87 | MONDE | Maladies Courantes | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | maladie; fièvre; contagion; épidémie | 15,81 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 88 | MONDE | Enfance et Minorité | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | enfant; orphelin; jeunesse; mineur | 6,7,78,89 | CORRECT | Seuils d'âge adulte liés directement au bug de vieillissement ; à recalculer ensemble. |
| 89 | MONDE | Fertilité et Descendance | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | grossesse; fertilité; naissance; descendance | 79,88,68 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 90 | MONDE | Mythes et Légendes Populaires | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | légende; mythe; folklore; on raconte | 5,8,81 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 91 | MONDE | Éducation et Corporations | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | apprenti; corporation; académie; maître artisan | 44,51 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 92 | MONDE | Jeux et Divertissements | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | pari; jeu; arène; spectacle | 49,36 | KEEP | Aucune anomalie structurelle critique identifiée à l'étape 1 ; conserver pour audit détaillé ultérieur. |
| 93 | MONDE | Mode Masculine | 100 | non | ≈ 0,5–1,5 kcar | GLOBAL | tenue masculine; vêtement homme; torse | 12,101 | REWRITE | Chevauche règles globales d'habillement ; incohérence physique possible 'torse nu même en hiver'. |
| 94 | RÉCURRENT | Maîtresses de Guilde — Toutes Capitales | 30 | non | ≈ 2–4 kcar | CHARACTER (multi-ville) | maîtresse de guilde; guilde de capitale | 33,19–32 | SPLIT | 14 PNJ dans un seul bloc : récupération/troncature défavorables. |
| 95 | RÉCURRENT | Réceptionnistes de Guilde | 30 | non | ≈ 2–4 kcar | CHARACTER (multi-ville) | réceptionniste; guichet; contrats | 33,19–32 | SPLIT | 14 PNJ dans un seul bloc : récupération/troncature défavorables. |
| 96 | RÉCURRENT | Tavernières | 30 | non | ≈ 2–4 kcar | CHARACTER (multi-ville) | tavernière; aubergiste; patronne | 14,19–32 | SPLIT | 14 PNJ dans un seul bloc : récupération/troncature défavorables. |
| 97 | RÉCURRENT | Forgeronnes | 30 | non | ≈ 2–4 kcar | CHARACTER (multi-ville) | forgeronne; forge; armurière; réparation | 50,19–32 | SPLIT | 14 PNJ dans un seul bloc : récupération/troncature défavorables. |
| 98 | RÉCURRENT | Passeuses Astra | 30 | non | ≈ 2–4 kcar | CHARACTER (multi-ville) | passeuse; gardienne du portail; laissez-passer | 8,19–32 | SPLIT | 14 PNJ dans un seul bloc : récupération/troncature défavorables. |
| 99 | RÉCURRENT | Souverains d'Elyndor — Partie 1 | 30 | non | ≈ 2–4 kcar | CHARACTER (multi-ville) | roi; reine; souverain + noms propres | 19–25 | SPLIT | 7 souverains regroupés ; doit devenir des fiches canoniques atomiques. |
| 100 | RÉCURRENT | Souverains d'Elyndor — Partie 2 | 30 | non | ≈ 2–4 kcar | CHARACTER (multi-ville) | warchief; alpha; chamane + noms propres | 26–32 | SPLIT | 7 souverains regroupés ; doit devenir des fiches canoniques atomiques. |
| 101 | PHYSIQUE | Canon Féminin d'Elyndor | 100 | oui | ≈ 1–2 kcar | GLOBAL/STYLE-MIX | silhouette féminine; courbes; corps; formes | 12,71,93,53–67 | REWRITE | Canon physique universel trop dominant ; chevauche apparence raciale, vêtements et registre. |

## 6. Contradictions et risques repérés pendant la cartographie — sans correction

1. **Vieillissement** — l'entrée 7 utilise `âge réel ÷ ratio`, alors que l'entrée 88 fixe des majorités raciales qui rendent cette formule biologiquement incohérente pour plusieurs races.
2. **Registre** — les entrées 0, 1, 12, 13 et 101 poussent des normes de style/intensité directement dans le lore, ce qui chevauche les métamoteurs et les paramètres de session.
3. **Saisons** — l'entrée 17 décrit quatre saisons communes sans gérer l'inversion nord/sud de la Terre réelle.
4. **Café** — Istanbul est décrit comme détenteur d'un monopole, Bogotá comme producteur de café des hauteurs, et l'entrée 84 réaffirme le monopole des Sultanats.
5. **New York** — l'entrée 27 contient un résidu éditorial manifeste (`Skrulls... non`) et transforme l'odorat en quasi-détecteur de vérité.
6. **Sir William** — l'en-tête exclut le personnage du fichier statique, mais la Guilde des Aventuriers le fixe comme unique détenteur vivant du rang Légendaire.
7. **Récurrents** — les entrées 94–100 regroupent plusieurs personnages dans des blocs massifs, défavorables à la récupération et à la troncature.
8. **Mécaniques dans le lore** — plusieurs entrées 39–46 et 74–75 décrivent directement des algorithmes narratifs/dynamiques plutôt que des vérités du monde.
9. **Priorités** — la valeur `100` domine presque tout le fichier, donc le champ de priorité discrimine peu le canon contextuel.

## 7. Fin d'étape — format imposé par la directive

### A — Modifications effectuées
- Création de la branche de sauvegarde `ELYNDOR_PRE_V3_REFERENCE` depuis le commit figé.
- Création du présent inventaire d'audit.
- **Aucune modification du canon ni du code de production.**

### B — Informations déplacées
- Aucune.

### C — Informations supprimées
- Aucune.

### D — Contradictions découvertes
- Vieillissement/majorité.
- Café Istanbul/Bogotá.
- Saisons hémisphériques.
- Résidu New York.
- Statut Sir William.
- Registre et paramètres mélangés au canon.
- Blocs récurrents trop massifs.

### E — Risques
- Modifier directement le lore avant résolution de ces dépendances pourrait créer des contradictions en cascade.
- Les six entrées `constant` mélangent actuellement fondations utiles et contenu qui devrait devenir contextuel.
- Les gros blocs de PNJ risquent d'être sélectionnés puis tronqués avant le personnage réellement recherché.

### F — Tests réalisés
- Branche source et commit vérifiés.
- Branche de sauvegarde créée avec succès.
- `entry_count = 102` vérifié.
- IDs cartographiés de 0 à 101 sans trou dans l'inventaire.
- Catégories, priorités, constantes, dépendances et statuts d'audit cartographiés.

### G — Décision
**VALIDÉE — L'étape 1 peut être considérée terminée.**

La prochaine étape autorisée par la directive est l'**ÉTAPE 2 : correction des contradictions canoniques critiques**, en commençant par le vieillissement des races. Aucune de ces corrections n'a été appliquée dans ce fichier.