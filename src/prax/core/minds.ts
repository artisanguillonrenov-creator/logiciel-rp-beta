/**
 * Les esprits comme objets de croyance — le trio du planificateur : quels
 * désirs un prédicteur croit qu'un autre personnage a, et les envies compilées
 * qu'on évalue pour soi ou pour lui.
 *
 * Reprend `prax-core/src/minds.rs` (Prax, BSD-3-Clause).
 */
import { Bindings, Db, exists } from './db';
import { tokenize } from './path';
import { Cond, groundCond } from './query';
import { Character, Desire } from './types';

export type Model = ReadonlyArray<readonly [readonly Cond[], number]>;

/** Les désirs du vocabulaire que `p` croit que `m` porte (toute provenance), dans l'ordre du vocabulaire. */
export function believedDesires(view: Db, desires: readonly Desire[], p: string, m: string): Desire[] {
  return desires.filter((d) => exists(view, tokenize(`${p}.believes.desires.${m}.${d.name}`).segs));
}

/** Fonde les gabarits de désirs pour un propriétaire, chacun avec son utilité. */
export function cookedDesiresFor(desiresCooked: ReadonlyMap<string, readonly Cond[]>, owner: string, ds: readonly Desire[]): Array<[readonly Cond[], number]> {
  const b: Bindings = new Map([['Owner', owner]]);
  return ds.map((d) => {
    const conds = desiresCooked.get(d.name) ?? [];
    return [conds.map((c) => groundCond(b, c)), d.want.utility];
  });
}

/** Les envies propres d'un personnage (ses envies, puis ses désirs dans l'ordre du vocabulaire). */
export function cookedSelfWants(
  wantsTable: ReadonlyMap<string, ReadonlyArray<readonly Cond[]>>,
  desiresCooked: ReadonlyMap<string, readonly Cond[]>,
  desires: readonly Desire[],
  c: Character,
): Array<[readonly Cond[], number]> {
  const out: Array<[readonly Cond[], number]> = [];
  const cooked = wantsTable.get(c.name) ?? [];
  const n = Math.min(cooked.length, c.wants.length);
  for (let i = 0; i < n; i++) out.push([cooked[i], c.wants[i].utility]);
  const held = desires.filter((d) => c.desires.includes(d.name));
  out.push(...cookedDesiresFor(desiresCooked, c.name, held));
  return out;
}
