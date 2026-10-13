/**
 * Le modèle de base : les relations (Versu §X). Évaluations numériques,
 * multiples, asymétriques, avec une raison
 * (`A.relationship.B.Role.score!N`, `A.relationship.B.Role.reason!Why`) ; un
 * « lien » public symétrique (`bond.A.B!State` écrit dans les deux sens).
 *
 * L'ORDRE des cas de `coreFns` est observable (premier cas vrai ; le dernier
 * cas est un repli sans garde).
 *
 * Reprend `prax-vocab/src/core_model.rs` (Prax, BSD-3-Clause).
 */
import { Condition, calc, cmp, matches } from '../core/query';
import { Outcome, PraxFunction, call, fn, insert } from '../core/types';

export const WARMTH = 'warmth';
export const RESPECT = 'respect';

/** Ajuste l'évaluation de `b` par `a` sur `role` de `delta` (l'amorce au premier contact). */
export function adjustScore(a: string, b: string, role: string, delta: number, reason: string): Outcome {
  return call('prax_adjustScore', [a, b, role, String(delta), reason]);
}

/** Fixe le lien public symétrique entre `a` et `b`. */
export function setBond(a: string, b: string, st: string): Outcome {
  return call('prax_setBond', [a, b, st]);
}

/** Exige que l'évaluation de `b` par `a` sur `role` soit au moins `n`. */
export function scoreAtLeast(a: string, b: string, role: string, n: number): Condition[] {
  const v = `Score${capitalize(role)}`;
  return [matches(`${a}.relationship.${b}.${role}.score!${v}`), cmp('gte', v, String(n))];
}

function capitalize(s: string): string {
  if (s.length === 0) return '';
  const first = String.fromCodePoint(s.codePointAt(0) as number);
  const up = first.toUpperCase();
  const c = [...up].length === 1 ? up : first;
  return c + s.slice(first.length);
}

/** Les fonctions réutilisables du modèle de base (à enregistrer avec `defineFunctions`). */
export function coreFns(): PraxFunction[] {
  return [
    fn('prax_adjustScore', ['A', 'B', 'Role', 'Delta', 'Reason'], [
      [
        [matches('A.relationship.B.Role.score!N'), calc('M', 'add', 'N', 'Delta')],
        [insert('A.relationship.B.Role.score!M'), insert('A.relationship.B.Role.reason!Reason')],
      ],
      [[], [insert('A.relationship.B.Role.score!Delta'), insert('A.relationship.B.Role.reason!Reason')]],
    ]),
    fn('prax_setBond', ['A', 'B', 'State'], [[[], [insert('bond.A.B!State'), insert('bond.B.A!State')]]]),
  ];
}
