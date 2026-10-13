/**
 * Réputation : la position sociale DÉRIVÉE des preuves. Personne ne STOCKE une
 * réputation : `regards.<observateur>.<sujet>.<étiquette>` est dérivé des
 * croyances d'événement de l'observateur, n'existe que dans la vue, et
 * disparaît dès que son appui disparaît. Elle se défait par l'EXPIATION, pas
 * par l'oubli (`standingUnless`). `notoriety` transforme la corroboration en
 * fait global au-delà d'un seuil.
 *
 * Reprend `prax-vocab/src/repute.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from '../core/errors';
import { segmentNamesChecked } from '../core/path';
import { Condition, cmp, count, matches, not_, subquery } from '../core/query';
import { Axiom, authoredPatClash, axiom } from '../core/types';
import { isVariableName } from '../core/util';

function subjectOf(pat: string): string {
  const s = segmentNamesChecked(pat).find((n) => isVariableName(n));
  if (s === undefined) throw worldErrors.patternVariables('Repute.standing', pat, 'name someone (a standing is about someone)');
  return s;
}

function checkedDefeater(pat: string, defeater: string): string {
  const patVars = segmentNamesChecked(pat).filter((n) => isVariableName(n));
  const defVars = segmentNamesChecked(defeater).filter((n) => isVariableName(n));
  if (defVars.every((v) => patVars.includes(v))) return defeater;
  throw worldErrors.patternVariables(
    'Repute.standing_unless',
    defeater,
    `use only the deed pattern ${JSON.stringify(pat)}'s variables (it would defeat globally, not per-subject)`,
  );
}

function checkDeedPattern(pat: string): void {
  const names = segmentNamesChecked(pat);
  const v = authoredPatClash(['Regarder'], names)[0];
  if (v !== undefined)
    throw worldErrors.reservedVarClash(
      'Repute.standing',
      v,
      ` -- deed pattern ${JSON.stringify(pat)} reserves it; the Prax namespace and Regarder (the axiom's own observer join variable) are both reserved`,
    );
}

function standingWith(pat: string, extra: readonly Condition[], label: string): Axiom {
  checkDeedPattern(pat);
  const subject = subjectOf(pat);
  return axiom([matches(`Regarder.believes.${pat}`), ...extra], [`regards.Regarder.${subject}.${label}`]);
}

/** Chaque observateur qui a la preuve de l'acte considère son sujet sous `label`. */
export function standing(pat: string, label: string): Axiom {
  return standingWith(pat, [], label);
}

/** `standing`, défaite par un fait de base (qui n'utilise que les variables de l'acte). */
export function standingUnless(pat: string, defeater: string, label: string): Axiom {
  checkDeedPattern(pat);
  return standingWith(pat, [not_(checkedDefeater(pat, defeater))], label);
}

/** Condition : `observer` considère `subject` sous `label` (fait dérivé). */
export function regardedAs(observer: string, subject: string, label: string): Condition {
  return matches(`regards.${observer}.${subject}.${label}`);
}

/** `notorious.<sujet>.<étiquette>` tant qu'au moins `k` observateurs distincts tiennent la considération. */
export function notoriety(label: string, k: number): Axiom {
  return axiom(
    [matches(`regards.W0.T.${label}`), subquery('Rs', ['W'], [matches(`regards.W.T.${label}`)]), count('N', 'Rs'), cmp('gte', 'N', String(k))],
    [`notorious.T.${label}`],
  );
}
