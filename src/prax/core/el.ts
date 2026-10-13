/**
 * Le treillis de la logique d'exclusion (Evans, DEON 2010) : `meet` (borne
 * inférieure ⊓ ; `null` = ⊥, l'incompatibilité) et `leq` (l'ordre
 * d'information ≤ : `a ≤ b` ssi `a` entraîne `b`).
 *
 * Reprend `prax-core/src/el.rs` (Prax, BSD-3-Clause).
 */
import { Db, DbNode } from './db';

/** Borne inférieure ⊓ de deux modèles ; `null` = ⊥. */
export function meet(a: Db, b: Db): Db | null {
  const keys: string[] = [];
  const kids: DbNode[] = [];
  let i = 0;
  let j = 0;
  while (i < a.keys.length || j < b.keys.length) {
    if (j >= b.keys.length || (i < a.keys.length && a.keys[i] < b.keys[j])) {
      keys.push(a.keys[i]);
      kids.push(a.kids[i]);
      i++;
    } else if (i >= a.keys.length || b.keys[j] < a.keys[i]) {
      keys.push(b.keys[j]);
      kids.push(b.kids[j]);
      j++;
    } else {
      const m = meet(a.kids[i], b.kids[j]);
      if (m === null) return null;
      keys.push(a.keys[i]);
      kids.push(m);
      i++;
      j++;
    }
  }
  const excl = a.excl || b.excl;
  const asserted = a.asserted || b.asserted;
  if (excl && keys.length > 1) return null;
  return { excl, asserted, keys, kids };
}

/** Ordre d'information : `a ≤ b` (a entraîne b). */
export function leq(a: Db, b: Db): boolean {
  if (!(a.excl || !b.excl)) return false;
  if (!(a.asserted || !b.asserted)) return false;
  let i = 0;
  for (let j = 0; j < b.keys.length; j++) {
    const k = b.keys[j];
    while (i < a.keys.length && a.keys[i] < k) i++;
    if (i >= a.keys.length || a.keys[i] !== k) return false;
    if (!leq(a.kids[i], b.kids[j])) return false;
  }
  return true;
}
