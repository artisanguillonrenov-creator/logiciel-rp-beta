/**
 * Le monde de démonstration : déplacements, salutations et service au bar,
 * reliés au modèle de base (relations) et aux réactions & normes.
 *
 * Distribution : `you` (le joueur), `ada` (barmaid PNJ) et `bex` (client PNJ).
 * Saluer et servir réchauffent la relation ; une salutation fait naître une
 * réaction (rendre le salut, rebuffer, ou s'offusquer d'être ignoré) ; être
 * servi crée une OBLIGATION de régler (pourboire, ou ardoise impayée — une
 * violation de norme qui suscite la désapprobation et un devoir réparateur).
 * La règle de perception de période 1 entretient la connaissance de qui est
 * où, dont le planificateur a besoin pour prédire les autres.
 *
 * Deux mondes : le bar ordinaire et la variante « metteur en scène » (`dm`).
 *
 * Reprend `prax-worlds/src/bar.rs` (Prax, BSD-3-Clause). L'ordre de
 * construction fait partie du portage.
 */
import { State } from '../core/engine';
import { Condition, calc, cmp, count, eq, matches, neq, not_, or_, subquery } from '../core/query';
import { sightRule } from '../core/schedule';
import { sightedWithin } from '../core/sight';
import { Character, Practice, PraxFunction, ScheduleRule, action, boundTo, call, character, del, fn, insert, practice, scheduleRule, want, withWant } from '../core/types';
import { arcIs, enterArc } from '../vocab/arc';
import { beliefSentence, believe, forget } from '../vocab/beliefs';
import { beginConversation, changeSubject, endConversation, quip, talkPath } from '../vocab/conversation';
import { WARMTH, adjustScore, coreFns, scoreAtLeast } from '../vocab/coreModel';
import { breach, discharge, oblige, obligeReparative } from '../vocab/deontic';
import { ANNOYED, HAPPY, PLEASED, SAD, feelTowardFor, feelingToward } from '../vocab/emotion';
import { endReaction, reactionPath, spawnReaction, violationOf } from '../vocab/reactions';
import { CoPresence } from '../vocab/witness';

export const PLAYER_NAME = 'you';
export const DIRECTOR_NAME = 'director';
const BUY_THRESHOLD = 15;

/** Co-présence au bar : partager un lieu. */
export function together(): CoPresence {
  return [matches('practice.world.world.at.Actor!P'), matches('practice.world.world.at.Witness!P')];
}

function barSighting(): Condition[] {
  return [matches('practice.world.world.at.Seer!Spot'), matches('practice.world.world.at.Seen!Spot')];
}

function worldPractice(): Practice {
  return practice('world', {
    name: 'The world exists',
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

function greetPractice(): Practice {
  const strikeUp: Condition[] = [
    matches('practice.world.world.at.Actor!Place'),
    matches('practice.world.world.at.Other!Place'),
    neq('Actor', 'Other'),
    not_(beliefSentence('Actor', 'resentedBy.Other', 'yes')),
    not_(talkPath('Actor', 'Other')),
    not_(talkPath('Other', 'Actor')),
    not_('Actor.chattedWith.Other'),
    ...scoreAtLeast('Actor', 'Other', WARMTH, BUY_THRESHOLD),
  ];
  const buy: Condition[] = [
    matches('practice.world.world.at.Actor!Place'),
    matches('practice.world.world.at.Other!Place'),
    neq('Actor', 'Other'),
    not_('practice.greet.World.grievance.Actor.Other'),
    not_(beliefSentence('Actor', 'resentedBy.Other', 'yes')),
    not_('practice.greet.World.bought.Actor.Other'),
    ...scoreAtLeast('Actor', 'Other', WARMTH, BUY_THRESHOLD),
  ];
  return practice('greet', {
    name: 'People can greet one another',
    roles: ['World'],
    actions: [
      action(
        '[Actor]: Greet [Other]',
        [
          matches('practice.world.world.at.Actor!Place'),
          matches('practice.world.world.at.Other!Place'),
          neq('Actor', 'Other'),
          not_('practice.greet.World.greeted.Actor.Other'),
          not_(beliefSentence('Actor', 'resentedBy.Other', 'yes')),
          not_(reactionPath('respondGreet', ['Other', 'Actor'])),
        ],
        [
          insert('practice.greet.World.greeted.Actor.Other'),
          adjustScore('Actor', 'Other', WARMTH, 10, 'greeting'),
          feelTowardFor(4, 'Actor', PLEASED, 'Other'),
          spawnReaction('respondGreet', ['Actor', 'Other']),
        ],
      ),
      action(
        '[Actor]: Warn [Hearer] that [Subject] resents them',
        [
          matches('practice.world.world.at.Actor!Place'),
          matches('practice.world.world.at.Hearer!Place'),
          neq('Actor', 'Hearer'),
          feelingToward('Actor', ANNOYED, 'Subject'),
          neq('Actor', 'Subject'),
          neq('Hearer', 'Subject'),
          not_('practice.world.world.at.Subject!Place'),
          not_(beliefSentence('Hearer', 'resentedBy.Subject', 'yes')),
        ],
        [believe('Hearer', 'resentedBy.Subject', 'yes')],
      ),
      action(
        "[Actor]: Realize [Subject] doesn't resent you after all",
        [matches(beliefSentence('Actor', 'resentedBy.Subject', 'yes')), matches('practice.greet.world.greeted.Subject.Actor')],
        [forget('Actor', 'resentedBy.Subject'), feelTowardFor(4, 'Actor', PLEASED, 'Subject')],
      ),
      action('[Actor]: Strike up a conversation with [Other]', strikeUp, beginConversation('Actor', 'Other', 'smallTalk')),
      action('[Actor]: Buy [Other] a drink', buy, [
        insert('practice.greet.World.bought.Actor.Other'),
        adjustScore('Other', 'Actor', WARMTH, 15, 'boughtMeADrink'),
        adjustScore('Actor', 'Other', WARMTH, 5, 'feelingGenerous'),
        feelTowardFor(4, 'Actor', PLEASED, 'Other'),
        feelTowardFor(4, 'Other', PLEASED, 'Actor'),
      ]),
    ],
  });
}

function respondGreetPractice(): Practice {
  return practice('respondGreet', {
    name: "[Greeted] can respond to [Greeter]'s greeting",
    roles: ['Greeter', 'Greeted'],
    actions: [
      action(
        '[Actor]: Greet [Greeter] back',
        [eq('Actor', 'Greeted'), not_(beliefSentence('Greeted', 'resentedBy.Greeter', 'yes'))],
        [
          insert('practice.greet.world.greeted.Greeted.Greeter'),
          adjustScore('Greeted', 'Greeter', WARMTH, 10, 'greetedBack'),
          feelTowardFor(4, 'Greeted', PLEASED, 'Greeter'),
          endReaction('respondGreet', ['Greeter', 'Greeted']),
        ],
      ),
      action(
        '[Actor]: Rebuff [Greeter]',
        [eq('Actor', 'Greeted')],
        [
          feelTowardFor(4, 'Greeted', ANNOYED, 'Greeter'),
          adjustScore('Greeted', 'Greeter', WARMTH, -5, 'rebuffed'),
          feelTowardFor(4, 'Greeter', SAD, 'Greeted'),
          adjustScore('Greeter', 'Greeted', WARMTH, -10, 'rebuffedMe'),
          endReaction('respondGreet', ['Greeter', 'Greeted']),
        ],
      ),
      action(
        '[Actor]: Take offense that [Greeted] ignored your greeting',
        [eq('Actor', 'Greeter'), not_('practice.greet.world.greeted.Greeted.Greeter'), not_('practice.greet.world.grievance.Greeter.Greeted')],
        [
          insert('practice.greet.world.grievance.Greeter.Greeted'),
          feelTowardFor(4, 'Greeter', ANNOYED, 'Greeted'),
          adjustScore('Greeter', 'Greeted', WARMTH, -15, 'snubbedMe'),
          endReaction('respondGreet', ['Greeter', 'Greeted']),
        ],
      ),
    ],
  });
}

function patronPractice(): Practice {
  return practice('patron', { name: '[Patron] is a patron', roles: ['Patron'], init: [insert('practice.patron.Patron.drinks!0'), enterArc('Patron', 'hopeful')] });
}

function arcPractice(): Practice {
  return practice('arc', {
    name: "[Self]'s evening",
    roles: ['Self'],
    actions: [
      action(
        '[Actor]: settle in, feeling you belong here',
        [eq('Actor', 'Self'), arcIs('Actor', 'hopeful'), ...scoreAtLeast('Actor', 'Friend', WARMTH, 20)],
        [enterArc('Actor', 'belonging'), feelTowardFor(4, 'Actor', HAPPY, 'here')],
      ),
      action(
        '[Actor]: give up on the evening, resigning yourself to solitude',
        [eq('Actor', 'Self'), arcIs('Actor', 'hopeful')],
        [enterArc('Actor', 'lonely'), feelTowardFor(4, 'Actor', SAD, 'here')],
      ),
    ],
  });
}

function tendBarPractice(): Practice {
  return practice('tendBar', {
    name: '[Bartender] is tending bar at [Place]',
    roles: ['Place', 'Bartender'],
    dataFacts: ['beverageType.beer!alcoholic', 'beverageType.cider!alcoholic', 'beverageType.soda!nonalcoholic', 'beverageType.water!nonalcoholic'],
    actions: [
      action(
        '[Actor]: Order [Beverage]',
        [
          neq('Actor', 'Bartender'),
          matches('practice.world.world.at.Actor!Place'),
          not_('practice.tendBar.Place.Bartender.customer.Actor!order'),
          not_('practice.tendBar.Place.Bartender.customer.Actor!beverage'),
          matches('practiceData.tendBar.beverageType.Beverage'),
        ],
        [insert('practice.tendBar.Place.Bartender.customer.Actor!order!Beverage')],
      ),
      action(
        "[Actor]: Fulfill [Customer]'s order",
        [eq('Actor', 'Bartender'), matches('practice.tendBar.Place.Bartender.customer.Customer!order!Beverage'), matches('practice.world.world.at.Bartender!Place')],
        [
          del('practice.tendBar.Place.Bartender.customer.Customer!order'),
          insert('practice.tendBar.Place.Bartender.customer.Customer!beverage!Beverage'),
          adjustScore('Customer', 'Bartender', WARMTH, 8, 'servedMeWell'),
          feelTowardFor(4, 'Customer', PLEASED, 'Bartender'),
          spawnReaction('settleUp', ['Customer', 'Bartender']),
          oblige('Customer', 'Customer.tipped.Bartender'),
        ],
      ),
      action(
        '[Actor]: Drink the [Beverage]',
        [
          matches('practice.tendBar.Place.Bartender.customer.Actor!beverage!Beverage'),
          matches('practiceData.tendBar.beverageType.Beverage!Kind'),
          matches('practice.patron.Actor.drinks!N'),
        ],
        [del('practice.tendBar.Place.Bartender.customer.Actor!beverage'), call('recordDrink', ['Actor', 'Kind', 'N'])],
      ),
      action(
        '[Actor]: Ring the bell — busy bar!',
        [
          eq('Actor', 'Bartender'),
          subquery('Crowd', ['C'], [matches('practice.tendBar.Place.Bartender.customer.C')]),
          count('NumCust', 'Crowd'),
          cmp('gte', 'NumCust', '2'),
          not_('practice.tendBar.Place.Bartender.rang'),
        ],
        [insert('practice.tendBar.Place.Bartender.rang')],
      ),
    ],
  });
}

function barFns(): PraxFunction[] {
  return [
    ...coreFns(),
    fn('recordDrink', ['P', 'Kind', 'N'], [
      [
        [eq('Kind', 'alcoholic'), calc('M', 'add', 'N', '1')],
        [insert('practice.patron.P.drinks!M'), call('checkTipsy', ['P', 'M'])],
      ],
      [[], []],
    ]),
    fn('checkTipsy', ['P', 'M'], [[[cmp('gte', 'M', '2')], [insert('person.P.tipsy')]]]),
    fn('checkSober', ['P', 'M'], [[[cmp('lte', 'M', '1')], [del('person.P.tipsy')]]]),
  ];
}

function metabolism(): ScheduleRule {
  return scheduleRule('metabolism', 2, [
    [
      [matches('practice.patron.P.drinks!N'), cmp('gte', 'N', '1'), calc('M', 'sub', 'N', '1')],
      [insert('practice.patron.P.drinks!M'), call('checkSober', ['P', 'M'])],
    ],
  ]);
}

function disapprovalPractice(): Practice {
  return practice('disapproval', {
    name: '[Onlooker] saw [Offender] break a norm',
    roles: ['Offender', 'Onlooker'],
    actions: [
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
      action("[Actor]: Let [Offender]'s lapse slide", [eq('Actor', 'Onlooker')], [feelTowardFor(4, 'Onlooker', PLEASED, 'Offender'), endReaction('disapproval', ['Offender', 'Onlooker'])]),
    ],
  });
}

function settleUpPractice(): Practice {
  return practice('settleUp', {
    name: '[Patron] should settle up with [Bartender]',
    roles: ['Patron', 'Bartender'],
    actions: [
      action(
        '[Actor]: Tip [Bartender]',
        [eq('Actor', 'Patron')],
        [
          insert('Patron.tipped.Bartender'),
          discharge('Patron', 'Patron.tipped.Bartender'),
          adjustScore('Bartender', 'Patron', WARMTH, 8, 'aGoodTipper'),
          adjustScore('Patron', 'Bartender', WARMTH, 3, 'friendlyService'),
          feelTowardFor(4, 'Bartender', PLEASED, 'Patron'),
          endReaction('settleUp', ['Patron', 'Bartender']),
        ],
      ),
      action(
        "[Actor]: Leave [Bartender]'s tab unpaid",
        [eq('Actor', 'Patron')],
        [
          breach('Patron', 'stiffedTheBartender'),
          discharge('Patron', 'Patron.tipped.Bartender'),
          obligeReparative('Patron', 'make.amends.with.Bartender'),
          spawnReaction('disapproval', ['Patron', 'Bartender']),
          endReaction('settleUp', ['Patron', 'Bartender']),
        ],
      ),
    ],
  });
}

function conversePractice(): Practice {
  return practice('converse', {
    name: '[A] and [B] are chatting',
    roles: ['A', 'B'],
    actions: [
      quip('smalltalk', '[Actor]: Make small talk with [Partner]', 'smallTalk', [], [
        adjustScore('Actor', 'Partner', WARMTH, 2, 'pleasantChat'),
        adjustScore('Partner', 'Actor', WARMTH, 2, 'pleasantChat'),
      ]),
      quip('compliment', '[Actor]: Compliment [Partner]', 'rapport', [], [adjustScore('Partner', 'Actor', WARMTH, 8, 'kindWords'), feelTowardFor(4, 'Partner', PLEASED, 'Actor')]),
      quip(
        'gossip',
        '[Actor]: Confide to [Partner] that [Subject] resents them',
        'gossip',
        [feelingToward('Actor', ANNOYED, 'Subject'), neq('Actor', 'Subject'), neq('Partner', 'Subject')],
        [believe('Partner', 'resentedBy.Subject', 'yes')],
      ),
      changeSubject('[Actor]: Warm the talk toward rapport', 'rapport'),
      changeSubject('[Actor]: Lower your voice to gossip', 'gossip'),
      changeSubject('[Actor]: Keep it to small talk', 'smallTalk'),
      endConversation('[Actor]: Wrap up the chat with [Partner]'),
    ],
  });
}

function dmPractice(): Practice {
  const stir: Condition[] = [eq('Actor', 'Director'), not_('dm.stirred'), ...scoreAtLeast('X', 'Y', WARMTH, 20), neq('X', 'Y'), neq('X', 'Actor'), neq('Y', 'Actor')];
  return practice('dm', {
    name: 'the director shapes the evening',
    roles: ['Director'],
    actions: [
      action('[Actor]: turn [X] against [Y] to stir up the evening', stir, [
        insert('dm.stirred'),
        feelTowardFor(4, 'X', ANNOYED, 'Y'),
        adjustScore('X', 'Y', WARMTH, -30, 'aSuddenFallingOut'),
        insert('practice.greet.world.grievance.X.Y'),
      ]),
    ],
  });
}

function directPractice(): Practice {
  const pair = [eq('Actor', 'Director'), matches('practice.world.world.at.X!Px'), matches('practice.world.world.at.Y!Py'), neq('X', 'Y'), neq('X', 'Director'), neq('Y', 'Director')];
  return practice('direct', {
    name: 'you direct the evening',
    roles: ['Director'],
    actions: [
      action('[Actor]: stir up a rivalry between [X] and [Y]', [...pair, not_('direct.stirred.X.Y')], [
        insert('direct.stirred.X.Y'),
        feelTowardFor(4, 'X', ANNOYED, 'Y'),
        adjustScore('X', 'Y', WARMTH, -30, 'aFallingOut'),
        insert('practice.greet.world.grievance.X.Y'),
      ]),
      action('[Actor]: kindle warmth between [X] and [Y]', [...pair, not_('direct.kindled.X.Y')], [
        insert('direct.kindled.X.Y'),
        adjustScore('X', 'Y', WARMTH, 15, 'aWarmFeeling'),
        adjustScore('Y', 'X', WARMTH, 15, 'aWarmFeeling'),
        feelTowardFor(4, 'X', PLEASED, 'Y'),
        feelTowardFor(4, 'Y', PLEASED, 'X'),
      ]),
      action(
        "[Actor]: cast a pall over [X]'s evening",
        [eq('Actor', 'Director'), matches('practice.world.world.at.X!Px'), neq('X', 'Director'), not_('direct.unsettled.X')],
        [insert('direct.unsettled.X'), feelTowardFor(4, 'X', SAD, 'here')],
      ),
    ],
  });
}

const m = matches;
const grudging = (who: string) => want([m(`${who}.feels.annoyed.toward.T`), or_([[m(`practice.greet.world.greeted.${who}.T`)], [m(`${who}.chattedWith.T`)]])], -3);
const grudgingRound = (who: string) => want([m(`${who}.feels.annoyed.toward.T`), m(`practice.greet.world.bought.${who}.T`)], -8);

function you(): Character {
  return character(PLAYER_NAME);
}

function ada(): Character {
  return character('ada', {
    wants: [
      want([m('practice.tendBar.Place.ada.customer.Customer!order')], -5),
      want([m('practice.world.world.at.ada!bar')], 1),
      want([m('practice.greet.world.greeted.ada.Other')], 2),
      want([m('practice.greet.world.grievance.ada.Other')], 2),
      want([m('ada.disapprovedOf.Offender')], 3),
      grudging('ada'),
    ],
  });
}

function bex(): Character {
  return character('bex', {
    wants: [
      want([m('practice.tendBar.Place.ada.customer.bex!order!beer')], 4),
      want([m('practice.tendBar.Place.ada.customer.bex!beverage!beer')], 9),
      want([m('practice.world.world.at.bex!bar')], 1),
      want([m('practice.greet.world.greeted.bex.Other')], 2),
      want([m('practice.greet.world.grievance.bex.Other')], 2),
      want([m('practice.greet.world.bought.bex.Friend')], 6),
      want([m('bex.tipped.ada')], 3),
      want([violationOf('bex', 'stiffedTheBartender')], -40),
      want([arcIs('bex', 'belonging')], 25),
      want([arcIs('bex', 'lonely')], -25),
      want([arcIs('bex', 'belonging'), m('practice.world.world.at.bex!bar')], 3),
      want([arcIs('bex', 'lonely'), m('practice.world.world.at.bex!entrance')], 8),
      grudging('bex'),
      grudgingRound('bex'),
    ],
  });
}

function director(): Character {
  return boundTo(withWant(character('director'), want([m('dm.stirred')], 20)), 'dm');
}

function cai(): Character {
  return character('cai', {
    wants: [
      want([m('practice.tendBar.Place.ada.customer.cai!order!cider')], 4),
      want([m('practice.tendBar.Place.ada.customer.cai!beverage!cider')], 9),
      want([m('practice.world.world.at.cai!bar')], 1),
      want([m('practice.greet.world.greeted.cai.Other')], 2),
      want([m('practice.greet.world.bought.cai.Friend')], 6),
      want([arcIs('cai', 'belonging')], 25),
      want([arcIs('cai', 'lonely')], -25),
      grudging('cai'),
      grudgingRound('cai'),
    ],
  });
}

function directorPlayer(): Character {
  return boundTo(character(DIRECTOR_NAME), 'direct');
}

function barSorts(): Array<[string, string[]]> {
  return [
    ['beverage', ['beer', 'cider', 'soda', 'water']],
    ['beverageKind', ['alcoholic', 'nonalcoholic']],
    ['place', ['bar', 'entrance']],
  ];
}

function predictionScope(): Condition[] {
  return [or_([together(), sightedWithin(2)])];
}

export function barWorld(): State {
  const st = new State();
  st.definePractices([
    disapprovalPractice(),
    worldPractice(),
    greetPractice(),
    respondGreetPractice(),
    patronPractice(),
    tendBarPractice(),
    settleUpPractice(),
    conversePractice(),
    dmPractice(),
    arcPractice(),
  ]);
  st.defineFunctions(barFns());
  st.setCharacters([you(), ada(), bex(), director()]);
  st.setSorts(barSorts());
  st.setSchedule([sightRule(barSighting()), metabolism()]);
  for (const s of [
    'practice.world.world.connected.entrance.bar',
    'practice.world.world.connected.bar.entrance',
    'practice.world.world.at.you!entrance',
    'practice.world.world.at.bex!entrance',
    'practice.world.world.at.ada!bar',
    'practice.patron.you',
    'practice.patron.bex',
    'practice.greet.world',
    'practice.tendBar.bar.ada',
    'practice.dm.director',
    'practice.arc.you',
    'practice.arc.bex',
  ])
    st.performOutcome(insert(s));
  st.setPredictionScope(predictionScope());
  return st;
}

/** Le même bar, mais l'humain est le METTEUR EN SCÈNE (Versu §XI). */
export function barDirectorWorld(): State {
  const st = new State();
  st.definePractices([
    disapprovalPractice(),
    worldPractice(),
    greetPractice(),
    respondGreetPractice(),
    patronPractice(),
    tendBarPractice(),
    settleUpPractice(),
    conversePractice(),
    directPractice(),
    arcPractice(),
  ]);
  st.defineFunctions(barFns());
  st.setCharacters([ada(), bex(), cai(), directorPlayer()]);
  st.setSorts(barSorts());
  st.setSchedule([sightRule(barSighting())]);
  for (const s of [
    'practice.world.world.connected.entrance.bar',
    'practice.world.world.connected.bar.entrance',
    'practice.world.world.at.ada!bar',
    'practice.world.world.at.bex!bar',
    'practice.world.world.at.cai!bar',
    'practice.patron.bex',
    'practice.patron.cai',
    'practice.greet.world',
    'practice.tendBar.bar.ada',
    'practice.direct.director',
    'practice.arc.bex',
    'practice.arc.cai',
  ])
    st.performOutcome(insert(s));
  st.setPredictionScope(predictionScope());
  return st;
}
