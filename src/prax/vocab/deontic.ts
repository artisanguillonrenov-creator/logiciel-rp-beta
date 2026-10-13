/**
 * Logique d'exclusion déontique — une couche « devoir / obligation » de
 * première classe (Evans, DEON 2010). `□P` n'est que le sucre syntaxique du
 * fait ordinaire `obliged.<qui>.<P>` ; l'obligation réparatrice `□□` est le
 * fait imbriqué. La stratification (□ ne s'applique qu'à un TERME SIMPLE) évite
 * les paradoxes de la logique déontique standard.
 *
 * Reprend `prax-vocab/src/deontic.rs` (Prax, BSD-3-Clause).
 */
import { Db, emptyDb, existsStr, insertStr, toSentences } from '../core/db';
import { Condition, matches } from '../core/query';
import { Axiom, Outcome, Want, del, insert, want } from '../core/types';
import { OBLIGED_HEAD, OBLIGED_LIFT_PREFIX, obligationPath } from '../core/vocabConsts';
import { markViolation, violationOf } from './reactions';

const liftSent = (s: string): string => `${OBLIGED_LIFT_PREFIX}${s}`;

/** Relève une règle purement conjonctive sous l'opérateur d'obligation ; `null` sinon. */
export function obligedLift(ax: Axiom): Axiom | null {
  if (!ax.when.every((c) => c.t === 'match')) return null;
  return { when: ax.when.map((c) => (c.t === 'match' ? matches(liftSent(c.s)) : c)), then: ax.then.map(liftSent) };
}

/** Ferme les axiomes d'un monde sous l'opérateur d'obligation (propriété DEON 1). */
export function obligedClose(axs: readonly Axiom[]): Axiom[] {
  const out = [...axs];
  for (const a of axs) {
    const l = obligedLift(a);
    if (l !== null) out.push(l);
  }
  return out;
}

export const oblige = (who: string, content: string): Outcome => insert(obligationPath(who, content));
export const discharge = (who: string, content: string): Outcome => del(obligationPath(who, content));
export const breach = (who: string, norm: string): Outcome => markViolation(who, norm);
export const obligeReparative = (who: string, content: string): Outcome => oblige(who, obligationPath(who, content));
export const isObliged = (who: string, content: string): Condition => matches(obligationPath(who, content));
export const fulfilled = (who: string, content: string): Condition[] => [isObliged(who, content), matches(content)];
export const inBreach = (who: string, norm: string): Condition => violationOf(who, norm);

/** Test d'incompatibilité (propriété 2) : les deux contenus sont-ils conjointement insatisfiables ? */
export function conflicts(c1: string, c2: string): boolean {
  const d = insertStr(insertStr(emptyDb(), c1), c2);
  return !(existsStr(d, c1) && existsStr(d, c2));
}

/** Chaque paire incompatible parmi des contenus candidats. */
export function incompatiblePairs(cs: readonly string[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  cs.forEach((a, i) => {
    for (const b of cs.slice(i + 1)) if (conflicts(a, b)) out.push([a, b]);
  });
  return out;
}

/** Les contenus auxquels `who` est obligé (pour affichage). */
export function obligationsOf(who: string, db: Db): string[] {
  const prefix = `${OBLIGED_HEAD}.${who}.`;
  return toSentences(db)
    .filter((s) => s.startsWith(prefix))
    .map((s) => s.slice(prefix.length));
}

export const wantFulfilled = (who: string, content: string, k: number): Want => want(fulfilled(who, content), k);
export const avoidBreach = (who: string, content: string, k: number): Want => want([inBreach(who, content)], -Math.abs(k));
