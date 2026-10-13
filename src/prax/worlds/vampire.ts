/**
 * Le village des vampires : une simulation sociale d'infection, sur le même
 * socle déplacement / perception que le village. Huit villageois, quelques
 * lieux reliés, une horloge jour/nuit ; la patiente zéro (mara) se transforme
 * à la première nuit, à l'abri des regards ; les vampires ont faim, se
 * déguisent avant de mordre en public, les morsures vues ou racontées font
 * naître le soupçon, et la transformation suit l'incubation. Deux fins : les
 * vampires l'emportent, ou le village.
 *
 * Monde propre à la réécriture Rust de Prax (sans équivalent Haskell).
 * Reprend `prax-worlds/src/vampire.rs` (Prax, BSD-3-Clause).
 */
import { State } from '../core/engine';
import { Condition, absent, calc, cmp, matches, neq, not_ } from '../core/query';
import { sightRule } from '../core/schedule';
import { Axiom, Character, Desire, Outcome, Practice, ScheduleRule, action, axiom, character, del, desire, holds, insert, insertFor, practice, scheduleRule, want, withWant } from '../core/types';
import { conceal } from '../vocab/deceit';
import { obligedClose } from '../vocab/deontic';
import { cast } from '../vocab/persona';
import { gossip } from '../vocab/rumor';
import { observable } from '../vocab/witness';

/** L'échelle de temps du monde, en tours (un tour ≈ 5 minutes). */
export interface TimeScale {
  readonly dayTurns: number;
  readonly nightTurns: number;
  readonly incubation: number;
  readonly cooldown: number;
}

/** L'échelle réelle : 16 h de jour / 8 h de nuit, minuteurs de 24 h (288 tours). */
export const REAL_SCALE: TimeScale = { dayTurns: 192, nightTurns: 96, incubation: 288, cooldown: 288 };
/** Une échelle compressée (mêmes rapports) pour les tests et les démonstrations rapides. */
export const TEST_SCALE: TimeScale = { dayTurns: 4, nightTurns: 2, incubation: 6, cooldown: 6 };

const cycle = (s: TimeScale): number => s.dayTurns + s.nightTurns;

function sighting(): Condition[] {
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

function biteWitnessing(): Condition[] {
  return [matches('practice.world.world.at.Actor!Spot'), matches('practice.world.world.at.Witness!Spot')];
}

function preyPractice(scale: TimeScale): Practice {
  return practice('prey', {
    name: 'Feeding',
    roles: ['Scene'],
    actions: [
      observable(
        biteWitnessing(),
        'bit.Appears.Prey',
        action(
          '[Actor]: feed on [Prey]',
          [
            matches('vampire.Actor'),
            matches('bloodHunger.Actor'),
            not_('fed.Actor'),
            matches('practice.world.world.at.Actor!Spot'),
            matches('practice.world.world.at.Prey!Spot'),
            neq('Actor', 'Prey'),
            not_('vampire.Prey'),
            not_('bittenOn.Prey'),
            matches('appears.Actor!Appears'),
            matches('turn!Now'),
          ],
          [insert('mark.Prey.neck'), insert('bittenOn.Prey!Now'), insertFor(scale.cooldown, 'fed.Actor'), del('bloodHunger.Actor')],
        ),
      ),
    ],
  });
}

function disguisePractice(): Practice {
  return practice('disguise', {
    name: 'Disguise',
    roles: ['Scene'],
    actions: [
      action('[Actor]: put on a disguise', [matches('appears.Actor!Actor')], [insert('appears.Actor!someone')]),
      action('[Actor]: drop the disguise', [matches('appears.Actor!someone')], [insert('appears.Actor!Actor')]),
    ],
  });
}

function talkPractice(): Practice {
  return practice('talk', { name: 'Talk', roles: ['Scene'], actions: [gossip(biteWitnessing(), [], 'bit.Subject.Victim', '[Actor]: spread word about [Subject]')] });
}

function transformation(scale: TimeScale): Axiom {
  return axiom([matches('bittenOn.V!T'), matches('turn!Now'), calc('E', 'sub', 'Now', 'T'), cmp('gte', 'E', String(scale.incubation)), not_('vampire.V')], ['vampire.V']);
}

function biteBreedsSuspicion(): Axiom {
  return axiom([matches('Believer.believes.bit.Biter.Victim')], ['Believer.believes.vampire.Biter']);
}

function vampiresWinRule(): ScheduleRule {
  return scheduleRule('vampiresWin', 1, [
    [[matches('everBitten'), not_('ending.vampires'), absent([matches('character.H'), not_('vampire.H'), not_('dead.H')])], [insert('ending.vampires')]],
  ]);
}

function villageWinsRule(): ScheduleRule {
  return scheduleRule('villageWins', 1, [[[matches('everBitten'), not_('ending.village'), absent([matches('vampire.V'), not_('dead.V')])], [insert('ending.village')]]]);
}

function phaseClock(scale: TimeScale): ScheduleRule {
  return scheduleRule('phase', 1, [
    [[matches('turn!Now'), calc('InCycle', 'mod', 'Now', String(cycle(scale))), cmp('lt', 'InCycle', String(scale.dayTurns))], [insert('phase!day')]],
    [[matches('turn!Now'), calc('InCycle', 'mod', 'Now', String(cycle(scale))), cmp('gte', 'InCycle', String(scale.dayTurns))], [insert('phase!night')]],
  ]);
}

function turnPatientZero(): ScheduleRule {
  return scheduleRule('turnPatientZero', 1, [
    [
      [
        matches('phase!night'),
        not_('everBitten'),
        not_('vampire.mara'),
        matches('practice.world.world.at.mara!Spot'),
        absent([matches('practice.world.world.at.Other!Spot'), matches('home.Other!OtherHome'), neq('OtherHome', 'Spot')]),
      ],
      [insert('vampire.mara'), insert('mark.mara.neck'), insert('everBitten')],
    ],
  ]);
}

function hungerPulse(): ScheduleRule {
  return scheduleRule('hunger', 1, [[[matches('vampire.X'), not_('fed.X'), not_('bloodHunger.X')], [insert('bloodHunger.X')]]]);
}

const sateHunger = (): Desire => desire('sate-hunger', want([matches('bloodHunger.Owner')], -22));

const CONCEAL_WEIGHT = 12;
const NIGHT_HOME_WEIGHT = 3;
const DAY_SQUARE_WEIGHT = 1;
const VAMPIRE_SEED = 1897;

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

/** Le villageois que l'on incarne : un humain ordinaire (pas mara). */
export const PLAYER_NAME = 'bram';

function vampireCast(): [Character[], Outcome[]] {
  const roster = HOMES.map(([who, home]) => {
    let c = holds(character(who), 'sate-hunger');
    c = withWant(c, want([matches('phase!night'), matches(`practice.world.world.at.${who}!${home}`)], NIGHT_HOME_WEIGHT));
    c = withWant(c, want([matches('phase!day'), matches(`practice.world.world.at.${who}!square`)], DAY_SQUARE_WEIGHT));
    c = withWant(c, conceal(`vampire.${who}`, CONCEAL_WEIGHT));
    return [c, []] as const;
  });
  return cast([], roster);
}

function vampireSetup(): Outcome[] {
  return [
    insert('practice.world.world.connected.square.church'),
    insert('practice.world.world.connected.church.square'),
    insert('practice.world.world.connected.square.mill'),
    insert('practice.world.world.connected.mill.square'),
    insert('practice.world.world.connected.square.home'),
    insert('practice.world.world.connected.home.square'),
    insert('phase!day'),
    insert('practice.prey.here'),
    insert('practice.disguise.here'),
    insert('practice.talk.here'),
    ...HOMES.map(([who, home]) => insert(`practice.world.world.at.${who}!${home}`)),
    ...HOMES.map(([who, home]) => insert(`home.${who}!${home}`)),
    ...HOMES.map(([who]) => insert(`appears.${who}!${who}`)),
  ];
}

/** Le village des vampires à l'échelle donnée (réelle par défaut). */
export function vampireWorld(scale: TimeScale = REAL_SCALE): State {
  const [roster, personaFacts] = vampireCast();
  const st = new State();
  st.definePractices([worldPractice(), preyPractice(scale), disguisePractice(), talkPractice()]);
  st.setCharacters(roster);
  st.setSchedule([sightRule(sighting()), phaseClock(scale), turnPatientZero(), hungerPulse(), vampiresWinRule(), villageWinsRule()]);
  for (const o of [...vampireSetup(), ...personaFacts]) st.performOutcome(o);
  st.setAxioms(obligedClose([transformation(scale), biteBreedsSuspicion()]));
  st.setDesires([sateHunger()]);
  st.seedDie(VAMPIRE_SEED);
  st.setPredictionScope(sighting());
  return st;
}
