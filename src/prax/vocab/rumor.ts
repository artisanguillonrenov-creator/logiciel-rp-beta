/**
 * Propagation des rumeurs : raconter ce dont on a la preuve. Un récit plante la
 * même croyance chez l'auditeur avec une provenance de OUÏ-DIRE
 * (`<auditeur>.believes.<événement>.heard.<conteur>`), à côté de tout `.seen` :
 * les preuves s'accumulent, la corroboration se compte.
 *
 * Reprend `prax-vocab/src/rumor.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from '../core/errors';
import { segmentNamesChecked } from '../core/path';
import { Condition, absent, exists, matches, neq, not_ } from '../core/query';
import { Action, action, authoredPatClash, authoredVarClash, insert } from '../core/types';
import { isVariableName } from '../core/util';
import { beliefAbout } from './beliefs';
import { CoPresence, asRole } from './witness';

/**
 * Une action : raconter à un auditeur co-présent un événement dont on a la
 * preuve. La PREMIÈRE variable du motif est le sujet de la rumeur (jamais
 * proposé comme auditeur).
 */
export function gossip(copresence: CoPresence, gate: readonly Condition[], pat: string, label: string): Action {
  const names = segmentNamesChecked(pat);
  const offenders = [...authoredVarClash([], gate, []), ...authoredPatClash([], names)];
  if (offenders.length > 0)
    throw worldErrors.reservedVarClash('Rumor.gossip', offenders[0], ' in an authored gate or event pattern -- the Prax namespace is reserved for machinery');
  const subject = names.find((n) => isVariableName(n));
  if (subject === undefined) throw worldErrors.patternVariables('Rumor.gossip', pat, 'name someone (a rumor is about someone)');
  const believesHearer = beliefAbout('Hearer', pat);
  const conds: Condition[] = [
    matches(beliefAbout('Actor', pat)),
    ...asRole('Hearer', copresence),
    neq('Hearer', 'Actor'),
    neq('Hearer', subject),
    absent([matches(`${believesHearer}.seen`)]),
    not_(`${believesHearer}.heard.Actor`),
    ...gate,
  ];
  return action(label, conds, [insert(`${believesHearer}.heard.Actor`)]);
}

/** Condition : `who` a un ouï-dire de `event` (de n'importe qui). */
export function heard(who: string, event: string): Condition {
  return exists([matches(`${beliefAbout(who, event)}.heard.Src`)]);
}
