# Elyndor — UI V2 cinématique

Référence de production pour l'interface validée.

## Intention

Elyndor doit se lire comme un **RPG narratif premium** et non comme un chatbot décoré. L'illustration porte l'immersion ; l'interface guide sans prendre le dessus.

Principes :

- une zone spectaculaire maximum par écran ;
- hiérarchie immédiate : action principale, contenu, actions secondaires ;
- or = monde / décision / progression ;
- bleu arcane = IA / magie / focus / sélection technique ;
- narration sans grosses bulles de messagerie ;
- portraits PNJ uniquement quand ils servent la scène ;
- éléments techniques et concepteur hors du parcours principal ;
- cibles tactiles >= 48dp ;
- mêmes proportions et mêmes couleurs sur mobile, tablette et web.

## Palette

| Rôle | Valeur |
| --- | --- |
| Bleu-noir principal | `#07111C` |
| Profondeur | `#040A12` |
| Or narratif | `#D8B36B` |
| Or clair | `#F0D89E` |
| Bleu arcane | `#4EAEF8` |
| Bleu clair | `#86D0FF` |
| Texte ivoire | `#E9E3D5` |
| Texte secondaire | `#9CA8B4` |
| Danger | `#E3707D` |

## Typographies

- **Cinzel** : marque, grands titres, écran d'entrée.
- **Cormorant Garamond** : lecture narrative, noms, interface éditoriale.
- petites capitales espacées : labels et métadonnées uniquement.

## Écran d'accueil

Ordre visuel :

1. illustration plein écran ;
2. marque ELYNDOR + slogan ;
3. carte `Continuer l'aventure` si une histoire existe ;
4. `Nouvelle histoire` ;
5. `Charger une histoire` ;
6. Paramètres / Guide / Monde d'Elyndor en actions secondaires.

L'écran ne doit jamais ressembler à un menu de réglages.

## Création

La création conserve le moteur existant et ses cinq étapes, mais présente les choix comme une expérience visuelle :

- progression fine en haut ;
- portrait / illustration dominant ;
- race, lieu et situation présentés visuellement ;
- champs libres secondaires ;
- bouton `Suivant` doré ;
- génération IA indiquée en bleu arcane ;
- réglages narratifs avancés visuellement subordonnés au profil principal.

Sur tablette, objectif : illustration/portrait ~40 % de l'espace, contrôles ~60 %.

## Conversation

La conversation est un **lecteur narratif interactif**.

- prose narrateur : fond transparent ou presque transparent ;
- joueur : panneau bleu-noir discret ;
- PNJ nommé : portrait 42–48dp + nom doré + dialogue ;
- changement de scène : titre de lieu/période séparé visuellement ;
- illustration générée : intégrée au fil du récit et non présentée comme un panneau technique ;
- actions secondaires regroupées derrière `Actions du récit` ;
- saisie toujours accessible en bas.

## Mouvement

- transitions : 180–240 ms ;
- fond atmosphérique très lent ;
- aucun effet néon permanent ;
- option réduction des animations à conserver dans la roadmap.

## Interdits visuels

- accumulation d'emojis système comme iconographie principale ;
- cartes SaaS rondes et claires ;
- dégradés cyberpunk / néon ;
- dizaines d'actions visibles simultanément ;
- décor qui nuit à la lecture ;
- texte technique dans le parcours joueur normal.

## Compatibilité

Le redesign ne doit pas modifier :

- règles immuables ;
- mémoire ;
- lore ;
- métamoteurs ;
- génération/validation du tour ;
- sauvegardes ;
- fournisseurs LLM ;
- filtres de contenu.

L'interface change la **présentation**, jamais l'autorité du moteur narratif.
