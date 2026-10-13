/**
 * Un bac à sable ÉMERGENT : à partir d'UN fait écrit et d'une poignée de
 * règles, une vendetta entière émerge — des gens qui ne se sont jamais
 * rencontrés finissent par en vouloir à quelqu'un par le seul réseau
 * d'alliances — et elle se défait : faire amende honorable dissout l'inimitié.
 *
 * Reprend `prax-worlds/src/feud.rs` (Prax, BSD-3-Clause). L'ordre de
 * construction fait partie du portage (axiomes posés APRÈS la mise en place).
 */
import { State } from '../core/engine';
import { matches, neq, not_ } from '../core/query';
import { Axiom, Character, Practice, action, axiom, character, del, insert, practice, want } from '../core/types';
import { comrades, joins } from '../vocab/faction';
import { kinAxioms } from '../vocab/kin';

/** Vous êtes Alice — celle qui a offensé. */
export const PLAYER_NAME = 'alice';

export function feudAxioms(): Axiom[] {
  return [
    axiom([matches('allied.X.Y')], ['allied.Y.X']),
    axiom([matches('wronged.X.Y')], ['resents.Y.X']),
    axiom([matches('resents.A.B'), matches('allied.A.C')], ['resents.C.B']),
    comrades(),
  ];
}

function societyPractice(): Practice {
  return practice('society', {
    name: 'the company keeps its grudges',
    roles: ['Room'],
    actions: [
      action('[Actor]: shun [Target]', [matches('resents.Actor.Target'), neq('Actor', 'Target'), not_('shunned.Actor.Target')], [insert('shunned.Actor.Target')]),
      action('[Actor]: make amends with [Target]', [matches('wronged.Actor.Target')], [del('wronged.Actor.Target')]),
    ],
  });
}

function grudgeBearer(n: string): Character {
  return character(n, { wants: [want([matches(`shunned.${n}.Target`)], 5)] });
}

function alice(): Character {
  return character(PLAYER_NAME, { wants: [want([matches('shunned.Other.alice')], -10)] });
}

export function feudWorld(): State {
  const st = new State();
  st.definePractices([societyPractice()]);
  st.setCharacters([alice(), grudgeBearer('bob'), grudgeBearer('carol'), grudgeBearer('dave'), grudgeBearer('esme')]);
  for (const o of [
    insert('practice.society.here'),
    insert('wronged.alice.bob'),
    joins('bob', 'kestrel'),
    joins('carol', 'kestrel'),
    joins('dave', 'kestrel'),
    joins('esme', 'wren'),
  ])
    st.performOutcome(o);
  st.setAxioms([...feudAxioms(), ...kinAxioms()]);
  return st;
}

/** Une vendetta à l'échelle : `n` rancuniers en chaîne d'alliances. */
export function bigFeud(n: number): State {
  const names = Array.from({ length: n }, (_, i) => `a${i + 1}`);
  const st = new State();
  st.definePractices([societyPractice()]);
  st.setCharacters([alice(), ...names.map(grudgeBearer)]);
  const setup = [insert('practice.society.here'), insert('wronged.alice.a1')];
  for (let i = 1; i < n; i++) setup.push(insert(`allied.a${i}.a${i + 1}`));
  for (const o of setup) st.performOutcome(o);
  st.setAxioms(feudAxioms());
  return st;
}
