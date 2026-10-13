/**
 * Croyances : la divergence, question par question, entre le modèle d'un
 * personnage et la vérité (Versu §X). Une croyance est un fait sous l'agent :
 * `X.believes.<question>!Valeur` (un seul emplacement par question).
 *
 * Reprend `prax-vocab/src/beliefs.rs` (Prax, BSD-3-Clause).
 */
import { Condition, matches } from '../core/query';
import { Outcome, del, insert } from '../core/types';

export const beliefSentence = (who: string, issue: string, value: string): string => `${who}.believes.${issue}!${value}`;
export const beliefAbout = (who: string, issue: string): string => `${who}.believes.${issue}`;
export const believe = (who: string, issue: string, value: string): Outcome => insert(beliefSentence(who, issue, value));
export const believesThat = (who: string, issue: string, value: string): Condition => matches(beliefSentence(who, issue, value));
export const forget = (who: string, issue: string): Outcome => del(beliefAbout(who, issue));
