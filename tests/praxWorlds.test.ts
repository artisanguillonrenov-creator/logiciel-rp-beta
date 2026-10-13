/**
 * Portage des tests des mondes de démonstration de Prax (Rust, BSD-3-Clause) :
 * `prax-worlds/src/{feud,intrigue,bar,vampire}.rs`, modules `#[cfg(test)]`.
 *
 * Même scénario, mêmes assertions. Le vampire se construit à l'échelle
 * compressée (`TimeScale::test()` -> `vampireWorld(TEST_SCALE)`).
 *
 * Les quatre parties « boucle de jeu réelle » du vampire (advance + npcAct à
 * profondeur 2 depuis `world()`) parcourent toutes la MÊME trajectoire
 * déterministe : le Rust la rejoue dans chaque test ; ici elle est jouée une
 * fois, à la demande, et mémoïsée pas à pas (un instantané par pas), chaque
 * test relisant ses instantanés exactement là où l'original lirait l'état
 * vivant. C'est une identité, pas une approximation (le planificateur est
 * déterministe).
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { State } from '../src/prax/core/engine';
import { explain } from '../src/prax/core/inspect';
import { GroundedAction } from '../src/prax/core/perform';
import { matches } from '../src/prax/core/query';
import { advance, npcAct, runNpcTicks } from '../src/prax/core/turn';
import { typeCheck } from '../src/prax/core/typecheck';
import { Character, action, character, insert, practice } from '../src/prax/core/types';
import { believe } from '../src/prax/vocab/beliefs';
import { beginConversation } from '../src/prax/vocab/conversation';
import { WARMTH, adjustScore } from '../src/prax/vocab/coreModel';
import { ANNOYED, feelToward, unfeelToward } from '../src/prax/vocab/emotion';
import { wed } from '../src/prax/vocab/kin';
import { DIRECTOR_NAME, barDirectorWorld, barWorld } from '../src/prax/worlds/bar';
import { bigFeud, feudWorld } from '../src/prax/worlds/feud';
import { intrigueWorld } from '../src/prax/worlds/intrigue';
import { REAL_SCALE, TEST_SCALE, vampireWorld } from '../src/prax/worlds/vampire';

// ---- utilitaires communs ------------------------------------------------------

function labelsOf(st: State, actor: string): string[] {
  return st.possibleActions(actor).map((ga) => ga.label);
}

/** La première action de `actor` dont le libellé contient `needle` (panique sinon). */
function findAction(st: State, actor: string, needle: string): GroundedAction {
  const acts = st.possibleActions(actor);
  const ga = acts.find((g) => g.label.includes(needle));
  if (ga === undefined) {
    throw new Error(`no action matching ${JSON.stringify(needle)} for ${actor}; available: ${JSON.stringify(acts.map((g) => g.label))}`);
  }
  return ga;
}

function characterNamed(st: State, name: string): Character {
  const c = st.characters.find((ch) => ch.name === name);
  if (c === undefined) throw new Error(`${name} not found in the given state`);
  return c;
}

// =============================================================================
// feud.rs
// =============================================================================

// R: feud.rs tests
// H: FeudSpec.hs "Prax.Worlds.Feud (emergent sandbox)"
describe('Prax.Worlds.Feud (emergent sandbox)', () => {
  /** Alice (la joueuse) n'agit jamais ; tous les autres suivent le planificateur. */
  function runWithPassive(idle: string, k: number, st: State): void {
    for (let i = 0; i < k; i++) {
      const actor = advance(st);
      if (actor.name !== idle) npcAct(st, 2, actor);
    }
  }

  /** Les cibles que `who` peut fuir maintenant. */
  function canShun(st: State, who: string): string[] {
    const prefix = `${who}: shun `;
    return st
      .possibleActions(who)
      .filter((ga) => ga.label.startsWith(prefix))
      .map((ga) => ga.label.slice(prefix.length));
  }

  /** Esme, mariée dans la maison kestrel. */
  function weddedWorld(): State {
    const st = feudWorld();
    for (const o of wed('esme', 'kestrel', 'dave')) st.performOutcome(o);
    return st;
  }

  // R: feud.rs enmity_is_derived_not_authored
  // H: FeudSpec.hs "enmity is DERIVED, not authored: Alice's wrong spreads through the network"
  test('enmity is DERIVED, not authored', () => {
    const st = feudWorld();
    assert.ok(st.labeledFacts().includes('wronged.alice.bob'), 'the one authored grievance');
    const view = st.labeledView();
    for (const [s, why] of [
      ['resents.bob.alice', 'bob resents alice (wronged)'],
      ['resents.carol.alice', 'carol resents alice (ally)'],
      ['resents.dave.alice', "dave resents alice (ally's ally)"],
    ]) {
      assert.ok(view.includes(s), why);
    }
    assert.ok(!st.labeledFacts().some((s) => s.includes('resents.')), 'not authored in the base');
  });

  // R: feud.rs a_derived_fact_gates_an_affordance
  // H: FeudSpec.hs "a derived fact GATES an affordance: Carol may shun Alice, Alice may shun no one"
  test('a derived fact GATES an affordance', () => {
    const st = feudWorld();
    assert.ok(canShun(st, 'carol').includes('alice'), 'carol can shun alice (via derived enmity)');
    assert.equal(canShun(st, 'alice').length, 0, 'alice resents no one, so shuns no one');
  });

  // R: feud.rs a_passive_alice_is_shunned_by_the_network
  // H: FeudSpec.hs "with Alice passive, the network shuns her on its own (emergent behaviour)"
  test('with Alice passive, the network shuns her on its own', () => {
    const st = feudWorld();
    runWithPassive('alice', 12, st);
    const facts = st.labeledFacts();
    for (const who of ['bob', 'carol', 'dave']) assert.ok(facts.includes(`shunned.${who}.alice`), `${who} shunned alice`);
  });

  // R: feud.rs the_feud_scales
  // H: FeudSpec.hs "the feud scales: bigFeud turns every ally in the chain against Alice"
  test('the feud scales: bigFeud turns every ally in the chain against Alice', () => {
    const n = 20;
    const view = bigFeud(n).labeledView();
    for (let i = 1; i <= n; i++) {
      assert.ok(view.includes(`resents.a${i}.alice`), `every one of the chain's members (transitively) resents alice: a${i}`);
    }
  });

  // R: feud.rs making_amends_dissolves_the_feud
  // H: FeudSpec.hs "DEFEASIBLE: making amends retracts the wrong and dissolves the whole feud"
  test('DEFEASIBLE: making amends dissolves the whole feud', () => {
    const st = feudWorld();
    st.performAction(findAction(st, 'alice', 'make amends with bob'));
    assert.ok(!st.labeledFacts().includes('wronged.alice.bob'), 'the wrong is gone');
    const view = st.labeledView();
    assert.ok(!view.includes('resents.carol.alice'), 'carol no longer resents');
    assert.ok(!view.includes('resents.dave.alice'), 'dave no longer resents');
    assert.equal(canShun(st, 'carol').length, 0, 'and can no longer shun her');
  });

  // R: feud.rs esme_starts_inert_to_the_feud
  // H: FeudSpec.hs "pre-wedding: esme is inert to the feud — her own house, no resentment, no kestrel ties"
  test('pre-wedding: esme is inert to the feud', () => {
    const st = feudWorld();
    assert.ok(st.dbHas('member.esme!wren'), 'esme starts in her own house (wren)');
    const view = st.labeledView();
    assert.ok(!view.some((s) => s.startsWith('resents.esme.')), 'esme resents no one yet');
    for (const s of ['allied.esme.bob', 'allied.esme.carol', 'allied.esme.dave']) {
      assert.ok(!view.includes(s), `esme is not yet allied with the kestrel house: ${s}`);
    }
  });

  // R: feud.rs the_wedding_flips_the_derived_world
  // H: FeudSpec.hs "the wedding: wed moves esme's membership; the derived world flips"
  test("the wedding moves esme's membership; the derived world flips", () => {
    const st = weddedWorld();
    assert.ok(st.dbHas('member.esme!kestrel'), "esme's membership moved to kestrel");
    assert.ok(!st.dbHas('member.esme!wren'), "esme's old wren membership is gone");
    const view = st.labeledView();
    for (const s of ['allied.esme.bob', 'allied.esme.carol', 'allied.esme.dave']) {
      assert.ok(view.includes(s), `esme is now allied with the whole kestrel house (comrades): ${s}`);
    }
    assert.ok(view.includes('resents.esme.alice'), "esme inherits her in-laws' grudge: resents.esme.alice is derived");
    assert.ok(view.includes('married.dave.esme'), 'married.dave.esme is derived (marriage symmetry, kinAxioms)');
  });

  // R: feud.rs the_wedded_esme_shuns_alice_unprompted
  // H: FeudSpec.hs "the driven beat: after the wedding, esme (a grudgeBearer) shuns alice unprompted"
  test('the driven beat: after the wedding, esme shuns alice unprompted', () => {
    const st = weddedWorld();
    runWithPassive('alice', 12, st);
    assert.ok(st.labeledFacts().includes('shunned.esme.alice'), 'esme shunned alice');
  });
});

// =============================================================================
// intrigue.rs
// =============================================================================

// R: intrigue.rs tests
// H: IntrigueSpec.hs "Prax.Worlds.Intrigue (a dramatic slice)"
describe('Prax.Worlds.Intrigue (a dramatic slice)', () => {
  /** Le désir nommé de la conspiratrice (privé dans le monde : `KILL_ARTUS`). */
  const KILL_ARTUS = 'kill-artus';

  function act(st: State, actor: string, needle: string): void {
    st.performAction(findAction(st, actor, needle));
  }

  /** L'état juste après que Cassia s'est confiée à Marcus (tour 3). */
  function afterConfide(): State {
    const st = intrigueWorld();
    runNpcTicks(st, 2, 3);
    return st;
  }

  // R: intrigue.rs the_schemer_confides_then_marcus_learns_the_plot
  // H: IntrigueSpec.hs "the schemer confides, then Marcus learns the plot"
  test('the schemer confides, then Marcus learns the plot', () => {
    const st = afterConfide();
    assert.ok(
      st.labeledFacts().includes('marcus.believes.plotAgainst.artus!yes'),
      `Marcus believes Artus is in danger, got ${JSON.stringify(st.labeledFacts())}`,
    );
  });

  // R: intrigue.rs an_idle_player_lets_the_plot_run_to_the_betrayal_ending
  // H: IntrigueSpec.hs "an idle player lets the plot run to the betrayal ending; the victim dies"
  test('an idle player lets the plot run to the betrayal ending; the victim dies', () => {
    const st = intrigueWorld();
    const tr = runNpcTicks(st, 2, 8);
    const fs = st.labeledFacts();
    assert.ok(tr.includes("cassia: slip poison into artus's cup"), `Cassia poisons Artus, got ${JSON.stringify(tr)}`);
    assert.ok(fs.includes('dead.artus'), 'Artus is dead');
    assert.ok(fs.includes('ending!betrayal'), `the betrayal ending is reached, got ${JSON.stringify(fs)}`);
    assert.ok(!tr.slice(6).some((l) => l.includes('artus: ')), `no action by the dead Artus after the poisoning, got ${JSON.stringify(tr)}`);
  });

  // R: intrigue.rs the_inspector_explains_why_an_action_is_unavailable
  // H: IntrigueSpec.hs "the inspector explains why an action is (un)available"
  test('the inspector explains why an action is (un)available', () => {
    const before = explain(intrigueWorld(), 'marcus', 'warn artus').join('');
    assert.ok(before.includes('blocked by') && before.includes('believes'), `blocked, reason names the belief precondition: ${JSON.stringify(before)}`);
    const after = explain(afterConfide(), 'marcus', 'warn artus').join('');
    assert.ok(after.includes('AVAILABLE'), `now available: ${JSON.stringify(after)}`);
  });

  // R: intrigue.rs the_inspector_handles_an_instantiated_zero_role_practice
  // H: IntrigueSpec.hs "the inspector handles an instantiated zero-role practice"
  test('the inspector handles an instantiated zero-role practice', () => {
    const w = intrigueWorld();
    const shrine = practice('shrine', { actions: [action('[Actor]: kneel', [], [insert('knelt.Actor')])] });
    w.definePractices([shrine]);
    w.performOutcome(insert('practice.shrine'));
    const out = explain(w, 'marcus', 'kneel').join('');
    assert.ok(out.includes('AVAILABLE'), `kneel explained: ${JSON.stringify(out)}`);
  });

  // R: intrigue.rs warning_the_patron_reaches_the_loyalty_ending
  // H: IntrigueSpec.hs "warning the patron reaches the loyalty ending, and he lives"
  test('warning the patron reaches the loyalty ending, and he lives', () => {
    const st = afterConfide();
    act(st, 'marcus', 'warn artus');
    const fs = st.labeledFacts();
    assert.ok(fs.includes('ending!loyalty'), `the loyalty ending is reached, got ${JSON.stringify(fs)}`);
    assert.ok(!fs.includes('dead.artus'), 'Artus lives');
    assert.ok(fs.some((s) => s.includes('artus.relationship.marcus.warmth')), `Artus is grateful (warmth toward Marcus), got ${JSON.stringify(fs)}`);
  });

  // R: intrigue.rs the_player_can_commit_the_murder_themselves
  // H: IntrigueSpec.hs "the player can commit the murder themselves (complicity ending)"
  test('the player can commit the murder themselves (complicity ending)', () => {
    const st = afterConfide();
    act(st, 'marcus', 'poison artus with your own hand');
    const fs = st.labeledFacts();
    assert.ok(fs.includes('dead.artus'), "Artus dies by Marcus's hand");
    assert.ok(fs.includes('ending!complicity'), `the complicity ending is reached, got ${JSON.stringify(fs)}`);
  });

  // R: intrigue.rs the_player_can_romance_the_conspirator
  // H: IntrigueSpec.hs "the player can romance the conspirator"
  test('the player can romance the conspirator', () => {
    const st = afterConfide();
    act(st, 'marcus', 'warm to cassia');
    assert.ok(st.labeledFacts().includes('bond.marcus.cassia!lovers'), `Marcus and Cassia become lovers, got ${JSON.stringify(st.labeledFacts())}`);
  });

  // R: intrigue.rs once_an_ending_is_reached_the_drama_freezes
  // H: IntrigueSpec.hs "once an ending is reached, the drama freezes (no further plot moves)"
  test('once an ending is reached, the drama freezes', () => {
    const st = afterConfide();
    act(st, 'marcus', 'warn artus');
    assert.ok(!st.possibleActions('cassia').some((ga) => ga.label.includes('poison')), `no poisoning remains available, had ${JSON.stringify(labelsOf(st, 'cassia'))}`);
  });

  // R: intrigue.rs the_confidant_can_foresee_the_poisoning_the_victim_cannot
  // H: IntrigueSpec.hs "the confidant can foresee the poisoning; the victim cannot"
  test('the confidant can foresee the poisoning; the victim cannot', () => {
    const st = intrigueWorld();
    act(st, 'cassia', 'confide the plot against artus to marcus');
    const marcus = character('marcus');
    const artus = character('artus');
    const cassia = character('cassia');
    assert.equal(st.predictMove(marcus, cassia)?.label ?? null, "cassia: slip poison into artus's cup");
    assert.equal(st.predictMove(artus, cassia), null, "the victim cannot read the schemer's mind");
  });

  // R: intrigue.rs the_named_desire_is_what_drives_the_schemer
  // (pin propre au Rust, sans libellé H)
  test('the named desire is what drives the schemer', () => {
    const st = intrigueWorld();
    const cassia = characterNamed(st, 'cassia');
    assert.deepEqual(cassia.desires, [KILL_ARTUS]);
    assert.equal(
      st.pickAction(2, cassia)?.label ?? null,
      'cassia: confide the plot against artus to marcus',
      'the confide scores nothing on its own; depth-2 lookahead reaches the poisoning that satisfies kill-artus',
    );
    // le même monde, le désir n'étant plus PORTÉ par elle (le registre le garde)
    const motiveless = intrigueWorld();
    const cast = motiveless.characters.map((c) => (c.name === 'cassia' ? { ...c, desires: [] } : c));
    motiveless.setCharacters(cast);
    const bare = character('cassia');
    assert.equal(motiveless.pickAction(2, bare)?.label ?? null, 'cassia: bide your time', 'without the desire she has nothing to plan toward and waits');
  });

  // R: intrigue.rs a_leaked_motive_changes_who_can_see_the_plan
  // H: IntrigueSpec.hs "a leaked motive changes who can see the plan"
  test('a leaked motive changes who can see the plan', () => {
    const st = intrigueWorld();
    act(st, 'cassia', 'confide the plot against artus to marcus');
    const artus = character('artus');
    const cassia = character('cassia');
    assert.equal(st.predictMove(artus, cassia), null);
    st.performOutcome(insert('artus.believes.desires.cassia.kill-artus.heard.marcus'));
    assert.equal(st.predictMove(artus, cassia)?.label ?? null, "cassia: slip poison into artus's cup");
  });
});

// =============================================================================
// bar.rs
// =============================================================================

// R: bar.rs tests
// H: BarSpec.hs "Prax.Worlds.Bar (feature integration)"
describe('Prax.Worlds.Bar (feature integration)', () => {
  function boundaries(st: State, k: number): void {
    for (let i = 0; i < k; i++) st.roundBoundary();
  }

  /** Le `runSteps` gelé : exécute, dans l'ordre, la première action correspondant à chaque aiguille. */
  function runSteps(st: State, steps: ReadonlyArray<readonly [string, string]>): void {
    for (const [actor, needle] of steps) st.performAction(findAction(st, actor, needle));
  }

  function has(st: State, fact: string): boolean {
    return st.labeledFacts().includes(fact);
  }

  // R: bar.rs drinking_two_beers_makes_you_tipsy
  // H: BarSpec.hs "drinking two beers makes you tipsy (init/Call/Calc/Cmp)"
  test('drinking two beers makes you tipsy (init/Call/Calc/Cmp)', () => {
    const st = barWorld();
    runSteps(st, [
      ['you', 'Go to bar'],
      ['you', 'Order beer'],
      ['ada', 'Fulfill you'],
      ['you', 'Drink the beer'],
    ]);
    assert.ok(has(st, 'practice.patron.you.drinks!1'), 'counter at 1');
    assert.ok(!has(st, 'person.you.tipsy'), 'not tipsy yet');
    runSteps(st, [
      ['you', 'Order beer'],
      ['ada', 'Fulfill you'],
      ['you', 'Drink the beer'],
    ]);
    assert.ok(has(st, 'practice.patron.you.drinks!2'), 'counter at 2');
    assert.ok(has(st, 'person.you.tipsy'), 'now tipsy');
  });

  /** Deux bières bues : l'état d'où partent les épingles du métabolisme. */
  function twoDrinks(): State {
    const st = barWorld();
    runSteps(st, [
      ['you', 'Go to bar'],
      ['you', 'Order beer'],
      ['ada', 'Fulfill you'],
      ['you', 'Drink the beer'],
      ['you', 'Order beer'],
      ['ada', 'Fulfill you'],
      ['you', 'Drink the beer'],
    ]);
    return st;
  }

  // R: bar.rs one_dry_metabolism_firing_clears_the_tipsiness
  // H: BarSpec.hs "a patron at 2 drinks is tipsy; one dry metabolism firing (2 -> 1) clears it"
  test('a patron at 2 drinks is tipsy; one dry metabolism firing (2 -> 1) clears it', () => {
    const st = twoDrinks();
    assert.ok(has(st, 'practice.patron.you.drinks!2'), 'counter at 2');
    assert.ok(has(st, 'person.you.tipsy'), 'tipsy before the firing');
    boundaries(st, 2);
    assert.ok(has(st, 'practice.patron.you.drinks!1'), 'counter decremented to 1');
    assert.ok(!has(st, 'practice.patron.you.drinks!2'), 'the 2-drinks fact is gone');
    assert.ok(!has(st, 'person.you.tipsy'), 'tipsy cleared once under the threshold');
  });

  // R: bar.rs drinking_again_before_the_firing_keeps_you_tipsy
  // H: BarSpec.hs "drinking again before the firing (3 -> 2) keeps you tipsy through it"
  test('drinking again before the firing (3 -> 2) keeps you tipsy through it', () => {
    const st = twoDrinks();
    runSteps(st, [
      ['you', 'Order beer'],
      ['ada', 'Fulfill you'],
      ['you', 'Drink the beer'],
    ]);
    assert.ok(has(st, 'practice.patron.you.drinks!3'), 'counter at 3');
    assert.ok(has(st, 'person.you.tipsy'), 'tipsy before the firing');
    boundaries(st, 2);
    assert.ok(has(st, 'practice.patron.you.drinks!2'), 'decremented to 2, still at the threshold');
    assert.ok(has(st, 'person.you.tipsy'), "still tipsy: 2 is still >= checkTipsy's own threshold");
  });

  // R: bar.rs a_firing_at_zero_drinks_leaves_zero
  // H: BarSpec.hs "a firing at 0 drinks leaves 0 (the Gte 1 guard never goes negative)"
  test('a firing at 0 drinks leaves 0 (the Gte 1 guard never goes negative)', () => {
    const st = barWorld();
    boundaries(st, 2);
    assert.ok(has(st, 'practice.patron.you.drinks!0'), 'you never drank: still at 0');
    assert.ok(has(st, 'practice.patron.bex.drinks!0'), 'bex never drank: still at 0');
    assert.ok(!st.labeledFacts().some((f) => f.includes('practice.patron.you.drinks!-')), 'no negative counter appears');
  });

  // R: bar.rs the_metabolism_due_re_arms
  // H: BarSpec.hs "the metabolism due re-arms: the second firing is only a full period later"
  test('the metabolism due re-arms: the second firing is only a full period later', () => {
    const st = twoDrinks();
    boundaries(st, 2);
    assert.ok(has(st, 'practice.patron.you.drinks!1'), 'the first firing landed');
    st.roundBoundary();
    assert.ok(has(st, 'practice.patron.you.drinks!1'), 'not due yet: the counter is unchanged at 1');
    st.roundBoundary();
    assert.ok(has(st, 'practice.patron.you.drinks!0'), 'the second firing landed a full period (2 rounds) after the first');
  });

  // R: bar.rs the_bell_requires_two_customers
  // H: BarSpec.hs "the bell requires two customers (Subquery/Count/Cmp)"
  test('the bell requires two customers (Subquery/Count/Cmp)', () => {
    const st = barWorld();
    runSteps(st, [
      ['bex', 'Go to bar'],
      ['bex', 'Order beer'],
    ]);
    assert.ok(!labelsOf(st, 'ada').some((l) => l.includes('Ring the bell')), 'no bell with one customer');
    runSteps(st, [
      ['you', 'Go to bar'],
      ['you', 'Order cider'],
    ]);
    assert.ok(labelsOf(st, 'ada').some((l) => l.includes('Ring the bell')), 'the bell becomes available with two customers');
  });

  // R: bar.rs the_buy_a_drink_affordance_is_gated_on_warmth
  // H: BarSpec.hs "the buy-a-drink affordance is gated on relationship warmth"
  test('the buy-a-drink affordance is gated on relationship warmth', () => {
    const bexCanBuy = (st: State): boolean => st.possibleActions('bex').some((ga) => ga.label.includes('Buy ada a drink'));
    const atBar = (): State => {
      const st = barWorld();
      st.performOutcome(insert('practice.world.world.at.bex!bar'));
      return st;
    };
    const cool = atBar();
    cool.performOutcome(adjustScore('bex', 'ada', WARMTH, 10, 'acquaintance'));
    assert.ok(!bexCanBuy(cool), 'no buy option when only mildly warm');
    const warm = atBar();
    warm.performOutcome(adjustScore('bex', 'ada', WARMTH, 20, 'fondness'));
    assert.ok(bexCanBuy(warm), 'the gift appears once warm enough — a relationship creating a goal');
  });

  // R: bar.rs the_gate_is_gone_the_reluctance_is_priced
  // H: BarSpec.hs "cross bartenders may pour, and won't: the gate is gone, the reluctance is priced (both halves)"
  test('cross bartenders may pour, and won\'t: the gate is gone, the reluctance is priced (both halves)', () => {
    const st = barWorld();
    st.performOutcome(insert('practice.world.world.at.bex!bar'));
    st.performOutcome(adjustScore('bex', 'ada', WARMTH, 20, 'fondness'));
    const bexChar = characterNamed(st, 'bex');
    const settle = st.candidateActions(bexChar).find((ga) => ga.label.includes('settle in'));
    assert.ok(settle !== undefined, 'a settle-in action is offered to warm bex');
    st.performAction(settle);

    const canBuy = (s: State): boolean => s.candidateActions(characterNamed(s, 'bex')).some((ga) => ga.label.includes('Buy ada a drink'));
    const picksBuy = (s: State): boolean => s.pickAction(2, characterNamed(s, 'bex'))?.label.includes('Buy ada a drink') ?? false;
    assert.ok(canBuy(st) && picksBuy(st), 'warm, untroubled bex both can and does buy');

    st.performOutcome(feelToward('bex', ANNOYED, 'ada'));
    assert.ok(canBuy(st), 'annoyed bex can still buy (no availability gate)');
    assert.ok(!picksBuy(st), 'annoyed bex does not pick buying');

    st.performOutcome(unfeelToward('bex', ANNOYED, 'ada'));
    assert.ok(canBuy(st), 'un-annoyed again, she can buy');
    assert.ok(picksBuy(st), 'un-annoyed again, she picks it');
  });

  // R: bar.rs an_onlookers_disapproval_annoyance_fades_on_its_own_lifetime
  // H: BarSpec.hs "an onlooker's disapproval-annoyance fades on its own lifetime"
  test("an onlooker's disapproval-annoyance fades on its own lifetime", () => {
    const st = barWorld();
    runSteps(st, [
      ['bex', 'Go to bar'],
      ['bex', 'Order beer'],
      ['ada', 'Fulfill bex'],
      ['bex', 'Leave ada'],
      ['ada', 'Disapprove of bex'],
    ]);
    assert.ok(has(st, 'ada.feels.annoyed.toward.bex'), 'ada is annoyed at bex right after disapproving');
    boundaries(st, 4);
    assert.ok(!has(st, 'ada.feels.annoyed.toward.bex'), `the annoyance has faded on its lifetime, got ${JSON.stringify(st.labeledFacts())}`);
  });

  // R: bar.rs greeting_spawns_a_response_reaction
  // H: BarSpec.hs "greeting spawns a response reaction the greeted party can take"
  test('greeting spawns a response reaction the greeted party can take', () => {
    const st = barWorld();
    runSteps(st, [
      ['you', 'Go to bar'],
      ['you', 'Greet ada'],
    ]);
    assert.ok(has(st, 'practice.respondGreet.you.ada'), 'the reaction is spawned');
    assert.ok(labelsOf(st, 'ada').some((l) => l.includes('Greet you back')), 'ada can greet back — a response that only exists now');
    runSteps(st, [['ada', 'Greet you back']]);
    assert.ok(has(st, 'practice.greet.world.greeted.ada.you'), 'ada greeted you back');
    assert.ok(!has(st, 'practice.respondGreet.you.ada'), 'the reaction is consumed');
  });

  /** bex a commandé et a été servie. */
  function served(): State {
    const st = barWorld();
    runSteps(st, [
      ['bex', 'Go to bar'],
      ['bex', 'Order beer'],
      ['ada', 'Fulfill bex'],
    ]);
    return st;
  }

  // R: bar.rs being_served_spawns_a_tip_obligation
  // H: BarSpec.hs "being served spawns a tip obligation; tipping respects the norm"
  test('being served spawns a tip obligation; tipping respects the norm', () => {
    const st = served();
    assert.ok(has(st, 'practice.settleUp.bex.ada'), 'the settle-up reaction is spawned');
    assert.ok(has(st, 'obliged.bex.bex.tipped.ada'), 'a first-class tip obligation (a real □) arose on serve');
    runSteps(st, [['bex', 'Tip ada']]);
    assert.ok(has(st, 'bex.tipped.ada'), 'bex tipped ada');
    assert.ok(!has(st, 'violated.bex.stiffedTheBartender'), 'no violation');
    assert.ok(!has(st, 'practice.settleUp.bex.ada'), 'the reaction is cleared');
    assert.ok(!has(st, 'obliged.bex.bex.tipped.ada'), 'the □ obligation is discharged once tipped');
  });

  // R: bar.rs leaving_the_tab_draws_disapproval
  // H: BarSpec.hs "leaving the tab is a violation that draws the bartender's disapproval"
  test("leaving the tab is a violation that draws the bartender's disapproval", () => {
    const st = served();
    runSteps(st, [['bex', 'Leave ada']]);
    assert.ok(has(st, 'violated.bex.stiffedTheBartender'), 'the violation is marked');
    assert.ok(has(st, 'obliged.bex.obliged.bex.make.amends.with.ada'), 'a reparative □□ obligation arises after the breach (contrary-to-duty)');
    assert.ok(has(st, 'practice.disapproval.bex.ada'), 'the disapproval reaction is spawned for ada');
    runSteps(st, [['ada', 'Disapprove of bex']]);
    assert.ok(has(st, 'ada.relationship.bex.warmth.score!-20'), `ada cooled toward bex, got ${JSON.stringify(st.labeledFacts())}`);
  });

  // R: bar.rs a_believed_grudge_suppresses_friendliness
  // H: BarSpec.hs "a believed grudge suppresses friendliness (a false belief drives behaviour)"
  test('a believed grudge suppresses friendliness (a false belief drives behaviour)', () => {
    const st = barWorld();
    st.performOutcome(insert('practice.world.world.at.bex!bar'));
    st.performOutcome(adjustScore('bex', 'ada', WARMTH, 20, 'fond'));
    const can = (needle: string): boolean => st.possibleActions('bex').some((ga) => ga.label.includes(needle));
    assert.ok(can('Buy ada a drink'), 'warm bex would buy');
    assert.ok(can('Greet ada'), 'warm bex would greet');
    st.performOutcome(believe('bex', 'resentedBy.ada', 'yes'));
    assert.ok(!can('Buy ada a drink'), 'the belief blocks the gift');
    assert.ok(!can('Greet ada'), 'the belief blocks greeting');
  });

  // R: bar.rs a_grudge_lets_you_plant_a_rumour
  // H: BarSpec.hs "a grudge lets you plant a (possibly-false) rumour"
  test('a grudge lets you plant a (possibly-false) rumour', () => {
    const st = barWorld();
    for (const o of [
      insert('practice.world.world.at.ada!entrance'),
      insert('practice.world.world.at.you!bar'),
      insert('practice.world.world.at.bex!bar'),
      feelToward('you', ANNOYED, 'ada'),
    ]) {
      st.performOutcome(o);
    }
    assert.ok(labelsOf(st, 'you').some((l) => l.includes('Warn bex that ada resents')), "the rumour is available behind ada's back");
    runSteps(st, [['you', 'Warn bex that ada resents']]);
    assert.ok(has(st, 'bex.believes.resentedBy.ada!yes'), `bex now believes ada resents them, got ${JSON.stringify(st.labeledFacts())}`);
  });

  // R: bar.rs evidence_of_warmth_dispels_a_false_belief
  // H: BarSpec.hs "evidence of warmth dispels a false belief"
  test('evidence of warmth dispels a false belief', () => {
    const st = barWorld();
    for (const o of [insert('practice.world.world.at.bex!bar'), believe('bex', 'resentedBy.ada', 'yes'), insert('practice.greet.world.greeted.ada.bex')]) {
      st.performOutcome(o);
    }
    assert.ok(labelsOf(st, 'bex').some((l) => l.includes("Realize ada doesn't resent you")), 'bex can reconsider');
    runSteps(st, [['bex', "Realize ada doesn't resent you"]]);
    assert.ok(!st.labeledFacts().some((f) => f.includes('bex.believes.resentedBy.ada')), 'the false belief is dropped');
  });

  // R: bar.rs friends_can_strike_up_a_chat_and_quips_stay_on_topic
  // H: BarSpec.hs "friends can strike up a chat; quips stay on topic and shift feeling"
  test('friends can strike up a chat; quips stay on topic and shift feeling', () => {
    const st = barWorld();
    for (const o of [insert('practice.world.world.at.bex!bar'), adjustScore('bex', 'ada', WARMTH, 20, 'fond')]) st.performOutcome(o);
    assert.ok(labelsOf(st, 'bex').some((l) => l.includes('Strike up a conversation with ada')), 'warm bex can strike up a conversation');
    runSteps(st, [['bex', 'Strike up a conversation with ada']]);
    assert.ok(labelsOf(st, 'bex').some((l) => l.includes('Make small talk with ada')), 'small talk is on topic');
    assert.ok(!labelsOf(st, 'bex').some((l) => l.includes('Compliment ada')), 'the compliment is off topic (withheld)');
    runSteps(st, [
      ['bex', 'Make small talk with ada'],
      ['ada', 'Warm the talk toward rapport'],
      ['bex', 'Compliment ada'],
    ]);
    assert.ok(has(st, 'ada.relationship.bex.warmth.score!10'), `the compliment warmed ada toward bex, got ${JSON.stringify(st.labeledFacts())}`);
  });

  // R: bar.rs a_gossip_quip_transmits_a_belief
  // H: BarSpec.hs "a gossip quip transmits a (possibly-false) belief in conversation"
  test('a gossip quip transmits a (possibly-false) belief in conversation', () => {
    const st = barWorld();
    st.performOutcome(feelToward('bex', ANNOYED, 'you'));
    for (const o of beginConversation('bex', 'ada', 'gossip')) st.performOutcome(o);
    assert.ok(labelsOf(st, 'bex').some((l) => l.includes('Confide to ada that you resents them')), 'the gossip quip is available to the speaker');
    runSteps(st, [['bex', 'Confide to ada that you resents them']]);
    assert.ok(has(st, 'ada.believes.resentedBy.you!yes'), `ada now believes you resent her, got ${JSON.stringify(st.labeledFacts())}`);
  });

  // R: bar.rs the_director_has_nothing_to_do_in_a_placid_room
  // H: BarSpec.hs "the director (story manager) has nothing to do in a placid room"
  test('the director (story manager) has nothing to do in a placid room', () => {
    const st = barWorld();
    assert.equal(st.possibleActions('director').length, 0, 'the director is idle when nothing is warm');
  });

  // R: bar.rs the_director_injects_a_rivalry_between_two_warm_friends
  // H: BarSpec.hs "the director injects a rivalry between two warm friends"
  test('the director injects a rivalry between two warm friends', () => {
    const st = barWorld();
    for (const o of [adjustScore('ada', 'bex', WARMTH, 25, 'friends'), adjustScore('bex', 'ada', WARMTH, 25, 'friends')]) st.performOutcome(o);
    const dirActs = st.possibleActions('director');
    assert.ok(dirActs.length > 0, 'the director can now act');
    assert.ok(
      dirActs.every((ga) => ga.practiceId === 'dm'),
      `the director only acts through its own (dm) practice, got ${JSON.stringify(dirActs.map((g) => [g.practiceId, g.label]))}`,
    );
    runSteps(st, [['director', 'turn ada against bex']]);
    assert.ok(has(st, 'dm.stirred'), 'the beat is marked done');
    assert.ok(has(st, 'practice.greet.world.grievance.ada.bex'), 'ada now bears a grievance against bex');
    assert.ok(has(st, 'ada.relationship.bex.warmth.score!-5'), `and their warmth has soured, got ${JSON.stringify(st.labeledFacts())}`);
  });

  // R: bar.rs a_characters_arc_advances_to_belonging
  // H: BarSpec.hs "a character's arc advances to belonging once it feels at home"
  test("a character's arc advances to belonging once it feels at home", () => {
    const st = barWorld();
    st.performOutcome(adjustScore('bex', 'ada', WARMTH, 20, 'fond'));
    assert.ok(labelsOf(st, 'bex').some((l) => l.includes('settle in, feeling you belong')), 'the belonging beat is available');
    runSteps(st, [['bex', 'settle in, feeling you belong']]);
    assert.ok(has(st, 'bex.arc!belonging'), 'bex now belongs');
  });

  // R: bar.rs the_against_desires_transformation_is_offered_but_refused
  // H: BarSpec.hs "the against-desires transformation is offered but the planner refuses it"
  test('the against-desires transformation is offered but the planner refuses it', () => {
    const st = barWorld();
    assert.ok(labelsOf(st, 'bex').some((l) => l.includes('give up on the evening')), 'the transformation is on the table');
    const bexChar = characterNamed(st, 'bex');
    const ga = st.pickAction(2, bexChar);
    assert.ok(ga === null || !ga.label.includes('give up'), 'bex never resigns to solitude on its own');
  });
});

// ---- le monde « joueur metteur en scène » --------------------------------------

// R: bar.rs tests (player-as-DM)
// H: DirectorSpec.hs "Prax.Worlds.Bar (player-as-DM)"
describe('Prax.Worlds.Bar (player-as-DM)', () => {
  function directorChar(st: State): Character {
    return characterNamed(st, DIRECTOR_NAME);
  }

  /** Exécute l'affordance du metteur en scène dont le libellé contient `needle`. */
  function direct(st: State, needle: string): void {
    const acts = st.candidateActions(directorChar(st));
    const ga = acts.find((g) => g.label.includes(needle));
    if (ga === undefined) throw new Error(`no director nudge matching ${JSON.stringify(needle)}; had: ${JSON.stringify(acts.map((g) => g.label))}`);
    st.performAction(ga);
  }

  function bexCan(st: State): string[] {
    return st.candidateActions(characterNamed(st, 'bex')).map((ga) => ga.label);
  }

  // R: bar.rs the_drama_manager_is_offered_only_metalevel_affordances
  // H: DirectorSpec.hs "the drama manager is offered only metalevel affordances"
  test('the drama manager is offered only metalevel affordances', () => {
    const st = barDirectorWorld();
    const acts = st.candidateActions(directorChar(st));
    assert.ok(acts.length > 0, 'the DM has nudges to make');
    assert.ok(
      acts.every((ga) => ga.practiceId === 'direct'),
      `every DM affordance is a metalevel \`direct\` move (never embodied), got ${JSON.stringify(acts.map((g) => [g.practiceId, g.label]))}`,
    );
    const all = acts.map((ga) => ga.label).join(' ');
    for (const needle of ['stir up a rivalry', 'kindle warmth', 'cast a pall']) assert.ok(all.includes(needle), `${needle} offered, got ${all}`);
  });

  // R: bar.rs a_dm_nudge_reshapes_the_world_without_embodying_anyone
  // H: DirectorSpec.hs "a DM nudge reshapes the world without the DM embodying anyone"
  test('a DM nudge reshapes the world without the DM embodying anyone', () => {
    const st = barDirectorWorld();
    direct(st, 'stir up a rivalry between bex and cai');
    assert.ok(st.labeledFacts().includes('bex.feels.annoyed.toward.cai'), `bex is now annoyed at cai, got ${JSON.stringify(st.labeledFacts())}`);
    assert.ok(st.labeledFacts().includes('practice.greet.world.grievance.bex.cai'), 'a grievance is recorded');
    assert.ok(!st.candidateActions(directorChar(st)).some((ga) => ga.label.includes('rivalry between bex and cai')), 'the stir is one-shot for that pair');
  });

  // R: bar.rs the_binding_is_what_keeps_a_director_disembodied
  // (pin propre au Rust, sans libellé H)
  test('the binding is what keeps a director disembodied', () => {
    for (const [st, who, pid] of [
      [barWorld(), 'director', 'dm'],
      [barDirectorWorld(), DIRECTOR_NAME, 'direct'],
    ] as const) {
      const dir = characterNamed(st, who);
      assert.equal(dir.boundTo, pid, `${who} is bound to its metalevel practice`);
      st.performOutcome(insert(`practice.world.world.at.${who}!bar`));
      const acts = st.candidateActions(dir);
      assert.ok(
        acts.every((ga) => ga.practiceId === pid),
        `a PLACED ${who} is still offered only ${pid} moves, got ${JSON.stringify(acts.map((g) => [g.practiceId, g.label]))}`,
      );
      // l'autre moitié : même monde, même placement, sans la liaison
      const unbound = st;
      const cast = unbound.characters.map((c) => (c.name === who ? { ...c, boundTo: null } : c));
      unbound.setCharacters(cast);
      const bare = character(who);
      const loose = unbound.candidateActions(bare);
      assert.ok(
        loose.some((ga) => ga.practiceId !== pid),
        `an UNBOUND placed ${who} picks up embodied affordances; got ${JSON.stringify(loose.map((g) => [g.practiceId, g.label]))}`,
      );
    }
  });

  // R: bar.rs a_dm_nudge_opens_a_new_affordance_for_an_autonomous_character
  // H: DirectorSpec.hs "a DM nudge opens a new affordance for an autonomous character"
  test('a DM nudge opens a new affordance for an autonomous character', () => {
    const st = barDirectorWorld();
    assert.ok(!bexCan(st).some((l) => l.includes('Buy ada a drink')), "bex can't buy ada a drink while cold");
    direct(st, 'kindle warmth between bex and ada');
    assert.ok(bexCan(st).some((l) => l.includes('Buy ada a drink')), 'after the DM kindles warmth, bex may buy ada a drink');
  });
});

// =============================================================================
// vampire.rs
// =============================================================================

// R: vampire.rs tests
describe('Prax.Worlds.Vampire', () => {
  /**
   * Les villageois et leur foyer — copie de la constante privée `HOMES` de
   * `vampire.rs` (non exportée par le portage TS ; même ordre).
   */
  const HOMES: ReadonlyArray<readonly [string, string]> = [
    ['aldric', 'square'],
    ['mara', 'square'],
    ['bram', 'church'],
    ['cole', 'church'],
    ['rosa', 'mill'],
    ['gideon', 'mill'],
    ['nessa', 'home'],
    ['tam', 'home'],
  ];
  const scale = TEST_SCALE;
  const cycle = scale.dayTurns + scale.nightTurns;

  /** Le constructeur de la suite : l'échelle compressée. */
  const world = (): State => vampireWorld(TEST_SCALE);

  const fact = (st: State, path: string): boolean => st.viewHas(path);

  const countVampires = (st: State): number => st.labeledView().filter((f) => f.startsWith('vampire.')).length;

  const countAt = (st: State, place: string): number => HOMES.filter(([who]) => fact(st, `practice.world.world.at.${who}!${place}`)).length;

  function positionOf(st: State, who: string): string | null {
    const prefix = `practice.world.world.at.${who}!`;
    return st.labeledView().find((f) => f.startsWith(prefix)) ?? null;
  }

  const allPositions = (st: State): Array<[string, string | null]> => HOMES.map(([who]) => [who, positionOf(st, who)]);

  function householdOf(who: string): string[] {
    const entry = HOMES.find(([w]) => w === who);
    if (entry === undefined) throw new Error(`no such villager in HOMES: ${who}`);
    return HOMES.filter(([, home]) => home === entry[1]).map(([w]) => w);
  }

  function placeOf(st: State, who: string): string | null {
    const p = positionOf(st, who);
    if (p === null) return null;
    const parts = p.split('!');
    return parts[parts.length - 1];
  }

  function factPrefix(st: State, path: string): boolean {
    return st.labeledView().some((f) => f === path || f.startsWith(`${path}.`) || f.startsWith(`${path}!`));
  }

  function advanceToFirstNight(st: State): void {
    for (let i = 0; i < 8; i++) {
      st.roundBoundary();
      if (fact(st, 'phase!night')) return;
    }
    throw new Error('the clock never reached phase!night after 8 round boundaries');
  }

  function seededTwoAt(vampire: string, victim: string, place: string): State {
    const st = world();
    st.performOutcome(insert(`vampire.${vampire}`));
    st.performOutcome(insert(`practice.world.world.at.${vampire}!${place}`));
    st.performOutcome(insert(`practice.world.world.at.${victim}!${place}`));
    return st;
  }

  const makeHungry = (st: State, who: string): void => st.performOutcome(insert(`bloodHunger.${who}`));

  function groundFeed(st: State, vampire: string, victim: string): GroundedAction {
    const needle = `feed on ${victim}`;
    const ga = st.possibleActions(vampire).find((g) => g.practiceId === 'prey' && g.label.includes(needle));
    if (ga === undefined) throw new Error(`no feed-on-${victim} action offered to ${vampire}; available: ${JSON.stringify(labelsOf(st, vampire))}`);
    return ga;
  }

  function feedIsAvailable(st: State, vampire: string, victim: string): boolean {
    const needle = `feed on ${victim}`;
    return st.possibleActions(vampire).some((ga) => ga.practiceId === 'prey' && ga.label.includes(needle));
  }

  function advanceBoundaries(st: State, n: number): void {
    for (let i = 0; i < n; i++) st.roundBoundary();
  }

  /** Le personnage tel que le déclare la distribution d'un monde neuf (avec ses désirs portés). */
  function villager(name: string): Character {
    const c = world().characters.find((ch) => ch.name === name);
    if (c === undefined) throw new Error(`no such character: ${name}`);
    return c;
  }

  const forceFact = (st: State, path: string): void => st.performOutcome(insert(path));

  /** Referme toute la vue depuis la base (transformation identité). */
  const reclose = (st: State): void => st.withDb((db) => db);

  const someoneBelievedVampire = (st: State): boolean =>
    st.labeledView().some((f) => HOMES.some(([who]) => f.endsWith(`.believes.vampire.${who}`)));

  // ---- la trajectoire libre partagée (advance + npcAct, profondeur 2) ----------

  /**
   * `snapshots[k]` = l'état après k pas (advance + npcAct à profondeur 2) depuis
   * `world()`. Prolongée à la demande, jamais rejouée.
   */
  const free = { st: null as State | null, snapshots: [] as State[] };
  function freeLoopAt(k: number): State {
    if (free.st === null) {
      free.st = world();
      free.snapshots.push(free.st.clone());
    }
    while (free.snapshots.length <= k) {
      const actor = advance(free.st);
      npcAct(free.st, 2, actor);
      free.snapshots.push(free.st.clone());
    }
    return free.snapshots[k].clone();
  }

  // R: vampire.rs the_world_builds_and_is_well_formed
  test('the world builds and is well-formed', () => {
    const st = world();
    assert.deepEqual(typeCheck(st), [], 'the vampire world must be well-formed');
    for (const who of ['aldric', 'mara', 'bram', 'cole', 'rosa', 'gideon', 'nessa', 'tam']) {
      assert.ok(st.labeledFacts().includes(`character.${who}`), `${who} should be a character in the world, got ${JSON.stringify(st.labeledFacts())}`);
    }
  });

  // R: vampire.rs phase_spans_the_day_then_the_night
  // H: task-2-brief.md "phase spans a real day, not a flip every turn"
  test('phase spans the day, then the night', () => {
    const st = vampireWorld(scale);
    for (let i = 0; i < cycle * 2; i++) {
      st.roundBoundary();
      const turn = st.currentTurn();
      const inCycle = ((turn % cycle) + cycle) % cycle;
      if (inCycle < scale.dayTurns) {
        assert.ok(fact(st, 'phase!day'), `turn ${turn} (in-cycle ${inCycle}) should be day, phase!day absent`);
        assert.ok(!fact(st, 'phase!night'), `turn ${turn} (in-cycle ${inCycle}) should be day, but phase!night holds`);
      } else {
        assert.ok(fact(st, 'phase!night'), `turn ${turn} (in-cycle ${inCycle}) should be night, phase!night absent`);
        assert.ok(!fact(st, 'phase!day'), `turn ${turn} (in-cycle ${inCycle}) should be night, but phase!day holds`);
      }
    }
  });

  // R: vampire.rs villagers_are_home_at_night_and_mostly_at_the_square_by_day
  // H: task-3-brief.md "villagers home at night, in the square by day"
  test('villagers are home at night and mostly at the square by day', () => {
    const castSize = HOMES.length;
    const rounds = cycle * 2;
    for (let round = 0; round < rounds; round++) {
      // fin du tour `round` : (round + 1) * castSize pas de la boucle réelle
      const st = freeLoopAt((round + 1) * castSize);
      if (fact(st, 'phase!night')) {
        for (const [who, home] of HOMES) {
          if (fact(st, `vampire.${who}`)) continue; // la faim peut écarter un vampire du rythme
          assert.ok(
            fact(st, `practice.world.world.at.${who}!${home}`),
            `round ${round}: human villager ${who} should be home (${home}) at night; positions: ${JSON.stringify(allPositions(st))}`,
          );
        }
      } else {
        assert.ok(fact(st, 'phase!day'), `round ${round}: phase must be day or night`);
        const atSquare = countAt(st, 'square');
        assert.ok(atSquare * 2 >= castSize, `round ${round}: expected most of the cast at the square by day, got ${atSquare}/${castSize}`);
      }
    }
  });

  // R: vampire.rs patient_zero_turns_after_the_first_day
  // H: task-2-brief.md "Patient zero turns on the first night"
  test('patient zero turns after the first day', () => {
    const st = world();
    assert.ok(!fact(st, 'vampire.mara'), 'no vampire before the first night');
    advanceToFirstNight(st);
    assert.ok(fact(st, 'vampire.mara'), 'mara is patient zero after night 1');
    assert.equal(countVampires(st), 1, 'exactly one vampire at the start');
  });

  // R: vampire.rs feeding_marks_the_victim_and_locks_the_cooldown
  // H: task-3-brief.md "The feed action leaves a mark, arms the transformation timer, and arms a feed cooldown"
  test('feeding marks the victim and locks the cooldown', () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    makeHungry(st, 'mara');
    st.performAction(groundFeed(st, 'mara', 'bram'));
    assert.ok(fact(st, 'mark.bram.neck'), 'the bite leaves a neck mark');
    assert.ok(factPrefix(st, 'bittenOn.bram'), 'the bite is timestamped');
    assert.ok(fact(st, 'fed.mara'), 'feeding arms the cooldown');
    assert.ok(!fact(st, 'bloodHunger.mara'), 'feeding sates hunger');
    makeHungry(st, 'mara');
    assert.ok(!feedIsAvailable(st, 'mara', 'bram'), 'cooldown blocks re-feeding');
  });

  // R: vampire.rs feed_will_not_target_self_or_another_vampire
  // H: task-3 feed guards — a vampire cannot feed on itself or on another vampire
  test('feed will not target self or another vampire', () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    makeHungry(st, 'mara');
    assert.ok(!feedIsAvailable(st, 'mara', 'mara'), 'a vampire cannot feed on itself');
    st.performOutcome(insert('vampire.bram'));
    assert.ok(!feedIsAvailable(st, 'mara', 'bram'), 'a vampire cannot feed on another vampire');
  });

  // R: vampire.rs a_bitten_incubating_victim_cannot_be_rebitten
  // H: bite-defect "an already-bitten, still-incubating victim cannot be re-bitten"
  test('a bitten, incubating victim cannot be re-bitten', () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    st.performOutcome(insert('practice.world.world.at.cole!mill'));
    st.performOutcome(insert('vampire.cole'));
    makeHungry(st, 'mara');
    st.performAction(groundFeed(st, 'mara', 'bram'));
    makeHungry(st, 'cole');
    assert.ok(!feedIsAvailable(st, 'cole', 'bram'), 'an already-bitten, incubating victim cannot be re-bitten');
  });

  // R: vampire.rs the_feed_cooldown_clears_after_its_delay
  // H: task-3 feed cooldown — clears after TimeScale::test().cooldown so the vampire can feed again
  test('the feed cooldown clears after its delay', () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    st.performOutcome(insert('practice.world.world.at.cole!mill'));
    makeHungry(st, 'mara');
    st.performAction(groundFeed(st, 'mara', 'bram'));
    assert.ok(fact(st, 'fed.mara'), 'feeding arms the cooldown');
    makeHungry(st, 'mara');
    assert.ok(!feedIsAvailable(st, 'mara', 'cole'), 'the cooldown blocks feeding again immediately');
    advanceBoundaries(st, TEST_SCALE.cooldown);
    assert.ok(!fact(st, 'fed.mara'), 'the cooldown clears after TimeScale::test().cooldown boundaries');
    assert.ok(feedIsAvailable(st, 'mara', 'cole'), 'once the cooldown clears the vampire can feed again');
  });

  // R: vampire.rs a_bite_is_witnessed_by_the_victim_and_bystanders
  // H: detection spec "a witnessed bite makes co-present characters believe a bite occurred"
  test('a bite is witnessed by the victim and bystanders', () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    st.performOutcome(insert('practice.world.world.at.cole!mill'));
    makeHungry(st, 'mara');
    st.performAction(groundFeed(st, 'mara', 'bram'));
    assert.ok(fact(st, 'bram.believes.bit.mara.bram.seen'), 'the victim witnesses who bit them');
    assert.ok(fact(st, 'cole.believes.bit.mara.bram.seen'), 'a bystander witnesses the bite');
    assert.ok(!fact(st, 'mara.believes.bit.mara.bram.seen'), 'the actor is not their own witness');
  });

  // R: vampire.rs a_witnessed_bite_makes_the_witness_suspect_the_biter
  // H: detection spec "believing X bit Y ⟹ believing X is a vampire"
  test('a witnessed bite makes the witness suspect the biter', () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    makeHungry(st, 'mara');
    st.performAction(groundFeed(st, 'mara', 'bram'));
    assert.ok(fact(st, 'bram.believes.vampire.mara'), 'the bitten victim suspects mara is a vampire');
  });

  // R: vampire.rs dropping_a_disguise_restores_the_true_identity
  // H: detection spec "disguise is a toggle — dropping it restores the true identity"
  test('dropping a disguise restores the true identity', () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    st.performAction(findAction(st, 'mara', 'put on a disguise'));
    assert.ok(fact(st, 'appears.mara!someone'), 'mara is disguised');
    st.performAction(findAction(st, 'mara', 'drop the disguise'));
    assert.ok(fact(st, 'appears.mara!mara'), 'dropping the disguise restores her name');
    assert.ok(!fact(st, 'appears.mara!someone'), 'she is no longer disguised');
  });

  // R: vampire.rs a_disguised_bite_masks_the_biter
  // H: detection spec "a disguised bite records 'someone', not the biter's name"
  test("a disguised bite records 'someone', not the biter's name", () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    makeHungry(st, 'mara');
    st.performAction(findAction(st, 'mara', 'put on a disguise'));
    assert.ok(fact(st, 'appears.mara!someone'), 'disguise masks the apparent identity');
    st.performAction(groundFeed(st, 'mara', 'bram'));
    assert.ok(fact(st, 'bram.believes.bit.someone.bram.seen'), "the bite is attributed to 'someone'");
    assert.ok(!fact(st, 'bram.believes.bit.mara.bram.seen'), "the biter's name is not recorded");
    assert.ok(!fact(st, 'bram.believes.vampire.mara'), 'a masked bite breeds no suspicion of mara');
  });

  // R: vampire.rs a_bitten_victim_turns_after_the_delay
  // H: task-4-brief.md "A bitten victim turns after the delay"
  test('a bitten victim turns after the delay', () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    makeHungry(st, 'mara');
    st.performAction(groundFeed(st, 'mara', 'bram'));
    assert.ok(!fact(st, 'vampire.bram'), 'not yet turned right after the bite');
    advanceBoundaries(st, TEST_SCALE.incubation);
    assert.ok(fact(st, 'vampire.bram'), 'bram turns after the delay');
    assert.ok(fact(st, 'mark.bram.neck'), 'the turned still bears the mark');
  });

  // R: vampire.rs a_hungry_vampire_with_prey_chooses_to_feed
  // H: task-5-brief.md "A hungry vampire with prey at hand chooses to feed"
  test('a hungry vampire with prey at hand disguises, then chooses to feed', () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    makeHungry(st, 'mara');
    const firstLabel = st.pickAction(2, villager('mara'))?.label ?? '';
    assert.ok(firstLabel.includes('put on a disguise'), `a hungry vampire disguises before feeding in the open; got ${JSON.stringify(firstLabel)}`);
    st.performAction(findAction(st, 'mara', 'put on a disguise'));
    const label = st.pickAction(2, villager('mara'))?.label ?? '';
    assert.ok(label.includes('feed on bram'), `once disguised, a hungry vampire feeds; got ${JSON.stringify(label)}`);
  });

  // R: vampire.rs a_hungry_vampire_prefers_to_disguise_before_feeding_in_the_open
  // H: detection spec "the vampire conceals being believed a vampire, so it disguises first"
  test('a hungry vampire prefers to disguise before feeding in the open', () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    makeHungry(st, 'mara');
    const label = st.pickAction(2, villager('mara'))?.label ?? '';
    assert.ok(label.includes('put on a disguise'), `a hungry vampire with an unconcealed identity disguises before biting in the open; got ${JSON.stringify(label)}`);
  });

  // R: vampire.rs count_vampires_includes_derived_vampires
  test('countVampires includes derived vampires', () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    makeHungry(st, 'mara');
    st.performAction(groundFeed(st, 'mara', 'bram'));
    advanceBoundaries(st, TEST_SCALE.incubation);
    assert.ok(fact(st, 'vampire.bram'), 'bram turns after the delay');
    assert.equal(countVampires(st), 2, "count_vampires must count bram's derived vampire.bram alongside mara's base-fact vampire.mara");
  });

  // R: vampire.rs a_witnessed_bite_spreads_by_gossip_to_an_absent_villager
  // H: detection spec "suspicion spreads by gossip, not omniscience"
  test('a witnessed bite spreads by gossip to an absent villager', () => {
    const st = seededTwoAt('mara', 'bram', 'mill');
    st.performOutcome(insert('practice.world.world.at.cole!mill'));
    st.performOutcome(insert('practice.world.world.at.rosa!square'));
    makeHungry(st, 'mara');
    st.performAction(groundFeed(st, 'mara', 'bram'));
    assert.ok(fact(st, 'cole.believes.bit.mara.bram.seen'), 'cole witnessed it');
    assert.ok(!fact(st, 'rosa.believes.bit.mara.bram.seen'), 'rosa did not witness it');
    st.performOutcome(insert('practice.world.world.at.rosa!mill'));
    st.performAction(findAction(st, 'cole', 'spread word'));
    assert.ok(factPrefix(st, 'rosa.believes.bit.mara.bram.heard'), 'rosa hears of the bite from cole');
    reclose(st);
    assert.ok(fact(st, 'rosa.believes.vampire.mara'), 'hearsay breeds suspicion too');
  });

  // R: vampire.rs endings_fire_on_their_conditions
  // H: task-7a-brief.md "the endings fire as base-fact referee schedule rules, harness-visible via db_child_keys"
  test('the endings fire on their conditions, as base facts', () => {
    const st = world();
    forceFact(st, 'everBitten');
    st.roundBoundary();
    assert.ok(fact(st, 'ending.village'), 'no vampires => village ending');
    assert.ok(!fact(st, 'ending.vampires'), 'not simultaneously the vampire ending');
    assert.ok(st.dbChildKeys('ending').includes('village'), 'the village ending must be a base fact visible to the stress harness');

    const st2 = world();
    forceFact(st2, 'everBitten');
    for (const who of ['aldric', 'mara', 'bram', 'cole', 'rosa', 'gideon', 'nessa', 'tam']) forceFact(st2, `vampire.${who}`);
    st2.roundBoundary();
    assert.ok(fact(st2, 'ending.vampires'), 'all turned => vampire ending');
    assert.ok(st2.dbChildKeys('ending').includes('vampires'), 'the vampire ending must be a base fact visible to the stress harness');
  });

  // R: vampire.rs endings_absent_before_the_outbreak
  test('endings are absent before the outbreak', () => {
    const st = world();
    reclose(st);
    assert.ok(!fact(st, 'ending.village'), 'no village ending before any boundary');
    assert.ok(!fact(st, 'ending.vampires'), 'no vampire ending before any boundary');
    assert.equal(st.dbChildKeys('ending').length, 0, 'no base ending fact before any boundary');
  });

  // R: vampire.rs everbitten_guard_blocks_endings_before_the_outbreak
  // `village_wins_rule()` et `VAMPIRE_SEED` sont privés au module Rust (et au
  // portage TS) : on les relit sur un monde construit (sa source de calendrier
  // et sa graine), ce qui donne exactement les mêmes valeurs.
  test('the everBitten guard blocks the endings before the outbreak', () => {
    const built = world();
    const villageWins = built.scheduleSrc().find((r) => r.name === 'villageWins');
    assert.ok(villageWins !== undefined, 'the villageWins referee rule is in the vampire schedule');
    const seed = built.rngSeed;
    assert.ok(seed !== null, 'the vampire world seeds its die');
    const st = new State();
    st.setCharacters([character('a'), character('b')]);
    st.setSchedule([villageWins]);
    st.seedDie(seed);
    st.roundBoundary();
    assert.ok(!fact(st, 'ending.village'), 'the everBitten guard must block the referee rule before the outbreak');
    assert.equal(st.dbChildKeys('ending').length, 0, 'no base ending fact either');
  });

  /**
   * La boucle « jusqu'à une fin » commune aux trois tests suivants : au plus 400
   * pas, arrêt dès qu'un fait `ending.*` de base existe. Renvoie le nombre de pas
   * joués (les instantanés 1..n de `freeLoopAt`).
   */
  function stepsToEnding(cap: number): number {
    for (let k = 1; k <= cap; k++) {
      if (freeLoopAt(k).dbChildKeys('ending').length > 0) return k;
    }
    return cap;
  }

  // R: vampire.rs the_infection_runs_to_an_ending
  test('the infection runs to an ending', () => {
    const n = stepsToEnding(400);
    const reached = freeLoopAt(n).dbChildKeys('ending')[0] ?? null;
    assert.equal(reached, 'vampires', `the skeleton loop must close to the vampire ending; got ${reached}`);
  });

  // R: vampire.rs the_vampire_conceals_itself_by_disguising_before_feeding
  // H: detection spec "the crux — the vampire emergently disguises before feeding"
  test('the vampire conceals itself by disguising before feeding', () => {
    const n = stepsToEnding(400);
    let fedAtLeastOnce = false;
    for (let k = 1; k <= n; k++) {
      const st = freeLoopAt(k);
      if (factPrefix(st, 'bittenOn')) fedAtLeastOnce = true;
      assert.ok(!someoneBelievedVampire(st), 'every vampire must stay concealed — each disguises before biting');
    }
    assert.ok(fedAtLeastOnce, 'the vampire did feed (concealed), not merely avoid feeding');
  });

  // R: vampire.rs mara_turns_unobserved_by_non_household
  // H: task-4-brief.md "(a) unobserved turning — no non-household member is co-present with patient zero at the turn, and no belief forms from it"
  test('mara turns unobserved by non-household', () => {
    const household = householdOf('mara');
    const steps = cycle * HOMES.length * 3;
    let turnedAt: number | null = null;
    for (let k = 1; k <= steps; k++) {
      const was = fact(freeLoopAt(k - 1), 'vampire.mara');
      if (fact(freeLoopAt(k), 'vampire.mara') && !was) {
        turnedAt = k;
        break;
      }
    }
    assert.ok(turnedAt !== null, 'patient zero must turn within the run');
    const st = freeLoopAt(turnedAt);
    assert.ok(fact(st, 'phase!night'), 'patient zero turns at night');
    const maraPlace = placeOf(st, 'mara');
    assert.equal(maraPlace, 'square', 'patient zero turns at her own home');
    for (const [who] of HOMES) {
      if (household.includes(who)) continue;
      assert.notEqual(
        placeOf(st, who),
        maraPlace,
        `${who} (not mara's household) is co-present with her the moment she turns; positions: ${JSON.stringify(allPositions(st))}`,
      );
    }
    assert.ok(!st.labeledView().some((f) => f.endsWith('.believes.vampire.mara')), 'no one believes mara a vampire from the (unwitnessed) turning');
  });

  // R: vampire.rs the_reachable_first_bite_lands_on_the_housemate_and_stays_concealed
  // H: task-4-brief.md "(b) nocturnal, concealed feeding"
  test('the reachable first bite lands on the housemate and stays concealed', () => {
    const n = stepsToEnding(400);
    let firstVictim: string | null = null;
    for (let k = 1; k <= n; k++) {
      const st = freeLoopAt(k);
      if (firstVictim === null) {
        for (const [who] of HOMES) {
          if (factPrefix(st, `bittenOn.${who}`)) {
            firstVictim = who;
            break;
          }
        }
      }
      assert.ok(!someoneBelievedVampire(st), 'every vampire must stay concealed — no one is ever believed a vampire by name');
    }
    assert.ok(firstVictim !== null, 'at least one bite must occur in the run');
    assert.ok(householdOf('mara').includes(firstVictim), `the first (reachable, same-household) bite should land on mara's own housemate; got ${firstVictim}`);
  });

  // R: vampire.rs real_scale_infection_closes_and_stays_concealed
  // H: task-5-brief.md "real-scale offline validation"
  // `#[ignore]` en Rust (des dizaines de milliers de tours) : ignoré ici aussi
  // sauf si PRAX_REAL_SCALE=1.
  test('real-scale infection closes and stays concealed', { skip: process.env.PRAX_REAL_SCALE === '1' ? false : 'real-scale: thousands of turns; set PRAX_REAL_SCALE=1' }, () => {
    const st = vampireWorld(REAL_SCALE);
    const started = Date.now();
    const realCycle = REAL_SCALE.dayTurns + REAL_SCALE.nightTurns;
    const capSteps = 30 * realCycle * HOMES.length + 30_000;
    let firstBite: [string, number, boolean] | null = null;
    let reached: string | null = null;
    let stepsTaken = 0;
    for (let i = 0; i < capSteps; i++) {
      stepsTaken++;
      const actor = advance(st);
      npcAct(st, 2, actor);
      if (firstBite === null) {
        for (const [who] of HOMES) {
          if (factPrefix(st, `bittenOn.${who}`)) {
            firstBite = [who, st.currentTurn(), fact(st, 'phase!night')];
            break;
          }
        }
      }
      assert.ok(!someoneBelievedVampire(st), 'every vampire must stay concealed at real scale — no one is ever believed a vampire by name');
      const e = st.dbChildKeys('ending');
      if (e.length > 0) {
        reached = e[0];
        break;
      }
    }
    assert.ok(firstBite !== null, "at least one bite must occur within the real-scale run's turn cap");
    const [victim, biteTurn, wasNight] = firstBite;
    console.log(
      `real-scale run: closed at turn ${st.currentTurn()} (${stepsTaken} character-turns, cap ${capSteps}) in ${Date.now() - started} ms; ` +
        `first bite victim=${victim} turn=${biteTurn} phase!night=${wasNight}; ending=${reached}`,
    );
    assert.ok(wasNight, `the first bite must land at night at real scale; victim=${victim} turn=${biteTurn} phase!night=${wasNight}`);
    assert.equal(reached, 'vampires', `the real-scale run must close to the vampire ending within ${capSteps} steps; got ${reached}`);
  });
});

// garde l'import de `matches` utile au typage des conditions si besoin futur
void matches;
