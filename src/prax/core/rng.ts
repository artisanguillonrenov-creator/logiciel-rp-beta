/**
 * Le dé dramatique : un flux MINSTD (Lehmer) exact au bit près. Il avance
 * inconditionnellement à chaque tirage (touché ou raté), puis le jet se lit sur
 * la valeur avancée. Domaine de la graine gardé (0 et les multiples du module
 * sont des points fixes).
 *
 * Reprend `prax-core/src/rng.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from './errors';
import { Condition } from './query';
import { Outcome, authoredVarClash } from './types';

const LEHMER_A = 16807;
const LEHMER_M = 2147483647;

/** Le domaine valide de la graine, bornes incluses. */
export const SEED_BOUNDS: readonly [number, number] = [1, LEHMER_M - 1];

/** Un pas de Lehmer. `s * 16807` reste < 2^53 : exact en double. */
export function rollStep(s: number): number {
  return (s * LEHMER_A) % LEHMER_M;
}

/**
 * « Avec probabilité num/den, si `conds` tiennent aussi, appliquer `outs`. »
 * Compile en un unique `roll` : chaque tirage consomme exactement un pas.
 */
export function draw(num: number, den: number, conds: readonly Condition[], outs: readonly Outcome[]): Outcome[] {
  if (num <= 0 || num >= den) throw worldErrors.drawOdds(num, den);
  const v = authoredVarClash([], conds, outs)[0];
  if (v !== undefined) throw worldErrors.reservedVarClash('Rng.draw', v, ' (the Prax namespace is reserved for the die’s own machinery)');
  return [{ t: 'roll', num, den, when: conds, then: outs }];
}
