/**
 * Arcs de personnage (Versu §X) : l'état INTERNE de haut niveau d'un
 * personnage, un fait unique `X.arc!<étape>`.
 *
 * Reprend `prax-vocab/src/arc.rs` (Prax, BSD-3-Clause).
 */
import { Condition, matches } from '../core/query';
import { Outcome, insert } from '../core/types';

export const arcSentence = (who: string, stage: string): string => `${who}.arc!${stage}`;
export const arcOf = (who: string): string => `${who}.arc`;
export const arcIs = (who: string, stage: string): Condition => matches(arcSentence(who, stage));
export const enterArc = (who: string, stage: string): Outcome => insert(arcSentence(who, stage));
