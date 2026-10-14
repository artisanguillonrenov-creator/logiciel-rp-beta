/**
 * Portage TypeScript des tests du cœur du moteur Prax (Rust, BSD-3-Clause) :
 *   - prax-core/src/{engine.rs, compilepipe.rs, types.rs, relevance.rs, rng.rs,
 *     turn.rs, sight.rs, minds.rs, vocab_consts.rs} (modules #[cfg(test)]) ;
 *   - conformance/src/{engine_replay.rs, engine_deontic.rs, analysis_table_spec.rs}.
 *
 * Le temps (schedule.rs, schedule_spec.rs, schedule_rule_spec.rs, loop_*.rs,
 * supersession_world.rs) est dans tests/praxCoreSchedule.test.ts.
 *
 * Chaque test garde sa référence d'origine (`// R:` et, s'il y en a, `// H:`).
 * Les proptests sont rejoués de façon déterministe : leurs générateurs
 * (`prop::sample::subsequence` sur de petites listes) ont un domaine fini, qu'on
 * énumère EN ENTIER (sur-ensemble de tout tirage aléatoire possible).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { Effect, compileOutcome, groundEffect } from '../src/prax/core/compile';
import { Bindings, emptyDb, exists, ground, insertStr } from '../src/prax/core/db';
import { State } from '../src/prax/core/engine';
import { WorldError, WorldErrorKind } from '../src/prax/core/errors';
import { believedDesires } from '../src/prax/core/minds';
import { segmentNames, tokenize } from '../src/prax/core/path';
import { performEffect } from '../src/prax/core/perform';
import { Cond, Condition, calc, cmp, matches, neq as neqC, not_, or_, subquery } from '../src/prax/core/query';
import { evictionShadowNames, mayUnifySyms, moverReadAnchors } from '../src/prax/core/relevance';
import { SEED_BOUNDS, draw, rollStep } from '../src/prax/core/rng';
import { sightRule } from '../src/prax/core/schedule';
import { sightedWithin } from '../src/prax/core/sight';
import { npcAct } from '../src/prax/core/turn';
import { typeCheck } from '../src/prax/core/typecheck';
import {
  Action,
  Character,
  Desire,
  Outcome,
  Practice,
  PraxFunction,
  Want,
  action,
  authoredPatClash,
  authoredVarClash,
  axiom,
  boundTo,
  call,
  character,
  del,
  desire,
  fn,
  forEach,
  holds,
  insert,
  insertFor,
  isPraxVar,
  outcomeSents,
  outcomeVars,
  practice,
  renameOutcomes,
  renameVars,
  scheduleRule,
  want,
  withWant,
} from '../src/prax/core/types';
import { OBLIGED_HEAD, OBLIGED_LIFT_PREFIX, PUNITIVE_PREFIX, obligationPath } from '../src/prax/core/vocabConsts';
import { obligedClose } from '../src/prax/vocab/deontic';
import { audienceWorld } from '../src/prax/worlds/audience';
import { barDirectorWorld, barWorld } from '../src/prax/worlds/bar';
import { feudWorld } from '../src/prax/worlds/feud';
import { intrigueWorld } from '../src/prax/worlds/intrigue';
import { playWorld } from '../src/prax/worlds/play';
import { villageWorld } from '../src/prax/worlds/village';
import { cmpStr, sortStrings, stableSort } from '../src/prax/core/util';

const RACINE = process.env.PRAX_RACINE ?? join(__dirname, '..', '..');

// ---- aides communes -----------------------------------------------------------

const m = (s: string): Condition => matches(s);
const n = (s: string): Condition => not_(s);
const eq = (a: string, b: string): Condition => ({ t: 'eq', a, b });
const neq = (a: string, b: string): Condition => neqC(a, b);

/** `matches!(r, Err(WorldError::Kind { .. }))` : la fonction LÈVE une WorldError de ce genre. */
const isWE =
  (kind: WorldErrorKind, check: (d: Readonly<Record<string, unknown>>) => boolean = () => true) =>
  (e: unknown): boolean =>
    e instanceof WorldError && e.kind === kind && check(e.details);

/** `WorldError::TrailingOperator { sentence, op }`. */
const trailing = (sentence: string, op: string) => isWE('TrailingOperator', (d) => d.sentence === sentence && d.op === op);

const arrEq = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
const containsSegs = (anchors: ReadonlyArray<readonly string[]>, s: string): boolean => anchors.some((a) => arrEq(a, tokenize(s).segs));

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
// prax-core/src/engine.rs — mod tests (H: EngineSpec.hs "Prax.Engine")
// =============================================================================

function labels(st: State, actor: string): string[] {
  return st.possibleActions(actor).map((g) => g.label);
}

/** Exécute la première action dont le libellé contient `needle`. */
function step(st: State, actor: string, needle: string): void {
  const ga = st.possibleActions(actor).find((g) => g.label.includes(needle));
  if (ga === undefined) throw new Error(`no action matching ${JSON.stringify(needle)} for ${actor}`);
  st.performAction(ga);
}

// Pratiques reprises des fixtures eDSL d'EngineSpec.hs.
function greetP(): Practice {
  return practice('greet', {
    name: '[Greeter] is greeting [Greeted]',
    roles: ['Greeter', 'Greeted'],
    actions: [action('[Actor]: Greet [Other]', [eq('Actor', 'Greeter'), eq('Other', 'Greeted')], [del('practice.greet.Actor.Other')])],
  });
}

function tendBarP(): Practice {
  return practice('tendBar', {
    name: '[Bartender] is tending bar',
    roles: ['Bartender'],
    dataFacts: ['beverageType.beer!alcoholic', 'beverageType.cider!alcoholic', 'beverageType.soda!nonalcoholic', 'beverageType.water!nonalcoholic'],
    actions: [
      action(
        '[Actor]: Walk up to bar',
        [neq('Actor', 'Bartender'), n('practice.tendBar.Bartender.customer.Actor')],
        [insert('practice.tendBar.Bartender.customer.Actor')],
      ),
      action(
        '[Actor]: Order [Beverage]',
        [
          m('practice.tendBar.Bartender.customer.Actor'),
          n('practice.tendBar.Bartender.customer.Actor!beverage'),
          m('practiceData.tendBar.beverageType.Beverage'),
        ],
        [insert('practice.tendBar.Bartender.customer.Actor!order!Beverage')],
      ),
      action(
        "[Actor]: Fulfill [Customer]'s order",
        [eq('Actor', 'Bartender'), m('practice.tendBar.Bartender.customer.Customer!order!Beverage')],
        [del('practice.tendBar.Bartender.customer.Customer!order'), insert('practice.tendBar.Bartender.customer.Customer!beverage!Beverage')],
      ),
    ],
  });
}

function duelP(): Practice {
  return practice('duel', {
    name: '[A] duels [B]',
    roles: ['A', 'B'],
    init: [insert('practice.duel.A.B.turn!A')],
    actions: [action('[Actor]: Strike', [m('practice.duel.A.B.turn!Actor')], [insert('practice.duel.A.B.struck!Actor')])],
  });
}

function mathP(): Practice {
  return practice('math', {
    name: 'math box [M]',
    roles: ['M'],
    init: [insert('practice.math.M.n!3')],
    actions: [action('[Actor]: Double', [m('practice.math.M.n!N')], [call('dbl', ['M', 'N'])])],
  });
}

function dblFn(): PraxFunction {
  return fn('dbl', ['M', 'N'], [[[calc('R', 'mul', 'N', '2')], [insert('practice.math.M.n!R')]]]);
}

/** Les familles de têtes d'axiome compilées, par nom (épingle axiomHeads). */
function axiomHeadHas(st: State, s: string): boolean {
  return st.defs.compiled.axiomHeads.some((h) => arrEq(h, segmentNames(s)));
}

// ===== pratiques / actions / naissance =====

// R: engine.rs cooked_defs_mirrors_practice_defs_keys
// H: EngineSpec.hs "cookedDefs mirrors practiceDefs' keys after definePractices"
test('engine.rs : les définitions compilées reprennent les clés des pratiques écrites', () => {
  const st = new State();
  st.definePractices([greetP(), tendBarP(), duelP(), mathP()]);
  st.defineFunctions([dblFn()]);
  // Adaptation : en Rust `defs.practices` est un BTreeMap (itéré trié) ; la Map TS
  // garde l'ordre d'insertion. On compare donc les clés écrites TRIÉES aux clés
  // compilées (elles-mêmes remplies dans l'ordre des noms).
  const authored = sortStrings([...st.defs.practices.keys()]);
  const cooked = [...st.defs.compiled.practices.keys()];
  assert.deepEqual(authored, cooked);
});

// R: engine.rs define_practice_inserts_static_data
// H: EngineSpec.hs "definePractice inserts static data under practiceData"
test('engine.rs : definePractice insère les données statiques sous practiceData', () => {
  const st = new State();
  st.definePractice(tendBarP());
  assert.ok(st.dbHas('practiceData.tendBar.beverageType.cider.alcoholic'));
});

// R: engine.rs greet_affordance_appears_and_is_consumed
// H: EngineSpec.hs "greet: affordance appears, and performing it consumes the instance"
test('engine.rs : greet — l’affordance apparaît et l’exécuter consomme l’instance', () => {
  const st = new State();
  st.definePractice(greetP());
  st.performOutcome(insert('practice.greet.max.isaac'));
  assert.deepEqual(labels(st, 'max'), ['max: Greet isaac']);
  step(st, 'max', 'Greet isaac');
  assert.deepEqual(labels(st, 'max'), []);
});

// R: engine.rs tend_bar_walk_order_fulfill
// H: EngineSpec.hs "tendBar: walk up -> order -> fulfill delivers the drink"
test('engine.rs : tendBar — s’approcher, commander, servir livre la boisson', () => {
  const st = new State();
  st.definePractices([tendBarP()]);
  st.performOutcome(insert('practice.tendBar.ada'));
  assert.deepEqual(labels(st, 'beth'), ['beth: Walk up to bar']);
  step(st, 'beth', 'Walk up to bar');
  assert.ok(labels(st, 'beth').includes('beth: Order cider'));
  step(st, 'beth', 'Order cider');
  assert.ok(labels(st, 'ada').some((l) => l.includes('Fulfill')));
  step(st, 'ada', 'Fulfill');
  assert.ok(st.dbHas('practice.tendBar.ada.customer.beth.beverage.cider'));
  assert.ok(!st.labeledFacts().some((f) => f.includes('customer.beth.order')), 'pending order cleared');
});

// R: engine.rs spawning_runs_init_once_and_only_whose_turn_strikes
// H: EngineSpec.hs "spawning runs init once; only the whose-turn actor can strike"
test('engine.rs : la naissance exécute init une fois ; seul celui dont c’est le tour frappe', () => {
  const st = new State();
  st.definePractice(duelP());
  st.performOutcome(insert('practice.duel.max.nic'));
  assert.ok(st.dbHas('practice.duel.max.nic.turn.max'), 'init seeded turn');
  assert.deepEqual(labels(st, 'max'), ['max: Strike']);
  assert.deepEqual(labels(st, 'nic'), []);
});

// R: engine.rs call_into_a_guarded_function_applies_its_calc
// H: EngineSpec.hs "call into a guarded function applies its calc effect"
test('engine.rs : un appel de fonction gardée applique son calcul', () => {
  const st = new State();
  st.definePractice(mathP());
  st.defineFunctions([dblFn()]);
  st.performOutcome(insert('practice.math.box'));
  assert.ok(st.dbHas('practice.math.box.n.3'), 'init n=3');
  step(st, 'alice', 'Double');
  assert.ok(st.dbHas('practice.math.box.n.6'), 'n doubled to 6');
});

// ===== ForEach =====

// R: engine.rs for_each_applies_for_every_binding
// H: EngineSpec.hs "ForEach applies its outcomes for every binding"
test('engine.rs : ForEach applique ses effets pour chaque liaison', () => {
  const st = new State();
  for (const s of ['member.a', 'member.b', 'member.c']) st.performOutcome(insert(s));
  st.performOutcome(forEach([m('member.X')], [insert('greeted.X')]));
  for (const name of ['a', 'b', 'c']) assert.ok(st.dbHas(`greeted.${name}`));
});

// R: engine.rs for_each_zero_bindings_is_a_noop
// H: EngineSpec.hs "ForEach with zero bindings is a no-op"
test('engine.rs : ForEach sans liaison ne fait rien', () => {
  const st = new State();
  st.performOutcome(insert('unrelated'));
  const before = st.labeledFacts();
  st.performOutcome(forEach([m('member.X')], [insert('greeted.X')]));
  assert.deepEqual(st.labeledFacts(), before);
});

// R: engine.rs for_each_snapshots_its_bindings
// H: EngineSpec.hs "ForEach snapshots its bindings: mutations cannot extend the quantification"
test('engine.rs : ForEach fige ses liaisons — les mutations n’étendent pas la quantification', () => {
  const st = new State();
  st.performOutcome(insert('member.a'));
  st.performOutcome(forEach([m('member.X')], [insert('member.b'), insert('visited.X')]));
  assert.ok(st.dbHas('visited.a'), 'visited the original member');
  assert.ok(!st.dbHas('visited.b'), 'did NOT visit the member inserted mid-fold');
});

// R: engine.rs for_each_grounds_enclosing_action_bindings_first
// H: EngineSpec.hs "ForEach grounds the enclosing action's bindings first"
test('engine.rs : ForEach fonde d’abord les liaisons de l’action englobante', () => {
  const st = new State();
  const p = practice('tell', {
    roles: ['R'],
    actions: [action('[Actor]: tell friends about [Target]', [m('target.Target')], [forEach([m('friend.Target.W')], [insert('told.W.Target')])])],
  });
  st.definePractices([p]);
  for (const s of ['practice.tell.stage', 'target.bob', 'friend.bob.carol', 'friend.bob.dave', 'friend.eve.mallory']) st.performOutcome(insert(s));
  const ga = st.possibleActions('ann')[0];
  assert.ok(ga !== undefined, 'tell action offered');
  st.performAction(ga);
  assert.ok(st.dbHas('told.carol.bob'));
  assert.ok(st.dbHas('told.dave.bob'));
  assert.ok(!st.dbHas('told.mallory.eve'), 'a different target’s friend must not fire');
});

// R: engine.rs for_each_nests
// H: EngineSpec.hs "ForEach nests: outer bindings ground the inner quantifier"
test('engine.rs : ForEach s’imbrique — les liaisons externes fondent le quantificateur interne', () => {
  const st = new State();
  for (const s of ['row.a', 'row.b', 'col.x', 'col.y']) st.performOutcome(insert(s));
  st.performOutcome(forEach([m('row.R')], [forEach([m('col.C')], [insert('cell.R.C')])]));
  for (const s of ['cell.a.x', 'cell.a.y', 'cell.b.x', 'cell.b.y']) assert.ok(st.dbHas(s), s);
});

// R: engine.rs for_each_snapshot_holds_for_delete
// H: EngineSpec.hs "ForEach snapshot holds for Delete: removing a member mid-fold still visits all"
test('engine.rs : l’instantané de ForEach tient pour Delete', () => {
  const st = new State();
  for (const s of ['member.a', 'member.b']) st.performOutcome(insert(s));
  st.performOutcome(forEach([m('member.X')], [del('member.X'), insert('visited.X')]));
  assert.ok(st.dbHas('visited.a'));
  assert.ok(st.dbHas('visited.b'));
  assert.ok(!st.dbHas('member.a'));
  assert.ok(!st.dbHas('member.b'));
});

// R: engine.rs for_each_no_conditions_applies_exactly_once
// H: EngineSpec.hs "ForEach with no conditions applies its outcomes exactly once"
test('engine.rs : ForEach sans condition applique ses effets exactement une fois', () => {
  const st = new State();
  st.performOutcome(insert('counter!0'));
  st.performOutcome(forEach([], [forEach([m('counter!N'), calc('M', 'add', 'N', '1')], [insert('counter!M')])]));
  assert.ok(st.dbHas('counter!1'), 'ran exactly once');
  assert.ok(!st.dbHas('counter!2'), 'not twice');
});

// ===== axiomes / vue =====

// R: engine.rs set_axioms_re_derives_the_cached_view
// H: EngineSpec.hs "setAxioms re-derives the cached view on a built state"
test('engine.rs : setAxioms redérive la vue en cache d’un état construit', () => {
  const st = new State();
  st.performOutcome(insert('parent.ada.bea'));
  assert.ok(!st.viewHas('elder.ada'), 'no axioms: nothing derived');
  st.setAxioms([axiom([m('parent.X.Y')], ['elder.X'])]);
  assert.ok(st.viewHas('elder.ada'), 'derived after set_axioms');
  st.performOutcome(insert('parent.bea.cal'));
  assert.ok(st.viewHas('elder.bea'), 'new base fact derives too');
});

// R: engine.rs axiom_heads_fireable_heads_and_contradiction_witness
// H: EngineSpec.hs "axiomHeads: fireable heads and the contradiction witness"
test('engine.rs : axiomHeads — têtes déclenchables et témoin de contradiction', () => {
  const st = new State();
  st.setAxioms([axiom([m('starving.X')], ['hungry.X'])]);
  assert.ok(axiomHeadHas(st, 'hungry.X'), 'the head');
  assert.ok(axiomHeadHas(st, 'contradiction'), 'the ⊥ witness');
  assert.ok(!axiomHeadHas(st, 'obliged.Obligor.hungry.X'), 'no lifted head from a bare rule');
});

// R: engine.rs a_world_that_does_not_declare_its_closure_has_no_lifted_twin
// H: EngineSpec.hs "declared □-closure (spec v51): the lift is content the world declares"
// H: EngineSpec.hs "a world that does NOT declare its closure carries no lifted twin"
test('engine.rs : un monde qui ne déclare pas sa clôture □ n’a pas de jumeau relevé', () => {
  const st = new State();
  st.setAxioms([axiom([m('a.X')], ['b.X'])]);
  assert.ok(axiomHeadHas(st, 'b.X'), 'base head present');
  assert.ok(!axiomHeadHas(st, 'obliged.Obligor.b.X'), 'no lifted twin');
});

// R: engine.rs set_axioms_order_independent_cooked_rules
// H: EngineSpec.hs "build-order death: setAxioms-first equals setAxioms-outermost (cookedRules and typeCheck)"
test('engine.rs : l’ordre de construction ne change ni les règles compilées ni typeCheck', () => {
  const axs = [axiom([m('a.X')], ['b.X'])];
  const st = new State();
  st.setAxioms(axs);
  const rulesBefore = st.defs.compiled.rules;
  st.performOutcome(insert('obliged.w.a.foo'));
  st.setAxioms(axs);
  assert.deepEqual(st.defs.compiled.rules, rulesBefore, 'recompile must not consult the db (cooked rules depend only on the axiom list)');

  const a = new State();
  a.setAxioms(axs);
  a.setDesires([desire('d', want([m('a.Owner')], 1))]);
  const b = new State();
  b.setDesires([desire('d', want([m('a.Owner')], 1))]);
  b.setAxioms(axs);
  assert.deepEqual(typeCheck(a), typeCheck(b), 'the type_check verdict is independent of set_axioms’s build-order position');
});

// ===== gardes de collision =====
// H: EngineSpec.hs "collision guards (v43, re-expressed against the v47 registry): action names and registered function names must each be unique"

// R: engine.rs duplicate_action_names_are_rejected
// H: EngineSpec.hs "two actions with the same name in one practice is a loud construction-time error"
test('engine.rs : deux actions de même nom dans une pratique sont refusées', () => {
  const p = practice('dup', { roles: ['R'], actions: [action('dup'), action('dup')] });
  assert.throws(() => new State().definePractice(p), isWE('DuplicateActionName'));
});

// R: engine.rs duplicate_function_names_within_a_batch_are_rejected
// H: EngineSpec.hs "two functions with the same name within ONE defineFunctions batch is a loud error"
test('engine.rs : deux fonctions de même nom dans un même lot sont refusées', () => {
  const batch = [fn('f', [], []), fn('f', [], [])];
  assert.throws(() => new State().defineFunctions(batch), isWE('DuplicateFunctionName'));
});

// R: engine.rs duplicate_function_names_across_calls_are_rejected
// H: EngineSpec.hs "a function name already registered by an EARLIER defineFunctions call is a loud error"
test('engine.rs : un nom de fonction déjà enregistré par un appel antérieur est refusé', () => {
  const st = new State();
  st.defineFunctions([fn('f', [], [])]);
  assert.throws(() => st.defineFunctions([fn('f', [], [])]), isWE('DuplicateFunctionName'));
});

// ===== garde du nom de personnage à un segment (DIV-2) =====

// R: engine.rs a_plain_character_name_is_accepted
test('engine.rs : un nom de personnage simple est accepté', () => {
  const st = new State();
  assert.doesNotThrow(() => st.setCharacters([character('keeper'), character('inge')]), 'a single-segment name is a name');
  assert.equal(st.characters.length, 2);
});

// R: engine.rs a_separator_bearing_character_name_is_rejected
test('engine.rs : un nom de personnage porteur de séparateur est refusé', () => {
  for (const bad of ['hall.keeper', 'hall!keeper']) {
    const st = new State();
    assert.throws(
      () => st.setCharacters([character(bad)]),
      isWE('MultiSegmentCharacterName', (d) => d.name === bad),
      `${JSON.stringify(bad)} is a path injection, not a name -- set_characters must reject it`,
    );
    assert.equal(st.characters.length, 0, 'a rejected roster must not be installed');
  }
});

// R: engine.rs distinct_function_names_accumulate
// H: EngineSpec.hs "distinct function names across two calls register cleanly (accumulation)"
test('engine.rs : des noms de fonctions distincts s’accumulent sur deux appels', () => {
  const st = new State();
  st.defineFunctions([fn('f', [], [])]);
  st.defineFunctions([fn('g', [], [])]);
  assert.deepEqual([...st.defs.compiled.fns.keys()], ['f', 'g']);
});

// ===== RngSpec, moitié intégration moteur (le flux vit dans State) =====

/** Park & Miller MINSTD, épinglé indépendamment de `rollStep`. */
function lehmerNext(s: number): number {
  return (s * 16807) % 2_147_483_647;
}

function applyDraw(st: State, num: number, den: number, conds: Condition[], outs: Outcome[]): void {
  for (const o of draw(num, den, conds, outs)) st.performOutcome(o);
}

// R: engine.rs each_draw_advances_the_seed_exactly_once
// H: RngSpec.hs "the stream (engine state, v50)"
// H: RngSpec.hs "rollStep is one Park-Miller step, and each draw advances the seed exactly once"
test('engine.rs : chaque tirage avance la graine exactement une fois', () => {
  const s0 = 12345;
  const s1 = lehmerNext(s0);
  const s2 = lehmerNext(lehmerNext(s0));
  const s3 = lehmerNext(lehmerNext(lehmerNext(s0)));
  assert.equal(rollStep(s0), s1);
  const st = new State();
  st.seedDie(s0);
  applyDraw(st, 1, 2, [], []);
  assert.equal(st.rngSeed, s1);
  applyDraw(st, 1, 2, [], []);
  assert.equal(st.rngSeed, s2);
  applyDraw(st, 1, 2, [], []);
  assert.equal(st.rngSeed, s3);
});

// R: engine.rs unsatisfiable_guards_still_advance_the_seed
// H: RngSpec.hs "the frozen-die law"
// H: RngSpec.hs "two draws with unsatisfiable guards still advance the seed twice"
test('engine.rs : des gardes insatisfiables avancent quand même la graine', () => {
  const s0 = 5;
  const st = new State();
  st.seedDie(s0);
  const impossible = [m('ghost.nothing')];
  applyDraw(st, 1, 2, impossible, [insert('should.never.fire')]);
  applyDraw(st, 1, 2, impossible, [insert('should.never.fire')]);
  assert.equal(st.rngSeed, lehmerNext(lehmerNext(s0)));
  assert.ok(!st.dbHas('should.never.fire'), 'the unsatisfiable-guard outs never fired');
});

// R: engine.rs a_miss_advances_the_position
// H: RngSpec.hs "a miss advances: the SAME position, drawn twice, diverges on the next draw"
test('engine.rs : un raté avance la position', () => {
  const s0 = 7;
  const r1 = lehmerNext(s0);
  const r2 = lehmerNext(lehmerNext(s0));
  assert.notEqual(r1, r2, 'fixture: the two roll bases differ');
  const st = new State();
  st.seedDie(s0);
  applyDraw(st, 1, 2, [], []);
  assert.equal(st.rngSeed, r1);
  applyDraw(st, 1, 2, [], []);
  assert.equal(st.rngSeed, r2);
});

// R: engine.rs a_hit_applies_outs
// H: RngSpec.hs "hit / miss"
// H: RngSpec.hs "a hit applies outs (seed 2, odds 1/2 -> rollStep 2 is even)"
test('engine.rs : un coup réussi applique les effets', () => {
  const s0 = 2;
  assert.ok(rollStep(s0) % 2 === 0, 'fixture: rollStep 2 is a hit');
  const st = new State();
  st.seedDie(s0);
  applyDraw(st, 1, 2, [], [insert('hit.mark')]);
  assert.ok(st.dbHas('hit.mark'));
  assert.equal(st.rngSeed, lehmerNext(s0));
});

// R: engine.rs a_miss_does_not_apply_outs
// H: RngSpec.hs "a miss does not apply outs (seed 1, odds 1/2 -> rollStep 1 is odd)"
test('engine.rs : un raté n’applique pas les effets', () => {
  const s0 = 1;
  assert.ok(rollStep(s0) % 2 === 1, 'fixture: rollStep 1 is a miss');
  const st = new State();
  st.seedDie(s0);
  applyDraw(st, 1, 2, [], [insert('hit.mark')]);
  assert.ok(!st.dbHas('hit.mark'));
  assert.equal(st.rngSeed, lehmerNext(s0));
});

// R: engine.rs two_draws_off_one_stream_advance_twice
// H: RngSpec.hs "sequential multi-draw (Village.hs's two-arm shape)"
// H: RngSpec.hs "two draws off one stream roll on successive values and advance twice"
test('engine.rs : deux tirages sur un même flux roulent sur des valeurs successives', () => {
  const s0 = 1988;
  const s1 = lehmerNext(s0);
  const s2 = lehmerNext(lehmerNext(s0));
  assert.ok(s1 % 4 < 1, 'fixture: base arm hits');
  assert.ok(s2 % 4 < 2, 'fixture: trait arm hits');
  const st = new State();
  st.seedDie(s0);
  applyDraw(st, 1, 4, [], [insert('arm1.fired')]);
  applyDraw(st, 2, 4, [], [insert('arm2.fired')]);
  assert.ok(st.dbHas('arm1.fired'));
  assert.ok(st.dbHas('arm2.fired'));
  assert.equal(st.rngSeed, s2);
});

// R: engine.rs executing_a_roll_on_an_unseeded_die_panics
// H: RngSpec.hs "an unseeded die is loud"
// H: RngSpec.hs "executing a Roll with rngSeed == Nothing is a loud error"
test('engine.rs : exécuter un Roll sur un dé non semé est bruyant', () => {
  const st = new State();
  const roll: Outcome = { t: 'roll', num: 1, den: 2, when: [], then: [insert('x')] };
  // Rust : panic « unseeded die » ; le message TS est traduit (« dé non semé »).
  assert.throws(() => st.performOutcome(roll), /non semé/);
});

// R: engine.rs seed_die_accepts_in_domain
// H: RngSpec.hs "seedDie domain guard"
// H: RngSpec.hs "an in-domain seed is accepted"
test('engine.rs : seedDie accepte une graine du domaine', () => {
  const st = new State();
  st.seedDie(12345);
  assert.equal(st.rngSeed, 12345);
});

// R: engine.rs seed_die_rejects_zero
// H: RngSpec.hs "seedDie rejects a seed of 0"
test('engine.rs : seedDie refuse 0', () => {
  assert.throws(() => new State().seedDie(0), isWE('SeedOutOfDomain'));
});

// R: engine.rs seed_die_rejects_at_or_above_modulus
// H: RngSpec.hs "seedDie rejects a seed at or above the modulus"
test('engine.rs : seedDie refuse une graine égale ou supérieure au module', () => {
  assert.throws(() => new State().seedDie(2_147_483_647), isWE('SeedOutOfDomain'));
});

// R: engine.rs seed_die_rejects_negative
// H: RngSpec.hs "seedDie rejects a negative seed"
test('engine.rs : seedDie refuse une graine négative', () => {
  assert.throws(() => new State().seedDie(-5), isWE('SeedOutOfDomain'));
});

// ---- engine.rs — mod boundary_props (proptest) ---------------------------------

/**
 * Arme… puis tire TOUTES les expirations de la file dans l'ordre des noms rendus,
 * croissant ou décroissant (le `fire_due_expiries_in` interne n'est pas exposé :
 * on le reproduit sur `st.defs`/`st.rt` avec `performEffect`, comme le Rust).
 */
function fireAllDue(st: State, ascending: boolean): void {
  const named = stableSort(
    [...st.rt.expiries.values()].map((v) => [ground(v.path, new Map()), v.path] as const),
    (a, b) => cmpStr(a[0], b[0]),
  );
  if (!ascending) named.reverse();
  for (const [, path] of named) {
    if (exists(st.rt.db, path.segs)) performEffect(st.defs, st.rt, { t: 'delete', p: path });
  }
}

// R: engine.rs boundary_props::expiry_firing_commutes (proptest)
test('engine.rs boundary_props : tirer les expirations commute (énumération complète du générateur)', () => {
  const POOL = ['feels.anger', 'feels.anger.toward.bob', 'feels.joy', 'mood!a', 'mood!b', 'at.home', 'at.home.since!noon'];
  const KEEPS = ['feels.anger.toward.carol', 'at.home.guest', 'feels.joy.reason'];
  // idxs ∈ subsequence([0..7), 1..=7), keeps ∈ subsequence([0..3), 0..=3) : 127 × 8 cas.
  let cases = 0;
  for (const idxs of subsequences(7, 1, 7)) {
    for (const keeps of subsequences(3, 0, 3)) {
      const build = (): State => {
        const st = new State();
        for (const i of idxs) st.performOutcome(insertFor(1, POOL[i]));
        for (const k of keeps) st.performOutcome(insertFor(5, KEEPS[k]));
        return st;
      };
      const asc = build();
      fireAllDue(asc, true);
      const desc = build();
      fireAllDue(desc, false);
      const ctx = `idxs=${JSON.stringify(idxs)} keeps=${JSON.stringify(keeps)}`;
      assert.deepEqual(asc.labeledFacts(), desc.labeledFacts(), ctx);
      assert.deepEqual(asc.labeledView(), desc.labeledView(), ctx);
      assert.deepEqual([...asc.expiriesRendered()], [...desc.expiriesRendered()], ctx);
      cases++;
    }
  }
  assert.equal(cases, 127 * 8);
});

// ---- engine.rs — mod delta_anchor_spec ------------------------------------------
// H: EngineSpec.hs "groundedDeltaAnchors: bounded effects, shadows, spawn opacity, Call resolution"
// H: EngineSpec.hs "groundedDeltaAnchors: safe ForEach binders bound; unsafe heads stay opaque"

/** Une pratique à une instance ; renvoie l'état et l'action fondée pour `you`. */
function probe(a: Action, fns: PraxFunction[]): [State, ReturnType<State['possibleActions']>[number]] {
  const p = practice('p', { roles: ['R'], actions: [a] });
  const st = new State();
  st.definePractices([p]);
  for (const f of fns) st.defineFunctions([f]);
  st.performOutcome(insert('practice.p.here'));
  const ga = st.possibleActions('you')[0];
  assert.ok(ga !== undefined, 'one grounded action');
  return [st, ga];
}

// R: engine.rs delta_anchor_spec::bounded_insert_and_delete
test('engine.rs delta_anchor_spec : insert et delete bornés', () => {
  const [st, ga] = probe(action('[Actor]: act', [], [insert('mark.Actor.foo')]), []);
  const anchors = st.groundedDeltaAnchorsOf(ga);
  assert.ok(anchors !== null, 'bounded');
  assert.ok(containsSegs(anchors, 'mark.you.foo'));

  const [st2, ga2] = probe(action('[Actor]: act', [], [del('gone.Actor')]), []);
  const a2 = st2.groundedDeltaAnchorsOf(ga2);
  assert.ok(a2 !== null, 'delete bounded');
  assert.ok(containsSegs(a2, 'gone.you'));
});

// R: engine.rs delta_anchor_spec::exclusion_insert_carries_shadows
test('engine.rs delta_anchor_spec : une insertion exclusive porte ses ombres', () => {
  const [st, ga] = probe(action('[Actor]: act', [], [insert('slot!gem.Actor')]), []);
  const anchors = st.groundedDeltaAnchorsOf(ga);
  assert.ok(anchors !== null, 'bounded');
  assert.ok(containsSegs(anchors, 'slot.gem.you'));
  assert.ok(containsSegs(anchors, 'slot.PraxEvicted'));
});

// R: engine.rs delta_anchor_spec::spawn_headed_inserts_are_opaque
test('engine.rs delta_anchor_spec : une insertion de tête `practice` est opaque', () => {
  const [st, ga] = probe(action('[Actor]: act', [], [insert('practice.Actor')]), []);
  assert.equal(st.groundedDeltaAnchorsOf(ga), null);
});

// R: engine.rs delta_anchor_spec::unknown_call_is_opaque_known_call_resolves
test('engine.rs delta_anchor_spec : un appel inconnu est opaque, un appel connu se résout', () => {
  const [st, ga] = probe(action('[Actor]: act', [], [call('missing', ['Actor'])]), []);
  assert.equal(st.groundedDeltaAnchorsOf(ga), null);

  const f = fn('tidy', ['Who'], [[[], [insert('clean.Who')]]]);
  const [st2, ga2] = probe(action('[Actor]: act', [], [call('tidy', ['Actor'])]), [f]);
  const anchors = st2.groundedDeltaAnchorsOf(ga2);
  assert.ok(anchors !== null, 'call resolves');
  assert.ok(containsSegs(anchors, 'clean.you'));
});

// R: engine.rs delta_anchor_spec::safe_foreach_binder_bounds_unsafe_head_opaque
test('engine.rs delta_anchor_spec : un lieur ForEach sûr borne, une tête non sûre reste opaque', () => {
  const safe = action('[Actor]: act', [], [forEach([m('item.Actor.X')], [insert('X.done')])]);
  const [st, ga] = probe(safe, []);
  assert.ok(st.groundedDeltaAnchorsOf(ga) !== null, 'safe binder bounds the head');

  const unsafe = action('[Actor]: act', [], [forEach([m('X.tag.Actor')], [insert('X.done')])]);
  const [st2, ga2] = probe(unsafe, []);
  assert.equal(st2.groundedDeltaAnchorsOf(ga2), null, 'first-position binder is unsafe');
});

// =============================================================================
// prax-core/src/compilepipe.rs — mod tests
// =============================================================================

// R: compilepipe.rs ground_effect_grounds_every_construct
// H: CookedSpec.hs "groundCookedOutcome matches groundOutcome for every remaining construct"
test('compilepipe.rs : groundEffect fonde chaque constructeur', () => {
  const b: Bindings = new Map([['W', 'bex']]);
  const roll = (when: Condition[], then: Outcome[]): Outcome => ({ t: 'roll', num: 1, den: 2, when, then });
  const cases: Array<[Outcome, Outcome]> = [
    [insert('mark.W!seen'), insert('mark.bex!seen')],
    [del('gone.W'), del('gone.bex')],
    [insertFor(3, 'temp.W'), insertFor(3, 'temp.bex')],
    [call('fn', ['W', 'k']), call('fn', ['bex', 'k'])],
    [forEach([m('g.W')], [insert('h.W')]), forEach([m('g.bex')], [insert('h.bex')])],
    [roll([m('g.W')], [insert('h.W')]), roll([m('g.bex')], [insert('h.bex')])],
  ];
  for (const [input, wanted] of cases) {
    const compiled = compileOutcome(input);
    const got = groundEffect(compiled, b);
    const expected = compileOutcome(wanted);
    assert.deepEqual(got, expected, `grounding ${JSON.stringify(input)}`);
  }
});

// R: compilepipe.rs compile_outcome_calc_and_paths
test('compilepipe.rs : compileOutcome compile chaque constructeur (calc et chemins)', () => {
  const o = forEach([calc('R', 'mul', 'N', '2')], [insert('n!R')]);
  const e: Effect = compileOutcome(o);
  assert.equal(e.t, 'forEach');
});

// =============================================================================
// prax-core/src/types.rs — mod tests
// =============================================================================

// R: types.rs builder_fluent_setters_take_array_literals_and_omit_for_empty
test('types.rs : les constructeurs prennent des littéraux de tableau, l’omission vaut vide', () => {
  // Adaptation : le Rust épingle l'inférence de ses setters fluents ; en TS les
  // constructeurs sont des fabriques à paramètres optionnels — même intention.
  const a = action('[Actor]: Order [Beverage]', [m('practice.tendBar.B.customer.Actor'), n('x!y')], [insert('practice.tendBar.B.customer.Actor!order')]);
  assert.equal(a.when.length, 2);
  assert.equal(a.then.length, 1);

  const unconditional = action('[Actor]: idle', undefined, [insert('noted')]);
  assert.equal(unconditional.when.length, 0);

  const bare = action('bare');
  assert.ok(bare.when.length === 0 && bare.then.length === 0);

  const p = practice('tendBar', {
    name: '[Bartender] is tending bar',
    roles: ['Bartender'],
    dataFacts: ['beverageType.beer!alcoholic'],
    actions: [a],
    init: [insert('practice.tendBar.B.spawned')],
  });
  assert.equal(p.id, 'tendBar');
  assert.deepEqual(p.roles, ['Bartender']);
  assert.equal(p.actions.length, 1);

  const f = fn('dbl', ['M', 'N'], [[[calc('R', 'mul', 'N', '2')], [insert('practice.math.M.n!R')]]]);
  assert.equal(f.cases.length, 1);

  const sr = scheduleRule('market', 3, [[[m('turn!Now')], [insert('marketDay')]]]);
  assert.equal(sr.body.length, 1);

  const c = boundTo(holds(withWant(character('gil'), want([m('did.duty')], 20)), 'dutiful'), 'conduct');
  assert.equal(c.wants.length, 1);
  assert.deepEqual(c.desires, ['dutiful']);
  assert.equal(c.boundTo, 'conduct');
});

const subst = (pairs: Array<[string, string]>): Map<string, string> => new Map(pairs);

// R: types.rs rename_vars_preserves_operators_through_every_constructor
test('types.rs : renameVars préserve les opérateurs à travers chaque constructeur', () => {
  const s = subst([
    ['W', 'PraxD'],
    ['V', 'PraxW'],
  ]);
  assert.deepEqual(renameVars(s, [m('at.W!place.V')]), [m('at.PraxD!place.PraxW')]);
  assert.deepEqual(renameVars(s, [n('dead.W')]), [n('dead.PraxD')]);
  assert.deepEqual(renameVars(s, [eq('W', 'V')]), [eq('PraxD', 'PraxW')]);
  assert.deepEqual(renameVars(s, [calc('W', 'add', 'V', '1')]), [calc('PraxD', 'add', 'PraxW', '1')]);
  assert.deepEqual(renameVars(s, [subquery('W', ['V'], [m('p.V.W')])]), [subquery('PraxD', ['PraxW'], [m('p.PraxW.PraxD')])]);
  assert.deepEqual(renameVars(s, [or_([[m('a.W')], [n('b.V')]])]), [or_([[m('a.PraxD')], [n('b.PraxW')]])]);
  assert.deepEqual(renameVars(s, [m('at.Owner.bar')]), [m('at.Owner.bar')]);
});

// R: types.rs rename_outcomes_mirror_covers_every_constructor
test('types.rs : renameOutcomes couvre chaque constructeur', () => {
  const s = subst([
    ['W', 'PraxD'],
    ['V', 'PraxW'],
  ]);
  assert.deepEqual(renameOutcomes(s, [insert('mark.W!seen.V')]), [insert('mark.PraxD!seen.PraxW')]);
  assert.deepEqual(renameOutcomes(s, [del('gone.W')]), [del('gone.PraxD')]);
  assert.deepEqual(renameOutcomes(s, [insertFor(3, 'temp.W')]), [insertFor(3, 'temp.PraxD')]);
  assert.deepEqual(renameOutcomes(s, [call('fn', ['W', 'k'])]), [call('fn', ['PraxD', 'k'])]);
  assert.deepEqual(renameOutcomes(s, [forEach([m('g.W')], [insert('h.V')])]), [forEach([m('g.PraxD')], [insert('h.PraxW')])]);
});

// R: types.rs outcome_vars_walks_every_constructor
test('types.rs : outcomeVars parcourt chaque constructeur', () => {
  assert.deepEqual(outcomeVars(insert('at.Who!place')), ['at', 'Who', 'place']);
  assert.deepEqual(outcomeVars(call('fn', ['A', 'b'])), ['A', 'b']);
  assert.deepEqual(outcomeVars(forEach([m('g.W')], [insert('h.W.X')])), ['g', 'W', 'h', 'W', 'X']);
});

// R: types.rs outcome_vars_rejects_a_trailing_operator_where_the_frozen_pathnames_raises
test('types.rs : outcomeVars refuse un opérateur final là où pathNames lève', () => {
  for (const o of [insert('a.b.'), del('a.b.'), insertFor(2, 'a.b.')]) {
    assert.throws(() => outcomeVars(o), trailing('a.b.', '.'), `${JSON.stringify(o)} must be rejected where the frozen pathNames raises`);
  }
  assert.throws(() => outcomeVars(forEach([m('g.W')], [insert('h!')])), WorldError, 'a ForEach body is walked too');
  assert.throws(() => outcomeVars(forEach([m('g.')], [insert('h')])), WorldError, 'a ForEach guard is walked through conditionVars');
  assert.deepEqual(outcomeVars(call('fn', ['a.b.'])), ['a.b.'], 'Call args are not paths');
});

// R: types.rs outcome_sents_collects_raw_paths_recursively
test('types.rs : outcomeSents collecte récursivement les phrases brutes', () => {
  const outs = [insert('at.Who'), call('fn', ['A']), forEach([m('g.W')], [del('h.W')])];
  assert.deepEqual(outcomeSents(outs), ['at.Who', 'g.W', 'h.W']);
});

// R: types.rs is_prax_var_is_prax_plus_at_least_one_char
test('types.rs : isPraxVar = « Prax » plus au moins un caractère', () => {
  assert.ok(isPraxVar('PraxD'));
  assert.ok(isPraxVar('PraxW2'));
  assert.ok(!isPraxVar('Prax'));
  assert.ok(!isPraxVar('Actor'));
  assert.ok(!isPraxVar('S'));
});

// R: types.rs authored_var_clash_flags_prax_and_forbidden_only
test('types.rs : authoredVarClash ne signale que l’espace Prax et les noms interdits', () => {
  const forbidden = ['Actor'];
  assert.deepEqual(authoredVarClash([], [m('flag.PraxD')], []), ['PraxD']);
  assert.deepEqual(authoredVarClash([], [], [insert('marked.PraxW')]), ['PraxW']);
  assert.deepEqual(authoredVarClash([], [], [forEach([m('y.PraxD')], [insert('done')])]), ['PraxD']);
  assert.deepEqual(authoredVarClash([], [subquery('S', ['PraxD'], [m('seen.ok')])], []), ['PraxD']);
  assert.deepEqual(authoredVarClash(forbidden, [m('who.Actor')], []), ['Actor']);
  assert.deepEqual(authoredVarClash(forbidden, [m('who.Other')], []), []);
  assert.deepEqual(authoredVarClash([], [m('plain.path')], []), []);
  assert.throws(() => authoredVarClash([], [m('who.Other.')], []), trailing('who.Other.', '.'));
});

// R: types.rs authored_pat_clash_over_split_names
test('types.rs : authoredPatClash sur des noms déjà découpés', () => {
  assert.deepEqual(authoredPatClash([], ['mark', 'PraxD']), ['PraxD']);
  assert.deepEqual(authoredPatClash([], ['mark', 'X']), []);
});

// =============================================================================
// prax-core/src/relevance.rs — mod tests (H: RelevanceSpec.hs "Prax.Relevance")
// =============================================================================

// R: relevance.rs the_death_read_anchor_is_tokenized_like_every_other_death_sentence
test('relevance.rs : l’ancre de mort est tokenisée comme toute autre phrase de mort', () => {
  const anchors = moverReadAnchors([], new Map(), new Map(), new Map(), 'olaf', 'hall.keeper');
  const wanted = tokenize('dead.hall.keeper').segs;
  assert.ok(
    anchors.some((a) => arrEq(a, wanted)),
    `the death anchor must SPLIT the mover name (3 segments: dead.hall.keeper); got lengths ${JSON.stringify(anchors.map((a) => a.length))}`,
  );
});

const segsOf = (s: string): readonly string[] => tokenize(s).segs;

// R: relevance.rs may_unify_needs_a_shared_literal_anchor
test('relevance.rs : mayUnifySyms exige une ancre littérale commune', () => {
  assert.ok(mayUnifySyms(segsOf('lied.X'), segsOf('lied.bob')));
  assert.ok(!mayUnifySyms(segsOf('lied.X'), segsOf('regards.X')));
  assert.ok(!mayUnifySyms(segsOf('X.Y'), segsOf('P.bob')));
  assert.ok(!mayUnifySyms(segsOf('at.bar'), segsOf('at.mill')), 'aligned differing literals cannot unify');
});

// R: relevance.rs may_unify_is_prefix_compatible
test('relevance.rs : mayUnifySyms est compatible par préfixe', () => {
  assert.ok(mayUnifySyms(segsOf('practice.tendBar'), segsOf('practice.tendBar.ada.customer.beth')));
});

// R: relevance.rs may_unify_syms_wildcards_and_prefixes
// H: RelevanceSpec.hs "mayUnifySyms: variables are wildcards, prefixes are compatible"
test('relevance.rs : mayUnifySyms — variables jokers, préfixes compatibles', () => {
  const u = (a: string, b: string): boolean => mayUnifySyms(segsOf(a), segsOf(b));
  assert.ok(u('lied.Actor.H.stole.C.loaf', 'lied.eve.dana.stole.carol.loaf'), 'var vs concrete');
  assert.ok(u('Hearer.believes.took.Culprit.gem.heard.Actor', 'oz.believes.took.kit.gem'), 'prefix compatibility (longer insert, shorter pattern)');
  assert.ok(!u('regards.W.carol.thief', 'practice.earnBread.Owner.did.P'), 'distinct constants do not unify');
});

// ---- relevance.rs — mod spec -----------------------------------------------------

/** L'entrée de la table de vie, rendue par nom. */
function renderedLiveness(st: State, name: string): [string, string[][]] {
  const r = st.livenessRendered().get(name);
  if (r === undefined) throw new Error(`no liveness entry for ${name}`);
  return r;
}

/** Rust `liveness_of` (test-only) : l'entrée brute de la table compilée. */
const livenessOf = (st: State, name: string) => st.compiled.liveness.get(name);

// R: relevance.rs spec::improvable_via_eviction_shadow
// H: RelevanceSpec.hs "an exclusion insert counts as evicting ANY sibling on the delete side"
test('relevance.rs spec : une insertion exclusive évince tout frère (côté retrait)', () => {
  const shrine = practice('shrine', { roles: ['R'], actions: [action('[Actor]: enshrine the gem', [m('slot.stone')], [insert('slot!gem')])] });
  const st = new State();
  st.definePractices([shrine]);
  st.setDesires([desire('hates-the-stone', want([m('slot.stone')], -2))]);
  assert.deepEqual([...st.improvables], ['hates-the-stone']);
});

// R: relevance.rs spec::improvable_eviction_covers_whole_subtree
// H: RelevanceSpec.hs "eviction covers the WHOLE displaced subtree, not just the shadow's shape"
test('relevance.rs spec : l’éviction couvre TOUT le sous-arbre déplacé', () => {
  const temple = practice('temple', {
    roles: ['R'],
    actions: [action('[Actor]: rededicate the altar', [m('shrine.here')], [insert('altar!new.rite!dawn')])],
  });
  const st = new State();
  st.definePractices([temple]);
  st.setDesires([desire('mourns-the-relic', want([m('altar.old.relic.jade')], -2))]);
  assert.deepEqual([...st.improvables], ['mourns-the-relic']);
});

// R: relevance.rs spec::liveness_negative_desire_is_floor_check
// H: RelevanceSpec.hs "livenessOf: a negative desire is FloorCheck unconditionally"
test('relevance.rs spec : un désir négatif est FloorCheck sans condition', () => {
  const st = new State();
  st.setDesires([desire('hates-mud', want([m('muddy.Owner')], -3))]);
  assert.deepEqual(livenessOf(st, 'hates-mud'), { k: 'FloorCheck' });
});

// R: relevance.rs spec::liveness_weight_zero_is_always_live
// H: RelevanceSpec.hs "livenessOf: a weight-0 desire is AlwaysLive (defensive; screened statically first)"
test('relevance.rs spec : un désir de poids 0 est AlwaysLive', () => {
  const st = new State();
  st.setDesires([desire('indifferent', want([m('whatever.Owner')], 0))]);
  assert.deepEqual(livenessOf(st, 'indifferent'), { k: 'AlwaysLive' });
});

// R: relevance.rs spec::liveness_positive_gates_on_the_ticker_only_conjunct
// H: RelevanceSpec.hs "livenessOf: a positive desire with a ticker-only conjunct gates on it alone"
test('relevance.rs spec : un désir positif se garde sur le seul conjoint hors d’atteinte des actions', () => {
  const bakery = practice('bakery', { roles: ['R'], actions: [action('[Actor]: bake', [m('practice.bakery.here')], [insert('meal.bread')])] });
  const st = new State();
  st.definePractices([bakery]);
  st.setDesires([desire('pursues-lunch', want([m('hungry.Owner'), m('meal.M')], 5))]);
  assert.deepEqual(renderedLiveness(st, 'pursues-lunch'), ['GateCheck', [['hungry.Owner']]]);
});

// R: relevance.rs spec::liveness_axiom_derivable_candidate_never_gates
// H: RelevanceSpec.hs "livenessOf: an axiom-derivable candidate gate never qualifies (conservative)"
test('relevance.rs spec : un candidat dérivable par axiome ne garde jamais', () => {
  const st = new State();
  st.setAxioms([axiom([m('starving.Owner')], ['hungry.Owner'])]);
  st.setDesires([desire('pursues-food', want([m('hungry.Owner')], 5))]);
  assert.deepEqual(livenessOf(st, 'pursues-food'), { k: 'AlwaysLive' });
});

// R: relevance.rs spec::liveness_subquery_bearing_want_is_always_live
// H: RelevanceSpec.hs "livenessOf: a Subquery-bearing want is AlwaysLive (uncertainty always wins)"
test('relevance.rs spec : une envie à sous-requête est AlwaysLive', () => {
  const st = new State();
  st.setDesires([desire('counts-friends', want([subquery('Fs', ['F'], [m('friend.Owner.F')])], 5))]);
  assert.deepEqual(livenessOf(st, 'counts-friends'), { k: 'AlwaysLive' });
});

/** Le monde de la place : promenade, fête de calendrier, envie sur les deux. */
function plaza(alsoPerson: boolean): State {
  const actions: Action[] = [action('[Actor]: stroll the plaza', [m('practice.plaza.here')], [insert('strolled.Actor')])];
  if (alsoPerson) actions.push(action('[Actor]: light the lanterns', [m('practice.plaza.here')], [insert('festive.now')]));
  const p = practice('plaza', { roles: ['R'], actions });
  const st = new State();
  st.definePractices([p]);
  st.setCharacters([character('ana')]);
  st.setDesires([desire('loves-a-crowd', want([m('festive.now'), m('strolled.Owner')], 3))]);
  st.setSchedule([scheduleRule('festival', 4, [[[], [insert('festive.now')]]])]);
  return st;
}

// R: relevance.rs spec::schedule_moved_facts_are_environment_gates
// H: RelevanceSpec.hs "schedule-moved facts are environment gates (the schedule is not a mover)"
test('relevance.rs spec : les faits mus par le calendrier sont des portes d’environnement', () => {
  assert.deepEqual(renderedLiveness(plaza(false), 'loves-a-crowd'), ['GateCheck', [['festive.now']]]);
});

// R: relevance.rs spec::action_insertable_facts_still_never_gate
// H: RelevanceSpec.hs "action-insertable facts still never gate; the schedule cannot launder them"
test('relevance.rs spec : un fait insérable par action ne garde jamais', () => {
  assert.deepEqual(livenessOf(plaza(true), 'loves-a-crowd'), { k: 'AlwaysLive' });
});

// R: relevance.rs spec::hunger_want_shape_regains_its_gate
// H: RelevanceSpec.hs "the village hunger want-shape regains its gate under the reclassification"
test('relevance.rs spec : la forme d’envie « faim » du village retrouve sa porte', () => {
  const eatery = practice('eatery', { roles: ['R'], actions: [action('[Actor]: eat', [m('hungry.Actor')], [insert('meal.Actor')])] });
  const st = new State();
  st.definePractices([eatery]);
  st.setCharacters([character('bob')]);
  st.setDesires([desire('wants-food', want([m('hungry.Owner'), m('meal.M')], 5))]);
  st.setSchedule([scheduleRule('hunger', 3, [[[m('appetite.X'), not_('hungry.X')], [insert('hungry.X')]]])]);
  assert.deepEqual(renderedLiveness(st, 'wants-food'), ['GateCheck', [['hungry.Owner']]]);
});

// R: relevance.rs spec::producible_atoms_include_schedule_rule_inserts
test('relevance.rs spec : les atomes productibles incluent les insertions des règles de calendrier', () => {
  const stall = practice('stall', { roles: ['R'], actions: [action('[Actor]: browse', [m('practice.stall.here')], [insert('browsed.Actor')])] });
  const st = new State();
  st.definePractices([stall]);
  st.setSchedule([scheduleRule('market', 4, [[[], [insert('marketDay.now')]]])]);
  const pool = st.producibleAtoms();
  assert.ok(pool !== null, 'no wild Call anywhere, so the pool is Some');
  assert.ok(containsSegs(pool, 'marketDay.now'), 'a SCHEDULE rule’s insert atom must be producible');
});

// R: relevance.rs spec::mover_read_anchors_grounds_to_the_pair
// H: RelevanceSpec.hs "moverReadAnchors: scope, believes, death, affordances, desires — grounded to the pair"
test('relevance.rs spec : moverReadAnchors est fondé sur la paire', () => {
  const eatery = practice('eatery', {
    roles: ['R'],
    actions: [
      action('[Actor]: eat', [m('hungry.Actor')], [forEach([m('crumb.C')], [del('crumb.C')]), insert('meal.Actor')]),
      action('[Actor]: clean up', [], [call('tidy', ['Actor'])]),
    ],
  });
  const tidy = fn('tidy', ['Who'], [[[], [forEach([m('dish.D')], [del('dish.D')])]]]);
  const st = new State();
  st.definePractices([eatery]);
  st.defineFunctions([tidy]);
  st.setCharacters([character('priya'), character('beth')]);
  st.setDesires([desire('wants-food', want([m('hungry.Owner')], 5))]);
  const anchors = st.moverReadAnchorsOf('priya', 'beth');
  const has = (s: string): boolean => containsSegs(anchors, s);
  assert.ok(has('priya.believes.desires.beth.PraxD'), 'believes family');
  assert.ok(has('dead.beth'), 'death mark');
  assert.ok(has('hungry.beth'), 'affordance/desire cond, Actor/Owner:=beth');
  assert.ok(has('crumb.C'), 'ForEach guard read');
  assert.ok(has('dish.D'), 'function-body ForEach guard read');
  assert.ok(!has('hungry.priya'), 'NOT grounded to the predictor');
});

// R: relevance.rs eviction_shadows_one_per_bang_truncated_with_wildcard
test('relevance.rs : une ombre d’éviction par `!`, tronquée avec le joker', () => {
  const shadows = evictionShadowNames(tokenize('a.b!c!d'));
  assert.deepEqual(shadows, [
    ['a', 'b', 'PraxEvicted'],
    ['a', 'b', 'c', 'PraxEvicted'],
  ]);
  assert.deepEqual(evictionShadowNames(tokenize('a.b.c')), []);
});

// =============================================================================
// prax-core/src/rng.rs — mod tests (H: RngSpec.hs "Prax.Rng")
// =============================================================================

// R: rng.rs seed_bounds_are_the_open_interval
// H: RngSpec.hs "the domain bounds are the open interval (0, modulus)"
test('rng.rs : le domaine de la graine est l’intervalle ouvert (0, module)', () => {
  assert.deepEqual([...SEED_BOUNDS], [1, 2_147_483_646]);
});

// R: rng.rs roll_step_is_one_park_miller_step
test('rng.rs : rollStep est un pas de Park-Miller', () => {
  assert.equal(rollStep(12345), lehmerNext(12345));
  assert.equal(rollStep(1), 16807);
  assert.equal(rollStep(2), 33614);
});

const drawOdds = (num: number, den: number) => isWE('DrawOdds', (d) => d.num === num && d.den === den);

// H: RngSpec.hs "draw's authoring guards (surviving pins, re-pointed to the Roll form)"

// R: rng.rs draw_rejects_num_zero
// H: RngSpec.hs "num == 0 is rejected"
test('rng.rs : draw refuse num == 0', () => {
  assert.throws(() => draw(0, 2, [], []), drawOdds(0, 2));
});

// R: rng.rs draw_rejects_num_equals_den
// H: RngSpec.hs "num == den is rejected (certainty is not a chance)"
test('rng.rs : draw refuse num == den', () => {
  assert.throws(() => draw(2, 2, [], []), drawOdds(2, 2));
});

// R: rng.rs draw_rejects_num_over_den
// H: RngSpec.hs "num > den is rejected"
test('rng.rs : draw refuse num > den', () => {
  assert.throws(() => draw(3, 2, [], []), drawOdds(3, 2));
});

// R: rng.rs draw_rejects_prax_namespace_in_conditions
// H: RngSpec.hs "the Prax namespace in the caller's conditions is rejected"
test('rng.rs : draw refuse l’espace Prax dans les conditions', () => {
  assert.throws(() => draw(1, 2, [m('flag.PraxS')], []), isWE('ReservedVarClash'));
});

// R: rng.rs draw_rejects_prax_namespace_in_outcomes
// H: RngSpec.hs "the Prax namespace in the caller's outcomes is rejected"
test('rng.rs : draw refuse l’espace Prax dans les effets', () => {
  assert.throws(() => draw(1, 2, [], [insert('marked.PraxR')]), isWE('ReservedVarClash'));
});

// R: rng.rs draw_accepts_ordinary_variables
// H: RngSpec.hs "ordinary variables S/S2/S3/R are unremarkable authoring names"
test('rng.rs : draw accepte les variables ordinaires', () => {
  const r = draw(1, 2, [m('flag.S')], [insert('marked.R')]);
  assert.equal(r.length, 1);
  const o = r[0];
  assert.ok(o.t === 'roll' && o.num === 1 && o.den === 2);
});

// R: rng.rs draw_rejects_a_trailing_operator_where_the_frozen_walk_raises
test('rng.rs : draw refuse un opérateur final là où le parcours gelé lève', () => {
  assert.throws(() => draw(1, 2, [m('a.b.')], []), trailing('a.b.', '.'));
});

// H: GateSpec.hs "Prax.Gate"
// H: GateSpec.hs "the shared guard (Prax.Types.authoredVarClash), pinned through a real combinator"
const drawOk = (f: () => Outcome[]): boolean => {
  try {
    f();
    return true;
  } catch (e) {
    if (e instanceof WorldError) return false;
    throw e;
  }
};
const subqPraxD = (): Condition => subquery('S', ['PraxD'], [m('seen.ok')]);

// R: rng.rs gate_ordinary_fragment_is_accepted
// H: GateSpec.hs "sanity: an ordinary fragment (no Prax namespace) is accepted"
test('rng.rs gate : un fragment ordinaire est accepté', () => {
  assert.ok(drawOk(() => draw(1, 2, [m('flag.X')], [insert('marked.X')])));
});

// R: rng.rs gate_prax_in_top_level_conditions_is_caught
// H: GateSpec.hs "a Prax-namespaced variable in the top-level conditions is caught"
test('rng.rs gate : une variable Prax dans les conditions est attrapée', () => {
  assert.ok(!drawOk(() => draw(1, 2, [m('flag.PraxD')], [])));
});

// R: rng.rs gate_prax_in_top_level_outcomes_is_caught
// H: GateSpec.hs "a Prax-namespaced variable in the top-level outcomes is caught"
test('rng.rs gate : une variable Prax dans les effets est attrapée', () => {
  assert.ok(!drawOk(() => draw(1, 2, [], [insert('marked.PraxW')])));
});

// R: rng.rs gate_prax_nested_in_a_foreach_guard_is_caught
// H: GateSpec.hs "a Prax-namespaced variable nested inside a ForEach outcome's own conditions is caught"
test('rng.rs gate : une variable Prax dans la garde d’un ForEach imbriqué est attrapée', () => {
  assert.ok(!drawOk(() => draw(1, 2, [], [forEach([m('y.PraxD')], [insert('done')])])));
});

// R: rng.rs gate_prax_in_a_subquery_free_var_list_is_caught
// H: GateSpec.hs "a Prax-namespaced variable in a Subquery's free-variable list is caught"
test('rng.rs gate : une variable Prax dans la liste libre d’une sous-requête est attrapée', () => {
  assert.ok(!drawOk(() => draw(1, 2, [subqPraxD()], [])));
});

// =============================================================================
// prax-core/src/turn.rs — mod intention_spec
// =============================================================================
// H: LoopSpec.hs "a quiet character acts their standing intention — even when fresh deliberation would differ"
// H: LoopSpec.hs "each trigger reconsiders: options, satisfaction, live drive, learned motive"
// H: LoopSpec.hs "a NON-bearing template appearing does not reconsider (irrelevant comings and goings)"
// H: LoopSpec.hs "a standing action that is no longer offered forces re-deliberation"

const labelOf = (a: { label: string } | null): string | null => (a === null ? null : a.label);

/** Délibère et range l'intention SANS l'exécuter. */
function establish(st: State, depth: number, actor: Character): string | null {
  const sig = st.motiveSignature(actor);
  const chosen = st.pickAction(depth, actor);
  st.setIntention(actor.name, { act: chosen, basis: sig });
  return labelOf(chosen);
}

// R: turn.rs intention_spec::quiet_character_holds_intention_despite_diverging_deliberation
test('turn.rs : un personnage tranquille tient son intention malgré une délibération divergente', () => {
  const p = practice('spat', {
    roles: ['R'],
    actions: [
      action('[Actor]: goad beth', [neq('Actor', 'beth')], [insert('goaded.beth')]),
      action('[Actor]: slap priya', [m('grudge.Actor'), m('goaded.Actor')], [insert('slapped.priya')]),
      action('[Actor]: wait about'),
    ],
  });
  const priya = withWant(withWant(character('priya'), want([m('goaded.beth')], 5)), want([m('slapped.priya')], -20));
  const st = new State();
  st.definePractices([p]);
  st.setCharacters([priya, character('beth')]);
  st.setDesires([desire('vengeful', want([m('grudge.Owner'), m('slapped.priya')], 8))]);
  st.performOutcome(insert('practice.spat.here'));
  st.performOutcome(insert('priya.believes.desires.beth.vengeful.heard.gossip'));

  assert.equal(establish(st, 2, priya), 'priya: goad beth');
  st.performOutcome(insert('grudge.beth'));
  assert.equal(labelOf(st.pickAction(2, priya)), 'priya: wait about');
  assert.equal(labelOf(npcAct(st, 2, priya)), 'priya: goad beth');
});

// R: turn.rs intention_spec::options_trigger_reconsiders
test('turn.rs : une nouvelle option force la reconsidération', () => {
  const p = practice('mess', {
    roles: ['R'],
    actions: [action('[Actor]: eat lunch', [m('hungry.Actor')], [insert('meal.Actor')]), action('[Actor]: idle about')],
  });
  const beth = withWant(character('beth'), want([m('meal.beth')], 10));
  const st = new State();
  st.definePractices([p]);
  st.setCharacters([beth]);
  st.performOutcome(insert('practice.mess.here'));

  const a1 = establish(st, 2, beth);
  assert.equal(a1, 'beth: idle about');
  st.performOutcome(insert('hungry.beth'));
  const a2 = labelOf(npcAct(st, 2, beth));
  assert.equal(a2, 'beth: eat lunch');
  assert.notEqual(a1, a2, 'a new option must force reconsideration');
});

// R: turn.rs intention_spec::non_bearing_template_does_not_reconsider
test('turn.rs : un gabarit non porteur qui apparaît ne fait pas reconsidérer', () => {
  const p = practice('lull', {
    roles: ['R'],
    actions: [action('[Actor]: amble over', [m('gate.open')]), action('[Actor]: idle about')],
  });
  const beth = withWant(character('beth'), want([m('meal.beth')], 10));
  const st = new State();
  st.definePractices([p]);
  st.setCharacters([beth]);
  st.performOutcome(insert('practice.lull.here'));

  assert.equal(establish(st, 2, beth), 'beth: idle about');
  st.performOutcome(insert('gate.open'));
  assert.equal(labelOf(st.pickAction(2, beth)), 'beth: amble over');
  assert.equal(labelOf(npcAct(st, 2, beth)), 'beth: idle about');
});

// R: turn.rs intention_spec::vanished_grounding_forces_redeliberation
test('turn.rs : une action en cours qui n’est plus offerte force la redélibération', () => {
  const p = practice('lull2', {
    roles: ['R'],
    actions: [action('[Actor]: amble over', [m('roomy.here')]), action('[Actor]: idle about')],
  });
  const beth = withWant(character('beth'), want([m('meal.beth')], 10));
  const st = new State();
  st.definePractices([p]);
  st.setCharacters([beth]);
  st.performOutcome(insert('practice.lull2.here'));
  st.performOutcome(insert('roomy.here'));

  assert.equal(establish(st, 2, beth), 'beth: amble over');
  st.performOutcome(del('roomy.here'));
  assert.equal(labelOf(npcAct(st, 2, beth)), 'beth: idle about');
});

// =============================================================================
// prax-core/src/sight.rs — mod tests (H: SightSpec.hs "Prax.Sight")
// =============================================================================

/** Deux pièces : ute et vic partagent la salle, wes est seul au grenier. */
function sightWorld(): State {
  const st = new State();
  st.setCharacters([character('ute'), character('vic'), character('wes')]);
  st.setSchedule([sightRule([m('at.Seer!Spot'), m('at.Seen!Spot')])]);
  for (const o of [insert('at.ute!hall'), insert('at.vic!hall'), insert('at.wes!attic')]) st.performOutcome(o);
  return st;
}

/** Une frontière de tour = un tic de perception. */
function tick(st: State): State {
  const next = st.clone();
  next.roundBoundary();
  return next;
}

// R: sight.rs the_fixture_world_is_well_formed
// H: SightSpec.hs "the fixture world is well-formed"
test('sight.rs : le monde de la fixture est bien formé', () => {
  const errs = typeCheck(sightWorld());
  assert.deepEqual(errs, [], `the sighting fixture is well-formed, got ${JSON.stringify(errs)}`);
});

// R: sight.rs the_round_boundary_advances_the_world_turn
// H: SightSpec.hs "the round boundary advances the world turn"
test('sight.rs : la frontière de tour avance le tour du monde', () => {
  const st = sightWorld();
  assert.ok(st.dbHas('turn!0'), 'turn 0 at setup');
  const one = tick(st);
  assert.ok(one.dbHas('turn!1'), 'turn 1 after a boundary');
  const two = tick(one);
  assert.ok(two.dbHas('turn!2'), 'turn 2 after two');
});

// R: sight.rs co_presence_deposits_sightings_both_ways
// H: SightSpec.hs "co-presence deposits sightings, both ways; the absent see nothing"
test('sight.rs : la co-présence dépose des aperçus dans les deux sens', () => {
  const st = tick(sightWorld());
  assert.ok(st.dbHas('ute.believes.at.vic!hall'), 'ute sighted vic in the hall');
  assert.ok(st.dbHas('vic.believes.at.ute!hall'), 'vic sighted ute');
  assert.ok(st.dbHas('ute.believes.atSince.vic!1'), 'stamped with the turn');
  assert.ok(!st.dbHas('ute.believes.at.wes'), 'nobody sighted wes');
  assert.ok(!st.dbHas('wes.believes.at.ute'), 'wes sighted nobody');
});

// R: sight.rs a_sighting_persists_after_separation_and_a_new_one_overwrites_it
// H: SightSpec.hs "a sighting persists after separation, and a new one overwrites it"
test('sight.rs : un aperçu persiste après la séparation, un nouveau l’écrase', () => {
  const st1 = tick(sightWorld());
  const moved = st1.clone();
  moved.performOutcome(insert('at.vic!attic'));
  const st2 = tick(moved);
  assert.ok(st2.dbHas('ute.believes.at.vic!hall'), 'ute still believes vic is in the hall (stale)');
  assert.ok(st2.dbHas('ute.believes.atSince.vic!1'), 'and the stamp did not refresh');
  const followed = st2.clone();
  followed.performOutcome(insert('at.ute!attic'));
  const st3 = tick(followed);
  assert.ok(st3.dbHas('ute.believes.at.vic!attic'), 'belief updated');
  assert.ok(!st3.dbHas('ute.believes.at.vic!hall'), 'old belief gone');
  assert.ok(st3.dbHas('ute.believes.atSince.vic!3'), 'stamp refreshed');
});

// R: sight.rs sighted_within_is_a_window_over_the_stamp
// H: SightSpec.hs "sightedWithin is a window over the stamp"
test('sight.rs : sightedWithin est une fenêtre sur l’horodatage', () => {
  assert.deepEqual(sightedWithin(2), [
    m('Actor.believes.atSince.Witness!Since'),
    m('turn!Now'),
    calc('Expiry', 'add', 'Since', '2'),
    cmp('gte', 'Expiry', 'Now'),
  ]);
  const pair: Array<[string, string]> = [
    ['Actor', 'ute'],
    ['Witness', 'vic'],
  ];
  const st1 = tick(sightWorld());
  assert.ok(st1.conditionsHold(sightedWithin(2), pair), 'holds right after the sighting');
  st1.performOutcome(insert('at.vic!attic'));
  const st2 = tick(tick(st1));
  assert.ok(st2.conditionsHold(sightedWithin(2), pair), 'still holds AT the expiry turn (the comparison is >=)');
  const st3 = tick(st2);
  assert.ok(!st3.conditionsHold(sightedWithin(2), pair), 'fails once the window has lapsed');
});

// =============================================================================
// prax-core/src/minds.rs — mod tests
// =============================================================================

function mindsVocab(): Desire[] {
  return [desire('sweet-tooth', want([matches('holding.Owner.cake')], 5)), desire('grudge-rex', want([matches('shamed.rex')], 7))];
}

/** `Prax.Minds.believedWants` : `believedDesires` composé avec la fondation `Owner`. */
function believedWants(view: ReturnType<typeof emptyDb>, desires: Desire[], p: string, mover: string): Want[] {
  const s = new Map([['Owner', mover]]);
  return believedDesires(view, desires, p, mover).map((d) => want(renameVars(s, d.want.when), d.want.utility));
}

/** Rust `render_cond` (test-only) : total sur Match/Not, panique sinon. */
function renderCondStrict(c: Cond): string {
  if (c.t === 'match') return `Match ${c.segs.join('.')}`;
  if (c.t === 'not') return `Not ${c.segs.join('.')}`;
  throw new Error(`render_cond: extend me for ${JSON.stringify(c)}`);
}

// R: minds.rs believed_wants_reads_any_provenance_and_only_believed_desires
// H: MindsSpec.hs "believedWants reads any provenance, and only believed desires"
test('minds.rs : believedWants lit toute provenance, et seulement les désirs crus', () => {
  const vocab = mindsVocab();
  const base = insertStr(emptyDb(), 'rex.believes.desires.ida.sweet-tooth.presumed');
  assert.deepEqual(believedWants(base, vocab, 'ida', 'rex'), [], 'ida believes no desire of rex’s, so she models nothing');
  const told = insertStr(base, 'ida.believes.desires.rex.grudge-rex.heard.sam');
  assert.deepEqual(
    believedWants(told, vocab, 'ida', 'rex'),
    [want([matches('shamed.rex')], 7)],
    'hearsay counts — and ONLY the believed desire, not the whole vocabulary',
  );
  assert.deepEqual(believedWants(base, vocab, 'rex', 'ida'), [want([matches('holding.ida.cake')], 5)]);
});

// R: minds.rs set_characters_retables_cooked_wants_and_retable_tracks_cooked_desires
// H: MindsSpec.hs "setCharacters retables cookedWants; retable tracks cookedDesires"
test('minds.rs : setCharacters refait la table des envies ; elle suit les désirs compilés', () => {
  const st = new State();
  st.setDesires(mindsVocab());
  const rex = holds(withWant(withWant(character('rex'), want([matches('x')], 1)), want([matches('y.Z')], 2)), 'grudge-rex');
  st.setCharacters([character('ida'), rex]);
  for (const o of [insert('x'), insert('y.a'), insert('y.b'), insert('shamed.rex'), insert('holding.ida.cake')]) st.performOutcome(o);

  // Rust `compiled_wants_rendered` / `compiled_desires_rendered` (test-only) : lus
  // ici directement sur `st.compiled`.
  const wants = new Map([...st.compiled.wants].map(([k, ws]) => [k, ws.map((cs) => cs.map(renderCondStrict))]));
  assert.deepEqual([...wants.keys()], ['ida', 'rex']);
  assert.deepEqual(wants.get('ida'), []);
  assert.deepEqual(wants.get('rex'), [['Match x'], ['Match y.Z']]);
  const desires = new Map([...st.compiled.desires].map(([k, cs]) => [k, cs.map(renderCondStrict)]));
  assert.deepEqual([...desires.keys()], ['grudge-rex', 'sweet-tooth']);
  assert.deepEqual(desires.get('grudge-rex'), ['Match shamed.rex']);
  assert.deepEqual(desires.get('sweet-tooth'), ['Match holding.Owner.cake']);

  assert.equal(st.evaluateSelfWants(character('ida')), 0);
  assert.equal(st.evaluateSelfWants(rex), 1 + 2 * 2 + 7);
  assert.equal(st.evaluateSelfWants(holds(character('ida'), 'sweet-tooth')), 5);

  const rex2 = holds(withWant(character('rex'), want([matches('y.Z')], 1)), 'grudge-rex');
  st.setCharacters([character('ida'), rex2]);
  assert.equal(
    st.evaluateSelfWants(rex2),
    2 + 7,
    'the cooked want table was rebuilt, not reused (a stale table would pair the old `x` conditions with the new utility and score 8)',
  );
});

// R: minds.rs believed_desires_is_in_vocabulary_order
test('minds.rs : believedDesires suit l’ordre du vocabulaire', () => {
  let db = emptyDb();
  for (const f of ['ida.believes.desires.rex.grudge-rex.seen', 'ida.believes.desires.rex.sweet-tooth.seen']) db = insertStr(db, f);
  const names = believedDesires(db, mindsVocab(), 'ida', 'rex').map((d) => d.name);
  assert.deepEqual(names, ['sweet-tooth', 'grudge-rex']);
});

// =============================================================================
// prax-core/src/vocab_consts.rs — mod tests
// =============================================================================

// R: vocab_consts.rs constants_match_the_frozen_vocabulary
test('vocab_consts.rs : les constantes correspondent au vocabulaire gelé', () => {
  assert.equal(OBLIGED_HEAD, 'obliged');
  assert.equal(OBLIGED_LIFT_PREFIX, 'obliged.Obligor.');
  assert.equal(PUNITIVE_PREFIX, 'punishes-');
  assert.equal(obligationPath('bex', 'settle.up'), 'obliged.bex.settle.up');
});

// =============================================================================
// conformance/src/engine_replay.rs — rejeu octet pour octet de engine.json
// =============================================================================

type Step = (st: State) => void;
const perform =
  (o: Outcome): Step =>
  (st) =>
    st.performOutcome(o);
const rollO = (num: number, den: number, when: Condition[], then: Outcome[]): Outcome => ({ t: 'roll', num, den, when, then });

/** Le jumeau de chaque scénario `engineFixture` de l'oracle (seules les SORTIES viennent du moteur gelé). */
function replayScenario(name: string): [State, Step[]] {
  switch (name) {
    case 'spawn: base-vs-view opacity, inits run despite a view-visible instance': {
      const st = new State();
      st.definePractices([practice('pp', { roles: ['R'], init: [insert('practice.pp.R.mark')] })]);
      st.setAxioms([axiom([m('seed.X')], ['practice.pp.X'])]);
      return [st, [perform(insert('seed.a')), perform(insert('practice.pp.a'))]];
    }
    case 'spawn: re-spawn after delete re-runs init': {
      const st = new State();
      st.definePractices([practice('rp', { roles: ['R'], init: [insert('practice.rp.R.mark')] })]);
      return [st, [perform(insert('practice.rp.a')), perform(del('practice.rp.a')), perform(insert('practice.rp.a'))]];
    }
    case 'ForEach snapshots bindings: a member inserted mid-fold is not visited':
      return [new State(), [perform(insert('member.a')), perform(forEach([m('member.X')], [insert('member.b'), insert('visited.X')]))]];
    case 'Call: queries BASE (not the view), first case + first binding only': {
      const st = new State();
      st.defineFunctions([
        fn('pick', ['Who'], [
          [[m('cand.Who.X')], [insert('chose.X')]],
          [[], [insert('fallback')]],
        ]),
      ]);
      st.setAxioms([axiom([m('trig.W')], ['cand.W.zzz'])]);
      return [st, [perform(insert('cand.gil.beta')), perform(insert('cand.gil.alpha')), perform(insert('trig.gil')), perform(call('pick', ['gil']))]];
    }
    case 'InsertFor: arm, refresh, bare-insert cancel, sibling arm, delete purge':
      return [
        new State(),
        [
          perform(insertFor(3, 'a.b.c')),
          perform(insertFor(5, 'a.b.c')),
          perform(insert('a.b.c')),
          perform(insertFor(4, 'a.b.c')),
          perform(insertFor(4, 'a.b.d')),
          perform(del('a.b')),
        ],
      ];
    case 'Roll: unconditional advance on a miss (seed 1: rollStep is odd -> miss)': {
      const st = new State();
      st.seedDie(1);
      return [st, [perform(rollO(1, 2, [], [insert('roll.a')])), perform(rollO(1, 2, [], [insert('roll.b')]))]];
    }
    case 'Roll: a hit applies the body (seed 2: rollStep is even -> hit)': {
      const st = new State();
      st.seedDie(2);
      return [st, [perform(rollO(1, 2, [], [insert('roll.hit')]))]];
    }
    case 'bottom collapse: a contradicting insert surfaces `contradiction` in the view': {
      const st = new State();
      st.setAxioms([axiom([m('trig')], ['light!red']), axiom([m('trig')], ['light!green'])]);
      return [st, [perform(insert('trig'))]];
    }
    default:
      throw new Error(`engine.json scenario has no TS twin: ${JSON.stringify(name)}`);
  }
}

interface Dump {
  facts: string[];
  view: string[];
  cursor: number;
  rng: number | null;
  dues: Record<string, number>;
  expiries: Record<string, number>;
}

const sortedEntries = (o: Record<string, number>): Array<[string, number]> => stableSort(Object.entries(o), (a, b) => cmpStr(a[0], b[0]));

function checkDump(st: State, dump: Dump, name: string, i: number): void {
  const at = `@ ${name} step ${i}`;
  assert.deepEqual(st.labeledFacts(), dump.facts, `facts ${at}`);
  assert.deepEqual(st.labeledView(), dump.view, `view ${at}`);
  assert.equal(st.cursor, dump.cursor, `cursor ${at}`);
  assert.equal(st.rngSeed, dump.rng, `rng ${at}`);
  assert.deepEqual([...st.scheduleDues()], sortedEntries(dump.dues), `dues ${at}`);
  assert.deepEqual([...st.expiriesRendered()], sortedEntries(dump.expiries), `expiries ${at}`);
}

// R: engine_replay.rs replay::engine_scenarios_replay_byte_for_byte
test('engine_replay.rs : chaque scénario de engine.json se rejoue octet pour octet', () => {
  const data = JSON.parse(readFileSync(join(RACINE, 'tests', 'fixtures', 'prax', 'engine.json'), 'utf8')) as {
    scenarios: Array<{ name: string; steps: Array<{ dump: Dump }> }>;
  };
  const scenarios = data.scenarios;
  assert.ok(scenarios.length > 0, 'engine.json has no scenarios');
  for (const sc of scenarios) {
    const [st, ops] = replayScenario(sc.name);
    checkDump(st, sc.steps[0].dump, sc.name, 0);
    assert.equal(ops.length + 1, sc.steps.length, `scenario ${sc.name}: TS has ${ops.length} ops, fixture has ${sc.steps.length - 1} steps`);
    ops.forEach((op, idx) => {
      op(st);
      checkDump(st, sc.steps[idx + 1].dump, sc.name, idx + 1);
    });
  }
});

// =============================================================================
// conformance/src/engine_deontic.rs
// =============================================================================

// R: engine_deontic.rs obliged_close_lets_a_world_close_an_obliged_context
// H: EngineSpec.hs "obligedClose lets a world close an obliged context (□a ⊢ □b)"
test('engine_deontic.rs : obligedClose permet à un monde de clore un contexte obligé (□a ⊢ □b)', () => {
  const st = new State();
  const liftAx = axiom([m('a.X')], ['b.X']);
  st.setAxioms(obligedClose([liftAx]));
  st.performOutcome(insert('obliged.w.a.foo'));
  assert.ok(st.viewHas('obliged.w.b.foo'), 'sub-obligation derived (□a ⊢ □b)');
});

// =============================================================================
// conformance/src/analysis_table_spec.rs (H: AnalysisTableSpec.hs "Prax.AnalysisTable")
// =============================================================================

/** Le rendu gelé `analysisTable :: PraxState -> [String]`, une ligne par entrée. */
function analysisTable(st: State): string[] {
  const out: string[] = [];
  out.push(`contMonotone: ${st.contMonotone ? 'True' : 'False'}`);
  for (const name of st.improvables) out.push(`improvable: ${name}`);
  for (const [name, [tag, gates]] of st.livenessRendered()) {
    let rendered: string;
    if (tag === 'FloorCheck' || tag === 'AlwaysLive') rendered = tag;
    else if (tag === 'GateCheck') {
      const parts = gates.map((g) => {
        assert.equal(g.length, 1, `AnalysisTableSpec: unexpected gate shape (not a single CMatch): ${JSON.stringify(g)}`);
        return g[0];
      });
      rendered = `GateCheck ${parts.join(' | ')}`;
    } else throw new Error(`AnalysisTableSpec: unexpected liveness tag: ${tag}`);
    out.push(`liveness: ${name} ${rendered}`);
  }
  for (const [name, actions] of st.caresAboutTable()) out.push(`caresAbout: ${name} -> ${actions.join('; ')}`);
  for (const p of st.footprintNames()) out.push(`footprint: ${p}`);
  for (const p of st.negFootprintNames()) out.push(`negFootprint: ${p}`);
  for (const p of st.axiomHeadNames()) out.push(`axiomHead: ${p}`);
  return out;
}

// ---- littéraux engagés (verbatim depuis AnalysisTableSpec.hs, via analysis_table_spec.rs) ----

const villagePin: readonly string[] = [
  "contMonotone: True",
  "improvable: pursues-earnBread",
  "improvable: spites-carol",
  "improvable: punishes-whisper",
  "improvable: suffers-hunger",
  "improvable: drawn-to-market",
  "improvable: smoulders",
  "improvable: clean-conscience",
  "liveness: clean-conscience FloorCheck",
  "liveness: conscience-remembers FloorCheck",
  "liveness: drawn-to-market GateCheck marketDay.square",
  "liveness: punishes-whisper AlwaysLive",
  "liveness: pursues-earnBread AlwaysLive",
  "liveness: smoulders FloorCheck",
  "liveness: spites-carol AlwaysLive",
  "liveness: suffers-hunger FloorCheck",
  "caresAbout: bob -> [Actor]: sweep the square; [Actor]: fetch flour from the mill; [Actor]: bake and earn the loaf; [Actor]: steal the loaf from the stall; [Actor]: tell [Hearer] that [Culprit] stole the loaf; [Actor]: return the loaf with apologies; [Actor]: whisper to [Hearer] that [Culprit] stole the loaf; [Actor]: take up honest work at the stall; [Actor]: eat the loaf; [Actor]: Go to [Place]",
  "caresAbout: carol -> [Actor]: steal the loaf from the stall; [Actor]: confront [Thief] about the theft; [Actor]: tell [Hearer] that [Culprit] stole the loaf; [Actor]: shun [T]; [Actor]: relent toward [T]; [Actor]: whisper to [Hearer] that [Culprit] stole the loaf; [Actor]: confess to [Hearer] about framing [C]; [Actor]: threaten [V] with what you know; [Actor]: buy [E]'s silence; [Actor]: defy [E]; [Actor]: expose [V] to [Hearer]; [Actor]: Go to [Place]",
  "caresAbout: dana -> [Actor]: confront [Thief] about the theft; [Actor]: eye [Thief] with suspicion; [Actor]: shun [T]; [Actor]: relent toward [T]; [Actor]: Go to [Place]",
  "caresAbout: eve -> [Actor]: Go to [Place]",
  "caresAbout: gale -> [Actor]: whisper to [Hearer] that [Culprit] stole the loaf; [Actor]: confess to [Hearer] about framing [C]; [Actor]: Go to [Place]",
  "caresAbout: you -> ",
  "footprint: Regarder.believes.stole.Culprit.loaf",
  "footprint: atoned.Culprit",
  "footprint: regards.Regarder.Culprit.thief",
  "footprint: regards.W0.T.thief",
  "footprint: regards.W.T.thief",
  "footprint: notorious.T.thief",
  "footprint: Regarder.believes.swept.bob",
  "footprint: Regarder.believes.desires.bob.pursues-earnBread.presumed",
  "footprint: trait.M.T",
  "footprint: traitDesire.T.D",
  "footprint: character.P",
  "footprint: P.believes.desires.M.D.presumed",
  "footprint: Regarder.believes.whispered.V.H",
  "footprint: recanted.V",
  "footprint: regards.Regarder.V.slanderer",
  "footprint: regards.W0.T.slanderer",
  "footprint: regards.W.T.slanderer",
  "footprint: notorious.T.slanderer",
  "footprint: PraxW.believes.whispered.V.H0",
  "footprint: PraxW.believes.whispered.V.H",
  "footprint: regards.PraxW.V.incorrigible",
  "footprint: obliged.Obligor.Regarder.believes.swept.bob",
  "footprint: obliged.Obligor.Regarder.believes.desires.bob.pursues-earnBread.presumed",
  "footprint: obliged.Obligor.trait.M.T",
  "footprint: obliged.Obligor.traitDesire.T.D",
  "footprint: obliged.Obligor.character.P",
  "footprint: obliged.Obligor.P.believes.desires.M.D.presumed",
  "negFootprint: atoned.Culprit",
  "negFootprint: recanted.V",
  "axiomHead: regards.Regarder.Culprit.thief",
  "axiomHead: notorious.T.thief",
  "axiomHead: Regarder.believes.desires.bob.pursues-earnBread.presumed",
  "axiomHead: P.believes.desires.M.D.presumed",
  "axiomHead: regards.Regarder.V.slanderer",
  "axiomHead: notorious.T.slanderer",
  "axiomHead: regards.PraxW.V.incorrigible",
  "axiomHead: obliged.Obligor.Regarder.believes.desires.bob.pursues-earnBread.presumed",
  "axiomHead: obliged.Obligor.P.believes.desires.M.D.presumed",
  "axiomHead: contradiction",
];

const barPin: readonly string[] = [
  "contMonotone: True",
  "caresAbout: ada -> [Actor]: Disapprove of [Offender]; [Actor]: turn [X] against [Y] to stir up the evening; [Actor]: Greet [Other]; [Actor]: Strike up a conversation with [Other]; [Actor]: Greet [Greeter] back; [Actor]: Rebuff [Greeter]; [Actor]: Take offense that [Greeted] ignored your greeting; [Actor]: Order [Beverage]; [Actor]: Fulfill [Customer]'s order; [Actor]: Go to [Place]",
  "caresAbout: bex -> [Actor]: settle in, feeling you belong here; [Actor]: give up on the evening, resigning yourself to solitude; [Actor]: Disapprove of [Offender]; [Actor]: turn [X] against [Y] to stir up the evening; [Actor]: Greet [Other]; [Actor]: Strike up a conversation with [Other]; [Actor]: Buy [Other] a drink; [Actor]: Greet [Greeter] back; [Actor]: Rebuff [Greeter]; [Actor]: Take offense that [Greeted] ignored your greeting; [Actor]: Tip [Bartender]; [Actor]: Leave [Bartender]'s tab unpaid; [Actor]: Order [Beverage]; [Actor]: Fulfill [Customer]'s order; [Actor]: Drink the [Beverage]; [Actor]: Go to [Place]",
  "caresAbout: director -> [Actor]: turn [X] against [Y] to stir up the evening",
  "caresAbout: you -> ",
  "axiomHead: contradiction",
];

const barDirectorPin: readonly string[] = [
  "contMonotone: True",
  "caresAbout: ada -> [Actor]: stir up a rivalry between [X] and [Y]; [Actor]: Disapprove of [Offender]; [Actor]: Greet [Other]; [Actor]: Strike up a conversation with [Other]; [Actor]: Greet [Greeter] back; [Actor]: Rebuff [Greeter]; [Actor]: Take offense that [Greeted] ignored your greeting; [Actor]: Order [Beverage]; [Actor]: Fulfill [Customer]'s order; [Actor]: Go to [Place]",
  "caresAbout: bex -> [Actor]: settle in, feeling you belong here; [Actor]: give up on the evening, resigning yourself to solitude; [Actor]: stir up a rivalry between [X] and [Y]; [Actor]: Disapprove of [Offender]; [Actor]: Greet [Other]; [Actor]: Strike up a conversation with [Other]; [Actor]: Buy [Other] a drink; [Actor]: Greet [Greeter] back; [Actor]: Rebuff [Greeter]; [Actor]: Take offense that [Greeted] ignored your greeting; [Actor]: Tip [Bartender]; [Actor]: Leave [Bartender]'s tab unpaid; [Actor]: Order [Beverage]; [Actor]: Fulfill [Customer]'s order; [Actor]: Drink the [Beverage]; [Actor]: Go to [Place]",
  "caresAbout: cai -> [Actor]: settle in, feeling you belong here; [Actor]: give up on the evening, resigning yourself to solitude; [Actor]: stir up a rivalry between [X] and [Y]; [Actor]: Disapprove of [Offender]; [Actor]: Greet [Other]; [Actor]: Strike up a conversation with [Other]; [Actor]: Buy [Other] a drink; [Actor]: Greet [Greeter] back; [Actor]: Rebuff [Greeter]; [Actor]: Take offense that [Greeted] ignored your greeting; [Actor]: Order [Beverage]; [Actor]: Fulfill [Customer]'s order; [Actor]: Drink the [Beverage]; [Actor]: Go to [Place]",
  "caresAbout: director -> ",
  "axiomHead: contradiction",
];

const intriguePin: readonly string[] = [
  "contMonotone: True",
  "improvable: kill-artus",
  "liveness: kill-artus AlwaysLive",
  "caresAbout: artus -> ",
  "caresAbout: cassia -> [Actor]: slip poison into [Target]'s cup; [Actor]: poison [Target] with your own hand",
  "caresAbout: marcus -> ",
  "axiomHead: contradiction",
];

const feudPin: readonly string[] = [
  "contMonotone: True",
  "caresAbout: alice -> [Actor]: shun [Target]",
  "caresAbout: bob -> [Actor]: shun [Target]",
  "caresAbout: carol -> [Actor]: shun [Target]",
  "caresAbout: dave -> [Actor]: shun [Target]",
  "caresAbout: esme -> [Actor]: shun [Target]",
  "footprint: allied.X.Y",
  "footprint: allied.Y.X",
  "footprint: wronged.X.Y",
  "footprint: resents.Y.X",
  "footprint: resents.A.B",
  "footprint: allied.A.C",
  "footprint: resents.C.B",
  "footprint: member.X.F",
  "footprint: member.Y.F",
  "footprint: allied.X.Y",
  "footprint: married.A.B",
  "footprint: married.B.A",
  "footprint: parent.P.X",
  "footprint: parent.P.Y",
  "footprint: sibling.X.Y",
  "footprint: parent.G.P",
  "footprint: parent.P.C",
  "footprint: grandparent.G.C",
  "footprint: married.A.B",
  "footprint: parent.P.A",
  "footprint: inLaw.P.B",
  "footprint: married.A.B",
  "footprint: sibling.A.S",
  "footprint: inLaw.S.B",
  "axiomHead: allied.Y.X",
  "axiomHead: resents.Y.X",
  "axiomHead: resents.C.B",
  "axiomHead: allied.X.Y",
  "axiomHead: married.B.A",
  "axiomHead: sibling.X.Y",
  "axiomHead: grandparent.G.C",
  "axiomHead: inLaw.P.B",
  "axiomHead: inLaw.S.B",
  "axiomHead: contradiction",
];

const audiencePin: readonly string[] = [
  "contMonotone: True",
  "caresAbout: duke -> envoy: flatter the king; duke: flatter the king",
  "caresAbout: envoy -> ",
  "caresAbout: king -> ",
  "axiomHead: contradiction",
];

const playPin: readonly string[] = [
  "contMonotone: True",
  "caresAbout: artus -> ",
  "caresAbout: cassia -> cassia: slip poison into artus's cup; marcus: poison artus with your own hand",
  "caresAbout: marcus -> ",
  "axiomHead: contradiction",
];

// R: analysis_table_spec.rs village
// H: AnalysisTableSpec.hs "village"
test('analysis_table_spec.rs : village', () => {
  assert.deepEqual(analysisTable(villageWorld()), villagePin);
});

// R: analysis_table_spec.rs bar
// H: AnalysisTableSpec.hs "bar"
test('analysis_table_spec.rs : bar', () => {
  assert.deepEqual(analysisTable(barWorld()), barPin);
});

// R: analysis_table_spec.rs bar_director
// H: AnalysisTableSpec.hs "bar-director"
test('analysis_table_spec.rs : bar-director', () => {
  assert.deepEqual(analysisTable(barDirectorWorld()), barDirectorPin);
});

// R: analysis_table_spec.rs intrigue
// H: AnalysisTableSpec.hs "intrigue"
test('analysis_table_spec.rs : intrigue', () => {
  assert.deepEqual(analysisTable(intrigueWorld()), intriguePin);
});

// R: analysis_table_spec.rs feud
// H: AnalysisTableSpec.hs "feud"
test('analysis_table_spec.rs : feud', () => {
  assert.deepEqual(analysisTable(feudWorld()), feudPin);
});

// R: analysis_table_spec.rs audience
// H: AnalysisTableSpec.hs "audience"
test('analysis_table_spec.rs : audience', () => {
  assert.deepEqual(analysisTable(audienceWorld()), audiencePin);
});

// R: analysis_table_spec.rs play
// H: AnalysisTableSpec.hs "play"
test('analysis_table_spec.rs : play', () => {
  assert.deepEqual(analysisTable(playWorld()), playPin);
});
