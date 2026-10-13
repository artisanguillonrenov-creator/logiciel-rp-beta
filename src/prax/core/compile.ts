/**
 * L'UNIQUE point de compilation : la famille d'effets d'exécution (`Effect`)
 * et chaque conversion écriture → exécution. `recompile` reconstruit toute la
 * table `Compiled` d'un coup ; chaque installeur du moteur l'appelle, si bien
 * que la boucle chaude ne recompile jamais une pratique, une fonction, un
 * corps d'axiome ou une envie.
 *
 * Reprend `prax-core/src/compilepipe.rs` (Prax, BSD-3-Clause).
 */
import { Bindings, groundTokens } from './db';
import { CompiledRule, axiomFootprint, axiomHeadPatterns, axiomNegPatterns, compileRule, monotoneAxioms } from './derive';
import { CompiledPath, tokenize } from './path';
import { Cond, Condition, compileCondition, groundCond, groundNames } from './query';
import { Liveness, bearingTemplates, cookedFnPool, improvableDesires, livenessOf } from './relevance';
import { Axiom, Character, Desire, Outcome, Practice, PraxFunction, ScheduleRule } from './types';
import { sortStrings } from './util';

export type Effect =
  | { readonly t: 'insert'; readonly p: CompiledPath }
  | { readonly t: 'delete'; readonly p: CompiledPath }
  | { readonly t: 'insertFor'; readonly n: number; readonly p: CompiledPath }
  | { readonly t: 'call'; readonly fn: string; readonly args: readonly string[] }
  | { readonly t: 'forEach'; readonly when: readonly Cond[]; readonly then: readonly Effect[] }
  | { readonly t: 'roll'; readonly num: number; readonly den: number; readonly when: readonly Cond[]; readonly then: readonly Effect[] };

export interface CompiledAction {
  readonly name: string;
  readonly conds: readonly Cond[];
  readonly outs: readonly Effect[];
}

export interface CompiledPractice {
  /** Le motif d'instance `practice.<pid>.<Role1>…`, découpé une fois. */
  readonly instanceNames: readonly string[];
  readonly actions: readonly CompiledAction[];
  readonly inits: readonly Effect[];
}

export interface CompiledScheduleRule {
  readonly name: string;
  readonly body: ReadonlyArray<readonly [readonly Cond[], readonly Effect[]]>;
}

export interface CompiledFn {
  readonly params: readonly string[];
  readonly cases: ReadonlyArray<readonly [readonly Cond[], readonly Effect[]]>;
}

/** Toute la table dérivée. Les Map sont remplies dans l'ordre des noms. */
export interface Compiled {
  readonly practices: ReadonlyMap<string, CompiledPractice>;
  readonly fns: ReadonlyMap<string, CompiledFn>;
  readonly schedule: readonly CompiledScheduleRule[];
  readonly wants: ReadonlyMap<string, ReadonlyArray<readonly Cond[]>>;
  readonly desires: ReadonlyMap<string, readonly Cond[]>;
  readonly scope: readonly Cond[];
  readonly rules: readonly CompiledRule[];
  readonly footprint: ReadonlyArray<readonly string[]>;
  /** Chaque tête d'axiome plus le témoin `contradiction`. */
  readonly axiomHeads: ReadonlyArray<readonly string[]>;
  readonly negFootprint: ReadonlyArray<readonly string[]>;
  readonly contMonotone: boolean;
  readonly improvables: readonly string[];
  readonly liveness: ReadonlyMap<string, Liveness>;
  readonly caresAbout: ReadonlyMap<string, readonly string[]>;
}

export function compileOutcome(o: Outcome): Effect {
  switch (o.t) {
    case 'insert':
      return { t: 'insert', p: tokenize(o.s) };
    case 'delete':
      return { t: 'delete', p: tokenize(o.s) };
    case 'insertFor':
      return { t: 'insertFor', n: o.n, p: tokenize(o.s) };
    case 'call':
      return { t: 'call', fn: o.fn, args: o.args };
    case 'forEach':
      return { t: 'forEach', when: o.when.map(compileCondition), then: o.then.map(compileOutcome) };
    case 'roll':
      return { t: 'roll', num: o.num, den: o.den, when: o.when.map(compileCondition), then: o.then.map(compileOutcome) };
  }
}

/** Substitue des liaisons dans un effet compilé. */
export function groundEffect(e: Effect, b: Bindings): Effect {
  switch (e.t) {
    case 'insert':
      return { t: 'insert', p: groundTokens(e.p, b) };
    case 'delete':
      return { t: 'delete', p: groundTokens(e.p, b) };
    case 'insertFor':
      return { t: 'insertFor', n: e.n, p: groundTokens(e.p, b) };
    case 'call':
      return { t: 'call', fn: e.fn, args: groundNames(b, e.args) };
    case 'forEach':
      return { t: 'forEach', when: e.when.map((c) => groundCond(b, c)), then: e.then.map((x) => groundEffect(x, b)) };
    case 'roll':
      return { t: 'roll', num: e.num, den: e.den, when: e.when.map((c) => groundCond(b, c)), then: e.then.map((x) => groundEffect(x, b)) };
  }
}

function compileConds(cs: readonly Condition[]): Cond[] {
  return cs.map(compileCondition);
}

function cookPractice(p: Practice): CompiledPractice {
  return {
    instanceNames: ['practice', p.id, ...p.roles],
    actions: p.actions.map((a) => ({ name: a.name, conds: compileConds(a.when), outs: a.then.map(compileOutcome) })),
    inits: p.initOutcomes.map(compileOutcome),
  };
}

export function recompile(
  practices: ReadonlyMap<string, Practice>,
  fns: readonly PraxFunction[],
  axioms: readonly Axiom[],
  characters: readonly Character[],
  desires: readonly Desire[],
  schedule: readonly ScheduleRule[],
  predictionScope: readonly Condition[],
): Compiled {
  const rules = axioms.map((ax) => compileRule(ax.when, ax.then));

  const practicesC = new Map<string, CompiledPractice>();
  for (const id of sortStrings([...practices.keys()])) practicesC.set(id, cookPractice(practices.get(id) as Practice));

  const fnsC = new Map<string, CompiledFn>();
  for (const name of sortStrings(fns.map((f) => f.name))) {
    const f = fns.find((x) => x.name === name) as PraxFunction;
    fnsC.set(name, {
      params: f.params,
      cases: f.cases.map((c) => [compileConds(c.conditions), c.outcomes.map(compileOutcome)] as const),
    });
  }

  const scheduleC: CompiledScheduleRule[] = schedule.map((r) => ({
    name: r.name,
    body: r.body.map(([conds, outs]) => [compileConds(conds), outs.map(compileOutcome)] as const),
  }));

  const wants = new Map<string, Cond[][]>();
  for (const name of sortStrings(characters.map((c) => c.name))) {
    let c: Character | undefined;
    for (const x of characters) if (x.name === name) c = x;
    if (c === undefined) continue;
    wants.set(name, c.wants.map((w) => compileConds(w.when)));
  }

  const desiresC = new Map<string, Cond[]>();
  for (const name of sortStrings(desires.map((d) => d.name))) {
    // BTreeMap::insert : en cas de doublon, la DERNIÈRE déclaration gagne.
    let last: Desire | undefined;
    for (const d of desires) if (d.name === name) last = d;
    desiresC.set(name, compileConds((last as Desire).want.when));
  }

  const scope = compileConds(predictionScope);
  const footprint = axiomFootprint(rules);
  const axiomHeads = [...axiomHeadPatterns(rules), ['contradiction']];
  const negFootprint = axiomNegPatterns(rules);
  const contMonotone = monotoneAxioms(rules);

  const fnPool = cookedFnPool(fnsC);
  const improvables = improvableDesires(practicesC, fnPool, rules, desiresC, desires);
  const caresAbout = bearingTemplates(practicesC, fnPool, desiresC, desires, wants, characters);
  const liveness = livenessOf(practicesC, fnPool, rules, desiresC, desires);

  return {
    practices: practicesC,
    fns: fnsC,
    schedule: scheduleC,
    wants,
    desires: desiresC,
    scope,
    rules,
    footprint,
    axiomHeads,
    negFootprint,
    contMonotone,
    improvables,
    liveness,
    caresAbout,
  };
}
