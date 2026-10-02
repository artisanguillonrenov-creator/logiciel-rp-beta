# ELYNDOR — V3 ÉTAPE 7 — CULTURES RÉELLEMENT DISTINCTES

## A — Modifications effectuées

- Ajout de **14 entrées CULTURE**, une pour chacune des capitales canoniques : Paris, Tokyo, Delhi, Oslo, Istanbul, Lagos, Johannesburg, Mexico, New York, Bogotá, Sydney, Auckland, Zurich et Katmandou.
- Chaque entrée contient quatre blocs obligatoires : **Identité**, **Normes sociales**, **Vie quotidienne**, **Tensions culturelles**.
- Les sous-thèmes de la directive sont explicitement couverts : valeurs dominantes, pouvoir, étrangers, magie, guildes, pudeur, couple/mariage/sexualité au sens culturel non graphique, statut, esclavage, crime, religion, nourriture, vêtements, architecture, loisirs, rythme de vie, tensions internes/externes et courants rivaux.
- Les nouvelles entrées sont classées **lore_level 1 / priorité 25** : canon de scène directement pertinent lorsque la capitale est active.
- Les 200 entrées préexistantes ont été conservées bit-à-bit au niveau des objets JSON ; aucune fiche Royaume, PNJ, mécanique ou métamoteur n’a été réécrite.

## B — Informations déplacées

Aucune information existante n’a été déplacée. Les nouvelles entrées consolident et complètent les faits déjà présents dans les fiches Royaume, les profils raciaux et les entrées culturelles globales. Les fiches Royaume restent la source politique et géographique ; les fiches CULTURE deviennent la source locale pour le comportement social quotidien.

## C — Informations supprimées

Aucune.

## D — Contradictions découvertes

Aucune contradiction critique nouvelle n’a été détectée lors de la migration. Le traitement de l’esclavage suit les situations déjà établies lorsque le canon existait (marchés légaux, marchés gris ou interdiction) ; Auckland reçoit uniquement une règle culturelle minimale afin de combler l’absence de norme locale explicite sans créer de marché ou d’institution supplémentaire.

## E — Risques

- Les fiches CULTURE ajoutent du volume au lore. Leur sélection fine dépendra de l’étape 10 (récupération hybride) et du budget de contexte de l’étape 13.
- Les tensions de cette étape restent volontairement **culturelles et générales**. Elles ne doivent pas être interprétées comme les conflits persistants complets de l’étape 8.
- Les règles globales (famille, rites, spiritualité, cuisine, esclavage) continuent d’exister ; en cas de scène locale, la fiche CULTURE précise la variante sans annuler un invariant mondial.

## F — Tests réalisés

- Base avant migration : **200 entrées**.
- Base après migration : **214 entrées**.
- Exactement **14** nouvelles entrées CULTURE.
- Les 200 objets préexistants sont inchangés.
- UID uniques ; plage 102–117 toujours réservée.
- Chaque nouvelle entrée : niveau 1, priorité 25, non constante.
- Chaque nouvelle entrée contient les quatre blocs et les champs culturels exigés par la directive.
- Taille maximale imposée à **1 900 caractères** par fiche afin d’éviter de recréer de gros blocs encyclopédiques.
- `npx tsc --noEmit` : **PASS**.
- Garde-fous structurels Step 7 : **PASS**.
- Commit/push fonctionnel : **PASS** (`bbd032a5f59c1b0596cb4e2a2491dab64b2f27c4`).

### Nouvelles entrées

| UID | Capitale | Taille | Niveau | Priorité |
|---:|---|---:|---:|---:|
| 216 | Paris | 1686 | 1 | 25 |
| 217 | Tokyo | 1545 | 1 | 25 |
| 218 | Delhi | 1620 | 1 | 25 |
| 219 | Oslo | 1547 | 1 | 25 |
| 220 | Istanbul | 1602 | 1 | 25 |
| 221 | Lagos | 1634 | 1 | 25 |
| 222 | Johannesburg | 1561 | 1 | 25 |
| 223 | Mexico | 1544 | 1 | 25 |
| 224 | New York | 1616 | 1 | 25 |
| 225 | Bogotá | 1716 | 1 | 25 |
| 226 | Sydney | 1677 | 1 | 25 |
| 227 | Auckland | 1705 | 1 | 25 |
| 228 | Zurich | 1642 | 1 | 25 |
| 229 | Katmandou | 1780 | 1 | 25 |

## G — Décision

**VALIDÉE**

L’étape 7 satisfait la directive : les 14 capitales disposent désormais de variantes culturelles locales explicites sans que les règles globales les rendent interchangeables. La migration, TypeScript, les garde-fous structurels et le commit ont tous réussi.

## Frontière avec l’étape 8

Cette étape ne crée pas encore 3 à 5 conflits internes persistants avec acteurs, ressources, état, escalade, apaisement et conséquences joueur. Elle se limite aux différences culturelles et aux lignes de tension nécessaires pour rendre les capitales non interchangeables.
