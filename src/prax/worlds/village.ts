/**
 * Le village : le terrain d'épreuve du bac à sable. Bob vole une miche sur la
 * place ; ceux qui sont LÀ le croient et peuvent agir — les autres non. Les
 * nouvelles voyagent (rumeur), les preuves deviennent réputation, la notoriété
 * pousse le voleur à l'expiation, et rien n'est jamais oublié. Bob garde son
 * secret en planifiant ; la calomnie d'Eve se propage comme la vérité ; Gale,
 * honnête, ne ment jamais ; Carol fait chanter Eve ; l'aveu et l'absolution
 * existent ; et le travail honnête offre à Bob une autre voie que le vol.
 *
 * C'est le monde le plus dense en mécanismes : dé dramatique, rassemblement
 * (jour de marché), entreprise en parties, coercition, aveu/absolution,
 * fenêtre de perception.
 *
 * Reprend `prax-worlds/src/village.rs` (Prax, BSD-3-Clause). L'ordre de
 * construction fait partie du portage.
 */
import { State } from '../core/engine';
import { Condition, absent, cmp, exists, matches, neq, not_, or_ } from '../core/query';
import { draw } from '../core/rng';
import { gathering, sightRule } from '../core/schedule';
import { sightedWithin } from '../core/sight';
import { Action, Axiom, Character, Desire, Outcome, Practice, ScheduleRule, action, axiom, character, del, desire, holds, insert, practice, scheduleRule, want, withWant } from '../core/types';
import { shakedown } from '../vocab/blackmail';
import { absolve, confess, incorrigible } from '../vocab/confession';
import { adjustScore, coreFns } from '../vocab/coreModel';
import { owes } from '../vocab/debt';
import { conceal, lie } from '../vocab/deceit';
import { obligedClose } from '../vocab/deontic';
import { ANGRY, feelTowardFor, feelingToward, unfeelToward } from '../vocab/emotion';
import { Trait, cast, personaVocabulary, trait, transparent } from '../vocab/persona';
import { endeavor, part } from '../vocab/project';
import { notoriety, regardedAs, standingUnless } from '../vocab/repute';
import { gossip, heard } from '../vocab/rumor';
import { CoPresence, observable, saw, witnessed } from '../vocab/witness';

export const PLAYER_NAME = 'you';

export function together(): CoPresence {
  return [matches('practice.world.world.at.Actor!P'), matches('practice.world.world.at.Witness!P')];
}

function villageSighting(): Condition[] {
  return [matches('practice.world.world.at.Seer!Spot'), matches('practice.world.world.at.Seen!Spot')];
}

function worldPractice(): Practice {
  return practice('world', {
    name: 'The village exists',
    roles: ['World'],
    actions: [
      action(
        '[Actor]: Go to [Place]',
        [matches('practice.world.World.at.Actor!OtherPlace'), matches('practice.world.World.connected.OtherPlace.Place')],
        [insert('practice.world.World.at.Actor!Place')],
      ),
      action('[Actor]: Wait a moment', [matches('practice.world.World.at.Actor!Place')]),
    ],
  });
}

function earnBread(): [Action, Practice, Desire] {
  return endeavor('earnBread', 3, '[Actor]: take up honest work at the stall', [matches('practice.world.world.at.Actor!square')], [
    part('sweep', '[Actor]: sweep the square', [], [matches('practice.world.world.at.Actor!square')], [witnessed(together(), 'swept.Actor')]),
    part('fetch', '[Actor]: fetch flour from the mill', ['sweep'], [matches('practice.world.world.at.Actor!mill')], [insert('carrying.Actor.flour')]),
    part(
      'bake',
      '[Actor]: bake and earn the loaf',
      ['fetch'],
      [matches('practice.world.world.at.Actor!square'), matches('carrying.Actor.flour')],
      [del('carrying.Actor.flour'), insert('holding.Actor.loaf')],
    ),
  ]);
}

function hungerPulse(): ScheduleRule {
  return scheduleRule('hunger', 3, [[[matches('appetite.X'), not_('hungry.X')], [insert('hungry.X')]]]);
}

/** La graine du dé dramatique (clin d'œil à Park & Miller, 1988). */
const VILLAGE_SEED = 1988;

const suffersHunger = (): Desire => desire('suffers-hunger', want([matches('hungry.Owner')], -22));
const marketPractice = (): Practice => practice('market', { roles: ['Fair'] });
const marketGathering = (): ScheduleRule => gathering('market', 6, 1, [insert('practice.market.fair'), insert('marketDay.square')]);
const drawnToMarket = (): Desire => desire('drawn-to-market', want([matches('marketDay.square'), matches('practice.world.world.at.Owner!square')], 3));

function honest(): Trait {
  return trait('honest', [
    desire('clean-conscience', want([matches('Owner.lied.H.stole.C.loaf')], -6)),
    desire('conscience-remembers', want([matches('Owner.confessed.H.stole.C.loaf')], -6)),
  ]);
}

const smoulders = (): Desire => desire('smoulders', want([feelingToward('Owner', ANGRY, 'T')], -8));
const spitesCarol = (): Desire => desire('spites-carol', want([matches('regards.W.carol.thief')], 4));
const whisperShakedown = (): [Desire, Action[]] => shakedown('whisper', together(), 'whispered.V.H', 'favor', 6);

const distrustGate = (): Condition[] => [absent([matches('Actor.relationship.Hearer.trust.score!TrustScore'), cmp('lt', 'TrustScore', '0')])];

function whisperAct(): Action {
  const raw = lie(together(), distrustGate(), [matches('practice.world.world.at.Culprit!AnywhereQ')], 'stole.Culprit.loaf', '[Actor]: whisper to [Hearer] that [Culprit] stole the loaf');
  return observable(together(), 'whispered.Actor.Hearer', { ...raw, then: [...raw.then, del('recanted.Actor')] });
}

const confessWhisper = (): Action => confess('lied', 'confessed', together(), 'stole.C.loaf', 'whispered.Actor.H', '[Actor]: confess to [Hearer] about framing [C]');
const absolveWhisper = (): Action => absolve('recanted', 'whispered.V.H', 'incorrigible', '[Actor]: absolve [V] of slander');

function shunOutcomes(): Outcome[] {
  return [
    insert('shunned.Actor.T'),
    ...draw(1, 4, [], [feelTowardFor(4, 'T', ANGRY, 'Actor')]),
    ...draw(2, 4, [matches('shortTempered.T')], [feelTowardFor(4, 'T', ANGRY, 'Actor')]),
  ];
}

function villagePractice(): Practice {
  const [, acts] = whisperShakedown();
  if (acts.length !== 4) throw new Error('whisperShakedown : 4 actions attendues');
  const [threaten, comply, defy, expose] = acts;
  return practice('village', {
    name: 'Village life',
    roles: ['Scene'],
    actions: [
      observable(
        together(),
        'stole.Actor.loaf',
        action('[Actor]: steal the loaf from the stall', [matches('practice.world.world.at.Actor!square'), matches('stall.loaf')], [
          del('stall.loaf'),
          insert('holding.Actor.loaf'),
          del('atoned.Actor'),
        ]),
      ),
      action(
        '[Actor]: confront [Thief] about the theft',
        [saw('Actor', 'stole.Thief.loaf'), matches('practice.world.world.at.Actor!P'), matches('practice.world.world.at.Thief!P'), not_('confronted.Actor.Thief')],
        [insert('confronted.Actor.Thief'), adjustScore('Actor', 'Thief', 'trust', -10, 'sawTheft'), unfeelToward('Actor', ANGRY, 'Thief')],
      ),
      gossip(together(), distrustGate(), 'stole.Culprit.loaf', '[Actor]: tell [Hearer] that [Culprit] stole the loaf'),
      action(
        '[Actor]: eye [Thief] with suspicion',
        [
          matches('practice.world.world.at.Actor!P'),
          matches('practice.world.world.at.Thief!P'),
          neq('Thief', 'Actor'),
          heard('Actor', 'stole.Thief.loaf'),
          absent([matches('Actor.believes.stole.Thief.loaf.seen')]),
          not_('eyed.Actor.Thief'),
        ],
        [insert('eyed.Actor.Thief'), adjustScore('Actor', 'Thief', 'trust', -5, 'heardOfTheft')],
      ),
      action('[Actor]: shun [T]', [regardedAs('Actor', 'T', 'thief'), neq('T', 'Actor'), not_('shunned.Actor.T')], shunOutcomes()),
      action('[Actor]: return the loaf with apologies', [matches('holding.Actor.loaf'), exists([matches('regards.W.Actor.thief')])], [
        del('holding.Actor.loaf'),
        insert('stall.loaf'),
        insert('atoned.Actor'),
      ]),
      action('[Actor]: relent toward [T]', [matches('shunned.Actor.T'), absent([matches('regards.Actor.T.thief')])], [del('shunned.Actor.T')]),
      whisperAct(),
      confessWhisper(),
      absolveWhisper(),
      earnBread()[0],
      action('[Actor]: eat the loaf', [matches('hungry.Actor'), matches('holding.Actor.loaf')], [del('hungry.Actor'), del('holding.Actor.loaf'), del('practice.earnBread.Actor')]),
      threaten,
      comply,
      defy,
      expose,
    ],
  });
}

function villageAxioms(): Axiom[] {
  return [
    standingUnless('stole.Culprit.loaf', 'atoned.Culprit', 'thief'),
    notoriety('thief', 3),
    axiom([matches('Regarder.believes.swept.bob')], ['Regarder.believes.desires.bob.pursues-earnBread.presumed']),
    transparent(),
    standingUnless('whispered.V.H', 'recanted.V', 'slanderer'),
    notoriety('slanderer', 3),
    incorrigible('whispered.V.H', 2, 'incorrigible'),
  ];
}

function villageCast(): [Character[], Outcome[]] {
  let bob = character('bob');
  for (const w of [
    want([matches('holding.bob.loaf')], 10),
    want([matches('practice.world.world.at.bob!square')], 1),
    want([matches('notorious.bob.thief')], -15),
    conceal('stole.bob.loaf', 12),
  ])
    bob = withWant(bob, w);
  bob = holds(holds(holds(bob, 'pursues-earnBread'), 'suffers-hunger'), 'drawn-to-market');

  let carol = character('carol');
  for (const w of [
    want([matches('confronted.carol.T')], 5),
    want([matches('practice.world.world.at.carol!square')], 1),
    want([matches('carol.believes.stole.bob.loaf'), matches('Other.believes.stole.bob.loaf.heard.carol')], 5),
    want([matches('shunned.carol.T'), matches('regards.carol.T.thief')], 5),
    want([matches('shunned.carol.T'), absent([matches('regards.carol.T.thief')])], -5),
    want([owes('carol', 'eve', 'favor')], 4),
  ])
    carol = withWant(carol, w);
  carol = holds(holds(holds(carol, 'punishes-whisper'), 'drawn-to-market'), 'smoulders');

  let dana = character('dana');
  for (const w of [
    want([matches('confronted.dana.T')], 5),
    want([matches('eyed.dana.T')], 5),
    want([matches('shunned.dana.T'), matches('regards.dana.T.thief')], 5),
    want([matches('shunned.dana.T'), absent([matches('regards.dana.T.thief')])], -5),
    want([matches('practice.world.world.at.dana!mill')], 1),
  ])
    dana = withWant(dana, w);
  dana = holds(dana, 'drawn-to-market');

  const eve = holds(holds(withWant(character('eve'), want([matches('notorious.eve.slanderer')], -15)), 'spites-carol'), 'drawn-to-market');
  const gale = holds(holds(character('gale'), 'spites-carol'), 'drawn-to-market');

  return cast(
    [honest()],
    [
      [character('you'), []],
      [bob, []],
      [carol, []],
      [dana, []],
      [eve, []],
      [gale, [honest()]],
    ],
  );
}

function villageSetup(): Outcome[] {
  return [
    'practice.village.here',
    'practice.world.world.connected.square.mill',
    'practice.world.world.connected.mill.square',
    'practice.world.world.at.you!square',
    'practice.world.world.at.bob!square',
    'practice.world.world.at.carol!square',
    'practice.world.world.at.dana!mill',
    'practice.world.world.at.eve!mill',
    'practice.world.world.at.gale!mill',
    'stall.loaf',
    'appetite.bob',
    'shortTempered.carol',
  ].map(insert);
}

function predictionScope(): Condition[] {
  return [or_([together(), sightedWithin(2)])];
}

export function villageWorld(): State {
  const [, earnBreadPractice, earnBreadPursuit] = earnBread();
  const [roster, personaFacts] = villageCast();
  const st = new State();
  st.definePractices([worldPractice(), villagePractice(), earnBreadPractice, marketPractice()]);
  st.defineFunctions(coreFns());
  st.setCharacters(roster);
  st.setSchedule([sightRule(villageSighting()), hungerPulse(), marketGathering()]);
  for (const o of [...villageSetup(), ...personaFacts]) st.performOutcome(o);
  st.setAxioms(obligedClose(villageAxioms()));
  st.setDesires([earnBreadPursuit, spitesCarol(), whisperShakedown()[0], suffersHunger(), drawnToMarket(), smoulders(), ...personaVocabulary([honest()])]);
  st.seedDie(VILLAGE_SEED);
  st.setPredictionScope(predictionScope());
  return st;
}
