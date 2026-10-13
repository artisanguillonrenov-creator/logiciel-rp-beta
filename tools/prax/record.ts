/**
 * Les enregistrements de l'oracle différentiel, construits champ pour champ
 * comme `prax-oracle/src/record.rs` et `drive_rust.rs` (Prax, BSD-3-Clause),
 * pour comparer notre moteur aux parties de référence produites par l'original.
 */
import { State } from '../../src/prax/core/engine';
import { EffectStep, GroundedAction, Intention } from '../../src/prax/core/perform';
import { rollStep } from '../../src/prax/core/rng';
import { advance, npcActLogged } from '../../src/prax/core/turn';
import { pick, preAdvanceStop, endingReached } from '../../src/prax/core/stress';

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Mode = 'decisions' | 'state' | 'view';

export interface Emit {
  candidates: boolean;
  scores: boolean;
  identity: boolean;
  logs: boolean;
}

function mapObj(m: Map<string, number>): { [k: string]: Json } {
  const o: { [k: string]: Json } = {};
  for (const [k, v] of m) o[k] = v;
  return o;
}

export function stateFields(st: State): { [k: string]: Json } {
  return { cursor: st.cursor, rng: st.rngSeed, dues: mapObj(st.scheduleDues()), expiries: mapObj(st.expiriesRendered()) };
}

export function factFields(st: State, mode: Mode): { [k: string]: Json } {
  if (mode === 'decisions') return {};
  if (mode === 'state') return { facts: st.labeledFacts() };
  return { facts: st.labeledFacts(), view: st.labeledView() };
}

/** Les bits IEEE-754 d'un double, en chaîne décimale (comparaison sans décimales). */
export function f64Bits(x: number): string {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  return dv.getBigUint64(0).toString();
}

function identity(st: State, ga: GroundedAction): Json {
  const b: { [k: string]: Json } = {};
  for (const [k, v] of st.renderBindings(ga.bindings)) b[k] = v;
  return { practice_id: ga.practiceId, instance_id: ga.instanceId, action_id: ga.actionId, bindings: b };
}

function streamValues(before: number | null, after: number | null): number[] {
  if (before === null || after === null) return [];
  const out: number[] = [];
  let s = before;
  while (s !== after) {
    if (out.length >= 4096) throw new Error('le flux du dé a bougé de plus de 4096 pas');
    s = rollStep(s);
    out.push(s);
  }
  return out;
}

function drawEntry(step: EffectStep): Json {
  return {
    i: step.index,
    odds: step.odds.map(([n, d]) => [n, d]),
    before: step.rngBefore,
    after: step.rngAfter,
    values: streamValues(step.rngBefore, step.rngAfter),
    changed: step.changed,
  };
}

function intentionJson(i: Intention | undefined): Json {
  if (i === undefined) return null;
  return {
    act: i.act === null ? null : i.act.label,
    basis: {
      bearing: [...i.basis.bearing],
      satisfaction: [...i.basis.satisfaction],
      liveDesires: [...i.basis.liveDesires],
      knownMotives: i.basis.knownMotives.map(([m, d]) => [m, d]),
    },
  };
}

function boundaryLog(pre: State, post: State): Json {
  const now = pre.currentTurn() + 1;
  const dues = pre.scheduleDues();
  const dueRules = pre.scheduleSrc().filter((r) => (dues.get(r.name) ?? Number.MAX_SAFE_INTEGER) <= now).map((r) => r.name);
  const entries: Json[] = [];
  for (const [path, due] of pre.expiriesRendered()) {
    if (due > now) continue;
    entries.push({ path, due, existed_before: pre.dbHas(path), present_after: post.dbHas(path) });
  }
  return { now, due_rules: dueRules, due_expiries: entries };
}

function emitHeader(em: Emit): { [k: string]: Json } {
  return { candidates: em.candidates, scores: em.scores, identity: em.identity, logs: em.logs };
}

/** La marche « trace » : chaque tour, avancer et (sauf le joueur inactif) faire agir le planificateur. */
export function traceWalk(st: State, world: string, em: Emit, depth: number, total: number, idle: string | null, mode: Mode): Json[] {
  const out: Json[] = [{ format: 1, engine: 'rust', world, turns: total, idle, depth, mode, seed: null, ...emitHeader(em) }];
  for (let t = 1; t <= total; t++) {
    const pre = em.logs ? st.clone() : null;
    const before = st.currentTurn();
    const actor = advance(st);
    const boundary = st.currentTurn() !== before;
    const rec: { [k: string]: Json } = { t, boundary, actor: actor.name };
    if (boundary && em.logs && pre !== null) rec.boundary_log = boundaryLog(pre, st);
    if (actor.name === idle) {
      rec.action = '-';
      rec.idle = true;
      out.push({ ...rec, ...stateFields(st), ...factFields(st, mode) });
      continue;
    }
    if (em.candidates) rec.candidates = st.candidateActions(actor).map((g) => g.label);
    if (em.scores) {
      const rows: Json[] = [];
      for (let d = 0; d <= depth; d++) rows.push({ depth: d, rows: st.scoreActions(d, actor).map(([g, s]) => ({ label: g.label, bits: f64Bits(s) })) });
      rec.scores = rows;
      rec.intention_before = intentionJson(st.intentionOf(actor.name));
    }
    const steps: Json[] = [];
    const acted = npcActLogged(st, depth, actor, (s) => steps.push(drawEntry(s)));
    if (em.logs) rec.draws = steps;
    if (em.identity) rec.identity = acted === null ? null : identity(st, acted);
    if (em.scores) rec.intention_after = intentionJson(st.intentionOf(actor.name));
    rec.action = acted === null ? '-' : acted.label;
    rec.idle = acted === null;
    out.push({ ...rec, ...stateFields(st), ...factFields(st, mode) });
  }
  out.push({ end: true, reason: 'turns', ending: null, passes: 0, records: total });
  return out;
}

/** La marche aléatoire `randtrace` (rejoue `Prax.Stress.runRandom`). */
export function randWalk(st: State, world: string, em: Emit, mode: Mode, cap: number, seed: number, dieSeed: number | null): Json[] {
  const out: Json[] = [{ format: 1, engine: 'rust', world, seed, cap, mode, dieSeed, ...emitHeader(em) }];
  let passes = 0;
  let t = 1;
  let k = cap;
  let s = BigInt(seed);
  let recs = 0;
  for (;;) {
    const ending = endingReached(st);
    const stop = preAdvanceStop(k, ending, st.livingCharacterCount(), passes);
    if (stop !== null) {
      const reason = stop.k === 'Cap' ? 'cap' : stop.k === 'Ending' ? 'ending' : stop.k === 'Extinct' ? 'extinct' : 'deadend';
      out.push({ end: true, reason, ending: stop.k === 'Ending' ? stop.ending : null, passes, records: recs });
      return out;
    }
    const pre = em.logs ? st.clone() : null;
    const before = st.currentTurn();
    const actor = advance(st);
    const boundary = st.currentTurn() !== before;
    const rec: { [k: string]: Json } = { t, boundary, actor: actor.name };
    if (boundary && em.logs && pre !== null) rec.boundary_log = boundaryLog(pre, st);
    const acts = st.possibleActions(actor.name);
    if (acts.length === 0) {
      if (em.candidates) rec.candidates = [];
      if (em.identity) rec.identity = null;
      out.push({ ...rec, action: null, idle: true, passes, walkSeed: null, ...stateFields(st), ...factFields(st, mode) });
      passes++;
      recs++;
      continue;
    }
    const [i, s2] = pick(acts.length, s);
    const ga = acts[i];
    const steps: Json[] = [];
    st.performActionLogged(ga, (x) => steps.push(drawEntry(x)));
    if (em.logs) rec.draws = steps;
    if (em.candidates) rec.candidates = acts.map((g) => g.label);
    if (em.identity) rec.identity = identity(st, ga);
    out.push({ ...rec, action: ga.label, idle: false, passes, walkSeed: s2.toString(), ...stateFields(st), ...factFields(st, mode) });
    passes = 0;
    t++;
    k--;
    s = s2;
    recs++;
  }
}
