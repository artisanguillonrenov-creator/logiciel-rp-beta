/**
 * Portage TypeScript des tests des modules de vocabulaire Prax
 * `confession`, `coerce`, `deontic`, `kin` et `blackmail`
 * (prax-vocab/src/{confession,coerce,deontic,kin,blackmail}.rs, modules
 * `#[cfg(test)]` ; Prax, BSD-3-Clause). Un test TS par `#[test]` Rust, même
 * scénario et mêmes assertions. Aucun `proptest!` dans ces cinq modules.
 *
 * Là où le Rust n'assertait que `is_err()`, on vérifie en plus la variante
 * (`WorldError.kind`) que le code Rust lève sur ce chemin — c'est la même
 * erreur, simplement nommée.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isDeepStrictEqual } from 'node:util';

import { emptyDb, insertStr, toSentences } from '../src/prax/core/db';
import { axiomFootprint, close, compileRule, CompiledRule, isContradiction } from '../src/prax/core/derive';
import { State } from '../src/prax/core/engine';
import { WorldError, WorldErrorKind } from '../src/prax/core/errors';
import { tokenize } from '../src/prax/core/path';
import { GroundedAction } from '../src/prax/core/perform';
import { deserializeState, serializeState } from '../src/prax/core/persist';
import { Condition, absent, cmp, count, matches, neq, not_, subquery } from '../src/prax/core/query';
import {
  Action,
  Axiom,
  Character,
  Desire,
  Outcome,
  Practice,
  Want,
  action,
  axiom,
  character,
  del,
  desire,
  insert,
  practice,
  want,
} from '../src/prax/core/types';
import { OBLIGED_HEAD, obligationPath } from '../src/prax/core/vocabConsts';
import { shakedown } from '../src/prax/vocab/blackmail';
import { Coercion, coerce, namespaceKernel } from '../src/prax/vocab/coerce';
import { absolve, confess, incorrigible } from '../src/prax/vocab/confession';
import { owe, owes } from '../src/prax/vocab/debt';
import { conceal } from '../src/prax/vocab/deceit';
import {
  avoidBreach,
  breach,
  conflicts,
  discharge,
  fulfilled,
  inBreach,
  incompatiblePairs,
  isObliged,
  oblige,
  obligeReparative,
  obligationsOf,
  obligedClose,
  obligedLift,
  wantFulfilled,
} from '../src/prax/vocab/deontic';
import { comrades, joins } from '../src/prax/vocab/faction';
import { kinAxioms, succession, wed } from '../src/prax/vocab/kin';
import { conventional } from '../src/prax/vocab/minds';
import { Trait, bearing, cast, personaVocabulary, trait, transparent } from '../src/prax/vocab/persona';
import { violationOf } from '../src/prax/vocab/reactions';
import { CoPresence, asRole } from '../src/prax/vocab/witness';

// ---- outillage commun (les helpers `member` / `do_act` / `offered` / `score_of` des modules Rust) ----

/** `Character::new(n).want(..)….holds(..)…` */
function ch(name: string, wants: readonly Want[] = [], desires: readonly string[] = []): Character {
  return character(name, { wants, desires });
}

/** `Practice::new(id).roles(roles).action(..)…` */
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

function doAct(who: string, needle: string, st: State): void {
  const found = st.possibleActions(who).find((ga) => ga.label.includes(needle));
  if (found === undefined) throw new Error(`no action for ${who} matching ${JSON.stringify(needle)}; had: ${JSON.stringify(labels(st, who))}`);
  st.performAction(found);
}

function offered(who: string, needle: string, st: State): boolean {
  return st.possibleActions(who).some((ga) => ga.label.includes(needle));
}

function scoreOf(scores: ReadonlyArray<readonly [GroundedAction, number]>, needle: string): number {
  const hit = scores.find(([ga]) => ga.label.includes(needle));
  if (hit === undefined) throw new Error(`no scored action matching ${JSON.stringify(needle)}; had: ${JSON.stringify(scores.map(([ga]) => ga.label))}`);
  return hit[1];
}

function picked(st: State, depth: number, c: Character): string | null {
  return st.pickAction(depth, c)?.label ?? null;
}

/** `assert!(f().is_err())`, précisé : la variante `WorldError` levée est `kind`. */
function throwsKind(f: () => unknown, kind: WorldErrorKind, msg: string): void {
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
  assert.equal(caught.kind, kind, `${msg} — variante ${caught.kind} (${caught.message})`);
}

function containsDeep<T>(xs: readonly T[], x: T): boolean {
  return xs.some((y) => isDeepStrictEqual(y, x));
}

/** Le gabarit de co-présence partagé par confession / coerce / blackmail. */
function together(): CoPresence {
  return [matches('at.Actor!P'), matches('at.Witness!P')];
}

// =====================================================================================
// kin.rs — H: KinSpec.hs "Prax.Kin"
// =====================================================================================

describe('kin', () => {
  /** gran > pat > {ana, ben} ; mia > {cass, dan} (non mariés) ; ana épouse chris. */
  function kinWorld(): State {
    const st = new State();
    for (const s of ['parent.gran.pat', 'parent.pat.ana', 'parent.pat.ben', 'parent.mia.cass', 'parent.mia.dan', 'married.ana.chris'])
      st.performOutcome(insert(s));
    st.setAxioms(kinAxioms());
    return st;
  }

  const kinView = (): string[] => kinWorld().labeledView();

  /** Deux maisons (hall : ana, ben ; yard : cass), plus pat parent d'ana. */
  function houseWorld(): State {
    const st = new State();
    for (const o of [joins('ana', 'hall'), joins('ben', 'hall'), joins('cass', 'yard'), insert('parent.pat.ana')]) st.performOutcome(o);
    st.setAxioms([...kinAxioms(), comrades()]);
    return st;
  }

  function weddedWorld(): State {
    const st = houseWorld();
    for (const o of wed('ana', 'yard', 'cass')) st.performOutcome(o);
    return st;
  }

  /** Pratique sans rôle hébergeant la réclamation du trône ; rex titulaire, ana et ben ses enfants. */
  function successionWorld(): State {
    const st = new State();
    st.definePractice(prac('succession', [], [succession('throne')]));
    for (const s of ['practice.succession', 'office.throne!rex', 'parent.rex.ana', 'parent.rex.ben']) st.performOutcome(insert(s));
    return st;
  }

  const canClaim = (st: State, actor: string): boolean => labels(st, actor).some((l) => l.includes('claim the office of throne'));

  function find(st: State, actor: string, needle: string): GroundedAction {
    const ga = st.possibleActions(actor).find((g) => g.label.includes(needle));
    if (ga === undefined) throw new Error(`no ${JSON.stringify(needle)} for ${actor}`);
    return ga;
  }

  // R: kin.rs marriage_is_symmetric
  // H: KinSpec.hs "marriage symmetry: married.A.B derives married.B.A"
  test('marriage_is_symmetric', () => {
    assert.ok(kinView().includes('married.chris.ana'), 'chris married ana too');
  });

  // R: kin.rs marriage_symmetry_invents_no_marriage
  // H: KinSpec.hs "marriage symmetry negative: an unmarried pair derives no symmetric fact"
  test('marriage_symmetry_invents_no_marriage', () => {
    const view = kinView();
    for (const s of ['married.dan.cass', 'married.cass.dan']) assert.ok(!view.includes(s), `dan and cass are never married: ${s}`);
  });

  // R: kin.rs a_shared_parent_derives_siblinghood_both_ways
  // H: KinSpec.hs "sibling: shared parent, X<>Y, derives sibling both ways"
  test('a_shared_parent_derives_siblinghood_both_ways', () => {
    const view = kinView();
    for (const s of ['sibling.ana.ben', 'sibling.ben.ana']) assert.ok(view.includes(s), `ana and ben are siblings: ${s}`);
  });

  // R: kin.rs no_shared_parent_derives_no_siblinghood
  // H: KinSpec.hs "sibling negative: no shared parent, no sibling fact"
  test('no_shared_parent_derives_no_siblinghood', () => {
    const view = kinView();
    for (const s of ['sibling.ana.cass', 'sibling.cass.ana']) assert.ok(!view.includes(s), `ana and cass share no parent, not siblings: ${s}`);
  });

  // R: kin.rs parent_of_parent_derives_grandparent
  // H: KinSpec.hs "grandparent: parent-of-parent derives grandparent"
  test('parent_of_parent_derives_grandparent', () => {
    assert.ok(kinView().includes('grandparent.gran.ana'), "gran is ana's grandparent");
  });

  // R: kin.rs no_parent_chain_derives_no_grandparent
  // H: KinSpec.hs "grandparent negative: no parent chain, no grandparent fact"
  test('no_parent_chain_derives_no_grandparent', () => {
    assert.ok(!kinView().includes('grandparent.gran.chris'), "gran is not chris's grandparent");
  });

  // R: kin.rs a_spouses_parent_is_an_in_law
  // H: KinSpec.hs "inLaw (spouse's parent): married.A.B + parent.P.A derives inLaw.P.B"
  test('a_spouses_parent_is_an_in_law', () => {
    assert.ok(kinView().includes('inLaw.pat.chris'), "pat (ana's parent) is chris's in-law");
  });

  // R: kin.rs an_unmarried_childs_parent_is_no_ones_in_law
  // H: KinSpec.hs "inLaw (spouse's parent) negative: no marriage, no in-law via that parent"
  test('an_unmarried_childs_parent_is_no_ones_in_law', () => {
    assert.ok(!kinView().some((s) => s.startsWith('inLaw.mia.')), "mia's unmarried children yield no inLaw.mia.* fact at all");
  });

  // R: kin.rs a_siblings_spouse_is_an_in_law
  // H: KinSpec.hs "inLaw (sibling's spouse): married.A.B + sibling.A.S derives inLaw.S.B"
  test('a_siblings_spouse_is_an_in_law', () => {
    assert.ok(kinView().includes('inLaw.ben.chris'), "ben (ana's sibling) is chris's in-law");
  });

  // R: kin.rs unmarried_siblings_derive_no_in_law
  // H: KinSpec.hs "inLaw (sibling's spouse) negative: siblings without a marriage derive no in-law"
  test('unmarried_siblings_derive_no_in_law', () => {
    assert.ok(
      !kinView().some((s) => s.startsWith('inLaw.cass.') || s.startsWith('inLaw.dan.')),
      "cass and dan are siblings but unmarried — neither is anyone's in-law",
    );
  });

  // R: kin.rs wed_rejects_multi_segment_names
  // H: KinSpec.hs "wed: guards forced — joiner and spouse must be single path segments"
  test('wed_rejects_multi_segment_names', () => {
    for (const [joiner, spouse] of [['', 'cass'], ['ana', 'b.ad'], ['ana', 'b!ad']] as const)
      throwsKind(() => wed(joiner, 'hall', spouse), 'NotASinglePathSegment', `wed ${JSON.stringify(joiner)} ${JSON.stringify(spouse)} must be a loud rejection`);
  });

  // R: kin.rs wed_rejects_a_bad_faction_at_construction
  // DIV-3 (garde paresseuse Haskell) : le Rust — et donc le portage TS — rejette la
  // faction À LA CONSTRUCTION ; c'est le comportement que l'auteur obtient, épinglé tel quel.
  test('wed_rejects_a_bad_faction_at_construction', () => {
    for (const faction of ['b.ad', 'b!ad', ''])
      throwsKind(
        () => wed('ana', faction, 'cass'),
        'NotASinglePathSegment',
        `wed with faction ${JSON.stringify(faction)} rejects at construction, not when the outcome is forced`,
      );
    const os = wed('ana', 'yard', 'cass');
    assert.deepEqual(os, [insert('married.ana.cass'), insert('member.ana!yard')], 'the marriage fact comes first, then the membership overwrite');
  });

  // R: kin.rs wed_marries_and_moves_the_membership
  // H: KinSpec.hs "wed: inserts the marriage fact and overwrites the joiner's membership"
  test('wed_marries_and_moves_the_membership', () => {
    const st = weddedWorld();
    assert.ok(st.dbHas('married.ana.cass'), 'married.ana.cass is a base fact');
    assert.ok(st.dbHas('member.ana!yard'), "ana's membership moved to yard");
    assert.ok(!st.dbHas('member.ana!hall'), "ana's old hall membership is gone");
  });

  // R: kin.rs wed_un_derives_the_joiners_old_alliances
  // H: KinSpec.hs "wed: the membership overwrite un-derives the joiner's old alliances (Faction composition)"
  test('wed_un_derives_the_joiners_old_alliances', () => {
    const st = weddedWorld();
    assert.ok(!st.viewHas('allied.ana.ben'), 'ana no longer allied with ben (old house)');
    assert.ok(!st.viewHas('allied.ben.ana'), 'ben no longer allied with ana (old house)');
    assert.ok(st.viewHas('allied.ana.cass'), 'ana is now allied with cass (new house)');
    assert.ok(st.viewHas('allied.cass.ana'), 'cass is now allied with ana (new house)');
  });

  // R: kin.rs dissolution_un_derives_in_laws_and_leaves_membership
  // H: KinSpec.hs "dissolution: retracting married un-derives in-laws but leaves membership UNCHANGED"
  test('dissolution_un_derives_in_laws_and_leaves_membership', () => {
    const dissolved = weddedWorld();
    assert.ok(dissolved.viewHas('inLaw.pat.cass'), "pre-dissolution: pat (ana's parent) is cass's in-law (via ana's marriage)");
    dissolved.performOutcome(del('married.ana.cass'));
    assert.ok(!dissolved.viewHas('inLaw.pat.cass'), 'post-dissolution: the in-law fact is gone');
    assert.ok(!dissolved.viewHas('married.cass.ana'), 'post-dissolution: the symmetric marriage fact is gone');
    assert.ok(dissolved.dbHas('member.ana!yard'), "post-dissolution: ana's membership is UNCHANGED in the base");
    assert.ok(dissolved.viewHas('member.ana!yard'), "post-dissolution: ana's membership is UNCHANGED in the view");
    assert.ok(dissolved.viewHas('allied.ana.cass'), 'the designed asymmetry: membership-derived alliance survives (it was never a kin derivation)');
  });

  // R: kin.rs succession_is_not_offered_while_the_holder_lives
  // H: KinSpec.hs "succession: not offered while the holder lives"
  test('succession_is_not_offered_while_the_holder_lives', () => {
    const st = successionWorld();
    assert.ok(!canClaim(st, 'ana'), 'ana cannot claim the throne while rex lives');
  });

  // R: kin.rs only_children_may_claim_a_dead_holders_office
  // H: KinSpec.hs "succession: only children may claim, once the holder is dead"
  test('only_children_may_claim_a_dead_holders_office', () => {
    const st = successionWorld();
    st.performOutcome(insert('dead.rex'));
    assert.ok(canClaim(st, 'ana'), 'ana (a child) may claim');
    assert.ok(canClaim(st, 'ben'), 'ben (a child) may claim');
    assert.ok(!canClaim(st, 'cass'), 'cass (not a child of rex) may not claim');
  });

  // R: kin.rs a_performed_claim_closes_the_race
  // H: KinSpec.hs "succession: a performed claim overwrites the slot and closes the affordance for the other child"
  test('a_performed_claim_closes_the_race', () => {
    const st = successionWorld();
    st.performOutcome(insert('dead.rex'));
    const ga = find(st, 'ana', 'claim the office of throne');
    st.performAction(ga);
    assert.ok(st.dbHas('office.throne!ana'), 'the office now belongs to ana');
    assert.ok(!st.dbHas('office.throne!rex'), "rex's old holding is gone (single-slot overwrite)");
    assert.ok(!canClaim(st, 'ben'), 'ben can no longer claim — the race is closed');
    assert.ok(!canClaim(st, 'ana'), 'ana cannot re-claim her own office (she is not dead)');
  });

  // R: kin.rs succession_rejects_multi_segment_office_names
  // H: KinSpec.hs "succession: guards forced — office names must be single path segments"
  test('succession_rejects_multi_segment_office_names', () => {
    for (const office of ['', 'a.b', 'a!b']) throwsKind(() => succession(office), 'NotASinglePathSegment', `succession ${JSON.stringify(office)} must be a loud rejection`);
  });
});

// =====================================================================================
// deontic.rs — H: DeonticSpec.hs "Prax.Deontic"
// =====================================================================================

describe('deontic', () => {
  const m = (s: string): Condition => matches(s);

  const compileRules = (axs: readonly Axiom[]): CompiledRule[] => axs.map((ax) => compileRule(ax.when, ax.then));

  function hasPath(ps: ReadonlyArray<readonly string[]>, s: string): boolean {
    const segs = tokenize(s).segs;
    return ps.some((p) => isDeepStrictEqual([...p], [...segs]));
  }

  function build(facts: readonly string[]) {
    let db = emptyDb();
    for (const f of facts) db = insertStr(db, f);
    return db;
  }

  /** Le `applyAll` gelé sur un état vide. */
  function applyAll(outs: readonly Outcome[]): State {
    const st = new State();
    for (const o of outs) st.performOutcome(o);
    return st;
  }

  /** Le `sat` gelé, restreint aux conditions `Match` closes (toute autre forme est une erreur de portage). */
  function sat(st: State, conds: readonly Condition[]): boolean {
    return conds.every((c) => {
      if (c.t === 'match') return st.dbHas(c.s);
      throw new Error(`this spec only asserts ground Match conditions, got ${JSON.stringify(c)}`);
    });
  }

  // R: deontic.rs obliged_head_is_the_shared_vocabulary_constant
  // H: DeonticSpec.hs "entailment closure (□ property 1)"
  // H: DeonticSpec.hs "obligedHead is the shared vocabulary constant"
  test('obliged_head_is_the_shared_vocabulary_constant', () => {
    assert.equal(OBLIGED_HEAD, 'obliged');
    assert.equal(obligationPath('bex', 'settle.up'), `${OBLIGED_HEAD}.bex.settle.up`);
  });

  // R: deontic.rs obliged_lift_lifts_an_all_match_rule
  // H: DeonticSpec.hs "obligedLift lifts an all-Match rule to the obliged.Obligor shape"
  test('obliged_lift_lifts_an_all_match_rule', () => {
    assert.deepEqual(obligedLift(axiom([m('at.W.bar')], ['in.W.building'])), axiom([m('obliged.Obligor.at.W.bar')], ['obliged.Obligor.in.W.building']));
  });

  // R: deontic.rs obliged_lift_refuses_a_non_match_body
  // H: DeonticSpec.hs "obligedLift refuses a rule whose body uses a non-Match condition"
  test('obliged_lift_refuses_a_non_match_body', () => {
    assert.equal(obligedLift(axiom([m('at.W.bar'), not_('dead.W')], ['in.W.building'])), null);
  });

  // R: deontic.rs obliged_close_is_the_base_rules_plus_the_lifted_twins
  // H: DeonticSpec.hs "obligedClose = the base rules plus the lifted twin of each all-Match rule"
  test('obliged_close_is_the_base_rules_plus_the_lifted_twins', () => {
    const liftable = axiom([m('a.X')], ['b.X']);
    const unliftable = axiom([m('c.Y'), not_('d.Y')], ['e.Y']);
    assert.deepEqual(obligedClose([liftable, unliftable]), [liftable, unliftable, axiom([m('obliged.Obligor.a.X')], ['obliged.Obligor.b.X'])]);
  });

  // R: deontic.rs obligation_path_is_obliged_who_content
  // H: DeonticSpec.hs "fact conventions"
  // H: DeonticSpec.hs "obligationPath is obliged.<who>.<content>"
  test('obligation_path_is_obliged_who_content', () => {
    assert.equal(obligationPath('bex', 'settle.up'), 'obliged.bex.settle.up');
  });

  // R: deontic.rs is_obliged_matches_the_obligation_fact
  // H: DeonticSpec.hs "isObliged matches the obligation fact"
  test('is_obliged_matches_the_obligation_fact', () => {
    assert.deepEqual(isObliged('bex', 'settle.up'), m('obliged.bex.settle.up'));
  });

  // R: deontic.rs in_breach_is_a_violation
  // H: DeonticSpec.hs "inBreach is a violation (breach reuses the norm machinery)"
  test('in_breach_is_a_violation', () => {
    assert.deepEqual(inBreach('bex', 'settle.up'), violationOf('bex', 'settle.up'));
  });

  // R: deontic.rs oblige_asserts_discharge_retracts
  // H: DeonticSpec.hs "obligation lifecycle"
  // H: DeonticSpec.hs "oblige asserts, discharge retracts"
  test('oblige_asserts_discharge_retracts', () => {
    const st = applyAll([oblige('bex', 'settle.up')]);
    assert.ok(st.labeledFacts().includes('obliged.bex.settle.up'), 'the obligation fact is asserted');
    assert.ok(sat(st, [isObliged('bex', 'settle.up')]));
    st.performOutcome(discharge('bex', 'settle.up'));
    assert.ok(!st.labeledFacts().includes('obliged.bex.settle.up'), 'the obligation is retracted');
  });

  // R: deontic.rs breach_records_a_violation_matched_by_in_breach
  // H: DeonticSpec.hs "breach records a violation matched by inBreach"
  test('breach_records_a_violation_matched_by_in_breach', () => {
    const st = applyAll([breach('bex', 'stiffed')]);
    assert.ok(st.labeledFacts().includes('violated.bex.stiffed'), 'the violation fact');
    assert.ok(sat(st, [inBreach('bex', 'stiffed')]));
  });

  // R: deontic.rs fulfilled_needs_the_obligation_and_its_content
  // H: DeonticSpec.hs "fulfilled needs the obligation AND its content (ought is not is)"
  test('fulfilled_needs_the_obligation_and_its_content', () => {
    const obligedOnly = applyAll([oblige('bex', 'tipped.ada')]);
    const met = applyAll([oblige('bex', 'tipped.ada'), insert('tipped.ada')]);
    assert.ok(!sat(obligedOnly, fulfilled('bex', 'tipped.ada')), 'unmet while the content is absent — ought does not collapse to is');
    assert.ok(sat(met, fulfilled('bex', 'tipped.ada')));
  });

  // R: deontic.rs oblige_reparative_nests_the_obligation
  // H: DeonticSpec.hs "contrary-to-duty (iterated box)"
  // H: DeonticSpec.hs "obligeReparative nests the obligation (square-square)"
  test('oblige_reparative_nests_the_obligation', () => {
    const st = applyAll([obligeReparative('bex', 'make.amends')]);
    assert.ok(st.labeledFacts().includes('obliged.bex.obliged.bex.make.amends'), `the nested reparative duty, got ${JSON.stringify(st.labeledFacts())}`);
    assert.ok(sat(st, [isObliged('bex', obligationPath('bex', 'make.amends'))]), 'matchable as an obligation-about-an-obligation');
  });

  // R: deontic.rs incompatible_exclusive_values_of_one_slot_collapse
  // H: DeonticSpec.hs "conflict detection (paper property 2)"
  // H: DeonticSpec.hs "incompatible: exclusive values of one slot collapse"
  test('incompatible_exclusive_values_of_one_slot_collapse', () => {
    assert.equal(conflicts('go!true', 'go!false'), true);
  });

  // R: deontic.rs compatible_multi_valued_siblings_coexist
  // H: DeonticSpec.hs "compatible: multi-valued siblings coexist"
  test('compatible_multi_valued_siblings_coexist', () => {
    assert.equal(conflicts('likes.a', 'likes.b'), false);
  });

  // R: deontic.rs unrelated_slots_never_conflict
  // H: DeonticSpec.hs "unrelated slots never conflict"
  test('unrelated_slots_never_conflict', () => {
    assert.equal(conflicts('tipped.ada', 'boarded.train'), false);
  });

  // R: deontic.rs a_content_does_not_conflict_with_itself
  // H: DeonticSpec.hs "a content does not conflict with itself"
  test('a_content_does_not_conflict_with_itself', () => {
    assert.equal(conflicts('go!true', 'go!true'), false);
  });

  // R: deontic.rs two_exclusive_locations_for_one_agent_conflict
  // H: DeonticSpec.hs "two exclusive locations for one agent conflict"
  test('two_exclusive_locations_for_one_agent_conflict', () => {
    assert.equal(conflicts('practice.world.world.at.bex!bar', 'practice.world.world.at.bex!entrance'), true);
  });

  // R: deontic.rs incompatible_pairs_finds_exactly_the_incompatible_pair
  // H: DeonticSpec.hs "incompatiblePairs finds exactly the incompatible pair"
  test('incompatible_pairs_finds_exactly_the_incompatible_pair', () => {
    assert.deepEqual(incompatiblePairs(['at!bar', 'at!entrance', 'tipped.ada']), [['at!bar', 'at!entrance']]);
  });

  // R: deontic.rs conflicts_rejects_a_malformed_content_rather_than_panicking
  test('conflicts_rejects_a_malformed_content_rather_than_panicking', () => {
    throwsKind(() => conflicts('go.', 'go!false'), 'TrailingOperator', 'a trailing operator is rejected, as Prax.Db.tokens rejects it');
    throwsKind(() => incompatiblePairs(['ok.fine', 'go.']), 'TrailingOperator', 'incompatiblePairs propagates the rejection');
  });

  // R: deontic.rs obligations_of_lists_an_agents_current_duties
  // H: DeonticSpec.hs "introspection"
  // H: DeonticSpec.hs "obligationsOf lists an agent's current duties"
  test('obligations_of_lists_an_agents_current_duties', () => {
    let db = emptyDb();
    for (const o of [oblige('bex', 'settle.up'), oblige('bex', 'greet.ada'), oblige('cai', 'leave.now')]) {
      if (o.t !== 'insert') throw new Error(`oblige builds an Insert, got ${JSON.stringify(o)}`);
      db = insertStr(db, o.s);
    }
    const bex = obligationsOf('bex', db);
    assert.ok(bex.includes('settle.up'), `got ${JSON.stringify(bex)}`);
    assert.ok(bex.includes('greet.ada'), `got ${JSON.stringify(bex)}`);
    assert.ok(!bex.some((s) => s.includes('leave')), `other agents excluded, got ${JSON.stringify(bex)}`);
  });

  /** Le `conductWorld` gelé : un seul agent `gil`, dont le choix ne dépend que de ses envies. */
  function conductWorld(acts: ReadonlyArray<readonly [string, readonly Condition[], readonly Outcome[]]>, wants: readonly Want[]): State {
    const p = prac(
      'conduct',
      ['X'],
      acts.map(([label, cs, os]) => action(label, cs, os)),
      'conduct',
    );
    const st = new State();
    st.definePractices([p]);
    st.setCharacters([ch('gil', wants)]);
    st.performOutcome(insert('practice.conduct.gil'));
    return st;
  }

  const gil = (st: State): Character => member(st, 'gil');

  // R: deontic.rs an_agent_pursues_the_action_that_fulfils_its_obligation
  // H: DeonticSpec.hs "behavioural coupling (planner unchanged)"
  // H: DeonticSpec.hs "an agent pursues the action that fulfils its obligation"
  test('an_agent_pursues_the_action_that_fulfils_its_obligation', () => {
    const st = conductWorld(
      [
        ['[Actor]: do the duty', [], [insert('did.duty')]],
        ['[Actor]: slack off', [], [insert('did.nothing')]],
      ],
      [wantFulfilled('gil', 'did.duty', 20)],
    );
    st.performOutcome(oblige('gil', 'did.duty'));
    assert.equal(picked(st, 1, gil(st)), 'gil: do the duty');
  });

  // R: deontic.rs an_agent_avoids_an_action_that_would_breach_a_duty
  // H: DeonticSpec.hs "an agent avoids an action that would breach a duty"
  test('an_agent_avoids_an_action_that_would_breach_a_duty', () => {
    const st = conductWorld(
      [
        ['[Actor]: behave', [], []],
        ['[Actor]: transgress', [], [breach('gil', 'tipping')]],
      ],
      [avoidBreach('gil', 'tipping', 50)],
    );
    assert.equal(picked(st, 1, gil(st)), 'gil: behave');
  });

  // R: deontic.rs conflicting_duties_the_planner_fulfils_the_higher_valued
  // H: DeonticSpec.hs "conflicting duties: planner fulfils the higher-valued; the other is foreclosed"
  test('conflicting_duties_the_planner_fulfils_the_higher_valued', () => {
    const st = conductWorld(
      [
        ['[Actor]: help alice', [not_('committed')], [insert('helped.alice'), insert('committed!alice')]],
        ['[Actor]: help bob', [not_('committed')], [insert('helped.bob'), insert('committed!bob')]],
      ],
      [wantFulfilled('gil', 'helped.alice', 30), wantFulfilled('gil', 'helped.bob', 10)],
    );
    for (const o of [oblige('gil', 'helped.alice'), oblige('gil', 'helped.bob')]) st.performOutcome(o);
    assert.ok(
      sat(st, [isObliged('gil', 'helped.alice')]) && sat(st, [isObliged('gil', 'helped.bob')]),
      'both duties are genuinely held at once (distinct contents coexist)',
    );
    const chosen = st.pickAction(1, gil(st));
    assert.equal(chosen?.label ?? null, 'gil: help alice', 'resolution is emergent: the higher-utility duty wins');
    if (chosen !== null) st.performAction(chosen);
    assert.ok(!st.possibleActions('gil').some((a) => a.label.includes('help bob')), 'helping bob is now foreclosed');
    assert.ok(sat(st, [isObliged('gil', 'helped.bob')]) && !sat(st, fulfilled('gil', 'helped.bob')), "bob's duty is still owed, and unfulfillable");
  });

  // R: deontic.rs axiom_footprint_collects_bodies_heads_and_obliged_close_lifts
  // H: DeriveSpec.hs "axiomFootprint collects bodies (any polarity) and heads; obligedClose adds the lifted forms"
  test('axiom_footprint_collects_bodies_heads_and_obliged_close_lifts', () => {
    const ax = axiom([m('parent.X.Y'), absent([m('dead.X')])], ['elder.X']);
    const fp = axiomFootprint(compileRules([ax]));
    assert.ok(hasPath(fp, 'parent.X.Y'), 'body atom');
    assert.ok(hasPath(fp, 'dead.X'), 'negated body atom');
    assert.ok(hasPath(fp, 'elder.X'), 'head');

    const baseAx = [axiom([m('a.X')], ['b.X'])];
    const bare = axiomFootprint(compileRules(baseAx));
    const closed = axiomFootprint(compileRules(obligedClose(baseAx)));
    assert.ok(hasPath(bare, 'a.X'), 'bare base body kept');
    assert.ok(hasPath(bare, 'b.X'), 'bare base head kept');
    assert.ok(!hasPath(bare, 'obliged.Obligor.a.X'), 'bare has no lifted body');
    assert.ok(!hasPath(bare, 'obliged.Obligor.b.X'), 'bare has no lifted head');
    assert.ok(hasPath(closed, 'obliged.Obligor.a.X'), 'obligedClose lifts body');
    assert.ok(hasPath(closed, 'obliged.Obligor.b.X'), 'obligedClose lifts head');
  });

  // R: deontic.rs obliged_close_closes_an_obliged_context
  // H: DeriveSpec.hs "obligedClose: a domain rule (written once) also closes under obligation"
  test('obliged_close_closes_an_obliged_context', () => {
    const axs = [axiom([m('at.W.bar')], ['in.W.building'])];
    const base = build(['obliged.bex.at.bex.bar']);

    const closed = close(compileRules(obligedClose(axs)), base);
    assert.ok(!isContradiction(closed), 'closure under the declared rules is consistent');
    assert.ok(toSentences(closed).includes('obliged.bex.in.bex.building'), 'sub-obligation derived under declared closure (□a ⊢ □b)');

    const bare = close(compileRules(axs), base);
    assert.ok(!isContradiction(bare), 'bare closure is consistent');
    assert.ok(!toSentences(bare).includes('obliged.bex.in.bex.building'), 'bare closure does NOT lift');
  });
});

// =====================================================================================
// coerce.rs — H: CoerceSpec.hs "Prax.Coerce"
// =====================================================================================

describe('coerce', () => {
  /** Le racket de protection : sans preuve (posséder une grange suffit), noyau = vengeance. */
  function racket(): Coercion {
    return {
      id: 'racket',
      victim: 'V',
      trigger: [matches('barn.V')],
      threatenLabel: '[Actor]: threaten [V]',
      demandLabel: "[Actor]: do [E]'s favor",
      demand: owe('E', 'Actor', 'favor'),
      punishLabel: "[Actor]: burn [V]'s barn",
      punishWhen: [matches('barn.V'), not_('burned.barn.V')],
      punishOuts: [insert('burned.barn.V')],
      kernel: [matches('burned.barn.V')],
      weight: 9,
      threatLasts: null,
      complianceLasts: null,
    };
  }

  /** L'alternative « ne rien faire » ; son libellé se trie AVANT « threaten ». */
  const bideAct = (): Action => action('[Actor]: bide');

  const actsOf = (co: Coercion): Action[] => coerce(co)[1];

  /** Monde de territoire : mob porte la vengeance ssi `holdsWant`, vic craint la grange brûlée et la dette. */
  function mkTurfWorldWith(co: Coercion, holdsWant: boolean): State {
    const [pun, acts] = coerce(co);
    const turf = prac('turf', ['R'], [...acts, bideAct()]);
    const mob = ch('mob', [], holdsWant ? [pun.name] : []);
    const st = new State();
    st.definePractices([turf]);
    st.setCharacters([mob, ch('vic', [want([matches('burned.barn.vic')], -12), want([owes('mob', 'vic', 'favor')], -4)])]);
    for (const o of [insert('practice.turf.here'), insert('barn.vic')]) st.performOutcome(o);
    st.setDesires([pun]);
    return st;
  }

  const mkWorld = (holdsWant: boolean): State => mkTurfWorldWith(racket(), holdsWant);
  const mkTurfWorld = (co: Coercion): State => mkTurfWorldWith(co, true);

  /** v54 : racket en série — le marqueur `complied` expire après 2 frontières. */
  const cyclingRacket = (): Coercion => ({ ...racket(), complianceLasts: 2 });
  /** v54 : menace qui expire ; le bras DÉFIÉ n'est pas touché. */
  const expiringRacket = (): Coercion => ({ ...racket(), threatLasts: 2 });

  function boundaries(k: number, st: State): void {
    for (let i = 0; i < k; i++) st.roundBoundary();
  }

  const isInsertFor = (o: Outcome): boolean => o.t === 'insertFor';

  /** v54 : contre-coercition — le déclencheur lit la marque d'extorsion ; `M` lie l'extorqueur. */
  function counter(): Coercion {
    return {
      id: 'counter',
      victim: 'M',
      trigger: [matches('M.extorted.vic.racket')],
      threatenLabel: '[Actor]: threaten to expose [M]',
      demandLabel: "[Actor]: take [E]'s protection",
      demand: owe('E', 'Actor', 'protection'),
      punishLabel: '[Actor]: expose [M] as an extorter',
      punishWhen: [not_('exposed.M')],
      punishOuts: [insert('exposed.M')],
      kernel: [matches('exposed.M')],
      weight: 9,
      threatLasts: null,
      complianceLasts: null,
    };
  }

  function counterWorld(): State {
    const turf = prac('turf', ['R'], [...actsOf(racket()), bideAct()]);
    const countyard = prac('countyard', ['R'], [...actsOf(counter()), bideAct()]);
    const st = new State();
    st.definePractices([turf, countyard]);
    st.setCharacters([ch('mob', [], ['punishes-racket']), ch('vic', [], ['punishes-counter'])]);
    for (const o of [insert('practice.turf.here'), insert('practice.countyard.here'), insert('barn.vic')]) st.performOutcome(o);
    st.setDesires([coerce(racket())[0], coerce(counter())[0]]);
    return st;
  }

  const court = (): CoPresence => [matches('at.Actor!P'), matches('at.Witness!P')];

  /** Coercition en forme de chantage construite directement par `coerce` (déclencheur nommant `Actor`). */
  function blackmailShaped(): Coercion {
    return {
      id: 'leverage',
      victim: 'V',
      trigger: [matches('Actor.believes.stole.V.loaf'), ...asRole('V', court())],
      threatenLabel: '[Actor]: threaten [V] with what you know',
      demandLabel: "[Actor]: buy [E]'s silence",
      demand: owe('E', 'Actor', 'silence'),
      punishLabel: '[Actor]: expose [V] to [Hearer]',
      punishWhen: [matches('Actor.believes.stole.V.loaf'), neq('Hearer', 'V'), ...asRole('Hearer', court())],
      punishOuts: [insert('Hearer.believes.stole.V.loaf')],
      kernel: [matches('W.believes.stole.V.loaf')],
      weight: 6,
      threatLasts: null,
      complianceLasts: null,
    };
  }

  function leverageWorld(): State {
    const courtP = prac('court', ['R'], actsOf(blackmailShaped()));
    const st = new State();
    st.definePractices([courtP]);
    st.setCharacters([ch('mel', [], ['punishes-leverage']), ch('vic')]);
    for (const o of [insert('practice.court.here'), insert('mel.believes.stole.vic.loaf'), insert('at.mel.court'), insert('at.vic.court')]) st.performOutcome(o);
    st.setDesires([coerce(blackmailShaped())[0]]);
    return st;
  }

  // R: coerce.rs a_dotted_id_errors_loudly
  // H: CoerceSpec.hs "guards"
  // H: CoerceSpec.hs "a dotted id errors loudly"
  test('a_dotted_id_errors_loudly', () => {
    throwsKind(() => coerce({ ...racket(), id: 'rac.ket' }), 'NotASinglePathSegment', 'a dotted id is an error');
  });

  // R: coerce.rs the_reserved_set_victim_actor_errors
  // H: CoerceSpec.hs "the reserved set: victim Actor errors (the previously-latent hole)"
  test('the_reserved_set_victim_actor_errors', () => {
    throwsKind(() => coerce({ ...racket(), victim: 'Actor' }), 'ReservedVarClash', 'victim Actor is reserved');
  });

  // R: coerce.rs the_reserved_set_victim_praxv_errors
  // H: CoerceSpec.hs "the reserved set: victim PraxV errors"
  test('the_reserved_set_victim_praxv_errors', () => {
    throwsKind(() => coerce({ ...racket(), victim: 'PraxV' }), 'ReservedVarClash', 'a Prax-namespaced victim is reserved');
  });

  // R: coerce.rs the_reserved_set_a_legal_victim_passes
  // H: CoerceSpec.hs "the reserved set: a legal victim passes"
  test('the_reserved_set_a_legal_victim_passes', () => {
    assert.doesNotThrow(() => coerce(racket()), 'an ordinary victim variable is fine');
  });

  // R: coerce.rs a_trigger_naming_a_prax_variable_errors_loudly
  // H: CoerceSpec.hs "a trigger naming a Prax-namespaced variable errors loudly (the v40 law, frame-independent)"
  test('a_trigger_naming_a_prax_variable_errors_loudly', () => {
    throwsKind(() => coerce({ ...racket(), trigger: [matches('spy.PraxW')] }), 'ReservedVarClash', 'a Prax var in the trigger is rejected');
  });

  // R: coerce.rs a_blackmail_shaped_coercion_naming_actor_constructs
  // H: CoerceSpec.hs "regression: the trigger guard must not forbid Actor (blackmail-shaped evidence, v49 Task 1 fix wave)"
  // H: CoerceSpec.hs "a blackmail-shaped Coercion whose trigger names Actor (the extorter's own evidence) constructs without error"
  test('a_blackmail_shaped_coercion_naming_actor_constructs', () => {
    assert.doesNotThrow(() => coerce(blackmailShaped()), "Actor is bound in threaten's own frame, not a capture");
  });

  // R: coerce.rs threaten_is_offered_and_fires
  // H: CoerceSpec.hs "threaten is offered and fires, depositing the threat marker"
  test('threaten_is_offered_and_fires', () => {
    const st = leverageWorld();
    assert.ok(offered('mel', 'threaten', st), 'threaten offered');
    doAct('mel', 'threaten', st);
    assert.ok(st.dbHas('threatened.leverage.mel.vic'), 'the threatened fact');
  });

  // R: coerce.rs the_authored_threaten_label_surfaces_exactly
  // H: CoerceSpec.hs "the authored threaten label surfaces exactly (BlackmailSpec:171's pinned shape, proven producible)"
  test('the_authored_threaten_label_surfaces_exactly', () => {
    const st = leverageWorld();
    const ga = st.possibleActions('mel').find((g) => g.label.includes('threaten'));
    assert.ok(ga !== undefined, 'no threaten action offered');
    assert.equal(ga.label, 'mel: threaten vic with what you know');
  });

  // R: coerce.rs an_authored_plain_var_kernel_lifts_the_victim_to_praxd
  // H: CoerceSpec.hs "the rename law"
  // H: CoerceSpec.hs "an authored plain-var kernel lifts the victim to PraxD"
  test('an_authored_plain_var_kernel_lifts_the_victim_to_praxd', () => {
    const [pun] = coerce(racket());
    assert.ok(containsDeep(pun.want.when, matches('burned.barn.PraxD')), `kernel V became PraxD; had ${JSON.stringify(pun.want.when)}`);
  });

  // R: coerce.rs two_fresh_quantifiers_get_distinct_names_in_first_appearance_order
  // H: CoerceSpec.hs "two fresh quantifiers get distinct names (PraxW, PraxW2), first-appearance order"
  test('two_fresh_quantifiers_get_distinct_names_in_first_appearance_order', () => {
    const [pun] = coerce({ ...racket(), kernel: [matches('burned.barn.V'), matches('ally.A.of.B')] });
    assert.ok(containsDeep(pun.want.when, matches('ally.PraxW.of.PraxW2')), `A -> PraxW and B -> PraxW2; had ${JSON.stringify(pun.want.when)}`);
  });

  // R: coerce.rs an_authored_kernel_naming_a_prax_variable_errors_loudly
  // H: CoerceSpec.hs "an authored kernel naming a Prax variable errors loudly (no author writes one)"
  test('an_authored_kernel_naming_a_prax_variable_errors_loudly', () => {
    throwsKind(() => coerce({ ...racket(), kernel: [matches('burned.barn.PraxW')] }), 'ReservedVarClash', 'a Prax var in the kernel is rejected');
  });

  // R: coerce.rs threatening_deposits_the_marker_the_motive_belief_and_the_mark
  // H: CoerceSpec.hs "threaten deposits and the punish gate"
  // H: CoerceSpec.hs "threatening deposits the marker, the motive-belief, and the extorted mark"
  test('threatening_deposits_the_marker_the_motive_belief_and_the_mark', () => {
    const st = mkWorld(true);
    doAct('mob', 'threaten', st);
    assert.ok(st.dbHas('threatened.racket.mob.vic'), 'the threatened fact');
    assert.ok(st.dbHas('vic.believes.desires.mob.punishes-racket.heard.mob'), "the motive-belief deposit: vic hears mob's professed punitive intent");
    assert.ok(st.dbHas('mob.extorted.vic.racket'), 'the extorted mark, tailed by the coercion id');
  });

  // R: coerce.rs punish_fires_against_a_standing_threat
  // H: CoerceSpec.hs "punish fires against a STANDING threat, with no defiance"
  test('punish_fires_against_a_standing_threat', () => {
    const st = mkWorld(true);
    doAct('mob', 'threaten', st);
    assert.ok(!st.dbHas('defied.racket.vic.mob'), 'vic has not defied');
    assert.ok(offered('mob', 'burn', st), 'burning is offered against the standing threat alone');
    doAct('mob', 'burn', st);
    assert.ok(st.dbHas('burned.barn.vic'), 'the barn is burned');
  });

  // R: coerce.rs stalling_never_dominates
  // H: CoerceSpec.hs "property 1: stalling never dominates"
  // H: CoerceSpec.hs "under a standing threat, bide never strictly beats both comply and defy"
  test('stalling_never_dominates', () => {
    const st = mkWorld(true);
    doAct('mob', 'threaten', st);
    const scores = st.scoreActions(2, member(st, 'vic'));
    const bide = scoreOf(scores, 'vic: bide');
    const comply = scoreOf(scores, 'favor');
    const defy = scoreOf(scores, 'vic: defy');
    assert.ok(!(bide > comply && bide > defy), `bide must not dominate; had bide=${bide} comply=${comply} defy=${defy}`);
  });

  // R: coerce.rs repeat_extraction_is_impossible
  // H: CoerceSpec.hs "property 3: repeat extraction is impossible"
  // H: CoerceSpec.hs "after compliance, a renewed threat offers no re-buy (the permanent complied marker)"
  test('repeat_extraction_is_impossible', () => {
    const st = mkWorld(true);
    doAct('mob', 'threaten', st);
    doAct('vic', 'favor', st);
    doAct('mob', 'threaten', st);
    assert.ok(st.dbHas('complied.racket.mob.vic'), 'the permanent complied marker survives');
    assert.ok(st.dbHas('threatened.racket.mob.vic'), 'the renewed threat is standing');
    assert.ok(!offered('vic', 'favor', st), 'comply is not offered a second time');
    const ga = st.pickAction(2, member(st, 'vic'));
    assert.ok(!(ga !== null && ga.label.includes('favor')), "the victim's chosen response is not a re-buy");
  });

  // R: coerce.rs the_extorter_chooses_to_threaten_holding_the_punitive_want
  // H: CoerceSpec.hs "property 5: credibility is self-motivation (the vengeance, base-less kernel)"
  // H: CoerceSpec.hs "the extorter CHOOSES to threaten at depth 2, holding the punitive want"
  test('the_extorter_chooses_to_threaten_holding_the_punitive_want', () => {
    const st = mkWorld(true);
    assert.equal(picked(st, 2, member(st, 'mob')), 'mob: threaten vic');
  });

  // R: coerce.rs without_the_punitive_want_the_choice_collapses
  // H: CoerceSpec.hs "without the punitive want, the same choice collapses to doing nothing"
  test('without_the_punitive_want_the_choice_collapses', () => {
    const st = mkWorld(false);
    assert.equal(picked(st, 2, member(st, 'mob')), 'mob: bide');
  });

  // R: coerce.rs nothing_is_today_the_default_markers_are_permanent_inserts
  // H: CoerceSpec.hs "v54 property 1: Nothing is today (the default markers compile to permanent Inserts)"
  // H: CoerceSpec.hs "the racket's compiled threaten and comply carry Insert for both markers, no InsertFor"
  test('nothing_is_today_the_default_markers_are_permanent_inserts', () => {
    const acts = actsOf(racket());
    const [threaten, comply] = [acts[0], acts[1]];
    assert.ok(containsDeep(threaten.then, insert('threatened.racket.Actor.V')), "threaten's marker is a permanent Insert");
    assert.ok(containsDeep(comply.then, insert('complied.racket.E.Actor')), "comply's complied marker is a permanent Insert");
    assert.ok(![...threaten.then, ...comply.then].some(isInsertFor), 'neither marker is an InsertFor (byte-identical to the shipped compilation)');
  });

  // R: coerce.rs the_racket_cycles_under_an_expiring_complied_marker
  // H: CoerceSpec.hs "v54 property 2: the racket cycles under an expiring complied marker"
  // H: CoerceSpec.hs "one purchase per bought period; the marker expires and the extorter extracts again"
  test('the_racket_cycles_under_an_expiring_complied_marker', () => {
    const st = mkTurfWorld(cyclingRacket());
    doAct('mob', 'threaten', st);
    doAct('vic', 'favor', st);
    assert.ok(st.dbHas('debt.mob.vic.favor'), 'the demand fact lands (first extraction)');
    assert.ok(st.dbHas('complied.racket.mob.vic'), 'the complied marker holds after compliance');
    doAct('mob', 'threaten', st);
    assert.ok(st.dbHas('threatened.racket.mob.vic'), 'the re-threat stands');
    assert.ok(!offered('vic', 'favor', st), 'comply is BLOCKED within the bought period (the complied marker gates it)');
    boundaries(2, st);
    assert.ok(!st.dbHas('complied.racket.mob.vic'), 'the complied marker expired after 2 boundaries');
    assert.ok(offered('vic', 'favor', st), 'comply is available AGAIN under the still-standing threat');
    doAct('vic', 'favor', st);
    assert.ok(!st.dbHas('threatened.racket.mob.vic'), 'the second extraction completes: the threat is bought off again');
    assert.ok(st.dbHas('complied.racket.mob.vic'), 'the complied marker is re-armed for the next bought period');
  });

  // R: coerce.rs mid_racket_save_resume_the_cycle_resumes_on_schedule
  // H: CoerceSpec.hs "v54: mid-racket save/resume (home: CoerceSpec — it exercises the racket's own cycle)"
  // H: CoerceSpec.hs "a save carrying the pending complied-expiry reloads and the cycle resumes on schedule"
  test('mid_racket_save_resume_the_cycle_resumes_on_schedule', () => {
    const complied = mkTurfWorld(cyclingRacket());
    doAct('mob', 'threaten', complied);
    doAct('vic', 'favor', complied);
    assert.ok(complied.expiriesRendered().size > 0, 'the complied-expiry due is pending before save');

    const reloaded = deserializeState(serializeState(complied), mkTurfWorld(cyclingRacket()));
    assert.ok(reloaded.dbHas('complied.racket.mob.vic'), 'the complied marker reloaded');

    doAct('mob', 'threaten', reloaded);
    assert.ok(!offered('vic', 'favor', reloaded), 'comply is BLOCKED right after reload (still within the bought period)');

    boundaries(2, reloaded);
    assert.ok(!reloaded.dbHas('complied.racket.mob.vic'), 'the complied marker expired on schedule after reload (the pending expiry rode the save)');
    assert.ok(offered('vic', 'favor', reloaded), 'the cycle resumes: comply is available again');
  });

  // R: coerce.rs the_deal_economics_as_observed
  // H: CoerceSpec.hs "v54: the deal economics, as observed (the no-fiat ruling — no marker enforces the deal)"
  // H: CoerceSpec.hs "during the bought period the extorter's punish-vs-bide goes where the vengeance utilities point"
  test('the_deal_economics_as_observed', () => {
    const st = mkTurfWorld(cyclingRacket());
    doAct('mob', 'threaten', st);
    doAct('vic', 'favor', st);
    doAct('mob', 'threaten', st);
    const mob = member(st, 'mob');
    const scores = st.scoreActions(2, mob);
    const burn = scoreOf(scores, 'burn');
    const bide = scoreOf(scores, 'mob: bide');
    const chose = picked(st, 2, mob);
    assert.ok(burn > bide, `observed betrayal: burn=${burn} bide=${bide} chose=${chose}`);
    assert.equal(chose, "mob: burn vic's barn");
  });

  // R: coerce.rs a_stale_threat_is_spent
  // H: CoerceSpec.hs "v54 property 3: a stale threat is spent, but a defied threat's punish survives"
  // H: CoerceSpec.hs "after n boundaries an unanswered threat stops offering punish and stops pressuring comply"
  test('a_stale_threat_is_spent', () => {
    const st = mkTurfWorld(expiringRacket());
    doAct('mob', 'threaten', st);
    assert.ok(offered('mob', 'burn', st), 'punish (burn) offered while the threat stands');
    boundaries(2, st);
    assert.ok(!st.dbHas('threatened.racket.mob.vic'), 'the threat marker expired after 2 boundaries');
    assert.ok(!offered('mob', 'burn', st), "punish's standing arm is gone (no burn offered)");
    assert.ok(!offered('vic', 'favor', st), 'comply is no longer pressured (not offered — no standing threat)');
  });

  // R: coerce.rs a_defied_threats_punish_survives_expiry
  // H: CoerceSpec.hs "a DEFIED threat's punish survives expiry (the defied marker is permanent)"
  test('a_defied_threats_punish_survives_expiry', () => {
    const st = mkTurfWorld(expiringRacket());
    doAct('mob', 'threaten', st);
    doAct('vic', 'defy', st);
    boundaries(3, st);
    assert.ok(st.dbHas('defied.racket.vic.mob'), "the defied marker stands permanently past the threat's expiry");
    assert.ok(offered('mob', 'burn', st), 'burn is still offered via the defied arm, past expiry');
  });

  // R: coerce.rs the_bluff_pairs_victim_decision_is_identical
  // H: CoerceSpec.hs "v54 property 5: the bluff pair — registered-not-held vs registered-and-held"
  // H: CoerceSpec.hs "the victim's comply/defy decision is IDENTICAL (the fear resolves on the registered vocabulary)"
  test('the_bluff_pairs_victim_decision_is_identical', () => {
    const g = mkWorld(true); // sincère : enregistré ET porté
    const b = mkWorld(false); // bluff : enregistré, NON porté
    doAct('mob', 'threaten', g);
    doAct('mob', 'threaten', b);
    const gvic = member(g, 'vic');
    const bvic = member(b, 'vic');
    const gs = g.scoreActions(2, gvic);
    const bs = b.scoreActions(2, bvic);
    for (const needle of ['favor', 'vic: defy', 'vic: bide']) assert.equal(scoreOf(gs, needle), scoreOf(bs, needle), needle);
    assert.equal(picked(g, 2, gvic), picked(b, 2, bvic));
  });

  // R: coerce.rs defied_the_genuine_extorter_punishes_and_the_bluffer_does_not
  // H: CoerceSpec.hs "defied, the genuine extorter picks punish; the bluffer (holding no want) does not"
  test('defied_the_genuine_extorter_punishes_and_the_bluffer_does_not', () => {
    const g = mkWorld(true);
    const b = mkWorld(false);
    for (const st of [g, b]) {
      doAct('mob', 'threaten', st);
      doAct('vic', 'defy', st);
    }
    const gp = g.pickAction(2, member(g, 'mob'));
    const bp = b.pickAction(2, member(b, 'mob'));
    assert.ok(gp !== null && gp.label.includes('burn'), 'genuine mob punishes after defiance');
    assert.ok(!(bp !== null && bp.label.includes('burn')), 'the bluffing mob declines punish (its choice is bide, not burn)');
  });

  // R: coerce.rs counter_coercion_is_composition
  // H: CoerceSpec.hs "v54 property 7: the table turns — counter-coercion is composition"
  // H: CoerceSpec.hs "once extorted, the victim reaches a standing counter-threat from pure content over the shipped surface"
  test('counter_coercion_is_composition', () => {
    const st = counterWorld();
    doAct('mob', 'threaten', st);
    assert.ok(st.dbHas('mob.extorted.vic.racket'), "mob's threaten deposited the extorted mark the counter reads");
    assert.ok(offered('vic', 'threaten to expose', st), 'vic can now counter-threaten mob (the variable extorter slot bound M to mob)');
    assert.equal(picked(st, 2, member(st, 'vic')), 'vic: threaten to expose mob');
    doAct('vic', 'threaten to expose', st);
    assert.ok(st.dbHas('threatened.racket.mob.vic'), 'the racket threat stands');
    assert.ok(st.dbHas('threatened.counter.vic.mob'), 'the counter threat stands — both threats live at once');
  });

  // R: coerce.rs namespace_kernel_numbers_in_first_appearance_order_never_praxw1
  test('namespace_kernel_numbers_in_first_appearance_order_never_praxw1', () => {
    const kernel = [matches('burned.barn.Z'), matches('ally.A.of.V'), matches('knows.Owner.A')];
    assert.deepEqual(
      namespaceKernel('V', kernel),
      [matches('burned.barn.PraxW'), matches('ally.PraxW2.of.PraxD'), matches('knows.Owner.PraxW2')],
      'first appearance order (Z before A), Owner exempt, victim to PraxD, no PraxW1',
    );
  });

  // R: coerce.rs namespace_kernel_preserves_operators_and_moves_binders
  test('namespace_kernel_preserves_operators_and_moves_binders', () => {
    const kernel = [matches('hoard.V!W'), subquery('S', ['W'], [matches('saw.W.V')]), count('N', 'S'), cmp('gte', 'N', '2')];
    assert.deepEqual(namespaceKernel('V', kernel), [
      matches('hoard.PraxD!PraxW'),
      subquery('PraxW2', ['PraxW'], [matches('saw.PraxW.PraxD')]),
      count('PraxW3', 'PraxW2'),
      cmp('gte', 'PraxW3', '2'),
    ]);
  });
});

// =====================================================================================
// blackmail.rs — H: BlackmailSpec.hs "Prax.Blackmail"
// =====================================================================================

describe('blackmail', () => {
  const shakedownParts = (): [Desire, Action[]] => shakedown('defiance', together(), 'took.V.gem', 'favor', 6);

  const waitAction = (): Action => action('[Actor]: wait', [matches('at.Actor!P')]);

  function yardPractice(): Practice {
    const [, acts] = shakedownParts();
    return prac('yard', ['R'], [...acts, waitAction()]);
  }

  const fearsScandal = (): Desire => desire('fears-scandal', want([matches('W.believes.took.Owner.gem')], -10));

  /** `twoOnlookers` : wit2 à la cour (vs au moulin) — seule variable entre les deux scénarios épinglés. */
  function mkWorld(twoOnlookers: boolean): State {
    const st = new State();
    st.definePractices([yardPractice()]);
    st.setCharacters([
      ch('mel', [want([owes('mel', 'vic', 'favor')], 8)], ['punishes-defiance']),
      ch('vic', [conceal('took.vic.gem', 12), want([matches('debt.C.vic.favor')], -4)], ['fears-scandal']),
      ch('wit'),
      ch('wit2'),
    ]);
    for (const o of [
      insert('practice.yard.here'),
      insert('at.mel!court'),
      insert('at.vic!court'),
      insert('at.wit!court'),
      insert(`at.wit2!${twoOnlookers ? 'court' : 'mill'}`),
      insert('mel.believes.took.vic.gem.seen'),
    ])
      st.performOutcome(o);
    st.setAxioms([conventional()]);
    st.setDesires([shakedownParts()[0], fearsScandal()]);
    return st;
  }

  /** hal (scrupuleux) et rex (son jumeau sans principes) partagent le même motif d'extorsion. */
  function scrupulous(): Trait {
    return trait('scrupulous', [desire('qualms', want([matches('Owner.extorted.vic')], -20))]);
  }

  function deterrenceWorld(): State {
    const [roster, personaFacts] = cast(
      [scrupulous()],
      [
        [ch('hal', [want([owes('hal', 'vic', 'favor')], 8)], ['punishes-defiance']), [scrupulous()]],
        [ch('rex', [want([owes('rex', 'vic', 'favor')], 8)], ['punishes-defiance']), []],
        [ch('vic'), []],
        [ch('wit'), []],
      ],
    );
    const st = new State();
    st.definePractices([yardPractice()]);
    st.setCharacters(roster);
    st.setAxioms([conventional(), transparent()]);
    for (const o of [
      ...personaFacts,
      insert('practice.yard.here'),
      insert('at.hal!court'),
      insert('at.rex!court'),
      insert('at.vic!court'),
      insert('at.wit!court'),
      insert('hal.believes.took.vic.gem.seen'),
      insert('rex.believes.took.vic.gem.seen'),
    ])
      st.performOutcome(o);
    st.setDesires([shakedownParts()[0], ...personaVocabulary([scrupulous()])]);
    return st;
  }

  // R: blackmail.rs a_dotted_id_errors_loudly
  // H: BlackmailSpec.hs "guards"
  // H: BlackmailSpec.hs "a dotted id errors loudly"
  test('a_dotted_id_errors_loudly', () => {
    throwsKind(() => shakedown('de.f', together(), 'took.V.gem', 'favor', 6), 'NotASinglePathSegment', 'a dotted id is an error');
  });

  // R: blackmail.rs an_evidence_pattern_naming_no_one_errors_loudly
  // H: BlackmailSpec.hs "an evidence pattern naming no one errors loudly"
  test('an_evidence_pattern_naming_no_one_errors_loudly', () => {
    throwsKind(() => shakedown('defiance', together(), 'somethinghappened', 'favor', 6), 'PatternVariables', 'a threat must be about someone');
  });

  // R: blackmail.rs a_secondary_variable_named_d_or_w_no_longer_collides
  // H: BlackmailSpec.hs "the usability win: a secondary evidence variable named D or W no longer collides (v40 moved the punitive desire's own machinery to the Prax namespace)"
  test('a_secondary_variable_named_d_or_w_no_longer_collides', () => {
    assert.doesNotThrow(() => shakedown('x', [], 'took.V.from.D', 'favor', 1), 'D is an unremarkable secondary variable post-v40');
    assert.doesNotThrow(() => shakedown('x', [], 'took.V.by.W', 'favor', 1), 'W is an unremarkable secondary variable post-v40');
  });

  // R: blackmail.rs a_secondary_variable_in_the_prax_namespace_collides
  // H: BlackmailSpec.hs "a secondary evidence variable authoring the Prax namespace collides with the punitive desire's own machinery"
  test('a_secondary_variable_in_the_prax_namespace_collides', () => {
    throwsKind(() => shakedown('x', [], 'took.V.from.PraxD', 'favor', 1), 'ReservedVarClash', "PraxD is reserved for the punitive desire's own victim variable");
    throwsKind(() => shakedown('x', [], 'took.V.by.PraxW', 'favor', 1), 'ReservedVarClash', "PraxW is reserved for the punitive desire's own believer variable");
  });

  // R: blackmail.rs a_secondary_variable_named_actor_or_e_is_rejected_via_the_kernel_flow
  // H: BlackmailSpec.hs "a secondary evidence variable named Actor or E is rejected (via the kernel flow — v49 review M2)"
  test('a_secondary_variable_named_actor_or_e_is_rejected_via_the_kernel_flow', () => {
    throwsKind(() => shakedown('x', [], 'took.V.by.E', 'favor', 1), 'ReservedVarClash', "E is the comply/defy frame's extorter; a secondary named E merges");
    throwsKind(() => shakedown('x', [], 'took.V.by.Actor', 'favor', 1), 'ReservedVarClash', "Actor is every generated frame's actor; a secondary named Actor merges");
  });

  // R: blackmail.rs a_secondary_variable_named_owner_collides
  // H: BlackmailSpec.hs "a secondary evidence variable named Owner collides with the desire's Owner"
  test('a_secondary_variable_named_owner_collides', () => {
    throwsKind(() => shakedown('x', [], 'took.V.for.Owner', 'favor', 1), 'ReservedVarClash', "Owner is reserved for the desire's own Owner-templated variable");
  });

  // R: blackmail.rs a_secondary_variable_named_hearer_collides
  // H: BlackmailSpec.hs "a secondary evidence variable named Hearer collides with expose's own hearer"
  test('a_secondary_variable_named_hearer_collides', () => {
    throwsKind(() => shakedown('x', [], 'took.V.before.Hearer', 'favor', 1), 'ReservedVarClash', "Hearer is reserved for expose's (and gossip's) own hearer variable");
  });

  // R: blackmail.rs a_secondary_variable_named_actor_collides
  // H: BlackmailSpec.hs "a secondary evidence variable named Actor collides with the generated actions' own actor"
  test('a_secondary_variable_named_actor_collides', () => {
    throwsKind(() => shakedown('x', [], 'took.V.with.Actor', 'favor', 1), 'ReservedVarClash', "Actor is reserved for the generated actions' own actor variable");
  });

  // R: blackmail.rs the_extorter_threatens_at_depth_two
  // H: BlackmailSpec.hs "threaten: the extorter is motivated to threaten, and the threat deposits"
  // H: BlackmailSpec.hs "the extorter threatens at depth 2, holding the punitive desire via charDesires"
  test('the_extorter_threatens_at_depth_two', () => {
    const st = mkWorld(true);
    assert.equal(picked(st, 2, member(st, 'mel')), 'mel: threaten vic with what you know');
  });

  // R: blackmail.rs threatening_deposits_the_fact_the_motive_belief_and_the_mark
  // H: BlackmailSpec.hs "threatening deposits the ordinary fact, the motive-belief, and the extorted mark"
  test('threatening_deposits_the_fact_the_motive_belief_and_the_mark', () => {
    const st = mkWorld(true);
    doAct('mel', 'threaten vic', st);
    assert.ok(st.dbHas('threatened.defiance.mel.vic'), 'the threatened fact');
    assert.ok(st.dbHas('vic.believes.desires.mel.punishes-defiance.heard.mel'), "the motive-belief deposit: vic hears mel's professed punitive intent");
    assert.ok(st.dbHas('mel.extorted.vic.defiance'), "the extorted mark: mel's own memory of having extorted vic, tailed by the coercion id (v49)");
  });

  // R: blackmail.rs with_two_onlookers_compliance_dominates
  // H: BlackmailSpec.hs "two onlookers: the victim complies"
  // H: BlackmailSpec.hs "with two heads of exposure risk, compliance dominates waiting and defiance (property 2, ordering)"
  test('with_two_onlookers_compliance_dominates', () => {
    const st = mkWorld(true);
    doAct('mel', 'threaten vic', st);
    const vic = member(st, 'vic');
    const scores = st.scoreActions(2, vic);
    const comply = scoreOf(scores, "vic: buy mel's silence");
    const wait_ = scoreOf(scores, 'vic: wait');
    const defy = scoreOf(scores, 'vic: defy mel');
    assert.ok(comply > wait_ && wait_ > defy, `comply must dominate the ordering; had comply=${comply} wait=${wait_} defy=${defy}`);
    assert.equal(picked(st, 2, vic), "vic: buy mel's silence");
  });

  // R: blackmail.rs complying_leaves_a_debt_and_its_obligation
  // H: BlackmailSpec.hs "complying leaves a debt and its obligation, and the threat is gone"
  test('complying_leaves_a_debt_and_its_obligation', () => {
    const st = mkWorld(true);
    doAct('mel', 'threaten vic', st);
    doAct('vic', "buy mel's silence", st);
    assert.ok(st.dbHas('debt.mel.vic.favor'), 'the debt fact');
    assert.ok(st.dbHas(obligationPath('vic', 'favor')), 'the obligation Debt composes it from');
    assert.ok(!st.dbHas('threatened.defiance.mel.vic'), 'the threat is gone');
    assert.ok(!st.possibleActions('mel').some((ga) => ga.label.includes('expose vic')), 'expose is no longer offered against vic (no standing threat, no defiance)');
  });

  // R: blackmail.rs a_renewed_threat_after_compliance_extracts_nothing
  // H: BlackmailSpec.hs "a renewed threat after compliance extracts nothing (property 3 at the instance — v49 review M3)"
  test('a_renewed_threat_after_compliance_extracts_nothing', () => {
    const st = mkWorld(true);
    doAct('mel', 'threaten vic', st);
    doAct('vic', "buy mel's silence", st);
    doAct('mel', 'threaten vic', st);
    assert.ok(st.dbHas('complied.defiance.mel.vic'), 'the complied marker stands');
    assert.ok(!st.possibleActions('vic').some((ga) => ga.label.includes("buy mel's silence")), 'buy is not offered again under the renewed threat');
  });

  // R: blackmail.rs with_one_onlooker_defiance_ties_waiting_and_both_beat_compliance
  // H: BlackmailSpec.hs "one onlooker: the victim rationally defies (both sides of the arithmetic)"
  // H: BlackmailSpec.hs "with a single head of exposure risk, defiance ties waiting and both beat compliance (property 2, ordering)"
  test('with_one_onlooker_defiance_ties_waiting_and_both_beat_compliance', () => {
    const st = mkWorld(false);
    doAct('mel', 'threaten vic', st);
    const vic = member(st, 'vic');
    const scores = st.scoreActions(2, vic);
    const comply = scoreOf(scores, "vic: buy mel's silence");
    const wait_ = scoreOf(scores, 'vic: wait');
    const defy = scoreOf(scores, 'vic: defy mel');
    assert.equal(defy, wait_);
    assert.ok(defy > comply, `defy/wait must dominate comply; had defy=${defy} comply=${comply}`);
    assert.equal(picked(st, 2, vic), 'vic: defy mel');
  });

  // R: blackmail.rs the_stall_tie
  // H: BlackmailSpec.hs "the stall-tie: scoreActions gives wait and defy the SAME score under a standing threat"
  test('the_stall_tie', () => {
    const st = mkWorld(false);
    doAct('mel', 'threaten vic', st);
    const scores = st.scoreActions(2, member(st, 'vic'));
    assert.equal(scoreOf(scores, 'vic: wait'), scoreOf(scores, 'vic: defy mel'));
  });

  // R: blackmail.rs defiance_leaves_the_defied_fact_and_clears_the_threat
  // H: BlackmailSpec.hs "defiance leaves the defied fact and clears the threat"
  test('defiance_leaves_the_defied_fact_and_clears_the_threat', () => {
    const st = mkWorld(false);
    doAct('mel', 'threaten vic', st);
    doAct('vic', 'defy mel', st);
    assert.ok(st.dbHas('defied.defiance.vic.mel'), 'the defied fact');
    assert.ok(!st.dbHas('threatened.defiance.mel.vic'), 'the threat is gone');
  });

  // R: blackmail.rs the_victims_model_predicts_the_exposure_after_defiance
  // H: BlackmailSpec.hs "the victim's model predicts mel's exposure after defiance"
  test('the_victims_model_predicts_the_exposure_after_defiance', () => {
    const st = mkWorld(false);
    doAct('mel', 'threaten vic', st);
    doAct('vic', 'defy mel', st);
    const vic = member(st, 'vic');
    const mel = member(st, 'mel');
    assert.equal(st.predictMove(vic, mel)?.label ?? null, 'mel: expose vic to wit');
  });

  // R: blackmail.rs a_scrupulous_extorter_declines_and_the_twin_threatens
  // H: BlackmailSpec.hs "trait-priced deterrence (v25 composition)"
  // H: BlackmailSpec.hs "a scrupulous extorter declines; an unprincipled twin with the same motive still threatens"
  test('a_scrupulous_extorter_declines_and_the_twin_threatens', () => {
    const st = deterrenceWorld();
    const hal = member(st, 'hal');
    const rex = member(st, 'rex');
    assert.equal(picked(st, 2, hal), 'hal: wait');
    assert.equal(picked(st, 2, rex), 'rex: threaten vic with what you know');
  });

  // R: blackmail.rs bearing_endows_the_extorter_with_the_qualm_by_name
  // H: BlackmailSpec.hs "bearing endows the extorter with the qualm by name"
  test('bearing_endows_the_extorter_with_the_qualm_by_name', () => {
    assert.deepEqual(bearing(scrupulous(), ch('zed')).desires, ['qualms']);
  });
});

// =====================================================================================
// confession.rs — H: ConfessionSpec.hs "Prax.Confession"
// =====================================================================================

describe('confession', () => {
  /** Vocabulaire d'acte partagé : la PREMIÈRE variable (Doer) est le sujet de l'acte et l'avouant. */
  const PAT = 'wronged.Doer.Victim';

  // ---- Groupe 1 : mécanique de conversion + soulagement tarifé par trait (v25) ----

  /** Un trait qui coûte -6 par marque « lied » propre et 0 une fois « confessed ». */
  function conscience(): Trait {
    return trait('conscience', [
      desire('guilt', want([matches('Owner.lied.H.wronged.Owner.Victim')], -6)),
      desire('clearConscience', want([matches('Owner.confessed.H.wronged.Owner.Victim')], 0)),
    ]);
  }

  const confessAct = (): Action => confess('lied', 'confessed', together(), PAT, PAT, '[Actor]: confess to [Hearer] about wronging [Victim]');

  function convWorld(): State {
    const [roster, personaFacts] = cast(
      [conscience()],
      [
        [ch('bob'), [conscience()]],
        [ch('fay'), []],
      ],
    );
    const st = new State();
    st.definePractices([prac('confessional', ['R'], [confessAct()])]);
    st.setCharacters(roster);
    st.setDesires(personaVocabulary([conscience()]));
    for (const o of [
      ...personaFacts,
      insert('practice.confessional.here'),
      insert('at.bob!yard'),
      insert('at.fay!yard'),
      // deux actes DISTINCTS, même auditeur d'origine « edda ».
      insert('bob.lied.edda.wronged.bob.carol'),
      insert('bob.lied.edda.wronged.bob.dana'),
    ])
      st.performOutcome(o);
    return st;
  }

  // R: confession.rs confessing_converts_exactly_the_confessed_deeds_mark
  // H: ConfessionSpec.hs "conversion mechanics"
  // H: ConfessionSpec.hs "confessing converts exactly the confessed deed's mark; a second lied-mark survives"
  test('confessing_converts_exactly_the_confessed_deeds_mark', () => {
    const st = convWorld();
    doAct('bob', 'confess to fay about wronging carol', st);
    assert.ok(st.dbHas('bob.confessed.edda.wronged.bob.carol'), 'the carol mark converted to confessed');
    assert.ok(!st.dbHas('bob.lied.edda.wronged.bob.carol'), 'the carol lied-mark is gone');
    assert.ok(st.dbHas('bob.lied.edda.wronged.bob.dana'), 'the dana lied-mark survives untouched');
  });

  // R: confession.rs confession_deposits_the_hearers_sourced_belief
  // H: ConfessionSpec.hs "confession deposits the hearer's sourced belief (the ordinary hearsay channel)"
  test('confession_deposits_the_hearers_sourced_belief', () => {
    const st = convWorld();
    doAct('bob', 'confess to fay about wronging carol', st);
    assert.ok(st.dbHas('fay.believes.wronged.bob.carol.heard.bob'), 'fay heard it from bob');
  });

  // R: confession.rs the_converted_deed_is_not_re_offered
  // H: ConfessionSpec.hs "the converted deed is not re-offered; the surviving one still is"
  test('the_converted_deed_is_not_re_offered', () => {
    const st = convWorld();
    doAct('bob', 'confess to fay about wronging carol', st);
    assert.ok(!offered('bob', 'wronging carol', st), 'no more confessing about carol (the mark is gone)');
    assert.ok(offered('bob', 'wronging dana', st), 'confessing about dana remains offered');
  });

  // R: confession.rs the_relief_in_evaluate_over_self_wants
  // H: ConfessionSpec.hs "a trait pricing lied at -6 and confessed at 0: the relief in evaluate/selfWants"
  test('the_relief_in_evaluate_over_self_wants', () => {
    const st = convWorld();
    const bob = member(st, 'bob');
    assert.equal(st.evaluateSelfWants(bob), -12);
    doAct('bob', 'confess to fay about wronging carol', st);
    assert.equal(st.evaluateSelfWants(bob), -6);
  });

  // ---- Groupe 2 : absolution ----

  const absolveAct = (): Action => absolve('recanted', PAT, 'fedUp', '[Actor]: absolve [Doer]');

  function absolveWorld(): State {
    const st = new State();
    st.definePractices([prac('confessional', ['R'], [absolveAct()])]);
    for (const o of [
      insert('practice.confessional.here'),
      insert('gwen.believes.wronged.cody.carol.heard.cody'),
      insert('hank.believes.wronged.cody.carol.heard.cody'),
      insert('regards.hank.cody.fedUp'),
      insert('ivy.believes.wronged.cody.carol.heard.jill'),
    ])
      st.performOutcome(o);
    st.setCharacters([ch('gwen'), ch('hank'), ch('ivy'), ch('cody')]);
    return st;
  }

  // R: confession.rs granting_inserts_the_worlds_defeater
  // H: ConfessionSpec.hs "absolution: grant, refusal, gossip gate, double-grant"
  // H: ConfessionSpec.hs "granting inserts the world's defeater"
  test('granting_inserts_the_worlds_defeater', () => {
    const st = absolveWorld();
    doAct('gwen', 'absolve cody', st);
    assert.ok(st.dbHas('recanted.cody'), 'the defeater');
  });

  // R: confession.rs a_planted_incorrigibility_regard_blocks_the_affordance
  // H: ConfessionSpec.hs "a planted incorrigibility regard blocks the affordance (refusal)"
  test('a_planted_incorrigibility_regard_blocks_the_affordance', () => {
    const st = absolveWorld();
    assert.ok(!offered('hank', 'absolve cody', st), 'hank, fed up, has no absolve action against cody');
  });

  // R: confession.rs gossip_sourced_belief_does_not_qualify
  // H: ConfessionSpec.hs "gossip-sourced belief does not qualify (heard from a non-doer)"
  test('gossip_sourced_belief_does_not_qualify', () => {
    const st = absolveWorld();
    assert.ok(!offered('ivy', 'absolve cody', st), 'ivy never confessed to, has no absolve action');
  });

  // R: confession.rs double_absolution_is_blocked
  // H: ConfessionSpec.hs "double-absolution is blocked while the defeater stands"
  test('double_absolution_is_blocked', () => {
    const st = absolveWorld();
    doAct('gwen', 'absolve cody', st);
    assert.ok(!offered('gwen', 'absolve cody', st), 'gwen cannot grant a second time');
  });

  // ---- Groupe 3 : incorrigibilité ----

  function incorrigWorld(): State {
    const st = new State();
    st.setCharacters(['mave', 'hank', 'cody'].map((n) => ch(n)));
    for (const o of [
      insert('mave.believes.wronged.cody.carol.seen'),
      insert('hank.believes.wronged.cody.carol.seen'),
      insert('hank.believes.wronged.cody.dana.heard.jill'),
    ])
      st.performOutcome(o);
    st.setAxioms([incorrigible(PAT, 2, 'fedUp')]);
    return st;
  }

  // R: confession.rs k_minus_one_believed_deeds_derive_nothing
  // H: ConfessionSpec.hs "incorrigibility: threshold, gossip, independence, permanence"
  // H: ConfessionSpec.hs "k-1 believed deeds derive nothing"
  test('k_minus_one_believed_deeds_derive_nothing', () => {
    const st = incorrigWorld();
    assert.ok(!st.viewHas('regards.mave.cody.fedUp'), 'mave (one instance) does not regard cody as fed-up');
  });

  // R: confession.rs k_believed_deeds_one_via_gossip_derive_the_regard
  // H: ConfessionSpec.hs "k believed deeds -- one via gossip -- derive the regard"
  test('k_believed_deeds_one_via_gossip_derive_the_regard', () => {
    const st = incorrigWorld();
    assert.ok(st.viewHas('regards.hank.cody.fedUp'), 'hank (two instances, one gossiped) regards cody as fed-up');
  });

  // R: confession.rs per_absolver_independence
  // H: ConfessionSpec.hs "per-absolver independence: one fed up, one fresh, from the same facts"
  test('per_absolver_independence', () => {
    const st = incorrigWorld();
    assert.ok(st.viewHas('regards.hank.cody.fedUp'), 'hank: fed up');
    assert.ok(!st.viewHas('regards.mave.cody.fedUp'), 'mave: fresh');
  });

  // R: confession.rs permanence_an_absolution_elsewhere_does_not_retract_the_regard
  // H: ConfessionSpec.hs "permanence: an absolution elsewhere does not retract the regard"
  test('permanence_an_absolution_elsewhere_does_not_retract_the_regard', () => {
    const st = incorrigWorld();
    st.performOutcome(insert('recanted.cody'));
    assert.ok(st.viewHas('regards.hank.cody.fedUp'), "hank's fed-up regard survives an unrelated absolution");
  });

  // ---- Groupe 4 : l'arithmétique sondée ----

  function spontWorld(stake: number): State {
    const [roster, personaFacts] = cast(
      [conscience()],
      [
        [ch('wade', [conceal('wronged.wade.carol', stake)]), [conscience()]],
        [ch('priya'), []],
      ],
    );
    const st = new State();
    st.definePractices([prac('confessional', ['R'], [confessAct(), action('[Actor]: hold your tongue', [matches('at.Actor!P')])])]);
    st.setCharacters(roster);
    st.setDesires(personaVocabulary([conscience()]));
    for (const o of [...personaFacts, insert('practice.confessional.here'), insert('at.wade!yard'), insert('at.priya!yard'), insert('wade.lied.edda.wronged.wade.carol')])
      st.performOutcome(o);
    return st;
  }

  const BLACKMAIL_PAT = 'stole.Vic.loaf';

  function blackmailWorld(price: number, fear: number): State {
    const [, acts] = shakedown('theft', together(), BLACKMAIL_PAT, 'favor', 2);
    const yard = prac('yard', ['R'], [
      ...acts,
      confess('lied', 'confessed', together(), BLACKMAIL_PAT, BLACKMAIL_PAT, '[Actor]: confess to [Hearer] about the loaf'),
      action('[Actor]: wait', [matches('at.Actor!P')]),
    ]);
    const st = new State();
    st.definePractices([yard]);
    st.setCharacters([
      ch('mel', [], ['punishes-theft']),
      ch('vic', [want([matches('debt.mel.vic.favor')], -price)], ['fears-scandal', 'guilt', 'clearConscience']),
      ch('cora'),
    ]);
    for (const o of [
      insert('practice.yard.here'),
      insert('at.mel!court'),
      insert('at.vic!court'),
      insert('at.cora!court'),
      insert('mel.believes.stole.vic.loaf.seen'),
      insert('vic.lied.some.stole.vic.loaf'),
    ])
      st.performOutcome(o);
    st.setDesires([
      shakedown('theft', together(), BLACKMAIL_PAT, 'favor', 2)[0],
      desire('fears-scandal', want([matches('W.believes.stole.Owner.loaf')], -fear)),
      desire('guilt', want([matches('Owner.lied.H.stole.Owner.loaf')], -6)),
      desire('clearConscience', want([matches('Owner.confessed.H.stole.Owner.loaf')], 0)),
    ]);
    return st;
  }

  // R: confession.rs a_mild_stake_makes_conscience_relief_worth_it
  // H: ConfessionSpec.hs "probed arithmetic: spontaneous confession, blackmail defense"
  // H: ConfessionSpec.hs "spontaneous confession: a mild stake makes conscience relief worth it"
  test('a_mild_stake_makes_conscience_relief_worth_it', () => {
    const st = spontWorld(4);
    const wade = member(st, 'wade');
    const scores = st.scoreActions(2, wade);
    assert.equal(scoreOf(scores, 'confess to priya about wronging carol'), 0.0);
    assert.equal(scoreOf(scores, 'hold your tongue'), -2.0);
    assert.equal(picked(st, 2, wade), 'wade: confess to priya about wronging carol');
  });

  // R: confession.rs an_expensive_stake_makes_it_not_worth_it
  // H: ConfessionSpec.hs "spontaneous confession: an expensive stake makes it NOT worth it"
  test('an_expensive_stake_makes_it_not_worth_it', () => {
    const st = spontWorld(20);
    const wade = member(st, 'wade');
    const scores = st.scoreActions(2, wade);
    assert.equal(scoreOf(scores, 'hold your tongue'), 37.94);
    assert.equal(scoreOf(scores, 'confess to priya about wronging carol'), 0.0);
    assert.equal(picked(st, 2, wade), 'wade: hold your tongue');
  });

  // R: confession.rs a_high_price_against_a_mild_secret_makes_the_victim_confess
  // H: ConfessionSpec.hs "blackmail defense: a high price against a mild secret -- the victim confesses (property 4, ordering)"
  test('a_high_price_against_a_mild_secret_makes_the_victim_confess', () => {
    const st = blackmailWorld(30, 3);
    doAct('mel', 'threaten vic', st);
    const vic = member(st, 'vic');
    const scores = st.scoreActions(2, vic);
    const confess_ = scoreOf(scores, 'confess to cora about the loaf');
    const defy = scoreOf(scores, 'defy mel');
    const wait_ = scoreOf(scores, 'wait');
    const comply = scoreOf(scores, "buy mel's silence");
    assert.ok(confess_ > defy && defy === wait_ && wait_ > comply, `confess must strictly dominate; had confess=${confess_} defy=${defy} wait=${wait_} comply=${comply}`);
    assert.equal(picked(st, 2, vic), 'vic: confess to cora about the loaf');
  });

  // R: confession.rs after_confessing_mels_expose_is_dead
  // H: ConfessionSpec.hs "blackmail defense: after confessing, mel's expose deposits nothing new (dead)"
  test('after_confessing_mels_expose_is_dead', () => {
    const st = blackmailWorld(30, 3);
    doAct('mel', 'threaten vic', st);
    doAct('vic', 'confess to cora about the loaf', st);
    assert.ok(st.dbHas('cora.believes.stole.vic.loaf.heard.vic'), 'cora now believes, sourced from vic himself');
    assert.ok(!offered('mel', 'expose', st), 'mel has no expose action left (every co-present hearer already believes)');
    assert.deepEqual(labels(st, 'mel'), ['mel: wait']);
  });

  // R: confession.rs a_cheap_price_against_a_severe_fear_makes_the_victim_comply
  // H: ConfessionSpec.hs "blackmail defense: the converse -- a cheap price against a severe fear -- complies (property 4, ordering)"
  test('a_cheap_price_against_a_severe_fear_makes_the_victim_comply', () => {
    const st = blackmailWorld(1, 30);
    doAct('mel', 'threaten vic', st);
    const vic = member(st, 'vic');
    const scores = st.scoreActions(2, vic);
    const comply = scoreOf(scores, "buy mel's silence");
    const confess_ = scoreOf(scores, 'confess to cora about the loaf');
    const defy = scoreOf(scores, 'defy mel');
    const wait_ = scoreOf(scores, 'wait');
    assert.ok(comply > confess_ && confess_ > defy && defy === wait_, `comply must strictly dominate; had comply=${comply} confess=${confess_} defy=${defy} wait=${wait_}`);
    assert.equal(picked(st, 2, vic), "vic: buy mel's silence");
  });

  // ---- Groupe 5 : la récidive fait sauter le « défaiseur » ----

  // R: confession.rs absolved_then_re_offending_snaps_the_defeater_away
  // H: ConfessionSpec.hs "re-offense deletes the defeater (v21 idiom)"
  // H: ConfessionSpec.hs "absolved, then re-offending snaps the defeater away"
  test('absolved_then_re_offending_snaps_the_defeater_away', () => {
    const reoffend = action('[Actor]: wrong dana again', [matches('at.Actor!P')], [insert('Actor.lied.edda.wronged.Actor.dana'), del('recanted.Actor')]);
    const st = new State();
    st.definePractices([prac('confessional', ['R'], [absolveAct(), reoffend])]);
    for (const o of [insert('practice.confessional.here'), insert('at.cody!yard'), insert('gwen.believes.wronged.cody.carol.heard.cody')]) st.performOutcome(o);
    st.setCharacters([ch('cody'), ch('gwen')]);
    doAct('gwen', 'absolve cody', st);
    assert.ok(st.dbHas('recanted.cody'), 'recanted stands');
    doAct('cody', 'wrong dana again', st);
    assert.ok(!st.dbHas('recanted.cody'), 'recanted is gone: standing snaps back before a less patient audience');
    assert.ok(st.dbHas('cody.lied.edda.wronged.cody.dana'), 'the new lied mark is planted');
  });

  // ---- Groupe 7 : le dépôt découplé ----

  // R: confession.rs confessing_deposits_the_act_not_the_content
  // H: ConfessionSpec.hs "the deposit is decoupled from the mark's own content"
  // H: ConfessionSpec.hs "confessing converts the content-mark and deposits the ACT, not the content"
  test('confessing_deposits_the_act_not_the_content', () => {
    const decoupled = confess('lied', 'confessed', together(), 'stole.C.loaf', 'whispered.Actor.H', '[Actor]: confess to [Hearer] about framing [C]');
    const st = new State();
    st.definePractices([prac('confessional', ['R'], [decoupled])]);
    for (const o of [insert('practice.confessional.here'), insert('at.eve!yard'), insert('at.fay!yard'), insert('eve.lied.gale.stole.carol.loaf')]) st.performOutcome(o);
    st.setCharacters([ch('eve'), ch('fay')]);
    doAct('eve', 'confess to fay about framing carol', st);
    assert.ok(st.dbHas('eve.confessed.gale.stole.carol.loaf'), 'the content-mark converted');
    assert.ok(!st.dbHas('eve.lied.gale.stole.carol.loaf'), "the content-mark's lied form is gone");
    assert.ok(st.dbHas('fay.believes.whispered.eve.gale.heard.eve'), 'fay learns the ACT (whispered.eve.gale), sourced from eve');
    assert.ok(!st.dbHas('fay.believes.stole.carol.loaf'), 'fay does NOT learn a re-assertion of the framed content');
  });

  // ---- Groupe 6 : gardes forcées ----

  // R: confession.rs confess_rejects_a_dotted_mark_kind
  // H: ConfessionSpec.hs "guards"
  // H: ConfessionSpec.hs "confess rejects a dotted mark kind"
  test('confess_rejects_a_dotted_mark_kind', () => {
    throwsKind(() => confess('li.ed', 'confessed', together(), PAT, PAT, '[Actor]: confess'), 'NotASinglePathSegment', 'a dotted kind is an error');
  });

  // R: confession.rs confess_rejects_a_dotted_discharge_verb
  // H: ConfessionSpec.hs "confess rejects a dotted discharge verb"
  test('confess_rejects_a_dotted_discharge_verb', () => {
    throwsKind(() => confess('lied', 'con.fessed', together(), PAT, PAT, '[Actor]: confess'), 'NotASinglePathSegment', 'a dotted verb is an error');
  });

  // R: confession.rs confess_rejects_a_mark_pattern_reserving_h
  // H: ConfessionSpec.hs "confess rejects a mark pattern reserving H/Hearer/Actor"
  test('confess_rejects_a_mark_pattern_reserving_h', () => {
    throwsKind(
      () => confess('lied', 'confessed', together(), 'wronged.H.Victim', 'wronged.H.Victim', '[Actor]: confess'),
      'ReservedVarClash',
      "H is reserved (the mark's own hearer slot)",
    );
  });

  // R: confession.rs confess_rejects_a_deposit_pattern_reserving_hearer
  // H: ConfessionSpec.hs "confess rejects a deposit pattern reserving Hearer"
  test('confess_rejects_a_deposit_pattern_reserving_hearer', () => {
    throwsKind(
      () => confess('lied', 'confessed', together(), 'stole.C.loaf', 'told.Actor.Hearer', '[Actor]: confess'),
      'ReservedVarClash',
      "Hearer is reserved (the confession's own audience role)",
    );
  });

  // R: confession.rs confess_rejects_an_ungroundable_deposit_variable
  // H: ConfessionSpec.hs "confess rejects an ungroundable deposit variable"
  test('confess_rejects_an_ungroundable_deposit_variable', () => {
    throwsKind(
      () => confess('lied', 'confessed', together(), 'stole.C.loaf', 'whispered.Actor.Someone', '[Actor]: confess'),
      'PatternVariables',
      'an ungroundable deposit variable is an error',
    );
  });

  // R: confession.rs absolve_rejects_a_dotted_defeater
  // H: ConfessionSpec.hs "absolve rejects non-single-segment defeater/label"
  test('absolve_rejects_a_dotted_defeater', () => {
    throwsKind(() => absolve('re.canted', PAT, 'fedUp', '[Actor]: absolve'), 'NotASinglePathSegment', 'a dotted defeater is an error');
  });

  // R: confession.rs absolve_rejects_an_event_pattern_reserving_actor
  // H: ConfessionSpec.hs "absolve rejects an event pattern reserving Actor"
  test('absolve_rejects_an_event_pattern_reserving_actor', () => {
    throwsKind(() => absolve('recanted', 'wronged.Actor.Victim', 'fedUp', '[Actor]: absolve'), 'ReservedVarClash', 'Actor is reserved');
  });

  // R: confession.rs absolve_rejects_a_subject_less_event_pattern
  // H: ConfessionSpec.hs "absolve rejects a subject-less event pattern"
  test('absolve_rejects_a_subject_less_event_pattern', () => {
    throwsKind(() => absolve('recanted', 'somethinghappened', 'fedUp', '[Actor]: absolve'), 'PatternVariables', 'an absolution needs a confessor');
  });

  // R: confession.rs incorrigible_rejects_a_dotted_label
  // H: ConfessionSpec.hs "incorrigible rejects a dotted label"
  test('incorrigible_rejects_a_dotted_label', () => {
    throwsKind(() => incorrigible(PAT, 2, 'fed.up'), 'NotASinglePathSegment', 'a dotted label is an error');
  });

  // R: confession.rs incorrigible_rejects_a_prax_namespace_pattern
  // H: ConfessionSpec.hs "incorrigible rejects a pattern authoring the Prax namespace"
  test('incorrigible_rejects_a_prax_namespace_pattern', () => {
    throwsKind(() => incorrigible('wronged.Doer.PraxDs', 2, 'fedUp'), 'ReservedVarClash', "PraxDs is reserved (the axiom's own subquery set variable)");
  });

  // R: confession.rs incorrigible_accepts_w_ds_and_n_as_ordinary_variables
  // H: ConfessionSpec.hs "incorrigible: the usability win -- W/Ds/N are ordinary variables now (v40 moved the axiom's own machinery to the Prax namespace)"
  test('incorrigible_accepts_w_ds_and_n_as_ordinary_variables', () => {
    assert.doesNotThrow(() => incorrigible('wronged.Doer.Ds.W.N', 2, 'fedUp'), 'W, Ds, and N no longer collide with anything');
  });

  // R: confession.rs incorrigible_rejects_a_pattern_naming_no_offender
  // H: ConfessionSpec.hs "incorrigible rejects a pattern naming no offender"
  test('incorrigible_rejects_a_pattern_naming_no_offender', () => {
    throwsKind(() => incorrigible('somethinghappened', 2, 'fedUp'), 'PatternVariables', 'a threshold needs an offender');
  });

  // R: confession.rs incorrigible_rejects_a_single_variable_pattern
  // H: ConfessionSpec.hs "incorrigible rejects a single-variable pattern (no deed variables to count)"
  test('incorrigible_rejects_a_single_variable_pattern', () => {
    throwsKind(() => incorrigible('confessed.Doer', 2, 'fedUp'), 'PatternVariables', 'one variable can name only one instance -- a k>1 threshold could never fire');
  });

  // R: confession.rs incorrigible_rejects_a_witness_naming_collision
  // H: ConfessionSpec.hs "incorrigible rejects a deed variable colliding with the witness-naming convention"
  test('incorrigible_rejects_a_witness_naming_collision', () => {
    throwsKind(() => incorrigible('wronged.Doer.Victim.Victim0', 2, 'fedUp'), 'PatternVariables', "Victim0 would collide with Victim's own outer witness dummy");
  });
});
