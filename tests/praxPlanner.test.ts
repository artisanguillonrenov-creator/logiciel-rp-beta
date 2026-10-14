/**
 * Portage TypeScript des tests du planificateur de Prax (Rust, BSD-3-Clause) :
 *   - prax-core/src/planner.rs (module #[cfg(test)] `smoke`, dont le proptest v34) ;
 *   - conformance/src/planner_replay.rs (rejeu bit à bit de planner.json) ;
 *   - conformance/src/npc_replay.rs (rejeu ligne à ligne de npc.json) ;
 *   - conformance/src/golden_drive.rs (séquences de décisions gelées) ;
 *   - conformance/src/goldens.rs (chargeur des goldens et barrière anti-copie) ;
 *   - conformance/src/village_relevance.rs (tables de pertinence du village, réveil v37).
 *
 * Chaque test garde sa référence d'origine (`// R:` et, s'il y en a, `// H:`).
 *
 * Le filet « réutilisation == vivant » (v34) est ARMÉ pour tout le fichier :
 * en Rust, le `debug_assert!` du site de réutilisation est actif dans toutes les
 * constructions de test ; ici `plannerDebug.checkReuse = true` lève une erreur
 * dès qu'une prédiction réutilisée diffère de la prédiction vivante (coût
 * mesuré : ~2 % sur le village).
 *
 * Lancer avec PRAX_RACINE=/home/user/logiciel-rp-beta quand le fichier est
 * compilé hors du dépôt.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { State } from '../src/prax/core/engine';
import { tokenize } from '../src/prax/core/path';
import { GroundedAction, MotiveSignature } from '../src/prax/core/perform';
import { groundedActionEqNullable, motiveSignatureEq, plannerDebug } from '../src/prax/core/planner';
import { Condition, calc, cmp, count, eq, forAll, implies, matches, neq, not_, subquery } from '../src/prax/core/query';
import { advance, npcAct, runNpcTicks } from '../src/prax/core/turn';
import {
  Character,
  Desire,
  Practice,
  Want,
  action,
  axiom,
  call,
  character,
  del,
  desire,
  holds,
  insert,
  practice,
  scheduleRule,
  want,
  withWant,
} from '../src/prax/core/types';
import { barWorld } from '../src/prax/worlds/bar';
import { intrigueWorld } from '../src/prax/worlds/intrigue';
import { PLAYER_NAME as VILLAGE_PLAYER, villageWorld } from '../src/prax/worlds/village';

const RACINE = process.env.PRAX_RACINE ?? join(__dirname, '..', '..');
const FIXTURES = join(RACINE, 'tests', 'fixtures', 'prax');
const GOLDENS_DIR = join(FIXTURES, 'goldens');

// Le filet v34 (voir l'en-tête) : armé une fois pour tout le fichier.
plannerDebug.checkReuse = true;

// ---- aides communes -----------------------------------------------------------

const m = (s: string): Condition => matches(s);
/** Rust `want1(cond, u)`. */
const want1 = (cond: string, u: number): Want => want([m(cond)], u);
/** Rust `desire(name, cond, u)` (aide locale de planner.rs). */
const desire1 = (name: string, cond: string, u: number): Desire => desire(name, want1(cond, u));

/** `Option<GroundedAction>.map(|g| g.label)`. */
const lbl = (g: GroundedAction | null | undefined): string | null => g?.label ?? null;

/** Les bits IEEE-754 d'un double (`f64::to_bits`). */
function f64Bits(x: number): bigint {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  return dv.getBigUint64(0);
}

function performAll(st: State, sentences: readonly string[]): void {
  for (const s of sentences) st.performOutcome(insert(s));
}

type Json = any;

/**
 * Lit un jeu d'essai JSON. Les champs `bits` (u64 au-delà de 2^53) sont relus
 * en CHAÎNES avant `JSON.parse`, pour être comparés en `bigint` sans perte.
 */
function loadFixture(file: string): Json {
  const text = readFileSync(join(FIXTURES, file), 'utf8');
  return JSON.parse(text.replace(/"bits":(\d+)/g, '"bits":"$1"'));
}

const strs = (v: Json): string[] => {
  assert.ok(Array.isArray(v), 'array');
  return v.map((s: Json) => {
    assert.equal(typeof s, 'string', 'string');
    return s as string;
  });
};

/** Une table à clés textuelles, dans l'ordre `BTreeMap` (octets). */
function sortedEntries<V>(entries: Iterable<readonly [string, V]>): Array<[string, V]> {
  return [...entries].map(([k, v]): [string, V] => [k, v]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function byName(st: State, n: string, ctx: string): Character {
  const c = st.characters.find((x) => x.name === n);
  assert.ok(c !== undefined, `no cast member ${n} @ ${ctx}`);
  return c;
}

function checkSignature(got: MotiveSignature, want: Json, ctx: string): void {
  assert.deepEqual([...got.bearing], strs(want.bearing), `bearing @ ${ctx}`);
  assert.deepEqual([...got.satisfaction], want.satisfaction as number[], `satisfaction @ ${ctx}`);
  assert.deepEqual([...got.liveDesires], strs(want.liveDesires), `liveDesires @ ${ctx}`);
  const known = (want.knownMotives as Json[]).map((pair) => {
    const p = strs(pair);
    return [p[0], p[1]];
  });
  assert.deepEqual(
    got.knownMotives.map(([a, b]) => [a, b]),
    known,
    `knownMotives @ ${ctx}`,
  );
}

// =============================================================================
// prax-core/src/planner.rs — mod smoke
// =============================================================================

function tendBar(): Practice {
  return practice('tendBar', {
    name: '[Bartender] is tending bar',
    roles: ['Bartender'],
    dataFacts: ['beverageType.beer!alcoholic', 'beverageType.cider!alcoholic', 'beverageType.soda!nonalcoholic'],
    actions: [
      action(
        '[Actor]: Walk up to bar',
        [neq('Actor', 'Bartender'), not_('practice.tendBar.Bartender.customer.Actor')],
        [insert('practice.tendBar.Bartender.customer.Actor')],
      ),
      action(
        '[Actor]: Order [Beverage]',
        [
          matches('practice.tendBar.Bartender.customer.Actor'),
          not_('practice.tendBar.Bartender.customer.Actor!beverage'),
          matches('practiceData.tendBar.beverageType.Beverage'),
        ],
        [insert('practice.tendBar.Bartender.customer.Actor!order!Beverage')],
      ),
    ],
  });
}

function beth(): Character {
  return withWant(character('beth'), want([m('practice.tendBar.Bartender.customer.beth!order!cider')], 10));
}

function barState(): State {
  const st = new State();
  st.definePractices([tendBar()]);
  st.setCharacters([beth()]);
  st.performOutcome(insert('practice.tendBar.ada'));
  return st;
}

// R: planner.rs smoke::tendbar_pick_and_scores
// H: PlannerSpec.hs "Prax.Planner"
// H: PlannerSpec.hs "pickAction chooses the want-satisfying order over the alternatives"
// H: PlannerSpec.hs "top-scoring order beats the others; non-cider orders score 0"
// H: PlannerSpec.hs "lookahead: walking up is worthless immediately but valuable at depth 1"
test('planner.rs : tendBar — choix et notes (profondeurs 0 et 1)', () => {
  const walked = barState();
  walked.performOutcome(insert('practice.tendBar.ada.customer.beth'));
  const b = beth();

  // depth 0: only cider satisfies beth's want.
  assert.equal(lbl(walked.pickAction(0, b)), 'beth: Order cider');
  const scored = walked.scoreActions(0, b);
  assert.equal(scored[0][0].label, 'beth: Order cider');
  assert.equal(scored[0][1], 10.0);
  for (const [ga, s] of scored) {
    if (ga.label !== 'beth: Order cider') assert.equal(s, 0.0, `non-cider action ${ga.label} scored ${s}`);
  }

  // depth 1: walking up is worthless now but worth 0.9 * 10 = 9.0 ahead.
  const bar = barState();
  const scored1 = bar.scoreActions(1, b);
  const walk = scored1.find(([g]) => g.label === 'beth: Walk up to bar');
  assert.ok(walk !== undefined, 'walk offered');
  assert.equal(walk[1], 9.0, 'walk-up at depth 1');
  assert.equal(lbl(bar.pickAction(1, b)), 'beth: Walk up to bar');
});

// R: planner.rs smoke::evaluate_sums_utility_over_satisfying_instantiations
// H: PlannerSpec.hs "evaluate sums utility over satisfying instantiations"
test('planner.rs : evaluate somme l’utilité sur les instanciations satisfaisantes', () => {
  const walked = barState();
  walked.performOutcome(insert('practice.tendBar.ada.customer.beth'));
  const b = beth();
  assert.equal(walked.evaluateSelfWants(b), 0);
  walked.performOutcome(insert('practice.tendBar.ada.customer.beth!order!cider'));
  assert.equal(walked.evaluateSelfWants(b), 10);

  // …a SUM over satisfying instantiations, not a boolean: 3 bindings × 3 = 9.
  const counter = withWant(character('counter'), want1('guest.G', 3));
  const st = new State();
  st.setCharacters([counter]);
  assert.equal(st.evaluateSelfWants(counter), 0);
  for (const g of ['guest.a', 'guest.b', 'guest.c']) st.performOutcome(insert(g));
  assert.equal(st.evaluateSelfWants(counter), 9);
});

// R: planner.rs smoke::a_universal_want_drives_the_planner_to_complete_it
// H: PlannerSpec.hs "a universally-quantified desire drives the planner to complete it"
test('planner.rs : un désir universel pousse le planificateur à le compléter', () => {
  const serve = practice('serve', {
    name: '[Host] hosts',
    roles: ['Host'],
    actions: [
      action('[Actor]: pour a drink for [Guest]', [m('guest.Guest'), not_('hasDrink.Guest')], [insert('hasDrink.Guest')]),
      action('[Actor]: rest'),
    ],
  });
  const host = withWant(character('host'), want([forAll([m('guest.G')], [m('hasDrink.G')])], 10));
  const st = new State();
  st.definePractices([serve]);
  st.setCharacters([host]);
  performAll(st, ['guest.a', 'guest.b', 'hasDrink.a', 'practice.serve.host']);
  assert.equal(st.evaluateSelfWants(host), 0, 'b still lacks a drink');
  assert.equal(lbl(st.pickAction(1, host)), 'host: pour a drink for b');
  const pour = st.possibleActions('host').find((g) => g.label === 'host: pour a drink for b');
  assert.ok(pour !== undefined, 'pour-for-b offered');
  st.performAction(pour);
  assert.equal(st.evaluateSelfWants(host), 10, 'now the universal holds');
});

// ---- believed-mind prediction ------------------------------------------

function ciderVocab(): Desire[] {
  return [desire1('cider-craving', 'practice.tendBar.Bartender.customer.Owner!order!cider', 10)];
}

function walkedUpWithBelief(): State {
  const st = barState();
  st.performOutcome(insert('practice.tendBar.ada.customer.beth'));
  st.setDesires(ciderVocab());
  st.setCharacters([holds(character('beth'), 'cider-craving'), character('ada')]);
  return st;
}

// R: planner.rs smoke::predict_move_is_belief_relative_and_motivated
// H: PlannerSpec.hs "predictMove is belief-relative: no belief, no prediction"
// H: PlannerSpec.hs "predictMove with a believed motive is the mover's motivated best"
test('planner.rs : predictMove est relatif aux croyances et motivé', () => {
  const ada = character('ada');
  const b = holds(character('beth'), 'cider-craving');
  // No belief: no prediction.
  const plain = barState();
  plain.performOutcome(insert('practice.tendBar.ada.customer.beth'));
  plain.setDesires(ciderVocab());
  plain.setCharacters([b, character('ada')]);
  assert.equal(plain.predictMove(ada, b), null);

  // A believed motive → the mover's motivated best.
  const st = walkedUpWithBelief();
  st.performOutcome(insert('ada.believes.desires.beth.cider-craving.heard.gossip'));
  assert.equal(lbl(st.predictMove(ada, b)), 'beth: Order cider');
  // Motivated-only: once satisfied, predict still.
  st.performOutcome(insert('practice.tendBar.ada.customer.beth!order!cider'));
  assert.equal(st.predictMove(ada, b), null);
});

// R: planner.rs smoke::a_false_belief_predicts_a_move_the_mover_would_never_take
// H: PlannerSpec.hs "a false belief predicts a move the mover would never take"
test('planner.rs : une fausse croyance prédit un coup que le personnage ne jouerait jamais', () => {
  const ada = character('ada');
  const plainBeth = character('beth');
  const told = barState();
  told.performOutcome(insert('practice.tendBar.ada.customer.beth'));
  told.setDesires(ciderVocab());
  told.setCharacters([plainBeth, character('ada')]);
  const untold = told.clone();
  told.performOutcome(insert('ada.believes.desires.beth.cider-craving.presumed'));
  assert.equal(lbl(told.predictMove(ada, plainBeth)), 'beth: Order cider', 'the false belief still drives the prediction');
  assert.ok(
    groundedActionEqNullable(told.pickAction(0, plainBeth), untold.pickAction(0, plainBeth)),
    "beth's own choice is untouched by what ada believes",
  );
});

// R: planner.rs smoke::dead_are_predicted_to_do_nothing
// H: PlannerSpec.hs "the dead are predicted to do nothing"
test('planner.rs : on prédit que les morts ne font rien', () => {
  const ada = character('ada');
  const b = holds(character('beth'), 'cider-craving');
  const st = walkedUpWithBelief();
  st.performOutcome(insert('ada.believes.desires.beth.cider-craving.heard.gossip'));
  assert.equal(lbl(st.predictMove(ada, b)), 'beth: Order cider');
  st.performOutcome(insert('dead.beth'));
  assert.equal(st.predictMove(ada, b), null);
});

// ---- the believed round-walk -------------------------------------------

function heistState(scope: Condition[] | null): State {
  const grab = practice('heist', {
    roles: ['R'],
    actions: [
      action('[Actor]: grab the relic', [m('gate.open'), not_('grabbed.inge'), eq('Actor', 'inge')], [insert('grabbed.inge')]),
      action('[Actor]: open the gate', [eq('Actor', 'olaf'), not_('gate.open')], [insert('gate.open')]),
      action('[Actor]: Wait about'),
    ],
  });
  const st = new State();
  st.definePractices([grab]);
  st.setCharacters([withWant(character('olaf'), want1('grabbed.inge', 6)), holds(character('inge'), 'covet-relic')]);
  st.setDesires([desire1('covet-relic', 'grabbed.Owner', 10)]);
  if (scope !== null) st.setPredictionScope(scope);
  st.performOutcome(insert('practice.heist.here'));
  return st;
}

const olafChar = (): Character => withWant(character('olaf'), want1('grabbed.inge', 6));

// R: planner.rs smoke::round_walk_credits_a_predicted_enabling_world
// H: PlannerSpec.hs "the round-walk credits a predicted enabling world (secret coordination)"
test('planner.rs : la ronde imaginée crédite un monde rendu possible par une prédiction', () => {
  const olaf = olafChar();
  const told = heistState(null);
  told.performOutcome(insert('olaf.believes.desires.inge.covet-relic.heard.inge'));
  assert.equal(lbl(told.pickAction(1, olaf)), 'olaf: open the gate');
  // Not in on it: opening the gate gains him nothing.
  const cold = heistState(null);
  assert.notEqual(lbl(cold.pickAction(1, olaf)), 'olaf: open the gate');
});

// R: planner.rs smoke::scope_gates_participation
// H: PlannerSpec.hs "prediction scope gates participation"
test('planner.rs : la portée de prédiction filtre la participation', () => {
  const olaf = olafChar();
  const scope = [m('at.Actor!Room'), m('at.Witness!Room')];
  const apart = heistState(scope);
  performAll(apart, ['olaf.believes.desires.inge.covet-relic.heard.inge', 'at.olaf!gatehouse', 'at.inge!vault']);
  assert.notEqual(lbl(apart.pickAction(1, olaf)), 'olaf: open the gate');
  const together = heistState(scope);
  performAll(together, ['olaf.believes.desires.inge.covet-relic.heard.inge', 'at.olaf!vault', 'at.inge!vault']);
  assert.equal(lbl(together.pickAction(1, olaf)), 'olaf: open the gate');
});

// R: planner.rs smoke::sequential_chain_credits_signal_at_14
// H: PlannerSpec.hs "the round is sequential: the second prediction sees the first's effects"
test('planner.rs : la ronde est séquentielle — le signal vaut 14', () => {
  const chain = practice('chain', {
    roles: ['R'],
    actions: [
      action('[Actor]: signal', [eq('Actor', 'alice'), not_('signaled')], [insert('signaled')]),
      action('[Actor]: relay', [eq('Actor', 'bob'), m('signaled'), not_('relayed')], [insert('relayed')]),
      action('[Actor]: deliver', [eq('Actor', 'carol'), m('relayed'), not_('delivered')], [insert('delivered')]),
      action('[Actor]: Wait about'),
    ],
  });
  const alice = withWant(character('alice'), want1('delivered', 10));
  const st = new State();
  st.definePractices([chain]);
  st.setCharacters([alice, character('bob'), character('carol')]);
  st.setDesires([desire1('relay-desire', 'relayed', 10), desire1('deliver-desire', 'delivered', 10)]);
  st.performOutcome(insert('practice.chain.here'));
  const both = st.clone();
  both.performOutcome(insert('alice.believes.desires.bob.relay-desire.heard.gossip'));
  both.performOutcome(insert('alice.believes.desires.carol.deliver-desire.heard.gossip'));
  const scored = both.scoreActions(1, alice);
  const sig = scored.find(([g]) => g.label === 'alice: signal');
  assert.ok(sig !== undefined, 'signal offered');
  assert.equal(sig[1], 14.0);
  assert.equal(lbl(both.pickAction(1, alice)), 'alice: signal');
  // Neither belief: signal earns nothing.
  const none = st.scoreActions(1, alice);
  const s0 = none.find(([g]) => g.label === 'alice: signal');
  assert.ok(s0 !== undefined);
  assert.equal(s0[1], 0.0);
});

// R: planner.rs smoke::mid_round_death_silences_the_rest_of_the_round
// H: PlannerSpec.hs "a mid-round death silences the rest of the imagined round"
test('planner.rs : une mort en pleine ronde fait taire le reste de la ronde imaginée', () => {
  const duel = practice('duel', {
    roles: ['R'],
    actions: [
      action('[Actor]: signal', [eq('Actor', 'alice'), not_('signaled')], [insert('signaled')]),
      action('[Actor]: kill carol', [eq('Actor', 'bob'), m('signaled'), not_('dead.carol')], [insert('dead.carol')]),
      action('[Actor]: deliver', [eq('Actor', 'carol'), m('signaled'), not_('delivered')], [insert('delivered')]),
      action('[Actor]: Wait about'),
    ],
  });
  const alice = withWant(character('alice'), want1('delivered', 10));
  const st = new State();
  st.definePractices([duel]);
  st.setCharacters([alice, character('bob'), character('carol')]);
  st.setDesires([desire1('kill-desire', 'dead.carol', 10), desire1('deliver-desire', 'delivered', 10)]);
  st.performOutcome(insert('practice.duel.here'));
  st.performOutcome(insert('alice.believes.desires.bob.kill-desire.heard.gossip'));
  st.performOutcome(insert('alice.believes.desires.carol.deliver-desire.heard.gossip'));
  const scored = st.scoreActions(1, alice);
  const sig = scored.find(([g]) => g.label === 'alice: signal');
  assert.ok(sig !== undefined);
  assert.equal(sig[1], 0.0, 'a corpse must not be credited');
});

// ---- dead-now -----------------------------------------------------------

// R: planner.rs smoke::dead_now_floor_markless_skips_one_mark_goes_live
// H: PlannerSpec.hs "deadNow (floor): a markless conscience skips; one lied-mark goes live"
test('planner.rs : deadNow (plancher) — conscience sans marque sautée, une marque la ranime', () => {
  const confess = practice('confess', {
    roles: ['R'],
    actions: [action('[Actor]: confess', [m('lied.Actor')], [del('lied.Actor')]), action('[Actor]: Wait about')],
  });
  const priya = character('priya');
  const b = character('beth');
  const st = new State();
  st.definePractices([confess]);
  st.setCharacters([priya, b]);
  st.setDesires([desire1('hates-lying', 'lied.Owner', -5)]);
  st.performOutcome(insert('practice.confess.here'));
  st.performOutcome(insert('priya.believes.desires.beth.hates-lying.heard.gossip'));
  assert.equal(st.predictMove(priya, b), null, 'markless: at the floor');
  st.performOutcome(insert('lied.beth'));
  assert.equal(lbl(st.predictMove(priya, b)), 'beth: confess');
});

// R: planner.rs smoke::dead_now_conservative_axiom_derivable_never_skips
// H: PlannerSpec.hs "deadNow (conservative): an axiom-derivable gate candidate never skips"
test('planner.rs : deadNow (conservateur) — un candidat de garde dérivable par axiome n’est jamais sauté', () => {
  const toil = practice('toil', {
    roles: ['R'],
    actions: [action('[Actor]: toil', [], [insert('starving.Actor')]), action('[Actor]: Wait about')],
  });
  const priya = character('priya');
  const b = character('beth');
  const st = new State();
  st.definePractices([toil]);
  st.setCharacters([priya, b]);
  st.setAxioms([axiom([m('starving.Owner')], ['hungry.Owner'])]);
  st.setDesires([desire1('craves-hunger', 'hungry.Owner', 5)]);
  st.performOutcome(insert('practice.toil.here'));
  st.performOutcome(insert('priya.believes.desires.beth.craves-hunger.heard.gossip'));
  assert.equal(lbl(st.predictMove(priya, b)), 'beth: toil');
});

// R: planner.rs smoke::dead_now_gate_absent_hunger_skips_the_fact_goes_live
// H: PlannerSpec.hs "deadNow (gate): absent hunger skips; the hunger fact goes live"
test('planner.rs : deadNow (garde) — sans faim on saute, le fait de faim ranime', () => {
  const eatery = practice('eatery', {
    roles: ['R'],
    actions: [action('[Actor]: eat lunch', [m('practice.eatery.here')], [insert('meal.Actor')]), action('[Actor]: Wait about')],
  });
  const priya = character('priya');
  const b = character('beth');
  const st = new State();
  st.definePractices([eatery]);
  st.setCharacters([priya, b]);
  st.setDesires([desire('wants-food', want([m('hungry.Owner'), m('meal.M')], 5))]);
  st.performOutcome(insert('practice.eatery.here'));
  st.performOutcome(insert('priya.believes.desires.beth.wants-food.heard.gossip'));
  assert.equal(st.predictMove(priya, b), null, 'no hunger fact: the gate is empty and the pair skips');
  st.performOutcome(insert('hungry.beth'));
  assert.equal(lbl(st.predictMove(priya, b)), 'beth: eat lunch', 'the gate opens and the full model sees the improvement');
});

// R: planner.rs smoke::dead_now_gates_the_skip_never_the_model
// H: PlannerSpec.hs "deadNow gates the SKIP, never the model: a mixed model evaluates in FULL, dead deterrent included"
test('planner.rs : deadNow filtre le SAUT, jamais le modèle', () => {
  const treasure = practice('treasure', {
    roles: ['R'],
    actions: [
      action('[Actor]: grab openly', [], [insert('has.Actor.treasure')]),
      action('[Actor]: grab boldly', [not_('lied.Actor')], [insert('has.Actor.treasure'), insert('lied.Actor')]),
      action('[Actor]: confess', [m('lied.Actor')], [del('lied.Actor')]),
      action('[Actor]: Wait about'),
    ],
  });
  const priya = character('priya');
  const b = character('beth');
  const st = new State();
  st.definePractices([treasure]);
  st.setCharacters([priya, b]);
  st.setDesires([desire1('wants-treasure', 'has.Owner.treasure', 5), desire1('hates-lying', 'lied.Owner', -6)]);
  performAll(st, [
    'practice.treasure.here',
    'priya.believes.desires.beth.wants-treasure.heard.gossip',
    'priya.believes.desires.beth.hates-lying.heard.gossip',
  ]);
  assert.equal(lbl(st.predictMove(priya, b)), 'beth: grab openly', 'the dead deterrent still prices the new lie');
  // Marked: the deterrent is now LIVE, and relief (6) beats a clean grab (5).
  st.performOutcome(insert('lied.beth'));
  assert.equal(lbl(st.predictMove(priya, b)), 'beth: confess');
});

// ---- the v35 motive signature -------------------------------------------

// R: planner.rs smoke::motive_signature_options_satisfaction_live_desires_known_motives
// H: PlannerSpec.hs "motiveSignature: options, satisfaction, live desires, known motives"
test('planner.rs : motiveSignature — options, satisfaction, désirs vivants, motifs connus', () => {
  const mess = practice('mess', {
    roles: ['R'],
    actions: [action('[Actor]: eat lunch', [m('hungry.Actor')], [insert('meal.Actor')]), action('[Actor]: idle about')],
  });
  const b = holds(withWant(character('beth'), want1('meal.beth', 10)), 'wants-food');
  const st = new State();
  st.definePractices([mess]);
  st.setCharacters([b]);
  st.setDesires([desire('wants-food', want([m('hungry.Owner'), m('meal.Owner')], 5))]);
  st.performOutcome(insert('practice.mess.here'));

  const sigA = st.motiveSignature(b);
  assert.deepEqual([...sigA.bearing], []);
  assert.deepEqual([...sigA.satisfaction], [0, 0]);
  assert.deepEqual([...sigA.liveDesires], []);
  assert.deepEqual([...sigA.knownMotives], []);

  st.performOutcome(insert('hungry.beth'));
  const sigB = st.motiveSignature(b);
  // The hunger fact opens the gate AND grounds the want-bearing eat.
  assert.deepEqual([...sigB.bearing], ['[Actor]: eat lunch']);
  assert.deepEqual([...sigB.liveDesires], ['wants-food']);

  st.performOutcome(insert('beth.believes.desires.carl.wants-food.heard.gossip'));
  const sigC = st.motiveSignature(b);
  assert.deepEqual(
    sigC.knownMotives.map(([x, y]) => [x, y]),
    [['carl', 'wants-food']],
  );
  // Each of the three states carries a DIFFERENT signature.
  assert.ok(!motiveSignatureEq(sigA, sigB));
  assert.ok(!motiveSignatureEq(sigB, sigC));
});

// ---- v34 reuse ----------------------------------------------------------

// R: planner.rs smoke::reuse_base_fact_delta_recomputed_not_reused
// H: PlannerSpec.hs "prediction reuse: a base-fact delta that enables the mover is recomputed, not reused"
test('planner.rs : réutilisation v34 — un delta de fait de base qui débloque le personnage est recalculé', () => {
  const p = practice('mess', {
    roles: ['R'],
    actions: [
      action('[Actor]: taunt beth', [neq('Actor', 'beth')], [insert('hungry.beth')]),
      action('[Actor]: eat lunch', [m('hungry.Actor')], [insert('meal.Actor')]),
      action('[Actor]: idle about'),
    ],
  });
  const priya = withWant(character('priya'), want1('meal.beth', 10));
  const b = character('beth');
  const st = new State();
  st.definePractices([p]);
  st.setCharacters([priya, b]);
  st.setDesires([desire('wants-food', want([m('hungry.Owner'), m('meal.Owner')], 5))]);
  st.performOutcome(insert('practice.mess.here'));
  st.performOutcome(insert('priya.believes.desires.beth.wants-food.heard.gossip'));
  assert.equal(st.predictMove(priya, b), null, 'root: beth unmotivated');
  assert.equal(lbl(st.pickAction(2, priya)), 'priya: taunt beth', 'the pick must see through the taunt (no stale reuse)');
});

// R: planner.rs smoke::reuse_derived_cone_flip_recomputed_not_reused
// H: PlannerSpec.hs "prediction reuse: a DERIVED-fact flip (the cone) is recomputed, not reused"
test('planner.rs : réutilisation v34 — une bascule de fait DÉRIVÉ (le cône) est recalculée', () => {
  const p = practice('court', {
    roles: ['R'],
    actions: [
      action('[Actor]: denounce beth', [neq('Actor', 'beth')], [insert('Actor.believes.beth.thief')]),
      action('[Actor]: make amends', [m('regards.V.Actor.thief')], [insert('recanted.Actor'), insert('apology.Actor')]),
      action('[Actor]: bide time'),
    ],
  });
  const priya = withWant(character('priya'), want1('apology.beth', 10));
  const b = character('beth');
  const st = new State();
  st.definePractices([p]);
  st.setAxioms([axiom([m('W.believes.C.thief'), not_('recanted.C')], ['regards.W.C.thief'])]);
  st.setCharacters([priya, b]);
  st.setDesires([desire1('hates-infamy', 'regards.V.Owner.thief', -8)]);
  st.performOutcome(insert('practice.court.here'));
  st.performOutcome(insert('priya.believes.desires.beth.hates-infamy.heard.gossip'));
  assert.equal(st.predictMove(priya, b), null);
  assert.equal(lbl(st.pickAction(2, priya)), 'priya: denounce beth', 'the cone must be recomputed, not reused');
});

// R: planner.rs smoke::a_mid_path_death_is_in_every_movers_read_anchors
// H: PlannerSpec.hs "prediction reuse: a mid-path death is recomputed (the dead anchor)"
test('planner.rs : la marque de mort est une ancre de lecture de chaque personnage', () => {
  const st = new State();
  st.setCharacters([character('priya'), character('beth')]);
  const dead = tokenize('dead.beth').segs; // Rust `intern_segs`
  const anchors = st.moverReadAnchorsOf('priya', 'beth');
  assert.ok(
    anchors.some((a) => a.length === dead.length && a.every((s, i) => s === dead[i])),
    `dead.beth must be a read anchor of the pair; got ${JSON.stringify(anchors.map((a) => a.join('.')))}`,
  );
});

// R: planner.rs smoke::fold_order_canary_discriminates_the_association
//
// ADAPTÉ : Rust appelle `super::fold_value(base, acc, self_next)` ; le portage TS
// n'exporte pas de `foldValue` — le pli est écrit en ligne dans `valueAfter`
// (src/prax/core/planner.ts : `return base + (acc + selfNext);`). On épingle donc
// (1) l'association de cette expression aux bits gelés, avec les mêmes
// assertions, et (2) en complément, le MOTEUR lui-même via le monde « canari »
// de planner.json (score de profondeur 2 de `alice: raise the mark`), pour que
// réassocier le pli du moteur rougisse aussi ce test.
test('planner.rs : canari d’ordre du pli — base + (acc + 0.9v), au bit près', () => {
  const foldValue = (base: number, acc: number, selfNext: number): number => base + (acc + selfNext);
  const base = 12.0;
  const acc = 3.5; // Σ 0.5 * eval over ≥3 movers, evals summing to 7
  const v = 0.9; // the depth-1 best score: 0 + (0 + 0.9*1)
  const selfNext = 0.9 * v;

  const got = foldValue(base, acc, selfNext);
  assert.equal(f64Bits(got), 4625284074552279696n, `the fold must associate base + (acc + 0.9v); got ${got}`);
  const wrong = base + acc + selfNext;
  assert.notEqual(f64Bits(got), f64Bits(wrong), 'canary is inert — it must separate the two associations');
  assert.equal(f64Bits(wrong), 4625284074552279695n);

  // (2) complément : le pli du moteur, sur le monde canari.
  const st = canaryWorld();
  const alice = byName(st, 'alice', 'canary');
  const raise = st.scoreActions(2, alice).find(([g]) => g.label === 'alice: raise the mark');
  assert.ok(raise !== undefined, 'alice: raise the mark offered');
  assert.equal(f64Bits(raise[1]), 4625284074552279696n, `engine fold association moved: got ${raise[1]}`);
});

// R: planner.rs smoke::reuse_gate_is_reached_and_verified
// (Rust : #[cfg(debug_assertions)] ; ici le filet `plannerDebug.checkReuse` est armé.)
test('planner.rs : la porte de réutilisation v34 est atteinte et vérifiée', () => {
  assert.equal(plannerDebug.checkReuse, true);
  const before = plannerDebug.reuseHits;
  const olaf = olafChar();
  const told = heistState(null);
  told.performOutcome(insert('olaf.believes.desires.inge.covet-relic.heard.inge'));
  told.pickAction(2, olaf);
  const after = plannerDebug.reuseHits;
  assert.ok(after > before, 'the v34 reuse gate was never reached');
});

// R: planner.rs smoke::reuse_equals_live_over_generated_prefixes (proptest!, 64 cas)
//
// ADAPTÉ : le générateur est quatre booléens indépendants — un domaine fini de
// 16 points, plus petit que les 64 cas du proptest. On l'énumère donc
// EXHAUSTIVEMENT (boucle déterministe), ce qui couvre tout ce que le proptest
// pouvait tirer. Le filet `checkReuse` lève sur toute réutilisation ≠ vivant.
test('planner.rs : réutilisation == vivant sur les préfixes générés (énumération exhaustive)', () => {
  assert.equal(plannerDebug.checkReuse, true);
  for (let bits = 0; bits < 16; bits++) {
    const told = (bits & 1) !== 0;
    const hungry = (bits & 2) !== 0;
    const secondMover = (bits & 4) !== 0;
    const tauntFirst = (bits & 8) !== 0;
    const ctx = `told=${told} hungry=${hungry} second_mover=${secondMover} taunt_first=${tauntFirst}`;
    const before = plannerDebug.reuseHits;

    const actions = [
      action('[Actor]: taunt beth', [neq('Actor', 'beth')], [insert('hungry.beth')]),
      action('[Actor]: eat lunch', [m('hungry.Actor')], [insert('meal.Actor')]),
    ];
    if (tauntFirst) actions.push(action('[Actor]: aardvark', [m('never.here')]));
    actions.push(action('[Actor]: idle about'));
    const p = practice('mess', { roles: ['R'], actions });

    let priya = withWant(character('priya'), want1('meal.beth', 10));
    if (secondMover) priya = withWant(priya, want1('meal.carl', 3));
    const cast = [priya, character('beth')];
    if (secondMover) cast.push(character('carl'));
    const st = new State();
    st.definePractices([p]);
    st.setCharacters(cast);
    st.setDesires([desire('wants-food', want([m('hungry.Owner'), m('meal.Owner')], 5))]);
    st.performOutcome(insert('practice.mess.here'));
    if (told) st.performOutcome(insert('priya.believes.desires.beth.wants-food.heard.gossip'));
    if (hungry) st.performOutcome(insert('hungry.beth'));

    // The net fires on every reuse; a wrong gate throws here.
    st.scoreActions(2, priya);
    const after = plannerDebug.reuseHits;
    assert.ok(after > before, `reuse gate must be reached at depth 2 (${ctx})`);
  }
});

// =============================================================================
// conformance/src/planner_replay.rs — rejeu bit à bit de planner.json
// =============================================================================

function heistBase(): State {
  const st = new State();
  st.definePractices([
    practice('heist', {
      roles: ['R'],
      actions: [
        action('[Actor]: grab the relic', [m('gate.open'), not_('grabbed.inge'), eq('Actor', 'inge')], [insert('grabbed.inge')]),
        action('[Actor]: open the gate', [eq('Actor', 'olaf'), not_('gate.open')], [insert('gate.open')]),
        action('[Actor]: Wait about'),
      ],
    }),
  ]);
  st.setCharacters([character('olaf', { wants: [want([m('grabbed.inge')], 6)] }), holds(character('inge'), 'covet-relic')]);
  st.setDesires([desire('covet-relic', want([m('grabbed.Owner')], 10))]);
  st.setPredictionScope([m('at.Actor!Room'), m('at.Witness!Room')]);
  return st;
}

function deadNowBase(): State {
  const town = practice('town', {
    roles: ['R'],
    actions: [
      action('[Actor]: confess', [m('lied.Actor')], [del('lied.Actor')]),
      action('[Actor]: sell at the market', [m('marketDay'), not_('sold.Actor')], [insert('sold.Actor')]),
      action('[Actor]: greet a neighbour', [not_('neighbour.Actor')], [insert('neighbour.Actor')]),
      action('[Actor]: Wait about'),
    ],
  });
  const st = new State();
  st.definePractices([town]);
  st.setCharacters([
    character('priya', { wants: [want([m('sold.beth')], 5)] }),
    character('beth', { desires: ['hates-lying', 'wants-market', 'counts-neighbours'] }),
  ]);
  st.setDesires([
    desire('hates-lying', want([m('lied.Owner')], -5)),
    desire('wants-market', want([m('marketDay'), m('sold.Owner')], 5)),
    desire('counts-neighbours', want([subquery('Ns', ['N'], [m('neighbour.N')]), count('K', 'Ns'), cmp('gte', 'K', '1')], 5)),
  ]);
  // The schedule is not a mover: the fact it moves stays an environment gate.
  st.setSchedule([scheduleRule('market', 2, [[[not_('marketDay')], [insert('marketDay')]]])]);
  return st;
}

function deadNowShut(): State {
  const st = deadNowBase();
  performAll(st, [
    'practice.town.here',
    'priya.believes.desires.beth.hates-lying.heard.gossip',
    'priya.believes.desires.beth.wants-market.heard.gossip',
  ]);
  return st;
}

function canaryWorld(): State {
  const stage = practice('stage', {
    roles: ['R'],
    actions: [
      action('[Actor]: raise the mark', [eq('Actor', 'alice'), not_('raised.Actor')], [insert('raised.Actor'), insert('mark.p')]),
      action('[Actor]: reach for the shelf', [eq('Actor', 'alice'), not_('reached.Actor')], [insert('reached.Actor')]),
      action('[Actor]: take the small mark', [eq('Actor', 'alice'), m('reached.Actor'), not_('mark.s')], [insert('mark.s')]),
      action('[Actor]: swap the marks', [eq('Actor', 'bob'), m('mark.p')], [del('mark.p'), insert('mark.q')]),
      action('[Actor]: tidy the marks', [eq('Actor', 'cara'), m('mark.q')], [del('mark.q')]),
      action('[Actor]: take a seat', [eq('Actor', 'dan'), not_('chair.Actor')], [insert('chair.Actor')]),
      action('[Actor]: polish the small mark', [eq('Actor', 'eve'), not_('mark.s')], [insert('mark.s')]),
    ],
  });
  const st = new State();
  st.definePractices([stage]);
  st.setCharacters([
    character('alice', { wants: [want([m('mark.p')], 12), want([m('mark.q')], 7), want([m('mark.s')], 1)] }),
    character('bob'),
    character('cara'),
    character('dan'),
    character('eve'),
  ]);
  st.setDesires([
    desire('swap-marks', want([m('mark.q')], 5)),
    desire('tidy-marks', want([not_('mark.q')], 5)),
    desire('take-a-seat', want([m('chair.Owner')], 5)),
  ]);
  performAll(st, [
    'practice.stage.here',
    'alice.believes.desires.bob.swap-marks.heard.gossip',
    'alice.believes.desires.cara.tidy-marks.heard.gossip',
    'alice.believes.desires.dan.take-a-seat.heard.gossip',
  ]);
  return st;
}

/** Le jumeau TS des `plannerWorlds` de l'oracle, par nom. */
function plannerWorld(name: string): State {
  switch (name) {
    case 'tendBar: two instances, two customers': {
      const st = new State();
      st.definePractices([tendBar()]);
      st.setCharacters([
        character('beth', { wants: [want([m('practice.tendBar.Bartender.customer.beth!order!cider')], 10)] }),
        character('dana', { wants: [want([m('practice.tendBar.Bartender.customer.dana!order!soda')], 8)] }),
        character('ada'),
        character('cleo'),
      ]);
      performAll(st, ['practice.tendBar.ada', 'practice.tendBar.cleo', 'practice.tendBar.ada.customer.beth']);
      return st;
    }
    case 'forall-host: a universal desire and a vacuous implication': {
      const serve = practice('serve', {
        name: '[Host] hosts',
        roles: ['Host'],
        actions: [
          action('[Actor]: pour a drink for [Guest]', [m('guest.Guest'), not_('hasDrink.Guest')], [insert('hasDrink.Guest')]),
          action('[Actor]: rest'),
        ],
      });
      const st = new State();
      st.definePractices([serve]);
      st.setCharacters([
        character('host', {
          wants: [want([forAll([m('guest.G')], [m('hasDrink.G')])], 10), want([implies([m('raining')], [m('wet')])], 4)],
        }),
        character('b'),
      ]);
      performAll(st, ['guest.a', 'guest.b', 'hasDrink.a', 'practice.serve.host']);
      return st;
    }
    case 'models: gossiped, seen, and false believed minds': {
      const st = new State();
      st.definePractices([tendBar()]);
      st.setCharacters([
        character('ada'),
        holds(character('beth'), 'cider-craving'),
        character('cleo'),
        holds(character('dana'), 'cider-craving'),
      ]);
      st.setDesires([desire('cider-craving', want([m('practice.tendBar.Bartender.customer.Owner!order!cider')], 10))]);
      performAll(st, [
        'practice.tendBar.ada',
        'practice.tendBar.ada.customer.beth',
        'practice.tendBar.ada.customer.cleo',
        'practice.tendBar.ada.customer.dana',
        'ada.believes.desires.beth.cider-craving.heard.gossip',
        'ada.believes.desires.dana.cider-craving.seen',
        'ada.believes.desires.cleo.cider-craving.presumed',
      ]);
      return st;
    }
    case 'scope: the pair apart': {
      const st = heistBase();
      performAll(st, ['practice.heist.here', 'olaf.believes.desires.inge.covet-relic.heard.inge', 'at.olaf!gatehouse', 'at.inge!vault']);
      return st;
    }
    case 'scope: the pair together': {
      const st = heistBase();
      performAll(st, ['practice.heist.here', 'olaf.believes.desires.inge.covet-relic.heard.inge', 'at.olaf!vault', 'at.inge!vault']);
      return st;
    }
    case 'deadNow: floor shut, gate shut, subquery always live':
      return deadNowShut();
    case 'deadNow: floor marked, gate open': {
      const st = deadNowShut();
      performAll(st, ['lied.beth', 'marketDay']);
      return st;
    }
    case 'reuse: the cone-mediated read (a derived head only)': {
      const court = practice('court', {
        roles: ['R'],
        actions: [
          action('[Actor]: denounce beth', [neq('Actor', 'beth')], [insert('Actor.believes.beth.thief')]),
          action('[Actor]: make amends', [m('regards.V.Actor.thief')], [insert('recanted.Actor'), insert('apology.Actor')]),
          action('[Actor]: bide time'),
        ],
      });
      const st = new State();
      st.definePractices([court]);
      st.setCharacters([character('priya', { wants: [want([m('apology.beth')], 10)] }), character('beth')]);
      st.setDesires([desire('hates-infamy', want([m('regards.V.Owner.thief')], -8))]);
      st.setAxioms([axiom([m('W.believes.C.thief'), not_('recanted.C')], ['regards.W.C.thief'])]);
      performAll(st, ['practice.court.here', 'priya.believes.desires.beth.hates-infamy.heard.gossip']);
      return st;
    }
    case 'reuse: the eviction shadow (an exclusion displaces the read)': {
      const parlour = practice('parlour', {
        roles: ['R'],
        actions: [
          action('[Actor]: mope', [eq('Actor', 'beth'), m('mood.Actor!sad'), not_('moped.Actor')], [insert('moped.Actor')]),
          // Guarded on the ACTOR alone (see the oracle's note).
          action('[Actor]: console beth', [eq('Actor', 'alice')], [insert('mood.beth!happy')]),
          action('[Actor]: Wait about'),
        ],
      });
      const st = new State();
      st.definePractices([parlour]);
      st.setCharacters([character('alice', { wants: [want([m('moped.beth')], 6)] }), character('beth')]);
      st.setDesires([desire('wants-to-mope', want([m('moped.Owner')], 5))]);
      performAll(st, ['practice.parlour.here', 'mood.beth!sad', 'alice.believes.desires.beth.wants-to-mope.heard.gossip']);
      return st;
    }
    case 'collision: a Calc-minted constant colliding with a scope literal': {
      const signal = practice('signal', {
        roles: ['R'],
        actions: [
          // Guarded on `computed.Actor`, never on `gate.2` (see the oracle's note).
          action(
            '[Actor]: compute the gate',
            [eq('Actor', 'alice'), not_('computed.Actor'), calc('Sum', 'add', '1', '1')],
            [insert('computed.Actor'), insert('gate.Sum')],
          ),
          action('[Actor]: cheer', [eq('Actor', 'bob'), not_('cheer.Actor')], [insert('cheer.Actor')]),
          action('[Actor]: Wait about'),
        ],
      });
      const st = new State();
      st.definePractices([signal]);
      st.setCharacters([character('alice', { wants: [want([m('cheer.bob')], 4)] }), character('bob')]);
      st.setDesires([desire('wants-cheer', want([m('cheer.Owner')], 5))]);
      st.setPredictionScope([m('gate.2')]);
      performAll(st, ['practice.signal.here', 'alice.believes.desires.bob.wants-cheer.heard.gossip']);
      return st;
    }
    case 'wild Call: cares_about bears on everyone': {
      const rumour = practice('rumour', {
        roles: ['R'],
        actions: [
          action('[Actor]: rouse the room', [], [call('noSuchFunction', [])]),
          action('[Actor]: hush', [not_('quiet.Actor')], [insert('quiet.Actor')]),
          action('[Actor]: Wait about'),
        ],
      });
      const st = new State();
      st.definePractices([rumour]);
      st.setCharacters([character('alice', { wants: [want([m('quiet.alice')], 3)] }), holds(character('beth'), 'wants-quiet')]);
      st.setDesires([desire('wants-quiet', want([m('quiet.Owner')], 5))]);
      performAll(st, ['practice.rumour.here']);
      return st;
    }
    case 'the fold-order canary':
      return canaryWorld();
    default:
      throw new Error(`planner.json world has no TS twin: ${JSON.stringify(name)}`);
  }
}

function checkPlannerWorld(st: State, w: Json): void {
  const name = w.name as string;

  // improvables, in table order.
  assert.deepEqual([...st.improvables], strs(w.improvables), `improvables @ ${name}`);

  // liveness: tag + rendered gates.
  const wantLiveness = sortedEntries(
    Object.entries(w.liveness as Record<string, Json>).map(([k, v]): [string, [string, string[][]]] => {
      if (typeof v === 'string') return [k, [v, []]];
      assert.ok(v !== null && typeof v === 'object' && Array.isArray(v.GateCheck), `liveness entry ${JSON.stringify(v)} @ ${name}`);
      return [k, ['GateCheck', (v.GateCheck as Json[]).map(strs)]];
    }),
  );
  assert.deepEqual(sortedEntries(st.livenessRendered()), wantLiveness, `liveness @ ${name}`);

  // caresAbout.
  const wantCares = sortedEntries(Object.entries(w.caresAbout as Record<string, Json>).map(([k, v]): [string, string[]] => [k, strs(v)]));
  assert.deepEqual(
    sortedEntries([...st.caresAboutTable()].map(([k, v]): [string, string[]] => [k, [...v]])),
    wantCares,
    `caresAbout @ ${name}`,
  );

  // moverReadAnchors, per ordered pair, in native walk order.
  for (const row of w.readAnchors as Json[]) {
    const got = st.moverReadAnchorsOf(row.actor, row.mover).map((a) => a.join('.')); // Rust `render_segs`
    assert.deepEqual(got, strs(row.anchors), `moverReadAnchors ${row.actor}->${row.mover} @ ${name}`);
  }

  // predictMove, per ordered pair.
  for (const row of w.predict as Json[]) {
    const p = byName(st, row.predictor, name);
    const mv = byName(st, row.mover, name);
    assert.equal(lbl(st.predictMove(p, mv)), row.action ?? null, `predictMove ${p.name}->${mv.name} @ ${name}`);
  }

  // motiveSignature, field for field.
  for (const row of w.signatures as Json[]) {
    const c = byName(st, row.character, name);
    checkSignature(st.motiveSignature(c), row.signature, `${c.name} @ ${name}`);
  }

  // candidateActions, in enumeration order.
  for (const row of w.candidates as Json[]) {
    const c = byName(st, row.character, name);
    assert.deepEqual(
      st.candidateActions(c).map((g) => g.label),
      strs(row.actions),
      `candidates ${c.name} @ ${name}`,
    );
  }

  // scoreActions: NATIVE result order [D-C1], scores as RAW BITS [D-I1].
  for (const row of w.scored as Json[]) {
    const c = byName(st, row.actor, name);
    const depth = row.depth as number;
    const got = st.scoreActions(depth, c);
    const want = row.rows as Json[];
    assert.equal(got.length, want.length, `scored row count for ${c.name} at depth ${depth} @ ${name}`);
    got.forEach(([ga, score], i) => {
      assert.equal(ga.label, want[i].label, `scored label #${i} for ${c.name} at depth ${depth} @ ${name}`);
      const wantBits = BigInt(want[i].bits as string);
      assert.equal(
        f64Bits(score),
        wantBits,
        `SCORE BITS #${i} (${ga.label}) for ${c.name} at depth ${depth} @ ${name}: got ${score} (bits ${f64Bits(score)}), frozen bits ${wantBits}`,
      );
    });
  }

  // pickAction.
  for (const row of w.pick as Json[]) {
    const c = byName(st, row.actor, name);
    assert.equal(lbl(st.pickAction(row.depth as number, c)), row.action ?? null, `pickAction ${c.name} at depth ${row.depth} @ ${name}`);
  }
}

// R: planner_replay.rs replay::planner_corpus_replays_bit_for_bit
test('planner_replay.rs : le corpus planner.json se rejoue au bit près', () => {
  const data = loadFixture('planner.json');
  const worlds = data.worlds as Json[];
  assert.ok(worlds.length > 0, 'planner.json has no worlds');
  for (const w of worlds) checkPlannerWorld(plannerWorld(w.name as string), w);
});

// R: planner_replay.rs replay::the_fold_order_canary_world_is_present_and_discriminating
test('planner_replay.rs : le monde canari est présent et discriminant', () => {
  const data = loadFixture('planner.json');
  const w = (data.worlds as Json[]).find((x) => x.name === 'the fold-order canary');
  assert.ok(w !== undefined, 'the canary world must be in the corpus');
  const scored = (w.scored as Json[]).find((r) => r.actor === 'alice' && r.depth === 2);
  assert.ok(scored !== undefined, 'alice at depth 2');
  const row = (scored.rows as Json[]).find((r) => r.label === 'alice: raise the mark');
  assert.ok(row !== undefined, 'the raise row');
  const bits = BigInt(row.bits as string);
  assert.equal(bits, 4625284074552279696n, 'the corpus canary must carry the RIGHT association’s bits');
  const wrong = f64Bits(12.0 + 3.5 + 0.9 * 0.9);
  assert.notEqual(bits, wrong, 'the corpus canary is inert — it must separate the two associations');
  assert.equal(wrong, 4625284074552279695n);
});

// =============================================================================
// conformance/src/npc_replay.rs — rejeu de npc.json
// =============================================================================

/** Le jumeau TS des `npcScenarios` de l'oracle, par nom. */
function npcScenario(name: string): State {
  switch (name) {
    case 'npc: boundaries and quiet holds': {
      const yard = practice('yard', {
        roles: ['R'],
        actions: [action('[Actor]: sweep the step', [not_('swept.Actor')], [insert('swept.Actor')]), action('[Actor]: idle about')],
      });
      const st = new State();
      st.definePractices([yard]);
      st.setCharacters([
        character('alice', { wants: [want([m('swept.alice')], 2)] }),
        character('bob', { wants: [want([m('swept.bob')], 2)] }),
        character('cara'),
      ]);
      st.performOutcome(insert('practice.yard.here'));
      return st;
    }
    case 'npc: a death mid-run': {
      const duel = practice('duel', {
        roles: ['R'],
        actions: [
          action('[Actor]: strike bob', [eq('Actor', 'cara'), not_('dead.bob')], [insert('dead.bob')]),
          action('[Actor]: sweep the step', [not_('swept.Actor')], [insert('swept.Actor')]),
          action('[Actor]: idle about'),
        ],
      });
      const st = new State();
      st.definePractices([duel]);
      st.setCharacters([
        character('alice', { wants: [want([m('swept.alice')], 2)] }),
        character('bob'),
        character('cara', { wants: [want([m('dead.bob')], 9)] }),
      ]);
      st.performOutcome(insert('practice.duel.here'));
      return st;
    }
    case 'npc: the schedule-gated wake': {
      const square = practice('square', {
        roles: ['R'],
        actions: [
          action('[Actor]: sell at the market', [m('marketDay'), not_('sold.Actor')], [insert('sold.Actor')]),
          action('[Actor]: sweep the step', [not_('swept.Actor')], [insert('swept.Actor')]),
          action('[Actor]: idle about'),
        ],
      });
      const st = new State();
      st.definePractices([square]);
      st.setCharacters([
        holds(character('alice'), 'wants-market'),
        character('bob', { wants: [want([m('swept.bob')], 2)] }),
        character('cara'),
      ]);
      st.setDesires([desire('wants-market', want([m('marketDay'), m('sold.Owner')], 5))]);
      st.setSchedule([scheduleRule('market', 3, [[[not_('marketDay')], [insert('marketDay')]]])]);
      st.performOutcome(insert('practice.square.here'));
      return st;
    }
    default:
      throw new Error(`npc.json scenario has no TS twin: ${JSON.stringify(name)}`);
  }
}

// R: npc_replay.rs replay::npc_runs_replay_line_for_line
test('npc_replay.rs : les parties de npc.json se rejouent ligne à ligne', () => {
  const data = loadFixture('npc.json');
  const scenarios = data.scenarios as Json[];
  assert.ok(scenarios.length > 0, 'npc.json has no scenarios');
  for (const sc of scenarios) {
    const name = sc.name as string;
    const st = npcScenario(name);

    const narration = runNpcTicks(st, sc.depth as number, sc.steps as number);
    assert.deepEqual(narration, strs(sc.narration), `narration @ ${name}`);

    const dump = sc.final;
    assert.deepEqual(st.labeledFacts(), strs(dump.facts), `facts @ ${name}`);
    assert.deepEqual(st.labeledView(), strs(dump.view), `view @ ${name}`);
    assert.equal(st.cursor, dump.cursor as number, `cursor @ ${name}`);
    assert.equal(st.rngSeed, dump.rng ?? null, `rng @ ${name}`);
    assert.deepEqual(sortedEntries(st.scheduleDues()), sortedEntries(Object.entries(dump.dues as Record<string, number>)), `dues @ ${name}`);
    assert.deepEqual(
      sortedEntries(st.expiriesRendered()),
      sortedEntries(Object.entries(dump.expiries as Record<string, number>)),
      `expiries @ ${name}`,
    );

    // The survivors, in cast order.
    const alive = st.characters.map((c) => c.name).filter((n) => !st.dbHas(`dead.${n}`));
    assert.deepEqual(alive, strs(sc.alive), `survivors @ ${name}`);

    // The standing intentions: the same keys, the same acts, the same bases.
    const wantInt = sc.intentions as Record<string, Json>;
    const gotInt = st.intentionsMap();
    assert.deepEqual([...gotInt.keys()].sort(), Object.keys(wantInt).sort(), `intention keys @ ${name}`);
    for (const [who, want] of Object.entries(wantInt)) {
      const intent = gotInt.get(who);
      assert.ok(intent !== undefined, `intention for ${who} @ ${name}`);
      assert.equal(lbl(intent.act), want.act ?? null, `intention act for ${who} @ ${name}`);
      checkSignature(intent.basis, want.basis, `${who} @ ${name}`);
    }
  }
});

// R: npc_replay.rs replay::the_schedule_gated_wake_actually_wakes
test('npc_replay.rs : le réveil sous garde du calendrier réveille vraiment', () => {
  const data = loadFixture('npc.json');
  const sc = (data.scenarios as Json[]).find((s) => s.name === 'npc: the schedule-gated wake');
  assert.ok(sc !== undefined, 'the wake scenario must be in the corpus');
  const narration = strs(sc.narration);
  assert.ok(narration.includes('alice: sell at the market'), `the gated desire never woke: ${JSON.stringify(narration)}`);
  assert.equal(narration[0], 'alice: idle about', 'alice must be committed to idling while the gate is shut');
});

// =============================================================================
// conformance/src/goldens.rs — le chargeur et la barrière anti-copie
// =============================================================================

/** Les quatre goldens, par nom (les noms de fichiers sous tests/fixtures/prax/goldens/). */
const GOLDENS = ['village-21', 'bar-12', 'intrigue-12', 'loop-bar-25'] as const;

/** Rust `str::lines` : coupe sur `\n`, retire un `\r` final, pas de ligne vide terminale. */
function rustLines(body: string): string[] {
  const parts = body.split('\n');
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  return parts.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
}

/** Charge une séquence de décisions gelée, une ligne par élément (Rust `goldens::load`). */
function loadGolden(name: string): string[] {
  const path = join(GOLDENS_DIR, `${name}.txt`);
  let body: string;
  try {
    body = readFileSync(path, 'utf8');
  } catch (e) {
    throw new Error(
      `golden \`${name}\` is missing at ${path}: ${String(e)}. Copy it from the FROZEN tree ` +
        '(prax/conformance/goldens) — never hand-write one.',
    );
  }
  const lines = rustLines(body);
  assert.ok(lines.length > 0, `golden \`${name}\` is empty; a vacuous comparison is not a golden test`);
  return lines;
}

// R: goldens.rs tests::every_named_golden_loads_and_is_non_trivial
test('goldens.rs : chaque golden nommé se charge et n’est pas trivial', () => {
  for (const g of GOLDENS) {
    const lines = loadGolden(g);
    assert.ok(lines.length >= 12, `golden ${g} is suspiciously short`);
  }
});

// R: goldens.rs tests::the_goldens_hashes_are_committed
test('goldens.rs : les empreintes des goldens sont enregistrées', () => {
  const sums = join(GOLDENS_DIR, 'SHA256SUMS');
  const body = readFileSync(sums, 'utf8');
  for (const g of GOLDENS) assert.ok(body.includes(`${g}.txt`), `SHA256SUMS does not cover ${g}.txt`);

  // Complément TS : la copie est fidèle — chaque fichier a l'empreinte gelée.
  for (const line of rustLines(body)) {
    const mm = /^([0-9a-f]{64})\s+(?:\.\/)?(\S+)$/.exec(line);
    assert.ok(mm !== null, `malformed SHA256SUMS line: ${JSON.stringify(line)}`);
    const digest = createHash('sha256').update(readFileSync(join(GOLDENS_DIR, mm[2]))).digest('hex');
    assert.equal(digest, mm[1], `${mm[2]} differs from the frozen golden`);
  }
});

/**
 * Une ligne source qui n'est qu'un littéral de chaîne, et son contenu.
 * ADAPTÉ : Rust ne reconnaît que `"…"` ; le TS s'écrit surtout en `'…'` — les
 * trois délimiteurs (`"`, `'`, `` ` ``) sont acceptés, échappements simples défaits.
 */
function bareLiteral(line: string): string | null {
  let t = line.trim();
  const q = t[0];
  if (q !== '"' && q !== "'" && q !== '`') return null;
  t = t.slice(1);
  if (t.endsWith(',')) t = t.slice(0, -1);
  if (!t.endsWith(q)) return null;
  t = t.slice(0, -1);
  if (t.length === 0) return null;
  return t.replace(/\\(["'`\\])/g, '$1');
}

const windowsEq = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * La ligne (à partir de 1) où un source re-tape pour la première fois un
 * FRAGMENT d'un golden : trois littéraux nus consécutifs ou plus, qui sont trois
 * lignes consécutives du même golden, dans l'ordre.
 */
function inlineGoldenFragmentAt(body: string, goldens: ReadonlyArray<readonly [string, readonly string[]]>): number | null {
  const lines = rustLines(body);
  for (let start = 0; start < lines.length; start++) {
    const run: string[] = [];
    for (const line of lines.slice(start)) {
      const s = bareLiteral(line);
      if (s === null) break;
      run.push(s);
    }
    if (run.length < 3) continue;
    for (const [, golden] of goldens) {
      for (let i = 0; i + 3 <= golden.length; i++) {
        const w = golden.slice(i, i + 3);
        for (let j = 0; j + 3 <= run.length; j++) if (windowsEq(run.slice(j, j + 3), w)) return start + 1;
      }
    }
  }
  return null;
}

/** Tous les sources `.ts`/`.tsx` sous `dir`, récursivement, en ordre déterministe (Rust `every_rust_source`). */
function everyTsSource(dir: string): string[] {
  const out: string[] = [];
  const collect = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const path = join(d, entry);
      if (statSync(path).isDirectory()) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        collect(path);
      } else if (/\.(ts|tsx)$/.test(entry)) out.push(path);
    }
  };
  collect(dir);
  return out.sort();
}

// R: goldens.rs tests::no_inline_golden_literals
//
// ADAPTÉ : le balayage Rust couvre tout `rust/` ; ici, tout le TypeScript du
// dépôt (src/, tools/, tests/ — node_modules et dossiers cachés exclus). Ce
// fichier n'est PAS exempté (le Rust exempte goldens.rs pour sa doc ; ce fichier
// porte aussi les tests de golden_drive.rs, que le Rust balaie).
test('goldens.rs : aucun source ne re-tape un fragment de golden', () => {
  const goldens = GOLDENS.map((g) => [g, loadGolden(g)] as const);
  const sources = ['src', 'tools', 'tests'].flatMap((d) => everyTsSource(join(RACINE, d)));
  // Rust `assert_reaches_workspace`.
  assert.ok(sources.length > 40, `the sweep found only ${sources.length} files under ${RACINE} — it is not reaching the workspace`);
  const offenders: string[] = [];
  for (const path of sources) {
    const line = inlineGoldenFragmentAt(readFileSync(path, 'utf8'), goldens);
    if (line !== null) offenders.push(`${path}:${line}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `these files re-type a fragment of a committed golden inline: ${JSON.stringify(offenders)}. ` +
      'A golden test must LOAD tests/fixtures/prax/goldens/<name>.txt — an inline copy is a third source of truth.',
  );
});

// R: goldens.rs tests::the_inline_literal_gate_catches_a_narration_that_never_says_golden
test('goldens.rs : la barrière attrape une narration copiée qui ne dit jamais « golden »', () => {
  const goldens = GOLDENS.map((g) => [g, loadGolden(g)] as const);
  const narration = loadGolden('loop-bar-25').slice(0, 5);

  // Le corps exact du Rust (littéraux `"…"`)…
  const rows = narration.map((l) => `        "${l}",\n`).join('');
  const body = `fn expected_ticks() -> Vec<&'static str> {\n    vec![\n${rows}    ]\n}\n`;
  assert.ok(!body.includes('golden'), 'the fixture must not opt in');
  assert.equal(inlineGoldenFragmentAt(body, goldens), 3, 'the gate must catch a re-typed golden fragment in a file that never says `golden`');
  // …et sa forme TypeScript (littéraux `'…'`) — complément TS.
  const tsRows = narration.map((l) => `    '${l.replace(/'/g, "\\'")}',\n`).join('');
  const tsBody = `function expectedTicks(): string[] {\n  return [\n${tsRows}  ];\n}\n`;
  assert.ok(!tsBody.includes('golden'), 'the fixture must not opt in');
  assert.equal(inlineGoldenFragmentAt(tsBody, goldens), 3);

  // …and must NOT fire on authored data a world legitimately carries.
  const facts = 'vec![\n    "char.vera",\n    "char.otto",\n    "at.vera.bar",\n]\n';
  assert.equal(inlineGoldenFragmentAt(facts, goldens), null);

  // Two consecutive golden lines are not enough.
  const two = narration
    .slice(0, 2)
    .map((l) => `    "${l}",\n`)
    .join('');
  assert.equal(inlineGoldenFragmentAt(two, goldens), null);
});

// =============================================================================
// conformance/src/golden_drive.rs — séquences de décisions gelées
// =============================================================================

/** `Prax.GoldenDriveSpec.driveLabels` : `n` tours, le personnage nommé reste inactif. */
function driveLabels(st: State, n: number, idle: string | null, out: string[] = []): string[] {
  for (let k = 0; k < n; k++) {
    const actor = advance(st);
    const name = actor.name;
    if (name === idle) {
      out.push(`${name}: -`);
      continue;
    }
    const ga = npcAct(st, 2, actor);
    out.push(`${name}: ${ga === null ? '-' : ga.label}`);
  }
  return out;
}

/**
 * La partie libre du village, PARTAGÉE entre golden_drive (village-21) et
 * village_relevance (réveil v37, 48 pas) — ADAPTATION DE DURÉE : les deux tests
 * Rust conduisent le MÊME monde par la MÊME procédure (`advance` puis
 * `npc_act(2)`, `you` inactif) ; les 21 pas du golden sont exactement le préfixe
 * des 48 pas du réveil. On ne paie donc ce préfixe qu'une fois (~18 s sur ~64 s).
 * Chaque test reste autonome : lancé seul, il conduit la partie depuis le début.
 */
class VillageRun {
  readonly st = villageWorld();
  readonly labels: string[] = [];
  get step(): number {
    return this.labels.length;
  }
  /** Avance la partie jusqu'au pas `n` (1-basé, comme les commentaires Rust). */
  runTo(n: number): void {
    if (this.step < n) driveLabels(this.st, n - this.step, VILLAGE_PLAYER, this.labels);
  }
}
let sharedVillage: VillageRun | null = null;
function villageRunAtMost(step: number): VillageRun {
  if (sharedVillage === null || sharedVillage.step > step) sharedVillage = new VillageRun();
  return sharedVillage;
}

// R: golden_drive.rs tests::intrigue_twelve_turns_decision_for_decision
// H: GoldenDriveSpec.hs "Prax.GoldenDrive (decision-sequence exactness)"
// H: GoldenDriveSpec.hs "intrigue: 12 turns, decision for decision"
test('golden_drive.rs : intrigue — 12 tours, décision pour décision', () => {
  const got = driveLabels(intrigueWorld(), 12, null);
  assert.deepEqual(got, loadGolden('intrigue-12'), 'the intrigue decision sequence must match the frozen golden turn for turn');
});

// R: golden_drive.rs tests::bar_twelve_turns_decision_for_decision
// H: GoldenDriveSpec.hs "bar: 12 turns, decision for decision"
test('golden_drive.rs : bar — 12 tours, décision pour décision', () => {
  // `driveLabels 12 Nothing barWorld`: no idler, so the director's turns show as `director: -`.
  const got = driveLabels(barWorld(), 12, null);
  assert.deepEqual(got, loadGolden('bar-12'), 'the bar decision sequence must match the frozen golden turn for turn');
});

// R: golden_drive.rs tests::village_twenty_one_turns_of_free_play
// H: GoldenDriveSpec.hs "village: 21 turns of free play, decision for decision"
test('golden_drive.rs : village — 21 tours de jeu libre, décision pour décision', () => {
  // `driveLabels 21 (Just playerName) villageWorld`: the human seat idles.
  const run = villageRunAtMost(Number.POSITIVE_INFINITY);
  run.runTo(21);
  assert.deepEqual(
    run.labels.slice(0, 21),
    loadGolden('village-21'),
    'the village decision sequence must match the frozen golden turn for turn',
  );
});

// =============================================================================
// conformance/src/village_relevance.rs — tables de pertinence du village
// =============================================================================

function livenessTag(tbl: ReadonlyMap<string, [string, string[][]]>, name: string): [string, string[][]] {
  const v = tbl.get(name);
  assert.ok(v !== undefined, `no liveness entry for ${JSON.stringify(name)}; had ${JSON.stringify([...tbl.keys()])}`);
  return v;
}

// R: village_relevance.rs tests::the_village_improvable_table_conscience_spite_and_pursuit
// H: RelevanceSpec.hs "the village table: conscience live, spite and pursuit live"
test('village_relevance.rs : la table des améliorables — conscience, rancune et poursuite', () => {
  const st = villageWorld();
  const tbl = st.improvables;
  assert.ok(tbl.includes('clean-conscience'), `clean-conscience is improvable; table = ${JSON.stringify(tbl)}`);
  assert.ok(tbl.includes('spites-carol'), `spites-carol is improvable; table = ${JSON.stringify(tbl)}`);
  assert.ok(tbl.includes('pursues-earnBread'), `pursues-earnBread is improvable; table = ${JSON.stringify(tbl)}`);
});

// R: village_relevance.rs tests::the_state_carries_the_table_and_set_desires_rebuilds_it
// H: RelevanceSpec.hs "the state carries the table and setDesires rebuilds it"
test('village_relevance.rs : l’état porte la table et setDesires la reconstruit', () => {
  const st = villageWorld();
  assert.deepEqual(
    [...st.improvables],
    st.improvableDesiresRecomputed(),
    "the village's cached improvables field must equal the module computation over its own compiled tables — a difference is a stale rebuild",
  );
  const narrowed = st.desiresSrc().filter((d) => d.name === 'spites-carol');
  assert.equal(narrowed.length, 1, 'spites-carol is in the vocabulary');
  st.setDesires(narrowed);
  assert.ok(!st.improvables.includes('pursues-earnBread'), `narrowed vocabulary narrows the table; had ${JSON.stringify(st.improvables)}`);
});

// R: village_relevance.rs tests::delta_relevance_against_the_villages_axioms
// H: RelevanceSpec.hs "delta relevance against the village's axioms"
test('village_relevance.rs : pertinence des deltas contre les axiomes du village', () => {
  const st = villageWorld();
  assert.ok(!st.relevantDelta('practice.world.world.at.bob!square'), 'movement commutes with closure (fast path)');
  assert.ok(st.relevantDelta('you.believes.stole.bob.loaf.seen'), 'a witness deposit is relevant (standingUnless reads believes)');
  assert.ok(st.relevantDelta('atoned.bob'), 'an atonement is relevant (it defeats standing)');
  assert.ok(!st.relevantDelta('stall.loaf'), "the stall's stock is not");
});

// R: village_relevance.rs tests::monotone_insert_classification_against_the_village
// H: RelevanceSpec.hs "monotone-insert classification against the village"
test('village_relevance.rs : classement des insertions monotones contre le village', () => {
  const st = villageWorld();
  assert.ok(st.contMonotone, "the village's axioms admit the continuation tier");
  assert.ok(st.monotoneInsert('you.believes.stole.bob.loaf.seen'), 'a witness deposit grows monotonically');
  assert.ok(!st.monotoneInsert('atoned.bob'), 'atonement defeats standing: full reclose');
  assert.ok(!st.monotoneInsert('practice.world.world.at.bob!square'), 'an exclusion insert never takes the continuation');
});

// R: village_relevance.rs tests::the_villages_liveness_field
// H: RelevanceSpec.hs "the village's liveness field: floors for consciences, classes for the rest"
test('village_relevance.rs : le champ de vivacité du village', () => {
  const st = villageWorld();
  const tbl = st.livenessRendered();
  assert.equal(livenessTag(tbl, 'clean-conscience')[0], 'FloorCheck');
  assert.equal(livenessTag(tbl, 'conscience-remembers')[0], 'FloorCheck');
  assert.equal(livenessTag(tbl, 'pursues-earnBread')[0], 'AlwaysLive');
  assert.equal(livenessTag(tbl, 'spites-carol')[0], 'AlwaysLive');
  assert.equal(livenessTag(tbl, 'punishes-whisper')[0], 'AlwaysLive');
  assert.equal(livenessTag(tbl, 'suffers-hunger')[0], 'FloorCheck');
  assert.deepEqual(livenessTag(tbl, 'drawn-to-market'), ['GateCheck', [['marketDay.square']]]);
  // `liveness villageWorld == livenessOf villageWorld`: the cached FIELD equals the module COMPUTATION.
  assert.deepEqual(
    sortedEntries(tbl),
    sortedEntries(st.livenessRecomputed()),
    'the liveness field matches the module computation -- a difference means the field went stale against its own rebuild',
  );
});

// R: village_relevance.rs tests::the_v37_wake_end_to_end
// H: LoopSpec.hs "the v37 wake, end to end: a standing intention holds through quiet rounds, the market's open flips the live-desire set and wakes fresh deliberation to the square, the close disperses it"
//
// Trajectoire complète (48 pas, `you` inactif) conservée ; seul le préfixe de
// 21 pas est partagé avec le golden village-21 (voir `VillageRun`).
test('village_relevance.rs : le réveil v37 de bout en bout', () => {
  const run = villageRunAtMost(36);
  const st = run.st;
  const gale = st.characters.find((c) => c.name === 'gale');
  assert.ok(gale !== undefined, 'no such villager: gale');

  run.runTo(36);
  // QUIET (step 36): her standing intention still matches her current signature.
  const sigQuiet = st.motiveSignature(gale);
  const intentQuiet = st.intentionOf('gale');
  assert.ok(intentQuiet !== undefined, 'gale holds no standing intention yet');
  assert.deepEqual(intentQuiet.basis, sigQuiet, 'the standing intention holds through the quiet turn');
  assert.ok(!sigQuiet.liveDesires.includes('drawn-to-market'), `drawn-to-market is not yet live; live = ${JSON.stringify(sigQuiet.liveDesires)}`);

  // THE OPEN (step 37, the turn-6 boundary).
  run.runTo(37);
  const sigOpen = st.motiveSignature(gale);
  assert.ok(st.dbHas('marketDay.square'), 'the market is open');
  assert.ok(sigOpen.liveDesires.includes('drawn-to-market'), `drawn-to-market is now live; live = ${JSON.stringify(sigOpen.liveDesires)}`);
  assert.notDeepEqual(sigQuiet.liveDesires, sigOpen.liveDesires, 'the live-desire component actually changed (before /= after)');
  const intentOpen = st.intentionOf('gale');
  assert.ok(intentOpen !== undefined, "gale's intention");
  assert.ok(!motiveSignatureEq(intentOpen.basis, sigOpen), "her standing intention's basis no longer matches: she is woken");

  // her NEXT turn within the open round (step 42) re-deliberates and picks the square.
  run.runTo(42);
  assert.equal(lbl(st.intentionOf('gale')?.act), 'gale: Go to square');

  // THE CLOSE (step 43, the turn-7 boundary).
  run.runTo(43);
  const sigClosed = st.motiveSignature(gale);
  assert.ok(!st.dbHas('marketDay.square'), 'the market is closed');
  assert.ok(!sigClosed.liveDesires.includes('drawn-to-market'), `drawn-to-market is dead again; live = ${JSON.stringify(sigClosed.liveDesires)}`);
  assert.notDeepEqual(sigOpen.liveDesires, sigClosed.liveDesires, 'the live-desire component changed back (open /= closed)');
  const intentClosed = st.intentionOf('gale');
  assert.ok(intentClosed !== undefined, "gale's intention");
  assert.ok(!motiveSignatureEq(intentClosed.basis, sigClosed), 'her market-turn intention no longer matches: woken again, by the close');

  // her next turn (step 48) disperses her back to the mill.
  run.runTo(48);
  assert.equal(lbl(st.intentionOf('gale')?.act), 'gale: Go to mill');
});
