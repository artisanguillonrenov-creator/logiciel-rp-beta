# ELYNDOR — V3 ÉTAPE 8 — CONFLITS INTERNES PERSISTANTS

## A — Modifications effectuées

- Ajout de **42 entrées atomiques CONFLIT_INTERNE**, soit exactement **3 par capitale**.
- Chaque conflit précise : acteurs, objectifs des camps, ressources, état actuel, aggravation, apaisement et conséquences possibles pour le joueur.
- Chaque conflit est **lore_level 1 / priorité 28**, non constant, afin d’être récupérable avec la capitale concernée sans devenir un invariant global.
- Katmandou : clarification ciblée de « TENSIONS : aucune » en **« TENSIONS EXTERNES : aucune »** ; sa neutralité internationale reste intacte.
- Aucun bloc de relations diplomatiques entre royaumes n’a été créé : ce périmètre reste réservé à l’étape 9.

## B — Informations déplacées

Aucune. Les conflits complètent les fiches ROYAUME et CULTURE existantes sans les remplacer.

## C — Informations supprimées

Aucune. Une seule formulation a été précisée à Katmandou sans supprimer la neutralité canonique.

## D — Contradictions découvertes

- La fiche Katmandou indiquait « tensions : aucune », alors que la directive Step 8 exige 3 à 5 conflits internes pour chaque royaume. Résolution minimale : la phrase vise désormais explicitement les **tensions externes**, ce qui maintient la neutralité canonique et autorise des désaccords internes non militaires.

## E — Risques

- Le volume du lore augmente de 42 entrées ; l’étape 10 devra sélectionner finement les conflits pertinents.
- Les états décrits ici sont des **états initiaux persistants**. Leur évolution hors écran devra être pilotée ensuite par les moteurs de conséquences, factions et tensions, sans reset automatique.
- Les conflits ne doivent pas tous être injectés à chaque scène d’une capitale : la récupération hybride et le budget de contexte des étapes 10 et 13 devront filtrer.

## F — Tests réalisés

- Base avant migration : **214 entrées**.
- Base après migration : **256 entrées**.
- **42** conflits internes exactement.
- **14** capitales, **3 conflits chacune**.
- Tous les conflits contiennent les 7 champs obligatoires de la directive.
- UID ajoutés : **230 à 271** ; unicité vérifiée ; plage 102–117 toujours réservée.
- Toutes les entrées préexistantes sont inchangées sauf uid 32, avec une modification textuelle strictement contrôlée.
- Taille maximale imposée : **1 500 caractères par conflit**.
- Validation TypeScript et garde-fous structurels exécutés par le workflow avant commit.

### Nouvelles entrées

| UID | Capitale | Conflit | Taille |
|---:|---|---|---:|
| 230 | PARIS | Conseil des Maisons contre Couronne | 742 |
| 231 | PARIS | Culte de la Lumière contre marché servile | 775 |
| 232 | PARIS | Quais de Seine contre fermiers d’impôts | 726 |
| 233 | TOKYO | Castes inférieures contre ordre figé | 773 |
| 234 | TOKYO | Mages Impériaux contre nobles de lignée | 735 |
| 235 | TOKYO | Temple de la Porte Astra contre intérêts marchands | 730 |
| 236 | DELHI | Mérite militaire contre anciennes lignées | 731 |
| 237 | DELHI | Traditionalistes contre tolérance magique d’Olga | 804 |
| 238 | DELHI | Familles de captives contre doctrine de non-rachat | 741 |
| 239 | OSLO | Clans de guerre contre partisans du commerce | 724 |
| 240 | OSLO | Rivalité des clans pour les chantiers navals | 650 |
| 241 | OSLO | Partisans de la guerre prophétisée contre prudentes | 767 |
| 242 | ISTANBUL | Sultan contre Princes Marchands | 687 |
| 243 | ISTANBUL | Monopole du café contre contrebande locale | 698 |
| 244 | ISTANBUL | Justice des contrats contre marché noir | 756 |
| 245 | LAGOS | Reine-Mère contre cercles des Voiles | 746 |
| 246 | LAGOS | Anciennes lignées contre ouverture commerciale | 746 |
| 247 | LAGOS | Surveillance de la Porte contre réseaux clandestins | 767 |
| 248 | JOHANNESBURG | Autorité du Grand Chef contre autonomie des clans | 692 |
| 249 | JOHANNESBURG | Abolition contre réseaux de trafiquants | 804 |
| 250 | JOHANNESBURG | Arbitres publics contre clans fortunés | 768 |
| 251 | MEXICO | Défis pour le titre de Warchief | 713 |
| 252 | MEXICO | Droit d’affranchissement contre propriétaires d’arènes | 747 |
| 253 | MEXICO | Clans rivaux pour les contrats de mercenariat | 634 |
| 254 | NEW_YORK | Meutes contre neutralité de la zone Astra | 764 |
| 255 | NEW_YORK | Alpha des Alphas contre meutes autonomistes | 774 |
| 256 | NEW_YORK | Traqueurs contre passages clandestins des Ombres | 779 |
| 257 | BOGOTA | Gardiens des esprits contre exploitation commerciale | 742 |
| 258 | BOGOTA | Chamanes divisés par le silence des esprits | 738 |
| 259 | BOGOTA | Conservateurs rituels contre usage croissant de la Porte Astra | 714 |
| 260 | SYDNEY | Cour du Chant contre intérêts du port | 708 |
| 261 | SYDNEY | Tradition du chant d’influence contre réformistes | 795 |
| 262 | SYDNEY | Cultes des Profondeurs contre expansion portuaire | 719 |
| 263 | AUCKLAND | Archivistes divisés sur les vérités des Voiles | 789 |
| 264 | AUCKLAND | Ambassade de surface contre isolationnistes des abysses | 755 |
| 265 | AUCKLAND | Gardiens de la Porte Astra contre faction de fermeture | 762 |
| 266 | ZURICH | Clans de forge contre maisons de crédit | 721 |
| 267 | ZURICH | Tradition des dettes héréditaires contre réformateurs | 780 |
| 268 | ZURICH | Maîtres-Forgerons contre innovations runiques risquées | 791 |
| 269 | KATMANDOU | Protection des villages contre non-intervention | 783 |
| 270 | KATMANDOU | Ouverture minimale de la Porte contre retrait des sommets | 789 |
| 271 | KATMANDOU | Jeunes Géantes contre patience des anciennes | 815 |

## G — Décision

**VALIDÉE**

Migration Step 8 : **PASS**. Validation TypeScript : **PASS**. Garde-fous structurels : **PASS**.

## Frontière avec l’étape 9

Aucune relation bilatérale complète entre royaumes n’est structurée ici. Les rivalités et alliances déjà présentes dans le canon ne sont pas développées en blocs diplomatiques ; ce travail reste réservé à l’étape 9.
