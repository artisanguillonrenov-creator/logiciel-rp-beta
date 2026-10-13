/**
 * Le complot sous forme de pièce : le même drame que `intrigue`, écrit avec
 * la surface scène / temps fort / jonction, en deux actes (une TRANSITION de
 * scène et l'organigramme automatique). Trois fins : trahison, loyauté,
 * complicité.
 *
 * Reprend `prax-worlds/src/play.rs` (Prax, BSD-3-Clause).
 */
import { State } from '../core/engine';
import { absent, matches, not_ } from '../core/query';
import { deadSentence, insert, want } from '../core/types';
import { compile } from '../script/compile';
import { Scene, Script, ending, goto, member, player, quip, scene, script, wanting } from '../script/script';
import { WARMTH, adjustScore, setBond } from '../vocab/coreModel';
import { PLEASED, feelToward } from '../vocab/emotion';

export const PLAYER_NAME = 'marcus';

export function playScript(): Script {
  return script('confidence', [player(PLAYER_NAME), member('artus'), wanting(member('cassia'), [want([matches(deadSentence('artus'))], 100)])], [confidence(), banquet()]);
}

function confidence(): Scene {
  return scene('confidence', {
    opening: 'A quiet portico. Cassia draws Marcus aside.',
    beats: [
      quip('cassia', '[Actor]: confide the plot against artus to marcus', [not_('confided')], [
        insert('confided'),
        insert('marcusKnows'),
        adjustScore('marcus', 'cassia', WARMTH, 5, 'sharedASecret'),
      ]),
    ],
    junctions: [goto('toBanquet', 'banquet', [matches('confided')])],
  });
}

function banquet(): Scene {
  const open = [not_(deadSentence('artus')), absent([matches('foiled')])];
  return scene('banquet', {
    opening: 'The banquet hall. Artus reclines, oblivious, wine in hand.',
    beats: [
      quip('cassia', "[Actor]: slip poison into artus's cup", open, [insert('poisoned.artus.byCassia'), insert(deadSentence('artus'))]),
      quip('marcus', '[Actor]: warn artus that cassia means to kill him', [matches('marcusKnows'), ...open], [
        insert('foiled'),
        adjustScore('artus', 'marcus', WARMTH, 30, 'savedMyLife'),
        feelToward('artus', PLEASED, 'marcus'),
      ]),
      quip('marcus', '[Actor]: poison artus with your own hand', [matches('marcusKnows'), ...open], [insert('poisoned.artus.byMarcus'), insert(deadSentence('artus'))]),
      quip('marcus', "[Actor]: warm to cassia's charms", [matches('marcusKnows'), not_('bond.marcus.cassia!lovers')], [
        setBond('marcus', 'cassia', 'lovers'),
        adjustScore('marcus', 'cassia', WARMTH, 15, 'sweptUp'),
        feelToward('marcus', PLEASED, 'cassia'),
      ]),
    ],
    junctions: [ending('betrayal', [matches('poisoned.artus.byCassia')]), ending('loyalty', [matches('foiled')]), ending('complicity', [matches('poisoned.artus.byMarcus')])],
  });
}

export function playWorld(): State {
  return compile(playScript());
}
