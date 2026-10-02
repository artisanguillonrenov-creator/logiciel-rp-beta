# ELYNDOR — V3 ÉTAPE 4 — RESTRUCTURATION DES ENTRÉES DE LORE

## A — Modifications effectuées

- Les anciennes entrées groupées UID 94 à 100 ont été conservées comme **index de rôle compacts** au lieu de blocs encyclopédiques.
- Création de **84 fiches PNJ atomiques** : 14 capitales × 6 fonctions récurrentes (direction de guilde, réception, taverne, forge, Porte Astra, souverain).
- Création de **14 index de capitale** `[INDEX][VILLE] PNJ récurrents`.
- `entry_count` passe de **102 à 200** sans ajouter de nouveau personnage canonique : les 98 nouvelles entrées sont uniquement la décomposition/indexation des informations déjà présentes.
- Les UID 102 à 117 restent volontairement libres/réservés conformément à l’historique du projet ; les nouvelles fiches commencent à 118.

## B — Informations déplacées

- UID 94 `Maîtresses de Guilde — Toutes Capitales` → index de rôle + 14 fiches individuelles.
- UID 95 `Réceptionnistes de Guilde` → index de rôle + 14 fiches individuelles.
- UID 96 `Tavernières` → index de rôle + 14 fiches individuelles.
- UID 97 `Forgeronnes` → index de rôle + 14 fiches individuelles.
- UID 98 `Passeuses Astra` → index de rôle + 14 fiches individuelles.
- UID 99–100 `Souverains d'Elyndor` → deux index compacts + 14 fiches individuelles.
- Chaque capitale reçoit en plus un index transversal qui relie ses six figures récurrentes.

## C — Informations supprimées

Aucune identité, nom, ville ou description canonique de PNJ n’a été supprimé.

La seule information retirée des anciens blocs est la répétition structurelle qui obligeait à charger 14 personnages lorsqu’un seul était pertinent. Les règles communes de chaque rôle ont été reportées dans chaque fiche concernée et dans les index.

## D — Contradictions découvertes

Aucune nouvelle contradiction canonique bloquante détectée pendant cette étape. La structure précédente était principalement un problème de granularité de récupération.

## E — Risques

- Le nombre d’entrées passe à 200 : tant que l’étape 10 de récupération hybride n’est pas appliquée, le moteur peut encore sélectionner trop d’éléments contextuels. Cette étape améliore la précision des unités, elle ne modifie volontairement pas encore l’algorithme de top-N.
- Le cache d’embeddings utilise un hash de contenu par ID et recalcule les entrées nouvelles ou modifiées ; aucune purge globale n’est requise par cette migration.
- Les index sont volontairement compacts ; ils servent d’association, pas de remplacement des fiches individuelles.

## F — Tests réalisés

Garde-fous exécutés avant écriture/commit :

- 102 entrées et UID uniques avant migration ;
- présence des UID source 94 à 100 ;
- exactement 14 capitales extraites pour chacun des 6 rôles ;
- exactement 84 fiches PNJ créées ;
- exactement 14 index de capitale créés ;
- 200 entrées finales ;
- aucun UID dupliqué ;
- aucun titre dupliqué ;
- UID 102–117 toujours libres ;
- chaque fiche PNJ contient nom, lieu, fonction, race, personnalité/attitude, relations, rôle narratif et éléments stables ;
- chaque fiche PNJ ≤ 1 200 caractères ;
- chaque index de capitale ≤ 800 caractères ;
- chaque index de rôle ≤ 1 200 caractères.

Validation TypeScript : `npx tsc --noEmit` exécuté par le workflow avant commit.

## G — Décision

**VALIDÉE** si tous les garde-fous et le contrôle TypeScript passent sur le commit final.

### Critère fonctionnel central

Une requête concernant un PNJ récurrent ne dépend plus d’un bloc contenant les 13 autres capitales : chaque personnage dispose désormais de sa propre unité récupérable, tandis que les index conservent les associations de rôle et de ville.
