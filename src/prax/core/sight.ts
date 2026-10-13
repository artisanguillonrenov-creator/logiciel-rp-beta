/**
 * Fragment de portée perceptive : le Témoin a été aperçu dans les `h`
 * derniers tours (`Prax.Sight.sightedWithin`).
 *
 * Reprend `prax-core/src/sight.rs` (Prax, BSD-3-Clause).
 */
import { Condition, calc, cmp, matches } from './query';

export function sightedWithin(h: number): Condition[] {
  return [matches('Actor.believes.atSince.Witness!Since'), matches('turn!Now'), calc('Expiry', 'add', 'Since', String(h)), cmp('gte', 'Expiry', 'Now')];
}
