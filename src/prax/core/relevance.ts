/**
 * L'analyse de pertinence statique du planificateur : désirs améliorables,
 * recettes de « mort immédiate » (liveness), gabarits porteurs (ce qu'une
 * affordance peut toucher des envies d'un personnage), ancres de lecture d'une
 * prédiction, et l'ensemble des atomes qu'un monde peut produire.
 *
 * Invariant énoncé (hypothèse sur les mondes écrits) : les noms d'entités ne
 * collisionnent jamais avec les noms de prédicats (`lied`, `believes`, …).
 *
 * Reprend `prax-core/src/relevance.rs` (Prax, BSD-3-Clause).
 */
import type { CompiledFn, CompiledPractice, CompiledScheduleRule, Effect } from './compile';
import { Bindings, Db, toSentences } from './db';
import { CompiledRule, axiomHeadPatterns } from './derive';
import { isExclAfter, tokenize } from './path';
import { Cond, groundCond, groundNames, readAnchors } from './query';
import { evictionShadowNames, mayUnifySyms } from './relevanceCore';
import { Character, Desire } from './types';

export { evictionShadowNames, mayUnifySyms } from './relevanceCore';

type Names = readonly string[];

/** La recette « morte maintenant » d'un désir nommé. */
export type Liveness =
  | { readonly k: 'FloorCheck' }
  | { readonly k: 'GateCheck'; readonly gates: ReadonlyArray<readonly Cond[]> }
  | { readonly k: 'AlwaysLive' };

/** Le réservoir de résolution des `Call` : tous les effets de tous les cas. */
export function cookedFnPool(fns: ReadonlyMap<string, CompiledFn>): Map<string, Effect[]> {
  const out = new Map<string, Effect[]>();
  for (const [name, f] of fns) {
    const all: Effect[] = [];
    for (const [, os] of f.cases) all.push(...os);
    out.set(name, all);
  }
  return out;
}

type Atoms = { ins: Names[]; del: Names[] };

/** Les atomes insérés / retirés qu'un effet peut produire ; `null` = sauvage. */
export function cookedOutcomeAtoms(fns: ReadonlyMap<string, readonly Effect[]>, visited: readonly string[], o: Effect): Atoms | null {
  switch (o.t) {
    case 'insert': {
      const names = o.p.segs;
      let anyExcl = false;
      for (let j = 0; j < names.length; j++) if (isExclAfter(o.p, j)) anyExcl = true;
      if (anyExcl) return { ins: [names], del: [names, ...evictionShadowNames(o.p)] };
      return { ins: [names], del: [] };
    }
    case 'insertFor':
      return cookedOutcomeAtoms(fns, visited, { t: 'insert', p: o.p });
    case 'delete':
      return { ins: [], del: [o.p.segs] };
    case 'forEach':
    case 'roll':
      return mconcatAtoms(fns, visited, o.then);
    case 'call': {
      if (visited.includes(o.fn)) return { ins: [], del: [] };
      const outs = fns.get(o.fn);
      if (outs === undefined) return null;
      return mconcatAtoms(fns, [...visited, o.fn], outs);
    }
  }
}

function mconcatAtoms(fns: ReadonlyMap<string, readonly Effect[]>, visited: readonly string[], outs: readonly Effect[]): Atoms | null {
  const ins: Names[] = [];
  const del: Names[] = [];
  for (const o of outs) {
    const a = cookedOutcomeAtoms(fns, visited, o);
    if (a === null) return null;
    ins.push(...a.ins);
    del.push(...a.del);
  }
  return { ins, del };
}

/** Tout ce que le monde peut CONTENIR un jour ; `null` = sauvage. */
export function producibleAtoms(
  defs: ReadonlyMap<string, CompiledPractice>,
  fnPool: ReadonlyMap<string, readonly Effect[]>,
  schedule: readonly CompiledScheduleRule[],
  rules: readonly CompiledRule[],
  db: Db,
): Names[] | null {
  const out: Names[] = [];
  for (const cp of defs.values())
    for (const a of cp.actions)
      for (const o of a.outs) {
        const x = cookedOutcomeAtoms(fnPool, [], o);
        if (x === null) return null;
        out.push(...x.ins);
      }
  for (const cp of defs.values())
    for (const o of cp.inits) {
      const x = cookedOutcomeAtoms(fnPool, [], o);
      if (x === null) return null;
      out.push(...x.ins);
    }
  for (const csr of schedule)
    for (const [, outs] of csr.body)
      for (const o of outs) {
        const x = cookedOutcomeAtoms(fnPool, [], o);
        if (x === null) return null;
        out.push(...x.ins);
      }
  for (const s of toSentences(db)) out.push(tokenize(s).segs);
  out.push(...axiomHeadPatterns(rules));
  out.push(['turn']);
  out.push(['contradiction']);
  return out;
}

/** Motifs positifs et niés d'une envie, plus un drapeau « incertain ». */
function cookedWantPatterns(conds: readonly Cond[]): { pos: Names[]; neg: Names[]; unc: boolean } {
  const pos: Names[] = [];
  const neg: Names[] = [];
  let unc = false;
  for (const c of conds) {
    switch (c.t) {
      case 'match':
        pos.push(c.segs);
        break;
      case 'not':
        neg.push(c.segs);
        break;
      case 'absent': {
        const r = cookedWantPatterns(c.cs);
        pos.push(...r.neg);
        neg.push(...r.pos);
        unc = unc || r.unc;
        break;
      }
      case 'exists': {
        const r = cookedWantPatterns(c.cs);
        pos.push(...r.pos);
        neg.push(...r.neg);
        unc = unc || r.unc;
        break;
      }
      case 'or':
        for (const cl of c.clauses) {
          const r = cookedWantPatterns(cl);
          pos.push(...r.pos);
          neg.push(...r.neg);
          unc = unc || r.unc;
        }
        break;
      case 'eq':
      case 'neq':
      case 'cmp':
        break;
      case 'calc':
      case 'count':
      case 'subquery':
        unc = true;
        break;
    }
  }
  return { pos, neg, unc };
}

interface AtomPools {
  inserted: Names[];
  deleted: Names[];
  wild: boolean;
}

function worldAtomPools(defs: ReadonlyMap<string, CompiledPractice>, fns: ReadonlyMap<string, readonly Effect[]>): AtomPools {
  const atoms: Array<Atoms | null> = [];
  for (const cp of defs.values()) for (const a of cp.actions) for (const o of a.outs) atoms.push(cookedOutcomeAtoms(fns, [], o));
  for (const cp of defs.values()) for (const o of cp.inits) atoms.push(cookedOutcomeAtoms(fns, [], o));
  const wild = atoms.some((a) => a === null);
  const inserted: Names[] = [];
  const deleted: Names[] = [];
  for (const a of atoms) {
    if (a === null) continue;
    inserted.push(...a.ins);
    deleted.push(...a.del);
  }
  return { inserted, deleted, wild };
}

function axiomDerivable(heads: readonly Names[], p: Names): boolean {
  return heads.some((h) => mayUnifySyms(p, h));
}

/** Les désirs qu'une action écrite pourrait améliorer (analyse conservatrice). */
export function improvableDesires(
  defs: ReadonlyMap<string, CompiledPractice>,
  fnPool: ReadonlyMap<string, readonly Effect[]>,
  rules: readonly CompiledRule[],
  desiresCooked: ReadonlyMap<string, readonly Cond[]>,
  desires: readonly Desire[],
): string[] {
  const pools = worldAtomPools(defs, fnPool);
  const heads = axiomHeadPatterns(rules);
  const out: string[] = [];
  for (const d of desires) {
    const conds = desiresCooked.get(d.name) as readonly Cond[];
    const { pos, neg, unc } = cookedWantPatterns(conds);
    const u = d.want.utility;
    let improvable: boolean;
    if (u === 0) improvable = false;
    else if (pools.wild || unc || [...pos, ...neg].some((p) => axiomDerivable(heads, p))) improvable = true;
    else if (u > 0)
      improvable =
        pools.inserted.some((i) => pos.some((p) => mayUnifySyms(i, p))) || pools.deleted.some((dl) => neg.some((p) => mayUnifySyms(dl, p)));
    else
      improvable =
        pools.deleted.some((dl) => pos.some((p) => mayUnifySyms(dl, p))) || pools.inserted.some((i) => neg.some((p) => mayUnifySyms(i, p)));
    if (improvable) out.push(d.name);
  }
  return out;
}

/** La recette « morte maintenant » de chaque désir nommé. */
export function livenessOf(
  defs: ReadonlyMap<string, CompiledPractice>,
  fnPool: ReadonlyMap<string, readonly Effect[]>,
  rules: readonly CompiledRule[],
  desiresCooked: ReadonlyMap<string, readonly Cond[]>,
  desires: readonly Desire[],
): Map<string, Liveness> {
  const pools = worldAtomPools(defs, fnPool);
  const heads = axiomHeadPatterns(rules);
  const entries: Array<[string, Liveness]> = [];
  for (const d of desires) {
    const u = d.want.utility;
    let lv: Liveness;
    if (u < 0) lv = { k: 'FloorCheck' };
    else if (u > 0) lv = positiveLiveness(desiresCooked.get(d.name) as readonly Cond[], pools, heads);
    else lv = { k: 'AlwaysLive' };
    entries.push([d.name, lv]);
  }
  // BTreeMap : ordre des noms, dernière déclaration gagnante.
  const byName = new Map<string, Liveness>();
  for (const [n, l] of entries) byName.set(n, l);
  const out = new Map<string, Liveness>();
  for (const n of [...byName.keys()].sort()) out.set(n, byName.get(n) as Liveness);
  return out;
}

function positiveLiveness(conds: readonly Cond[], pools: AtomPools, heads: readonly Names[]): Liveness {
  const { unc } = cookedWantPatterns(conds);
  const gates: Cond[][] = [];
  for (const c of conds) {
    if (c.t !== 'match') continue;
    const p = c.segs;
    if (!pools.inserted.some((i) => mayUnifySyms(p, i)) && !axiomDerivable(heads, p)) gates.push([{ t: 'match', segs: p }]);
  }
  if (unc || pools.wild || gates.length === 0) return { k: 'AlwaysLive' };
  return { k: 'GateCheck', gates };
}

/** Par personnage, les gabarits d'affordance qui peuvent toucher ses envies. */
export function bearingTemplates(
  defs: ReadonlyMap<string, CompiledPractice>,
  fnPool: ReadonlyMap<string, readonly Effect[]>,
  desiresCooked: ReadonlyMap<string, readonly Cond[]>,
  desires: readonly Desire[],
  wants: ReadonlyMap<string, ReadonlyArray<readonly Cond[]>>,
  characters: readonly Character[],
): Map<string, string[]> {
  const actionAtoms: Array<[string, Names[] | null]> = [];
  for (const cp of defs.values()) for (const a of cp.actions) actionAtoms.push([a.name, actionAtomsOf(fnPool, a.outs)]);
  const byName = new Map<string, string[]>();
  for (const c of characters) {
    const pats = charReadPatterns(c, wants, desiresCooked, desires);
    const bearing = actionAtoms
      .filter(([, m]) => m === null || m.some((atom) => pats.some((p) => mayUnifySyms(atom, p))))
      .map(([n]) => n);
    byName.set(c.name, bearing);
  }
  const out = new Map<string, string[]>();
  for (const n of [...byName.keys()].sort()) out.set(n, byName.get(n) as string[]);
  return out;
}

function actionAtomsOf(fnPool: ReadonlyMap<string, readonly Effect[]>, outs: readonly Effect[]): Names[] | null {
  const all: Names[] = [];
  for (const o of outs) {
    const a = cookedOutcomeAtoms(fnPool, [], o);
    if (a === null) return null;
    all.push(...a.ins, ...a.del);
  }
  return all;
}

function charReadPatterns(
  c: Character,
  wants: ReadonlyMap<string, ReadonlyArray<readonly Cond[]>>,
  desiresCooked: ReadonlyMap<string, readonly Cond[]>,
  desires: readonly Desire[],
): Names[] {
  const conds: Cond[] = [];
  const ws = wants.get(c.name);
  if (ws !== undefined) for (const w of ws) conds.push(...w);
  for (const d of desires) if (c.desires.includes(d.name)) conds.push(...(desiresCooked.get(d.name) as readonly Cond[]));
  return readAnchors(conds) as Names[];
}

/**
 * Tout ce que `predictMove` (garde de portée comprise) peut lire quand
 * l'acteur prédit le personnage `m`, en ancres fondées sur la paire.
 */
export function moverReadAnchors(
  scope: readonly Cond[],
  practices: ReadonlyMap<string, CompiledPractice>,
  fns: ReadonlyMap<string, CompiledFn>,
  desiresCooked: ReadonlyMap<string, readonly Cond[]>,
  actor: string,
  m: string,
): Names[] {
  const actorB: Bindings = new Map([['Actor', m]]);
  const ownerB: Bindings = new Map([['Owner', m]]);
  const scopeB: Bindings = new Map([
    ['Actor', actor],
    ['Witness', m],
  ]);
  const empty: Bindings = new Map();
  const out: Names[] = [];
  out.push(...readsOf(scopeB, scope));
  out.push([actor, 'believes', 'desires', m, 'PraxD']);
  out.push(tokenize(`dead.${m}`).segs);
  for (const cp of practices.values()) {
    out.push(groundNames(actorB, cp.instanceNames));
    for (const ca of cp.actions) {
      out.push(...readsOf(actorB, ca.conds));
      out.push(...outcomeCondReads(actorB, ca.outs));
    }
    out.push(...outcomeCondReads(empty, cp.inits));
  }
  for (const f of fns.values()) {
    for (const [cs, os] of f.cases) {
      out.push(...readsOf(empty, cs));
      out.push(...outcomeCondReads(empty, os));
    }
  }
  for (const conds of desiresCooked.values()) out.push(...readsOf(ownerB, conds));
  return out;
}

function readsOf(b: Bindings, conds: readonly Cond[]): Names[] {
  return readAnchors(conds.map((c) => groundCond(b, c))) as Names[];
}

function outcomeCondReads(b: Bindings, outs: readonly Effect[]): Names[] {
  const out: Names[] = [];
  for (const o of outs) {
    if (o.t === 'forEach' || o.t === 'roll') {
      out.push(...readsOf(b, o.when));
      out.push(...outcomeCondReads(b, o.then));
    }
  }
  return out;
}
