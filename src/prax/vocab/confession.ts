/**
 * Aveu et absolution (v32). Les marques se CONVERTISSENT, jamais ne
 * s'effacent ; avouer s'auto-incrimine par le canal ordinaire de l'ouï-dire ;
 * l'absolution est un acte refusable d'une seconde personne ; la patience de
 * celui qui absout est ce qu'il SAIT (`incorrigible`).
 *
 * Reprend `prax-vocab/src/confession.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from '../core/errors';
import { segmentNamesChecked, segmentTokensChecked, tokensToSentence } from '../core/path';
import { cmp, count, matches, neq, not_, subquery } from '../core/query';
import { Action, Axiom, action, authoredPatClash, axiom, del, insert } from '../core/types';
import { isVariableName } from '../core/util';
import { beliefAbout } from './beliefs';
import { CoPresence, asRole } from './witness';

const segOk = (n: string): boolean => n.length > 0 && !n.includes('.') && !n.includes('!');

/** Avouer UN acte (une liaison de marque) à un auditeur co-présent. */
export function confess(kind: string, verb: string, copresence: CoPresence, markPat: string, depositPat: string, label: string): Action {
  if (!segOk(kind)) throw worldErrors.notASinglePathSegment('Confession.confess: mark kind', kind);
  if (!segOk(verb)) throw worldErrors.notASinglePathSegment('Confession.confess: discharge verb', verb);
  const markNames = segmentNamesChecked(markPat);
  const v1 = authoredPatClash(['H', 'Hearer', 'Actor'], markNames)[0];
  if (v1 !== undefined)
    throw worldErrors.reservedVarClash(
      'Confession.confess: mark pattern',
      v1,
      ` -- ${JSON.stringify(markPat)} reserves it (the mark's hearer slot / the action's own roles, or the Prax namespace)`,
    );
  const depositNames = segmentNamesChecked(depositPat);
  const v2 = authoredPatClash(['Hearer'], depositNames)[0];
  if (v2 !== undefined)
    throw worldErrors.reservedVarClash(
      'Confession.confess: deposit pattern',
      v2,
      ` -- ${JSON.stringify(depositPat)} reserves it (the confession's own audience role, or the Prax namespace)`,
    );
  const groundedVars = ['Actor', 'H', ...markNames.filter((n) => isVariableName(n))];
  const stray = depositNames.filter((n) => isVariableName(n)).find((n) => !groundedVars.includes(n));
  if (stray !== undefined)
    throw worldErrors.patternVariables(
      'Confession.confess: deposit pattern',
      depositPat,
      `ground ${JSON.stringify(stray)} from the mark (only Actor, H, and ${JSON.stringify(markPat)}'s own variables are available) -- an ungroundable deposit would insert a variable-bearing fact`,
    );
  const liedPath = `Actor.${kind}.H.${markPat}`;
  const confessedPath = `Actor.${verb}.H.${markPat}`;
  return action(
    label,
    [matches(liedPath), ...asRole('Hearer', copresence), neq('Hearer', 'Actor')],
    [del(liedPath), insert(confessedPath), insert(`${beliefAbout('Hearer', depositPat)}.heard.Actor`)],
  );
}

/** Accorder l'absolution : insère le « défaiseur » du monde pour un acte avoué À SOI. */
export function absolve(defeater: string, pat: string, incLabel: string, label: string): Action {
  if (!segOk(defeater) || !segOk(incLabel)) throw worldErrors.notASinglePathSegment('Confession.absolve: defeater/label', segOk(defeater) ? incLabel : defeater);
  const names = segmentNamesChecked(pat);
  const v = authoredPatClash(['Actor'], names)[0];
  if (v !== undefined) throw worldErrors.reservedVarClash('Confession.absolve: event pattern', v, ` -- ${JSON.stringify(pat)} reserves it`);
  const confessor = names.find((n) => isVariableName(n));
  if (confessor === undefined) throw worldErrors.patternVariables('Confession.absolve: event pattern', pat, 'name someone (the FIRST variable is the confessor)');
  return action(
    label,
    [
      matches(`${beliefAbout('Actor', pat)}.heard.${confessor}`),
      neq('Actor', confessor),
      not_(`regards.Actor.${confessor}.${incLabel}`),
      not_(`${defeater}.${confessor}`),
    ],
    [insert(`${defeater}.${confessor}`)],
  );
}

/** La patience comme connaissance : `label` dès qu'on croit au moins `k` instances distinctes de l'acte. */
export function incorrigible(pat: string, k: number, label: string): Axiom {
  if (!segOk(label)) throw worldErrors.notASinglePathSegment('Confession.incorrigible: label', label);
  const tokens = segmentTokensChecked(pat);
  const names = tokens.map(([n]) => n);
  const v = authoredPatClash([], names)[0];
  if (v !== undefined)
    throw worldErrors.reservedVarClash('Confession.incorrigible: pattern', v, ` -- ${JSON.stringify(pat)} reserves it; the Prax namespace is reserved for the axiom's own machinery`);
  const vars = names.filter((n) => isVariableName(n));
  if (vars.length === 0) throw worldErrors.patternVariables('Confession.incorrigible', pat, 'name an offender');
  if (vars.length === 1)
    throw worldErrors.patternVariables(
      'Confession.incorrigible',
      pat,
      'have deed variables to count (a single-variable pattern admits only one possible instance; a k > 1 threshold could never fire, and k <= 1 needs no threshold at all)',
    );
  const [offender, ...rest] = vars;
  const witnessNames = rest.map((r) => `${r}0`);
  const clash = witnessNames.find((d) => d === offender || rest.includes(d));
  if (clash !== undefined)
    throw worldErrors.patternVariables(
      'Confession.incorrigible',
      pat,
      `not name ${JSON.stringify(clash)}: it collides with the outer witness-naming convention (a deed variable named <name>0 shadowing another variable named <name>)`,
    );
  const witnessPat = tokensToSentence(tokens.map(([name, op]) => [rest.includes(name) ? `${name}0` : name, op] as const));
  return axiom(
    [matches(`PraxW.believes.${witnessPat}`), subquery('PraxDs', rest, [matches(`PraxW.believes.${pat}`)]), count('PraxN', 'PraxDs'), cmp('gte', 'PraxN', String(k))],
    [`regards.PraxW.${offender}.${label}`],
  );
}
