/**
 * Sentiments épisodiques coexistants (v38). `<qui>.feels.<émotion>` et
 * `<qui>.feels.<émotion>.toward.<cible>` sont des faits multi-valués.
 *
 * L'INVARIANT : les sentiments changent la prise de décision, jamais les
 * décisions possibles. Ils s'estompent (durée de vie sur l'insertion) ; les
 * dispositions (traits, marques) ne s'estompent pas.
 *
 * Reprend `prax-vocab/src/emotion.rs` (Prax, BSD-3-Clause).
 */
import { Condition, matches } from '../core/query';
import { Outcome, del, insert, insertFor } from '../core/types';

export const HAPPY = 'happy';
export const SAD = 'sad';
export const ANGRY = 'angry';
export const AFRAID = 'afraid';
export const DISGUSTED = 'disgusted';
export const SURPRISED = 'surprised';
export const ANNOYED = 'annoyed';
export const PLEASED = 'pleased';

function feelsPath(who: string, emotion: string): string {
  return `${who}.feels.${emotion}`;
}

export const feel = (who: string, emotion: string): Outcome => insert(feelsPath(who, emotion));
export const feelToward = (who: string, emotion: string, target: string): Outcome => insert(`${feelsPath(who, emotion)}.toward.${target}`);
export const feelFor = (n: number, who: string, emotion: string): Outcome => insertFor(n, feelsPath(who, emotion));
export const feelTowardFor = (n: number, who: string, emotion: string, target: string): Outcome => insertFor(n, `${feelsPath(who, emotion)}.toward.${target}`);
export const unfeel = (who: string, emotion: string): Outcome => del(feelsPath(who, emotion));
export const unfeelToward = (who: string, emotion: string, target: string): Outcome => del(`${feelsPath(who, emotion)}.toward.${target}`);
export const feeling = (who: string, emotion: string): Condition => matches(feelsPath(who, emotion));
export const feelingToward = (who: string, emotion: string, target: string): Condition => matches(`${feelsPath(who, emotion)}.toward.${target}`);
