/**
 * Portage du `VillageSpec` de Prax (Rust, BSD-3-Clause) — les cas LENTS :
 * ceux qui lisent les longues trajectoires libres de
 * `prax/rust/conformance/src/village.rs` (spec Haskell gelée :
 * `prax/test/Prax/VillageSpec.hs`). Les autres cas sont dans
 * `praxVillage.test.ts`. Même scénario, mêmes assertions.
 *
 * Ne tournent qu'à la demande : `PRAX_LONG=1` (plusieurs minutes — le
 * planificateur TS est ~2,7 fois plus lent que le Rust sur le village).
 *
 * LES TRAJECTOIRES SONT PARTAGÉES, comme dans l'original : la partie libre
 * (joueur inactif, ~100 pas) et la partie après le vol (~105 pas) sont pilotées
 * UNE fois chacune, paresseusement, et chaque test relit un instantané de
 * l'unique trace au lieu de re-simuler en privé. Le planificateur est
 * déterministe : c'est une identité, pas une approximation.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { State } from '../src/prax/core/engine';
import { advance, npcAct } from '../src/prax/core/turn';
import { witnessed } from '../src/prax/vocab/witness';
import { PLAYER_NAME, together, villageWorld } from '../src/prax/worlds/village';

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

/** Les pas où la trajectoire après le vol est échantillonnée. */
const POST_THEFT_STEPS = [42, 49, 96, 105] as const;

const POST_THEFT = new Trajectory(
  'the post-theft trace',
  () => {
    const st = villageWorld();
    doAct('bob', 'steal the loaf', st);
    return st;
  },
  POST_THEFT_STEPS,
);
const postTheftAt = (n: number): State => POST_THEFT.stateAt(n);

// R: village.rs tests
// H: VillageSpec.hs "Prax.Worlds.Village"
describe('Prax.Worlds.Village (long trajectories)', () => {
  // R: village.rs the_rumor_spreads_on_its_own
  // H: VillageSpec.hs "the rumor spreads on its own: carol carries the news to the mill"
  test('the rumor spreads on its own: carol carries the news to the mill', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    // 42 tours : 6 rondes complètes
    const st = postTheftAt(42);
    assert.ok(st.dbHas('dana.believes.stole.bob.loaf.heard.carol'), 'dana heard it from carol');
  });

  // R: village.rs the_arc_completes_on_its_own
  // H: VillageSpec.hs "the arc completes on its own: dana eventually eyes bob"
  test('the arc completes on its own: dana eventually eyes bob', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    // 49 tours : 7 rondes
    const st = postTheftAt(49);
    assert.ok(st.dbHas('eyed.dana.bob'), 'dana acted on the hearsay');
  });

  // R: village.rs the_whole_arc_runs_itself
  // H: VillageSpec.hs "the whole arc runs itself: notoriety tips bob; forgiveness follows"
  test('the whole arc runs itself: notoriety tips bob; forgiveness follows', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    // pas 96 : un bob affamé mange la miche volée au lieu de la rendre, donc
    // l'expiation attend une seconde miche, honnêtement GAGNÉE — atteinte au pas 96
    // dans la ronde v44 de 6 tours (observé sur la trace vivante après le vol).
    const st = postTheftAt(96);
    assert.ok(st.dbHas('atoned.bob'), 'bob atoned on his own');
    assert.ok(!st.viewHas('regards.carol.bob.thief'), 'no regard survives');
    for (const w of ['you', 'carol', 'dana']) {
      assert.ok(!st.dbHas(`shunned.${w}.bob`), 'every shun relented');
    }
    assert.ok(st.dbHas('carol.believes.stole.bob.loaf.seen'), 'memory persists throughout');
  });

  // R: village.rs an_atoned_thief_is_deterred
  // H: VillageSpec.hs "an atoned thief is deterred: the planner sees the snap-back"
  test('an atoned thief is deterred: the planner sees the snap-back', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    // tout l'arc, puis on continue : l'étal est réapprovisionné, l'envie de miche de
    // bob revit, mais voler restaurerait sa notoriété (-15 > +10) — il ne la prend
    // jamais. 105 tours : 15 rondes.
    const st = postTheftAt(105);
    assert.ok(st.dbHas('atoned.bob'), 'his atonement stands');
    assert.ok(st.dbHas('stall.loaf'), "the stall's loaf is untouched");
    // « bob ne tient aucune miche » était un indice de « il ne revole jamais » ; la
    // rédemption v24 le falsifie (bob GAGNE une miche) tout en renforçant la propriété.
    assert.ok(st.dbHas('practice.earnBread.bob.did.bake'), 'the loaf he holds is the one he earned');
    // le contrôle le plus net : un re-vol à N'IMPORTE QUEL moment aurait révoqué
    // l'expiation et ravivé sa notoriété.
    assert.ok(!st.viewHas('notorious.bob.thief'), 'his notoriety never returned');
  });

  // R: village.rs a_secret_keeps
  // H: VillageSpec.hs "a secret keeps: bob will not steal while the square watches"
  test('a secret keeps: bob will not steal while the square watches', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    // 28 tours : 4 rondes
    const st = freePlayAt(28);
    assert.ok(st.dbHas('stall.loaf'), 'the loaf is still on the stall');
    for (const w of CAST.filter((x) => x !== 'bob')) {
      assert.ok(!st.dbHas(`${w}.believes.stole.bob.loaf`), 'no one believes any theft by bob');
    }
  });

  // R: village.rs the_frame_up
  // H: VillageSpec.hs "the frame-up: eve's whisper becomes reputation and shunning"
  test("the frame-up: eve's whisper becomes reputation and shunning", { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    const st = freePlayAt(40);
    assert.ok(st.dbHas('dana.believes.stole.carol.loaf.heard.eve'), 'dana heard the lie from eve');
    assert.ok(st.viewHas('regards.dana.carol.thief'), 'the falsehood settled into standing');
    assert.ok(st.dbHas('shunned.dana.carol'), 'carol ends up wrongly shunned');
  });

  // R: village.rs the_framed_have_no_amends
  // H: VillageSpec.hs "the framed have no amends: carol is offered no return"
  test('the framed have no amends: carol is offered no return', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    const st = freePlayAt(40);
    assert.ok(st.viewHas('regards.dana.carol.thief'), 'carol was framed');
    assert.ok(!offers('carol', 'return the loaf', st), "carol cannot 'return' a loaf she never took");
  });

  // R: village.rs deterrence_plus_opportunity_yields_industry
  // H: VillageSpec.hs "deterrence plus opportunity yields industry: watched bob earns his loaf"
  test('deterrence plus opportunity yields industry: watched bob earns his loaf', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    // pas 34 : bob a achevé l'entreprise et tient la miche cuite (faite au pas 32,
    // gardée jusqu'au marché). Le marché (période 6) n'y change rien : sa première
    // ouverture (pas 37) tombe après la fin de sa course.
    const st = freePlayAt(34);
    assert.ok(st.dbHas('practice.earnBread.bob'), 'bob undertook the endeavor');
    assert.ok(st.dbHas('practice.earnBread.bob.did.bake'), 'and finished it');
    assert.ok(st.dbHas('holding.bob.loaf'), 'he holds a loaf');
    assert.ok(st.dbHas('stall.loaf'), "the stall's loaf untouched");
    for (const w of CAST.filter((x) => x !== 'bob')) {
      assert.ok(!st.dbHas(`${w}.believes.stole.bob.loaf`), 'no one believes any theft by bob');
    }
  });

  // R: village.rs no_appetite_no_hunger
  // H: VillageSpec.hs "no appetite, no hunger: gale and carol never seed hungry, however long free play runs"
  test('no appetite, no hunger: gale and carol never seed hungry, however long free play runs', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    const st = freePlayAt(56);
    assert.ok(!st.dbHas('hungry.carol'), 'carol never hungers');
    assert.ok(!st.dbHas('hungry.gale'), 'gale never hungers');
  });

  // ---- v37/v44 : le jour de marché ----------------------------------------------

  // R: village.rs convergence_on_the_square_while_the_market_holds
  // H: VillageSpec.hs "convergence: attendees with no stronger stake converge on the square while the market holds"
  test('convergence: attendees with no stronger stake converge on the square while the market holds', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    // avant le marché (pas 36, calme) : dana et gale sont au moulin.
    const quiet = freePlayAt(36);
    assert.ok(quiet.dbHas('practice.world.world.at.dana!mill'), 'dana still at the mill, market not yet open');
    assert.ok(quiet.dbHas('practice.world.world.at.gale!mill'), 'gale still at the mill, market not yet open');
    assert.ok(!quiet.dbHas('marketDay.square'), 'market genuinely not yet open');
    // ronde de marché (tour 6, pas 37-42 tous joués) : toutes deux sont sur la place.
    const market = freePlayAt(42);
    assert.ok(market.dbHas('marketDay.square'), 'the market is open');
    assert.ok(market.dbHas('practice.world.world.at.dana!square'), 'dana converged on the square');
    assert.ok(market.dbHas('practice.world.world.at.gale!square'), 'gale converged on the square');
    // la différence qu'a faite le marché, énoncée directement.
    assert.ok(
      !quiet.dbHas('practice.world.world.at.dana!square') && market.dbHas('practice.world.world.at.dana!square'),
      "dana's convergence is the market's doing (she was not there before)",
    );
    assert.ok(
      !quiet.dbHas('practice.world.world.at.gale!square') && market.dbHas('practice.world.world.at.gale!square'),
      "gale's convergence is the market's doing (she was not there before)",
    );
  });

  // R: village.rs dispersal_once_the_market_closes
  // H: VillageSpec.hs "dispersal: a villager with no stronger stake leaves once the market closes; the cycle recurs"
  test('dispersal: a villager with no stronger stake leaves once the market closes; the cycle recurs', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    // pas 43 (frontière du tour 7) : la fermeture vient de tirer — toutes deux sont
    // encore sur la place (fermer retire le fait marketDay, pas les positions ; se
    // disperser est une DÉCISION prise au tour suivant de chacune).
    const closed = freePlayAt(43);
    assert.ok(!closed.dbHas('marketDay.square'), 'the market is now closed');
    assert.ok(closed.dbHas('practice.world.world.at.dana!square'), 'dana has not yet moved (closing is not teleportation)');
    assert.ok(closed.dbHas('practice.world.world.at.gale!square'), 'gale has not yet moved either');
    // le tour suivant de gale (pas 48) : aucun enjeu plus fort ne la retient sur la
    // place, elle repart droit au moulin.
    const dispersed = freePlayAt(48);
    assert.ok(dispersed.dbHas('practice.world.world.at.gale!mill'), "gale disperses: back to the mill once the market's pull is gone");
    // le marché revient (période 6) : la frontière du tour 12 (pas 73) le rouvre, et
    // au pas 78 gale a convergé une seconde fois — le cycle est bien périodique.
    const reopened = dispersed.clone();
    driveIdle(PLAYER_NAME, 78 - 48, reopened);
    assert.ok(reopened.dbHas('marketDay.square'), 'the market has reopened');
    assert.ok(reopened.dbHas('practice.world.world.at.gale!square'), 'gale converges again on the second opening');
  });

  // R: village.rs percolation_at_market_reaches_more_believers
  // H: VillageSpec.hs "percolation: a fact witnessed at market reaches more believers than the same fact witnessed on a quiet day"
  test('percolation: a fact witnessed at market reaches more believers than the same fact witnessed on a quiet day', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    // un fait-témoin neutre — rien dans le vocabulaire ne lit « spat.gale.carol » ;
    // il ne sert qu'à mesurer jusqu'où la co-présence porte un événement vu.
    // Fonder Actor=gale rend témoins « ceux qui partagent le lieu de gale ».
    const spat = witnessed(together(), 'spat.gale.carol');
    const believers = (st: State): string[] => CAST.filter((w) => st.dbHas(`${w}.believes.spat.gale.carol.seen`));
    // jour calme (pas 36, le dernier moment calme avant la première ouverture au
    // pas 37) : gale est au moulin avec dana seule.
    const quiet = freePlayAt(36);
    quiet.performOutcomeGrounded(spat, [['Actor', 'gale']]);
    const quietWitnesses = believers(quiet);
    // jour de marché (pas 42, la première ronde ouverte) : gale est sur la place avec
    // you, bob, carol et dana réunis autour d'elle.
    const market = freePlayAt(42);
    market.performOutcomeGrounded(spat, [['Actor', 'gale']]);
    const marketWitnesses = believers(market);
    assert.deepEqual(quietWitnesses, ['dana']);
    assert.deepEqual(marketWitnesses, ['you', 'bob', 'carol', 'dana']);
    assert.equal(quietWitnesses.length, 1);
    assert.equal(marketWitnesses.length, 4);
    assert.ok(marketWitnesses.length > quietWitnesses.length, 'the market convening carries the same fact to more believers');
  });

  // R: village.rs same_spite_different_temperaments
  // H: VillageSpec.hs "same spite, different temperaments: eve whispers, gale never does"
  test('same spite, different temperaments: eve whispers, gale never does', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    // pas 56 (v44 : la ronde de 6 tours, sans tickers). Le marché ouvre dans cette
    // fenêtre mais n'offre jamais à eve et gale un moment seules avant : eve murmure
    // exactement une fois, gale jamais.
    const st = freePlayAt(56);
    assert.ok(st.dbHas('dana.believes.stole.carol.loaf.heard.eve'), "eve's frame-up went ahead");
    assert.ok(st.dbHas('eve.lied.dana.stole.carol.loaf'), 'and eve carries the mark of it');
    assert.ok(!st.dbHas('gale.lied'), 'gale, bearing the same spite, never lied (her psyche is unmarked)');
    // la peur du seuil (v30) : une fois que carol et dana la tiennent pour
    // calomniatrice, un nouveau murmure ferait le troisième regard et la notoriété —
    // eve, prudente, ne risque jamais un second coup monté. Le fait le plus net pour
    // « exactement une fois » : son propre compte de marques.
    const marks = st.labeledFacts().filter((s) => s.startsWith('eve.lied.'));
    assert.deepEqual(marks, ['eve.lied.dana.stole.carol.loaf'], 'exactly one whisper, ever -- the brink made her prudent');
    // Le mécanisme v25 (une croyante honnête blanchit un mensonge dont elle a été
    // honnêtement dupe) tient toujours — il faut juste un coup de main : on force le
    // murmure que sa prudence décline, après quelques tours pour une co-présence.
    driveIdle(PLAYER_NAME, 3, st);
    doAct('eve', 'whisper to gale that carol stole the loaf', st);
    driveIdle(PLAYER_NAME, 20, st);
    const heardFromGale: Array<[string, string]> = CAST.flatMap((w) => CAST.map((c): [string, string] => [w, c])).filter(([w, c]) =>
      st.dbHas(`${w}.believes.stole.${c}.loaf.heard.gale`),
    );
    assert.ok(heardFromGale.length > 0, 'the lie traveled through the honest villager');
    for (const [, c] of heardFromGale) {
      assert.ok(st.dbHas(`gale.believes.stole.${c}.loaf`), 'whatever gale passed on, she honestly believes');
    }
  });

  // R: village.rs free_play_preservation_eve_never_confesses_unprompted
  // H: VillageSpec.hs "free-play preservation: eve does not confess or get absolved unprompted"
  test('free-play preservation: eve does not confess or get absolved unprompted', { skip: process.env.PRAX_LONG === '1' ? false : 'long : PRAX_LONG=1' }, () => {
    // son secret coûte cher à dépenser : aucun motif ne lui fait échanger le risque
    // de notoriété. L'affordance existe dès t=0 ; la partie libre ne la prend jamais.
    const st = freePlayAt(100);
    assert.ok(st.dbHas('eve.lied.dana.stole.carol.loaf'), 'her lied-mark survives, unconfessed, through extended free play');
    assert.ok(!st.dbHas('eve.confessed.dana.stole.carol.loaf'), 'no confession, ever');
    assert.ok(!st.dbHas('recanted.eve'), 'no absolution, ever');
  });
});
