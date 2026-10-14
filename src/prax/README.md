# Prax pour Elyndor

Moteur de **simulation sociale** : portage TypeScript fidèle de
[Prax](https://github.com/AHartNtkn/Prax) (ahart / AHartNtkn, licence
BSD-3-Clause — voir `LICENSE-PRAX.md`). Ce module est **autonome** : il
n'importe rien du reste de l'application et n'utilise aucune API Node, donc il
est compatible avec Hermes et React Native. Le seul branchement existant est un
essai, le « narrateur Prax » (`src/engine/praxNarrateur/`), qui remplace le
modèle IA dans la conversation quand on le choisit dans les Réglages.

- Audit et décisions : `docs/prax/AUDIT_PRAX.md`.
- Performances : `docs/prax/PERFORMANCES.md`.
- Narrateur Prax (test) dans la conversation de l'application : `docs/prax/NARRATEUR_PRAX_TEST.md`.

## Organisation

| Dossier | Contenu |
|---|---|
| `core/` | base de faits (logique d'exclusion), requêtes, déduction, moteur d'actions, calendrier, dé, planificateur, vérificateur, sauvegarde, inspecteur, tests de résistance |
| `vocab/` | les 20 modules du vocabulaire social (relations, émotions, croyances, rumeurs, réputation, mensonge, obligations, dettes, menaces, chantage, factions, parenté, projets…) |
| `script/` | la scénarisation par scènes / temps forts / jonctions, et son format JSON |
| `worlds/` | les mondes de démonstration : bar, dm, intrigue, play, audience, feud, village, vampire |

## Exemple minimal

```ts
import { State, practice, action, character, want, matches, neq, not_, insert, advance, npcAct } from './index';

const st = new State();
st.definePractices([
  practice('salon', {
    roles: ['Lieu'],
    actions: [
      action('[Actor]: saluer [Autre]',
        [matches('ici.Actor'), matches('ici.Autre'), neq('Actor', 'Autre'), not_('salué.Actor.Autre')],
        [insert('salué.Actor.Autre')]),
    ],
  }),
]);
st.setCharacters([
  character('ada', { wants: [want([matches('salué.ada.X')], 2)] }),
  character('bex', { wants: [want([matches('salué.bex.X')], 2)] }),
]);
for (const f of ['practice.salon.ici', 'ici.ada', 'ici.bex']) st.performOutcome(insert(f));

for (let t = 0; t < 4; t++) {
  const acteur = advance(st);              // prochain personnage vivant (+ frontière de tour)
  const fait = npcAct(st, 2, acteur);      // il choisit par utilité, avec anticipation
  console.log(fait?.label ?? `${acteur.name} attend`);
}
// ada: saluer bex
// bex: saluer ada
// ada attend
// bex attend
```

Sauvegarder ou reprendre une partie (une chaîne, idéale pour AsyncStorage) :

```ts
import { serializeState, deserializeState } from './index';
const texte = serializeState(st);
const repris = deserializeState(texte, construireLeMemeMondeVide());
```

## Outils (développement, Node)

```sh
npm run prax -- village            # jouer le village (bar par défaut)
npm run prax -- narrate intrigue 20  # 20 tours sans joueur
npm run prax -- check village      # vérifier un monde
npm run prax -- stress play        # 200 parties aléatoires
npm run prax -- explain village bob steal   # pourquoi une action est (in)disponible
npm run prax:conformance           # rejouer le corpus de référence
npm test                           # toute la suite (dont tests/prax*.test.ts)
```

## Tests

Les tests portés de Prax sont dans `tests/prax*.test.ts`. Chacun porte sa
référence au test Rust d'origine (`// R:`) et, quand elle existe, à la
spécification Haskell (`// H:`). `npm test` les lance tous, sauf les plus
longs, activés par les deux premières variables ci-dessous :

| Variable | Ajoute |
|---|---|
| `PRAX_LONG=1` | les longues trajectoires du village, le réveil v37, la règle de faim et 3 longues parties de référence (plusieurs minutes) |
| `PRAX_REAL_SCALE=1` | le monde vampire à l'échelle réelle |
| `PRAX_PROPTEST_CASES=n` | le nombre de cas des propriétés aléatoires (200 ou 256 par défaut) |
