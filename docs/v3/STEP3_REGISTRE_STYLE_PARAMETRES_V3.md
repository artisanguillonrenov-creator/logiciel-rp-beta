# ELYNDOR — V3 ÉTAPE 3 — REGISTRE, STYLE ET PARAMÈTRES

## A — Modifications effectuées

- `src/data/elyndorLore.json`
  - UID 0 : présentation générale recentrée sur le canon du monde ; les exemples qui imposaient une intensité permanente ont été retirés de l'entrée toujours active.
  - UID 1 : suppression de la règle « intensité maximale » ; ajout de la hiérarchie profil → paramètres de session → M08 → scène.
  - UID 12, 13 et 101 : passage de `constant: true` à `constant: false` afin que les mœurs/physique adultes ne soient plus injectés dans chaque scène.
  - UID 12, 13, 93 et 101 : retrait des formulations qui ordonnaient directement au narrateur d'intensifier ou de détailler ; conservation du canon culturel/physique.
- `src/data/metamoteurs.json`
  - M08 devient l'autorité explicite du rendu narratif.
  - Ajout de la hiérarchie : profil de contenu > paramètres de session > scène > personnage/culture > faits du lore.
  - Les curseurs sont définis comme plafonds/directions, jamais comme quotas.
- `src/engine/contenuAdulte.ts`
  - l'ancien profil « Adulte Extrême & Underground » est remplacé par un profil Adulte configurable ;
  - le bloc statique adulte autorise des capacités mais n'impose plus le maximum ;
  - l'instruction dynamique décrit les niveaux comme des plafonds ;
  - le canon physique féminin est explicitement classé parmi les entrées non injectables en Grand Public.
- `src/engine/promptBuilder.ts`
  - suppression de la double injection du registre adulte ;
  - regroupement permission de profil + intensité de session dans `[STYLE & FILTRE SYSTEME]` ;
  - ajout d'une règle de précédence explicite : le lore ne relève jamais les curseurs.
- `src/engine/generateTurn.ts`
  - suppression de la seconde injection redondante du bloc Grand Public.

## B — Informations déplacées

- « intensité maximale permanente » : retirée du lore statique.
- instructions sur la façon de décrire : déplacées vers M08 et les paramètres de session.
- faits culturels (mœurs, vêtements, physique) : restent dans le lore, mais deviennent contextuels.
- capacité générale du profil Adulte : reste dans `contenuAdulte.ts`, séparée de l'intensité réelle.

## C — Informations supprimées

- obligation d'intensité maximale permanente ;
- obligation d'intensifier une scène neutre du seul fait qu'Elyndor est adulte/dark ;
- commandes narratives redondantes présentes dans les entrées de mœurs/physique ;
- double injection du filtre Grand Public.

Aucun thème fondamental d'Elyndor n'est supprimé : dark fantasy, violence, sensualité, esclavage, corruption et thèmes adultes restent possibles selon le profil, les réglages et la scène.

## D — Contradictions découvertes

- `contenuAdulte.ts` possédait déjà une fonction dynamique correcte, mais `promptBuilder.ts` injectait encore en parallèle l'ancien bloc statique « ADULTE EXTRÊME », ce qui annulait en pratique une partie de la logique des curseurs.
- plusieurs entrées adultes étaient `constant: true`, ce qui les rendait présentes même dans des scènes sans rapport avec elles.

## E — Risques

- anciennes embeddings/caches locales : une réindexation peut être nécessaire selon la stratégie du store d'embeddings ;
- modèles très faibles : la règle de précédence est désormais explicite dans le prompt pour limiter les interprétations erronées ;
- aucune migration du schéma de sauvegarde n'est effectuée : les valeurs existantes `aucun/faible/modere/eleve` et `faible/modere/eleve/extreme` sont volontairement conservées pour compatibilité.

## F — Tests réalisés

Le job de migration bloque le commit si :

- le lore n'a plus exactement 102 IDs uniques ;
- M08 est absent ou dupliqué ;
- UID 12, 13 ou 101 reste `constant: true` ;
- la formule « intensité maximale » subsiste dans les paramètres d'Elyndor ;
- l'ancien libellé `ADULTE EXTRÊME & UNDERGROUND` subsiste ;
- la règle de précédence des paramètres n'est pas présente dans le prompt.

Validation TypeScript : `npx tsc --noEmit` exécuté avant commit.

## G — Décision

**VALIDÉE** si tous les garde-fous et le contrôle TypeScript passent sur le commit final.

### Critère fonctionnel central

Une scène diplomatique calme ne doit plus être poussée automatiquement vers violence ou sexualisation simplement parce qu'Elyndor est un monde adulte. À l'inverse, une scène sombre réellement déclenchée conserve toute la latitude permise par le profil et les curseurs de la session.
