# Assets générés — campagne Elyndor

## Direction retenue

Cette série reprend la grammaire visuelle des portraits déjà présents dans `assets/portraits` : cadrage vertical, personnage en buste, arrière-plan sombre, lumière cinématique et distinction claire entre les races. Les nouveaux concepts ajoutent une cohérence de campagne grâce au même mélange de bleu nuit, or vieilli et braise rouge.

Les portraits restent volontairement séparés des portraits de sélection de race existants. Ils servent de références de personnages nommés, de visuels de chronique, de communication et de tests de fiches de store. Les assets d’origine n’ont pas été remplacés.

## Personnages

| Fichier | Rôle narratif proposé | Usage |
|---|---|---|
| `assets/portraits/elyndor/character-elfe-noire-serment.png` | Elfe noire, gardienne d’un serment | Carte de relation, personnage allié ou rival |
| `assets/portraits/elyndor/character-orque-noble-dette.png` | Orque noble, porteur d’une dette ancienne | Faction, dette, scène de négociation |
| `assets/portraits/elyndor/character-naga-marine-veilleuse.png` | Naga marine, veilleuse des marées | Mystère, territoire, mémoire ancienne |
| `assets/portraits/elyndor/character-humain-garde-dechu.png` | Garde humain déchu | Prologue, conflit politique, choix moral |

## Scène intégrée

`assets/scenes/cour-des-serments.png` est maintenant le visuel du monde Elyndor dans `src/data/mondes.ts`. La scène montre trois portes scellées, une ville nocturne et une fissure rouge sur le sceau central. Elle est plus directement liée à la promesse « chaque choix laisse une trace » que l’ancien visuel de création générique.

Les dimensions sont volontairement verticales pour correspondre au parcours mobile. Une compression WebP ou une variante allégée pourra être ajoutée plus tard si la taille du bundle mobile devient problématique ; la version PNG actuelle privilégie la qualité de référence.

## Concepts de store et d’onboarding

Les autres images restent dans `art-direction-concepts` afin de ne pas les confondre avec les assets intégrés au parcours principal :

- `elyndor-icon-concept.png` : exploration d’icône.
- `elyndor-store-hero.png` : exploration de visuel hero.
- `elyndor-first-choice.png` : exploration d’écran de premier choix.
- `scene-cour-des-serments.png` : source de la scène intégrée.

## Règle de cohérence pour les prochaines générations

Pour chaque nouvelle race ou personnage, conserver le cadrage en buste, une lumière bleue froide venant du contour, un éclairage chaud très limité, un fond sombre lisible et un détail narratif unique : sceau, cicatrice, dette, clef, lettre, relique ou marque. Éviter les arrière-plans trop lumineux, le texte dans l’image et l’accumulation de symboles.
