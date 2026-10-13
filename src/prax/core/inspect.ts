/**
 * L'inspecteur d'auteur : « pourquoi cette action n'est-elle pas disponible ? »
 * (l'inspecteur d'exécution de Versu). Trouve la PREMIÈRE condition après
 * laquelle la conjonction n'a plus de solution.
 *
 * Reprend `prax-core/src/inspect.rs` (Prax, BSD-3-Clause).
 */
import { Bindings, Db, childKeys, unify } from './db';
import { State } from './engine';
import { renderText } from './perform';
import { Cond, query } from './query';

/** La première condition qui rend la conjonction insatisfiable, ou `null`. */
export function firstFailing(db: Db, conds: readonly Cond[], b0: Bindings): Cond | null {
  for (let k = 1; k <= conds.length; k++) if (query(db, conds.slice(0, k), b0).length === 0) return conds[k - 1];
  return null;
}

function renderCond(c: Cond): string {
  if (c.t === 'match') return c.segs.join('.');
  if (c.t === 'not') return `not ${c.segs.join('.')}`;
  return JSON.stringify(c);
}

/** Pour `actor`, explique chaque action dont le texte contient `needle`. */
export function explain(st: State, actor: string, needle: string): string[] {
  const db = st.db;
  const comp = st.compiled;
  const out: string[] = [];
  for (const pid of childKeys(db, ['practice'])) {
    const cp = comp.practices.get(pid);
    if (cp === undefined) continue;
    for (const inst of unify(db, cp.instanceNames, new Map([['Actor', actor]]))) {
      for (const a of cp.actions) {
        const label = renderText(a.name, inst);
        if (!label.includes(needle)) continue;
        const c = firstFailing(db, a.conds, inst);
        out.push(c === null ? `${label} — AVAILABLE` : `${label} — blocked by: ${renderCond(c)}`);
      }
    }
  }
  return out;
}
