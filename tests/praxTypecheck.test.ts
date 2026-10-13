/**
 * Portage TypeScript des tests du vérificateur statique de Prax (Rust, BSD-3-Clause) :
 *   - prax-core/src/typecheck.rs (module #[cfg(test)], épingles natives) ;
 *   - conformance/src/typecheck_spec.rs (`Prax.TypeCheckSpec`, 55 cas, ordre gelé).
 *
 * Chaque test garde sa référence d'origine (`// R:` et, s'il y en a, `// H:`).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { State, door } from '../src/prax/core/engine';
import { Condition, count, cmp, exists, matches, not_, or_, subquery } from '../src/prax/core/query';
import { RESERVED_FAMILIES, scenePatiencePath } from '../src/prax/core/reserved';
import { draw } from '../src/prax/core/rng';
import { type TypeError as TcError, describe, typeCheck } from '../src/prax/core/typecheck';
import {
  Action,
  Practice,
  action,
  axiom,
  call,
  character,
  del,
  desire,
  fn,
  forEach,
  insert,
  insertFor,
  practice,
  scheduleRule,
  want,
  withWant,
} from '../src/prax/core/types';
import { obligedClose } from '../src/prax/vocab/deontic';
import { audienceWorld } from '../src/prax/worlds/audience';
import { barDirectorWorld, barWorld } from '../src/prax/worlds/bar';
import { feudWorld } from '../src/prax/worlds/feud';
import { intrigueWorld } from '../src/prax/worlds/intrigue';
import { playWorld } from '../src/prax/worlds/play';
import { villageWorld } from '../src/prax/worlds/village';

// ---- aides communes -----------------------------------------------------------

const m = (s: string): Condition => matches(s);

/** Rust `Practice::new(id).roles(["R"])`, avec ses actions. */
const prac = (id: string, ...actions: Action[]): Practice => practice(id, { roles: ['R'], actions });

/** Le gelé `world1 p = definePractices [p] emptyState`. */
function world1(p: Practice): State {
  const st = new State();
  st.definePractices([p]);
  return st;
}

const hasUnbound = (errs: readonly TcError[], v: string): boolean => errs.some((e) => e.k === 'UnboundVar' && e.v === v);
const hasUnboundAt = (errs: readonly TcError[], site: string, v: string): boolean =>
  errs.some((e) => e.k === 'UnboundVar' && e.where === site && e.v === v);
const hasUndefined = (errs: readonly TcError[], name: string): boolean => errs.some((e) => e.k === 'UndefinedRef' && e.name === name);
const hasReserved = (errs: readonly TcError[], fam: string, sent: string): boolean =>
  errs.some((e) => e.k === 'ReservedFamily' && e.family === fam && e.sentence === sent);
const hasSeedless = (errs: readonly TcError[]): boolean => errs.some((e) => e.k === 'SeedlessDraw');
const hasDead = (errs: readonly TcError[]): boolean => errs.some((e) => e.k === 'DeadCondition');
const hasSortConflict = (errs: readonly TcError[]): boolean => errs.some((e) => e.k === 'SortConflict');
const dead = (where: string, sentence: string): TcError => ({ k: 'DeadCondition', where, sentence });

// =============================================================================
// prax-core/src/typecheck.rs — module #[cfg(test)]
// =============================================================================

// R: typecheck.rs the_reserved_family_list_is_the_frozen_four_in_order
test('typecheck.rs : la liste des familles réservées est le quatuor gelé, dans l’ordre', () => {
  // Rust : un `[&str; 4]` (retirer un membre est une erreur de compilation) ; en TS on
  // épingle aussi la longueur, et le contenu + l'ordre.
  assert.equal(RESERVED_FAMILIES.length, 4);
  assert.deepEqual(
    [...RESERVED_FAMILIES],
    ['turn', 'contradiction', 'scenePatience', 'currentScene'],
    'Prax.TypeCheck.reservedFamilies is a fixed list of four, consulted for every state -- script-compiled or not',
  );
});

// R: typecheck.rs the_patience_marker_path_keys_scene_then_junction
test('typecheck.rs : le marqueur de patience indexe la scène puis la jonction', () => {
  assert.equal(scenePatiencePath('audience', 'dismissed'), 'scenePatience.audience.dismissed');
});

// --- typecheck.rs, mod checker : un SHOULD-flag par constructeur -------------------

// R: typecheck.rs checker::flags_unbound_var
test('typecheck.rs checker : UnboundVar', () => {
  const st = new State();
  st.definePractices([prac('give', action('[Actor]: give', [], [insert('gift.Stranger')]))]);
  assert.ok(typeCheck(st).some((e) => e.k === 'UnboundVar' && e.v === 'Stranger'));
});

// R: typecheck.rs checker::flags_cardinality_clash
test('typecheck.rs checker : CardinalityClash', () => {
  const st = new State();
  st.definePractices([prac('mark', action('[Actor]: mark', [], [insert('slot!v'), insert('slot.w')]))]);
  assert.ok(typeCheck(st).some((e) => e.k === 'CardinalityClash' && e.slot === 'slot'));
});

// R: typecheck.rs checker::flags_undefined_ref
test('typecheck.rs checker : UndefinedRef', () => {
  const st = new State();
  st.definePractices([prac('tidy', action('[Actor]: tidy', [], [call('missing', ['Actor'])]))]);
  assert.ok(typeCheck(st).some((e) => e.k === 'UndefinedRef' && e.name === 'missing'));
});

// R: typecheck.rs checker::flags_sort_conflict
test('typecheck.rs checker : SortConflict', () => {
  const st = new State();
  st.setSorts([
    ['agent', ['bob']],
    ['place', ['bob']],
  ]);
  assert.ok(typeCheck(st).some((e) => e.k === 'SortConflict' && e.where === 'bob'));
});

// R: typecheck.rs checker::flags_reserved_family_write
test('typecheck.rs checker : ReservedFamily', () => {
  const st = new State();
  st.definePractices([prac('meddle', action('[Actor]: meddle', [], [insert('scenePatience.s.j')]))]);
  assert.ok(typeCheck(st).some((e) => e.k === 'ReservedFamily' && e.family === 'scenePatience'));
});

// R: typecheck.rs checker::reserved_family_exempts_the_engine_door
// H: ScheduleRuleSpec.hs "an authored rule writing a reserved family is flagged; the SAME body through the engine door is exempt"
test('typecheck.rs checker : la même règle via la porte du moteur est exemptée de ReservedFamily', () => {
  // Écrite : signalée.
  const a = new State();
  a.setSchedule([scheduleRule('story', 1, [[[], [insert('scenePatience.s.j')]]])]);
  assert.ok(
    typeCheck(a).some((e) => e.k === 'ReservedFamily'),
    'an AUTHORED schedule rule writing a reserved family is flagged',
  );
  // Le même corps par la porte : exempté.
  const b = new State();
  door.registerEngineRules(b, [scheduleRule('story', 1, [[[], [insert('scenePatience.s.j')]]])]);
  assert.ok(
    !typeCheck(b).some((e) => e.k === 'ReservedFamily'),
    'the SAME body registered through the door is exempt by v53 provenance',
  );
});

// R: typecheck.rs checker::flags_seedless_draw
test('typecheck.rs checker : SeedlessDraw', () => {
  const st = new State();
  // Rust construit `Outcome::Roll` directement (sans passer par `draw`).
  st.definePractices([prac('gamble', action('[Actor]: gamble', [], [{ t: 'roll', num: 1, den: 2, when: [], then: [insert('hit.Actor')] }]))]);
  assert.ok(typeCheck(st).some((e) => e.k === 'SeedlessDraw'));
});

// R: typecheck.rs checker::flags_dead_condition
test('typecheck.rs checker : DeadCondition', () => {
  const st = new State();
  st.definePractices([prac('act', action('[Actor]: act', [m('neverProduced.here')], [insert('did.Actor')]))]);
  assert.ok(typeCheck(st).some((e) => e.k === 'DeadCondition' && e.sentence === 'neverProduced.here'));
});

// R: typecheck.rs checker::flags_deontic_unclosed
test('typecheck.rs checker : DeonticUnclosed', () => {
  const st = new State();
  st.definePractices([prac('duty', action('[Actor]: oblige', [], [insert('obliged.bob.pay')]))]);
  st.setAxioms([axiom([m('a.X')], ['b.X'])]);
  assert.ok(typeCheck(st).some((e) => e.k === 'DeonticUnclosed' && e.sentence === 'b.X'));
});

// R: typecheck.rs checker::flags_coercion_unmotivated
test('typecheck.rs checker : CoercionUnmotivated', () => {
  const st = new State();
  st.definePractices([prac('threaten', action('[Actor]: threaten', [], [insert('carol.believes.desires.eve.punishes-noPay')]))]);
  assert.ok(typeCheck(st).some((e) => e.k === 'CoercionUnmotivated' && e.name === 'punishes-noPay'));
});

// R: typecheck.rs checker::eleven_pass_order_surfaces_practice_unbound_before_axiom
test('typecheck.rs checker : l’ordre des onze passes fait sortir la variable non liée de pratique avant celle d’axiome', () => {
  const st = new State();
  st.definePractices([prac('p', action('[Actor]: p', [], [insert('state.PraxlessVarPX')]))]);
  // `QY` dans la tête n'est lié par rien dans le corps (vide).
  st.setAxioms([axiom([], ['head.QY'])]);
  const errs = typeCheck(st);
  const practiceIdx = errs.findIndex((e) => e.k === 'UnboundVar' && e.where !== 'axiom');
  const axiomIdx = errs.findIndex((e) => e.k === 'UnboundVar' && e.where === 'axiom');
  assert.ok(practiceIdx >= 0 && axiomIdx >= 0, `both offenders must be flagged: ${JSON.stringify(errs)}`);
  assert.ok(practiceIdx < axiomIdx, `the PRACTICE unbound var must surface before the AXIOM one (pass 1 before pass 3): ${JSON.stringify(errs)}`);
});

// R: typecheck.rs describe_renders_each_verdict_byte_for_byte
test('typecheck.rs : describe rend chaque verdict octet pour octet', () => {
  const cases: Array<[TcError, string]> = [
    [{ k: 'UnboundVar', where: 'bug', v: 'Ghost', sentence: 'foo.Ghost' }, 'unbound variable Ghost in "foo.Ghost" (bug)'],
    [{ k: 'CardinalityClash', slot: 'a.mood' }, 'relation a.mood is used both single-valued (!) and multi-valued (.)'],
    [{ k: 'UndefinedRef', where: 'd / [Actor]: y', name: 'nope' }, 'undefined reference nope (d / [Actor]: y)'],
    [{ k: 'SortConflict', where: 'cup', detail: 'beverage, place' }, 'sort conflict at cup: beverage, place'],
    [
      { k: 'ReservedFamily', family: 'turn', where: 'clocksmith / [Actor]: forge time', sentence: 'turn!99' },
      'reserved family turn: "turn!99" (clocksmith / [Actor]: forge time) -- engine-owned; authored code may not touch it',
    ],
    [{ k: 'SeedlessDraw' }, 'draw used but the die is unseeded: seed it with Prax.Engine.seedDie when building the world'],
    [
      { k: 'DeadCondition', where: 'hunt / [Actor]: dig', sentence: 'tresure.spot' },
      'dead condition "tresure.spot" (hunt / [Actor]: dig): no action, initial fact, or axiom head can ever produce a match',
    ],
    [
      { k: 'DeonticUnclosed', sentence: 'b.X' },
      'unclosed obligation rule "b.X": this world can invoke an obligation but did not declare its □-closure -- wrap its axioms in Prax.Deontic.obligedClose',
    ],
    [
      { k: 'CoercionUnmotivated', name: 'punishes-ghost' },
      'unmotivated coercion "punishes-ghost": a threat deposits this punitive belief but no such desire is registered, so the threat is silently inert -- register it with Prax.Engine.setDesires (hold it or not is the genuine/bluff choice)',
    ],
  ];
  for (const [e, expected] of cases) assert.equal(describe(e), expected, `describe mismatch for ${JSON.stringify(e)}`);
});

// =============================================================================
// conformance/src/typecheck_spec.rs — `Prax.TypeCheckSpec`, dans l'ordre gelé
// H: TypeCheckSpec.hs "Prax.TypeCheck"
// =============================================================================

// ---- fixtures partagées (la clause `where` gelée) ----

/** Une pratique dont l'action produit un fait obliged.* (monde « census-true »). */
const obligeProducer = (): Practice =>
  practice('oblige', { roles: ['R'], actions: [action('[Actor]: swear a duty', [], [insert('obliged.Actor.duty')])] });

/** Une pratique qui DÉPOSE une croyance de motif de coercition pour punishes-ghost (forme « threaten »). */
const haunt = (): Practice =>
  practice('haunt', {
    roles: ['V'],
    init: [insert('barn.here')],
    actions: [action('[Actor]: menace [V]', [m('barn.V')], [insert('V.believes.desires.Actor.punishes-ghost.heard.Actor')])],
  });

// R: typecheck_spec.rs every_shipped_world_is_well_formed
// H: TypeCheckSpec.hs "every shipped world is well-formed"
test('TypeCheckSpec : every shipped world is well-formed', () => {
  assert.deepEqual(typeCheck(barWorld()), []);
  assert.deepEqual(typeCheck(barDirectorWorld()), []);
  assert.deepEqual(typeCheck(intrigueWorld()), []);
  assert.deepEqual(typeCheck(playWorld()), []);
  assert.deepEqual(typeCheck(feudWorld()), []);
  assert.deepEqual(typeCheck(villageWorld()), []);
  assert.deepEqual(typeCheck(audienceWorld()), []);
});

// R: typecheck_spec.rs an_outcome_variable_bound_by_nothing_is_caught
// H: TypeCheckSpec.hs "an outcome variable bound by nothing is caught"
test('TypeCheckSpec : an outcome variable bound by nothing is caught', () => {
  const p = practice('bug', { roles: ['R'], actions: [action('[Actor]: x', [], [insert('foo.Ghost')])] });
  assert.ok(hasUnbound(typeCheck(world1(p)), 'Ghost'));
});

// R: typecheck_spec.rs an_axiom_head_variable_absent_from_the_body_is_caught
// H: TypeCheckSpec.hs "an axiom head variable absent from the body is caught"
test('TypeCheckSpec : an axiom head variable absent from the body is caught', () => {
  const st = new State();
  st.setAxioms([axiom([m('p.X')], ['q.X.Y'])]);
  assert.ok(hasUnboundAt(typeCheck(st), 'axiom', 'Y'));
});

// R: typecheck_spec.rs a_relation_used_as_both_excl_and_dot_is_caught
// H: TypeCheckSpec.hs "a relation used as both ! and . is caught"
test('TypeCheckSpec : a relation used as both ! and . is caught', () => {
  const p = practice('c', {
    actions: [action('[Actor]: a', [], [insert('a.mood!happy')]), action('[Actor]: b', [], [insert('a.mood.sad')])],
  });
  assert.ok(typeCheck(world1(p)).some((e) => e.k === 'CardinalityClash' && e.slot === 'a.mood'));
});

// R: typecheck_spec.rs a_call_to_an_undefined_function_is_caught
// H: TypeCheckSpec.hs "a Call to an undefined function is caught"
test('TypeCheckSpec : a Call to an undefined function is caught', () => {
  const p = practice('d', { roles: ['R'], actions: [action('[Actor]: y', [], [call('nope', ['R'])])] });
  assert.ok(hasUndefined(typeCheck(world1(p)), 'nope'));
});

// R: typecheck_spec.rs spawning_an_undefined_practice_is_caught
// H: TypeCheckSpec.hs "spawning an undefined practice is caught"
test('TypeCheckSpec : spawning an undefined practice is caught', () => {
  const p = practice('e', { roles: ['R'], actions: [action('[Actor]: z', [], [insert('practice.ghost.R')])] });
  assert.ok(hasUndefined(typeCheck(world1(p)), 'practice.ghost'));
});

// R: typecheck_spec.rs an_unbound_variable_in_a_registered_functions_case_is_caught
// H: TypeCheckSpec.hs "an unbound variable in a registered function's case is caught, sited at fn <name>"
test('TypeCheckSpec : an unbound variable in a registered function’s case is caught, sited at fn <name>', () => {
  const f = fn('grant', ['P'], [[[], [insert('gift.Ghost')]]]);
  const st = new State();
  st.defineFunctions([f]);
  assert.ok(hasUnboundAt(typeCheck(st), 'fn grant', 'Ghost'));
});

// R: typecheck_spec.rs a_correct_little_practice_is_well_formed
// H: TypeCheckSpec.hs "a correct little practice is well-formed"
test('TypeCheckSpec : a correct little practice is well-formed', () => {
  const p = practice('ok', {
    roles: ['R'],
    init: [insert('here.someone')],
    actions: [action('[Actor]: greet [R]', [m('here.Actor'), m('here.R')], [insert('greeted.Actor.R')])],
  });
  assert.deepEqual(typeCheck(world1(p)), []);
});

// R: typecheck_spec.rs no_sort_declarations_no_sort_errors
// H: TypeCheckSpec.hs "no sort declarations ⇒ no sort errors"
test('TypeCheckSpec : no sort declarations ⇒ no sort errors', () => {
  const p = practice('z', { actions: [action('[Actor]: a', [], [insert('cup.beer'), insert('cup.bar')])] });
  assert.deepEqual(typeCheck(world1(p)), []);
});

// R: typecheck_spec.rs a_position_given_values_of_two_sorts_is_caught
// H: TypeCheckSpec.hs "a position given values of two sorts is caught"
test('TypeCheckSpec : a position given values of two sorts is caught', () => {
  const p = practice('menu', {
    actions: [action('[Actor]: pour a beer', [], [insert('cup.beer')]), action('[Actor]: pour a bar!', [], [insert('cup.bar')])],
  });
  const st = world1(p);
  st.setSorts([
    ['beverage', ['beer']],
    ['place', ['bar']],
  ]);
  assert.ok(typeCheck(st).some((e) => e.k === 'SortConflict' && e.where === 'cup'));
});

// R: typecheck_spec.rs a_variable_used_in_two_different_sorts_is_caught
// H: TypeCheckSpec.hs "a variable used in two different sorts is caught"
test('TypeCheckSpec : a variable used in two different sorts is caught', () => {
  const p = practice('v', { roles: ['X'], actions: [action('[Actor]: mix', [], [insert('cup.X'), insert('spot.X')])] });
  const st = world1(p);
  st.setSorts([
    ['beverage', ['beer']],
    ['place', ['bar']],
  ]);
  st.performOutcome(insert('cup.beer'));
  st.performOutcome(insert('spot.bar'));
  assert.ok(hasSortConflict(typeCheck(st)));
});

// R: typecheck_spec.rs a_constant_declared_in_two_sorts_is_caught
// H: TypeCheckSpec.hs "a constant declared in two sorts is caught"
test('TypeCheckSpec : a constant declared in two sorts is caught', () => {
  const st = new State();
  st.setSorts([
    ['agent', ['x']],
    ['beverage', ['x']],
  ]);
  assert.ok(
    typeCheck(st).some((e) => e.k === 'SortConflict' && e.where === 'x' && e.detail.includes('agent') && e.detail.includes('beverage')),
  );
});

// R: typecheck_spec.rs a_variable_bound_by_foreach_conditions_is_not_unbound
// H: TypeCheckSpec.hs "a variable bound by ForEach conditions is not unbound"
test('TypeCheckSpec : a variable bound by ForEach conditions is not unbound', () => {
  const p = practice('w', {
    roles: ['R'],
    init: [insert('member.someone')],
    actions: [action('[Actor]: broadcast', [], [forEach([m('member.X')], [insert('told.X')])])],
  });
  assert.deepEqual(typeCheck(world1(p)), []);
});

// R: typecheck_spec.rs a_genuinely_unbound_variable_inside_foreach_is_flagged
// H: TypeCheckSpec.hs "a genuinely unbound variable inside ForEach is flagged"
test('TypeCheckSpec : a genuinely unbound variable inside ForEach is flagged', () => {
  const p = practice('w', { roles: ['R'], actions: [action('[Actor]: broadcast', [], [forEach([m('member.X')], [insert('told.Ghost')])])] });
  assert.ok(hasUnbound(typeCheck(world1(p)), 'Ghost'));
});

// R: typecheck_spec.rs foreach_sub_inserts_join_the_cardinality_corpus
// H: TypeCheckSpec.hs "ForEach sub-inserts join the cardinality corpus"
test('TypeCheckSpec : ForEach sub-inserts join the cardinality corpus', () => {
  const p = practice('w', {
    roles: ['R'],
    actions: [action('[Actor]: a', [], [insert('mark.R!x')]), action('[Actor]: b', [], [forEach([m('member.X')], [insert('mark.X.y')])])],
  });
  assert.ok(typeCheck(world1(p)).some((e) => e.k === 'CardinalityClash'));
});

// R: typecheck_spec.rs a_dangling_call_or_spawn_inside_foreach_is_caught
// H: TypeCheckSpec.hs "a dangling Call or spawn inside ForEach is caught"
test('TypeCheckSpec : a dangling Call or spawn inside ForEach is caught', () => {
  const p = practice('w', {
    roles: ['R'],
    actions: [action('[Actor]: broadcast', [], [forEach([m('member.X')], [call('nope', ['X']), insert('practice.ghost.X')])])],
  });
  const errs = typeCheck(world1(p));
  assert.ok(hasUndefined(errs, 'nope'));
  assert.ok(hasUndefined(errs, 'practice.ghost'));
});

// R: typecheck_spec.rs a_dead_action_conjunct_is_caught
// H: TypeCheckSpec.hs "a dead action conjunct (typo'd predicate) is caught"
test('TypeCheckSpec : a dead action conjunct (typo’d predicate) is caught', () => {
  const p = practice('hunt', { init: [insert('treasure.spot')], actions: [action('[Actor]: dig', [m('tresure.spot')], [insert('dug.Actor')])] });
  assert.deepEqual(typeCheck(world1(p)), [dead('hunt / [Actor]: dig', 'tresure.spot')]);
});

// R: typecheck_spec.rs the_corrected_twin_of_the_typo_is_well_formed
// H: TypeCheckSpec.hs "the corrected twin of the typo is well-formed"
test('TypeCheckSpec : the corrected twin of the typo is well-formed', () => {
  const p = practice('hunt', { init: [insert('treasure.spot')], actions: [action('[Actor]: dig', [m('treasure.spot')], [insert('dug.Actor')])] });
  assert.deepEqual(typeCheck(world1(p)), []);
});

// R: typecheck_spec.rs a_dead_positive_inside_exists_is_caught
// H: TypeCheckSpec.hs "a dead positive inside Exists is caught"
test('TypeCheckSpec : a dead positive inside Exists is caught', () => {
  const p = practice('hunt', {
    init: [insert('treasure.spot')],
    actions: [action('[Actor]: dig', [exists([m('tresure.spot')])], [insert('dug.Actor')])],
  });
  assert.deepEqual(typeCheck(world1(p)), [dead('hunt / [Actor]: dig', 'tresure.spot')]);
});

// R: typecheck_spec.rs a_dead_foreach_guard_is_caught_sited_as_an_effect_guard
// H: TypeCheckSpec.hs "a dead ForEach guard is caught, sited as an effect guard"
test('TypeCheckSpec : a dead ForEach guard is caught, sited as an effect guard', () => {
  const p = practice('hunt', {
    init: [insert('treasure.spot')],
    actions: [action('[Actor]: search', [], [forEach([m('tresure.spot')], [insert('found')])])],
  });
  assert.deepEqual(typeCheck(world1(p)), [dead('hunt / [Actor]: search (effect guard)', 'tresure.spot')]);
});

// R: typecheck_spec.rs a_dead_desire_and_a_dead_character_want_are_each_caught
// H: TypeCheckSpec.hs "a dead desire and a dead character want are each caught"
test('TypeCheckSpec : a dead desire and a dead character want are each caught', () => {
  const desireW = desire('wantGold', want([m('ghost.family')], 5));
  const vic = withWant(character('vic'), want([m('ghost.spirit')], 3));
  const st = new State();
  st.setDesires([desireW]);
  st.setCharacters([vic]);
  assert.deepEqual(typeCheck(st), [dead('desire wantGold', 'ghost.family'), dead('want of vic', 'ghost.spirit')]);
});

// R: typecheck_spec.rs a_negation_over_a_never_produced_family_is_not_flagged
// H: TypeCheckSpec.hs "a negation over a never-produced family is not flagged"
test('TypeCheckSpec : a negation over a never-produced family is not flagged', () => {
  const p = practice('spookless', { actions: [action('[Actor]: peek', [not_('ghost.Actor')], [insert('peeked.Actor')])] });
  assert.deepEqual(typeCheck(world1(p)), []);
});

// R: typecheck_spec.rs a_half_dead_or_clause_is_not_flagged
// H: TypeCheckSpec.hs "a half-dead Or clause is not flagged"
test('TypeCheckSpec : a half-dead Or clause is not flagged', () => {
  const p = practice('hunt', {
    init: [insert('treasure.spot')],
    actions: [action('[Actor]: dig', [or_([[m('tresure.spot')], [m('treasure.spot')]])], [insert('dug.Actor')])],
  });
  assert.deepEqual(typeCheck(world1(p)), []);
});

// R: typecheck_spec.rs a_dead_pattern_inside_a_subquery_interior_is_not_flagged
// H: TypeCheckSpec.hs "a dead pattern inside a Subquery interior is not flagged"
test('TypeCheckSpec : a dead pattern inside a Subquery interior is not flagged', () => {
  const p = practice('hunt', {
    actions: [action('[Actor]: check', [subquery('S', [], [m('tresure.spot')]), count('N', 'S'), cmp('lte', 'N', '0')], [insert('checked.Actor')])],
  });
  assert.deepEqual(typeCheck(world1(p)), []);
});

// R: typecheck_spec.rs a_fully_unanchored_pattern_is_not_flagged
// H: TypeCheckSpec.hs "a fully unanchored pattern (every segment a variable) is not flagged"
test('TypeCheckSpec : a fully unanchored pattern (every segment a variable) is not flagged', () => {
  const p = practice('hunt', { roles: ['X', 'Y'], actions: [action('[Actor]: link', [m('X.Y')], [insert('linked.X.Y')])] });
  assert.deepEqual(typeCheck(world1(p)), []);
});

// R: typecheck_spec.rs a_wild_world_silences_the_lint_not_the_ref_check
// H: TypeCheckSpec.hs "a wild world (undefined Call) silences the lint, not the ref check"
test('TypeCheckSpec : a wild world (undefined Call) silences the lint, not the ref check', () => {
  const p = practice('hunt', { actions: [action('[Actor]: dig', [m('tresure.spot')], [call('missingFn', [])])] });
  const errs = typeCheck(world1(p));
  assert.ok(hasUndefined(errs, 'missingFn'), 'UndefinedRef missingFn fires');
  assert.ok(!hasDead(errs), 'no DeadCondition (the wild pool silences the lint)');
});

// R: typecheck_spec.rs a_dead_axiom_body_is_not_flagged
// H: TypeCheckSpec.hs "a dead axiom body is not flagged (axiom bodies are out of scope)"
test('TypeCheckSpec : a dead axiom body is not flagged (axiom bodies are out of scope)', () => {
  const st = new State();
  st.setAxioms([axiom([m('parent.P.C')], ['kin.P.C'])]);
  assert.deepEqual(typeCheck(st), []);
});

// R: typecheck_spec.rs an_authored_write_to_the_engine_clock_is_flagged
// H: TypeCheckSpec.hs "an authored write to the engine clock is flagged"
test('TypeCheckSpec : an authored write to the engine clock is flagged', () => {
  const p = practice('clocksmith', { actions: [action('[Actor]: forge time', [], [insert('turn!99')])] });
  assert.ok(hasReserved(typeCheck(world1(p)), 'turn', 'turn!99'));
});

// R: typecheck_spec.rs an_axiom_head_deriving_the_clock_family_is_flagged
// H: TypeCheckSpec.hs "an axiom head deriving the clock family is flagged"
test('TypeCheckSpec : an axiom head deriving the clock family is flagged', () => {
  const st = new State();
  st.setAxioms([axiom([m('ping.X')], ['turn!5'])]);
  assert.ok(typeCheck(st).some((e) => e.k === 'ReservedFamily' && e.family === 'turn' && e.where === 'axiom' && e.sentence === 'turn!5'));
});

// R: typecheck_spec.rs a_perform_outcome_clock_jump_is_not_flagged
// H: TypeCheckSpec.hs "a performOutcome clock-jump is NOT flagged (typeCheck sees no authored write)"
test('TypeCheckSpec : a performOutcome clock-jump is NOT flagged (typeCheck sees no authored write)', () => {
  const ok = practice('ok', { actions: [action('[Actor]: wait', [], [])] });
  const st = world1(ok);
  st.performOutcome(insert('turn!42'));
  assert.deepEqual(typeCheck(st), []);
});

// R: typecheck_spec.rs an_authored_delete_of_turn_is_flagged
// H: TypeCheckSpec.hs "an authored Delete of turn is flagged (the strengthening)"
test('TypeCheckSpec : an authored Delete of turn is flagged (the strengthening)', () => {
  const p = practice('clocksmith2', { actions: [action('[Actor]: erase time', [], [del('turn')])] });
  assert.ok(hasReserved(typeCheck(world1(p)), 'turn', 'turn'));
});

// R: typecheck_spec.rs seedless_draw_an_unseeded_world_with_a_draw_is_flagged
// H: TypeCheckSpec.hs "SeedlessDraw: an unseeded world with a draw is flagged"
test('TypeCheckSpec : SeedlessDraw: an unseeded world with a draw is flagged', () => {
  const p = practice('gambler', { actions: [action('[Actor]: roll', [], draw(1, 2, [], [insert('hit.Actor')]))] });
  assert.ok(hasSeedless(typeCheck(world1(p))));
});

// R: typecheck_spec.rs seedless_draw_seed_die_clears_it
// H: TypeCheckSpec.hs "SeedlessDraw: seedDie clears it"
test('TypeCheckSpec : SeedlessDraw: seedDie clears it', () => {
  const p = practice('gambler', { actions: [action('[Actor]: roll', [], draw(1, 2, [], [insert('hit.Actor')]))] });
  const st = world1(p);
  st.seedDie(7);
  assert.ok(!hasSeedless(typeCheck(st)));
});

// R: typecheck_spec.rs seedless_draw_a_draw_nested_under_a_foreach_is_still_found
// H: TypeCheckSpec.hs "SeedlessDraw: a draw nested under a ForEach is still found"
test('TypeCheckSpec : SeedlessDraw: a draw nested under a ForEach is still found', () => {
  const p = practice('gambler2', { actions: [action('[Actor]: roll all', [], [forEach([m('here.X')], draw(1, 2, [], [insert('hit.X')]))])] });
  assert.ok(hasSeedless(typeCheck(world1(p))));
});

// R: typecheck_spec.rs seedless_draw_a_draw_in_a_schedule_rule_body_is_found
// H: TypeCheckSpec.hs "SeedlessDraw: a draw in a schedule rule body is found (v50 T1 review M2)"
test('TypeCheckSpec : SeedlessDraw: a draw in a schedule rule body is found (v50 T1 review M2)', () => {
  const r = scheduleRule('storms', 3, [[[], draw(1, 2, [], [insert('storm.here')])]]);
  const st = world1(practice('p'));
  st.setSchedule([r]);
  assert.ok(hasSeedless(typeCheck(st)));
});

// R: typecheck_spec.rs an_authored_insert_of_contradiction_is_flagged
// H: TypeCheckSpec.hs "an authored Insert of contradiction is flagged"
test('TypeCheckSpec : an authored Insert of contradiction is flagged', () => {
  const p = practice('sophist', { actions: [action('[Actor]: break logic', [], [insert('contradiction')])] });
  assert.ok(hasReserved(typeCheck(world1(p)), 'contradiction', 'contradiction'));
});

// R: typecheck_spec.rs an_authored_match_on_contradiction_is_clean
// H: TypeCheckSpec.hs "an authored Match on contradiction is clean (reads free)"
test('TypeCheckSpec : an authored Match on contradiction is clean (reads free)', () => {
  const p = practice('sophist2', { actions: [action('[Actor]: check logic', [m('contradiction')], [])] });
  assert.deepEqual(typeCheck(world1(p)), []);
});

// R: typecheck_spec.rs an_authored_practice_action_insert_of_scene_patience_is_flagged
// H: TypeCheckSpec.hs "an authored practice-action Insert of scenePatience is flagged"
test('TypeCheckSpec : an authored practice-action Insert of scenePatience is flagged', () => {
  const p = practice('meddler', { actions: [action('[Actor]: forge patience', [], [insert('scenePatience.x.y')])] });
  assert.ok(hasReserved(typeCheck(world1(p)), 'scenePatience', 'scenePatience.x.y'));
});

// R: typecheck_spec.rs a_reserved_write_nested_under_a_foreach_is_still_flagged
// H: TypeCheckSpec.hs "a reserved write NESTED under a ForEach is still flagged (v53 final review M-2)"
test('TypeCheckSpec : a reserved write NESTED under a ForEach is still flagged (v53 final review M-2)', () => {
  const p = practice('meddler9', {
    init: [insert('mark.here')],
    actions: [action('[Actor]: forge patience for everyone', [], [forEach([m('mark.M')], [insert('scenePatience.n.M')])])],
  });
  assert.ok(hasReserved(typeCheck(world1(p)), 'scenePatience', 'scenePatience.n.M'));
});

// R: typecheck_spec.rs an_authored_insert_for_of_scene_patience_in_a_practice_init_is_flagged
// H: TypeCheckSpec.hs "an authored InsertFor of scenePatience in a practice init is flagged"
test('TypeCheckSpec : an authored InsertFor of scenePatience in a practice init is flagged', () => {
  const p = practice('meddler2', { init: [insertFor(3, 'scenePatience.a.b')] });
  assert.ok(hasReserved(typeCheck(world1(p)), 'scenePatience', 'scenePatience.a.b'));
});

// R: typecheck_spec.rs an_authored_function_case_write_of_scene_patience_is_flagged
// H: TypeCheckSpec.hs "an authored function-case write of scenePatience is flagged"
test('TypeCheckSpec : an authored function-case write of scenePatience is flagged', () => {
  const f = fn('meddle', [], [[[], [insert('scenePatience.f.g')]]]);
  const st = new State();
  st.defineFunctions([f]);
  assert.ok(hasReserved(typeCheck(st), 'scenePatience', 'scenePatience.f.g'));
});

// R: typecheck_spec.rs an_authored_set_schedule_rule_body_writing_scene_patience_is_flagged
// H: TypeCheckSpec.hs "an authored setSchedule rule body writing scenePatience is flagged"
test('TypeCheckSpec : an authored setSchedule rule body writing scenePatience is flagged', () => {
  const r = scheduleRule('meddle', 2, [[[], [insert('scenePatience.s.t')]]]);
  const st = new State();
  st.setSchedule([r]);
  assert.ok(hasReserved(typeCheck(st), 'scenePatience', 'scenePatience.s.t'));
});

// R: typecheck_spec.rs an_axiom_head_deriving_scene_patience_is_flagged
// H: TypeCheckSpec.hs "an axiom head deriving scenePatience is flagged"
test('TypeCheckSpec : an axiom head deriving scenePatience is flagged', () => {
  const st = new State();
  st.setAxioms([axiom([m('trigger.X')], ['scenePatience.X.j'])]);
  assert.ok(
    typeCheck(st).some((e) => e.k === 'ReservedFamily' && e.family === 'scenePatience' && e.where === 'axiom' && e.sentence === 'scenePatience.X.j'),
  );
});

// R: typecheck_spec.rs an_authored_delete_of_scene_patience_is_flagged
// H: TypeCheckSpec.hs "an authored Delete of scenePatience is flagged (a delete is a write)"
test('TypeCheckSpec : an authored Delete of scenePatience is flagged (a delete is a write)', () => {
  const p = practice('wrecker', { actions: [action('[Actor]: cancel patience', [], [del('scenePatience.x.y')])] });
  assert.ok(hasReserved(typeCheck(world1(p)), 'scenePatience', 'scenePatience.x.y'));
});

// R: typecheck_spec.rs an_authored_write_to_the_current_scene_family_is_flagged
// H: TypeCheckSpec.hs "an authored write to the currentScene family is flagged"
test('TypeCheckSpec : an authored write to the currentScene family is flagged', () => {
  const p = practice('director', { actions: [action('[Actor]: seize the stage', [], [insert('currentScene!banquet')])] });
  assert.ok(hasReserved(typeCheck(world1(p)), 'currentScene', 'currentScene!banquet'));
});

// R: typecheck_spec.rs a_practice_injected_onto_compiled_audience_writing_its_patience_marker_flags
// H: TypeCheckSpec.hs "a practice injected onto compiled Audience writing its patience marker flags loudly (the v50 door)"
test('TypeCheckSpec : a practice injected onto compiled Audience writing its patience marker flags loudly (the v50 door)', () => {
  const meddler = practice('meddler', { actions: [action('[Actor]: reset the clock', [], [insert('scenePatience.audience.dismissed')])] });
  const st = audienceWorld();
  st.definePractices([meddler]);
  assert.ok(hasReserved(typeCheck(st), 'scenePatience', 'scenePatience.audience.dismissed'));
});

// R: typecheck_spec.rs a_sighted_within_shaped_authored_condition_is_clean
// H: TypeCheckSpec.hs "a sightedWithin-shaped authored condition is clean (turn reads free)"
test('TypeCheckSpec : a sightedWithin-shaped authored condition is clean (turn reads free)', () => {
  const p = practice('watcher', {
    init: [insert('carol.believes.atSince.bob!3')],
    actions: [action('[Actor]: recall sighting', [m('Actor.believes.atSince.Witness!Since'), m('turn!Now')], [])],
  });
  assert.deepEqual(typeCheck(world1(p)), []);
});

// R: typecheck_spec.rs a_world_that_can_produce_obliged_but_omits_closure_is_flagged
// H: TypeCheckSpec.hs "a world that can produce obliged.* but omits its □-closure is flagged, naming the axiom"
test('TypeCheckSpec : a world that can produce obliged.* but omits its □-closure is flagged, naming the axiom', () => {
  const st = new State();
  st.definePractices([obligeProducer()]);
  st.setAxioms([axiom([m('a.X')], ['b.X'])]);
  assert.deepEqual(typeCheck(st), [{ k: 'DeonticUnclosed', sentence: 'b.X' }]);
});

// R: typecheck_spec.rs the_same_world_declared_via_obliged_close_is_well_formed
// H: TypeCheckSpec.hs "the same world declared via obligedClose is well-formed"
test('TypeCheckSpec : the same world declared via obligedClose is well-formed', () => {
  const st = new State();
  st.definePractices([obligeProducer()]);
  st.setAxioms(obligedClose([axiom([m('a.X')], ['b.X'])]));
  assert.deepEqual(typeCheck(st), []);
});

// R: typecheck_spec.rs an_axiomless_world_that_can_invoke_obligation_is_clean
// H: TypeCheckSpec.hs "an axiomless world that can invoke obligation is clean (nothing to close)"
test('TypeCheckSpec : an axiomless world that can invoke obligation is clean (nothing to close)', () => {
  const st = new State();
  st.definePractices([obligeProducer()]);
  assert.deepEqual(typeCheck(st), []);
});

// R: typecheck_spec.rs a_world_with_liftable_axioms_that_cannot_invoke_obligation_is_clean
// H: TypeCheckSpec.hs "a world with liftable axioms that CANNOT invoke obligation is clean (the Feud shape)"
test('TypeCheckSpec : a world with liftable axioms that CANNOT invoke obligation is clean (the Feud shape)', () => {
  const st = new State();
  st.setAxioms([axiom([m('a.X')], ['b.X'])]);
  assert.deepEqual(typeCheck(st), []);
});

// R: typecheck_spec.rs partial_closure_flags_each_missing_twin_individually
// H: TypeCheckSpec.hs "partial closure flags each missing twin individually (v51 final review M2)"
test('TypeCheckSpec : partial closure flags each missing twin individually (v51 final review M2)', () => {
  const a1 = axiom([m('a.X')], ['b.X']);
  const a2 = axiom([m('c.X')], ['d.X']);
  const axioms = [...obligedClose([a1]), a2];
  const st = new State();
  st.definePractices([obligeProducer()]);
  st.setAxioms(axioms);
  assert.deepEqual(typeCheck(st), [{ k: 'DeonticUnclosed', sentence: 'd.X' }]);
});

// R: typecheck_spec.rs a_threaten_shaped_deposit_for_an_unregistered_punitive_name_flags
// H: TypeCheckSpec.hs "a threaten-shaped deposit for an UNREGISTERED punitive name flags CoercionUnmotivated, naming the name (v54)"
test('TypeCheckSpec : a threaten-shaped deposit for an UNREGISTERED punitive name flags CoercionUnmotivated, naming the name (v54)', () => {
  assert.deepEqual(typeCheck(world1(haunt())), [{ k: 'CoercionUnmotivated', name: 'punishes-ghost' }]);
});

// R: typecheck_spec.rs registering_the_punitive_desire_clears_it
// H: TypeCheckSpec.hs "registering the punitive desire clears it — genuine (held) and bluff (not-held) are the SAME clean result (v54)"
test('TypeCheckSpec : registering the punitive desire clears it — genuine (held) and bluff (not-held) are the SAME clean result (v54)', () => {
  const ghostDesire = desire('punishes-ghost', want([m('barn.PraxD')], 5));
  const st = world1(haunt());
  st.setDesires([ghostDesire]);
  assert.deepEqual(typeCheck(st), []);
});

// R: typecheck_spec.rs a_coercion_free_world_names_no_punitive_belief_and_is_clean
// H: TypeCheckSpec.hs "a coercion-free world names no punitive belief and is clean (v54)"
test('TypeCheckSpec : a coercion-free world names no punitive belief and is clean (v54)', () => {
  const p = practice('quiet', { roles: ['R'], actions: [action('[Actor]: greet [R]', [], [insert('greeted.Actor.R')])] });
  assert.deepEqual(typeCheck(world1(p)), []);
});
