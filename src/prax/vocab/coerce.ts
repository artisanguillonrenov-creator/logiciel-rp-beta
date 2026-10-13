/**
 * Coercition : le levier comme primitive indépendante du contenu. Une menace
 * est une intention conditionnelle rendue crédible par un désir. `coerce`
 * génère le protocole menacer / céder / défier / punir et le désir punitif qui
 * professe l'intention ; le CONTENU (déclencheur, exigence, punition, ce que
 * l'extorqueur valorise) est dans l'enregistrement `Coercion`.
 *
 * Reprend `prax-vocab/src/coerce.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from '../core/errors';
import { Condition, flatConditionVars, matches, neq, not_, or_ } from '../core/query';
import { Action, Desire, Outcome, action, authoredVarClash, del, desire, insert, insertFor, isPraxVar, renameVars, want } from '../core/types';
import { isVariableName } from '../core/util';
import { PUNITIVE_PREFIX } from '../core/vocabConsts';
import { beliefAbout } from './beliefs';

export interface Coercion {
  readonly id: string;
  readonly victim: string;
  readonly trigger: readonly Condition[];
  readonly threatenLabel: string;
  readonly demandLabel: string;
  readonly demand: readonly Outcome[];
  readonly punishLabel: string;
  readonly punishWhen: readonly Condition[];
  readonly punishOuts: readonly Outcome[];
  readonly kernel: readonly Condition[];
  readonly weight: number;
  /** `null` = menace permanente ; `n` = le marqueur se retire n frontières plus tard. */
  readonly threatLasts: number | null;
  /** `null` = un silence acheté le reste ; `n` = le marqueur expire et le racket recommence. */
  readonly complianceLasts: number | null;
}

function lasting(n: number | null, s: string): Outcome {
  return n === null ? insert(s) : insertFor(n, s);
}

/** Génère le protocole et le désir punitif (à enregistrer ET à porter). */
export function coerce(co: Coercion): [Desire, Action[]] {
  const sid = co.id;
  const victim = co.victim;
  if (sid.includes('.') || sid.includes('!')) throw worldErrors.notASinglePathSegment('Coerce.coerce: id', sid);
  if (['Actor', 'E', 'Owner', 'Hearer'].includes(victim) || isPraxVar(victim))
    throw worldErrors.reservedVarClash(
      'Coerce.coerce: victim variable',
      victim,
      ' -- Actor and E (the generated actions’ own extorter and victim roles), Owner (the punitive desire’s extorter), Hearer, and the Prax namespace are all mechanism-owned; pick another name for the victim',
    );
  const checks: Array<[string, string[], readonly Condition[], readonly Outcome[], string]> = [
    ['trigger', [], co.trigger, [], ' -- the Prax namespace is reserved for the mechanism’s own post-rename output'],
    ['demand', [victim], [], co.demand, ' -- in the comply query the victim is Actor and the extorter is E; refer to the victim as Actor'],
    ['punish', ['E'], co.punishWhen, co.punishOuts, ' -- E is the victim’s frame (comply/defy); the punish query’s extorter is Actor'],
    ['kernel', ['Actor', 'E'], co.kernel, [], ' -- the kernel’s frame is the punitive desire: its extorter is Owner and its victim is renamed to PraxD'],
  ];
  for (const [field, forbidden, conds, outs, extra] of checks) {
    const bad = authoredVarClash(forbidden, conds, outs)[0];
    if (bad !== undefined) throw worldErrors.reservedVarClash(`Coerce.coerce: ${field}`, bad, extra);
  }
  const threatPath = (e: string, v: string) => `threatened.${sid}.${e}.${v}`;
  const defiedPath = (v: string, e: string) => `defied.${sid}.${v}.${e}`;
  const compliedPath = (e: string, v: string) => `complied.${sid}.${e}.${v}`;
  const punitiveName = `${PUNITIVE_PREFIX}${sid}`;

  const threaten = action(
    co.threatenLabel,
    [...co.trigger, neq(victim, 'Actor'), not_(threatPath('Actor', victim))],
    [
      lasting(co.threatLasts, threatPath('Actor', victim)),
      insert(`${beliefAbout(victim, `desires.Actor.${punitiveName}`)}.heard.Actor`),
      insert(`Actor.extorted.${victim}.${sid}`),
    ],
  );
  const comply = action(
    co.demandLabel,
    [matches(threatPath('E', 'Actor')), not_(compliedPath('E', 'Actor'))],
    [...co.demand, lasting(co.complianceLasts, compliedPath('E', 'Actor')), del(threatPath('E', 'Actor'))],
  );
  const defy = action('[Actor]: defy [E]', [matches(threatPath('E', 'Actor'))], [insert(defiedPath('Actor', 'E')), del(threatPath('E', 'Actor'))]);
  const punish = action(co.punishLabel, [or_([[matches(threatPath('Actor', victim))], [matches(defiedPath(victim, 'Actor'))]]), ...co.punishWhen], co.punishOuts);
  const punitiveWhen = [or_([[matches(defiedPath('PraxD', 'Owner'))], [matches(threatPath('Owner', 'PraxD'))]]), ...namespaceKernel(victim, co.kernel)];
  return [desire(punitiveName, want(punitiveWhen, co.weight)), [threaten, comply, defy, punish]];
}

/** Renomme le noyau dans l'espace `Prax` : victime → `PraxD`, autres variables libres → `PraxW`, `PraxW2`, … */
export function namespaceKernel(victim: string, conds: readonly Condition[]): Condition[] {
  const free: string[] = [];
  for (const v of flatConditionVars(conds)) if (isVariableName(v) && !free.includes(v)) free.push(v);
  const subst = new Map<string, string>([[victim, 'PraxD']]);
  let n = 1;
  for (const v of free) {
    if (v === victim || v === 'Owner') continue;
    subst.set(v, n === 1 ? 'PraxW' : `PraxW${n}`);
    n++;
  }
  return renameVars(subst, conds);
}
