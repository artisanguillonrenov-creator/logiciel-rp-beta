/**
 * Portage TypeScript des tests des modules de vocabulaire Prax
 * `project`, `deceit`, `rumor`, `faction`, `repute`, `debt`, `reactions`,
 * `persona`, `witness`, `emotion`, `core_model`, `minds`, `conversation`,
 * `beliefs` et `arc` (prax-vocab/src/*.rs, modules `#[cfg(test)]`), plus
 * l'épingle `as_role` de conformance/src/witness_templates.rs (Prax,
 * BSD-3-Clause). Un test TS par `#[test]` Rust, même scénario et mêmes
 * assertions. Aucun `proptest!` dans ces seize fichiers.
 *
 * Là où le Rust n'assertait que `is_err()`, on vérifie en plus la variante
 * (`WorldError.kind`) que le code Rust lève sur ce chemin — c'est la même
 * erreur, simplement nommée.
 *
 * Adaptations propres au Rust (signalées au cas par cas) : l'interneur
 * disparaît (`ground_reference` construit directement ses liaisons) ; deux
 * fonctions privées du module Rust (`capitalize`, `adjust_score_fn`) ne sont
 * pas exportées en TS et sont observées par l'API publique (`scoreAtLeast`,
 * `coreFns()`).
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Bindings, emptyDb, insertStr } from '../src/prax/core/db';
import { State } from '../src/prax/core/engine';
import { WorldError, WorldErrorKind } from '../src/prax/core/errors';
import { GroundedAction } from '../src/prax/core/perform';
import {
  Condition,
  absent,
  calc,
  cmp,
  compileCondition,
  count,
  eq,
  exists,
  groundCondition,
  matches,
  neq,
  not_,
  query,
  subquery,
} from '../src/prax/core/query';
import {
  Action,
  Character,
  Desire,
  Outcome,
  Practice,
  Want,
  action,
  axiom,
  call,
  character,
  del,
  desire,
  fn,
  holds,
  insert,
  practice,
  want,
} from '../src/prax/core/types';
import { isVariableName } from '../src/prax/core/util';
import { obligationPath } from '../src/prax/core/vocabConsts';
import { arcIs, arcOf, arcSentence, enterArc } from '../src/prax/vocab/arc';
import { beliefAbout, beliefSentence, believe, believesThat, forget } from '../src/prax/vocab/beliefs';
import { beginConversation, changeSubject, endConversation, quip, talkPath, talkingWith } from '../src/prax/vocab/conversation';
import { RESPECT, WARMTH, adjustScore, coreFns, scoreAtLeast, setBond } from '../src/prax/vocab/coreModel';
import { debtPath, owe, owes, settle } from '../src/prax/vocab/debt';
import { conceal, lie } from '../src/prax/vocab/deceit';
import { breach, discharge, oblige } from '../src/prax/vocab/deontic';
import {
  AFRAID,
  ANGRY,
  ANNOYED,
  DISGUSTED,
  HAPPY,
  PLEASED,
  SAD,
  SURPRISED,
  feel,
  feelToward,
  feelTowardFor,
  feeling,
  feelingToward,
  unfeel,
  unfeelToward,
} from '../src/prax/vocab/emotion';
import { comrades, factionStanding, joins, memberPath } from '../src/prax/vocab/faction';
import { conventional, professed, selfWants, wantFor } from '../src/prax/vocab/minds';
import { Trait, bearing, cast, personaVocabulary, trait, transparent } from '../src/prax/vocab/persona';
import { Part, endeavor, part } from '../src/prax/vocab/project';
import { endReaction, markViolation, reactionActive, reactionPath, spawnReaction, violationOf } from '../src/prax/vocab/reactions';
import { notoriety, regardedAs, standing, standingUnless } from '../src/prax/vocab/repute';
import { gossip, heard } from '../src/prax/vocab/rumor';
import { CoPresence, asRole, observable, saw } from '../src/prax/vocab/witness';
import { together as barTogether } from '../src/prax/worlds/bar';
import { together as villageTogether } from '../src/prax/worlds/village';

// ---- outillage commun (les helpers `member` / `do_act` / `offered` des modules Rust) ----

/** `Character::new(n).want(..)…` */
function ch(name: string, wants: readonly Want[] = [], desires: readonly string[] = []): Character {
  return character(name, { wants, desires });
}

/** `Practice::new(id).name(name).roles(roles).action(..)…` */
function prac(id: string, roles: readonly string[], actions: readonly Action[], name = ''): Practice {
  return practice(id, { name, roles, actions });
}

function member(st: State, n: string): Character {
  const c = st.characters.find((x) => x.name === n);
  if (c === undefined) throw new Error(`no such character: ${n}`);
  return c;
}

function labels(st: State, who: string): string[] {
  return st.possibleActions(who).map((ga) => ga.label);
}

function find(st: State, who: string, needle: string): GroundedAction {
  const found = st.possibleActions(who).find((ga) => ga.label.includes(needle));
  if (found === undefined) throw new Error(`no action for ${who} matching ${JSON.stringify(needle)}; had: ${JSON.stringify(labels(st, who))}`);
  return found;
}

function doAct(who: string, needle: string, st: State): void {
  st.performAction(find(st, who, needle));
}

function offered(who: string, needle: string, st: State): boolean {
  return st.possibleActions(who).some((ga) => ga.label.includes(needle));
}

function picked(st: State, depth: number, c: Character): string | null {
  return st.pickAction(depth, c)?.label ?? null;
}

function predicted(st: State, predictor: Character, mover: Character): string | null {
  return st.predictMove(predictor, mover)?.label ?? null;
}

function performAll(st: State, outs: readonly Outcome[]): void {
  for (const o of outs) st.performOutcome(o);
}

/** Erreur levée par `f` (échoue si `f` ne lève rien ou lève autre chose qu'une `WorldError`). */
function worldErrorOf(f: () => unknown, msg: string): WorldError {
  let threw = false;
  let caught: unknown;
  try {
    f();
  } catch (e) {
    threw = true;
    caught = e;
  }
  assert.ok(threw, `${msg} — aucune erreur levée`);
  assert.ok(caught instanceof WorldError, `${msg} — erreur qui n'est pas une WorldError : ${String(caught)}`);
  return caught;
}

/** `assert!(f().is_err())`, précisé : la variante `WorldError` levée est `kind`. */
function throwsKind(f: () => unknown, kind: WorldErrorKind, msg: string): WorldError {
  const e = worldErrorOf(f, msg);
  assert.equal(e.kind, kind, `${msg} — variante ${e.kind} (${e.message})`);
  return e;
}

/** Le gabarit de co-présence des specs : partager un lieu. */
function together(): CoPresence {
  return [matches('at.Actor!P'), matches('at.Witness!P')];
}

// =====================================================================================
// project.rs — H: ProjectSpec.hs "Prax.Project"
// =====================================================================================

describe('project', () => {
  /** Une CHAÎNE de 4 parties : mia construit un four, partie après partie ; pat regarde. */
  function chainParts(): Part[] {
    return [
      part('sweep', '[Actor]: sweep the hearth', [], [], []),
      part('fetch', '[Actor]: fetch the clay', ['sweep'], [matches('clay.available')], [insert('carrying.Owner.clay')]),
      part('shape', '[Actor]: shape the oven', ['fetch'], [matches('carrying.Owner.clay')], [del('carrying.Owner.clay')]),
      part('fire', '[Actor]: fire it', ['shape'], [], [insert('oven.standing')]),
    ];
  }

  type End = [Action, Practice, Desire];

  const ovenEnd = (): End => endeavor('oven', 3, '[Actor]: resolve to build an oven', [], chainParts());

  /** Deux parties sans arête : rien ne les enchaîne, les deux sont vivantes à la fois. */
  const choresEnd = (): End =>
    endeavor('chores', 3, '[Actor]: set to the chores', [], [
      part('dishes', '[Actor]: wash the dishes', [], [], [insert('washed.Owner')]),
      part('mop', '[Actor]: mop the floor', [], [], [insert('mopped.Owner')]),
    ]);

  /** Une culmination (`finish`) qui n'exige que `gather` ; `flourish` est optionnelle. */
  const feastEnd = (): End =>
    endeavor('feast', 3, '[Actor]: throw a feast', [], [
      part('gather', '[Actor]: gather the harvest', [], [], [insert('gathered.Owner')]),
      part('flourish', '[Actor]: garnish the platter', [], [], [insert('garnished.Owner')]),
      part('finish', '[Actor]: serve the feast', ['gather'], [], [insert('served.Owner')]),
    ]);

  /** Cinq parties ; la culmination (`close`) porte une garde de SEUIL (3 sur 4 faites). */
  function quotaEnd(): End {
    const parts: Part[] = ['a', 'b', 'c', 'd'].map((n) => part(n, `[Actor]: file report ${n}`, [], [], []));
    parts.push(
      part(
        'close',
        '[Actor]: close the quota',
        [],
        [subquery('Done', ['P'], [matches('practice.quota.Owner.did.P')]), count('N', 'Done'), cmp('gte', 'N', '3')],
        [insert('quota.met.Owner')],
      ),
    );
    return endeavor('quota', 3, '[Actor]: take on the quota', [], parts);
  }

  /** L'échafaudage : mia porte la poursuite ; une pratique « yard » héberge l'entreprise et un repos. */
  function buildWorld(e: End, chars: readonly Character[], extra: readonly Outcome[]): State {
    const [take, prc, pursuit] = e;
    const yard = prac('yard', ['R'], [take, action('[Actor]: Idle about')]);
    const st = new State();
    st.definePractices([prc, yard]);
    st.setCharacters(chars);
    st.setDesires([pursuit]);
    st.performOutcome(insert('practice.yard.here'));
    performAll(st, extra);
    return st;
  }

  const miaFor = (pid: string): Character => holds(ch('mia'), `pursues-${pid}`);

  const ovenWorld = (): State => buildWorld(ovenEnd(), [miaFor('oven'), ch('pat')], [insert('clay.available')]);

  // R: project.rs the_generated_part_actions_follow_the_authored_part_order
  test('the_generated_part_actions_follow_the_authored_part_order', () => {
    const [, prc] = ovenEnd();
    assert.deepEqual(
      prc.actions.map((a) => a.name),
      ['[Actor]: sweep the hearth', '[Actor]: fetch the clay', '[Actor]: shape the oven', '[Actor]: fire it'],
      'one generated action per part, in the AUTHORED part order -- no reordering, no extras, none dropped',
    );
  });

  // R: project.rs the_generated_part_guard_conjuncts_hold_their_order
  test('the_generated_part_guard_conjuncts_hold_their_order', () => {
    const [, prc] = ovenEnd();
    const shape = prc.actions.find((a) => a.name === '[Actor]: shape the oven');
    assert.ok(shape !== undefined, 'the shape part action');
    assert.deepEqual(
      shape.when,
      [eq('Actor', 'Owner'), not_('practice.oven.Owner.did.shape'), matches('practice.oven.Owner.did.fetch'), matches('carrying.Owner.clay')],
      'ownership, then the once-guard, then the `after` edges, then the authored `needs` -- in that order',
    );
    assert.deepEqual(shape.then, [insert('practice.oven.Owner.did.shape'), del('carrying.Owner.clay')], 'the ledger write leads; the authored yields follow it');
  });

  // R: project.rs the_horizon_regression_a_four_part_chain_pursued_to_completion
  // H: ProjectSpec.hs "the horizon regression: a four-part chain pursued to completion at depth 2"
  test('the_horizon_regression_a_four_part_chain_pursued_to_completion', () => {
    const st = ovenWorld();
    const mia = miaFor('oven');
    for (let i = 0; i < 5; i++) {
      // entreprendre + 4 parties
      const ga = st.pickAction(2, mia);
      assert.ok(ga !== null, 'mia has no move');
      st.performAction(ga);
    }
    assert.ok(st.dbHas('practice.oven.mia.did.fire'), 'the chain completed to its culminating part');
  });

  // R: project.rs parallel_parts_are_genuinely_parallel
  // H: ProjectSpec.hs "parallel parts: both edge-free parts are offered; the un-chosen one survives"
  test('parallel_parts_are_genuinely_parallel', () => {
    const st = buildWorld(choresEnd(), [miaFor('chores')], []);
    doAct('mia', 'set to the chores', st);
    assert.ok(offered('mia', 'wash the dishes', st) && offered('mia', 'mop the floor', st), 'both edge-free parts offered at once');
    doAct('mia', 'wash the dishes', st);
    assert.ok(!offered('mia', 'wash the dishes', st), 'the completed part is not re-offered');
    assert.ok(offered('mia', 'mop the floor', st), 'the un-chosen sibling is STILL offered (parts do not suppress siblings)');
  });

  // R: project.rs an_optional_part_never_blocks_and_still_pays
  // H: ProjectSpec.hs "an optional part: the culmination fires with it undone, and it still pays +w"
  test('an_optional_part_never_blocks_and_still_pays', () => {
    const st = buildWorld(feastEnd(), [miaFor('feast')], []);
    doAct('mia', 'throw a feast', st);
    doAct('mia', 'gather the harvest', st);
    assert.ok(
      offered('mia', 'serve the feast', st) && !st.dbHas('practice.feast.mia.did.flourish'),
      'the culmination is offered though the optional part is undone',
    );
    doAct('mia', 'serve the feast', st);
    assert.ok(st.dbHas('practice.feast.mia.did.finish'), 'the culmination fired');
    assert.ok(offered('mia', 'garnish the platter', st), 'the optional part is still offered after the culmination');
    const w = want([matches('practice.feast.Owner.did.P')], 3);
    const before = st.evaluateWants([w]);
    doAct('mia', 'garnish the platter', st);
    const after = st.evaluateWants([w]);
    assert.equal(after, before + 3);
  });

  // R: project.rs a_threshold_culmination_fires_at_three_of_five
  // H: ProjectSpec.hs "a threshold culmination fires at three of five, not two"
  test('a_threshold_culmination_fires_at_three_of_five', () => {
    const st = buildWorld(quotaEnd(), [miaFor('quota')], []);
    doAct('mia', 'take on the quota', st);
    doAct('mia', 'file report a', st);
    doAct('mia', 'file report b', st);
    assert.ok(!offered('mia', 'close the quota', st), 'two done: the threshold gate blocks the culmination');
    doAct('mia', 'file report c', st);
    assert.ok(offered('mia', 'close the quota', st), 'three done: the threshold gate opens the culmination');
  });

  // R: project.rs dependency_gating
  // H: ProjectSpec.hs "dependency gating: an unmet edge blocks; the met edge offers"
  test('dependency_gating', () => {
    const st = ovenWorld();
    doAct('mia', 'resolve to build an oven', st);
    assert.ok(offered('mia', 'sweep the hearth', st), 'the edge-free root is offered');
    assert.ok(!offered('mia', 'fetch the clay', st), 'the dependent part is blocked while its edge is unmet');
    doAct('mia', 'sweep the hearth', st);
    assert.ok(offered('mia', 'fetch the clay', st), 'the dependent part is offered once its edge is met');
  });

  // R: project.rs each_part_fires_once_and_the_subtree_delete_re_opens_the_endeavor
  // H: ProjectSpec.hs "each part fires once; the subtree delete re-opens the endeavor"
  test('each_part_fires_once_and_the_subtree_delete_re_opens_the_endeavor', () => {
    const st = ovenWorld();
    doAct('mia', 'resolve to build an oven', st);
    doAct('mia', 'sweep the hearth', st);
    assert.ok(!offered('mia', 'sweep the hearth', st), 'the completed part is not re-offered within the instance');
    assert.ok(!offered('mia', 'resolve to build an oven', st), 'and undertaking is not re-offered while the instance stands');
    st.performOutcome(del('practice.oven.mia'));
    assert.ok(!st.dbHas('practice.oven.mia.did.sweep'), 'the ledger subtree is gone');
    assert.ok(offered('mia', 'resolve to build an oven', st), 'undertaking is offered again');
  });

  // R: project.rs the_pursuit_is_dormant_until_undertaken
  // H: ProjectSpec.hs "the pursuit: exact shape, dormant (zero utility, no prediction), live once undertaken"
  test('the_pursuit_is_dormant_until_undertaken', () => {
    const [, , pursuit] = ovenEnd();
    assert.deepEqual(pursuit, desire('pursues-oven', want([matches('practice.oven.Owner.did.P')], 3)));
    const st = ovenWorld();
    assert.equal(st.evaluateWants([pursuit.want]), 0);
    const mia = miaFor('oven');
    const pat = ch('pat');
    st.performOutcome(insert('pat.believes.desires.mia.pursues-oven.heard.mia'));
    assert.equal(st.predictMove(pat, mia), null);
    doAct('mia', 'resolve to build an oven', st);
    assert.equal(predicted(st, pat, mia), 'mia: sweep the hearth');
  });

  // R: project.rs a_believed_pursuit_predicts_among_parallel_parts
  // H: ProjectSpec.hs "a believed pursuit predicts among PARALLEL parts (v52 T1 review M1)"
  test('a_believed_pursuit_predicts_among_parallel_parts', () => {
    const mia = miaFor('chores');
    const pat = ch('pat');
    const st = buildWorld(choresEnd(), [mia, ch('pat')], []);
    st.performOutcome(insert('pat.believes.desires.mia.pursues-chores.heard.mia'));
    doAct('mia', 'set to the chores', st);
    assert.equal(predicted(st, pat, mia), 'mia: mop the floor');
    doAct('mia', 'mop the floor', st);
    assert.equal(predicted(st, pat, mia), 'mia: wash the dishes');
  });

  // R: project.rs an_endeavor_with_no_parts_errors_loudly
  // H: ProjectSpec.hs "an endeavor with no parts errors loudly"
  test('an_endeavor_with_no_parts_errors_loudly', () => {
    throwsKind(() => endeavor('idle', 1, '[Actor]: do nothing much', [], []), 'PatternVariables', 'an endeavor is work');
  });

  // R: project.rs a_dotted_project_id_errors_loudly
  // H: ProjectSpec.hs "a dotted project id errors loudly"
  test('a_dotted_project_id_errors_loudly', () => {
    throwsKind(() => endeavor('my.oven', 1, '[Actor]: x', [], chainParts()), 'NotASinglePathSegment', 'id must be a single path segment');
  });

  // R: project.rs a_dotted_part_name_errors_loudly
  // H: ProjectSpec.hs "a dotted part name errors loudly"
  test('a_dotted_part_name_errors_loudly', () => {
    throwsKind(
      () => endeavor('oven', 1, '[Actor]: x', [], [part('sw.eep', '[Actor]: sweep', [], [], [])]),
      'NotASinglePathSegment',
      'part name must be a single path segment',
    );
  });

  // R: project.rs duplicate_part_names_error_loudly
  // H: ProjectSpec.hs "duplicate part names error loudly"
  test('duplicate_part_names_error_loudly', () => {
    throwsKind(
      () => endeavor('oven', 1, '[Actor]: x', [], [part('dup', '[Actor]: one', [], [], []), part('dup', '[Actor]: two', [], [], [])]),
      'NotASinglePathSegment',
      'part names must be distinct',
    );
  });

  // R: project.rs a_dangling_dependency_edge_errors_loudly
  // H: ProjectSpec.hs "a dangling dependency edge errors loudly"
  test('a_dangling_dependency_edge_errors_loudly', () => {
    throwsKind(
      () => endeavor('oven', 1, '[Actor]: x', [], [part('real', '[Actor]: real', ['ghost'], [], [])]),
      'PatternVariables',
      'an edge must name an actual part',
    );
  });

  // R: project.rs a_self_edge_errors_loudly
  // H: ProjectSpec.hs "a self-edge errors loudly (unreachable by the reachability fixpoint)"
  test('a_self_edge_errors_loudly', () => {
    const e = worldErrorOf(() => endeavor('oven', 1, '[Actor]: x', [], [part('a', '[Actor]: a', ['a'], [], [])]), 'a self-edge');
    assert.ok(e.message.includes('unreachable'), `a self-dependent part is unreachable (${e.message})`);
  });

  // R: project.rs a_two_cycle_errors_loudly
  // H: ProjectSpec.hs "a two-cycle errors loudly (both participants unreachable)"
  test('a_two_cycle_errors_loudly', () => {
    const e = worldErrorOf(
      () => endeavor('oven', 1, '[Actor]: x', [], [part('a', '[Actor]: a', ['b'], [], []), part('b', '[Actor]: b', ['a'], [], [])]),
      'a two-cycle',
    );
    assert.ok(e.message.includes('unreachable'), `a two-cycle has no edge-free root, so both are unreachable (${e.message})`);
  });

  // R: project.rs a_prax_namespace_variable_in_part_needs_errors_loudly
  // H: ProjectSpec.hs "a Prax-namespace variable in partNeeds errors loudly"
  test('a_prax_namespace_variable_in_part_needs_errors_loudly', () => {
    throwsKind(
      () => endeavor('oven', 1, '[Actor]: x', [], [part('x', '[Actor]: x', [], [matches('PraxFoo.bar')], [])]),
      'ReservedVarClash',
      'the Prax namespace is reserved',
    );
  });
});

// =====================================================================================
// deceit.rs — H: DeceitSpec.hs "Prax.Deceit"
// =====================================================================================

describe('deceit', () => {
  const rawLie = (): Action =>
    lie(together(), [], [matches('at.Culprit!Anywhere')], 'took.Culprit.gem', '[Actor]: whisper to [Hearer] that [Culprit] took the gem');

  /** sid convoite la gemme mais ne pas être vu la prendre compte plus ; nia ment sur kit. */
  function world(): State {
    const st = new State();
    st.definePractices([
      prac('vault', ['R'], [
        observable(
          together(),
          'took.Actor.gem',
          action('[Actor]: take the gem', [matches('at.Actor!yard'), matches('gem.here')], [del('gem.here'), insert('holding.Actor.gem')]),
        ),
        gossip(together(), [], 'took.Culprit.gem', '[Actor]: tell [Hearer] that [Culprit] took the gem'),
        rawLie(),
      ]),
    ]);
    st.setCharacters([
      ch('sid', [want([matches('holding.sid.gem')], 5), conceal('took.sid.gem', 8)]),
      ch('nia', [want([matches('W.believes.took.kit.gem')], 4)]),
      ch('oz'),
      ch('kit'),
      ch('mia'),
    ]);
    performAll(st, [
      insert('practice.vault.here'),
      insert('at.sid!yard'),
      insert('at.nia!yard'),
      insert('at.oz!yard'),
      insert('at.kit!yard'),
      insert('at.mia!shed'),
      insert('gem.here'),
    ]);
    return st;
  }

  /** Le monde dédié au mensonge sur un MOBILE (désir « revenge »). */
  function motiveLieWorld(): State {
    const st = new State();
    st.definePractices([
      prac('rumor', ['R'], [
        lie(together(), [], [matches('at.Culprit!Anywhere')], 'desires.Culprit.revenge', '[Actor]: whisper to [Hearer] that [Culprit] wants revenge'),
      ]),
    ]);
    st.setCharacters(['nia', 'oz', 'kit'].map((n) => ch(n)));
    st.setDesires([desire('revenge', want([matches('harms.Owner')], 10))]);
    performAll(st, [insert('practice.rumor.here'), insert('at.nia!yard'), insert('at.oz!yard'), insert('at.kit!yard')]);
    return st;
  }

  // R: deceit.rs conceal_is_the_nobody_believes_want
  // H: DeceitSpec.hs "conceal is the nobody-believes want"
  test('conceal_is_the_nobody_believes_want', () => {
    assert.deepEqual(conceal('took.sid.gem', 8), want([absent([matches('Anyone.believes.took.sid.gem')])], 8));
  });

  // R: deceit.rs conceal_rejects_a_variable_bearing_event_loudly
  // H: DeceitSpec.hs "conceal rejects a variable-bearing event loudly"
  test('conceal_rejects_a_variable_bearing_event_loudly', () => {
    throwsKind(() => conceal('took.Who.gem', 8), 'PatternVariables', 'variables in a secret are an error');
  });

  // R: deceit.rs a_concealer_waits_for_privacy_then_acts
  // H: DeceitSpec.hs "a concealer waits for privacy, then acts, and no one knows"
  test('a_concealer_waits_for_privacy_then_acts', () => {
    const st = world();
    const sid = member(st, 'sid');
    assert.notEqual(picked(st, 2, sid), 'sid: take the gem', 'watched: sid does not take the gem');
    performAll(st, [insert('at.nia!shed'), insert('at.oz!shed'), insert('at.kit!shed')]);
    assert.equal(picked(st, 2, sid), 'sid: take the gem');
    doAct('sid', 'take the gem', st);
    assert.ok(st.dbHas('holding.sid.gem'), 'took it');
    for (const w of ['nia', 'oz', 'kit', 'mia']) assert.ok(!st.dbHas(`${w}.believes.took.sid.gem`), `and nobody believes it (${w})`);
  });

  // R: deceit.rs a_lie_plants_sourced_hearsay_the_liar_never_had_evidence_for
  // H: DeceitSpec.hs "a lie plants sourced hearsay the liar never had evidence for"
  test('a_lie_plants_sourced_hearsay_the_liar_never_had_evidence_for', () => {
    const st = world();
    doAct('nia', 'whisper to oz that kit took the gem', st);
    assert.ok(st.dbHas('oz.believes.took.kit.gem.heard.nia'), 'oz heard it from nia');
    assert.ok(!st.dbHas('nia.believes.took.kit.gem'), 'nia still has no evidence of her own');
  });

  // R: deceit.rs hearing_your_own_lie_back_turns_it_into_gossip
  // H: DeceitSpec.hs "hearing your own lie back turns it into gossip"
  test('hearing_your_own_lie_back_turns_it_into_gossip', () => {
    const st = world();
    doAct('nia', 'whisper to oz that kit took the gem', st);
    doAct('oz', 'tell nia that kit took the gem', st);
    assert.ok(st.dbHas('nia.believes.took.kit.gem.heard.oz'), 'nia now holds (fabricated) evidence');
    assert.ok(
      !offered('nia', 'whisper to oz that kit', st) && !st.possibleActions('nia').some((ga) => ga.label.includes('whisper') && ga.label.includes('kit took')),
      'the lie action is gone (its no-evidence gate closed)',
    );
    assert.ok(
      offered('nia', 'tell oz that kit took', st) || offered('nia', 'tell mia that kit took', st) || offered('nia', 'tell sid that kit took', st),
      'plain gossip appears in its place',
    );
  });

  // R: deceit.rs you_cannot_frame_yourself
  // H: DeceitSpec.hs "you cannot frame yourself (a lie about yourself is a confession)"
  test('you_cannot_frame_yourself', () => {
    const st = world();
    assert.ok(!st.possibleActions('nia').some((ga) => ga.label.includes('whisper') && ga.label.includes('nia took')), 'no whisper names the whisperer');
  });

  // R: deceit.rs the_subject_of_the_lie_is_never_the_hearer
  // H: DeceitSpec.hs "the subject of the lie is never the hearer"
  test('the_subject_of_the_lie_is_never_the_hearer', () => {
    const st = world();
    assert.ok(!st.possibleActions('nia').some((ga) => ga.label.includes('whisper to kit that kit')), 'no whispering to kit about kit');
  });

  // R: deceit.rs lying_to_the_same_hearer_twice_is_not_offered
  // H: DeceitSpec.hs "lying to the same hearer twice is not offered"
  test('lying_to_the_same_hearer_twice_is_not_offered', () => {
    const st = world();
    doAct('nia', 'whisper to oz that kit took the gem', st);
    assert.ok(!offered('nia', 'whisper to oz that kit', st), 'one-shot per hearer');
  });

  // R: deceit.rs a_subject_less_pattern_errors_loudly
  // H: DeceitSpec.hs "a subject-less pattern errors loudly"
  test('a_subject_less_pattern_errors_loudly', () => {
    throwsKind(() => lie(together(), [], [], 'somethinghappened', '[Actor]: mention it to [Hearer]'), 'PatternVariables', 'a lie must be about someone');
  });

  // R: deceit.rs a_lie_can_fabricate_a_motive
  // H: DeceitSpec.hs "a lie can fabricate a MOTIVE: desires.* patterns work like deed patterns"
  test('a_lie_can_fabricate_a_motive', () => {
    const st = motiveLieWorld();
    assert.ok(!offered('nia', 'whisper to kit that kit wants', st), 'kit is never offered as hearer (subject cannot be hearer)');
    doAct('nia', 'whisper to oz that kit wants revenge', st);
    assert.ok(st.dbHas('oz.believes.desires.kit.revenge.heard.nia'), 'oz believes kit desires revenge (heard from nia)');
    assert.ok(!st.dbHas('nia.believes.desires.kit.revenge'), 'nia keeps no evidence of her own motive claim');
  });

  // R: deceit.rs a_lie_marks_the_liars_own_memory
  // H: DeceitSpec.hs "a lie marks the liar's own memory (marks, not records)"
  test('a_lie_marks_the_liars_own_memory', () => {
    const st = world();
    doAct('nia', 'whisper to oz that kit took the gem', st);
    assert.ok(st.dbHas('nia.lied.oz.took.kit.gem'), 'nia carries the mark of her own lie');
    assert.ok(!st.dbHas('oz.lied'), 'the deceived carry no such mark');
    st.performOutcome(del('nia.lied'));
    assert.ok(!st.dbHas('nia.lied'), 'forgetting clears it');
  });

  // R: deceit.rs a_gate_authoring_the_prax_namespace_is_rejected
  // H: DeceitSpec.hs "v43: the missing namespace guard (previously latent: an authored gate, fabrication, or event pattern had no guard at all)"
  // H: DeceitSpec.hs "a gate authoring the Prax namespace is a loud construction-time error"
  test('a_gate_authoring_the_prax_namespace_is_rejected', () => {
    throwsKind(
      () => lie(together(), [not_('flag.PraxD')], [matches('at.Culprit!Anywhere')], 'took.Culprit.gem', '[Actor]: whisper to [Hearer] that [Culprit] took the gem'),
      'ReservedVarClash',
      'the Prax namespace in the gate is rejected',
    );
  });

  // R: deceit.rs a_fabrication_authoring_the_prax_namespace_is_rejected
  // H: DeceitSpec.hs "the fabrication conditions authoring the Prax namespace is a loud construction-time error"
  test('a_fabrication_authoring_the_prax_namespace_is_rejected', () => {
    throwsKind(
      () => lie(together(), [], [matches('at.Culprit!PraxAnywhere')], 'took.Culprit.gem', '[Actor]: whisper to [Hearer] that [Culprit] took the gem'),
      'ReservedVarClash',
      'the Prax namespace in fabrication is rejected',
    );
  });

  // R: deceit.rs an_event_pattern_authoring_the_prax_namespace_is_rejected
  // H: DeceitSpec.hs "an event pattern authoring the Prax namespace is a loud construction-time error"
  test('an_event_pattern_authoring_the_prax_namespace_is_rejected', () => {
    throwsKind(
      () => lie(together(), [], [matches('at.Culprit!Anywhere')], 'took.PraxCulprit.gem', '[Actor]: whisper to [Hearer] that [Culprit] took the gem'),
      'ReservedVarClash',
      'the Prax namespace in the event pattern is rejected',
    );
  });

  // R: deceit.rs the_shipped_lie_fixture_is_not_rejected
  // H: DeceitSpec.hs "the shipped lie fixture (an ordinary gate, fabrication, and pattern) is not rejected"
  test('the_shipped_lie_fixture_is_not_rejected', () => {
    assert.doesNotThrow(
      () => lie(together(), [], [matches('at.Culprit!Anywhere')], 'took.Culprit.gem', '[Actor]: whisper to [Hearer] that [Culprit] took the gem'),
      'the legal shape is not rejected',
    );
  });

  // R: deceit.rs truthful_gossip_leaves_no_lie_mark
  // H: DeceitSpec.hs "truthful gossip leaves no lie-mark"
  test('truthful_gossip_leaves_no_lie_mark', () => {
    const st = world();
    doAct('sid', 'take the gem', st);
    st.performOutcome(insert('at.mia!yard'));
    doAct('oz', 'tell mia that sid took the gem', st);
    assert.ok(st.dbHas('mia.believes.took.sid.gem.heard.oz'), 'mia holds the hearsay');
    assert.ok(!st.dbHas('oz.lied'), 'an honest telling marks nothing');
  });
});

// =====================================================================================
// rumor.rs — H: RumorSpec.hs "Prax.Rumor"
// =====================================================================================

describe('rumor', () => {
  const tell = (): Action => gossip(together(), [not_('grudge.Actor.Hearer')], 'tripped.Klutz', '[Actor]: tell [Hearer] that [Klutz] tripped');

  /** tess a trébuché ; sam et rita l'ont vu ; hana et pip ne savent rien. */
  function world(): State {
    const st = new State();
    st.definePractices([prac('yard', ['R'], [tell()])]);
    st.setCharacters(['sam', 'rita', 'hana', 'tess', 'pip'].map((n) => ch(n)));
    performAll(st, [
      insert('practice.yard.here'),
      insert('at.sam!yard'),
      insert('at.rita!yard'),
      insert('at.hana!yard'),
      insert('at.tess!yard'),
      insert('at.pip!yard'),
      insert('sam.believes.tripped.tess.seen'),
      insert('rita.believes.tripped.tess.seen'),
    ]);
    return st;
  }

  function tellTo(teller: string, hearer: string, st: State): void {
    const needle = `tell ${hearer}`;
    const found = st.possibleActions(teller).find((ga) => ga.label.includes(needle));
    if (found === undefined) throw new Error(`no tell to ${hearer} offered to ${teller}; had: ${JSON.stringify(labels(st, teller))}`);
    st.performAction(found);
  }

  const offers = (teller: string, hearer: string, st: State): boolean => st.possibleActions(teller).some((ga) => ga.label.includes(`tell ${hearer}`));

  // R: rumor.rs telling_plants_hearsay_with_the_teller_as_source
  // H: RumorSpec.hs "telling plants hearsay with the teller as source"
  test('telling_plants_hearsay_with_the_teller_as_source', () => {
    const st = world();
    tellTo('sam', 'hana', st);
    assert.ok(st.dbHas('hana.believes.tripped.tess.heard.sam'), 'hana heard it from sam');
  });

  // R: rumor.rs the_subject_of_the_rumor_is_never_offered_as_hearer
  // H: RumorSpec.hs "the subject of the rumor is never offered as hearer"
  test('the_subject_of_the_rumor_is_never_offered_as_hearer', () => {
    const st = world();
    assert.ok(!offers('sam', 'tess', st), 'no telling tess about tess');
  });

  // R: rumor.rs only_the_first_variable_is_the_subject
  // H: RumorSpec.hs "in a multi-variable pattern only the FIRST variable is the subject"
  test('only_the_first_variable_is_the_subject', () => {
    const lent = gossip(together(), [], 'borrowed.Borrower.Item', '[Actor]: tell [Hearer] that [Borrower] borrowed the [Item]');
    const st = new State();
    st.definePractices([prac('yard2', ['R'], [lent])]);
    st.setCharacters(['sam', 'hana', 'tess', 'pip'].map((n) => ch(n)));
    performAll(st, [
      insert('practice.yard2.here'),
      insert('at.sam!yard2'),
      insert('at.hana!yard2'),
      insert('at.tess!yard2'),
      insert('at.pip!yard2'),
      // tess a emprunté pip(!)
      insert('sam.believes.borrowed.tess.pip.seen'),
    ]);
    assert.ok(!st.possibleActions('sam').some((ga) => ga.label.includes('tell tess')), 'tess (first variable: the subject) is excluded as hearer');
    assert.ok(st.possibleActions('sam').some((ga) => ga.label.includes('tell pip')), 'pip (second variable: not the subject) may be told');
  });

  // R: rumor.rs a_hearer_who_saw_the_event_is_not_told
  // H: RumorSpec.hs "a hearer who saw the event is not told (no news value)"
  test('a_hearer_who_saw_the_event_is_not_told', () => {
    const st = world();
    assert.ok(!offers('sam', 'rita', st), 'sam not offered telling rita (an eyewitness)');
  });

  // R: rumor.rs retelling_to_the_same_hearer_is_not_offered
  // H: RumorSpec.hs "retelling to the same hearer is not offered (one-shot per teller)"
  test('retelling_to_the_same_hearer_is_not_offered', () => {
    const st = world();
    tellTo('sam', 'hana', st);
    assert.ok(!offers('sam', 'hana', st), 'sam cannot retell hana');
  });

  // R: rumor.rs a_second_teller_adds_a_second_heard_edge
  // H: RumorSpec.hs "a second teller adds a second heard edge (corroboration)"
  test('a_second_teller_adds_a_second_heard_edge', () => {
    const st = world();
    tellTo('sam', 'hana', st);
    tellTo('rita', 'hana', st);
    assert.ok(st.dbHas('hana.believes.tripped.tess.heard.sam'), 'heard from sam');
    assert.ok(st.dbHas('hana.believes.tripped.tess.heard.rita'), 'heard from rita');
  });

  // R: rumor.rs hearsay_can_be_retold
  // H: RumorSpec.hs "hearsay can be retold (rumor chains)"
  test('hearsay_can_be_retold', () => {
    const st = world();
    tellTo('sam', 'hana', st);
    tellTo('hana', 'pip', st);
    assert.ok(st.dbHas('pip.believes.tripped.tess.heard.hana'), 'pip heard it from hana');
  });

  // R: rumor.rs no_evidence_nothing_to_tell
  // H: RumorSpec.hs "no evidence, nothing to tell"
  test('no_evidence_nothing_to_tell', () => {
    const st = world();
    assert.ok(!st.possibleActions('hana').some((ga) => ga.label.includes('tell')), 'hana (who knows nothing yet) offers no tells');
  });

  // R: rumor.rs the_worlds_gate_closes_the_channel
  // H: RumorSpec.hs "the world's gate closes the channel"
  test('the_worlds_gate_closes_the_channel', () => {
    const st = world();
    st.performOutcome(insert('grudge.sam.hana'));
    assert.ok(!offers('sam', 'hana', st), "sam won't gossip with hana");
    assert.ok(offers('rita', 'hana', st), 'but rita still will');
  });

  // R: rumor.rs heard_is_a_boolean_exists
  // H: RumorSpec.hs "heard is a boolean exists (no per-source bindings leak)"
  test('heard_is_a_boolean_exists', () => {
    assert.deepEqual(heard('W', 'tripped.tess'), exists([matches('W.believes.tripped.tess.heard.Src')]));
  });

  // R: rumor.rs a_pattern_with_no_variable_errors_loudly
  // H: RumorSpec.hs "a pattern with no variable errors loudly"
  test('a_pattern_with_no_variable_errors_loudly', () => {
    throwsKind(() => gossip(together(), [], 'somethinghappened', '[Actor]: mention it to [Hearer]'), 'PatternVariables', 'gossip on a subject-less pattern is an error');
  });

  // R: rumor.rs a_gate_authoring_the_prax_namespace_is_rejected
  // H: RumorSpec.hs "v43: the missing namespace guard (previously latent: an authored gate or event pattern had no guard at all)"
  // H: RumorSpec.hs "a gate authoring the Prax namespace is a loud construction-time error"
  test('a_gate_authoring_the_prax_namespace_is_rejected', () => {
    throwsKind(
      () => gossip(together(), [not_('flag.PraxD')], 'tripped.Klutz', '[Actor]: tell [Hearer] that [Klutz] tripped'),
      'ReservedVarClash',
      'the Prax namespace in the gate is rejected',
    );
  });

  // R: rumor.rs an_event_pattern_authoring_the_prax_namespace_is_rejected
  // H: RumorSpec.hs "an event pattern authoring the Prax namespace is a loud construction-time error"
  test('an_event_pattern_authoring_the_prax_namespace_is_rejected', () => {
    throwsKind(
      () => gossip(together(), [], 'tripped.PraxWho', '[Actor]: tell [Hearer] that [Klutz] tripped'),
      'ReservedVarClash',
      'the Prax namespace in the event pattern is rejected',
    );
  });

  // R: rumor.rs the_shipped_tell_fixture_is_not_rejected
  // H: RumorSpec.hs "the shipped tell fixture (an ordinary gate and pattern) is not rejected"
  test('the_shipped_tell_fixture_is_not_rejected', () => {
    assert.doesNotThrow(
      () => gossip(together(), [not_('grudge.Actor.Hearer')], 'tripped.Klutz', '[Actor]: tell [Hearer] that [Klutz] tripped'),
      'the legal shape is not rejected',
    );
  });
});

// =====================================================================================
// faction.rs — H: FactionSpec.hs "Prax.Faction"
// =====================================================================================

describe('faction', () => {
  /** Deux maisons : hall (ana, ben) et yard (cass), sous `comrades`. */
  function houses(): State {
    const st = new State();
    performAll(st, [joins('ana', 'hall'), joins('ben', 'hall'), joins('cass', 'yard')]);
    st.setAxioms([comrades()]);
    return st;
  }

  /** Un monde sous un seul axiome `factionStanding`. */
  function standingWorld(memberships: ReadonlyArray<readonly [string, string]>, facts: readonly string[]): State {
    const st = new State();
    for (const [who, faction] of memberships) st.performOutcome(joins(who, faction));
    for (const f of facts) st.performOutcome(insert(f));
    st.setAxioms([factionStanding('struck.A.V', 'brutal')]);
    return st;
  }

  // R: faction.rs member_path_is_a_single_slot_exclusion_fact
  // H: FactionSpec.hs "memberPath: single-slot exclusion fact"
  test('member_path_is_a_single_slot_exclusion_fact', () => {
    assert.equal(memberPath('ana', 'hall'), 'member.ana!hall', 'the ! separates who from faction');
  });

  // R: faction.rs comrades_derives_allied_both_directions
  // H: FactionSpec.hs "comrades: shared membership derives allied, both directions"
  test('comrades_derives_allied_both_directions', () => {
    const st = houses();
    assert.ok(st.viewHas('allied.ana.ben'), 'ana allied ben');
    assert.ok(st.viewHas('allied.ben.ana'), 'ben allied ana');
  });

  // R: faction.rs comrades_neq_guard_forbids_self_alliance
  // H: FactionSpec.hs "comrades: X<>Y guard — no self-alliance"
  test('comrades_neq_guard_forbids_self_alliance', () => {
    const st = houses();
    assert.ok(!st.viewHas('allied.ana.ana'), 'ana is not allied with herself');
  });

  // R: faction.rs comrades_derives_nothing_across_factions
  // H: FactionSpec.hs "comrades: cross-faction negative — no shared house, no alliance"
  test('comrades_derives_nothing_across_factions', () => {
    const st = houses();
    assert.ok(!st.viewHas('allied.ana.cass'), 'ana (hall) not allied with cass (yard)');
    assert.ok(!st.viewHas('allied.cass.ana'), 'cass (yard) not allied with ana (hall)');
  });

  // R: faction.rs defection_un_derives_the_old_alliances
  // H: FactionSpec.hs "defection un-derives: joining a new faction overwrites the old, retracting stale allied pairs"
  test('defection_un_derives_the_old_alliances', () => {
    const moved = houses();
    moved.performOutcome(joins('ana', 'yard'));
    assert.ok(!moved.viewHas('allied.ana.ben'), 'ana no longer allied with ben (old house)');
    assert.ok(!moved.viewHas('allied.ben.ana'), 'ben no longer allied with ana (old house)');
    assert.ok(moved.viewHas('allied.ana.cass'), 'ana is now allied with cass (new house)');
    assert.ok(moved.viewHas('allied.cass.ana'), 'cass is now allied with ana (new house)');
    assert.ok(!moved.dbHas('member.ana!hall'), "ana's old membership is gone from the base");
    assert.ok(moved.dbHas('member.ana!yard'), "ana's new membership is the sole base fact");
  });

  // R: faction.rs faction_standing_needs_a_belief
  // H: FactionSpec.hs "factionStanding: an unbelieved offense moves no one"
  test('faction_standing_needs_a_belief', () => {
    const st = standingWorld(
      [
        ['ana', 'hall'],
        ['ben', 'hall'],
        ['dave', 'hall'],
        ['cass', 'yard'],
      ],
      [],
    );
    for (const s of ['regards.ben.ana.brutal', 'regards.dave.ana.brutal', 'regards.cass.ana.brutal'])
      assert.ok(!st.viewHas(s), `no one regards ana as brutal (no belief asserted): ${s}`);
  });

  // R: faction.rs faction_standing_moves_co_members_only
  // H: FactionSpec.hs "factionStanding: a believed offense moves co-members only"
  test('faction_standing_moves_co_members_only', () => {
    const st = standingWorld(
      [
        ['ana', 'hall'],
        ['ben', 'hall'],
        ['dave', 'hall'],
        ['cass', 'yard'],
      ],
      ['dave.believes.struck.ana.ben', 'cass.believes.struck.ana.ben', 'ana.believes.struck.ana.ben'],
    );
    assert.ok(st.viewHas('regards.dave.ana.brutal'), "dave (co-member of victim ben's faction) regards ana as brutal");
    assert.ok(!st.viewHas('regards.cass.ana.brutal'), 'cass (a different faction) believes it too but derives nothing');
    assert.ok(!st.viewHas('regards.ana.ana.brutal'), 'ana (the offender) derives no self-regard, even believing her own act');
  });

  // R: faction.rs faction_standing_covers_the_victims_own_belief
  // H: FactionSpec.hs "factionStanding: the victim's own belief of the offense against them derives their regard too"
  test('faction_standing_covers_the_victims_own_belief', () => {
    const st = standingWorld(
      [
        ['ana', 'hall'],
        ['ben', 'hall'],
      ],
      ['ben.believes.struck.ana.ben'],
    );
    assert.ok(st.viewHas('regards.ben.ana.brutal'), 'ben (the victim, a co-member of himself trivially) regards ana as brutal');
  });

  // R: faction.rs faction_standing_dissolves_on_defection
  // H: FactionSpec.hs "factionStanding: defection dissolves the regard (retraction's sharpest case)"
  test('faction_standing_dissolves_on_defection', () => {
    const held = standingWorld(
      [
        ['ana', 'hall'],
        ['ben', 'hall'],
        ['dave', 'hall'],
      ],
      ['dave.believes.struck.ana.ben'],
    );
    assert.ok(held.viewHas('regards.dave.ana.brutal'), 'co-membered: dave regards ana');
    const defected = held; // le Rust DÉPLACE l'état (`let mut defected = held;`)
    defected.performOutcome(joins('dave', 'yard'));
    assert.ok(!defected.viewHas('regards.dave.ana.brutal'), 'defected: the regard un-derives');
    assert.ok(defected.dbHas('dave.believes.struck.ana.ben'), 'his belief persists — only the solidarity is gone');
  });

  // R: faction.rs member_path_rejects_empty_and_separator_bearing_names
  // H: FactionSpec.hs "memberPath: an empty or separator-bearing name errors loudly"
  test('member_path_rejects_empty_and_separator_bearing_names', () => {
    for (const [who, faction] of [
      ['', 'hall'],
      ['a.b', 'hall'],
      ['ana', 'ha!ll'],
    ] as const)
      throwsKind(() => memberPath(who, faction), 'NotASinglePathSegment', `memberPath ${JSON.stringify(who)} ${JSON.stringify(faction)} must be a loud rejection`);
  });

  // R: faction.rs faction_standing_needs_two_variables
  // H: FactionSpec.hs "factionStanding: a pattern naming fewer than two variables errors loudly"
  test('faction_standing_needs_two_variables', () => {
    throwsKind(
      () => factionStanding('struck.A.constant', 'brutal'),
      'PatternVariables',
      'an offender-only pattern is an error, not a silent single-variable guard',
    );
  });

  // R: faction.rs faction_standing_leaves_w_and_f_to_the_author
  // H: FactionSpec.hs "factionStanding: the usability win -- W and F are ordinary variables now (v40 moved the axiom's own join variables to the Prax namespace)"
  test('faction_standing_leaves_w_and_f_to_the_author', () => {
    assert.doesNotThrow(() => factionStanding('struck.W.V', 'brutal'), 'an offender named W no longer collides with anything');
    assert.doesNotThrow(() => factionStanding('struck.A.F', 'brutal'), 'a victim named F no longer collides with anything');
  });

  // R: faction.rs faction_standing_rejects_the_prax_namespace
  // H: FactionSpec.hs "factionStanding: a pattern authoring the Prax namespace errors loudly"
  test('faction_standing_rejects_the_prax_namespace', () => {
    throwsKind(
      () => factionStanding('struck.PraxW.V', 'brutal'),
      'ReservedVarClash',
      "an offender named PraxW collides with the axiom's own (now-namespaced) believer variable",
    );
  });

  // R: faction.rs faction_standing_rejects_a_trailing_operator_pattern
  test('faction_standing_rejects_a_trailing_operator_pattern', () => {
    for (const pat of ['struck.A.V.', 'struck.A.V!'])
      throwsKind(() => factionStanding(pat, 'brutal'), 'TrailingOperator', `factionStanding(${JSON.stringify(pat)}) must be rejected as loudly as the frozen pathNames/tokens rejects it`);
    // …et la garde du tokeniseur passe AVANT la garde d'arité.
    throwsKind(
      () => factionStanding('struck.A.', 'brutal'),
      'TrailingOperator',
      'the tokenizer guard precedes the arity guard, as it does in the frozen case scrutinee',
    );
  });
});

// =====================================================================================
// repute.rs — H: ReputeSpec.hs "Prax.Repute"
// =====================================================================================

describe('repute', () => {
  /** kai est cru (diversement) avoir frappé le chien. */
  function world(): State {
    const st = new State();
    st.definePractices([
      prac('yard', ['R'], [action('[Actor]: scowl at [B]', [regardedAs('Actor', 'B', 'brute'), not_('scowled.Actor.B')], [insert('scowled.Actor.B')])]),
    ]);
    st.setCharacters(['ana', 'ben', 'kai'].map((n) => ch(n)));
    performAll(st, [insert('practice.yard.here'), insert('ana.believes.kicked.kai.dog.seen'), insert('ben.believes.kicked.kai.dog.heard.ana')]);
    st.setAxioms([standingUnless('kicked.Brute.dog', 'forgiven.Brute', 'brute'), notoriety('brute', 2)]);
    return st;
  }

  // R: repute.rs evidence_derives_per_observer_standing
  // H: ReputeSpec.hs "evidence derives per-observer standing (seen and heard alike)"
  test('evidence_derives_per_observer_standing', () => {
    const st = world();
    assert.ok(st.viewHas('regards.ana.kai.brute'), 'ana (eyewitness) regards kai a brute');
    assert.ok(st.viewHas('regards.ben.kai.brute'), 'ben (hearsay) regards kai a brute');
    assert.ok(!st.viewHas('regards.kai.kai.brute'), 'kai holds no self-regard');
  });

  // R: repute.rs notoriety_holds_at_the_threshold_not_below
  // H: ReputeSpec.hs "notoriety holds at the threshold, not below"
  test('notoriety_holds_at_the_threshold_not_below', () => {
    const st = world();
    assert.ok(st.viewHas('notorious.kai.brute'), 'two regarders: notorious');
    st.performOutcome(del('ben.believes.kicked.kai.dog'));
    assert.ok(!st.viewHas('notorious.kai.brute'), 'one regarder: not notorious');
    assert.ok(!st.viewHas('regards.ben.kai.brute'), "and ben's regard dissolved with his evidence");
  });

  // R: repute.rs the_defeater_dissolves_standing_while_memory_persists
  // H: ReputeSpec.hs "the defeater dissolves standing while memory persists"
  test('the_defeater_dissolves_standing_while_memory_persists', () => {
    const st = world();
    st.performOutcome(insert('forgiven.kai'));
    assert.ok(!st.viewHas('regards.ana.kai.brute'), 'no regard survives forgiveness');
    assert.ok(!st.viewHas('notorious.kai.brute'), 'no notoriety survives');
    assert.ok(st.dbHas('ana.believes.kicked.kai.dog.seen'), 'ana still remembers what she saw');
  });

  // R: repute.rs a_derived_standing_gated_affordance_appears_and_disappears
  // H: ReputeSpec.hs "a derived-standing-gated affordance appears and disappears"
  test('a_derived_standing_gated_affordance_appears_and_disappears', () => {
    const st = world();
    assert.ok(st.possibleActions('ana').some((ga) => ga.label.includes('scowl at kai')), 'ana may scowl at kai');
    st.performOutcome(insert('forgiven.kai'));
    assert.ok(!st.possibleActions('ana').some((ga) => ga.label.includes('scowl at kai')), 'forgiven: the scowl is gone');
  });

  // R: repute.rs regarded_as_is_the_standing_condition
  // H: ReputeSpec.hs "regardedAs is the standing condition"
  test('regarded_as_is_the_standing_condition', () => {
    assert.deepEqual(regardedAs('W', 'kai', 'brute'), matches('regards.W.kai.brute'));
  });

  // R: repute.rs the_deed_patterns_first_variable_is_the_subject
  // H: ReputeSpec.hs "the deed pattern's FIRST variable is the subject"
  test('the_deed_patterns_first_variable_is_the_subject', () => {
    assert.deepEqual(standing('sold.Seller.Buyer.secret', 'snitch').then, ['regards.Regarder.Seller.snitch']);
  });

  // R: repute.rs a_deed_pattern_with_no_variable_errors_loudly
  // H: ReputeSpec.hs "a deed pattern with no variable errors loudly"
  test('a_deed_pattern_with_no_variable_errors_loudly', () => {
    throwsKind(() => standing('somethinghappened', 'x'), 'PatternVariables', 'standing on a subject-less pattern is an error');
  });

  // R: repute.rs a_defeater_variable_outside_the_deed_pattern_errors_loudly
  // H: ReputeSpec.hs "a defeater variable outside the deed pattern errors loudly"
  test('a_defeater_variable_outside_the_deed_pattern_errors_loudly', () => {
    throwsKind(
      () => standingUnless('stole.Culprit.loaf', 'atoned.Someone', 'thief'),
      'PatternVariables',
      'mis-scoped defeater is an error, not a silent global amnesty',
    );
  });

  // R: repute.rs a_deed_pattern_authoring_regarder_errors_loudly
  // H: ReputeSpec.hs "standing: a deed pattern authoring Regarder (the axiom's own observer variable) errors loudly"
  test('a_deed_pattern_authoring_regarder_errors_loudly', () => {
    throwsKind(() => standing('kicked.Regarder.dog', 'brute'), 'ReservedVarClash', "Regarder is reserved -- the axiom's own observer join variable");
  });

  // R: repute.rs a_deed_pattern_authoring_the_prax_namespace_errors_loudly
  // H: ReputeSpec.hs "standing: a deed pattern authoring the Prax namespace errors loudly"
  test('a_deed_pattern_authoring_the_prax_namespace_errors_loudly', () => {
    throwsKind(() => standing('kicked.PraxX.dog', 'brute'), 'ReservedVarClash', 'the Prax namespace is reserved');
  });

  // R: repute.rs standing_unless_reserves_regarder_through_the_same_guard
  // H: ReputeSpec.hs "standingUnless: Regarder is reserved through the same guard (both entry points funnel through it)"
  test('standing_unless_reserves_regarder_through_the_same_guard', () => {
    throwsKind(() => standingUnless('stole.Regarder.loaf', 'atoned.Regarder', 'thief'), 'ReservedVarClash', 'Regarder is reserved for standingUnless too');
  });
});

// =====================================================================================
// debt.rs — H: DebtSpec.hs "Prax.Debt"
// =====================================================================================

describe('debt', () => {
  /** cora prête une faveur à dell ; quand dell fait défaut, cora la réclame (co-présente). */
  const demand = (): Action =>
    observable(
      together(),
      'violated.dell.defaulted',
      action(
        '[Actor]: demand dell repay the favor',
        [owes('Actor', 'dell', 'favor'), matches('at.Actor!P'), matches('at.dell!P'), not_('demanded.Actor.dell.favor')],
        [insert('demanded.Actor.dell.favor'), breach('dell', 'defaulted')],
      ),
    );

  function repay(): Action {
    const then = [...settle('cora', 'dell', 'favor'), insert('atoned.dell'), del('violated.dell.defaulted')];
    return action('[Actor]: dell repays cora the favor', [eq('Actor', 'dell'), owes('cora', 'Actor', 'favor')], then);
  }

  const debtPractice = (): Practice => prac('debt', ['R'], [demand(), repay()]);

  /** `witnessPresent` : ren partage la place de cora et dell (sinon il est au moulin). */
  function mkWorld(witnessPresent: boolean): State {
    const st = new State();
    st.definePractices([debtPractice()]);
    st.setCharacters(['cora', 'dell', 'ren'].map((n) => ch(n)));
    performAll(st, [
      insert('practice.debt.here'),
      ...owe('cora', 'dell', 'favor'),
      insert('at.cora!square'),
      insert('at.dell!square'),
      insert(`at.ren!${witnessPresent ? 'square' : 'mill'}`),
    ]);
    st.setAxioms([standingUnless('violated.Debtor.defaulted', 'atoned.Debtor', 'deadbeat')]);
    return st;
  }

  // R: debt.rs debt_path_is_debt_creditor_debtor_content
  // H: DebtSpec.hs "fact conventions"
  // H: DebtSpec.hs "debtPath is debt.<creditor>.<debtor>.<content>"
  test('debt_path_is_debt_creditor_debtor_content', () => {
    assert.equal(debtPath('cora', 'dell', 'favor'), 'debt.cora.dell.favor');
  });

  // R: debt.rs owes_matches_the_debt_fact
  // H: DebtSpec.hs "owes matches the debt fact"
  test('owes_matches_the_debt_fact', () => {
    assert.deepEqual(owes('cora', 'dell', 'favor'), matches('debt.cora.dell.favor'));
  });

  // R: debt.rs owe_asserts_the_debt_fact_and_deontics_oblige
  // H: DebtSpec.hs "owe asserts the debt fact and Deontic's oblige, in one call"
  test('owe_asserts_the_debt_fact_and_deontics_oblige', () => {
    assert.deepEqual(owe('cora', 'dell', 'favor'), [insert('debt.cora.dell.favor'), oblige('dell', 'favor')]);
  });

  // R: debt.rs settle_retracts_the_debt_fact_and_deontics_discharge
  // H: DebtSpec.hs "settle retracts the debt fact and Deontic's discharge"
  test('settle_retracts_the_debt_fact_and_deontics_discharge', () => {
    assert.deepEqual(settle('cora', 'dell', 'favor'), [del('debt.cora.dell.favor'), discharge('dell', 'favor')]);
  });

  // R: debt.rs owe_inserts_both_facts_and_settle_removes_both
  // H: DebtSpec.hs "lifecycle: owe creates BOTH facts; settle removes BOTH"
  // H: DebtSpec.hs "owe inserts the debt fact and the obligation; settle removes both"
  test('owe_inserts_both_facts_and_settle_removes_both', () => {
    const content = 'repaid.dell.cora.coin';
    const st = new State();
    performAll(st, owe('cora', 'dell', content));
    assert.ok(st.dbHas('debt.cora.dell.repaid.dell.cora.coin'), 'debt fact');
    assert.ok(st.dbHas(obligationPath('dell', content)), 'obligation fact');
    performAll(st, settle('cora', 'dell', content));
    assert.ok(!st.dbHas('debt.cora.dell.repaid.dell.cora.coin'), 'debt fact gone');
    assert.ok(!st.dbHas(obligationPath('dell', content)), 'obligation gone');
  });

  // R: debt.rs a_dotted_creditor_name_errors_loudly
  // H: DebtSpec.hs "guards"
  // H: DebtSpec.hs "a dotted creditor name errors loudly"
  test('a_dotted_creditor_name_errors_loudly', () => {
    const e = throwsKind(() => debtPath('cor.a', 'dell', 'favor'), 'NotASinglePathSegment', 'a dotted creditor');
    assert.deepEqual(e.details, { context: 'Debt.debt_path', name: 'cor.a' });
  });

  // R: debt.rs a_punctuated_debtor_name_errors_loudly
  // H: DebtSpec.hs "a punctuated debtor name errors loudly"
  test('a_punctuated_debtor_name_errors_loudly', () => {
    const e = throwsKind(() => debtPath('cora', 'de!l', 'favor'), 'NotASinglePathSegment', 'a punctuated debtor');
    assert.deepEqual(e.details, { context: 'Debt.debt_path', name: 'de!l' });
  });

  // R: debt.rs an_unwitnessed_default_derives_no_third_party_regard
  // H: DebtSpec.hs "demand -> deadbeat: belief-gated standing, defeated by settling"
  // H: DebtSpec.hs "an unwitnessed default derives no third-party regard"
  test('an_unwitnessed_default_derives_no_third_party_regard', () => {
    const st = mkWorld(false);
    doAct('cora', 'demand', st);
    assert.ok(st.dbHas('violated.dell.defaulted'), 'the world records the breach');
    assert.ok(!st.dbHas('ren.believes.violated.dell.defaulted.seen'), 'ren, elsewhere, holds no belief of it');
    assert.ok(!st.viewHas('regards.ren.dell.deadbeat'), 'and so derives no THIRD-PARTY deadbeat regard');
    assert.ok(
      st.viewHas('regards.dell.dell.deadbeat'),
      'dell is unavoidably co-present at his own default, so he still witnesses (and regards) himself — belief-gating is per observer, not a blanket suppression',
    );
  });

  // R: debt.rs a_witnessed_default_derives_deadbeat_standing_for_the_witness
  // H: DebtSpec.hs "a witnessed default derives deadbeat standing for the witness"
  test('a_witnessed_default_derives_deadbeat_standing_for_the_witness', () => {
    const st = mkWorld(true);
    doAct('cora', 'demand', st);
    assert.ok(st.dbHas('ren.believes.violated.dell.defaulted.seen'), 'ren saw it');
    assert.ok(st.viewHas('regards.ren.dell.deadbeat'), 'ren regards dell a deadbeat');
  });

  // R: debt.rs settling_defeats_the_standing_but_the_witnesss_memory_persists
  // H: DebtSpec.hs "settling (atoned-shaped) defeats the standing; the witness's memory persists"
  test('settling_defeats_the_standing_but_the_witnesss_memory_persists', () => {
    const st = mkWorld(true);
    doAct('cora', 'demand', st);
    doAct('dell', 'repays', st);
    assert.ok(!st.dbHas('debt.cora.dell.favor'), 'settled: the debt is gone');
    assert.ok(!st.viewHas('regards.ren.dell.deadbeat'), 'no regard survives settling');
    assert.ok(st.dbHas('ren.believes.violated.dell.defaulted.seen'), 'ren still remembers the default');
  });
});

// =====================================================================================
// reactions.rs — H: ReactionsSpec.hs "Prax.Reactions"
// =====================================================================================

describe('reactions', () => {
  /** La pratique de désapprobation locale de la spec, atome pour atome. */
  const disapprovalFixture = (): Practice =>
    prac(
      'disapproval',
      ['Offender', 'Onlooker'],
      [
        action(
          '[Actor]: Disapprove of [Offender]',
          [eq('Actor', 'Onlooker')],
          [
            insert('Onlooker.disapprovedOf.Offender'),
            feelTowardFor(4, 'Onlooker', ANNOYED, 'Offender'),
            adjustScore('Onlooker', 'Offender', WARMTH, -20, 'brokeANorm'),
            endReaction('disapproval', ['Offender', 'Onlooker']),
          ],
        ),
        action(
          "[Actor]: Let [Offender]'s lapse slide",
          [eq('Actor', 'Onlooker')],
          [feelTowardFor(4, 'Onlooker', PLEASED, 'Offender'), endReaction('disapproval', ['Offender', 'Onlooker'])],
        ),
      ],
      '[Onlooker] saw [Offender] break a norm',
    );

  /** Une réaction dont la réponse fait naître une (désapprobation) de plus. */
  const chainerPractice = (): Practice =>
    prac(
      'chainer',
      ['A', 'B'],
      [action('[Actor]: React to [A]', [eq('Actor', 'B')], [spawnReaction('disapproval', ['A', 'B']), endReaction('chainer', ['A', 'B'])])],
      '[A] provoked [B]',
    );

  function base(): State {
    const st = new State();
    st.definePractices([disapprovalFixture()]);
    st.defineFunctions(coreFns());
    return st;
  }

  const act = (st: State, actor: string, needle: string): void => doAct(actor, needle, st);

  // R: reactions.rs reaction_path_builds_practice_id_parts
  // H: ReactionsSpec.hs "path helpers"
  // H: ReactionsSpec.hs "reactionPath builds practice.<id>.<parts>"
  test('reaction_path_builds_practice_id_parts', () => {
    assert.equal(reactionPath('settleUp', ['bex', 'ada']), 'practice.settleUp.bex.ada');
  });

  // R: reactions.rs violation_of_builds_the_expected_match
  // H: ReactionsSpec.hs "violationOf builds the expected match"
  test('violation_of_builds_the_expected_match', () => {
    assert.deepEqual(violationOf('bex', 'tipping'), matches('violated.bex.tipping'));
  });

  // R: reactions.rs spawning_offers_the_response_only_to_the_onlooker
  // H: ReactionsSpec.hs "disapproval reaction"
  // H: ReactionsSpec.hs "spawning offers the response only to the onlooker"
  test('spawning_offers_the_response_only_to_the_onlooker', () => {
    const st = base();
    st.performOutcome(spawnReaction('disapproval', ['bex', 'ada']));
    assert.ok(labels(st, 'ada').some((l) => l.includes('Disapprove of bex')), 'the onlooker can disapprove');
    assert.ok(!labels(st, 'bex').some((l) => l.includes('Disapprove')), 'the offender cannot');
  });

  // R: reactions.rs disapproving_cools_the_relationship_and_consumes_the_reaction
  // H: ReactionsSpec.hs "disapproving cools the relationship and consumes the reaction"
  test('disapproving_cools_the_relationship_and_consumes_the_reaction', () => {
    const st = base();
    st.performOutcome(spawnReaction('disapproval', ['bex', 'ada']));
    act(st, 'ada', 'Disapprove of bex');
    const fs = st.labeledFacts();
    assert.ok(fs.includes('ada.feels.annoyed.toward.bex'), `ada is annoyed at bex, got ${JSON.stringify(fs)}`);
    assert.ok(fs.includes('ada.relationship.bex.warmth.score!-20'), `warmth cooled, got ${JSON.stringify(fs)}`);
    assert.ok(!fs.includes('practice.disapproval.bex.ada'), 'the reaction instance is consumed');
    assert.ok(!labels(st, 'ada').some((l) => l.includes('Disapprove')), 'no disapproval option remains');
  });

  // R: reactions.rs forgiving_also_consumes_the_reaction
  // H: ReactionsSpec.hs "forgiving also consumes the reaction (no cooling)"
  test('forgiving_also_consumes_the_reaction', () => {
    const st = base();
    st.performOutcome(spawnReaction('disapproval', ['bex', 'ada']));
    act(st, 'ada', "Let bex's lapse slide");
    const fs = st.labeledFacts();
    assert.ok(!fs.includes('practice.disapproval.bex.ada'), 'the reaction instance is consumed');
    assert.ok(!fs.some((s) => s.includes('ada.relationship.bex.warmth.score!-')), `no warmth penalty, got ${JSON.stringify(fs)}`);
  });

  // R: reactions.rs mark_violation_records_the_fact
  // H: ReactionsSpec.hs "norm violations"
  // H: ReactionsSpec.hs "markViolation records the fact"
  test('mark_violation_records_the_fact', () => {
    const st = base();
    st.performOutcome(markViolation('bex', 'tipping'));
    assert.ok(st.labeledFacts().includes('violated.bex.tipping'));
  });

  // R: reactions.rs an_agent_avoids_an_action_that_violates_a_norm_it_wants_to_respect
  // H: ReactionsSpec.hs "an agent avoids an action that violates a norm it wants to respect"
  test('an_agent_avoids_an_action_that_violates_a_norm_it_wants_to_respect', () => {
    const conduct = prac('conduct', ['X'], [action('[Actor]: Behave'), action('[Actor]: Misbehave', [], [markViolation('Actor', 'tipping')])], 'conduct');
    const bex = ch('bex', [want([violationOf('bex', 'tipping')], -50)]);
    const st = new State();
    st.definePractices([conduct]);
    st.defineFunctions(coreFns());
    st.setCharacters([bex]);
    st.performOutcome(spawnReaction('conduct', ['bex']));
    const ls = labels(st, 'bex');
    assert.ok(ls.some((l) => l.includes('Behave')), 'can behave');
    assert.ok(ls.some((l) => l.includes('Misbehave')), 'can misbehave');
    assert.equal(picked(st, 1, bex), 'bex: Behave', 'the violation future scores -50, so the planner complies');
  });

  // R: reactions.rs a_response_can_spawn_a_further_reaction
  // H: ReactionsSpec.hs "chaining"
  // H: ReactionsSpec.hs "a response can spawn a further reaction"
  test('a_response_can_spawn_a_further_reaction', () => {
    const st = new State();
    st.definePractices([disapprovalFixture(), chainerPractice()]);
    st.defineFunctions(coreFns());
    st.performOutcome(spawnReaction('chainer', ['bex', 'ada']));
    act(st, 'ada', 'React to bex');
    const fs = st.labeledFacts();
    assert.ok(!fs.includes('practice.chainer.bex.ada'), 'the original reaction is consumed');
    assert.ok(fs.includes('practice.disapproval.bex.ada'), `the follow-up disapproval is spawned, got ${JSON.stringify(fs)}`);
  });

  // R: reactions.rs reaction_active_is_the_match_over_the_same_path
  test('reaction_active_is_the_match_over_the_same_path', () => {
    assert.deepEqual(reactionActive('respondGreet', ['you', 'ada']), matches(reactionPath('respondGreet', ['you', 'ada'])));
    const st = base();
    assert.ok(!st.dbHas('practice.disapproval.bex.ada'));
    st.performOutcome(spawnReaction('disapproval', ['bex', 'ada']));
    assert.ok(st.dbHas('practice.disapproval.bex.ada'));
  });
});

// =====================================================================================
// persona.rs — H: PersonaSpec.hs "Prax.Persona"
// =====================================================================================

describe('persona', () => {
  /** Chaque marque de mensonge propre coûte 6 — plus que les 4 d'une tête trompée. */
  const plainspoken = (): Trait => trait('plainspoken', [desire('clean-conscience', want([matches('Owner.lied.H.took.C.gem')], -6))]);

  /** ada et bea convoitent la crédulité d'oz ; ada est plainspoken, bea son double sans principes. */
  function world(): State {
    const [roster, personaFacts] = cast(
      [plainspoken()],
      [
        [holds(ch('ada'), 'covets-credulity'), [plainspoken()]],
        [holds(ch('bea'), 'covets-credulity'), []],
        [ch('oz'), []],
        [ch('kit'), []],
      ],
    );
    const st = new State();
    st.definePractices([
      prac('yard', ['R'], [
        lie(together(), [], [matches('at.Culprit!Anywhere')], 'took.Culprit.gem', '[Actor]: whisper to [Hearer] that [Culprit] took the gem'),
        action('[Actor]: hold your peace', [matches('at.Actor!P')]),
      ]),
    ]);
    st.setAxioms([transparent()]);
    st.setCharacters(roster);
    st.setDesires([desire('covets-credulity', want([matches('oz.believes.took.kit.gem')], 4)), ...personaVocabulary([plainspoken()])]);
    performAll(st, [
      ...personaFacts,
      insert('practice.yard.here'),
      insert('at.ada!yard'),
      insert('at.bea!yard'),
      insert('at.oz!yard'),
      insert('at.kit!yard'),
    ]);
    return st;
  }

  // R: persona.rs bearing_endows_a_character_with_the_traits_desires_by_name
  // H: PersonaSpec.hs "bearing endows a character with the trait's desires by name"
  test('bearing_endows_a_character_with_the_traits_desires_by_name', () => {
    assert.deepEqual(bearing(plainspoken(), ch('zed')).desires, ['clean-conscience']);
  });

  // R: persona.rs cast_assembles_the_roster_and_the_facts_transparent_reads
  // H: PersonaSpec.hs "cast assembles the roster and the facts transparent reads"
  test('cast_assembles_the_roster_and_the_facts_transparent_reads', () => {
    const st = world();
    assert.ok(st.dbHas('trait.ada.plainspoken'), 'ada bears the trait');
    assert.ok(st.dbHas('traitDesire.plainspoken.clean-conscience'), "the trait's desires are data facts");
    for (const n of ['ada', 'bea', 'oz', 'kit']) assert.ok(st.dbHas(`character.${n}`), `every member is a character fact (${n})`);
    assert.ok(!st.dbHas('trait.bea'), 'bea bears nothing');
    assert.deepEqual(member(st, 'ada').desires, ['covets-credulity', 'clean-conscience']);
  });

  // R: persona.rs persona_vocabulary_rejects_duplicate_desire_names_loudly
  // H: PersonaSpec.hs "personaVocabulary rejects duplicate desire names loudly"
  test('persona_vocabulary_rejects_duplicate_desire_names_loudly', () => {
    const echo = trait('echo', [desire('clean-conscience', want([matches('x.y')], 1))]);
    throwsKind(() => personaVocabulary([plainspoken(), echo]), 'NotASinglePathSegment', 'bundles must not collide');
  });

  // R: persona.rs cast_rejects_a_dotted_trait_name_loudly
  // H: PersonaSpec.hs "cast rejects a dotted trait name loudly"
  test('cast_rejects_a_dotted_trait_name_loudly', () => {
    throwsKind(() => cast([trait('two.part', [])], []), 'NotASinglePathSegment', 'a trait name is a single path segment');
  });

  // R: persona.rs cast_rejects_a_borne_trait_missing_from_the_vocabulary
  // H: PersonaSpec.hs "cast rejects a borne trait missing from the vocabulary"
  test('cast_rejects_a_borne_trait_missing_from_the_vocabulary', () => {
    throwsKind(() => cast([], [[ch('zed'), [plainspoken()]]]), 'NotASinglePathSegment', 'a stray bearing would be silently illegible');
  });

  // R: persona.rs temperament_is_legible
  // H: PersonaSpec.hs "temperament is legible: everyone presumes a bearer's valuations"
  test('temperament_is_legible', () => {
    const st = world();
    assert.ok(st.viewHas('oz.believes.desires.ada.clean-conscience.presumed'), "oz presumes ada's conscience");
    assert.ok(st.viewHas('bea.believes.desires.ada.clean-conscience.presumed'), 'bea presumes it too');
    assert.ok(!st.viewHas('oz.believes.desires.bea.clean-conscience'), 'no conscience is presumed of bea (she bears no trait)');
    assert.ok(!st.viewHas('oz.believes.desires.ada.covets-credulity'), 'the covets want, unheralded, is presumed of no one');
  });

  // R: persona.rs the_temptation_splits_the_twins
  // H: PersonaSpec.hs "the conduct-valuation core: the temptation splits the twins"
  test('the_temptation_splits_the_twins', () => {
    const st = world();
    const bea = member(st, 'bea');
    const ada = member(st, 'ada');
    assert.equal(picked(st, 2, bea), 'bea: whisper to oz that kit took the gem');
    assert.equal(picked(st, 2, ada), 'ada: hold your peace');
  });

  // R: persona.rs a_conscience_with_a_memory
  // H: PersonaSpec.hs "a conscience with a memory: each mark costs again, and forgetting relieves"
  test('a_conscience_with_a_memory', () => {
    const st = world();
    const ada = member(st, 'ada');
    st.performOutcome(insert('ada.lied.bea.took.oz.gem'));
    assert.equal(picked(st, 2, ada), 'ada: hold your peace');
    assert.equal(st.evaluateSelfWants(ada), -6);
    st.performOutcome(insert('ada.lied.oz.took.bea.gem'));
    assert.equal(st.evaluateSelfWants(ada), -12);
    st.performOutcome(del('ada.lied'));
    assert.equal(st.evaluateSelfWants(ada), 0);
  });

  // R: persona.rs a_believed_conscience_nets_against_a_believed_motive_in_prediction
  // H: PersonaSpec.hs "a believed conscience nets against a believed motive in prediction"
  test('a_believed_conscience_nets_against_a_believed_motive_in_prediction', () => {
    const st = world();
    performAll(st, [insert('kit.believes.desires.ada.covets-credulity.seen'), insert('kit.believes.desires.bea.covets-credulity.seen')]);
    const kit = member(st, 'kit');
    const bea = member(st, 'bea');
    const ada = member(st, 'ada');
    assert.equal(predicted(st, kit, bea), 'bea: whisper to oz that kit took the gem');
    assert.equal(st.predictMove(kit, ada), null);
  });
});

// =====================================================================================
// witness.rs — H: WitnessSpec.hs "Prax.Witness"
// =====================================================================================

/**
 * L'implémentation figée, transcrite : `map (groundCondition (Map.singleton
 * (intern "Witness") (VSym (intern v))))`. L'ORACLE des épingles `as_role`
 * (witness.rs et conformance/witness_templates.rs), jamais le chemin livré.
 * Sans interneur en TS : la liaison est `Witness ↦ v` directement.
 */
function groundReference(v: string, copresence: CoPresence): Condition[] {
  const b: Bindings = new Map([['Witness', v]]);
  return copresence.map((c) => groundCondition(b, c));
}

describe('witness', () => {
  const wave = (): Action => observable(together(), 'waved.Actor', action('[Actor]: wave', [matches('at.Actor!Place')], [insert('waved')]));

  function world(): State {
    const st = new State();
    st.definePractices([prac('greet', ['R'], [wave()])]);
    st.setCharacters(['ann', 'bea', 'cal'].map((n) => ch(n)));
    performAll(st, [insert('practice.greet.stage'), insert('at.ann!square'), insert('at.bea!square'), insert('at.cal!mill')]);
    return st;
  }

  /** ann exécute sa (seule) action disponible. */
  function annActs(st: State): State {
    const ga = st.possibleActions('ann')[0];
    assert.ok(ga !== undefined, 'wave is offered to ann');
    st.performAction(ga);
    return st;
  }

  // R: witness.rs a_co_present_character_believes_the_event_an_absent_one_does_not
  // H: WitnessSpec.hs "a co-present character comes to believe the event; an absent one doesn't"
  test('a_co_present_character_believes_the_event_an_absent_one_does_not', () => {
    const st = annActs(world());
    assert.ok(st.dbHas('bea.believes.waved.ann.seen'), 'bea is co-present and believes it, with provenance seen');
    assert.ok(!st.dbHas('cal.believes.waved.ann.seen'), 'cal is elsewhere and holds no such belief');
  });

  // R: witness.rs the_actor_is_not_their_own_witness
  // H: WitnessSpec.hs "the actor is not their own witness"
  test('the_actor_is_not_their_own_witness', () => {
    const st = annActs(world());
    assert.ok(!st.dbHas('ann.believes.waved.ann.seen'), 'ann holds no belief about her own act');
  });

  // R: witness.rs observable_only_appends
  // H: WitnessSpec.hs "observable only appends; the action's own effects are untouched"
  test('observable_only_appends', () => {
    const w = wave();
    assert.equal(w.name, '[Actor]: wave');
    assert.deepEqual(w.then.slice(0, 1), [insert('waved')]);
    assert.equal(w.then.length, 2, 'exactly one deposit appended');
  });

  // R: witness.rs saw_is_the_seen_provenance_belief_condition
  // H: WitnessSpec.hs "saw is the seen-provenance belief condition"
  test('saw_is_the_seen_provenance_belief_condition', () => {
    assert.deepEqual(saw('W', 'waved.ann'), matches('W.believes.waved.ann.seen'));
  });

  // R: witness.rs the_seen_deposit_is_multi_valued
  // H: WitnessSpec.hs "the seen deposit is multi-valued: other evidence survives beside it"
  test('the_seen_deposit_is_multi_valued', () => {
    const st0 = world();
    st0.performOutcome(insert('bea.believes.waved.ann.heard.cal'));
    const st = annActs(st0);
    assert.ok(st.dbHas('bea.believes.waved.ann.seen'), 'the witness deposit landed');
    assert.ok(
      st.dbHas('bea.believes.waved.ann.heard.cal'),
      'the pre-existing hearsay edge survived the deposit — an exclusive slot would have destroyed it',
    );
  });

  // R: witness.rs as_role_agrees_with_ground_condition_on_every_shipped_template
  test('as_role_agrees_with_ground_condition_on_every_shipped_template', () => {
    const shipped: Array<[string, CoPresence]> = [
      ['Bar/Village `together`', [matches('practice.world.world.at.Actor!P'), matches('practice.world.world.at.Witness!P')]],
      ['WitnessSpec `together`', together()],
    ];
    for (const role of ['Hearer', 'V', 'Witness'])
      for (const [name, template] of shipped)
        assert.deepEqual(asRole(role, template), groundReference(role, template), `asRole(${JSON.stringify(role)}) diverges from groundCondition on ${name}`);
  });

  // R: witness.rs as_roles_contract_the_replacement_is_a_variable
  test('as_roles_contract_the_replacement_is_a_variable', () => {
    assert.ok(isVariableName('Witness'), 'the substituted key is a variable');
    for (const role of ['Hearer', 'V', 'Witness'])
      assert.ok(isVariableName(role), `asRole's stated contract: the replacement ${JSON.stringify(role)} must be a variable`);
  });

  // R: witness.rs the_two_implementations_differ_off_the_shipped_shape
  test('the_two_implementations_differ_off_the_shipped_shape', () => {
    const sub = [subquery('Witness', ['C'], [matches('at.C!P')])];
    assert.deepEqual(asRole('Hearer', sub), groundReference('Hearer', sub));
    const bad: CoPresence = [matches('at.Witness!')];
    const b: Bindings = new Map([['Witness', 'Hearer']]);
    throwsKind(() => groundCondition(b, bad[0]), 'TrailingOperator', 'the frozen implementation rejects a trailing operator');
    assert.deepEqual(asRole('Hearer', bad), [matches('at.Hearer!')], 'this implementation carries it — the divergence DIV-4 records');
  });
});

// =====================================================================================
// conformance/src/witness_templates.rs — l'épingle [S-I6] sur les gabarits des mondes livrés
// =====================================================================================

describe('witness_templates (conformance)', () => {
  // R: witness_templates.rs as_role_agrees_with_ground_condition_on_every_shipped_worlds_own_co_presence
  test('as_role_agrees_with_ground_condition_on_every_shipped_worlds_own_co_presence', () => {
    for (const [world, template] of [
      ['bar', barTogether()],
      ['village', villageTogether()],
    ] as const) {
      assert.ok(template.length > 0, `an empty co-presence would make this pin vacuous (${world})`);
      for (const role of ['Hearer', 'V', 'Witness'])
        assert.deepEqual(
          asRole(role, template),
          groundReference(role, template),
          `asRole(${JSON.stringify(role)}) diverges from groundCondition on ${world}'s own \`together\``,
        );
    }
  });
});

// =====================================================================================
// emotion.rs — H: EmotionSpec.hs "Prax.Emotion"
// =====================================================================================

describe('emotion', () => {
  /** Le `query (db st) [cond] Map.empty` de l'épingle figée, sur une base faite des phrases données. */
  function condHolds(sentences: readonly string[], cond: Condition): boolean {
    let db = emptyDb();
    for (const s of sentences) db = insertStr(db, s);
    return query(db, [compileCondition(cond)], new Map()).length > 0;
  }

  // R: emotion.rs angry_at_carol_and_afraid_of_bob_coexist_independently
  // H: EmotionSpec.hs "coexisting feelings"
  // H: EmotionSpec.hs "angry at carol and afraid of bob coexist independently"
  test('angry_at_carol_and_afraid_of_bob_coexist_independently', () => {
    const st = new State();
    performAll(st, [feelToward('ada', ANGRY, 'carol'), feelToward('ada', AFRAID, 'bob')]);
    const fs = st.labeledFacts();
    assert.ok(fs.includes('ada.feels.angry.toward.carol'), `angry at carol, got ${JSON.stringify(fs)}`);
    assert.ok(fs.includes('ada.feels.afraid.toward.bob'), `afraid of bob, got ${JSON.stringify(fs)}`);
  });

  // R: emotion.rs unfeeling_one_leaves_the_other_standing
  // H: EmotionSpec.hs "unfeeling one leaves the other standing"
  test('unfeeling_one_leaves_the_other_standing', () => {
    const st = new State();
    performAll(st, [feelToward('ada', ANGRY, 'carol'), feelToward('ada', AFRAID, 'bob'), unfeelToward('ada', ANGRY, 'carol')]);
    const fs = st.labeledFacts();
    assert.ok(!fs.includes('ada.feels.angry.toward.carol'), `angry at carol discharged, got ${JSON.stringify(fs)}`);
    assert.ok(fs.includes('ada.feels.afraid.toward.bob'), `afraid of bob survives, got ${JSON.stringify(fs)}`);
  });

  // R: emotion.rs untargeted_and_targeted_instances_of_the_same_emotion_coexist
  // H: EmotionSpec.hs "untargeted and targeted instances of the same emotion coexist"
  test('untargeted_and_targeted_instances_of_the_same_emotion_coexist', () => {
    const st = new State();
    performAll(st, [feel('ada', HAPPY), feelToward('ada', HAPPY, 'carol')]);
    assert.ok(st.dbHas('ada.feels.happy'), 'untargeted happy');
    assert.ok(st.dbHas('ada.feels.happy.toward.carol'), 'targeted happy');
  });

  // R: emotion.rs unfeel_discharges_the_whole_feeling_targets_included
  // H: EmotionSpec.hs "unfeel discharges the whole feeling, targets included"
  test('unfeel_discharges_the_whole_feeling_targets_included', () => {
    const st = new State();
    performAll(st, [feelToward('ada', ANGRY, 'carol'), feelToward('ada', ANGRY, 'bob'), unfeel('ada', ANGRY)]);
    const fs = st.labeledFacts();
    assert.ok(!fs.includes('ada.feels.angry.toward.carol'), `angry at carol gone, got ${JSON.stringify(fs)}`);
    assert.ok(!fs.includes('ada.feels.angry.toward.bob'), `angry at bob gone, got ${JSON.stringify(fs)}`);
  });

  // R: emotion.rs feeling_matches_a_targeted_instance
  // H: EmotionSpec.hs "feeling/feelingToward"
  // H: EmotionSpec.hs "feeling matches a targeted instance (Match sees subtrees)"
  test('feeling_matches_a_targeted_instance', () => {
    assert.ok(condHolds(['ada.feels.annoyed.toward.carol'], feeling('ada', ANNOYED)), "the untargeted Match sees the targeted instance's subtree");
  });

  // R: emotion.rs feeling_toward_requires_the_specific_target
  // H: EmotionSpec.hs "feelingToward requires the specific target"
  test('feeling_toward_requires_the_specific_target', () => {
    assert.ok(condHolds(['ada.feels.annoyed.toward.carol'], feelingToward('ada', ANNOYED, 'carol')), 'feelingToward carol holds');
    assert.ok(!condHolds(['ada.feels.annoyed.toward.carol'], feelingToward('ada', ANNOYED, 'bob')), 'feelingToward bob does not');
  });

  // R: emotion.rs both_feelings_gone_after_the_lifetime_lapses
  // H: EmotionSpec.hs "feelings fade"
  // H: EmotionSpec.hs "both feelings gone after the lifetime lapses; feeling again is possible"
  test('both_feelings_gone_after_the_lifetime_lapses', () => {
    const st = new State();
    performAll(st, [feelTowardFor(2, 'ada', ANGRY, 'carol'), feelTowardFor(2, 'ada', AFRAID, 'bob')]);
    assert.ok(st.dbHas('ada.feels.angry.toward.carol'), 'angry present at onset');
    assert.ok(st.dbHas('ada.feels.afraid.toward.bob'), 'afraid present at onset');
    st.roundBoundary(); // tour 1 : pas encore dû (dû à 0+2)
    assert.ok(st.dbHas('ada.feels.angry.toward.carol'), 'not yet lapsed after one boundary');
    st.roundBoundary(); // tour 2 : la durée de vie expire
    assert.ok(!st.dbHas('ada.feels.angry.toward.carol'), 'angry gone at the due boundary');
    assert.ok(!st.dbHas('ada.feels.afraid.toward.bob'), 'afraid gone at the due boundary');
    st.performOutcome(feelToward('ada', ANGRY, 'carol'));
    assert.ok(st.dbHas('ada.feels.angry.toward.carol'), 'angry can be felt again after fading');
  });

  // R: emotion.rs candidate_actions_is_identical_with_and_without_every_feeling
  // H: EmotionSpec.hs "the invariant: feelings never gate action availability"
  // H: EmotionSpec.hs "candidateActions is identical with and without every feeling"
  test('candidate_actions_is_identical_with_and_without_every_feeling', () => {
    const vocabulary = [HAPPY, SAD, ANGRY, AFRAID, DISGUSTED, SURPRISED, ANNOYED, PLEASED];
    const fixtureP = prac(
      'fixture',
      ['W'],
      [action('[Actor]: wave', [matches('practice.fixture.W')]), action('[Actor]: greet [Other]', [matches('character.Other'), neq('Actor', 'Other')])],
      'a fixture affordance',
    );
    const fix = ch('fix');
    const friend = ch('pal');
    const world = new State();
    world.definePractices([fixtureP]);
    world.setCharacters([fix, friend]);
    performAll(world, [insert('character.fix'), insert('character.pal'), insert('practice.fixture.fix')]);
    const baseline = world.candidateActions(fix).map((g) => g.label);
    const withFeelings = world.clone();
    for (const e of vocabulary) performAll(withFeelings, [feel('fix', e), feelToward('fix', e, 'pal')]);
    const after = withFeelings.candidateActions(fix).map((g) => g.label);
    assert.deepEqual(baseline, after, 'the candidate list must not move when every vocabulary feeling is present');
  });
});

// =====================================================================================
// core_model.rs — H: CoreSpec.hs "Prax.Core"
// =====================================================================================

describe('core_model', () => {
  function base(): State {
    const st = new State();
    st.defineFunctions(coreFns());
    return st;
  }

  // R: core_model.rs adjust_score_seeds_on_first_use_then_accumulates
  // H: CoreSpec.hs "relationships (numeric, asymmetric, with reason)"
  // H: CoreSpec.hs "adjustScore seeds on first use, then accumulates"
  test('adjust_score_seeds_on_first_use_then_accumulates', () => {
    const st = base();
    st.performOutcome(adjustScore('ada', 'bex', WARMTH, 10, 'greeting'));
    assert.ok(st.labeledFacts().includes('ada.relationship.bex.warmth.score!10'), `seeded to 10, got ${JSON.stringify(st.labeledFacts())}`);
    st.performOutcome(adjustScore('ada', 'bex', WARMTH, 5, 'served'));
    const fs = st.labeledFacts();
    assert.ok(fs.includes('ada.relationship.bex.warmth.score!15'), `accumulated to 15, got ${JSON.stringify(fs)}`);
    assert.ok(!fs.includes('ada.relationship.bex.warmth.score!10'), `single score value, got ${JSON.stringify(fs)}`);
    assert.ok(fs.includes('ada.relationship.bex.warmth.reason!served'), `reason updated, got ${JSON.stringify(fs)}`);
  });

  // R: core_model.rs a_negative_delta_cools_the_relationship
  // H: CoreSpec.hs "a negative delta cools the relationship"
  test('a_negative_delta_cools_the_relationship', () => {
    const st = base();
    st.performOutcome(adjustScore('ada', 'bex', WARMTH, 10, 'greeting'));
    st.performOutcome(adjustScore('ada', 'bex', WARMTH, -30, 'insulted'));
    assert.ok(st.labeledFacts().includes('ada.relationship.bex.warmth.score!-20'), `score went negative, got ${JSON.stringify(st.labeledFacts())}`);
  });

  // R: core_model.rs evaluations_are_asymmetric
  // H: CoreSpec.hs "evaluations are asymmetric"
  test('evaluations_are_asymmetric', () => {
    const st = base();
    st.performOutcome(adjustScore('ada', 'bex', WARMTH, 10, 'greeting'));
    const fs = st.labeledFacts();
    assert.ok(fs.includes('ada.relationship.bex.warmth.score!10'), `ada judges bex, got ${JSON.stringify(fs)}`);
    assert.ok(!fs.some((s) => s.includes('bex.relationship.ada')), `bex does not (yet) judge ada, got ${JSON.stringify(fs)}`);
  });

  // R: core_model.rs set_bond_writes_both_directions
  // H: CoreSpec.hs "public bond (symmetric)"
  // H: CoreSpec.hs "setBond writes both directions"
  test('set_bond_writes_both_directions', () => {
    const st = base();
    st.performOutcome(setBond('ada', 'bex', 'friends'));
    const fs = st.labeledFacts();
    assert.ok(fs.includes('bond.ada.bex!friends'), 'a->b');
    assert.ok(fs.includes('bond.bex.ada!friends'), 'b->a');
  });

  // R: core_model.rs score_at_least_binds_a_role_specific_variable
  // (adapté : `capitalize` est privée en TS ; `capitalize("") == ""` s'observe par
  //  `scoreAtLeast` sur un rôle vide, qui mint la variable `Score` sans suffixe)
  test('score_at_least_binds_a_role_specific_variable', () => {
    assert.deepEqual(scoreAtLeast('ada', 'bex', WARMTH, 3), [matches('ada.relationship.bex.warmth.score!ScoreWarmth'), cmp('gte', 'ScoreWarmth', '3')]);
    assert.deepEqual(
      scoreAtLeast('ada', 'bex', RESPECT, -1)[1],
      cmp('gte', 'ScoreRespect', '-1'),
      'distinct roles mint distinct variables, so the two guards do not join',
    );
    assert.deepEqual(scoreAtLeast('ada', 'bex', '', 0)[1], cmp('gte', 'Score', '0'), 'the empty role capitalizes to nothing');
  });

  // R: core_model.rs case_order_is_load_bearing
  // (adapté : `adjust_score_fn` est privée en TS ; c'est l'entrée `prax_adjustScore` de `coreFns()`)
  test('case_order_is_load_bearing', () => {
    const f = coreFns().find((x) => x.name === 'prax_adjustScore');
    assert.ok(f !== undefined, 'prax_adjustScore is in the core library');
    assert.equal(f.cases.length, 2);
    assert.ok(f.cases[0].conditions.length > 0, 'the guarded (accumulating) case comes first');
    assert.ok(f.cases[1].conditions.length === 0, 'the unguarded fallback comes last — anything after it is dead');

    const reversed = fn('prax_adjustScore', ['A', 'B', 'Role', 'Delta', 'Reason'], [
      [[], [insert('A.relationship.B.Role.score!Delta'), insert('A.relationship.B.Role.reason!Reason')]],
      [
        [matches('A.relationship.B.Role.score!N'), calc('M', 'add', 'N', 'Delta')],
        [insert('A.relationship.B.Role.score!M'), insert('A.relationship.B.Role.reason!Reason')],
      ],
    ]);
    const st = new State();
    st.defineFunctions([reversed]);
    st.performOutcome(adjustScore('ada', 'bex', WARMTH, 10, 'greeting'));
    st.performOutcome(adjustScore('ada', 'bex', WARMTH, 5, 'served'));
    assert.ok(st.labeledFacts().includes('ada.relationship.bex.warmth.score!5'), 'fallback-first re-seeds to 5 — which is what the shipped order avoids');
  });

  // R: core_model.rs a_function_case_queries_the_base_db_not_the_view
  test('a_function_case_queries_the_base_db_not_the_view', () => {
    const st = base();
    st.setAxioms([axiom([matches('seed.ada.bex')], ['ada.relationship.bex.warmth.score!7'])]);
    st.performOutcome(insert('seed.ada.bex'));
    assert.ok(st.viewHas('ada.relationship.bex.warmth.score!7'), 'fixture: the score is derived into the view');
    assert.ok(!st.dbHas('ada.relationship.bex.warmth.score!7'), 'fixture: and is absent from the base');
    st.performOutcome(adjustScore('ada', 'bex', WARMTH, 5, 'served'));
    assert.ok(
      st.dbHas('ada.relationship.bex.warmth.score!5'),
      'the guarded case did NOT see the derived 7, so the fallback seeded 5 — a view-reading Call would have written 12',
    );
  });

  // R: core_model.rs a_matching_case_runs_for_the_first_binding_only
  test('a_matching_case_runs_for_the_first_binding_only', () => {
    const st = new State();
    st.defineFunctions([fn('mark_one', ['Who'], [[[matches('candidate.Who.C')], [insert('marked.Who.C')]]])]);
    performAll(st, [insert('candidate.ada.x'), insert('candidate.ada.y')]);
    st.performOutcome(call('mark_one', ['ada']));
    const marked = st.labeledFacts().filter((s) => s.startsWith('marked.'));
    assert.deepEqual(
      marked,
      ['marked.ada.x'],
      "exactly one binding fired, and it is the first in the query's name-ordered branch — not both candidates",
    );
  });
});

// =====================================================================================
// minds.rs — H: MindsSpec.hs "Prax.Minds"
// =====================================================================================

describe('minds', () => {
  const m = (s: string): Condition => matches(s);

  /** Deux désirs ; ida professe sa gourmandise, rex a une rancune ni professée ni conventionnelle. */
  const vocab = (): Desire[] => [desire('sweet-tooth', want([m('holding.Owner.cake')], 5)), desire('grudge-rex', want([m('shamed.rex')], 7))];

  function world(): State {
    const st = new State();
    st.setCharacters([ch('ida'), holds(ch('rex'), 'grudge-rex')]);
    performAll(st, [insert('character.ida'), insert('character.rex'), insert('professes.ida.sweet-tooth')]);
    st.setAxioms([professed(), conventional()]);
    st.setDesires(vocab());
    return st;
  }

  // R: minds.rs a_profession_derives_presumed_motive_beliefs_across_the_cast
  // H: MindsSpec.hs "a profession derives presumed motive-beliefs across the cast"
  test('a_profession_derives_presumed_motive_beliefs_across_the_cast', () => {
    const st = world();
    assert.ok(st.viewHas('rex.believes.desires.ida.sweet-tooth.presumed'), "rex presumes ida's sweet tooth");
    assert.ok(!st.viewHas('ida.believes.desires.rex.grudge-rex.presumed'), "nothing derives rex's unprofessed grudge");
  });

  // R: minds.rs the_profession_is_defeasible
  // H: MindsSpec.hs "the profession is defeasible"
  test('the_profession_is_defeasible', () => {
    const st = world();
    st.performOutcome(del('professes.ida.sweet-tooth'));
    assert.ok(!st.viewHas('rex.believes.desires.ida.sweet-tooth.presumed'), 'presumption dissolved');
  });

  // R: minds.rs a_conventional_desire_is_presumed_of_everyone_even_non_holders
  // H: MindsSpec.hs "a conventional desire is presumed of everyone — even non-holders"
  test('a_conventional_desire_is_presumed_of_everyone_even_non_holders', () => {
    const st = world();
    st.performOutcome(insert('conventional.sweet-tooth'));
    assert.ok(st.viewHas('ida.believes.desires.rex.sweet-tooth.presumed'), "ida presumes rex's sweet tooth (he does not have one)");
  });

  // R: minds.rs gossip_about_a_motive_flips_a_third_partys_prediction
  // H: MindsSpec.hs "gossip about a motive flips a third party's prediction"
  test('gossip_about_a_motive_flips_a_third_partys_prediction', () => {
    const pat = 'desires.Culprit.grudge-rex';
    const tellGrudge = action(
      "[Actor]: mention [Culprit]'s grudge to [Hearer]",
      [
        matches(`Actor.believes.${pat}`),
        matches('at.Actor!P'),
        matches('at.Hearer!P'),
        neq('Hearer', 'Actor'),
        neq('Hearer', 'Culprit'),
        absent([matches(`Hearer.believes.${pat}.seen`)]),
        not_(`Hearer.believes.${pat}.heard.Actor`),
      ],
      [insert(`Hearer.believes.${pat}.heard.Actor`)],
    );
    const revenge = action('[Actor]: seek petty revenge', [], [insert('shamed.Actor')]);
    const town = prac('town', ['Place'], [tellGrudge, revenge]);

    const st = new State();
    st.definePractices([town]);
    st.setCharacters([ch('ida'), holds(ch('rex'), 'grudge-rex'), ch('nia')]);
    st.setDesires(vocab());
    performAll(st, [insert('practice.town.village'), insert('at.ida!village'), insert('at.nia!village'), insert('ida.believes.desires.rex.grudge-rex.seen')]);

    const nia = ch('nia');
    const rex = holds(ch('rex'), 'grudge-rex');
    assert.equal(st.predictMove(nia, rex), null, 'nia has no model of rex, so he is unreadable');

    const told = st.clone();
    const ga = told.possibleActions('ida').find((g) => g.label.includes("mention rex's grudge to nia"));
    assert.ok(ga !== undefined, 'no gossip action offered to ida');
    told.performAction(ga);
    assert.equal(predicted(told, nia, rex), 'rex: seek petty revenge', 'the hearsay motive-belief makes rex predictable to nia');
  });

  // R: minds.rs want_for_grounds_owner
  // H: MindsSpec.hs "wantFor grounds the Owner variable"
  test('want_for_grounds_owner', () => {
    const d = desire('sweet-tooth', want([m('holding.Owner.cake')], 5));
    assert.deepEqual(wantFor('ida', d), want([m('holding.ida.cake')], 5));
  });

  // R: minds.rs self_wants_is_unnamed_plus_instantiated_desires
  // H: MindsSpec.hs "selfWants = unnamed wants + own named desires, instantiated"
  test('self_wants_is_unnamed_plus_instantiated_desires', () => {
    const vocabulary = [desire('sweet-tooth', want([m('holding.Owner.cake')], 5)), desire('grudge-rex', want([m('shamed.rex')], 7))];
    const rex = holds(ch('rex', [want([m('x')], 1)]), 'grudge-rex');
    assert.deepEqual(selfWants(vocabulary, rex), [want([m('x')], 1), want([m('shamed.rex')], 7)]);
  });
});

// =====================================================================================
// conversation.rs — H: ConversationSpec.hs "Prax.Conversation"
// =====================================================================================

describe('conversation', () => {
  const talkPractice = (): Practice =>
    prac(
      'converse',
      ['A', 'B'],
      [
        quip('hi', '[Actor]: say hi to [Partner]', 'greetings', [], [insert('Actor.saidHiTo.Partner')]),
        quip('weather', '[Actor]: remark on the weather to [Partner]', 'weather', [], [insert('Actor.talkedWeatherWith.Partner')]),
        changeSubject('[Actor]: change the subject to the weather', 'weather'),
        endConversation('[Actor]: wrap up the chat'),
      ],
      '[A] and [B] are talking',
    );

  function start(): State {
    const st = new State();
    st.definePractice(talkPractice());
    performAll(st, beginConversation('ada', 'bex', 'greetings'));
    return st;
  }

  const opts = labels;
  const act = (st: State, actor: string, needle: string): void => doAct(actor, needle, st);

  // R: conversation.rs begin_conversation_sets_speaker_listener_and_topic
  // H: ConversationSpec.hs "beginConversation sets speaker, listener and topic"
  test('begin_conversation_sets_speaker_listener_and_topic', () => {
    const fs = start().labeledFacts();
    for (const w of ['practice.converse.ada.bex.speaker!ada', 'practice.converse.ada.bex.listener!bex', 'practice.converse.ada.bex.topic!greetings'])
      assert.ok(fs.includes(w), `${w} missing from ${JSON.stringify(fs)}`);
  });

  // R: conversation.rs only_the_current_speaker_may_quip_and_only_on_topic
  // H: ConversationSpec.hs "only the current speaker may quip, and only on the current topic"
  test('only_the_current_speaker_may_quip_and_only_on_topic', () => {
    const st = start();
    assert.ok(opts(st, 'ada').some((l) => l.includes('say hi to bex')), 'the speaker can say hi');
    const listener = opts(st, 'bex');
    for (const needle of ['say hi', 'remark on the weather'])
      assert.ok(!listener.some((l) => l.includes(needle)), `the listener cannot quip (${needle}), had ${JSON.stringify(listener)}`);
    assert.ok(!opts(st, 'ada').some((l) => l.includes('remark on the weather')), 'the off-topic quip is withheld');
  });

  // R: conversation.rs a_quip_applies_its_effect_is_one_shot_and_passes_the_turn
  // H: ConversationSpec.hs "a quip applies its effect, is one-shot, and passes the turn"
  test('a_quip_applies_its_effect_is_one_shot_and_passes_the_turn', () => {
    const st = start();
    act(st, 'ada', 'say hi to bex');
    const fs = st.labeledFacts();
    assert.ok(fs.includes('ada.saidHiTo.bex'), `the effect applied, got ${JSON.stringify(fs)}`);
    assert.ok(fs.includes('practice.converse.ada.bex.speaker!bex'), `the turn passed to bex, got ${JSON.stringify(fs)}`);
    assert.ok(!opts(st, 'ada').some((l) => l.includes('say hi')), 'ada cannot quip out of turn');
  });

  // R: conversation.rs changing_the_subject_switches_the_active_topic
  // H: ConversationSpec.hs "changing the subject switches the active topic"
  test('changing_the_subject_switches_the_active_topic', () => {
    const st = start();
    act(st, 'ada', 'say hi to bex');
    act(st, 'bex', 'change the subject to the weather');
    assert.ok(st.labeledFacts().includes('practice.converse.ada.bex.topic!weather'), 'the topic is now the weather');
    assert.ok(opts(st, 'ada').some((l) => l.includes('remark on the weather')), 'the on-topic quip is offered to the speaker');
  });

  // R: conversation.rs ending_the_conversation_removes_the_instance
  // H: ConversationSpec.hs "ending the conversation removes the instance"
  test('ending_the_conversation_removes_the_instance', () => {
    const st = start();
    act(st, 'ada', 'wrap up the chat');
    assert.ok(!st.labeledFacts().includes('practice.converse.ada.bex'), 'the conversation instance is gone');
  });

  // R: conversation.rs talking_with_is_the_ordered_match_over_the_talk_path
  test('talking_with_is_the_ordered_match_over_the_talk_path', () => {
    assert.deepEqual(talkingWith('ada', 'bex'), matches(talkPath('ada', 'bex')));
    assert.notEqual(talkPath('ada', 'bex'), talkPath('bex', 'ada'));
    const st = start();
    assert.ok(st.dbHas(talkPath('ada', 'bex')));
    assert.ok(!st.dbHas(talkPath('bex', 'ada')), 'the reverse ordering is a different instance — which is why the shipped gate has to negate both');
  });
});

// =====================================================================================
// beliefs.rs — H: BeliefsSpec.hs "Prax.Beliefs"
// =====================================================================================

describe('beliefs', () => {
  /** Applique des effets à un état vide ; rend les faits étiquetés. */
  function run(outs: readonly Outcome[]): string[] {
    const st = new State();
    performAll(st, outs);
    return st.labeledFacts();
  }

  // R: beliefs.rs belief_sentence_and_belief_about_build_the_expected_paths
  // H: BeliefsSpec.hs "beliefSentence / beliefAbout build the expected paths"
  test('belief_sentence_and_belief_about_build_the_expected_paths', () => {
    assert.equal(beliefSentence('bex', 'resentedBy.ada', 'yes'), 'bex.believes.resentedBy.ada!yes');
    assert.equal(beliefAbout('bex', 'sky'), 'bex.believes.sky');
  });

  // R: beliefs.rs believe_records_a_belief_and_believes_that_matches_it
  // H: BeliefsSpec.hs "believe records a belief; believesThat matches it"
  test('believe_records_a_belief_and_believes_that_matches_it', () => {
    assert.ok(run([believe('bex', 'sky', 'green')]).includes('bex.believes.sky!green'), 'belief recorded');
    assert.deepEqual(believesThat('bex', 'sky', 'green'), matches('bex.believes.sky!green'), 'believesThat is the Match on the belief sentence, `!` and all');
  });

  // R: beliefs.rs a_new_value_for_an_issue_overrides_the_old
  // H: BeliefsSpec.hs "a new value for an issue overrides the old (single-slot)"
  test('a_new_value_for_an_issue_overrides_the_old', () => {
    const fs = run([believe('bex', 'sky', 'green'), believe('bex', 'sky', 'blue')]);
    assert.ok(fs.includes('bex.believes.sky!blue'), `new value present, got ${JSON.stringify(fs)}`);
    assert.ok(!fs.includes('bex.believes.sky!green'), `old value gone, got ${JSON.stringify(fs)}`);
  });

  // R: beliefs.rs forget_drops_the_belief
  // H: BeliefsSpec.hs "forget drops the belief"
  test('forget_drops_the_belief', () => {
    const fs = run([believe('bex', 'sky', 'blue'), forget('bex', 'sky')]);
    assert.ok(!fs.some((s) => s.startsWith('bex.believes.sky')), `no sky belief remains, got ${JSON.stringify(fs)}`);
  });

  // R: beliefs.rs beliefs_are_per_agent_two_agents_can_disagree
  // H: BeliefsSpec.hs "beliefs are per-agent: two agents can disagree"
  test('beliefs_are_per_agent_two_agents_can_disagree', () => {
    const fs = run([believe('bex', 'murderer', 'ada'), believe('cid', 'murderer', 'you')]);
    assert.ok(fs.includes('bex.believes.murderer!ada'), `bex's view, got ${JSON.stringify(fs)}`);
    assert.ok(fs.includes('cid.believes.murderer!you'), `cid's view, got ${JSON.stringify(fs)}`);
  });

  // R: beliefs.rs a_belief_can_be_false_diverging_from_the_shared_world
  // H: BeliefsSpec.hs "a belief can be false — diverging from the shared world"
  test('a_belief_can_be_false_diverging_from_the_shared_world', () => {
    const st = new State();
    st.performOutcome(insert('ada.mood!pleased'));
    st.performOutcome(believe('bex', 'adaMood', 'cross'));
    const fs = st.labeledFacts();
    assert.ok(fs.includes('ada.mood!pleased'), `world truth stands, got ${JSON.stringify(fs)}`);
    assert.ok(fs.includes('bex.believes.adaMood!cross'), `bex's belief diverges, got ${JSON.stringify(fs)}`);
    assert.deepEqual(
      st.dbChildKeys(beliefAbout('bex', 'adaMood')),
      ['cross'],
      "the belief path binds exactly one value, and it is bex's, not the world's",
    );
  });
});

// =====================================================================================
// arc.rs — H: ArcSpec.hs "Prax.Arc"
// =====================================================================================

describe('arc', () => {
  function run(outs: readonly Outcome[]): string[] {
    const st = new State();
    performAll(st, outs);
    return st.labeledFacts();
  }

  // R: arc.rs arc_sentence_and_arc_is_build_the_expected_fact
  // H: ArcSpec.hs "arcSentence / arcIs build the expected fact"
  test('arc_sentence_and_arc_is_build_the_expected_fact', () => {
    assert.equal(arcSentence('bex', 'hopeful'), 'bex.arc!hopeful');
    assert.deepEqual(arcIs('bex', 'hopeful'), matches('bex.arc!hopeful'));
  });

  // R: arc.rs enter_arc_records_the_stage
  // H: ArcSpec.hs "enterArc records the stage"
  test('enter_arc_records_the_stage', () => {
    assert.ok(run([enterArc('bex', 'hopeful')]).includes('bex.arc!hopeful'), 'the stage is recorded');
  });

  // R: arc.rs entering_a_new_stage_overrides_the_old
  // H: ArcSpec.hs "entering a new stage overrides the old (single-slot)"
  test('entering_a_new_stage_overrides_the_old', () => {
    const fs = run([enterArc('bex', 'hopeful'), enterArc('bex', 'belonging')]);
    assert.ok(fs.includes('bex.arc!belonging'), `the new stage, got ${JSON.stringify(fs)}`);
    assert.ok(!fs.some((s) => s.includes('arc!hopeful')), `the old stage is gone, got ${JSON.stringify(fs)}`);
  });

  // R: arc.rs arc_of_is_the_bindable_prefix_of_the_arc_sentence
  test('arc_of_is_the_bindable_prefix_of_the_arc_sentence', () => {
    assert.equal(arcOf('bex'), 'bex.arc');
    assert.equal(arcSentence('bex', 'hopeful'), `${arcOf('bex')}!hopeful`);
    const st = new State();
    st.performOutcome(enterArc('bex', 'hopeful'));
    assert.ok(st.dbHas(`${arcOf('bex')}!hopeful`), 'the bindable path is the one the deposit writes');
  });
});
