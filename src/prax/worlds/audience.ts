/**
 * L'audience royale : flatter le roi puis présenter sa requête, avant que le
 * moment (ou le Duc) ne passe. Un CROQUIS de personnage (la préoccupation du
 * Duc pour la faveur royale devient un désir) et une JONCTION MINUTÉE
 * (l'audience prend fin d'elle-même si l'on traîne).
 *
 * Reprend `prax-worlds/src/audience.rs` (Prax, BSD-3-Clause).
 */
import { State } from '../core/engine';
import { matches, not_ } from '../core/query';
import { insert } from '../core/types';
import { compile } from '../script/compile';
import { Scene, Script, concernedWith, ending, member, player, quip, scene, script, timeout, withTraits } from '../script/script';
import { adjustScore, scoreAtLeast } from '../vocab/coreModel';

export const PLAYER_NAME = 'envoy';
const FAVOR = 'favor';

export function audienceScript(): Script {
  return script('audience', [player(PLAYER_NAME), withTraits(concernedWith(member('duke'), [[FAVOR, 10]]), ['ambitious']), member('king')], [audience()]);
}

function audience(): Scene {
  return scene('audience', {
    opening: "The throne room. You hold the king's ear — but not for long, and the Duke is circling.",
    setup: [insert('atCourt')],
    beats: [
      quip('envoy', '[Actor]: flatter the king', [not_('petitioned')], [adjustScore('king', 'envoy', FAVOR, 5, 'flattery')]),
      quip('envoy', '[Actor]: present your petition', [...scoreAtLeast('king', 'envoy', FAVOR, 5), not_('petitioned')], [insert('petitioned')]),
      quip('duke', '[Actor]: flatter the king', [not_('dukeSpoke'), not_('petitioned')], [insert('dukeSpoke'), adjustScore('king', 'duke', FAVOR, 5, 'flattery')]),
    ],
    junctions: [ending('granted', [matches('petitioned')]), timeout('dismissed', 5)],
  });
}

export function audienceWorld(): State {
  return compile(audienceScript());
}
