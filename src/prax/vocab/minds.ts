/**
 * Les esprits comme objets de croyance — la surface de bibliothèque : une
 * envie instanciée pour son propriétaire, les envies propres d'un personnage,
 * et les axiomes de connaissance commune (`professed`, `conventional`).
 *
 * Reprend `prax-vocab/src/minds.rs` (Prax, BSD-3-Clause).
 */
import { matches } from '../core/query';
import { Axiom, Character, Desire, Want, axiom, renameVars, want } from '../core/types';

export function wantFor(owner: string, d: Desire): Want {
  return want(renameVars(new Map([['Owner', owner]]), d.want.when), d.want.utility);
}

export function selfWants(desires: readonly Desire[], c: Character): Want[] {
  const out = [...c.wants];
  for (const d of desires) if (c.desires.includes(d.name)) out.push(wantFor(c.name, d));
  return out;
}

/** Un désir professé ouvertement est présumé connu de tous. */
export function professed(): Axiom {
  return axiom([matches('professes.Owner.D'), matches('character.P')], ['P.believes.desires.Owner.D.presumed']);
}

/** Un désir conventionnel est présumé de chacun par chacun. */
export function conventional(): Axiom {
  return axiom([matches('conventional.D'), matches('character.P'), matches('character.M')], ['P.believes.desires.M.D.presumed']);
}
