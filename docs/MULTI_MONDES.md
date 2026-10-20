# Application multi-mondes

Tout ce qui décrit un monde (lore, peuples, lieux, rôles, marque) est lu dans
un **paquet monde**. Elyndor est le premier paquet ; son comportement est
inchangé (prompt figé par `tests/promptElyndorFige.test.ts`).

## Contrat (`src/mondes/types.ts`)

Obligatoires : `id`, `carte` (nom, genre, description, tags, image),
`marque` (titre, logo et fond facultatifs), `synopsis`, `core` (Lore Core,
injecté à chaque tour), `lorebook` (schéma d'`elyndor/lorebook.json`).

Facultatifs : `titreLore` (défaut « LORE <NOM> PERTINENT »),
`consigneScenario` (défaut : consigne générique du moteur, sans capitale),
`nomPourExtractionLore`, `entreesAdulteUniquement`, et les modules :

- `modules.races` : liste, portraits, motifs de détection, traits visuels.
  Sans module : pas de choix de race à la création, aucune race déduite.
- `modules.depart` : `liste` (lieux et situations proposés) ou `libre`
  (lieu et situation saisis). Sans module : départ libre.
- `modules.rolesCanon` : fiches « [RÉCURRENT] » qui fixent un rôle par
  ville. Sans module : ni rôles fixés ni capitales.
- `chapitres` : trame en chapitres (`id`, `titre`, `fiche`, `jalons`,
  `suivant`). Seule la fiche du chapitre en cours (`MondeState.chapitreId`,
  absent = premier) est injectée à chaque tour, avec ses jalons et le titre
  du précédent. L'outil `avancer_chapitre` de la simulation du monde passe
  au suivant immédiat, jamais par saut, et pas avant
  `DELAI_MIN_AVANCEE_CHAPITRE` messages (10) depuis la dernière avancée.
  Une avancée relevée trop tôt est mise en attente et prend effet dès le
  délai écoulé. Régénérer le tour qui a fait avancer le chapitre le ramène
  au chapitre précédent, si l'avancée a été relevée sur ce seul tour ; une
  avancée relevée lors d'une mise à jour groupée est conservée.

Les images sont des accesseurs (`get image() { return require(...) }`) :
Metro les embarque, les tests Node ne les chargent pas. Toutes les images
de tous les paquets s'ajoutent au même paquet d'installation.

## Accès

- `monde.actif()` : paquet du monde actif (interface). Mémorisé dans
  `AppSettings.mondeActif` (réglage de l'appareil, non synchronisé).
- `paquetMonde(mondeIdDe(story.meta))` : paquet du monde d'une histoire
  (moteur). Une histoire sans `mondeId` est d'Elyndor.
- `donneesMonde(id)` : lore chargé (`<mondeId>-<n>`), rôles canon, capitales.

## Parcours

Activation → ChoixMonde (si aucun monde mémorisé) → Demarrage → Creation
(Personnage, Départ, Style, Résumé) → Conversation. La liste « Histoires »
ne montre que le monde actif ; ouvrir une histoire bascule le monde actif
sur le sien. L'Atelier concepteur travaille sur le monde actif, avec une clé
de lorebook par monde (`@elyndor/concepteur/lorebook-v1` reste celle
d'Elyndor).

## Ajouter un monde

1. Créer `src/mondes/<id>/index.ts` (paquet) et `lorebook.json`.
2. L'ajouter à `PAQUETS` dans `src/mondes/index.ts`.
3. Préparer les entrées selon les règles du moteur :
   - titres « Nom propre — descriptif » (le nom avant le tiret long sert
     d'ancre) ;
   - paragraphes autonomes de 600 caractères au plus, séparés par une
     ligne vide, chacun nommant son sujet ;
   - portée `CITY` pour tout lieu nommé, y compris une région ;
   - 6 à 12 clés primaires (les mots que le joueur écrit vraiment) et des
     clés négatives pour les homonymes ;
   - priorité 0-10 invariants, 20-30 canon de scène, 40-50 conséquences,
     60-100 contexte.

Paquets actuels : `elyndor/`, `gardiens-de-la-galaxie/` (space opera des
films, 8 chapitres, départ au Kyln), `cendres-du-monde/` (Les Cendres du Monde,
survie post-apocalyptique sur la Terre réelle en 2046, départ libre, sans
races ni rôles canon) et `monde-test/`.

`src/mondes/monde-test/` est un paquet fictif et jetable qui sert de
modèle minimal et aux tests ; le retirer de `PAQUETS` suffit à le masquer.
