/**
 * Tests de résistance et couverture par marche aléatoire (`Prax.Stress`) :
 * chaque personnage prend une action disponible au hasard, on rapporte les
 * fins atteintes, les actions jouées, les impasses.
 *
 * Le générateur est le LCG MMIX de Knuth sur 64 bits (BigInt) — distinct du dé
 * dramatique MINSTD du moteur.
 *
 * Reprend `prax-core/src/stress.rs` (Prax, BSD-3-Clause).
 */
import { State } from './engine';
import { advance } from './turn';

const MASK = (1n << 64n) - 1n;

export function lcg(x: bigint): bigint {
  return (6364136223846793005n * x + 1442695040888963407n) & MASK;
}

/** Un index uniforme dans [0, n) et la graine suivante. */
export function pick(n: number, s: bigint): [number, bigint] {
  if (n <= 0) throw new Error('pick : liste de candidats vide');
  const s2 = lcg(s);
  return [Number(s2 % BigInt(n)), s2];
}

export type RunStop = { k: 'Cap' } | { k: 'Ending'; ending: string } | { k: 'Extinct' } | { k: 'DeadEnd' };

/** La décision d'arrêt avant `advance` : plafond, fin, extinction, impasse. */
export function preAdvanceStop(k: number, ending: string | null, living: number, passes: number): RunStop | null {
  if (k === 0) return { k: 'Cap' };
  if (ending !== null) return { k: 'Ending', ending };
  if (living === 0) return { k: 'Extinct' };
  if (passes > living) return { k: 'DeadEnd' };
  return null;
}

export interface RunResult {
  ending: string | null;
  actions: Set<string>;
  visited: Set<string>;
  deadEnd: boolean;
  turns: number;
}

export interface StressReport {
  runs: number;
  endings: Map<string, number>;
  coverage: Set<string>;
  visited: Map<string, number>;
  deadEnds: number;
  noEnding: number;
}

export function endingReached(st: State): string | null {
  const ks = st.dbChildKeys('ending');
  return ks.length > 0 ? ks[0] : null;
}

function familyReached(st: State, family: string): string | null {
  const ks = st.dbChildKeys(family);
  return ks.length > 0 ? ks[0] : null;
}

function recordVisit(st: State, visited: Set<string>, family: string | null): void {
  if (family === null) return;
  const s = familyReached(st, family);
  if (s !== null) visited.add(s);
}

/** Une partie aléatoire d'au plus `cap` tours. */
export function runRandom(st0: State, cap: number, seed: bigint, family: string | null): RunResult {
  const st = st0.clone();
  const actions = new Set<string>();
  const visited = new Set<string>();
  recordVisit(st, visited, family);
  let k = cap;
  let s = seed;
  let passes = 0;
  let turns = 0;
  for (;;) {
    const ending = endingReached(st);
    const stop = preAdvanceStop(k, ending, st.livingCharacterCount(), passes);
    if (stop !== null) {
      const end = stop.k === 'Cap' ? ending : stop.k === 'Ending' ? stop.ending : null;
      return { ending: end, actions, visited, deadEnd: stop.k === 'DeadEnd', turns };
    }
    const actor = advance(st);
    const acts = st.possibleActions(actor.name);
    if (acts.length === 0) {
      recordVisit(st, visited, family);
      passes++;
      continue;
    }
    const [i, s2] = pick(acts.length, s);
    const ga = acts[i];
    actions.add(ga.actionId);
    st.performAction(ga);
    recordVisit(st, visited, family);
    turns++;
    passes = 0;
    k--;
    s = s2;
  }
}

/** `seedFor i = i * 2654435761` (64 bits). */
export function seedFor(i: number): bigint {
  return (BigInt(i) * 2654435761n) & MASK;
}

/** `runs` parties aléatoires agrégées. */
export function stressTest(runs: number, cap: number, family: string | null, st0: State): StressReport {
  const report: StressReport = { runs, endings: new Map(), coverage: new Set(), visited: new Map(), deadEnds: 0, noEnding: 0 };
  for (let i = 1; i <= runs; i++) {
    const res = runRandom(st0, cap, seedFor(i), family);
    if (res.ending !== null) report.endings.set(res.ending, (report.endings.get(res.ending) ?? 0) + 1);
    for (const a of res.actions) report.coverage.add(a);
    for (const v of res.visited) report.visited.set(v, (report.visited.get(v) ?? 0) + 1);
    if (res.deadEnd) report.deadEnds++;
    if (res.ending === null && !res.deadEnd) report.noEnding++;
  }
  return report;
}
