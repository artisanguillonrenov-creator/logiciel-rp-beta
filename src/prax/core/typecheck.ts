/**
 * Le vérificateur statique d'un monde (`prax check`) : le système de types
 * implicite de Versu. Toute sa charte est la SOLIDITÉ — aucun faux positif —
 * pour que le rapport soit digne de confiance. Neuf vérifications :
 * variables non liées, conflit de cardinalité (`!` contre `.`), références
 * pendantes, inférence de sortes (à la ML, si des sortes sont déclarées),
 * familles réservées écrites, tirage sans dé semé, conditions mortes,
 * obligation non close (□), coercition sans motif.
 *
 * Reprend `prax-core/src/typecheck.rs` (Prax, BSD-3-Clause), messages compris
 * (en anglais, octet pour octet, pour rester comparables à l'original).
 */
import type { Effect } from './compile';
import { State } from './engine';
import { segmentNamesChecked, segmentTokensChecked } from './path';
import { Cond, Condition, condSents, conditionVars } from './query';
import { RESERVED_FAMILIES } from './reserved';
import { cookedFnPool, cookedOutcomeAtoms, mayUnifySyms } from './relevance';
import { Axiom, Outcome, Practice, PraxFunction, outcomeSents } from './types';
import { cmpStr, isVariableName, stableSort } from './util';
import { OBLIGED_HEAD, OBLIGED_LIFT_PREFIX, PUNITIVE_PREFIX } from './vocabConsts';

export type TypeError =
  | { readonly k: 'UnboundVar'; readonly where: string; readonly v: string; readonly sentence: string }
  | { readonly k: 'CardinalityClash'; readonly slot: string }
  | { readonly k: 'UndefinedRef'; readonly where: string; readonly name: string }
  | { readonly k: 'SortConflict'; readonly where: string; readonly detail: string }
  | { readonly k: 'ReservedFamily'; readonly family: string; readonly where: string; readonly sentence: string }
  | { readonly k: 'SeedlessDraw' }
  | { readonly k: 'DeadCondition'; readonly where: string; readonly sentence: string }
  | { readonly k: 'DeonticUnclosed'; readonly sentence: string }
  | { readonly k: 'CoercionUnmotivated'; readonly name: string };

/** Tous les problèmes de bonne formation d'un monde (vide ⇒ bien formé), dans l'ordre d'origine. */
export function typeCheck(st: State): TypeError[] {
  const errs: TypeError[] = [];
  for (const id of sortedPracticeIds(st)) unboundInPractice(st.practiceDefs().get(id) as Practice, errs);
  for (const f of st.functionsSrc()) unboundInFunction(f, errs);
  for (const ax of st.axiomsSrc()) unboundInAxiom(ax, errs);
  cardinalityErrors(assertedSentences(st), errs);
  refErrors(st, errs);
  sortErrors(st, errs);
  reservedFamilyErrors(st, errs);
  seedlessDrawErrors(st, errs);
  deadConditionErrors(st, errs);
  deonticUnclosedErrors(st, errs);
  coercionUnmotivatedErrors(st, errs);
  return errs;
}

/** La ligne de diagnostic lisible (identique à l'original). */
export function describe(e: TypeError): string {
  switch (e.k) {
    case 'UnboundVar':
      return `unbound variable ${e.v} in "${e.sentence}" (${e.where})`;
    case 'CardinalityClash':
      return `relation ${e.slot} is used both single-valued (!) and multi-valued (.)`;
    case 'UndefinedRef':
      return `undefined reference ${e.name} (${e.where})`;
    case 'SortConflict':
      return `sort conflict at ${e.where}: ${e.detail}`;
    case 'ReservedFamily':
      return `reserved family ${e.family}: "${e.sentence}" (${e.where}) -- engine-owned; authored code may not touch it`;
    case 'SeedlessDraw':
      return 'draw used but the die is unseeded: seed it with Prax.Engine.seedDie when building the world';
    case 'DeadCondition':
      return `dead condition "${e.sentence}" (${e.where}): no action, initial fact, or axiom head can ever produce a match`;
    case 'DeonticUnclosed':
      return `unclosed obligation rule "${e.sentence}": this world can invoke an obligation but did not declare its □-closure -- wrap its axioms in Prax.Deontic.obligedClose`;
    case 'CoercionUnmotivated':
      return `unmotivated coercion "${e.name}": a threat deposits this punitive belief but no such desire is registered, so the threat is silently inert -- register it with Prax.Engine.setDesires (hold it or not is the genuine/bluff choice)`;
  }
}

function sortedPracticeIds(st: State): string[] {
  return stableSort([...st.practiceDefs().keys()], cmpStr);
}

const varsOf = (s: string): string[] => segmentNamesChecked(s).filter((n) => isVariableName(n));
const condVars = (c: Condition): string[] => conditionVars(c).filter((n) => isVariableName(n));
const flatCondVars = (cs: readonly Condition[]): string[] => cs.flatMap(condVars);

// ---- 1 : variables non liées ---------------------------------------------------

function outcomeUses(o: Outcome): Array<[string, string]> {
  switch (o.t) {
    case 'insert':
    case 'delete':
    case 'insertFor':
      return varsOf(o.s).map((v) => [v, o.s]);
    case 'call':
      return o.args.flatMap((a) => varsOf(a).map((v) => [v, o.fn] as [string, string]));
    case 'forEach':
    case 'roll': {
      const bound = flatCondVars(o.when);
      return o.then.flatMap(outcomeUses).filter(([v]) => !bound.includes(v));
    }
  }
}

function unboundInOutcomes(loc: string, bound: readonly string[], outs: readonly Outcome[], errs: TypeError[]): void {
  for (const o of outs) for (const [v, s] of outcomeUses(o)) if (!bound.includes(v)) errs.push({ k: 'UnboundVar', where: loc, v, sentence: s });
}

function unboundInPractice(p: Practice, errs: TypeError[]): void {
  unboundInOutcomes(`${p.id} (init)`, p.roles, p.initOutcomes, errs);
  for (const a of p.actions) unboundInOutcomes(`${p.id} / ${a.name}`, ['Actor', ...p.roles, ...flatCondVars(a.when)], a.then, errs);
}

function unboundInFunction(f: PraxFunction, errs: TypeError[]): void {
  for (const c of f.cases) unboundInOutcomes(`fn ${f.name}`, [...f.params, ...flatCondVars(c.conditions)], c.outcomes, errs);
}

function unboundInAxiom(ax: Axiom, errs: TypeError[]): void {
  const bound = flatCondVars(ax.when);
  for (const h of ax.then) for (const v of varsOf(h)) if (!bound.includes(v)) errs.push({ k: 'UnboundVar', where: 'axiom', v, sentence: h });
}

// ---- 2 : cardinalité d'exclusion ---------------------------------------------------

function edgesOf(s: string): Array<[string, boolean]> {
  const ts = segmentTokensChecked(s);
  const names = ts.map(([n]) => (isVariableName(n) ? '_' : n));
  const out: Array<[string, boolean]> = [];
  ts.forEach(([, op], i) => {
    if (op !== null) out.push([names.slice(0, i + 1).join('.'), op === '!']);
  });
  return out;
}

function cardinalityErrors(sentences: readonly string[], errs: TypeError[]): void {
  const bySlot = new Map<string, Set<boolean>>();
  for (const s of sentences)
    for (const [slot, excl] of edgesOf(s)) {
      let set = bySlot.get(slot);
      if (set === undefined) bySlot.set(slot, (set = new Set()));
      set.add(excl);
    }
  for (const slot of stableSort([...bySlot.keys()], cmpStr)) if ((bySlot.get(slot) as Set<boolean>).size > 1) errs.push({ k: 'CardinalityClash', slot });
}

function insertsOf(os: readonly Outcome[]): string[] {
  const out: string[] = [];
  for (const o of os) {
    if (o.t === 'insert' || o.t === 'insertFor') out.push(o.s);
    else if (o.t === 'forEach' || o.t === 'roll') out.push(...insertsOf(o.then));
  }
  return out;
}

function assertedSentences(st: State): string[] {
  const out: string[] = [];
  for (const id of sortedPracticeIds(st)) {
    const p = st.practiceDefs().get(id) as Practice;
    out.push(...p.dataFacts, ...insertsOf(p.initOutcomes));
    for (const a of p.actions) out.push(...insertsOf(a.then));
  }
  for (const f of st.functionsSrc()) for (const c of f.cases) out.push(...insertsOf(c.outcomes));
  for (const ax of st.axiomsSrc()) out.push(...ax.then);
  out.push(...st.labeledFacts());
  return out;
}

// ---- 3 : références pendantes ---------------------------------------------------------

function refErrors(st: State, errs: TypeError[]): void {
  const fns = new Set(st.functionsSrc().map((f) => f.name));
  const pracs = new Set(st.practiceDefs().keys());
  const scan = (loc: string, o: Outcome): void => {
    if (o.t === 'call') {
      if (!fns.has(o.fn)) errs.push({ k: 'UndefinedRef', where: loc, name: o.fn });
    } else if (o.t === 'insert' || o.t === 'insertFor') {
      const names = segmentNamesChecked(o.s);
      if (names.length >= 2 && names[0] === 'practice' && !pracs.has(names[1])) errs.push({ k: 'UndefinedRef', where: loc, name: `practice.${names[1]}` });
    } else if (o.t === 'forEach' || o.t === 'roll') for (const sub of o.then) scan(loc, sub);
  };
  for (const id of sortedPracticeIds(st)) {
    const p = st.practiceDefs().get(id) as Practice;
    for (const o of p.initOutcomes) scan(p.id, o);
    for (const a of p.actions) for (const o of a.then) scan(p.id, o);
  }
  for (const f of st.functionsSrc()) for (const c of f.cases) for (const o of c.outcomes) scan(`fn ${f.name}`, o);
}

// ---- 4 : inférence de sortes ------------------------------------------------------------

function nub(xs: readonly string[]): string[] {
  const out: string[] = [];
  for (const x of xs) if (!out.includes(x)) out.push(x);
  return out;
}

function sentencesByScope(st: State): Array<[string, string[]]> {
  const out: Array<[string, string[]]> = [];
  for (const id of sortedPracticeIds(st)) {
    const p = st.practiceDefs().get(id) as Practice;
    const sents: string[] = [];
    for (const a of p.actions) sents.push(...condSents(a.when), ...outcomeSents(a.then));
    sents.push(...outcomeSents(p.initOutcomes));
    out.push([p.id, sents]);
  }
  for (const f of st.functionsSrc()) {
    const sents: string[] = [];
    for (const c of f.cases) sents.push(...condSents(c.conditions), ...outcomeSents(c.outcomes));
    out.push([`fn ${f.name}`, sents]);
  }
  st.axiomsSrc().forEach((ax, i) => out.push([`axiom${i}`, [...condSents(ax.when), ...ax.then]]));
  out.push(['<facts>', st.labeledFacts()]);
  return out;
}

function ufFind(uf: Map<string, string>, x: string): string {
  let cur = x;
  for (;;) {
    const p = uf.get(cur);
    if (p === undefined || p === cur) return cur;
    cur = p;
  }
}

function unionAll(uf: Map<string, string>, xs: readonly string[]): void {
  if (xs.length === 0) return;
  const first = xs[0];
  for (const b of xs.slice(1)) {
    const ra = ufFind(uf, first);
    const rb = ufFind(uf, b);
    if (ra !== rb) uf.set(ra, rb);
  }
}

function readable(key: string): string {
  const ns = segmentNamesChecked(key).filter((n) => n !== '_');
  return ns.length === 0 ? key : ns.join('.');
}

function sortErrors(st: State, errs: TypeError[]): void {
  const sorts = st.sorts();
  if (sorts.length === 0) return;
  const memberPairs: Array<[string, string]> = sorts.flatMap(([s, cs]) => cs.map((c) => [c, s] as [string, string]));
  const memberSort = new Map<string, string>();
  for (const [c, s] of memberPairs) memberSort.set(c, s);
  const isMember = (c: string) => memberSort.has(c);
  const byConst = new Map<string, string[]>();
  for (const [c, s] of memberPairs) {
    const l = byConst.get(c) ?? [];
    l.push(s);
    byConst.set(c, l);
  }
  for (const c of stableSort([...byConst.keys()], cmpStr)) {
    const uss = nub(byConst.get(c) as string[]);
    if (uss.length > 1) errs.push({ k: 'SortConflict', where: c, detail: `declared in ${uss.join(', ')}` });
  }
  const occs = (sentence: string): Array<[string, string]> => {
    const segs = segmentNamesChecked(sentence);
    const out: Array<[string, string]> = [];
    segs.forEach((seg, i) => {
      if (isVariableName(seg) || isMember(seg)) {
        const key = segs
          .slice(0, i + 1)
          .map((s) => (isVariableName(s) || isMember(s) ? '_' : s))
          .join('.');
        out.push([seg, key]);
      }
    });
    return out;
  };
  const scoped: Array<[string, string]> = sentencesByScope(st).flatMap(([sc, ss]) => ss.map((s) => [sc, s] as [string, string]));
  const varPos = new Map<string, { sc: string; v: string; keys: string[] }>();
  for (const [sc, s] of scoped)
    for (const [seg, key] of occs(s)) {
      if (!isVariableName(seg)) continue;
      const id = JSON.stringify([sc, seg]);
      let e = varPos.get(id);
      if (e === undefined) varPos.set(id, (e = { sc, v: seg, keys: [] }));
      e.keys.push(key);
    }
  const posLabels = new Map<string, string[]>();
  for (const [, s] of scoped)
    for (const [seg, key] of occs(s)) {
      if (!isMember(seg)) continue;
      const l = posLabels.get(key) ?? [];
      l.push(memberSort.get(seg) as string);
      posLabels.set(key, l);
    }
  const uf = new Map<string, string>();
  const vpEntries = stableSort([...varPos.values()], (a, b) => cmpStr(a.sc, b.sc) || cmpStr(a.v, b.v));
  for (const e of vpEntries) unionAll(uf, e.keys);
  const byRep = new Map<string, string[]>();
  for (const key of stableSort([...posLabels.keys()], cmpStr)) {
    const rep = ufFind(uf, key);
    const l = byRep.get(rep) ?? [];
    l.push(...(posLabels.get(key) as string[]));
    byRep.set(rep, l);
  }
  for (const rep of stableSort([...byRep.keys()], cmpStr)) {
    const ss = nub(byRep.get(rep) as string[]);
    if (ss.length > 1) errs.push({ k: 'SortConflict', where: readable(rep), detail: ss.join(' vs ') });
  }
}

// ---- 5 : familles réservées -----------------------------------------------------------

function writesOf(o: Outcome): string[] {
  switch (o.t) {
    case 'insert':
    case 'insertFor':
    case 'delete':
      return [o.s];
    case 'forEach':
    case 'roll':
      return o.then.flatMap(writesOf);
    case 'call':
      return [];
  }
}

function writeSites(st: State): Array<[string, readonly Outcome[]]> {
  const v: Array<[string, readonly Outcome[]]> = [];
  const ids = sortedPracticeIds(st);
  for (const id of ids) {
    const p = st.practiceDefs().get(id) as Practice;
    v.push([`${p.id} (init)`, p.initOutcomes]);
  }
  for (const id of ids) {
    const p = st.practiceDefs().get(id) as Practice;
    for (const a of p.actions) v.push([`${p.id} / ${a.name}`, a.then]);
  }
  for (const f of st.functionsSrc()) for (const c of f.cases) v.push([`fn ${f.name}`, c.outcomes]);
  const eng = st.engineRuleNames;
  for (const r of st.scheduleSrc()) if (!eng.includes(r.name)) for (const [, outs] of r.body) v.push([`schedule ${r.name}`, outs]);
  return v;
}

function familyOf(s: string): string | null {
  const h = segmentNamesChecked(s)[0];
  return h !== undefined && RESERVED_FAMILIES.includes(h) ? h : null;
}

function reservedFamilyErrors(st: State, errs: TypeError[]): void {
  for (const [loc, os] of writeSites(st))
    for (const o of os)
      for (const s of writesOf(o)) {
        const fam = familyOf(s);
        if (fam !== null) errs.push({ k: 'ReservedFamily', family: fam, where: loc, sentence: s });
      }
  for (const ax of st.axiomsSrc())
    for (const h of ax.then) {
      const fam = familyOf(h);
      if (fam !== null) errs.push({ k: 'ReservedFamily', family: fam, where: 'axiom', sentence: h });
    }
}

// ---- 6 : tirage sans dé semé ----------------------------------------------------------

function hasRoll(o: Outcome): boolean {
  return o.t === 'roll' || (o.t === 'forEach' && o.then.some(hasRoll));
}

function seedlessDrawErrors(st: State, errs: TypeError[]): void {
  if (st.rngSeed !== null) return;
  let any = false;
  for (const p of st.practiceDefs().values()) {
    any = any || p.initOutcomes.some(hasRoll);
    for (const a of p.actions) any = any || a.then.some(hasRoll);
  }
  for (const f of st.functionsSrc()) for (const c of f.cases) any = any || c.outcomes.some(hasRoll);
  for (const r of st.scheduleSrc()) for (const [, outs] of r.body) any = any || outs.some(hasRoll);
  if (any) errs.push({ k: 'SeedlessDraw' });
}

// ---- 7 : conditions mortes -----------------------------------------------------------------

function positives(c: Cond): Array<readonly string[]> {
  if (c.t === 'match') return [c.segs];
  if (c.t === 'exists') return c.cs.flatMap(positives);
  return [];
}

function forEachGuards(outs: readonly Effect[]): Array<readonly Cond[]> {
  const out: Array<readonly Cond[]> = [];
  for (const o of outs)
    if (o.t === 'forEach' || o.t === 'roll') {
      out.push(o.when);
      out.push(...forEachGuards(o.then));
    }
  return out;
}

function lintSites(st: State): Array<[string, readonly Cond[]]> {
  const comp = st.compiled;
  const out: Array<[string, readonly Cond[]]> = [];
  for (const [pid, cp] of comp.practices) for (const a of cp.actions) out.push([`${pid} / ${a.name}`, a.conds]);
  for (const [pid, cp] of comp.practices) for (const a of cp.actions) for (const gs of forEachGuards(a.outs)) out.push([`${pid} / ${a.name} (effect guard)`, gs]);
  for (const [pid, cp] of comp.practices) for (const gs of forEachGuards(cp.inits)) out.push([`${pid} (init guard)`, gs]);
  for (const [fn, f] of comp.fns) for (const [cs] of f.cases) out.push([`fn ${fn}`, cs]);
  for (const [fn, f] of comp.fns) for (const [, os] of f.cases) for (const gs of forEachGuards(os)) out.push([`fn ${fn} (effect guard)`, gs]);
  for (const r of comp.schedule) for (const [cs] of r.body) out.push([`schedule ${r.name}`, cs]);
  for (const r of comp.schedule) for (const [, os] of r.body) for (const gs of forEachGuards(os)) out.push([`schedule ${r.name} (effect guard)`, gs]);
  for (const [n, cs] of comp.desires) out.push([`desire ${n}`, cs]);
  for (const [n, css] of comp.wants) for (const cs of css) out.push([`want of ${n}`, cs]);
  return out;
}

function deadConditionErrors(st: State, errs: TypeError[]): void {
  const pool = st.producibleAtoms();
  if (pool === null) return;
  for (const [loc, conds] of lintSites(st))
    for (const c of conds)
      for (const p of positives(c)) {
        if (p.every((s) => isVariableName(s))) continue;
        if (!pool.some((atom) => mayUnifySyms(p, atom))) errs.push({ k: 'DeadCondition', where: loc, sentence: p.join('.') });
      }
}

// ---- 8 : clôture des obligations (v51) -------------------------------------------------------

const lifted = (s: string): boolean => s.startsWith(OBLIGED_LIFT_PREFIX);

function obligedLift(ax: Axiom): Axiom | null {
  if (!ax.when.every((c) => c.t === 'match')) return null;
  return { when: ax.when.map((c) => (c.t === 'match' ? { t: 'match', s: `${OBLIGED_LIFT_PREFIX}${c.s}` } : c)), then: ax.then.map((s) => `${OBLIGED_LIFT_PREFIX}${s}`) };
}

const alreadyLifted = (ax: Axiom): boolean => ax.when.every((c) => c.t === 'match' && lifted(c.s)) && ax.then.every(lifted);

/** Rendu canonique (clés triées) pour l'égalité structurelle. */
export function canonical(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x);
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`;
  const o = x as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(',')}}`;
}

function deonticInvokable(st: State): boolean {
  const comp = st.compiled;
  const fnPool = cookedFnPool(comp.fns);
  const atoms: Array<ReturnType<typeof cookedOutcomeAtoms>> = [];
  for (const cp of comp.practices.values()) for (const a of cp.actions) for (const o of a.outs) atoms.push(cookedOutcomeAtoms(fnPool, [], o));
  for (const cp of comp.practices.values()) for (const o of cp.inits) atoms.push(cookedOutcomeAtoms(fnPool, [], o));
  for (const csr of comp.schedule) for (const [, outs] of csr.body) for (const o of outs) atoms.push(cookedOutcomeAtoms(fnPool, [], o));
  if (atoms.some((a) => a === null)) return true;
  const produces = (h: string) => h === OBLIGED_HEAD || isVariableName(h);
  for (const a of atoms) if (a !== null) for (const atom of a.ins) if (atom.length > 0 && produces(atom[0])) return true;
  for (const s of st.labeledFacts()) {
    const f = segmentNamesChecked(s)[0];
    if (f !== undefined && produces(f)) return true;
  }
  for (const ax of st.axiomsSrc())
    for (const s of ax.then) {
      const f = segmentNamesChecked(s)[0];
      if (f !== undefined && produces(f)) return true;
    }
  return false;
}

function deonticUnclosedErrors(st: State, errs: TypeError[]): void {
  if (!deonticInvokable(st)) return;
  const axioms = st.axiomsSrc();
  const keys = new Set(axioms.map(canonical));
  for (const ax of axioms) {
    const twin = obligedLift(ax);
    if (twin !== null && !alreadyLifted(ax) && !keys.has(canonical(twin))) errs.push({ k: 'DeonticUnclosed', sentence: ax.then[0] ?? '' });
  }
}

// ---- 9 : coercition sans motif (v54) ------------------------------------------------------------

function coercionUnmotivatedErrors(st: State, errs: TypeError[]): void {
  const registered = new Set(st.desiresSrc().map((d) => d.name));
  const seen = new Set<string>();
  for (const [, os] of writeSites(st))
    for (const o of os)
      for (const s of writesOf(o))
        for (const seg of segmentNamesChecked(s)) {
          if (seg.startsWith(PUNITIVE_PREFIX) && !registered.has(seg) && !seen.has(seg)) {
            seen.add(seg);
            errs.push({ k: 'CoercionUnmotivated', name: seg });
          }
        }
}
