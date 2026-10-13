/**
 * Secrets et tromperie. La DISSIMULATION est de l'écriture, pas de la
 * mécanique (`conceal` : une envie que personne ne croie l'événement). Un
 * MENSONGE est une affirmation sans preuve (`lie`), qui laisse une seule trace :
 * la mémoire du menteur, `<menteur>.lied.<auditeur>.<événement>`.
 *
 * Reprend `prax-vocab/src/deceit.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from '../core/errors';
import { segmentNamesChecked } from '../core/path';
import { Condition, absent, matches, neq, not_ } from '../core/query';
import { Action, Want, action, authoredPatClash, authoredVarClash, insert, want } from '../core/types';
import { isVariableName } from '../core/util';
import { beliefAbout } from './beliefs';
import { CoPresence, asRole } from './witness';

/** Un désir que personne ne croie `event` (événement sans variable ; `Anyone` réservé). */
export function conceal(event: string, k: number): Want {
  const names = segmentNamesChecked(event);
  if (names.some((n) => isVariableName(n)))
    throw worldErrors.patternVariables('Deceit.conceal', event, 'be variable-free (a concealment want quantifies over observers, not deeds)');
  return want([absent([matches(beliefAbout('Anyone', event))])], k);
}

/** Une action : affirmer à un auditeur co-présent un événement dont on n'a aucune preuve. */
export function lie(copresence: CoPresence, gate: readonly Condition[], fabrication: readonly Condition[], pat: string, label: string): Action {
  const names = segmentNamesChecked(pat);
  const offenders = [...authoredVarClash([], [...gate, ...fabrication], []), ...authoredPatClash([], names)];
  if (offenders.length > 0)
    throw worldErrors.reservedVarClash(
      'Deceit.lie',
      offenders[0],
      ' in an authored gate, fabrication, or event pattern -- the Prax namespace is reserved for machinery',
    );
  const subject = names.find((n) => isVariableName(n));
  if (subject === undefined) throw worldErrors.patternVariables('Deceit.lie', pat, 'name someone (a lie is about someone)');
  const believesHearer = beliefAbout('Hearer', pat);
  const conds: Condition[] = [
    ...fabrication,
    neq(subject, 'Actor'),
    absent([matches(beliefAbout('Actor', pat))]),
    ...asRole('Hearer', copresence),
    neq('Hearer', 'Actor'),
    neq('Hearer', subject),
    absent([matches(`${believesHearer}.seen`)]),
    not_(`${believesHearer}.heard.Actor`),
    ...gate,
  ];
  return action(label, conds, [insert(`${believesHearer}.heard.Actor`), insert(`Actor.lied.Hearer.${pat}`)]);
}
