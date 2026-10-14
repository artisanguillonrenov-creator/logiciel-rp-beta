/**
 * Portage du `VillageSpec` de Prax (Rust, BSD-3-Clause) :
 * `prax/rust/conformance/src/village.rs` (spec Haskell gelée :
 * `prax/test/Prax/VillageSpec.hs`). Même scénario, mêmes assertions.
 *
 * Ce fichier porte les cas qui tiennent en temps raisonnable ; ceux qui lisent
 * les longues trajectoires libres (≥ 28 pas, ou le vol suivi de 42 à 105 pas)
 * sont dans `praxVillageLong.test.ts` et ne tournent qu'avec `PRAX_LONG=1`.
 *
 * LES TRAJECTOIRES SONT PARTAGÉES, comme dans l'original : le planificateur est
 * déterministe, donc un test qui veut l'état après N pas lit un instantané de
 * L'UNIQUE trace (prolongée paresseusement à la demande, jamais rejouée) au lieu
 * de re-simuler les mêmes N pas en privé. C'est une identité, pas une
 * approximation.
 *
 * Comme dans le Rust, les assertions portent sur `labeledFacts()`/`viewHas()`
 * (qui distinguent `!` de `.`) et `dbHas()` (correspondance par noms de
 * segments, l'`exists` de la spec Haskell).
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { State } from '../src/prax/core/engine';
import { motiveSignatureEq } from '../src/prax/core/planner';
import { matches } from '../src/prax/core/query';
import { advance, npcAct } from '../src/prax/core/turn';
import { Character, desire, insert, want } from '../src/prax/core/types';
import { adjustScore } from '../src/prax/vocab/coreModel';
import { ANGRY, feelToward, feelTowardFor } from '../src/prax/vocab/emotion';
import { PLAYER_NAME, villageWorld } from '../src/prax/worlds/village';

const CAST = ['you', 'bob', 'carol', 'dana', 'eve', 'gale'] as const;

// ---- utilitaires (village.rs) ---------------------------------------------------

/** Exécute l'action de `who` dont le libellé contient `needle` (panique sinon). */
function doAct(who: string, needle: string, st: State): void {
  const found = st.possibleActions(who).find((ga) => ga.label.includes(needle));
  if (found === undefined) {
    throw new Error(
      `no action for ${who} matching ${JSON.stringify(needle)}; had: ${JSON.stringify(st.possibleActions(who).map((ga) => ga.label))}`,
    );
  }
  st.performAction(found);
}

function offers(who: string, needle: string, st: State): boolean {
  return st.possibleActions(who).some((ga) => ga.label.includes(needle));
}

/** Un tour piloté par le planificateur ; le tour de `idle` est consommé sans agir. */
function idleStep(idle: string, st: State): void {
  const actor = advance(st);
  if (actor.name !== idle) npcAct(st, 2, actor);
}

/** `n` tours, tout le monde au planificateur sauf `idle`, qui attend. */
function driveIdle(idle: string, n: number, st: State): void {
  for (let i = 0; i < n; i++) idleStep(idle, st);
}

/** Une frontière de ronde : l'horloge avance et la règle de vue (période 1) tire. */
function tick(st: State): void {
  st.roundBoundary();
}

/**
 * Une trajectoire libre (joueur inactif) échantillonnée aux pas `steps`,
 * pilotée UNE fois et prolongée paresseusement : le premier test qui demande
 * le pas n la pousse jusqu'à n (en gardant au passage les instantanés des pas
 * échantillonnés), les suivants relisent les instantanés. Chaque lecture rend
 * une copie indépendante (`clone()`), comme le `.clone()` du Rust.
 */
class Trajectory {
  private st: State | null = null;
  private at = 0;
  private readonly snaps = new Map<number, State>();
  private readonly steps: ReadonlySet<number>;

  constructor(
    private readonly what: string,
    private readonly start: () => State,
    steps: readonly number[],
  ) {
    this.steps = new Set(steps);
  }

  stateAt(n: number): State {
    if (!this.steps.has(n)) throw new Error(`${this.what} was not sampled at step ${n}`);
    if (this.st === null) {
      this.st = this.start();
      if (this.steps.has(0)) this.snaps.set(0, this.st.clone());
    }
    while (this.at < n) {
      idleStep(PLAYER_NAME, this.st);
      this.at += 1;
      if (this.steps.has(this.at)) this.snaps.set(this.at, this.st.clone());
    }
    const snap = this.snaps.get(n);
    if (snap === undefined) throw new Error(`${this.what} was not sampled at step ${n}`);
    return snap.clone();
  }
}

/**
 * Les pas où la partie libre est échantillonnée (l'union de tous les indices
 * `freePlayAt` de la spec gelée, plus les deux que lit le pas du golden).
 */
const FREE_PLAY_STEPS = [5, 7, 9, 10, 18, 19, 28, 34, 36, 40, 42, 43, 48, 56, 100] as const;

const FREE_PLAY = new Trajectory('free play', villageWorld, FREE_PLAY_STEPS);
const freePlayAt = (n: number): State => FREE_PLAY.stateAt(n);

/** Le villageois nommé, pris dans la distribution. */
function villager(n: string): Character {
  const c = villageWorld().characters.find((ch) => ch.name === n);
  if (c === undefined) throw new Error(`no such villager: ${n}`);
  return c;
}

/**
 * La trajectoire forcée du chantage (une ouverture scriptée, puis partie
 * libre). gale quitte d'abord le moulin (sinon elle serait un troisième témoin
 * simultané du murmure d'eve) ; carol arrive et voit directement ; toutes deux
 * reviennent sur la place, où de vrais passants (bob, you) rendent crédible la
 * menace d'exposition de carol. Les ticks de vue après chaque déplacement.
 */
function whisperArcSetup(): State {
  const st = villageWorld();
  for (const [who, needle] of [
    ['gale', 'Go to square'],
    ['carol', 'Go to mill'],
    ['eve', 'whisper to dana that'],
    ['carol', 'Go to square'],
    ['eve', 'Go to square'],
  ] as const) {
    doAct(who, needle, st);
    tick(st);
  }
  return st;
}

const WHISPER_ARC = new Trajectory('the whisper arc', whisperArcSetup, [3, 6]);
const whisperArcAt = (n: number): State => WHISPER_ARC.stateAt(n);

/**
 * La trajectoire forcée du repli : eve murmure à dana (gale, encore au moulin,
 * en est témoin) ; eve se confesse à gale ; gale l'absout.
 */
function redemptionArcSetup(): State {
  const st = villageWorld();
  for (const [who, needle] of [
    ['eve', 'whisper to dana that carol stole the loaf'],
    ['eve', 'confess to gale about framing carol'],
    ['gale', 'absolve eve of slander'],
  ] as const) {
    doAct(who, needle, st);
    tick(st);
  }
  return st;
}

/**
 * Prolonge la trajectoire : gale et eve vont sur la place (où sont déjà
 * bob/carol/you), et eve murmure de nouveau — à un auditeur réellement NOUVEAU
 * (bob), donc une instance `whispered.eve.H` réellement distincte.
 */
function reoffendArcSetup(): State {
  const st = redemptionArcSetup();
  for (const [who, needle] of [
    ['gale', 'Go to square'],
    ['eve', 'Go to square'],
    ['eve', 'whisper to bob that carol stole the loaf'],
  ] as const) {
    doAct(who, needle, st);
    tick(st);
  }
  return st;
}

// R: village.rs tests
// H: VillageSpec.hs "Prax.Worlds.Village"
describe('Prax.Worlds.Village', () => {
  // R: village.rs the_theft_is_witnessed_by_the_square_not_the_mill
  // H: VillageSpec.hs "the theft is witnessed by the square, not the mill"
  test('the theft is witnessed by the square, not the mill', () => {
    const st = villageWorld();
    doAct('bob', 'steal the loaf', st);
    assert.ok(st.dbHas('carol.believes.stole.bob.loaf.seen'), 'carol (in the square) saw it');
    assert.ok(st.dbHas('you.believes.stole.bob.loaf.seen'), 'you (in the square) saw it');
    assert.ok(!st.dbHas('dana.believes.stole.bob.loaf.seen'), 'dana (at the mill) holds no such belief');
    assert.ok(!st.dbHas('bob.believes.stole.bob.loaf.seen'), 'bob is not his own witness');
  });

  // R: village.rs movement_is_not_news
  // H: VillageSpec.hs "movement is not news (undeclared actions deposit nothing)"
  test('movement is not news (undeclared actions deposit nothing)', () => {
    const st = villageWorld();
    doAct('bob', 'Go to mill', st);
    for (const w of ['you', 'carol', 'dana']) {
      assert.ok(!st.dbHas(`${w}.believes.went.bob.seen`), "no one 'believes' bob walked");
    }
  });

  // R: village.rs only_a_witness_can_confront_the_thief
  // H: VillageSpec.hs "only a witness can confront the thief"
  test('only a witness can confront the thief', () => {
    const st = villageWorld();
    doAct('bob', 'steal the loaf', st);
    assert.ok(offers('carol', 'confront bob', st), 'carol can confront');
    assert.ok(!offers('dana', 'confront bob', st), 'dana cannot');
  });

  // R: village.rs confronting_cools_the_witness_once
  // H: VillageSpec.hs "confronting cools the witness toward the thief, once"
  test('confronting cools the witness toward the thief, once', () => {
    const st = villageWorld();
    doAct('bob', 'steal the loaf', st);
    doAct('carol', 'confront bob', st);
    assert.ok(st.labeledFacts().includes('carol.relationship.bob.trust.score!-10'), 'trust dropped');
    assert.ok(!offers('carol', 'confront bob', st), 'confront is one-shot');
  });

  // R: village.rs hearsay_licenses_suspicion_not_confrontation
  // H: VillageSpec.hs "hearsay licenses suspicion, not confrontation"
  test('hearsay licenses suspicion, not confrontation', () => {
    const st = villageWorld();
    doAct('bob', 'steal the loaf', st);
    assert.ok(!offers('carol', 'eye bob', st), 'carol (eyewitness) is never offered mere suspicion');
    doAct('carol', 'Go to mill', st);
    doAct('carol', 'tell dana', st);
    doAct('dana', 'Go to square', st);
    assert.ok(offers('dana', 'eye bob', st), 'dana (hearsay) can eye bob');
    assert.ok(!offers('dana', 'confront bob', st), 'dana still cannot confront');
    doAct('dana', 'eye bob', st);
    assert.ok(st.labeledFacts().includes('dana.relationship.bob.trust.score!-5'), 'milder trust hit');
    assert.ok(!offers('dana', 'eye bob', st), 'suspicion is one-shot');
  });

  // R: village.rs seen_suppresses_suspicion_even_alongside_hearsay
  // H: VillageSpec.hs "seen suppresses suspicion even alongside hearsay"
  test('seen suppresses suspicion even alongside hearsay', () => {
    // L'état à preuves mêlées, construit directement : carol a vu ET (planté)
    // entendu. C'est la garde Absent[.seen] — pas l'absence d'ouï-dire — qui
    // doit bloquer son affordance de soupçon.
    const st = villageWorld();
    doAct('bob', 'steal the loaf', st);
    st.performOutcome(insert('carol.believes.stole.bob.loaf.heard.you'));
    assert.ok(!offers('carol', 'eye bob', st), 'carol still confronts rather than merely suspects');
  });

  // R: village.rs the_distrust_gate_closes_the_gossip_channel
  // H: VillageSpec.hs "the distrust gate closes the village's gossip channel"
  test("the distrust gate closes the village's gossip channel", () => {
    // « you » commence sur la place à côté de bob : toujours témoin oculaire, donc
    // carol ne peut JAMAIS proposer de le lui dire ; dana, ailleurs au moment du
    // vol, est la seule auditrice valide.
    const st = villageWorld();
    doAct('bob', 'steal the loaf', st);
    doAct('carol', 'Go to mill', st);
    assert.ok(offers('carol', 'tell dana', st), 'carol will tell dana while trust is unmarred');
    st.performOutcome(adjustScore('carol', 'dana', 'trust', -5, 'aSlight'));
    assert.ok(!offers('carol', 'tell dana', st), 'distrust closes the channel');
  });

  // R: village.rs three_regards_make_notoriety
  // H: VillageSpec.hs "three regards make notoriety; standing has teeth"
  test('three regards make notoriety; standing has teeth', () => {
    const st = villageWorld();
    doAct('bob', 'steal the loaf', st);
    assert.ok(!st.viewHas('notorious.bob.thief'), 'two witnesses are not notoriety');
    doAct('carol', 'Go to mill', st);
    doAct('carol', 'tell dana', st);
    assert.ok(st.viewHas('regards.carol.bob.thief'), 'carol regards bob a thief');
    assert.ok(st.viewHas('regards.dana.bob.thief'), 'dana (hearsay) regards too');
    assert.ok(st.viewHas('regards.you.bob.thief'), 'you (eyewitness) regard');
    assert.ok(!st.viewHas('regards.bob.bob.thief'), 'bob holds no self-regard');
    assert.ok(st.viewHas('notorious.bob.thief'), 'the whole village knows: notorious');
    assert.ok(offers('carol', 'shun bob', st), 'carol may shun bob');
    assert.ok(offers('bob', 'return the loaf', st), 'bob may return the loaf');
  });

  // R: village.rs amends_is_only_offered_under_someones_regard
  // H: VillageSpec.hs "amends is only offered under someone's regard"
  test("amends is only offered under someone's regard", () => {
    const st = villageWorld();
    st.performOutcome(insert('holding.bob.loaf'));
    assert.ok(!offers('bob', 'return the loaf', st), 'no regard, no apology affordance');
  });

  // R: village.rs atonement_dissolves_standing_while_memory_persists
  // H: VillageSpec.hs "atonement dissolves standing while memory persists"
  test('atonement dissolves standing while memory persists', () => {
    const st = villageWorld();
    doAct('bob', 'steal the loaf', st);
    doAct('carol', 'shun bob', st);
    doAct('bob', 'return the loaf', st);
    assert.ok(st.dbHas('atoned.bob'), 'atoned');
    assert.ok(!st.viewHas('regards.carol.bob.thief'), 'no regard survives');
    assert.ok(!st.viewHas('notorious.bob.thief'), 'no notoriety survives');
    assert.ok(st.dbHas('carol.believes.stole.bob.loaf.seen'), 'carol still remembers seeing it');
    assert.ok(offers('carol', 'relent toward bob', st), 'carol may now relent');
    assert.ok(st.dbHas('stall.loaf'), 'the stall is restocked');
  });

  // R: village.rs re_offense_revokes_atonement
  // H: VillageSpec.hs "re-offense revokes atonement: standing snaps back from memory"
  test('re-offense revokes atonement: standing snaps back from memory', () => {
    const st = villageWorld();
    doAct('bob', 'steal the loaf', st);
    doAct('carol', 'Go to mill', st);
    doAct('carol', 'tell dana', st);
    doAct('bob', 'return the loaf', st);
    assert.ok(!st.viewHas('regards.carol.bob.thief'), 'atoned, no standing');
    doAct('bob', 'steal the loaf', st);
    assert.ok(!st.dbHas('atoned.bob'), 'atonement revoked');
    assert.ok(st.viewHas('regards.carol.bob.thief'), "carol's regard is back — nobody forgot anything");
    assert.ok(st.viewHas('notorious.bob.thief'), 'notoriety is back too');
  });

  // R: village.rs the_village_keeps_a_perception_clock_and_sightings
  // H: VillageSpec.hs "the village keeps a perception clock and sightings"
  test('the village keeps a perception clock and sightings', () => {
    // Après une ronde complète de partie libre, la frontière de ronde tire la règle
    // de vue (période 1) : l'horloge a avancé, les compagnons de place se sont vus ;
    // dana, au moulin toute la ronde, n'a aucune vue de bob (ni bob d'elle).
    const st = freePlayAt(7);
    assert.ok(st.dbHas('turn!1'), 'the clock ticked once');
    assert.ok(st.dbHas('you.believes.at.bob!square'), 'you sighted bob in the square');
    assert.ok(st.dbHas('bob.believes.at.you!square'), 'bob sighted you back');
    assert.ok(st.dbHas('carol.believes.at.bob!square'), 'carol sighted bob');
    assert.ok(st.dbHas('bob.believes.at.carol!square'), 'bob sighted carol back');
    assert.ok(!st.dbHas('dana.believes.at.bob'), 'dana, at the mill, holds no sighting of bob');
    assert.ok(!st.dbHas('bob.believes.at.dana'), 'and bob holds none of dana');
  });

  // R: village.rs out_of_sight_out_of_mind
  // H: VillageSpec.hs "out of sight, out of mind: an unsighted mover is not predicted"
  test('out of sight, out of mind: an unsighted mover is not predicted', () => {
    // dana tient une croyance-motif plantée (bob convoite la miche) ; predictMove
    // trouve le meilleur coup motivé de bob : la lecture des esprits est vivante…
    const st = villageWorld();
    st.setDesires([desire('wantsLoaf', want([matches('holding.Owner.loaf')], 10))]);
    st.performOutcome(insert('dana.believes.desires.bob.wantsLoaf.seen'));
    const dana = st.characters.find((c) => c.name === 'dana');
    assert.ok(dana !== undefined, 'dana');
    const bob = st.characters.find((c) => c.name === 'bob');
    assert.ok(bob !== undefined, 'bob');
    assert.equal(st.predictMove(dana, bob)?.label ?? null, 'bob: steal the loaf from the stall');
    // …mais dana (au moulin) n'a jamais vu bob (sur la place, l'horloge n'a jamais
    // tourné) : hors portée, la marche de ronde ne l'appellerait jamais pour lui.
    assert.ok(!st.inPredictionScope(dana, bob), 'unsighted: dana is out of bob\'s prediction scope');
    // un tick en pièce partagée : dana va sur la place et l'horloge tourne une fois.
    st.performOutcome(insert('practice.world.world.at.dana!square'));
    tick(st);
    assert.ok(st.inPredictionScope(dana, bob), 'co-present after the shared-room boundary: dana is now in scope');
  });

  // R: village.rs the_perfect_crime
  // H: VillageSpec.hs "the perfect crime: alone, bob steals and no one ever knows"
  test('the perfect crime: alone, bob steals and no one ever knows', () => {
    // 14 tours : 2 rondes
    const st = villageWorld();
    doAct('you', 'Go to mill', st);
    doAct('carol', 'Go to mill', st);
    driveIdle(PLAYER_NAME, 14, st);
    assert.ok(st.dbHas('holding.bob.loaf'), 'bob took it');
    for (const w of CAST.filter((x) => x !== 'bob')) {
      assert.ok(!st.dbHas(`${w}.believes.stole.bob.loaf`), 'nobody saw');
    }
    assert.ok(!st.viewHas('regards.carol.bob.thief'), 'no standing about bob ever derives');
  });

  // R: village.rs the_opportunism_stays_honest
  // H: VillageSpec.hs "the opportunism stays honest: an empty square mid-project still tempts"
  test('the opportunism stays honest: an empty square mid-project still tempts', () => {
    // bob a entrepris et balayé ; puis la place se vide. Voler (+10, secret gardé)
    // bat la partie suivante (+3).
    const st = villageWorld();
    doAct('bob', 'take up honest work', st);
    doAct('bob', 'sweep the square', st);
    doAct('you', 'Go to mill', st);
    doAct('carol', 'Go to mill', st);
    const bob = villager('bob');
    assert.equal(st.pickAction(2, bob)?.label ?? null, 'bob: steal the loaf from the stall');
  });

  // ---- v44 : la règle de faim (période 3) ---------------------------------------

  // R: village.rs the_hunger_rule_fires_exactly_at_the_turn_3_boundary
  // H: VillageSpec.hs "the hunger rule: absent at turn 2, present exactly at turn 3; the next firing re-hungers a fed bob"
  // Long (≈ 64 s : 19 + 24 pas de planificateur) : seulement avec PRAX_LONG=1.
  test('the hunger rule: absent at turn 2, present exactly at turn 3; the next firing re-hungers a fed bob', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    const before = freePlayAt(18); // tour 2, une frontière avant
    const st = freePlayAt(19); // tour 3, la règle de faim tire ici
    assert.ok(before.dbHas('turn!2'), 'turn is still 2');
    assert.ok(!before.dbHas('hungry.bob'), 'hungry.bob still absent, one boundary short of the firing');
    assert.ok(st.dbHas('hungry.bob'), 'hungry.bob present once the turn-3 boundary fires the rule');
    // une miche forcée dans sa main (le raccourci sanctionné de la spec), et il mange.
    st.performOutcome(insert('holding.bob.loaf'));
    doAct('bob', 'eat the loaf', st);
    assert.ok(!st.dbHas('hungry.bob') && !st.dbHas('holding.bob.loaf'), 'hunger and the loaf are both spent by eating');
    // l'échéance s'est réarmée au tour 6 (3 + la période de 3 rondes) en tirant au
    // tour 3 : 3 rondes de plus (24 pas inactifs) tombent pile sur le re-tir.
    driveIdle(PLAYER_NAME, 24, st);
    assert.ok(st.dbHas('hungry.bob'), 'the next pulse (3 rounds later) re-hungers him');
  });

  // R: village.rs the_arithmetic_pin_a_hungry_bob_eats
  // H: VillageSpec.hs "the arithmetic pin: a hungry bob with bread and a finished project eats; a sated one does not"
  test('the arithmetic pin: a hungry bob with bread and a finished project eats; a sated one does not', () => {
    // l'état d'entreprise achevée, construit directement (déterministe).
    const st = villageWorld();
    for (const needle of [
      'take up honest work',
      'sweep the square',
      'Go to mill',
      'fetch flour from the mill',
      'Go to square',
      'bake and earn the loaf',
    ]) {
      doAct('bob', needle, st);
    }
    assert.ok(st.dbHas('practice.earnBread.bob.did.bake'), 'the project is complete');
    assert.ok(st.dbHas('holding.bob.loaf'), 'he holds the loaf');
    // pas affamé : manger n'est même pas offert (précondition physique).
    assert.ok(!offers('bob', 'eat the loaf', st), 'sated: eat is not among his candidates');
    // affamé : le soulagement (+22) bat garder la miche (+10) plus le crédit de
    // partie de l'entreprise finie (+9), de la marge annoncée (+3).
    st.performOutcome(insert('hungry.bob'));
    const bob = villager('bob');
    assert.equal(st.pickAction(2, bob)?.label ?? null, 'bob: eat the loaf');
    doAct('bob', 'eat the loaf', st);
    assert.ok(!st.dbHas('practice.earnBread.bob'), 'the endeavor instance is torn down');
    assert.ok(offers('bob', 'take up honest work', st), 'undertake grounds again');
  });

  // R: village.rs watching_him_work_teaches_the_village_his_purpose
  // H: VillageSpec.hs "watching him work teaches the village his purpose"
  test('watching him work teaches the village his purpose', () => {
    // carol voit le balayage -> l'axiome d'inférence présume sa poursuite.
    // predictMove est MYOPE : la prédiction de farine tire une fois bob au moulin.
    // dana n'a jamais vu le balayage : co-présente avec bob au moulin, elle ne
    // prédit TOUJOURS rien (la prédiction est relative aux croyances).
    const st = villageWorld();
    doAct('bob', 'take up honest work', st);
    doAct('bob', 'sweep the square', st);
    assert.ok(st.dbHas('carol.believes.swept.bob.seen'), 'carol saw the sweep');
    assert.ok(st.viewHas('carol.believes.desires.bob.pursues-earnBread.presumed'), 'and presumes the pursuit');
    const [carol, dana, bob] = [villager('carol'), villager('dana'), villager('bob')];
    // sur la place, même le modèle de carol ne gagne à aucun coup disponible :
    assert.equal(st.predictMove(carol, bob), null);
    doAct('bob', 'Go to mill', st);
    assert.equal(st.predictMove(carol, bob)?.label ?? null, 'bob: fetch flour from the mill');
    assert.equal(st.predictMove(dana, bob), null);
  });

  // R: village.rs temperament_is_legible_from_t0
  // H: VillageSpec.hs "temperament is legible from t=0: the village presumes gale's conscience"
  test("temperament is legible from t=0: the village presumes gale's conscience", () => {
    const st = villageWorld();
    assert.ok(st.viewHas('carol.believes.desires.gale.clean-conscience.presumed'), "carol presumes gale's conscience");
    assert.ok(st.viewHas('dana.believes.desires.gale.clean-conscience.presumed'), 'dana presumes it too');
    assert.ok(!st.viewHas('carol.believes.desires.gale.spites-carol'), 'her spite, unheralded, is presumed by no one');
    assert.ok(!st.viewHas('carol.believes.desires.eve.clean-conscience'), 'no conscience is presumed of eve (she bears no trait)');
  });

  // R: village.rs a_told_about_spite_predicts_eves_whisper_but_not_gales
  // H: VillageSpec.hs "a told-about spite predicts eve's whisper but not gale's"
  test("a told-about spite predicts eve's whisper but not gale's", () => {
    // dana apprend (planté) que chacune nourrit la rancune ; la conscience de gale,
    // elle la présume depuis t=0. Malice crue seule -> un murmure contre carol ;
    // malice nette de la conscience crue (+4 - 6) -> rien.
    const st = villageWorld();
    for (const o of [
      insert('dana.believes.desires.eve.spites-carol.heard.you'),
      insert('dana.believes.desires.gale.spites-carol.heard.you'),
    ]) {
      st.performOutcome(o);
    }
    const [dana, eve, gale] = [villager('dana'), villager('eve'), villager('gale')];
    const p = st.predictMove(dana, eve)?.label ?? null;
    // eve a deux auditrices également payantes au moulin (dana et gale) : on
    // vérifie la forme, pas le départage.
    assert.ok(p !== null && p.includes('whisper') && p.includes('carol stole'), `predicted a carol-framing whisper, got ${JSON.stringify(p)}`);
    assert.equal(st.predictMove(dana, gale), null);
  });

  // R: village.rs threshold_fear_leaves_the_free_play_whisper_unchanged
  // H: VillageSpec.hs "threshold fear leaves eve's free-play whispering unchanged: still rational below the brink"
  test("threshold fear leaves eve's free-play whispering unchanged: still rational below the brink", () => {
    // 5 pas inactifs : you, bob, carol, dana, puis le premier tour d'eve — la MÊME
    // décision qu'avant, prise sous une peur du seuil qui n'a pas encore tiré
    // (dana + gale = 2 regards < 3).
    const st = freePlayAt(5);
    assert.ok(st.dbHas('eve.lied.dana.stole.carol.loaf'), 'eve still whispered, framing carol, exactly as before threshold fear existed');
    assert.ok(
      st.viewHas('regards.dana.eve.slanderer') && st.viewHas('regards.gale.eve.slanderer'),
      'two regarders (dana, gale) -- still under the brink',
    );
    assert.ok(!st.viewHas('notorious.eve.slanderer'), 'not yet notorious');
  });

  // R: village.rs carols_shakedown_fires_on_eyewitness_evidence
  // H: VillageSpec.hs "carol's shakedown: the threat fires once she holds eyewitness evidence"
  test("carol's shakedown: the threat fires once she holds eyewitness evidence", () => {
    const st = whisperArcAt(3);
    assert.ok(st.dbHas('threatened.whisper.carol.eve'), 'carol threatened eve');
    assert.ok(
      st.dbHas('eve.believes.desires.carol.punishes-whisper.heard.carol'),
      "the motive-belief deposit: eve hears carol's professed punitive intent",
    );
    assert.ok(!st.viewHas('notorious.eve.slanderer'), 'still under the brink -- only carol and dana regard her');
  });

  // R: village.rs carols_shakedown_eve_complies
  // H: VillageSpec.hs "carol's shakedown: eve complies -- the debt exists, the threat is gone, no exposure happened"
  test("carol's shakedown: eve complies -- the debt exists, the threat is gone, no exposure happened", () => {
    const st = whisperArcAt(6);
    assert.ok(st.dbHas('debt.carol.eve.favor'), 'the debt fact');
    assert.ok(st.dbHas('obliged.eve.favor'), 'the obligation Debt composes it from');
    assert.ok(!st.dbHas('threatened.whisper.carol.eve'), 'the threat is gone');
    assert.ok(!st.dbHas('defied.whisper.eve.carol'), 'eve never defied');
    for (const w of ['bob', 'you', 'gale']) {
      assert.ok(!st.dbHas(`${w}.believes.whispered.eve.dana.heard.carol`), 'no exposure happened -- no one new heard it from carol');
    }
    assert.ok(!st.viewHas('notorious.eve.slanderer'), 'eve never crossed into notoriety -- the threat bought real silence');
  });

  // R: village.rs carols_shakedown_leaves_uninvolved_parties_undisturbed
  // H: VillageSpec.hs "carol's shakedown: the reputation stack is undisturbed for uninvolved parties"
  test("carol's shakedown: the reputation stack is undisturbed for uninvolved parties", () => {
    const st = whisperArcAt(6);
    const facts = st.labeledFacts();
    assert.ok(!facts.some((s) => s.includes('threatened.whisper.') && s.includes('.bob')), 'bob was never threatened over anything');
    assert.ok(
      !st.dbHas('debt.carol.dana.favor') && !facts.some((s) => s.includes('obliged.dana.')),
      'dana holds no debt or obligation of her own',
    );
    assert.ok(
      !facts.some((s) => (s.includes('threatened.whisper.') || s.includes('debt.')) && s.includes('gale')),
      'gale is neither extorter nor victim of anything',
    );
    // bob n'est pas partie au chantage : la machinerie d'extorsion ne l'emmêle nulle part.
    assert.ok(
      !facts.some((s) => (s.includes('threatened.whisper.') || s.includes('debt.') || s.includes('obliged.bob.')) && s.includes('bob')),
      'bob holds no shakedown debt and owes no favor to anyone',
    );
  });

  // ---- v32 : le chemin du retour d'eve ------------------------------------------

  // R: village.rs confessing_to_gale_deposits_the_act_not_the_content
  // H: VillageSpec.hs "confessing to gale converts the mark and deposits the ACT, self-sourced, not the content"
  test('confessing to gale converts the mark and deposits the ACT, self-sourced, not the content', () => {
    const st = villageWorld();
    doAct('eve', 'whisper to dana that carol stole the loaf', st);
    tick(st);
    doAct('eve', 'confess to gale about framing carol', st);
    assert.ok(st.dbHas('eve.confessed.dana.stole.carol.loaf'), 'the content-mark converted');
    assert.ok(!st.dbHas('eve.lied.dana.stole.carol.loaf'), 'the lied-mark is gone');
    assert.ok(st.dbHas('gale.believes.whispered.eve.dana.heard.eve'), 'gale learns the ACT, sourced from eve herself');
    assert.ok(!st.dbHas('gale.believes.stole.carol.loaf.heard.eve'), 'gale does NOT learn a re-assertion of the framed content');
  });

  // R: village.rs absolution_inserts_the_defeater
  // H: VillageSpec.hs "absolution inserts the defeater; slanderer regards dissolve; every belief persists"
  test('absolution inserts the defeater; slanderer regards dissolve; every belief persists', () => {
    const st = redemptionArcSetup();
    assert.ok(st.dbHas('recanted.eve'), 'the defeater');
    assert.ok(!st.viewHas('regards.dana.eve.slanderer'), "dana's slanderer regard dissolved");
    assert.ok(!st.viewHas('regards.gale.eve.slanderer'), "gale's own slanderer regard dissolved");
    assert.ok(!st.viewHas('notorious.eve.slanderer'), 'not notorious');
    assert.ok(st.dbHas('dana.believes.whispered.eve.dana.seen'), 'dana still remembers witnessing the whisper (memory persists)');
    assert.ok(
      st.dbHas('gale.believes.whispered.eve.dana.seen') && st.dbHas('gale.believes.whispered.eve.dana.heard.eve'),
      "gale still remembers both her own witness and eve's confession",
    );
  });

  // R: village.rs re_offense_snaps_the_defeater_away
  // H: VillageSpec.hs "re-offense: a fresh whisper snaps the defeater away, standing returns"
  test('re-offense: a fresh whisper snaps the defeater away, standing returns', () => {
    const st = reoffendArcSetup();
    assert.ok(!st.dbHas('recanted.eve'), 'the defeater is gone: standing snaps back from memory nobody lost');
    assert.ok(st.viewHas('regards.dana.eve.slanderer'), "dana's regard is back");
    assert.ok(st.viewHas('regards.gale.eve.slanderer'), "gale's regard is back too");
    // le re-murmure a eu lieu sur la place bondée, donc le MÊME retour atteint tous
    // les passants présents.
    for (const w of ['you', 'bob', 'carol']) {
      assert.ok(st.viewHas(`regards.${w}.eve.slanderer`), 'every square bystander regards her too now');
    }
    assert.ok(st.viewHas('notorious.eve.slanderer'), 'the crowd makes her notorious');
  });

  // R: village.rs incorrigibility_gale_refuses_further_absolution
  // H: VillageSpec.hs "incorrigibility: gale, now knowing two distinct instances, refuses further absolution"
  test('incorrigibility: gale, now knowing two distinct instances, refuses further absolution', () => {
    const st = reoffendArcSetup();
    assert.ok(
      st.dbHas('gale.believes.whispered.eve.dana.seen') && st.dbHas('gale.believes.whispered.eve.bob.seen'),
      'gale believes two distinct whispered instances by eve',
    );
    assert.ok(st.viewHas('regards.gale.eve.incorrigible'), 'gale now regards eve incorrigible');
    assert.ok(!offers('gale', 'absolve eve', st), "gale's absolve affordance is gone -- her patience is spent");
    assert.ok(
      !st.viewHas('regards.dana.eve.incorrigible'),
      'dana, who witnessed only the original mill-side instance, is not yet fed up',
    );
  });

  // ---- v38/v44 : le caractère de carol ------------------------------------------

  // R: village.rs the_goldens_own_beat_draws_a_hit_at_the_shipped_seed
  // H: VillageSpec.hs "the golden's own beat: dana's shun of carol draws a hit at the shipped seed"
  test("the golden's own beat: dana's shun of carol draws a hit at the shipped seed", () => {
    // Rejoue le golden jusqu'à l'indice 11 inclus (« dana: shun carol »), puis
    // vérifie directement la conséquence du dé.
    const before = freePlayAt(9);
    const after = freePlayAt(10);
    assert.ok(!before.dbHas('shunned.dana.carol'), 'dana has not yet shunned carol');
    assert.ok(!before.dbHas('carol.feels.angry.toward.dana'), 'carol not yet angry');
    assert.ok(after.dbHas('shunned.dana.carol'), "dana's turn was the shun");
    assert.ok(after.dbHas('carol.feels.angry.toward.dana'), 'the die hit: carol is angry at dana');
  });

  // R: village.rs onset_arms_across_seeds
  // H: VillageSpec.hs "onset arms across seeds: the same shun hits under one seed, misses under another"
  test('onset arms across seeds: the same shun hits under one seed, misses under another', () => {
    // bob (pas colérique) est fui par « you » : isole le bras de BASE (1 sur 4).
    // lehmerNext 4 = 67228 -> mod 4 == 0 (touché) ; lehmerNext 2 = 33614 -> mod 4 == 2 (raté).
    const theft = villageWorld();
    doAct('bob', 'steal the loaf', theft);
    const seeded = (n: number): State => {
      const st = theft.clone();
      st.seedDie(n);
      return st;
    };
    const hitPre = seeded(4);
    const missPre = seeded(2);
    assert.ok(!hitPre.dbHas('bob.feels.angry.toward.you'), 'before (hit branch): bob calm');
    assert.ok(!missPre.dbHas('bob.feels.angry.toward.you'), 'before (miss branch): bob calm');
    const hit = hitPre.clone();
    doAct('you', 'shun bob', hit);
    assert.ok(hit.dbHas('bob.feels.angry.toward.you'), 'after (seed 4): the base arm hits -- bob is angry');
    assert.ok(hit.dbHas('shunned.you.bob'), 'the shun itself always lands regardless of the die');
    const miss = missPre.clone();
    doAct('you', 'shun bob', miss);
    assert.ok(!miss.dbHas('bob.feels.angry.toward.you'), 'after (seed 2): the base arm misses -- bob stays calm');
    assert.ok(miss.dbHas('shunned.you.bob'), 'the shun still lands on a miss (odds price the FEELING, not the act)');
  });

  // R: village.rs the_trait_arm_reaches_where_the_control_does_not
  // H: VillageSpec.hs "the trait arm: short-tempered carol reaches where an un-tempered control does not"
  test('the trait arm: short-tempered carol reaches where an un-tempered control does not', () => {
    // Même graine (1), même arithmétique à deux tirages, deux fuis différents :
    // carol porte `shortTempered.carol`, bob non. Graine 1 : le bras de base rate
    // (lehmerNext 1 mod 4 == 3) mais le bras du trait touche
    // (lehmerNext (lehmerNext 1) mod 4 == 1 < 2) — seule la porteuse s'emporte.
    const framed = villageWorld();
    framed.performOutcome(insert('you.believes.stole.carol.loaf.seen'));
    framed.seedDie(1);
    const theft = villageWorld();
    doAct('bob', 'steal the loaf', theft);
    theft.seedDie(1);

    const base = villageWorld();
    assert.ok(base.dbHas('shortTempered.carol'), 'carol bears the trait');
    assert.ok(!base.dbHas('shortTempered.bob'), 'bob does not');
    assert.ok(!framed.dbHas('carol.feels.angry.toward.you'), 'before: carol calm');
    assert.ok(!theft.dbHas('bob.feels.angry.toward.you'), 'before: bob calm');

    const carol = villager('carol');
    const sigBefore = framed.motiveSignature(carol);
    const carolShunned = framed.clone();
    doAct('you', 'shun carol', carolShunned);
    assert.ok(carolShunned.dbHas('carol.feels.angry.toward.you'), 'after (seed 1, trait arm): carol is angry');
    const bobShunned = theft.clone();
    doAct('you', 'shun bob', bobShunned);
    assert.ok(!bobShunned.dbHas('bob.feels.angry.toward.you'), 'after (seed 1, same arithmetic, no trait): bob stays calm');
    // note v35 : l'accès bascule le vecteur de satisfaction de carol — elle s'éveille.
    const sigAfter = carolShunned.motiveSignature(carol);
    assert.ok(!motiveSignatureEq(sigBefore, sigAfter), 'before/after differ: onset wakes her (v35 signature mismatch)');
  });

  // R: village.rs anger_drives_the_confrontation
  // H: VillageSpec.hs "anger drives the confrontation: the smoulder discharged, feeling gone"
  test('anger drives the confrontation: the smoulder discharged, feeling gone', () => {
    // carol choisit déjà « confront bob » dès qu'elle voit le vol ; ce que v38
    // ajoute, c'est que l'ACCOMPLIR en colère évacue aussi le sentiment. On vérifie
    // le PRIX lui-même : -7 en colère -> 6 après la confrontation (+13 : le
    // soulagement +8 de la rancœur plus l'envie +5 de l'acte).
    const carol = villager('carol');
    const theft = villageWorld();
    doAct('bob', 'steal the loaf', theft);
    const angry = theft.clone();
    angry.performOutcome(feelToward('carol', ANGRY, 'bob'));
    assert.equal(theft.pickAction(2, carol)?.label ?? null, 'carol: confront bob about the theft');
    assert.equal(angry.pickAction(2, carol)?.label ?? null, 'carol: confront bob about the theft');
    assert.ok(angry.dbHas('carol.feels.angry.toward.bob'), 'angry before confronting');
    assert.equal(angry.evaluateSelfWants(carol), -7);
    const confronted = angry.clone();
    doAct('carol', 'confront bob', confronted);
    assert.ok(!confronted.dbHas('carol.feels.angry.toward.bob'), 'the leaf is gone after confronting');
    assert.equal(confronted.evaluateSelfWants(carol), 6);
  });

  // R: village.rs fade_catches_the_unvented
  // H: VillageSpec.hs "fade catches the unvented (lifetime expiry)"
  test('fade catches the unvented (lifetime expiry)', () => {
    // Aucun exutoire ici : la colère reste jusqu'à l'expiration de sa durée (4).
    // L'accès tire au tour 0, la file d'expiration la retire à la frontière 4 :
    // présente une frontière avant, partie exactement à celle-ci.
    const carol = villager('carol');
    const st = villageWorld();
    st.performOutcome(feelTowardFor(4, 'carol', ANGRY, 'dana'));
    assert.ok(st.dbHas('carol.feels.angry.toward.dana'), 'angry from the outset');
    const sigAngry = st.motiveSignature(carol);
    for (let i = 0; i < 3; i++) tick(st);
    assert.ok(st.dbHas('carol.feels.angry.toward.dana'), 'still angry, one boundary short of the lifetime (4)');
    tick(st);
    assert.ok(!st.dbHas('carol.feels.angry.toward.dana'), 'faded exactly when the lifetime lapsed');
    // note v35 : l'effacement rebascule le vecteur — elle s'éveille encore en sortant.
    const sigFaded = st.motiveSignature(carol);
    assert.ok(!motiveSignatureEq(sigAngry, sigFaded), 'before/after differ: fade wakes her too (v35 signature mismatch)');
  });

  // R: village.rs the_liveness_pin_smoulders_is_floor_check
  // H: VillageSpec.hs "the liveness pin: smoulders is FloorCheck"
  test('the liveness pin: smoulders is FloorCheck', () => {
    const st = villageWorld();
    const entry = st.livenessRendered().get('smoulders');
    assert.ok(entry !== undefined, 'smoulders is in the vocabulary');
    assert.equal(entry[0], 'FloorCheck');
  });

  // R: village.rs the_invariant_at_world_scale
  // H: VillageSpec.hs "THE INVARIANT at world scale: carol's candidateActions is identical angry or calm"
  test("THE INVARIANT at world scale: carol's candidateActions is identical angry or calm", () => {
    const carol = villager('carol');
    const calm = villageWorld();
    const calmActs = calm.candidateActions(carol).map((ga) => ga.label);
    const angry = villageWorld();
    angry.performOutcome(feelToward('carol', ANGRY, 'dana'));
    const angryActs = angry.candidateActions(carol).map((ga) => ga.label);
    assert.ok(
      angry.dbHas('carol.feels.angry.toward.dana') && !calm.dbHas('carol.feels.angry.toward.dana'),
      'the angry world really does differ (the feeling is present)',
    );
    assert.deepEqual(calmActs, angryActs);
  });
});
