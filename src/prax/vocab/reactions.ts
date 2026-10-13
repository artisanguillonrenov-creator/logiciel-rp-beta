/**
 * Réactions et normes (Versu §X, §VIII-D). Exécuter une action FAIT NAÎTRE une
 * pratique de réaction ; une réponse est elle-même une action, qui consomme
 * l'instance. Les normes utilisent la même mécanique (violation marquée +
 * réaction de désapprobation).
 *
 * Reprend `prax-vocab/src/reactions.rs` (Prax, BSD-3-Clause).
 */
import { Condition, matches } from '../core/query';
import { Outcome, del, insert } from '../core/types';

export const reactionPath = (pid: string, parts: readonly string[]): string => ['practice', pid, ...parts].join('.');
export const spawnReaction = (pid: string, parts: readonly string[]): Outcome => insert(reactionPath(pid, parts));
export const endReaction = (pid: string, parts: readonly string[]): Outcome => del(reactionPath(pid, parts));
export const reactionActive = (pid: string, parts: readonly string[]): Condition => matches(reactionPath(pid, parts));
const violationPath = (who: string, norm: string): string => ['violated', who, norm].join('.');
export const markViolation = (who: string, norm: string): Outcome => insert(violationPath(who, norm));
export const violationOf = (who: string, norm: string): Condition => matches(violationPath(who, norm));
