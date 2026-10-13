/**
 * Choix d'action par utilité (Versu §IX) avec l'anticipation « esprits crus »
 * v23 et la mémoïsation de prédiction v34.
 *
 * L'arithmétique des scores est transcrite opération par opération : l'ordre
 * d'association (`base + (acc + 0.9v)`, jamais `(base + acc) + 0.9v`) fait
 * partie du contrat. Les nombres JavaScript sont des doubles IEEE stricts, comme
 * les f64 de Rust : les bits correspondent.
 *
 * Reprend `prax-core/src/planner.rs` (Prax, BSD-3-Clause).
 */
import { Bindings, Db, childKeys, exists, emptyBindings } from './db';
import { Model, believedDesires, cookedDesiresFor, cookedSelfWants } from './minds';
import { tokenize } from './path';
import {
  Defs,
  GroundedAction,
  MotiveSignature,
  Runtime,
  cloneRuntime,
  groundedDeltaAnchors,
  performActionOn,
  possibleActionsImpl,
} from './perform';
import { Cond, groundCond, query, satisfies } from './query';
import { mayUnifySyms, moverReadAnchors } from './relevance';
import { Character } from './types';
import { cmpStr, stableSort, strArrEq } from './util';

export type { Intention, MotiveSignature } from './perform';

type Names = readonly string[];
/** L'effet accumulé d'un chemin imaginé ; `null` = opaque (pas de réutilisation dessous). */
type PathDelta = Names[] | null;

/** Options de diagnostic : vérifier que chaque prédiction réutilisée égale la prédiction vivante. */
export const plannerDebug = { checkReuse: false, reuseHits: 0 };

/** Utilité entière d'un monde pour un modèle : Σ utilité × nombre de liaisons. */
export function evaluateCompiled(view: Db, model: Model): number {
  const seed = emptyBindings();
  let total = 0;
  for (const [cs, u] of model) {
    if (u === 0) continue;
    total += u * query(view, cs, seed).length;
  }
  return total;
}

function isDead(db: Db, name: string): boolean {
  return exists(db, tokenize(`dead.${name}`).segs);
}

/** Les actions qu'un personnage peut réellement entreprendre (les morts n'en ont aucune). */
export function candidateActions(defs: Defs, rt: Runtime, c: Character): GroundedAction[] {
  if (isDead(rt.db, c.name)) return [];
  const acts = possibleActionsImpl(defs, rt.view, c.name);
  return c.boundTo === null ? acts : acts.filter((a) => a.practiceId === c.boundTo);
}

/** Le personnage `m` est-il dans la portée de prédiction de l'acteur ? */
export function inScope(defs: Defs, rt: Runtime, actor: Character, m: Character): boolean {
  const b: Bindings = new Map([
    ['Actor', actor.name],
    ['Witness', m.name],
  ]);
  const grounded = defs.compiled.scope.map((c) => groundCond(b, c));
  return satisfies(rt.view, grounded, emptyBindings());
}

function ownerBinding(name: string): Bindings {
  return new Map([['Owner', name]]);
}

/** Un désir cru est-il mort MAINTENANT (à son plancher, ou fermé par sa garde) ? */
function deadNow(defs: Defs, rt: Runtime, mName: string, desire: string): boolean {
  const lv = defs.compiled.liveness.get(desire);
  if (lv === undefined) return false;
  const owner = ownerBinding(mName);
  if (lv.k === 'FloorCheck') {
    const conds = defs.compiled.desires.get(desire) ?? [];
    return !satisfies(rt.view, conds, owner);
  }
  if (lv.k === 'GateCheck') return lv.gates.some((g) => !satisfies(rt.view, g, owner));
  return false;
}

/**
 * Ce que le prédicteur `p` devine du prochain coup de `m` : le meilleur candidat
 * de `m` selon le modèle que `p` se fait de lui — seulement s'il améliore
 * strictement ce modèle par rapport à ne rien faire.
 */
export function predictMove(defs: Defs, rt: Runtime, p: Character, m: Character): GroundedAction | null {
  const ds = believedDesires(rt.view, defs.desires, p.name, m.name);
  if (ds.length === 0) return null;
  const improvables = defs.compiled.improvables;
  const allDead = ds.every((d) => !improvables.includes(d.name) || deadNow(defs, rt, m.name, d.name));
  if (allDead) return null;
  const model = cookedDesiresFor(defs.compiled.desires, m.name, ds);
  const still = evaluateCompiled(rt.view, model);
  const cands = candidateActions(defs, rt, m);
  const scored: Array<[GroundedAction, number]> = [];
  for (const a of cands) {
    const fork = cloneRuntime(rt);
    performActionOn(defs, fork, a);
    scored.push([a, evaluateCompiled(fork.view, model)]);
  }
  const sorted = stableSort(scored, (x, y) => (y[1] !== x[1] ? (y[1] > x[1] ? 1 : -1) : cmpStr(x[0].label, y[0].label)));
  if (sorted.length > 0 && sorted[0][1] > still) return sorted[0][0];
  return null;
}

/** Les personnages vivants autres que l'acteur, un cycle complet à partir de lui. */
function othersAfter(defs: Defs, rt: Runtime, actor: Character): Character[] {
  const cs = livingCharacters(defs, rt);
  const k = cs.findIndex((c) => c.name === actor.name);
  const i = k >= 0 ? k : Math.max(cs.length - 1, 0);
  const start = i + 1;
  return [...cs.slice(start), ...cs.slice(0, start)].filter((c) => c.name !== actor.name);
}

export function livingCharacters(defs: Defs, rt: Runtime): Character[] {
  return defs.characters.filter((c) => !isDead(rt.db, c.name));
}

function containsNames(xs: readonly Names[], h: Names): boolean {
  return xs.some((x) => strArrEq(x, h));
}

/** Étend un delta de chemin avec les ancres d'un coup, cône dérivé inclus. */
function extendDelta(defs: Defs, delta: PathDelta, next: Names[] | null): PathDelta {
  if (delta === null || next === null) return null;
  const footprint = defs.compiled.footprint;
  const feeds = next.some((n) => footprint.some((f) => mayUnifySyms(n, f)));
  const result = [...delta, ...next];
  if (feeds) for (const h of defs.compiled.axiomHeads) if (!containsNames(delta, h)) result.push(h);
  return result;
}

interface PickMemo {
  cohort: readonly string[];
  steps: Map<string, GroundedAction | null>;
  reads: Map<string, Names[]>;
}

function stepPredict(defs: Defs, s: Runtime, actor: Character, m: Character): GroundedAction | null {
  return inScope(defs, s, actor, m) ? predictMove(defs, s, actor, m) : null;
}

function predictAt(defs: Defs, memo: PickMemo, st0: Runtime, actor: Character, delta: PathDelta, s: Runtime, m: Character): GroundedAction | null {
  if (delta !== null && memo.cohort.includes(m.name)) {
    let rs = memo.reads.get(m.name);
    if (rs === undefined) {
      const c = defs.compiled;
      rs = moverReadAnchors(c.scope, c.practices, c.fns, c.desires, actor.name, m.name);
      memo.reads.set(m.name, rs);
    }
    const reads = rs;
    const intersects = delta.some((dd) => reads.some((r) => mayUnifySyms(dd, r)));
    if (!intersects) {
      if (!memo.steps.has(m.name)) memo.steps.set(m.name, stepPredict(defs, st0, actor, m));
      const reused = memo.steps.get(m.name) ?? null;
      if (plannerDebug.checkReuse) {
        const live = stepPredict(defs, s, actor, m);
        if (!groundedActionEqNullable(reused, live)) throw new Error(`Prax v34 : la prédiction réutilisée diffère de la vivante pour ${m.name}`);
        plannerDebug.reuseHits++;
      }
      return reused;
    }
  }
  return stepPredict(defs, s, actor, m);
}

function go(defs: Defs, memo: PickMemo, st0: Runtime, actor: Character, d: number, delta: PathDelta, st: Runtime, selfWants: Model): Array<[GroundedAction, number]> {
  const scored: Array<[GroundedAction, number]> = [];
  for (const a of candidateActions(defs, st, actor)) {
    const delta1 = extendDelta(defs, delta, groundedDeltaAnchors(defs, a));
    const st1 = cloneRuntime(st);
    performActionOn(defs, st1, a);
    scored.push([a, valueAfter(defs, memo, st0, actor, d, delta1, st1, selfWants)]);
  }
  return stableSort(scored, (x, y) => (y[1] !== x[1] ? (y[1] > x[1] ? 1 : -1) : cmpStr(x[0].label, y[0].label)));
}

function valueAfter(defs: Defs, memo: PickMemo, st0: Runtime, actor: Character, d: number, delta: PathDelta, st1: Runtime, selfWants: Model): number {
  const base = evaluateCompiled(st1.view, selfWants);
  if (d <= 0) return base;
  const others = othersAfter(defs, st1, actor);
  let acc = 0.0;
  const s = cloneRuntime(st1);
  let dlt = delta;
  for (const m of others) {
    const ga = predictAt(defs, memo, st0, actor, dlt, s, m);
    if (ga === null) continue;
    const next = groundedDeltaAnchors(defs, ga);
    performActionOn(defs, s, ga);
    dlt = extendDelta(defs, dlt, next);
    acc += 0.5 * evaluateCompiled(s.view, selfWants);
  }
  const rows = go(defs, memo, st0, actor, d - 1, dlt, s, selfWants);
  const selfNext = rows.length > 0 ? 0.9 * rows[0][1] : 0.0;
  return base + (acc + selfNext);
}

/** Note chaque candidat de l'acteur à la racine du choix (meilleur d'abord). */
export function scoreActions(defs: Defs, rt: Runtime, depth: number, actor: Character): Array<[GroundedAction, number]> {
  const memo: PickMemo = { cohort: othersAfter(defs, rt, actor).map((c) => c.name), steps: new Map(), reads: new Map() };
  const c = defs.compiled;
  const selfWants = cookedSelfWants(c.wants, c.desires, defs.desires, actor);
  return go(defs, memo, rt, actor, depth, [], rt, selfWants);
}

/** La meilleure action de l'acteur, s'il y en a une. */
export function pickAction(defs: Defs, rt: Runtime, depth: number, actor: Character): GroundedAction | null {
  const rows = scoreActions(defs, rt, depth, actor);
  return rows.length > 0 ? rows[0][0] : null;
}

/** La signature de motivation courante (sans anticipation). */
export function motiveSignature(defs: Defs, rt: Runtime, c: Character): MotiveSignature {
  const bearingSet = defs.compiled.caresAbout.get(c.name) ?? [];
  const cands = candidateActions(defs, rt, c);
  const bearing = [...new Set(cands.map((g) => g.actionId).filter((aid) => bearingSet.includes(aid)))].sort(cmpStr);
  const selfWants = cookedSelfWants(defs.compiled.wants, defs.compiled.desires, defs.desires, c);
  const seed = emptyBindings();
  const satisfaction = selfWants.map(([cs]) => query(rt.view, cs, seed).length);
  const improvables = defs.compiled.improvables;
  const liveDesires: string[] = [];
  for (const d of defs.desires) {
    if (c.desires.includes(d.name) && improvables.includes(d.name) && !deadNow(defs, rt, c.name, d.name)) liveDesires.push(d.name);
  }
  return { bearing, satisfaction, liveDesires, knownMotives: knownMotivesOf(rt.view, c.name) };
}

function knownMotivesOf(view: Db, name: string): Array<[string, string]> {
  const prefix = `${name}.believes.desires`;
  const out: Array<[string, string]> = [];
  for (const mv of childKeys(view, tokenize(prefix).segs)) {
    for (const d of childKeys(view, tokenize(`${prefix}.${mv}`).segs)) out.push([mv, d]);
  }
  return out;
}

// ---- égalités ----------------------------------------------------------------

import { bindingsEq } from './db';

export function groundedActionEq(a: GroundedAction, b: GroundedAction): boolean {
  return a.practiceId === b.practiceId && a.instanceId === b.instanceId && a.actionId === b.actionId && a.label === b.label && bindingsEq(a.bindings, b.bindings);
}

export function groundedActionEqNullable(a: GroundedAction | null, b: GroundedAction | null): boolean {
  if (a === null || b === null) return a === b;
  return groundedActionEq(a, b);
}

export function motiveSignatureEq(a: MotiveSignature, b: MotiveSignature): boolean {
  if (!strArrEq(a.bearing, b.bearing) || !strArrEq(a.liveDesires, b.liveDesires)) return false;
  if (a.satisfaction.length !== b.satisfaction.length || a.satisfaction.some((x, i) => x !== b.satisfaction[i])) return false;
  if (a.knownMotives.length !== b.knownMotives.length) return false;
  return a.knownMotives.every((x, i) => x[0] === b.knownMotives[i][0] && x[1] === b.knownMotives[i][1]);
}

export type { Cond };
