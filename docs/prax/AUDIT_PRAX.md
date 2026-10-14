# Audit de Prax et portage « Prax pour Elyndor »

*Octobre 2026 — dépôt audité : <https://github.com/AHartNtkn/Prax>, commit `5e64873` (22 juillet 2026).*

## 1. Ce qu'est Prax

Prax est un **moteur de simulation sociale**. C'est une réimplémentation de
**Versu**, le système de récit interactif de Richard Evans et Emily Short,
construite à partir de **Praxish** (la reconstruction JavaScript, par Max
Kreminski, du langage *Praxis* de Versu). L'auteur de Prax est **ahart
(AHartNtkn)**.

Le principe :

- **Le monde est un ensemble de phrases** en *logique d'exclusion* :
  `practice.world.world.at.bob!square` (le `!` signifie « une seule valeur
  possible », le `.` « plusieurs »).
- **Des pratiques sociales** (saluer, servir au bar, converser, comploter…)
  offrent des **affordances** selon les rôles.
- **Des personnages autonomes** choisissent leurs actions **par utilité**. Ils
  anticipent un tour à l'avance ce que les autres feront, à partir de ce qu'ils
  **croient** de leurs motivations : pas d'omniscience.
- **Des règles de déduction** dérivent des faits (« l'ennemi de mon allié est
  mon ennemi », « qui a vu le vol considère Bob comme un voleur »). Ces faits se
  défont d'eux-mêmes quand leur cause disparaît.

Le dépôt contient deux implémentations complètes :

| Implémentation | Rôle | Taille |
|---|---|---|
| Haskell (`src/`, `test/`) | version d'origine, gelée au tag `haskell-freeze` | ~8 600 lignes + ~10 000 lignes de tests |
| Rust (`rust/`) | réécriture de référence, plus rapide, avec le monde « vampire » | ~48 700 lignes (dont ~980 tests) |

À cela s'ajoutent la documentation de conception (`docs/` : spécifications
v19 à v54, notes de recherche Versu/Praxis/DEON, registre de 2 800 lignes des
fonctionnalités) et un **corpus de conformité** : 3 006 parties
enregistrées, plus des jeux d'essai unitaires.

## 2. Licence et conformité

- Prax est sous **licence BSD à 3 clauses** (déclarée dans `prax.cabal` et
  `rust/Cargo.toml`, auteur « ahart »). Le dépôt n'a pas de fichier de licence
  séparé.
- C'est une licence très permissive. On peut copier, modifier et redistribuer,
  y compris dans une application commerciale, à trois conditions :
  1. garder la notice dans les sources ;
  2. la reproduire dans la documentation d'une version compilée ;
  3. ne pas utiliser le nom de l'auteur pour promouvoir notre produit.
- **Ce que nous avons fait :**
  - la notice complète est dans `src/prax/LICENSE-PRAX.md` (copiée dans `tests/fixtures/prax/`) ;
  - chaque fichier porté indique le fichier d'origine dont il reprend le code ;
  - le README du module rappelle l'origine.
- **À faire avant une diffusion publique de l'APK utilisant Prax :** ajouter la
  notice à l'écran « licences / crédits » de l'application (clause 2).
- Les **références** citées par Prax (l'article Versu, le code Praxish,
  l'article DEON 2010) ne sont pas distribuées par Prax (dossier
  `references/` ignoré par git). Nous ne les avons donc ni copiées ni
  utilisées.

## 3. Inventaire fonctionnel et décisions

Légende : ✅ conservé tel quel · 🔧 conservé et adapté · ⛔ écarté (avec raison).

### 3.1 Cœur logique

| Fonctionnalité (version Prax) | Module d'origine | Notre module | Décision |
|---|---|---|---|
| Base de faits en trie, `!` exclusif corrigé, loi « affirmé » v39 | `db.rs` | `core/db.ts` | 🔧 sans interneur (segments = chaînes), enfants rangés par nom |
| Treillis de la logique d'exclusion (⊓, ≤, ⊥) | `el.rs` | `core/el.ts` | ✅ |
| Langage de requêtes (not, eq, neq, cmp, calc, count, subquery, ∨, ∃, ¬∃, ∀, →) | `query.rs` | `core/query.ts` | ✅ (mémo des sous-requêtes conservé) |
| Déduction en chaînage avant, semi-naïve, correction DIV-1, détection de ⊥ | `derive.rs` | `core/derive.ts` | ✅ + oracle naïf de test |
| Routeur à trois étages de la vue (direct / prolongement / refermeture) | `engine.rs` | `core/perform.ts` | ✅ |
| Pratiques, actions, fonctions, naissance d'instance + `init` | `engine.rs`, `compilepipe.rs` | `core/engine.ts`, `core/compile.ts` | ✅ |
| Horloge du moteur, règles de calendrier, expirations (v44) | `engine.rs`, `schedule.rs` | idem | ✅ (lois de supplantation et de rafraîchissement) |
| Dé dramatique MINSTD exact au bit près (v50) | `rng.rs` | `core/rng.ts` | ✅ |
| Boucle de tours, engagement des PNJ / intentions (v35) | `turn.rs` | `core/turn.ts` | ✅ |

### 3.2 Esprits et planification

| Fonctionnalité | Origine | Notre module | Décision |
|---|---|---|---|
| Planificateur à utilité, profondeur, remises 0,9 / 0,5, ordre d'association exact | `planner.rs` | `core/planner.ts` | ✅ (notes identiques au bit près) |
| Prédiction sur esprits **crus** (v23), portée épistémique, fenêtre de perception | `planner.rs`, `minds.rs`, `sight.rs` | idem | ✅ |
| Réutilisation des prédictions (v34) avec contrôle « réutilisé == vivant » | `planner.rs` | idem | ✅ (`plannerDebug.checkReuse`) |
| Analyse de pertinence (désirs améliorables, « mort maintenant », gabarits porteurs) | `relevance.rs` | `core/relevance.ts` | ✅ |

### 3.3 Vocabulaire social (20 modules)

| Module | Ce qu'il apporte | Décision |
|---|---|---|
| `coreModel` | relations numériques asymétriques avec raison, liens symétriques | ✅ |
| `emotion` | sentiments épisodiques qui s'estompent (durée de vie) | ✅ |
| `beliefs`, `minds` | croyances divergentes, désirs nommés et connaissance commune | ✅ |
| `arc` | arcs intérieurs des personnages | ✅ |
| `reactions` | réactions et normes (violations) | ✅ |
| `conversation` | orateur, sujet, répliques | ✅ |
| `witness`, `rumor`, `repute` | témoins, rumeurs sourcées, réputation dérivée et expiation | ✅ |
| `deceit`, `persona`, `confession` | secrets, mensonges, tempérament, aveu et absolution | ✅ |
| `deontic`, `debt` | obligations (□), devoirs réparateurs (□□), dettes | ✅ |
| `coerce`, `blackmail` | menaces crédibles, chantage | ✅ |
| `faction`, `kin` | appartenance, alliances, parenté, succession | ✅ |
| `project` | entreprises en parties (plans non linéaires) | ✅ |

### 3.4 Auteurs et outillage

| Fonctionnalité | Origine | Notre module | Décision |
|---|---|---|---|
| Couche de scénarisation « Prompter » (scènes, temps forts, jonctions, minuteurs) | `prax-script` | `script/` | ✅ |
| Format JSON des pièces (compatible octet pour octet) | `json.rs` | `script/json.ts` | ✅ (analyseur « premier gagne » maison) |
| Organigramme Mermaid des scènes | `compile.rs` | `script/compile.ts` | ✅ |
| Vérificateur statique (9 contrôles, inférence de sortes) | `typecheck.rs` | `core/typecheck.ts` | ✅ (messages identiques) |
| Inspecteur « pourquoi cette action est indisponible ? » | `inspect.rs` | `core/inspect.ts` | ✅ |
| Tests de résistance (parties aléatoires, couverture, impasses) | `stress.rs` | `core/stress.ts` | ✅ |
| Sauvegarde / reprise | `persist.rs` | `core/persist.ts` | 🔧 même forme JSON, étiquette `prax-ts-state v1` (l'étiquette Rust est acceptée) |
| Joueur en ligne de commande | `prax-cli` | `tools/prax/cli.ts` | 🔧 outil de développement (Node), plus `narrate` et `explain` |
| Comparateur différentiel | `prax-oracle` | `tools/prax/compare.ts`, `conformance.ts` | 🔧 réduit à l'essentiel (comparaison champ à champ) |
| Haskell gelé, porte de gel, méta-garde des étiquettes de tests | `src/`, `scripts/`, `conformance/` | — | ⛔ machinerie propre à la migration Haskell → Rust de l'auteur |
| Oracle Haskell (`oracle/TraceMain.hs`) | `oracle/` | — | ⛔ remplacé par l'oracle Rust, qui a produit nos références |

### 3.5 Mondes de démonstration

| Monde | Ce qu'il montre | Décision |
|---|---|---|
| `bar` (+ `dm`) | salutations, service, normes, obligations, arcs, metteur en scène | ✅ |
| `intrigue` | complot, mort, trahison / loyauté / complicité, romance | ✅ |
| `play` | le même complot écrit comme une pièce en deux actes | ✅ |
| `audience` | croquis de personnage + jonction minutée | ✅ |
| `feud` (+ `bigFeud`) | vendetta émergente par déduction, défaisable | ✅ |
| `village` | témoins, rumeurs, réputation, mensonge, chantage, aveu, faim, marché, travail honnête | ✅ |
| `vampire` | infection, jour/nuit, déguisement, soupçon, deux fins | ✅ (échelles réelle et compressée exposées) |

## 4. Adaptations à Elyndor

1. **TypeScript strict**, aucun import du reste de l'application, **aucune API
   Node** dans `src/prax/` (compatible Hermes / React Native). Seul
   l'outillage (`tools/prax/`) utilise Node.
2. **Pas d'interneur** : les segments sont des chaînes JavaScript, déjà
   internées par le moteur JS. Les enfants du trie sont **rangés par nom**, ce
   qui donne gratuitement l'ordre d'énumération qu'exige le contrat de
   déterminisme.
3. **Déterminisme garanti sur tous les moteurs JS** : tri stable maison
   (on ne dépend pas de la stabilité de `Array.prototype.sort`) et
   comparaisons explicites.
4. **Entiers** : les `i64` vérifiés deviennent des entiers JavaScript « sûrs »
   (jusqu'à 2⁵³), avec la même erreur bruyante en cas de dépassement. Le
   générateur des tests de résistance (64 bits) utilise `BigInt`. Seule
   conséquence visible : un littéral numérique au-delà de 2⁵³ est lu comme un
   symbole, et non comme un nombre (aucun monde n'en utilise).
5. **Erreurs** : `WorldError` avec un `kind` par cas d'origine. Les messages
   sont en français, sauf ceux du vérificateur, gardés en anglais pour rester
   comparables à l'original.
6. **API d'écriture** : fonctions et objets simples (`practice(id, {...})`,
   `action(nom, conditions, effets)`, `want(...)`) plutôt que des
   constructeurs chaînés, avec les **mêmes noms d'identifiants** que Prax.
   Cela garde le lien avec la documentation d'origine.
7. **Divergences d'origine conservées** : Prax corrige délibérément cinq
   défauts du Haskell (DIV-1 à DIV-5). Notre portage hérite de ces
   corrections, puisqu'il suit le Rust.

## 5. Vérification

| Méthode | Ampleur | Résultat |
|---|---|---|
| Rejeu des parties de référence de Prax (oracle d'origine) | 3 006 parties (6 mondes × 501) | **identiques** |
| Parties « localisées » générées avec l'oracle Rust : notes du planificateur au bit près, intentions, identités des actions, journaux du dé et des frontières, vue fermée | 88 + 15 (dont vampire long, village 12 tours, graine de dé alternative) | **identiques** |
| Sorties des outils (`check`, `stress` ×8 mondes, `flow`, `dump-play`) comparées à la CLI Rust | 17 sorties | **identiques au caractère près** |
| Format JSON de `examples/play.json` | encodage + aller-retour | **octet pour octet** |
| Tests de Prax portés (unitaires, spécifications, propriétés) | 929 tests Rust portés sur 1 037 (détail ci-dessous) | **tous verts** |
| Tests propres au portage | marches aléatoires « vue incrémentale = fermeture naïve » dans 9 mondes, relecture stricte des sauvegardes, cas limites du JSON | **tous verts** |

### 5.1 Tests de la réécriture Rust : ce qui est porté

| | Nombre |
|---|---|
| Tests de la réécriture Rust (`#[test]` et cas `proptest!`) | 1 037 |
| Portés, avec leur référence `// R:` (et `// H:` vers la spec Haskell quand elle existe) | **929** |
| Sans objet : identifiants de l'interneur, absent du portage | 2 |
| Machinerie de migration de l'auteur, non portée | 106 |

Les 106 tests non portés vérifient l'outillage de migration Haskell → Rust
et non le moteur :
- portes de gel et de style : registre des divergences, balayage des
  littéraux, méta-garde du tableau des étapes, appels non vérifiés, mot-clé
  `unsafe` (22 tests) ;
- oracle différentiel Haskell ↔ Rust, avec son classificateur, sa matrice,
  son registre et son différenciateur (84 tests).

Chez nous, ce rôle revient au rejeu différentiel contre les parties de
référence, décrit ci-dessus.

Les propriétés aléatoires (`proptest!`) deviennent des boucles déterministes
à graine fixe. Le nombre de cas se règle avec `PRAX_PROPTEST_CASES`.

### 5.2 Corpus et commandes

Le corpus intégré (`tests/fixtures/prax/reference/`, 136 parties compressées,
2,1 Mo) est rejoué par `npm test` (`tests/praxDifferentiel.test.ts`). Le
balayage complet se lance avec `npm run prax:conformance -- --prax <chemin du
dépôt Prax>`.

## 6. Performances

Voir `docs/prax/PERFORMANCES.md`.

## 7. Pistes pour la suite (non faites ici, à la demande)

- **Intégration à l'application** : brancher un `State` Prax par partie, le
  sauvegarder avec `serializeState` (une chaîne pour AsyncStorage) et
  traduire les actions choisies en consignes pour le narrateur.
- **Méta-moteurs d'Elyndor** : plusieurs responsabilités M01–M15 ont un
  équivalent direct dans le vocabulaire de Prax, qui pourrait les rendre
  *calculées* plutôt que seulement *énoncées* au narrateur :
  - M03 (esprit des personnages) : `minds`, le planificateur, `persona` ;
  - M04 (dynamiques sociales) : `coreModel`, `emotion`, `repute` ;
  - M05 (engagements et institutions) : `deontic`, `debt`, `coerce` ;
  - M12 (dynamique de groupe) : `faction`, `kin` ;
  - M15 (circulation de l'information) : `witness`, `rumor`, `deceit`, `beliefs`.
- **Performances mobiles** : Hermes n'a pas de compilation à la volée.
  Mesurer sur appareil et, si besoin, limiter la profondeur ou la portée de
  prédiction.
