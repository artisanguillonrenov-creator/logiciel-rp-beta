# ELYNDOR — V3 ÉTAPE 5 — HIÉRARCHIE DU LORE

## A — Modifications effectuées

- Les **200 entrées existantes** ont reçu un champ explicite `lore_level` compris entre 0 et 3.
- Les priorités ont été recalibrées selon la hiérarchie demandée : **0–10 invariants**, **20–30 canon de scène**, **40–50 conséquences**, **60–100 contexte/enrichissement**.
- Aucun contenu canonique, clé de recherche, UID, titre ou drapeau `constant` n’a été modifié.
- Les entrées `constant` existantes restent inchangées ; leur garantie structurelle sera traitée à l’étape 6 avec le Lore Core.

### Répartition

- Niveau 0 : **9** entrées
- Niveau 1 : **123** entrées
- Niveau 2 : **9** entrées
- Niveau 3 : **59** entrées

### Sous-bandes utilisées

- CANON_DE_SCENE : 123
- CONSEQUENCE : 9
- ENRICHISSEMENT_AMBIANCE : 3
- ENRICHISSEMENT_CONTEXTE : 29
- ENRICHISSEMENT_OPTIONNEL : 1
- ENRICHISSEMENT_SOCIAL : 26
- INVARIANT_ABSOLU : 9

## B — Informations déplacées

Aucune information canonique n’a été déplacée entre entrées pendant cette étape. La modification porte uniquement sur la **hiérarchie de sélection future** et la valeur de `priority`.

## C — Informations supprimées

Aucune.

## D — Contradictions découvertes

Aucune contradiction canonique nouvelle n’a été corrigée ici. Le but de l’étape 5 est structurel : distinguer ce qui est fondamental, directement pertinent, conséquentiel ou seulement contextuel.

## E — Risques

- Le moteur actuel n’exploite pas encore `lore_level` directement ; ce champ prépare l’étape 10 de récupération hybride.
- `priority` est déjà consommé par le moteur ; ce recalibrage peut donc modifier l’ordre relatif de certaines entrées à score sémantique comparable, ce qui est précisément l’effet recherché.
- La garantie des invariants n’est pas encore absolue : elle sera sécurisée par le Lore Core à l’étape 6.

## F — Tests réalisés

- 200 entrées avant et après migration ;
- UID uniques ;
- titres uniques ;
- UID 102–117 toujours réservés ;
- contenu canonique inchangé entrée par entrée ;
- `primary_keys`, `secondary_keys`, `negative_keys` inchangées ;
- `constant` inchangé ;
- chaque entrée possède exactement un niveau 0, 1, 2 ou 3 ;
- chaque priorité respecte la bande de son niveau ;
- chaque niveau contient au moins une entrée ;
- validation TypeScript exécutée par le workflow avant commit.

## G — Décision

**VALIDÉE** si les garde-fous ci-dessus et `npx tsc --noEmit` passent.

## Détail des entrées

| UID | Niveau | Priorité avant | Priorité V3 | Catégorie | Titre |
|---:|---:|---:|---:|---|---|
| 0 | 0 | 5 | 5 | MONDE | Présentation d'Elyndor |
| 1 | 0 | 6 | 5 | MONDE | Paramètres d'Elyndor |
| 2 | 0 | 7 | 5 | MONDE | Le Réveil des Voiles — Conflit Central |
| 3 | 0 | 100 | 10 | MONDE | Géographie et Races |
| 4 | 0 | 100 | 10 | MONDE | Système de Magie |
| 5 | 0 | 100 | 10 | MONDE | Histoire d'Elyndor |
| 6 | 0 | 100 | 10 | MONDE | Longévité des Races |
| 7 | 3 | 100 | 70 | MONDE | Ratio de Vieillissement |
| 8 | 0 | 100 | 10 | MONDE | Portes Astra |
| 9 | 3 | 100 | 70 | MONDE | Géopolitique Actuelle |
| 10 | 3 | 100 | 70 | MONDE | Ordre Public et Milices |
| 11 | 3 | 100 | 70 | MONDE | Dynamiques Sociales |
| 12 | 3 | 100 | 70 | MONDE | Mœurs Vestimentaires Féminines |
| 13 | 3 | 100 | 70 | MONDE | Mœurs Sexuelles d'Elyndor |
| 14 | 3 | 100 | 85 | MONDE | Cuisine et Nourriture |
| 15 | 2 | 100 | 45 | MONDE | Médecine et Soins |
| 16 | 2 | 100 | 45 | MONDE | Voyage et Hébergement |
| 17 | 3 | 100 | 85 | MONDE | Temps, Saisons et Fêtes |
| 18 | 3 | 100 | 70 | MONDE | Langues d'Elyndor |
| 19 | 1 | 100 | 25 | ROYAUME | Paris — Royaume Humain |
| 20 | 1 | 100 | 25 | ROYAUME | Tokyo — Empire des Hauts-Elfes |
| 21 | 1 | 100 | 25 | ROYAUME | Delhi — Royaume des Elfes Noirs |
| 22 | 1 | 100 | 25 | ROYAUME | Oslo — Confédération des Valkyries |
| 23 | 1 | 100 | 25 | ROYAUME | Istanbul — Les Sultanats |
| 24 | 1 | 100 | 25 | ROYAUME | Lagos — Matriarcat des Amazones Sombres |
| 25 | 1 | 100 | 25 | ROYAUME | Johannesburg — Confédération des Orques Nobles |
| 26 | 1 | 100 | 25 | ROYAUME | Mexico — Territoires Orcs |
| 27 | 1 | 100 | 25 | ROYAUME | New York — Territoires des Hommes-Bêtes |
| 28 | 1 | 100 | 25 | ROYAUME | Bogotá — Tribus Primales |
| 29 | 1 | 100 | 25 | ROYAUME | Sydney — Royaume des Sirènes |
| 30 | 1 | 100 | 25 | ROYAUME | Auckland — Royaume des Naga Marines |
| 31 | 1 | 100 | 25 | ROYAUME | Zurich — Royaume des Nains |
| 32 | 1 | 100 | 25 | ROYAUME | Katmandou — Territoire des Géantes |
| 33 | 1 | 100 | 30 | GUILDE | Guilde des Aventuriers |
| 34 | 1 | 100 | 30 | GUILDE | Guilde des Marchands |
| 35 | 1 | 100 | 30 | GUILDE | Ordre des Mages |
| 36 | 1 | 100 | 30 | GUILDE | Guilde des Ombres |
| 37 | 3 | 50 | 70 | SYSTÈME | Esclavage |
| 38 | 2 | 100 | 45 | SYSTÈME | Justice |
| 39 | 3 | 100 | 70 | SYSTÈME | Captivité — Évolution Temporelle |
| 40 | 2 | 100 | 45 | MÉCANIQUE | Paliers de Blessure — Déclencheurs |
| 41 | 2 | 100 | 45 | MÉCANIQUE | Règle de Négociation |
| 42 | 3 | 100 | 70 | MÉCANIQUE | Protocole de Décès d'un PNJ |
| 43 | 3 | 100 | 70 | MÉCANIQUE | Échelle des Conflits Armés |
| 44 | 2 | 100 | 45 | MÉCANIQUE | Apprentissage de Compétences |
| 45 | 3 | 100 | 70 | MÉCANIQUE | Conflits PNJ contre PNJ |
| 46 | 3 | 100 | 70 | MÉCANIQUE | Possession et Gestion de Biens |
| 47 | 3 | 100 | 70 | MONDE | Distances entre Capitales |
| 48 | 0 | 100 | 10 | MONDE | Monnaie d'Elyndor |
| 49 | 2 | 100 | 45 | MONDE | Prix Indicatifs — Vie Quotidienne |
| 50 | 2 | 100 | 45 | MONDE | Prix de l'Équipement |
| 51 | 3 | 100 | 70 | MONDE | Salaires et Métiers Courants |
| 52 | 2 | 100 | 45 | MONDE | Prix des Esclaves par Profil |
| 53 | 3 | 100 | 65 | PROFIL RACIAL | Humains |
| 54 | 3 | 100 | 65 | PROFIL RACIAL | Hauts-Elfes |
| 55 | 3 | 100 | 65 | PROFIL RACIAL | Elfes Noirs |
| 56 | 3 | 100 | 65 | PROFIL RACIAL | Valkyries |
| 57 | 3 | 100 | 65 | PROFIL RACIAL | Amazones Nordiques |
| 58 | 3 | 100 | 65 | PROFIL RACIAL | Sultanats |
| 59 | 3 | 100 | 65 | PROFIL RACIAL | Amazones Sombres |
| 60 | 3 | 100 | 65 | PROFIL RACIAL | Orques Nobles |
| 61 | 3 | 100 | 65 | PROFIL RACIAL | Orcs |
| 62 | 3 | 100 | 65 | PROFIL RACIAL | Hommes-Bêtes |
| 63 | 3 | 100 | 65 | PROFIL RACIAL | Tribus Primales |
| 64 | 3 | 100 | 65 | PROFIL RACIAL | Sirènes |
| 65 | 3 | 100 | 65 | PROFIL RACIAL | Naga Marines |
| 66 | 3 | 100 | 65 | PROFIL RACIAL | Nains |
| 67 | 3 | 100 | 65 | PROFIL RACIAL | Géantes |
| 68 | 3 | 100 | 70 | PROFIL | Sang-Mêlé |
| 69 | 3 | 100 | 70 | MONDE | Sang-Mêlé — Rapports Raciaux |
| 70 | 3 | 100 | 65 | GABARIT | Noms par Race |
| 71 | 3 | 100 | 65 | GABARIT | Variations Physiques par Race |
| 72 | 3 | 100 | 65 | GABARIT | Unités Militaires par Capitale |
| 73 | 3 | 100 | 65 | GABARIT | Hiérarchies Militaires |
| 74 | 3 | 100 | 65 | GABARIT | Réactions à la Douleur |
| 75 | 3 | 100 | 65 | GABARIT | Affluence par Lieu et Moment |
| 76 | 3 | 100 | 65 | GABARIT | Cérémonies Officielles |
| 77 | 3 | 100 | 65 | CULTURE | Vie Civile des Races |
| 78 | 3 | 100 | 65 | CULTURE | Rites de Passage |
| 79 | 3 | 100 | 65 | CULTURE | Famille et Transmission |
| 80 | 3 | 100 | 65 | CULTURE | Spiritualité Quotidienne |
| 81 | 3 | 100 | 70 | MONDE | Zones Corrompues |
| 82 | 3 | 100 | 70 | MONDE | Bestiaire et Dangers Naturels |
| 83 | 3 | 100 | 70 | MONDE | Créatures Signatures |
| 84 | 3 | 100 | 70 | MONDE | Faune et Flore Domestiques |
| 85 | 3 | 100 | 70 | MONDE | Marchés aux Esclaves |
| 86 | 3 | 100 | 70 | MONDE | Infrastructure Urbaine |
| 87 | 3 | 100 | 70 | MONDE | Maladies Courantes |
| 88 | 3 | 100 | 70 | MONDE | Enfance et Minorité |
| 89 | 3 | 100 | 70 | MONDE | Fertilité et Descendance |
| 90 | 3 | 100 | 85 | MONDE | Mythes et Légendes Populaires |
| 91 | 3 | 100 | 70 | MONDE | Éducation et Corporations |
| 92 | 3 | 100 | 70 | MONDE | Jeux et Divertissements |
| 93 | 3 | 100 | 70 | MONDE | Mode Masculine |
| 94 | 1 | 30 | 30 | INDEX | [INDEX][RÔLE] Directions des Guildes |
| 95 | 1 | 30 | 30 | INDEX | [INDEX][RÔLE] Réceptionnistes de Guilde |
| 96 | 1 | 30 | 30 | INDEX | [INDEX][RÔLE] Taverniers récurrents |
| 97 | 1 | 30 | 30 | INDEX | [INDEX][RÔLE] Forgerons récurrents |
| 98 | 1 | 30 | 30 | INDEX | [INDEX][RÔLE] Gardiens des Portes Astra |
| 99 | 1 | 30 | 30 | INDEX | [INDEX][RÔLE] Souverains — 1 |
| 100 | 1 | 30 | 30 | INDEX | [INDEX][RÔLE] Souverains — 2 |
| 101 | 3 | 100 | 100 | PHYSIQUE | Canon Féminin d'Elyndor |
| 118 | 1 | 30 | 25 | PNJ | [PNJ][PARIS] Séraphine Duvall — Direction guilde |
| 119 | 1 | 30 | 25 | PNJ | [PNJ][TOKYO] Yui Frostveil — Direction guilde |
| 120 | 1 | 30 | 25 | PNJ | [PNJ][DELHI] Priya Duskblade — Direction guilde |
| 121 | 1 | 30 | 25 | PNJ | [PNJ][OSLO] Sigrid Bearclaw — Direction guilde |
| 122 | 1 | 30 | 25 | PNJ | [PNJ][ISTANBUL] Emre Goldtongue — Direction guilde |
| 123 | 1 | 30 | 25 | PNJ | [PNJ][LAGOS] Zola Nightbloom — Direction guilde |
| 124 | 1 | 30 | 25 | PNJ | [PNJ][JOHANNESBURG] Themba Ironvow — Direction guilde |
| 125 | 1 | 30 | 25 | PNJ | [PNJ][MEXICO] Nahual Skullbreaker — Direction guilde |
| 126 | 1 | 30 | 25 | PNJ | [PNJ][NEW YORK] Marcus Nightprowl — Direction guilde |
| 127 | 1 | 30 | 25 | PNJ | [PNJ][BOGOTÁ] Yamile Windsinger — Direction guilde |
| 128 | 1 | 30 | 25 | PNJ | [PNJ][SYDNEY] Marina Pearltide — Direction guilde |
| 129 | 1 | 30 | 25 | PNJ | [PNJ][AUCKLAND] Kaito Deepcurrent — Direction guilde |
| 130 | 1 | 30 | 25 | PNJ | [PNJ][ZURICH] Bjorn Stonebeard — Direction guilde |
| 131 | 1 | 30 | 25 | PNJ | [PNJ][KATMANDOU] Tenzin Skyreach — Direction guilde |
| 132 | 1 | 30 | 25 | PNJ | [PNJ][PARIS] Margaux Fontaine — Réception |
| 133 | 1 | 30 | 25 | PNJ | [PNJ][TOKYO] Sachi Moonwhisper — Réception |
| 134 | 1 | 30 | 25 | PNJ | [PNJ][DELHI] Ashira Steelsong — Réception |
| 135 | 1 | 30 | 25 | PNJ | [PNJ][OSLO] Freya Stormaxe — Réception |
| 136 | 1 | 30 | 25 | PNJ | [PNJ][ISTANBUL] Leyla Sandwhisper — Réception |
| 137 | 1 | 30 | 25 | PNJ | [PNJ][LAGOS] Adaeze Voidwhisper — Réception |
| 138 | 1 | 30 | 25 | PNJ | [PNJ][JOHANNESBURG] Nomvula Ironsong — Réception |
| 139 | 1 | 30 | 25 | PNJ | [PNJ][MEXICO] Xochitl Bloodclaw — Réception |
| 140 | 1 | 30 | 25 | PNJ | [PNJ][NEW YORK] Jasmine Nightpaw — Réception |
| 141 | 1 | 30 | 25 | PNJ | [PNJ][BOGOTÁ] Amaru Windwalker — Réception |
| 142 | 1 | 30 | 25 | PNJ | [PNJ][SYDNEY] Coralie Tidewhisper — Réception |
| 143 | 1 | 30 | 25 | PNJ | [PNJ][AUCKLAND] Nerezza Deepvoice — Réception |
| 144 | 1 | 30 | 25 | PNJ | [PNJ][ZURICH] Greta Ironquill — Réception |
| 145 | 1 | 30 | 25 | PNJ | [PNJ][KATMANDOU] Pemba Highwind — Réception |
| 146 | 1 | 30 | 25 | PNJ | [PNJ][PARIS] Odette Vinchamps — Taverne |
| 147 | 1 | 30 | 25 | PNJ | [PNJ][TOKYO] Hana Silverleaf — Taverne |
| 148 | 1 | 30 | 25 | PNJ | [PNJ][DELHI] Kavita Ashblade — Taverne |
| 149 | 1 | 30 | 25 | PNJ | [PNJ][OSLO] Astrid Frostbrew — Taverne |
| 150 | 1 | 30 | 25 | PNJ | [PNJ][ISTANBUL] Nazli Spiceheart — Taverne |
| 151 | 1 | 30 | 25 | PNJ | [PNJ][LAGOS] Chidinma Emberlight — Taverne |
| 152 | 1 | 30 | 25 | PNJ | [PNJ][JOHANNESBURG] Busisiwe Warmhearth — Taverne |
| 153 | 1 | 30 | 25 | PNJ | [PNJ][MEXICO] Itzel Fireclaw — Taverne |
| 154 | 1 | 30 | 25 | PNJ | [PNJ][NEW YORK] Raven Duskrunner — Taverne |
| 155 | 1 | 30 | 25 | PNJ | [PNJ][BOGOTÁ] Quilla Earthsong — Taverne |
| 156 | 1 | 30 | 25 | PNJ | [PNJ][SYDNEY] Nerida Saltbreeze — Taverne |
| 157 | 1 | 30 | 25 | PNJ | [PNJ][AUCKLAND] Vashti Coldcurrent — Taverne |
| 158 | 1 | 30 | 25 | PNJ | [PNJ][ZURICH] Helga Stonewarm — Taverne |
| 159 | 1 | 30 | 25 | PNJ | [PNJ][KATMANDOU] Lhamo Windwhisper — Taverne |
| 160 | 1 | 30 | 25 | PNJ | [PNJ][PARIS] Camille Ferrand — Forge |
| 161 | 1 | 30 | 25 | PNJ | [PNJ][TOKYO] Emiko Steelwhisper — Forge |
| 162 | 1 | 30 | 25 | PNJ | [PNJ][DELHI] Ranjana Battleforge — Forge |
| 163 | 1 | 30 | 25 | PNJ | [PNJ][OSLO] Ingrid Frostforge — Forge |
| 164 | 1 | 30 | 25 | PNJ | [PNJ][ISTANBUL] Fatima Goldsmith — Forge |
| 165 | 1 | 30 | 25 | PNJ | [PNJ][LAGOS] Folake Shadowforge — Forge |
| 166 | 1 | 30 | 25 | PNJ | [PNJ][JOHANNESBURG] Lindiwe Ironheart — Forge |
| 167 | 1 | 30 | 25 | PNJ | [PNJ][MEXICO] Citlali Skullforge — Forge |
| 168 | 1 | 30 | 25 | PNJ | [PNJ][NEW YORK] Whitney Clawsmith — Forge |
| 169 | 1 | 30 | 25 | PNJ | [PNJ][BOGOTÁ] Sisa Stoneheart — Forge |
| 170 | 1 | 30 | 25 | PNJ | [PNJ][SYDNEY] Marella Coralforge — Forge |
| 171 | 1 | 30 | 25 | PNJ | [PNJ][AUCKLAND] Sythia Voidforge — Forge |
| 172 | 1 | 30 | 25 | PNJ | [PNJ][ZURICH] Brunhild Deepforge — Forge |
| 173 | 1 | 30 | 25 | PNJ | [PNJ][KATMANDOU] Yangchen Skyhammer — Forge |
| 174 | 1 | 30 | 25 | PNJ | [PNJ][PARIS] Bernadette Portier — Porte Astra |
| 175 | 1 | 30 | 25 | PNJ | [PNJ][TOKYO] Reiko Voidwalker — Porte Astra |
| 176 | 1 | 30 | 25 | PNJ | [PNJ][DELHI] Meera Threadweaver — Porte Astra |
| 177 | 1 | 30 | 25 | PNJ | [PNJ][OSLO] Solveig Frostgate — Porte Astra |
| 178 | 1 | 30 | 25 | PNJ | [PNJ][ISTANBUL] Selin Doorward — Porte Astra |
| 179 | 1 | 30 | 25 | PNJ | [PNJ][LAGOS] Ngozi Voidkeeper — Porte Astra |
| 180 | 1 | 30 | 25 | PNJ | [PNJ][JOHANNESBURG] Palesa Ironward — Porte Astra |
| 181 | 1 | 30 | 25 | PNJ | [PNJ][MEXICO] Malinalli Boneguard — Porte Astra |
| 182 | 1 | 30 | 25 | PNJ | [PNJ][NEW YORK] Sable Nightward — Porte Astra |
| 183 | 1 | 30 | 25 | PNJ | [PNJ][BOGOTÁ] Chaska Spiritgate — Porte Astra |
| 184 | 1 | 30 | 25 | PNJ | [PNJ][SYDNEY] Talise Tidegate — Porte Astra |
| 185 | 1 | 30 | 25 | PNJ | [PNJ][AUCKLAND] Ixora Depthward — Porte Astra |
| 186 | 1 | 30 | 25 | PNJ | [PNJ][ZURICH] Ursula Stoneward — Porte Astra |
| 187 | 1 | 30 | 25 | PNJ | [PNJ][KATMANDOU] Dolma Cloudward — Porte Astra |
| 188 | 1 | 30 | 25 | PNJ | [PNJ][PARIS] Henri Valmonde — Souverain |
| 189 | 1 | 30 | 25 | PNJ | [PNJ][TOKYO] Aelindra Dawnveil — Souverain |
| 190 | 1 | 30 | 25 | PNJ | [PNJ][DELHI] Olga Discordia — Souverain |
| 191 | 1 | 30 | 25 | PNJ | [PNJ][OSLO] Thyra Ironblood — Souverain |
| 192 | 1 | 30 | 25 | PNJ | [PNJ][ISTANBUL] Karim Al-Rashid — Souverain |
| 193 | 1 | 30 | 25 | PNJ | [PNJ][LAGOS] Adanna Umbrathorn — Souverain |
| 194 | 1 | 30 | 25 | PNJ | [PNJ][JOHANNESBURG] Okoro Stoneheart — Souverain |
| 195 | 1 | 30 | 25 | PNJ | [PNJ][MEXICO] Tloc Bloodfang — Souverain |
| 196 | 1 | 30 | 25 | PNJ | [PNJ][NEW YORK] Kira Swiftclaw — Souverain |
| 197 | 1 | 30 | 25 | PNJ | [PNJ][BOGOTÁ] Inti Spiritborn — Souverain |
| 198 | 1 | 30 | 25 | PNJ | [PNJ][SYDNEY] Coral Deepsung — Souverain |
| 199 | 1 | 30 | 25 | PNJ | [PNJ][AUCKLAND] Ssythar Abysswhisper — Souverain |
| 200 | 1 | 30 | 25 | PNJ | [PNJ][ZURICH] Durin Anvilborn — Souverain |
| 201 | 1 | 30 | 25 | PNJ | [PNJ][KATMANDOU] Oya Cloudpeak — Souverain |
| 202 | 1 | 30 | 30 | INDEX | [INDEX][PARIS] PNJ récurrents |
| 203 | 1 | 30 | 30 | INDEX | [INDEX][TOKYO] PNJ récurrents |
| 204 | 1 | 30 | 30 | INDEX | [INDEX][DELHI] PNJ récurrents |
| 205 | 1 | 30 | 30 | INDEX | [INDEX][OSLO] PNJ récurrents |
| 206 | 1 | 30 | 30 | INDEX | [INDEX][ISTANBUL] PNJ récurrents |
| 207 | 1 | 30 | 30 | INDEX | [INDEX][LAGOS] PNJ récurrents |
| 208 | 1 | 30 | 30 | INDEX | [INDEX][JOHANNESBURG] PNJ récurrents |
| 209 | 1 | 30 | 30 | INDEX | [INDEX][MEXICO] PNJ récurrents |
| 210 | 1 | 30 | 30 | INDEX | [INDEX][NEW YORK] PNJ récurrents |
| 211 | 1 | 30 | 30 | INDEX | [INDEX][BOGOTÁ] PNJ récurrents |
| 212 | 1 | 30 | 30 | INDEX | [INDEX][SYDNEY] PNJ récurrents |
| 213 | 1 | 30 | 30 | INDEX | [INDEX][AUCKLAND] PNJ récurrents |
| 214 | 1 | 30 | 30 | INDEX | [INDEX][ZURICH] PNJ récurrents |
| 215 | 1 | 30 | 30 | INDEX | [INDEX][KATMANDOU] PNJ récurrents |

### Entrées actuellement constant=true

- UID 0
- UID 1
- UID 2
