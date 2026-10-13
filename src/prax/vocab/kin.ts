/**
 * Parenté : faits de base + fermeture dérivée (v31). Le mariage déplace
 * l'appartenance.
 *
 * Reprend `prax-vocab/src/kin.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from '../core/errors';
import { matches, neq } from '../core/query';
import { Action, Axiom, Outcome, action, axiom, insert } from '../core/types';
import { badSegment, joins } from './faction';

/** Symétrie du mariage, fratrie, grands-parents, belle-famille — tout dérivé. */
export function kinAxioms(): Axiom[] {
  return [
    axiom([matches('married.A.B')], ['married.B.A']),
    axiom([matches('parent.P.X'), matches('parent.P.Y'), neq('X', 'Y')], ['sibling.X.Y']),
    axiom([matches('parent.G.P'), matches('parent.P.C')], ['grandparent.G.C']),
    axiom([matches('married.A.B'), matches('parent.P.A')], ['inLaw.P.B']),
    axiom([matches('married.A.B'), matches('sibling.A.S')], ['inLaw.S.B']),
  ];
}

/** Le fait de mariage plus l'entrée du conjoint dans une faction. */
export function wed(joiner: string, faction: string, spouse: string): Outcome[] {
  if (badSegment(joiner) || badSegment(spouse)) throw worldErrors.notASinglePathSegment('Kin.wed', badSegment(joiner) ? joiner : spouse);
  return [insert(`married.${joiner}.${spouse}`), joins(joiner, faction)];
}

/** Succession par exclusion : tout enfant du titulaire mort peut réclamer la charge. */
export function succession(office: string): Action {
  if (badSegment(office)) throw worldErrors.notASinglePathSegment('Kin.succession', office);
  return action(
    `[Actor]: claim the office of ${office}`,
    [matches(`office.${office}!H`), matches('dead.H'), matches('parent.H.Actor'), neq('Actor', 'H')],
    [insert(`office.${office}!Actor`)],
  );
}
