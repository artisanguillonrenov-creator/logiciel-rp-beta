/**
 * Chantage : l'instance « exposition » de la coercition (v49). `shakedown`
 * construit un enregistrement `Coercion` et renvoie `coerce` de celui-ci :
 * déclencheur (l'extorqueur détient la preuve, la victime est présente),
 * exigence (une dette), punition (révéler la preuve à un tiers), noyau (les
 * personnes qui croient la preuve).
 *
 * Reprend `prax-vocab/src/blackmail.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from '../core/errors';
import { segmentNamesChecked } from '../core/path';
import { matches, neq, not_ } from '../core/query';
import { Action, Desire, authoredPatClash, insert } from '../core/types';
import { isVariableName } from '../core/util';
import { beliefAbout } from './beliefs';
import { coerce } from './coerce';
import { owe } from './debt';
import { CoPresence, asRole } from './witness';

export function shakedown(sid: string, copresence: CoPresence, pat: string, price: string, w: number): [Desire, Action[]] {
  const names = segmentNamesChecked(pat);
  const victim = names.find((n) => isVariableName(n));
  if (victim === undefined) throw worldErrors.patternVariables('Blackmail.shakedown', pat, 'name someone (a threat needs a victim)');
  const secondaries = names.filter((n) => n !== victim);
  const bad = authoredPatClash(['Owner', 'Hearer'], secondaries)[0];
  if (bad !== undefined)
    throw worldErrors.reservedVarClash(
      'Blackmail.shakedown: evidence pattern',
      bad,
      ` -- ${JSON.stringify(pat)} names a secondary variable that would silently merge with a frame role Owner (the punitive desire's extorter) or Hearer (expose's own audience); pick a different name for anyone besides the victim`,
    );
  return coerce({
    id: sid,
    victim,
    trigger: [matches(beliefAbout('Actor', pat)), ...asRole(victim, copresence)],
    threatenLabel: `[Actor]: threaten [${victim}] with what you know`,
    demandLabel: "[Actor]: buy [E]'s silence",
    demand: owe('E', 'Actor', price),
    punishLabel: `[Actor]: expose [${victim}] to [Hearer]`,
    punishWhen: [matches(beliefAbout('Actor', pat)), ...asRole('Hearer', copresence), neq('Hearer', 'Actor'), neq('Hearer', victim), not_(beliefAbout('Hearer', pat))],
    punishOuts: [insert(`${beliefAbout('Hearer', pat)}.heard.Actor`)],
    kernel: [matches(beliefAbout('Believer', pat))],
    weight: w,
    threatLasts: null,
    complianceLasts: null,
  });
}
