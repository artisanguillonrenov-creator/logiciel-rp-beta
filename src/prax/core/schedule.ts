/**
 * La surface d'écriture du temps du moteur (v44) : durées de vie,
 * rassemblements récurrents, et la perception comme règle de période 1.
 *
 * Reprend `prax-core/src/schedule.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from './errors';
import { Condition, matches, neq } from './query';
import { Outcome, ScheduleRule, insert, scheduleRule } from './types';

/** Donne une durée de vie à une insertion simple (seule une insertion le peut). */
export function lasts(n: number, o: Outcome): Outcome {
  if (o.t === 'insert') return { t: 'insertFor', n, s: o.s };
  throw worldErrors.lifetimeOnNonInsert(JSON.stringify(o));
}

/** Un rassemblement récurrent : 0 < durée < période. */
export function gathering(name: string, period: number, duration: number, openOuts: readonly Outcome[]): ScheduleRule {
  if (duration < 1 || duration >= period) throw worldErrors.gatheringDuration(name, period, duration);
  return scheduleRule(name, period, [[[], openOuts.map((o) => lasts(duration, o))]]);
}

/** La perception comme règle de période 1 (variables de contrat Seer/Seen/Spot/Now). */
export function sightRule(sighting: readonly Condition[]): ScheduleRule {
  const when = [...sighting, neq('Seer', 'Seen'), matches('turn!Now')];
  return scheduleRule('sight', 1, [[when, [insert('Seer.believes.at.Seen!Spot'), insert('Seer.believes.atSince.Seen!Now')]]]);
}
