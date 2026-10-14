/**
 * Le langage de conditions au-dessus de l'unification : la forme d'écriture
 * `Condition` (opérandes en chaînes, ce que produit le DSL) et sa forme
 * compilée `Cond` (motifs déjà découpés). Une requête est une liste
 * conjonctive évaluée de gauche à droite qui enrichit un ensemble de liaisons.
 *
 * Convention des opérandes : un opérande dont le premier caractère est une
 * majuscule est une variable logique, sinon une constante. Un opérande non
 * résoluble (variable non liée là où une valeur est requise) fait tomber la
 * liaison — c'est le comportement défini du langage.
 *
 * Reprend `prax-core/src/query.rs` (Prax, BSD-3-Clause).
 */
import { Bindings, Db, SetVal, Val, bindingsKey, ground, unifiable, unifyInto, valToString } from './db';
import { worldErrors } from './errors';
import { segmentNamesChecked, tokenize } from './path';
import { checkedInt, isVariableName } from './util';

export type CmpOp = 'lt' | 'lte' | 'gt' | 'gte';
export type CalcOp = 'add' | 'sub' | 'mul' | 'mod';

/** Une condition d'écriture (`Prax.Query.Condition`). */
export type Condition =
  | { readonly t: 'match'; readonly s: string }
  | { readonly t: 'not'; readonly s: string }
  | { readonly t: 'eq'; readonly a: string; readonly b: string }
  | { readonly t: 'neq'; readonly a: string; readonly b: string }
  | { readonly t: 'cmp'; readonly op: CmpOp; readonly a: string; readonly b: string }
  | { readonly t: 'calc'; readonly r: string; readonly op: CalcOp; readonly a: string; readonly b: string }
  | { readonly t: 'count'; readonly r: string; readonly set: string }
  | { readonly t: 'subquery'; readonly set: string; readonly find: readonly string[]; readonly where: readonly Condition[] }
  | { readonly t: 'or'; readonly clauses: ReadonlyArray<readonly Condition[]> }
  | { readonly t: 'absent'; readonly cs: readonly Condition[] }
  | { readonly t: 'exists'; readonly cs: readonly Condition[] };

// ---- constructeurs (le DSL d'écriture) ----------------------------------

export const matches = (s: string): Condition => ({ t: 'match', s });
export const not_ = (s: string): Condition => ({ t: 'not', s });
export const eq = (a: string, b: string): Condition => ({ t: 'eq', a, b });
export const neq = (a: string, b: string): Condition => ({ t: 'neq', a, b });
export const cmp = (op: CmpOp, a: string, b: string): Condition => ({ t: 'cmp', op, a, b });
export const calc = (r: string, op: CalcOp, a: string, b: string): Condition => ({ t: 'calc', r, op, a, b });
export const count = (r: string, set: string): Condition => ({ t: 'count', r, set });
export const subquery = (set: string, find: readonly string[], where: readonly Condition[]): Condition => ({ t: 'subquery', set, find, where });
export const or_ = (clauses: ReadonlyArray<readonly Condition[]>): Condition => ({ t: 'or', clauses });
export const absent = (cs: readonly Condition[]): Condition => ({ t: 'absent', cs });
export const exists = (cs: readonly Condition[]): Condition => ({ t: 'exists', cs });

/** ∀x. garde(x) → corps(x), écrit « aucune liaison de la garde ne fait échouer le corps ». */
export function forAll(guard: readonly Condition[], body: readonly Condition[]): Condition {
  return absent([...guard, absent(body)]);
}

/** Implication matérielle a → b. */
export function implies(a: readonly Condition[], b: readonly Condition[]): Condition {
  return or_([[absent(a)], b]);
}

/** La forme compilée d'une condition. */
export type Cond =
  | { readonly t: 'match'; readonly segs: readonly string[] }
  | { readonly t: 'not'; readonly segs: readonly string[] }
  | { readonly t: 'eq'; readonly a: string; readonly b: string }
  | { readonly t: 'neq'; readonly a: string; readonly b: string }
  | { readonly t: 'cmp'; readonly op: CmpOp; readonly a: string; readonly b: string }
  | { readonly t: 'calc'; readonly r: string; readonly op: CalcOp; readonly a: string; readonly b: string }
  | { readonly t: 'count'; readonly r: string; readonly set: string }
  | { readonly t: 'subquery'; readonly set: string; readonly find: readonly string[]; readonly where: readonly Cond[] }
  | { readonly t: 'or'; readonly clauses: ReadonlyArray<readonly Cond[]> }
  | { readonly t: 'absent'; readonly cs: readonly Cond[] }
  | { readonly t: 'exists'; readonly cs: readonly Cond[] };

/** Compile une condition d'écriture (refuse un opérateur final, une sous-requête imbriquée). */
export function compileCondition(c: Condition): Cond {
  return compileInner(c, false);
}

function compileInner(c: Condition, inSub: boolean): Cond {
  switch (c.t) {
    case 'match':
      return { t: 'match', segs: tokenize(c.s).segs };
    case 'not':
      return { t: 'not', segs: tokenize(c.s).segs };
    case 'eq':
    case 'neq':
    case 'cmp':
    case 'calc':
    case 'count':
      return c;
    case 'subquery':
      if (inSub) throw worldErrors.nestedSubquery();
      return { t: 'subquery', set: c.set, find: c.find, where: c.where.map((x) => compileInner(x, true)) };
    case 'or':
      return { t: 'or', clauses: c.clauses.map((cl) => cl.map((x) => compileInner(x, inSub))) };
    case 'absent':
      return { t: 'absent', cs: c.cs.map((x) => compileInner(x, inSub)) };
    case 'exists':
      return { t: 'exists', cs: c.cs.map((x) => compileInner(x, inSub)) };
  }
}

export function compileConditions(cs: readonly Condition[]): Cond[] {
  return cs.map(compileCondition);
}

// ---- évaluation --------------------------------------------------------------

type SubqMemo = Map<Cond, Map<string, string[][]>>;

/**
 * Évalue une liste conjonctive depuis une liaison de départ et renvoie toutes
 * les liaisons cohérentes (`Prax.Query.query`).
 */
export function query(db: Db, conds: readonly Cond[], seed: Bindings): Bindings[] {
  let matches: Bindings[] = [seed];
  let memo: SubqMemo | null = null;
  for (const cond of conds) {
    const next: Bindings[] = [];
    if (cond.t === 'subquery' && memo === null) memo = new Map();
    for (const b of matches) evalCond(db, cond, b, next, memo);
    matches = next;
    if (matches.length === 0) break;
  }
  return matches;
}

/** Les conditions sont-elles satisfiables (au moins une solution) ? */
export function satisfies(db: Db, conds: readonly Cond[], seed: Bindings): boolean {
  return anySolution(db, conds, 0, seed);
}

/** Nombre de liaisons satisfaisantes (doublons compris). */
export function countSatisfying(db: Db, conds: readonly Cond[], seed: Bindings): number {
  return query(db, conds, seed).length;
}

/** Recherche en profondeur de la PREMIÈRE solution — même vérité que `query(...).length > 0`. */
function anySolution(db: Db, conds: readonly Cond[], i: number, b: Bindings): boolean {
  if (i === conds.length) return true;
  const c = conds[i];
  if (c.t === 'match') {
    if (i + 1 === conds.length) return unifiable(db, c.segs, b);
    const out: Bindings[] = [];
    unifyInto(db, c.segs, b, out);
    for (const x of out) if (anySolution(db, conds, i + 1, x)) return true;
    return false;
  }
  const out: Bindings[] = [];
  evalCond(db, c, b, out, null);
  for (const x of out) if (anySolution(db, conds, i + 1, x)) return true;
  return false;
}

function resolve(b: Bindings, s: string): Val | undefined {
  return isVariableName(s) ? b.get(s) : s;
}

function num(v: Val | undefined): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return readInteger(v);
  return undefined;
}

/** Grammaire entière acceptée : `-?[0-9]+` (exactement ce que le moteur émet). */
export function readInteger(name: string): number | undefined {
  const digits = name.startsWith('-') ? name.slice(1) : name;
  if (digits.length === 0) return undefined;
  for (let i = 0; i < digits.length; i++) {
    const c = digits.charCodeAt(i);
    if (c < 48 || c > 57) return undefined;
  }
  const n = Number(name);
  return Number.isSafeInteger(n) ? n : undefined;
}

function applyCmp(op: CmpOp, l: number, r: number): boolean {
  switch (op) {
    case 'lt':
      return l < r;
    case 'lte':
      return l <= r;
    case 'gt':
      return l > r;
    case 'gte':
      return l >= r;
  }
}

/** `mod` de Haskell : le résultat prend le signe du diviseur. */
export function haskellMod(a: number, b: number): number {
  if (b === 0) throw new Error(`Prax.Query : Calc mod par zéro (${a} mod ${b})`);
  let r = a % b;
  if (r !== 0 && r < 0 !== b < 0) r += b;
  return r === 0 ? 0 : r;
}

function applyCalc(op: CalcOp, l: number, r: number): number {
  switch (op) {
    case 'add':
      return checkedInt(l + r, `${l} + ${r}`);
    case 'sub':
      return checkedInt(l - r, `${l} - ${r}`);
    case 'mul':
      return checkedInt(l * r, `${l} * ${r}`);
    case 'mod':
      return haskellMod(l, r);
  }
}

function symOf(v: Val): string {
  return valToString(v);
}

function collectCondVars(conds: readonly Cond[], out: Set<string>): void {
  for (const c of conds) {
    switch (c.t) {
      case 'match':
      case 'not':
        for (const s of c.segs) if (isVariableName(s)) out.add(s);
        break;
      case 'eq':
      case 'neq':
      case 'cmp':
        if (isVariableName(c.a)) out.add(c.a);
        if (isVariableName(c.b)) out.add(c.b);
        break;
      case 'calc':
        if (isVariableName(c.r)) out.add(c.r);
        if (isVariableName(c.a)) out.add(c.a);
        if (isVariableName(c.b)) out.add(c.b);
        break;
      case 'count':
        if (isVariableName(c.r)) out.add(c.r);
        if (isVariableName(c.set)) out.add(c.set);
        break;
      case 'or':
        for (const cl of c.clauses) collectCondVars(cl, out);
        break;
      case 'absent':
      case 'exists':
        collectCondVars(c.cs, out);
        break;
      case 'subquery':
        if (isVariableName(c.set)) out.add(c.set);
        for (const f of c.find) if (isVariableName(f)) out.add(f);
        collectCondVars(c.where, out);
        break;
    }
  }
}

const subqVarCache = new WeakMap<Cond, string[]>();

function subqueryKey(c: Cond & { t: 'subquery' }, b: Bindings): string | null {
  let vars = subqVarCache.get(c);
  if (vars === undefined) {
    const s = new Set<string>();
    collectCondVars(c.where, s);
    vars = [...s].sort();
    subqVarCache.set(c, vars);
  }
  let key = c.set;
  for (const v of vars) {
    const x = b.get(v);
    if (x === undefined) key += '\u0000' + v + '\u0001';
    else if (typeof x === 'string') key += '\u0000' + v + '\u0002' + x;
    else return null;
  }
  return key;
}

function evalCond(db: Db, cond: Cond, b: Bindings, out: Bindings[], memo: SubqMemo | null): void {
  switch (cond.t) {
    case 'match':
      unifyInto(db, cond.segs, b, out);
      return;
    case 'not':
      if (!unifiable(db, cond.segs, b)) out.push(b);
      return;
    case 'eq': {
      const l = resolve(b, cond.a);
      const r = resolve(b, cond.b);
      if (l !== undefined && r !== undefined) {
        if (symOf(l) === symOf(r)) out.push(b);
      } else if (l !== undefined) {
        const b2 = new Map(b);
        b2.set(cond.b, l);
        out.push(b2);
      } else if (r !== undefined) {
        const b2 = new Map(b);
        b2.set(cond.a, r);
        out.push(b2);
      }
      return;
    }
    case 'neq': {
      const l = resolve(b, cond.a);
      const r = resolve(b, cond.b);
      if (l !== undefined && r !== undefined && symOf(l) !== symOf(r)) out.push(b);
      return;
    }
    case 'cmp': {
      const l = num(resolve(b, cond.a));
      const r = num(resolve(b, cond.b));
      if (l !== undefined && r !== undefined && applyCmp(cond.op, l, r)) out.push(b);
      return;
    }
    case 'calc': {
      const l = num(resolve(b, cond.a));
      const r = num(resolve(b, cond.b));
      if (l !== undefined && r !== undefined) {
        const b2 = new Map(b);
        b2.set(cond.r, applyCalc(cond.op, l, r));
        out.push(b2);
      }
      return;
    }
    case 'count': {
      const s = resolve(b, cond.set);
      if (s instanceof SetVal) {
        const b2 = new Map(b);
        b2.set(cond.r, s.rows.length);
        out.push(b2);
      }
      return;
    }
    case 'subquery': {
      const key = memo === null ? null : subqueryKey(cond, b);
      let rows: string[][] | undefined;
      let perCond: Map<string, string[][]> | undefined;
      if (key !== null && memo !== null) {
        perCond = memo.get(cond);
        if (perCond === undefined) {
          perCond = new Map();
          memo.set(cond, perCond);
        }
        rows = perCond.get(key);
      }
      if (rows === undefined) {
        const results = query(db, cond.where, b);
        rows = results.map((r) =>
          cond.find.map((lvar) => {
            const v = r.get(lvar);
            return v === undefined ? lvar : valToString(v);
          }),
        );
        if (perCond !== undefined && key !== null) perCond.set(key, rows);
      }
      const b2 = new Map(b);
      b2.set(cond.set, new SetVal(rows));
      out.push(b2);
      return;
    }
    case 'or': {
      const seen = new Set<string>();
      for (const clause of cond.clauses) {
        for (const r of query(db, clause, b)) {
          const k = bindingsKey(r);
          if (!seen.has(k)) {
            seen.add(k);
            out.push(r);
          }
        }
      }
      return;
    }
    case 'absent':
      if (!satisfies(db, cond.cs, b)) out.push(b);
      return;
    case 'exists':
      if (satisfies(db, cond.cs, b)) out.push(b);
      return;
  }
}

// ---- parcours de la frontière d'écriture ------------------------------------

/** Chaque nom qu'une condition MENTIONNE (sur-approximation de ce qu'elle lie). */
export function conditionVars(c: Condition): string[] {
  switch (c.t) {
    case 'match':
    case 'not':
      return segmentNamesChecked(c.s);
    case 'absent':
    case 'exists':
      return flatConditionVars(c.cs);
    case 'or':
      return c.clauses.flatMap((cl) => flatConditionVars(cl));
    case 'subquery':
      return [c.set, ...c.find, ...flatConditionVars(c.where)];
    case 'eq':
    case 'neq':
    case 'cmp':
      return [c.a, c.b];
    case 'calc':
      return [c.r, c.a, c.b];
    case 'count':
      return [c.r, c.set];
  }
}

export function flatConditionVars(cs: readonly Condition[]): string[] {
  const out: string[] = [];
  for (const c of cs) out.push(...conditionVars(c));
  return out;
}

/** Chaque phrase brute qu'une liste de conditions mentionne. */
export function condSents(conds: readonly Condition[]): string[] {
  const out: string[] = [];
  for (const c of conds) {
    switch (c.t) {
      case 'match':
      case 'not':
        out.push(c.s);
        break;
      case 'absent':
      case 'exists':
        out.push(...condSents(c.cs));
        break;
      case 'or':
        for (const cl of c.clauses) out.push(...condSents(cl));
        break;
      case 'subquery':
        out.push(...condSents(c.where));
        break;
      default:
        break;
    }
  }
  return out;
}

/** Substitue des liaisons dans chaque phrase/opérande d'une condition d'écriture. */
export function groundCondition(b: Bindings, c: Condition): Condition {
  const g = (s: string) => ground(tokenize(s), b);
  switch (c.t) {
    case 'match':
      return { t: 'match', s: g(c.s) };
    case 'not':
      return { t: 'not', s: g(c.s) };
    case 'eq':
      return { t: 'eq', a: g(c.a), b: g(c.b) };
    case 'neq':
      return { t: 'neq', a: g(c.a), b: g(c.b) };
    case 'cmp':
      return { t: 'cmp', op: c.op, a: g(c.a), b: g(c.b) };
    case 'calc':
      return { t: 'calc', r: g(c.r), op: c.op, a: g(c.a), b: g(c.b) };
    case 'count':
      return { t: 'count', r: g(c.r), set: g(c.set) };
    case 'subquery':
      return { t: 'subquery', set: g(c.set), find: c.find.map(g), where: c.where.map((x) => groundCondition(b, x)) };
    case 'or':
      return { t: 'or', clauses: c.clauses.map((cl) => cl.map((x) => groundCondition(b, x))) };
    case 'absent':
      return { t: 'absent', cs: c.cs.map((x) => groundCondition(b, x)) };
    case 'exists':
      return { t: 'exists', cs: c.cs.map((x) => groundCondition(b, x)) };
  }
}

/** Chaque chemin de la base qu'une requête compilée peut consulter, à toute polarité. */
export function readAnchors(conds: readonly Cond[]): Array<readonly string[]> {
  const out: Array<readonly string[]> = [];
  for (const c of conds) collectAnchors(c, out);
  return out;
}

function collectAnchors(c: Cond, out: Array<readonly string[]>): void {
  switch (c.t) {
    case 'match':
    case 'not':
      out.push(c.segs);
      return;
    case 'or':
      for (const cl of c.clauses) for (const x of cl) collectAnchors(x, out);
      return;
    case 'absent':
    case 'exists':
      for (const x of c.cs) collectAnchors(x, out);
      return;
    case 'subquery':
      for (const x of c.where) collectAnchors(x, out);
      return;
    default:
      return;
  }
}

/** Substitue un symbole : remplacé ssi c'est une variable liée. */
export function substSym(b: Bindings, s: string): string {
  if (!isVariableName(s)) return s;
  const v = b.get(s);
  return v === undefined ? s : valToString(v);
}

export function groundNames(b: Bindings, syms: readonly string[]): string[] {
  return syms.map((s) => substSym(b, s));
}

/** Substitue des liaisons dans une condition compilée. */
export function groundCond(b: Bindings, c: Cond): Cond {
  switch (c.t) {
    case 'match':
      return { t: 'match', segs: groundNames(b, c.segs) };
    case 'not':
      return { t: 'not', segs: groundNames(b, c.segs) };
    case 'eq':
      return { t: 'eq', a: substSym(b, c.a), b: substSym(b, c.b) };
    case 'neq':
      return { t: 'neq', a: substSym(b, c.a), b: substSym(b, c.b) };
    case 'cmp':
      return { t: 'cmp', op: c.op, a: substSym(b, c.a), b: substSym(b, c.b) };
    case 'calc':
      return { t: 'calc', r: substSym(b, c.r), op: c.op, a: substSym(b, c.a), b: substSym(b, c.b) };
    case 'count':
      return { t: 'count', r: substSym(b, c.r), set: substSym(b, c.set) };
    case 'subquery':
      return { t: 'subquery', set: substSym(b, c.set), find: c.find.map((f) => substSym(b, f)), where: c.where.map((x) => groundCond(b, x)) };
    case 'or':
      return { t: 'or', clauses: c.clauses.map((cl) => cl.map((x) => groundCond(b, x))) };
    case 'absent':
      return { t: 'absent', cs: c.cs.map((x) => groundCond(b, x)) };
    case 'exists':
      return { t: 'exists', cs: c.cs.map((x) => groundCond(b, x)) };
  }
}

/** Rendu lisible d'une condition compilée (diagnostics). */
export function renderCond(c: Cond): string {
  switch (c.t) {
    case 'match':
      return `Match ${c.segs.join('.')}`;
    case 'not':
      return `Not ${c.segs.join('.')}`;
    default:
      return JSON.stringify(c);
  }
}
