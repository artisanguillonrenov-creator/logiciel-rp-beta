/**
 * Portage TypeScript des tests du TEMPS du moteur Prax (Rust, BSD-3-Clause) :
 *   - prax-core/src/schedule.rs (module #[cfg(test)]) ;
 *   - conformance/src/{schedule_spec.rs, schedule_rule_spec.rs, loop_advance.rs,
 *     loop_bar.rs, supersession_world.rs}.
 *
 * Le reste du cœur (engine.rs, …) est dans tests/praxCoreEngine.test.ts.
 * Chaque test garde sa référence d'origine (`// R:` et, s'il y en a, `// H:`).
 * Le proptest `round_boundary_is_insertion_order_insensitive` est rejoué de façon
 * déterministe en énumérant TOUT le domaine de son générateur (63 sous-suites).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { State, door } from '../src/prax/core/engine';
import { WorldError, WorldErrorKind } from '../src/prax/core/errors';
import { Condition, matches } from '../src/prax/core/query';
import { gathering, lasts, sightRule } from '../src/prax/core/schedule';
import { advance, runNpcTicks } from '../src/prax/core/turn';
import { typeCheck } from '../src/prax/core/typecheck';
import { Outcome, ScheduleRule, character, del, insert, insertFor, scheduleRule } from '../src/prax/core/types';
import { ANGRY, feelTowardFor } from '../src/prax/vocab/emotion';
import { barWorld } from '../src/prax/worlds/bar';
import { playWorld } from '../src/prax/worlds/play';
import { villageWorld } from '../src/prax/worlds/village';

const RACINE = process.env.PRAX_RACINE ?? join(__dirname, '..', '..');

const m = (s: string): Condition => matches(s);

const isWE =
  (kind: WorldErrorKind, check: (d: Readonly<Record<string, unknown>>) => boolean = () => true) =>
  (e: unknown): boolean =>
    e instanceof WorldError && e.kind === kind && check(e.details);

const trailing = (sentence: string, op: string) => isWE('TrailingOperator', (d) => d.sentence === sentence && d.op === op);

/** Toutes les sous-suites (ordre conservé) de [0..n) dont la taille est dans [lo, hi]. */
function subsequences(len: number, lo: number, hi: number): number[][] {
  const out: number[][] = [];
  for (let mask = 0; mask < 1 << len; mask++) {
    const pick: number[] = [];
    for (let i = 0; i < len; i++) if (mask & (1 << i)) pick.push(i);
    if (pick.length >= lo && pick.length <= hi) out.push(pick);
  }
  return out;
}

// =============================================================================
// prax-core/src/schedule.rs — mod tests
// =============================================================================

// R: schedule.rs lasts_wraps_an_insert_as_insert_for
test('schedule.rs : lasts enveloppe une insertion en InsertFor', () => {
  assert.deepEqual(lasts(3, insert('mood!a')), insertFor(3, 'mood!a'));
});

// R: schedule.rs lasts_rejects_a_non_insert
test('schedule.rs : lasts refuse ce qui n’est pas une insertion', () => {
  assert.throws(() => lasts(3, del('mood.a')), isWE('LifetimeOnNonInsert'));
});

// R: schedule.rs gathering_maps_lasts_over_the_open_outcomes
test('schedule.rs : gathering applique lasts aux effets d’ouverture', () => {
  const r = gathering('fair', 3, 1, [insert('marketDay.now')]);
  assert.equal(r.name, 'fair');
  assert.equal(r.period, 3);
  assert.deepEqual(r.body, [[[], [insertFor(1, 'marketDay.now')]]]);
});

// R: schedule.rs gathering_rejects_duration_at_or_over_period
test('schedule.rs : gathering refuse une durée nulle ou ≥ période', () => {
  assert.throws(() => gathering('fair', 3, 3, [insert('x')]), isWE('GatheringDuration'));
  assert.throws(() => gathering('fair', 3, 0, [insert('x')]), isWE('GatheringDuration'));
});

// ---- schedule.rs — mod sighting_template_guard ----------------------------------
// H: SightSpec.hs "the schedule setter guards the sighting template (re-homed from the v40/v43 sightP guard)"

const setSighting = (sighting: Condition[]): void => new State().setSchedule([sightRule(sighting)]);

// R: schedule.rs sighting_template_guard::a_prax_namespaced_sighting_template_is_rejected
// H: SightSpec.hs "a sighting template authoring the Prax namespace is a loud construction-time error"
test('schedule.rs : un gabarit d’aperçu écrivant l’espace Prax est refusé', () => {
  assert.throws(
    () => setSighting([m('at.PraxN!Spot'), m('at.Seen!Spot')]),
    isWE('ReservedVarClash', (d) => d.var === 'PraxN'),
  );
});

// R: schedule.rs sighting_template_guard::seer_seen_spot_remain_legal
// H: SightSpec.hs "Seer/Seen/Spot remain legal -- they are the contract, not forbidden"
test('schedule.rs : Seer/Seen/Spot restent légaux', () => {
  assert.doesNotThrow(() => setSighting([m('at.Seer!Spot'), m('at.Seen!Spot')]), 'the ordinary Seer/Seen/Spot fixture is NOT rejected');
});

// R: schedule.rs sighting_template_guard::an_actor_authoring_sighting_template_is_rejected
// H: SightSpec.hs "a sighting template authoring Actor is a loud construction-time error"
test('schedule.rs : un gabarit d’aperçu écrivant Actor est refusé', () => {
  assert.throws(
    () => setSighting([m('at.Actor!Spot'), m('at.Seen!Spot')]),
    isWE('ReservedVarClash', (d) => d.var === 'Actor'),
  );
});

// R: schedule.rs sight_rule_stamps_the_clock_and_the_believes_outcomes
test('schedule.rs : sightRule ajoute l’horloge et les effets de croyance', () => {
  const r = sightRule([m('at.Seer!Spot')]);
  assert.equal(r.name, 'sight');
  assert.equal(r.period, 1);
  const [when, then] = r.body[0];
  assert.deepEqual(when, [m('at.Seer!Spot'), { t: 'neq', a: 'Seer', b: 'Seen' }, m('turn!Now')]);
  assert.deepEqual(then, [insert('Seer.believes.at.Seen!Spot'), insert('Seer.believes.atSince.Seen!Now')]);
});

// =============================================================================
// conformance/src/schedule_spec.rs (H: ScheduleSpec.hs "Prax.Schedule")
// =============================================================================
// H: ScheduleSpec.hs "the expiry queue"

// R: schedule_spec.rs law_1_insertfor_holds_for_n_boundaries
// H: ScheduleSpec.hs "law 1: an InsertFor fact holds for n boundaries and is gone at the nth"
test('schedule_spec.rs : loi 1 — un InsertFor tient n frontières et disparaît à la n-ième', () => {
  const st = new State();
  st.performOutcome(insertFor(2, 'mood!a'));
  assert.equal(st.currentTurn(), 0);
  assert.ok(st.dbHas('mood.a'), 'present at insert');
  st.roundBoundary();
  assert.ok(st.dbHas('mood.a'), 'present after 1 boundary');
  st.roundBoundary();
  assert.ok(!st.dbHas('mood.a'), 'gone at the 2nd boundary');
  assert.equal(st.expiriesRendered().size, 0);
});

// R: schedule_spec.rs law_2_re_insertfor_refreshes
// H: ScheduleSpec.hs "law 2: re-InsertFor before due refreshes — survives the old due, dies at the new"
test('schedule_spec.rs : loi 2 — un re-InsertFor avant échéance rafraîchit', () => {
  const st = new State();
  st.performOutcome(insertFor(2, 'mood!a'));
  st.roundBoundary();
  st.performOutcome(insertFor(2, 'mood!a'));
  st.roundBoundary();
  assert.ok(st.dbHas('mood.a'), 'survives past the old due (turn 2)');
  st.roundBoundary();
  assert.ok(!st.dbHas('mood.a'), 'dies at the refreshed due (turn 3)');
});

// R: schedule_spec.rs law_3_bare_re_insert_cancels_the_timer
// H: ScheduleSpec.hs "law 3: a bare re-insert cancels the timer — the fact never expires"
test('schedule_spec.rs : loi 3 — une ré-insertion nue annule le minuteur', () => {
  const st = new State();
  st.performOutcome(insertFor(2, 'mood!a'));
  st.performOutcome(insert('mood!a'));
  assert.equal(st.expiriesRendered().size, 0);
  for (let i = 0; i < 5; i++) st.roundBoundary();
  assert.ok(st.dbHas('mood.a'), 'still standing after five boundaries');
});

// R: schedule_spec.rs law_4_authored_delete_purges_the_subtrees_timers
// H: ScheduleSpec.hs "law 4: an authored delete purges the subtree's timers — no later ghost retract"
test('schedule_spec.rs : loi 4 — un retrait écrit purge les minuteurs du sous-arbre', () => {
  const st = new State();
  st.performOutcome(insertFor(2, 'feels.anger.toward.bob'));
  st.performOutcome(del('feels.anger'));
  assert.equal(st.expiriesRendered().size, 0);
  st.performOutcome(insert('feels.anger.toward.bob'));
  for (let i = 0; i < 5; i++) st.roundBoundary();
  assert.ok(st.dbHas('feels.anger.toward.bob'), 'the re-asserted fact is untouched by any stale timer');
});

// R: schedule_spec.rs law_5_eviction_leaves_the_displaced_timer_queued
// H: ScheduleSpec.hs "law 5: a !-eviction leaves the displaced timer queued, and its firing is a harmless no-op"
test('schedule_spec.rs : loi 5 — une éviction `!` laisse le minuteur déplacé en file, sans effet', () => {
  const st = new State();
  st.performOutcome(insertFor(2, 'mood!a'));
  st.performOutcome(insert('mood!b'));
  assert.ok(!st.dbHas('mood.a'), 'the displaced value is already gone');
  st.roundBoundary();
  st.roundBoundary();
  assert.ok(st.dbHas('mood.b'), 'the surviving value still stands');
  assert.equal(st.expiriesRendered().size, 0);
});

// R: schedule_spec.rs law_6_interior_lifetime_takes_its_descendants
// H: ScheduleSpec.hs "law 6: a lifetime on an interior path takes its descendants at expiry"
test('schedule_spec.rs : loi 6 — une durée de vie intérieure emporte ses descendants', () => {
  const st = new State();
  st.performOutcome(insertFor(2, 'feels.anger'));
  st.performOutcome(insert('feels.anger.toward.bob'));
  st.roundBoundary();
  st.roundBoundary();
  assert.ok(!st.dbHas('feels.anger'), 'the interior fact is gone');
  assert.ok(!st.dbHas('feels.anger.toward.bob'), 'its descendant went with it');
});

// ===== la frontière de tour =====
// H: ScheduleSpec.hs "the round boundary"

// R: schedule_spec.rs law_7_ghost_observation_expiries_fire_before_rules
// H: ScheduleSpec.hs "law 7 (ghost observation): expiries fire BEFORE rules — a period-1 rule does not see an expiring fact"
test('schedule_spec.rs : loi 7 — les expirations tirent AVANT les règles', () => {
  const sighting = scheduleRule('sighting', 1, [[[m('mood!Now')], [insert('sighted.Now')]]]);
  const ctl = new State();
  ctl.setSchedule([sighting]);
  ctl.performOutcome(insertFor(2, 'mood!a'));
  ctl.roundBoundary();
  const ghost = new State();
  ghost.setSchedule([sighting]);
  ghost.performOutcome(insertFor(1, 'mood!a'));
  ghost.roundBoundary();
  assert.ok(ctl.dbHas('sighted.a'), 'control: the rule stamps a still-present fact');
  assert.ok(!ghost.dbHas('mood.a'), 'ghost: the fact expired this boundary');
  assert.ok(!ghost.dbHas('sighted.a'), 'ghost: the rule never saw it (no stamp)');
});

// R: schedule_spec.rs law_8a_re_arms_from_now
// H: ScheduleSpec.hs "law 8a: a due rule re-arms period boundaries FROM NOW (fires at 1 and 3, not 2)"
test('schedule_spec.rs : loi 8a — une règle due se réarme À PARTIR DE MAINTENANT', () => {
  // Comme le Rust : l'échéance est semée une période plus loin par setSchedule
  // (pas de `dueAt`), donc la même loi est épinglée une frontière plus tard.
  const beat = scheduleRule('beat', 2, [[[m('turn!Now')], [insert('beat.Now')]]]);
  const st = new State();
  st.setSchedule([beat]);
  for (let i = 0; i < 4; i++) st.roundBoundary();
  assert.ok(st.dbHas('beat.2'), 'fired at boundary 2');
  assert.ok(!st.dbHas('beat.3'), 'skipped boundary 3');
  assert.ok(st.dbHas('beat.4'), 'fired again at boundary 4 (re-armed FROM 2, not from 3)');
});

// R: schedule_spec.rs law_8a_late_fire_re_arms_from_the_boundary
// H: ScheduleSpec.hs "law 8a (late fire): re-arm is FROM the boundary it fires at, not the stale due"
test('schedule_spec.rs : loi 8a (tir en retard) — réarmement depuis la frontière de tir', () => {
  const beat = scheduleRule('beat', 2, [[[m('turn!Now')], [insert('beat.Now')]]]);
  const st = new State();
  st.setSchedule([beat]);
  st.performOutcome(insert('turn!10'));
  st.roundBoundary();
  assert.ok(st.dbHas('beat.11'), 'fired late, at boundary 11');
  assert.equal(st.scheduleDues().get('beat'), 13, '11 + period, not 2 + period');
});

// R: schedule_spec.rs law_8b_due_rules_fire_in_declaration_order
// H: ScheduleSpec.hs "law 8b: due rules fire in declaration order within a boundary"
test('schedule_spec.rs : loi 8b — les règles dues tirent dans l’ordre de déclaration', () => {
  const open = scheduleRule('open', 1, [[[], [insert('gate.open')]]]);
  const pass = scheduleRule('pass', 1, [[[m('gate.open')], [insert('passed.here')]]]);
  const st = new State();
  st.setSchedule([open, pass]);
  st.roundBoundary();
  assert.ok(st.dbHas('passed.here'), 'the second rule saw the first’s effect');
});

// R: schedule_spec.rs the_clock_advances_one_per_boundary
// H: ScheduleSpec.hs "the clock advances one per boundary"
test('schedule_spec.rs : l’horloge avance d’un par frontière', () => {
  const st = new State();
  for (let i = 0; i < 3; i++) st.roundBoundary();
  assert.equal(st.currentTurn(), 3);
});

// R: schedule_spec.rs round_boundary_is_insertion_order_insensitive (proptest)
test('schedule_spec.rs : la frontière de tour ignore l’ordre d’insertion (énumération complète)', () => {
  const POOL = ['feels.anger', 'feels.anger.toward.bob', 'feels.joy', 'mood!a', 'mood!b', 'at.dawn'];
  const build = (order: readonly number[]): State => {
    const st = new State();
    st.setSchedule([scheduleRule('beat', 1, [[[], [insert('tick.done')]]])]);
    for (const i of order) st.performOutcome(insertFor(1, POOL[i]));
    return st;
  };
  const all = subsequences(6, 1, 6);
  assert.equal(all.length, 63);
  for (const idxs of all) {
    const rev = [...idxs].reverse();
    const a = build(idxs);
    a.roundBoundary();
    const b = build(rev);
    b.roundBoundary();
    const ctx = `idxs=${JSON.stringify(idxs)}`;
    assert.deepEqual(a.labeledFacts(), b.labeledFacts(), ctx);
    assert.deepEqual([...a.scheduleDues()], [...b.scheduleDues()], ctx);
    assert.deepEqual([...a.expiriesRendered()], [...b.expiriesRendered()], ctx);
  }
});

// =============================================================================
// conformance/src/schedule_rule_spec.rs (H: ScheduleRuleSpec.hs "Prax.ScheduleRule")
// =============================================================================

const dueOf = (st: State, name: string): number | undefined => st.scheduleDues().get(name);
/** « mark » marque chaque chose signalée toutes les 2 frontières. */
const markR = (): ScheduleRule => scheduleRule('mark', 2, [[[m('flag.X')], [insert('marked.X')]]]);

function scheduled(rules: ScheduleRule[], outs: Outcome[]): State {
  const st = new State();
  st.setSchedule(rules);
  for (const o of outs) st.performOutcome(o);
  return st;
}

// R: schedule_rule_spec.rs a_schedule_world_is_well_formed
// H: ScheduleRuleSpec.hs "a schedule world is well-formed"
test('schedule_rule_spec.rs : un monde à calendrier est bien formé', () => {
  const errs = typeCheck(scheduled([markR()], [insert('flag.a')]));
  assert.deepEqual(errs, [], `a schedule world whose rule guard is fed by a producible fact is well-formed, got ${JSON.stringify(errs)}`);
});

// R: schedule_rule_spec.rs a_rule_does_not_fire_before_its_due
// H: ScheduleRuleSpec.hs "a rule does not fire before its due"
test('schedule_rule_spec.rs : une règle ne tire pas avant son échéance', () => {
  const st = scheduled([markR()], [insert('flag.a')]);
  st.roundBoundary();
  assert.ok(!st.dbHas('marked.a'), 'marked.a absent (due seeded at 2, now 1)');
});

// R: schedule_rule_spec.rs a_rule_fires_at_its_due_covering_every_binding
// H: ScheduleRuleSpec.hs "a rule fires at its due, covering every binding"
test('schedule_rule_spec.rs : une règle tire à son échéance, pour chaque liaison', () => {
  const st = scheduled([markR()], [insert('flag.a'), insert('flag.b')]);
  st.roundBoundary();
  st.roundBoundary();
  assert.ok(st.dbHas('marked.a'), 'marked.a inserted');
  assert.ok(st.dbHas('marked.b'), 'marked.b inserted');
});

// R: schedule_rule_spec.rs the_due_re_arms_period_boundaries_from_now
// H: ScheduleRuleSpec.hs "the due re-arms period boundaries from now"
test('schedule_rule_spec.rs : l’échéance se réarme d’une période à partir de maintenant', () => {
  const st = scheduled([markR()], [insert('flag.a')]);
  st.roundBoundary();
  st.roundBoundary();
  assert.equal(dueOf(st, 'mark'), 4);
  st.roundBoundary();
  assert.equal(dueOf(st, 'mark'), 4);
  assert.ok(st.dbHas('marked.a'), 'no re-fire before the new due (mark still stands from turn 2)');
});

// R: schedule_rule_spec.rs two_rules_with_different_periods_fire_on_their_own_schedules
// H: ScheduleRuleSpec.hs "two rules with different periods fire on their own schedules"
test('schedule_rule_spec.rs : deux règles de périodes différentes suivent chacune leur calendrier', () => {
  const p2 = scheduleRule('p2', 2, [[[m('flagA.X')], [insert('markedA.X')]]]);
  const p3 = scheduleRule('p3', 3, [[[m('flagB.X')], [insert('markedB.X')]]]);
  const st = scheduled([p2, p3], [insert('flagA.a'), insert('flagB.a')]);
  const dues = (): [number | undefined, number | undefined] => [dueOf(st, 'p2'), dueOf(st, 'p3')];
  st.roundBoundary();
  assert.deepEqual(dues(), [2, 3]);
  st.roundBoundary();
  assert.deepEqual(dues(), [4, 3]);
  st.roundBoundary();
  assert.deepEqual(dues(), [4, 6]);
  st.roundBoundary();
  assert.deepEqual(dues(), [6, 6]);
  st.roundBoundary();
  assert.deepEqual(dues(), [6, 6]);
  st.roundBoundary();
  assert.deepEqual(dues(), [8, 9]);
  assert.ok(st.dbHas('markedA.a'), 'markedA.a present');
  assert.ok(st.dbHas('markedB.a'), 'markedB.a present');
});

// R: schedule_rule_spec.rs a_late_fire_re_arms_from_the_boundary_it_fires_at
// H: ScheduleRuleSpec.hs "a late fire (clock jumped past the due) re-arms FROM the boundary it fires at"
test('schedule_rule_spec.rs : un tir en retard se réarme depuis la frontière de tir', () => {
  const st = scheduled([markR()], [insert('flag.a')]);
  st.performOutcome(insert('turn!10'));
  st.roundBoundary();
  assert.ok(st.dbHas('marked.a'), 'fired late');
  assert.equal(dueOf(st, 'mark'), 13);
});

// ===== gardes de construction =====

// R: schedule_rule_spec.rs duplicate_rule_names_are_a_loud_construction_time_error
// H: ScheduleRuleSpec.hs "duplicate rule names are a loud construction-time error (one due key each)"
test('schedule_rule_spec.rs : des noms de règle en double sont refusés', () => {
  assert.throws(() => new State().setSchedule([scheduleRule('same', 2), scheduleRule('same', 3)]), isWE('DuplicateScheduleRuleName'));
});

// R: schedule_rule_spec.rs a_multi_segment_rule_name_is_a_loud_construction_time_error
// H: ScheduleRuleSpec.hs "a multi-segment rule name is a loud construction-time error"
test('schedule_rule_spec.rs : un nom de règle à plusieurs segments est refusé', () => {
  assert.throws(() => new State().setSchedule([scheduleRule('a.b', 2)]), isWE('MultiSegmentRuleName'));
});

// R: schedule_rule_spec.rs a_trailing_operator_in_a_rule_name_dies_as_the_frozen_tokens_error
test('schedule_rule_spec.rs : un opérateur final dans un nom de règle meurt en erreur de tokens', () => {
  assert.throws(() => new State().setSchedule([scheduleRule('tick.', 2)]), trailing('tick.', '.'));
});

// R: schedule_rule_spec.rs a_trailing_operator_in_a_rule_body_dies_before_the_hygiene_verdict
test('schedule_rule_spec.rs : un opérateur final dans le corps meurt avant le verdict d’hygiène', () => {
  assert.throws(() => new State().setSchedule([scheduleRule('x', 2, [[[m('a.b.')], []]])]), trailing('a.b.', '.'));
});

// R: schedule_rule_spec.rs a_body_authoring_the_prax_namespace_is_a_loud_error
// H: ScheduleRuleSpec.hs "a body authoring the Prax namespace is a loud error"
test('schedule_rule_spec.rs : un corps écrivant l’espace Prax est refusé', () => {
  assert.throws(() => new State().setSchedule([scheduleRule('x', 2, [[[m('flag.PraxNow')], []]])]), isWE('ReservedVarClash'));
});

// R: schedule_rule_spec.rs a_body_authoring_actor_is_a_loud_error
// H: ScheduleRuleSpec.hs "a body authoring Actor is a loud error (a schedule rule has no actor)"
test('schedule_rule_spec.rs : un corps écrivant Actor est refusé', () => {
  assert.throws(() => new State().setSchedule([scheduleRule('x', 2, [[[m('flag.Actor')], []]])]), isWE('ReservedVarClash'));
});

// R: schedule_rule_spec.rs the_usability_win_d_d2_now_are_ordinary_variables
// H: ScheduleRuleSpec.hs "the usability win: D/D2/Now are ordinary variables, not reserved"
test('schedule_rule_spec.rs : D/D2/Now sont des variables ordinaires', () => {
  const st = new State();
  assert.doesNotThrow(
    () => st.setSchedule([scheduleRule('x', 2, [[[m('flag.Now')], [insert('marked.D')]]])]),
    'D and Now are unremarkable author variables',
  );
});

// R: schedule_rule_spec.rs a_zero_period_is_a_loud_error
// H: ScheduleRuleSpec.hs "a zero period is a loud error"
test('schedule_rule_spec.rs : une période nulle est refusée', () => {
  assert.throws(() => new State().setSchedule([scheduleRule('x', 0, [[[m('flag.a')], [insert('marked.a')]]])]), isWE('NonPositivePeriod'));
});

// Adaptation TS (revue Codex de la PR) : en Rust, la période est un entier typé ;
// en TypeScript, NaN, Infinity ou une fraction passeraient la garde `< 1`.
test('schedule (adaptation TS) : une période non entière ou non finie est refusée', () => {
  for (const p of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, -2]) {
    assert.throws(() => new State().setSchedule([scheduleRule('x', p, [[[m('flag.a')], [insert('marked.a')]]])]), isWE('NonPositivePeriod'), String(p));
  }
});

// ===== gathering =====
// H: ScheduleRuleSpec.hs "gathering (open fires; the fact expires -- no close rule)"

const fair = (): ScheduleRule => gathering('fair', 3, 1, [insert('marketDay.now')]);

// R: schedule_rule_spec.rs gathering_opens_at_period_not_before
// H: ScheduleRuleSpec.hs "opens at period, not before"
test('schedule_rule_spec.rs : gathering ouvre à la période, pas avant', () => {
  const st = scheduled([fair()], []);
  st.roundBoundary();
  st.roundBoundary();
  assert.ok(!st.dbHas('marketDay.now'), 'not open before period');
  st.roundBoundary();
  assert.ok(st.dbHas('marketDay.now'), 'opens exactly at period');
});

// R: schedule_rule_spec.rs gathering_closes_at_period_plus_duration
// H: ScheduleRuleSpec.hs "closes at period + duration (the expiry queue tears it down)"
test('schedule_rule_spec.rs : gathering ferme à période + durée', () => {
  const st = scheduled([fair()], []);
  for (let i = 0; i < 3; i++) st.roundBoundary();
  assert.ok(st.dbHas('marketDay.now'), 'still open at period');
  st.roundBoundary();
  assert.ok(!st.dbHas('marketDay.now'), 'closed exactly at period + duration');
});

// R: schedule_rule_spec.rs gathering_recurs_a_full_period_later
// H: ScheduleRuleSpec.hs "recurs: opens again a full period later"
test('schedule_rule_spec.rs : gathering revient une période complète plus tard', () => {
  const st = scheduled([fair()], []);
  for (let i = 0; i < 6; i++) st.roundBoundary();
  assert.ok(st.dbHas('marketDay.now'), 'cycle 2 opens at 2 x period');
  assert.equal(dueOf(st, 'fair'), 9);
});

// R: schedule_rule_spec.rs gathering_duration_equals_period_is_a_loud_error
// H: ScheduleRuleSpec.hs "duration == period is a loud construction-time error"
test('schedule_rule_spec.rs : gathering refuse durée == période', () => {
  assert.throws(() => gathering('fair', 3, 3, [insert('x')]), isWE('GatheringDuration'));
});

// R: schedule_rule_spec.rs gathering_duration_zero_is_a_loud_error
// H: ScheduleRuleSpec.hs "duration == 0 is a loud construction-time error"
test('schedule_rule_spec.rs : gathering refuse une durée nulle', () => {
  assert.throws(() => gathering('fair', 3, 0, [insert('x')]), isWE('GatheringDuration'));
});

// ===== la table des noms à deux portes (v46) + provenance (v53) =====

// R: schedule_rule_spec.rs register_engine_rules_seeds_a_due_like_set_schedule
// H: ScheduleRuleSpec.hs "the compiler-level door shares the global rule-name table (v46)"
// H: ScheduleRuleSpec.hs "registerEngineRules seeds a due exactly like setSchedule (one period out)"
test('schedule_rule_spec.rs : registerEngineRules sème une échéance comme setSchedule', () => {
  const st = new State();
  door.registerEngineRules(st, [scheduleRule('story', 1)]);
  assert.equal(dueOf(st, 'story'), 1);
});

// R: schedule_rule_spec.rs an_authored_story_rule_blocks_the_engine_door_and_vice_versa
// H: ScheduleRuleSpec.hs "an authored 'story' rule blocks the engine door, and vice versa"
test('schedule_rule_spec.rs : une règle « story » écrite bloque la porte moteur, et réciproquement', () => {
  const authored = new State();
  authored.setSchedule([scheduleRule('story', 2)]);
  assert.throws(
    () => door.registerEngineRules(authored, [scheduleRule('story', 1)]),
    isWE('DuplicateScheduleRuleName'),
    'engine door rejected: ‘story’ already authored',
  );
  const engineFirst = new State();
  door.registerEngineRules(engineFirst, [scheduleRule('story', 1)]);
  assert.throws(
    () => engineFirst.setSchedule([scheduleRule('story', 2)]),
    isWE('DuplicateScheduleRuleName'),
    'authoring door rejected: ‘story’ already registered by the engine',
  );
});

// R: schedule_rule_spec.rs register_engine_rules_records_the_rule_name_set_schedule_does_not
// H: ScheduleRuleSpec.hs "engine-rule provenance exempts the reserved-family scan (v53)"
// H: ScheduleRuleSpec.hs "registerEngineRules records the rule name; setSchedule does not"
test('schedule_rule_spec.rs : registerEngineRules enregistre le nom, setSchedule non', () => {
  const a = new State();
  door.registerEngineRules(a, [scheduleRule('story', 1)]);
  assert.deepEqual([...a.engineRuleNames], ['story']);
  const b = new State();
  b.setSchedule([scheduleRule('auth', 1)]);
  assert.equal(b.engineRuleNames.length, 0);
});

// R: schedule_rule_spec.rs adding_an_authored_story_rule_to_a_compiled_script_world_is_a_loud_collision
// H: ScheduleRuleSpec.hs "adding an authored 'story' rule to a compiled script world is a loud collision"
test('schedule_rule_spec.rs : ajouter une règle « story » écrite à un monde de script compilé est refusé', () => {
  const play = playWorld();
  assert.deepEqual([...play.engineRuleNames], ['story'], 'precondition: the compiled world already holds the engine `story` rule');
  assert.throws(
    () => play.setSchedule([scheduleRule('story', 2)]),
    isWE('DuplicateScheduleRuleName', (d) => d.name === 'story'),
  );
});

// R: schedule_rule_spec.rs a_duplicate_name_through_the_engine_door_alone_still_errors_loudly
// H: ScheduleRuleSpec.hs "a duplicate name through the engine door alone still errors loudly (the record-update forces the guard)"
test('schedule_rule_spec.rs : un doublon passé par la seule porte moteur reste bruyant', () => {
  const st = new State();
  assert.throws(() => door.registerEngineRules(st, [scheduleRule('dup', 1), scheduleRule('dup', 1)]), isWE('DuplicateScheduleRuleName'));
  // Et aucun nom n'a été enregistré avant la garde (intention du commentaire Rust).
  assert.equal(st.engineRuleNames.length, 0);
});

// =============================================================================
// conformance/src/loop_advance.rs (H: LoopSpec.hs "Prax.Loop")
// =============================================================================

function boundaryWorld(names: string[], rules: ScheduleRule[]): State {
  const st = new State();
  st.definePractices([]);
  st.setCharacters(names.map((nm) => character(nm)));
  st.setSchedule(rules);
  return st;
}

const beatRule = (): ScheduleRule => scheduleRule('beat', 1, [[[], [insert('tick.done')]]]);

// R: loop_advance.rs no_boundary_fires_before_round_1
// H: LoopSpec.hs "no boundary fires before round 1 (cursor -1 selects index 0, no wrap)"
test('loop_advance.rs : aucune frontière avant le tour 1', () => {
  const st = boundaryWorld(['a', 'b', 'c'], [beatRule()]);
  const actor = advance(st);
  assert.equal(actor.name, 'a');
  assert.equal(st.cursor, 0);
  assert.ok(st.dbHas('turn!0'), 'clock not advanced before round 1');
  assert.ok(!st.dbHas('tick.done'), 'no schedule rule fired before round 1');
});

// R: loop_advance.rs a_single_survivor_cast_wraps_every_turn
// H: LoopSpec.hs "a single-survivor cast wraps every turn (i == cursor), firing the boundary"
test('loop_advance.rs : une distribution d’un seul survivant boucle à chaque tour', () => {
  const st = boundaryWorld(['solo'], [beatRule()]);
  advance(st);
  const actor = advance(st);
  assert.equal(actor.name, 'solo');
  assert.ok(st.dbHas('turn!1'), 'the boundary advanced the clock');
  assert.ok(st.dbHas('tick.done'), 'the period-1 rule fired at the wrap');
});

// R: loop_advance.rs the_wrap_skips_a_dead_character_and_still_fires_the_boundary
// H: LoopSpec.hs "the wrap skips a dead character and still fires the boundary"
test('loop_advance.rs : le bouclage saute un mort et déclenche quand même la frontière', () => {
  const st = boundaryWorld(['a', 'b', 'c'], [beatRule()]);
  st.performOutcome(insert('dead.b'));
  const a1 = advance(st);
  const a2 = advance(st);
  const a3 = advance(st);
  assert.deepEqual([a1.name, a2.name, a3.name], ['a', 'c', 'a']);
  assert.ok(st.dbHas('turn!1'), 'the boundary fired at the wrap past the dead');
  assert.ok(st.dbHas('tick.done'), 'beat fired at that boundary');
});

// R: loop_advance.rs a_schedule_rule_killing_a_character_mid_wrap_the_dead_take_no_turn
// H: LoopSpec.hs "a schedule rule killing a character mid-wrap: the dead take no turn"
test('loop_advance.rs : une règle qui tue au bouclage — les morts ne jouent pas', () => {
  const reaper = scheduleRule('reaper', 1, [[[], [insert('dead.a')]]]);
  const st = boundaryWorld(['a', 'b', 'c'], [reaper]);
  advance(st);
  advance(st);
  advance(st);
  const a4 = advance(st);
  assert.ok(st.dbHas('dead.a'), 'the reaper killed a at the boundary');
  assert.equal(a4.name, 'b');
});

// =============================================================================
// conformance/src/loop_bar.rs
// =============================================================================

/** `crate::goldens::load` : une ligne par élément, jamais vide. */
function loadGolden(name: string): string[] {
  const body = readFileSync(join(RACINE, 'tests', 'fixtures', 'prax', 'goldens', `${name}.txt`), 'utf8');
  const lines = body.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  assert.ok(lines.length > 0, `golden \`${name}\` is empty; a vacuous comparison is not a golden test`);
  return lines;
}

// R: loop_bar.rs twenty_five_turn_npc_replay_matches_the_golden_narration
// H: LoopSpec.hs "25-turn NPC replay matches the golden narration"
test('loop_bar.rs : 25 tours de PNJ reproduisent la narration de référence', () => {
  const st = barWorld();
  const got = runNpcTicks(st, 2, 25);
  assert.deepEqual(got, loadGolden('loop-bar-25'), 'the 25-turn bar narration must match the frozen golden line for line');
});

// R: loop_bar.rs the_emergent_and_director_driven_outcomes_hold_after_the_replay
// H: LoopSpec.hs "the emergent + director-driven outcomes hold after the replay"
test('loop_bar.rs : les issues émergentes et dirigées tiennent après le rejeu', () => {
  const st = barWorld();
  runNpcTicks(st, 2, 25);
  const fs = st.labeledFacts();
  const has = (f: string): void => assert.ok(fs.includes(f), `${f} missing from ${JSON.stringify(fs)}`);
  has('practice.greet.world.greeted.bex.ada');
  assert.ok(!fs.includes('practice.greet.world.grievance.ada.you'), 'ada never bears the ignored-greeting grievance');
  has('dm.stirred');
  has('practice.greet.world.grievance.ada.bex');
  has('bex.arc!belonging');
  assert.ok(!fs.includes('bex.arc!hopeful'), 'bex has moved on from hopeful once she belongs');
  assert.ok(!fs.includes('bex.arc!lonely') && !fs.includes('you.arc!lonely'), `no NPC resigned to solitude, got ${JSON.stringify(fs)}`);
});

// R: loop_bar.rs a_dead_character_is_skipped_in_turn_taking
// H: LoopSpec.hs "a dead character is skipped in turn-taking"
test('loop_bar.rs : un personnage mort est sauté', () => {
  const st = barWorld();
  st.performOutcome(insert('dead.bex'));
  const tr = runNpcTicks(st, 2, 16);
  assert.ok(!tr.some((l) => l.includes('bex:')), `bex takes no turns once dead, got ${JSON.stringify(tr)}`);
});

// =============================================================================
// conformance/src/supersession_world.rs — la loi de supersession v44 à l'échelle d'un monde
// =============================================================================

/** Le chemin exact qu'écrivent les deux tirages « shun » du village (fondé sur une vraie paire). */
const carolsAngerAtDana = (): string => 'carol.feels.angry.toward.dana';

// R: supersession_world.rs a_village_timer_left_alone_fires_and_the_feeling_goes
test('supersession_world.rs : un minuteur du village laissé seul tire et le sentiment part', () => {
  const st = villageWorld();
  const path = carolsAngerAtDana();
  st.performOutcome(feelTowardFor(4, 'carol', ANGRY, 'dana'));
  assert.ok(st.dbHas(path), 'the feeling is present at onset');
  const due = st.currentTurn() + 4;
  assert.equal(st.expiriesRendered().get(path), due, 'the flare is queued 4 boundaries out');
  for (let i = 0; i < 4; i++) st.roundBoundary();
  assert.ok(!st.dbHas(path), 'the flare expired at its due -- the control holds');
});

// R: supersession_world.rs a_bare_insert_onto_a_live_village_timer_supersedes_it
test('supersession_world.rs : une insertion nue sur un minuteur vivant du village le supplante', () => {
  const st = villageWorld();
  const path = carolsAngerAtDana();
  st.performOutcome(feelTowardFor(4, 'carol', ANGRY, 'dana'));
  assert.ok(st.expiriesRendered().has(path), 'precondition: the timer is live before the bare insert');
  st.performOutcome(insert(path));
  assert.ok(!st.expiriesRendered().has(path), 'the bare insert SUPERSEDES the pending expiry: the due is gone');
  for (let i = 0; i < 8; i++) st.roundBoundary();
  assert.ok(st.dbHas(path), 'the superseded feeling still stands eight boundaries later -- twice the lifetime it was armed with');
});

// R: supersession_world.rs a_re_insert_for_refreshes_rather_than_supersedes
test('supersession_world.rs : un re-InsertFor rafraîchit au lieu de supplanter', () => {
  const st = villageWorld();
  const path = carolsAngerAtDana();
  st.performOutcome(feelTowardFor(4, 'carol', ANGRY, 'dana'));
  st.roundBoundary();
  st.roundBoundary();
  const refreshedDue = st.currentTurn() + 4;
  st.performOutcome(feelTowardFor(4, 'carol', ANGRY, 'dana'));
  assert.equal(st.expiriesRendered().get(path), refreshedDue, 'the timer is RE-ARMED at the new due, not cancelled');
  for (let i = 0; i < 4; i++) st.roundBoundary();
  assert.ok(!st.dbHas(path), 'a refreshed flare still dies -- only a BARE insert supersedes');
});
