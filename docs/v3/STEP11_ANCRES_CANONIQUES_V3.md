# ELYNDOR — V3 ÉTAPE 11 — ANCRES CANONIQUES

## A — Modifications effectuées

- Généralisation de l’ancrage canonique au-delà des seuls royaumes.
- Un nom canonique explicitement cité force désormais la récupération de sa fiche statique, même sous le seuil sémantique/lexical.
- Familles prises en charge : royaumes/villes, souverains et PNJ récurrents, factions, guildes, religions/cultes, Portes Astra nommées, artefacts majeurs et Zones Corrompues majeures.
- Les ancres sont injectées avant les résultats contextuels et ne consomment pas artificiellement le quota des 8 résultats contextuels.
- Suppression de l’ancien plafond de deux ancres.
- Déduplication conservée lorsqu’une fiche ancrée est déjà présente dans la sélection normale.
- Les entrées `[INDEX]` sont explicitement exclues des ancres individuelles.
- Les intitulés génériques présents dans les clés (ex. rôle de guilde) ne sont pas promus en noms propres.

## B — Informations déplacées

Aucune information canonique déplacée. La modification concerne uniquement la logique de récupération.

## C — Informations supprimées

Aucune information de lore supprimée. L’ancien mécanisme limité aux `[ROYAUME]` et à deux ancres maximum est remplacé.

## D — Contradictions découvertes

- Les fiches PNJ atomisées de l’étape 4 peuvent contenir plusieurs préfixes `[PNJ][VILLE]`; l’ancien extracteur de sujet n’aurait retiré qu’un seul préfixe.
- Les index de PNJ contiennent eux aussi des noms propres ; ils doivent rester des aides d’association et ne jamais prendre la place de la fiche individuelle.

## E — Risques

- Un alias trop générique pourrait provoquer une sur-récupération ; l’étape 11 limite donc les alias forcés au sujet canonique du titre et aux clés qui contiennent réellement ce sujet.
- Les catégories encore inexistantes, par exemple une future Porte Astra nommée ou Zone Corrompue nommée, sont supportées par le moteur sans inventer de nouveau lore.

## F — Tests réalisés

- Royaume explicitement nommé malgré sélection vide.
- Séraphine Duvall avec préfixes imbriqués.
- Refus d’un faux ancrage sur rôle générique.
- Plus de deux noms explicitement cités dans une même requête.
- Exclusion des index.
- Support religion / Porte Astra / artefact / Zone Corrompue nommés.
- Déduplication d’une fiche déjà sélectionnée.
- Ordre : ancres → contexte classé → socle.
- `npm test`.
- `npx tsc --noEmit`.
- Garde-fou : `elyndorLore.json` reste inchangé pendant cette étape.

## G — Décision

**EN ATTENTE DES TESTS**
