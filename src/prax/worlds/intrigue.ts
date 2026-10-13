/**
 * Une tranche dramatique — un « mini Blood & Laurels » : un meurtre, un
 * personnage qui peut mourir (et quitter la distribution), trahison contre
 * loyauté contre complicité, une romance légère, et plusieurs FINS.
 *
 * Rome. `cassia` veut empoisonner le protecteur `artus` ; elle confie le
 * complot à `marcus` (le joueur). Marcus peut prévenir Artus (loyauté), faire
 * le coup lui-même (complicité), ou se laisser séduire.
 *
 * Reprend `prax-worlds/src/intrigue.rs` (Prax, BSD-3-Clause).
 */
import { State } from '../core/engine';
import { absent, eq, matches, neq, not_ } from '../core/query';
import { Practice, action, character, deadSentence, desire, holds, insert, practice, want } from '../core/types';
import { believe, believesThat } from '../vocab/beliefs';
import { WARMTH, adjustScore, coreFns, setBond } from '../vocab/coreModel';
import { PLEASED, feelToward } from '../vocab/emotion';

export const PLAYER_NAME = 'marcus';
const KILL_ARTUS = 'kill-artus';

function presencePractice(): Practice {
  return practice('presence', { name: 'the company at [Place]', roles: ['Place'], actions: [action('[Actor]: bide your time', [matches('character.Actor')])] });
}

function plotPractice(): Practice {
  const live = [not_('practice.plot.Schemer.Target.foiled'), not_('dead.Target'), absent([matches('ending.E')])];
  const knows = [believesThat('Actor', 'plotAgainst.Target', 'yes'), neq('Actor', 'Schemer'), neq('Actor', 'Target')];
  return practice('plot', {
    name: '[Schemer] conspires against [Target]',
    roles: ['Schemer', 'Target'],
    actions: [
      action(
        '[Actor]: confide the plot against [Target] to [Ally]',
        [eq('Actor', 'Schemer'), matches('character.Ally'), neq('Ally', 'Schemer'), neq('Ally', 'Target'), not_('practice.plot.Schemer.Target.confided.Ally')],
        [
          insert('practice.plot.Schemer.Target.confided.Ally'),
          believe('Ally', 'plotAgainst.Target', 'yes'),
          insert(`Ally.believes.desires.Schemer.${KILL_ARTUS}.heard.Schemer`),
          adjustScore('Ally', 'Schemer', WARMTH, 5, 'sharedASecret'),
        ],
      ),
      action(
        "[Actor]: slip poison into [Target]'s cup",
        [eq('Actor', 'Schemer'), matches('practice.plot.Schemer.Target.confided.Accomplice'), ...live],
        [insert('dead.Target'), insert('ending!betrayal')],
      ),
      action(
        '[Actor]: warn [Target] that [Schemer] means to kill them',
        [...knows, ...live],
        [insert('practice.plot.Schemer.Target.foiled'), adjustScore('Target', 'Actor', WARMTH, 30, 'savedMyLife'), feelToward('Target', PLEASED, 'Actor'), insert('ending!loyalty')],
      ),
      action('[Actor]: poison [Target] with your own hand', [...knows, ...live], [insert('dead.Target'), insert('ending!complicity')]),
      action(
        "[Actor]: warm to [Schemer]'s charms",
        [...knows, not_('bond.Actor.Schemer!lovers')],
        [setBond('Actor', 'Schemer', 'lovers'), adjustScore('Actor', 'Schemer', WARMTH, 15, 'sweptUp'), feelToward('Actor', PLEASED, 'Schemer')],
      ),
    ],
  });
}

export function intrigueWorld(): State {
  const st = new State();
  st.definePractices([presencePractice(), plotPractice()]);
  st.defineFunctions(coreFns());
  st.setCharacters([character(PLAYER_NAME), character('artus'), holds(character('cassia'), KILL_ARTUS)]);
  st.setDesires([desire(KILL_ARTUS, want([matches(deadSentence('artus'))], 100))]);
  for (const o of [insert('character.marcus'), insert('character.artus'), insert('character.cassia'), insert('practice.presence.rome'), insert('practice.plot.cassia.artus')])
    st.performOutcome(o);
  return st;
}
