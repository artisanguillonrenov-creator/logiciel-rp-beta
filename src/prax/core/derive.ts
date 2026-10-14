/**
 * Déduction en chaînage avant : les axiomes du domaine `corps → tête`, fermés
 * jusqu'au point fixe (le modèle canonique m(G,A) de l'article). Les têtes sont
 * « rencontrées » (meet) dans le modèle, si bien qu'un emplacement exclusif
 * forcé donne ⊥ — une contradiction détectée, jamais un écrasement silencieux.
 * La fermeture est une VUE : la base reste la source de vérité, et une
 * conclusion dont la prémisse disparaît disparaît avec elle.
 *
 * Reprend `prax-core/src/derive.rs` (Prax, BSD-3-Clause), y compris la
 * correction DIV-1 : les règles à corps « riches » (Exists/Absent/Not/Or/
 * Subquery/Count) sont réévaluées sur le modèle entier à chaque tour.
 */
import { Bindings, Db, bindingsKey, emptyDb, groundTokens, insert, metOne, metOneTransient, child } from './db';
import { CompiledPath, isExclAfter, renderPath, tokenize } from './path';
import { Cond, Condition, compileCondition, query, readAnchors } from './query';
import { mayUnifySyms } from './relevanceCore';
import { cmpStr, stableSort } from './util';

/** Une contradiction détectée : la tête (étiquetée) incompatible avec le modèle. */
export class Contradiction {
  constructor(readonly sentence: string) {}
}

type RuleKind = { readonly k: 'fast'; readonly positions: readonly number[] } | { readonly k: 'full' };

/** Un axiome compilé une fois par monde. */
export interface CompiledRule {
  readonly body: readonly Cond[];
  readonly heads: readonly CompiledPath[];
  readonly kind: RuleKind;
  readonly readAnchors: ReadonlyArray<readonly string[]>;
}

export function compileRule(body: readonly Condition[], heads: readonly string[]): CompiledRule {
  const b = body.map(compileCondition);
  const h = heads.map((x) => tokenize(x));
  return { body: b, heads: h, kind: classify(b), readAnchors: readAnchors(b) };
}

function classify(body: readonly Cond[]): RuleKind {
  const rich = body.some((c) => c.t === 'not' || c.t === 'absent' || c.t === 'exists' || c.t === 'or' || c.t === 'subquery' || c.t === 'count');
  if (rich) return { k: 'full' };
  const positions: number[] = [];
  body.forEach((c, i) => {
    if (c.t === 'match') positions.push(i);
  });
  return positions.length === 0 ? { k: 'full' } : { k: 'fast', positions };
}

/** Le modèle entraîne-t-il déjà la tête, segment pour segment ? */
function entailed(model: Db, head: CompiledPath): boolean {
  let node: Db = model;
  const n = head.segs.length;
  for (let i = 0; i < n; i++) {
    const c = child(node, head.segs[i]);
    if (c === undefined) return false;
    if (isExclAfter(head, i) && !c.excl) return false;
    if (i + 1 === n && !c.asserted) return false;
    node = c;
  }
  return true;
}

/**
 * Ferme une base sous un ensemble de règles. Renvoie le modèle fermé ou la
 * contradiction (le témoin ⊥ le plus petit par nom). Sans règle, la base est
 * renvoyée telle quelle.
 */
export function close(rules: readonly CompiledRule[], base: Db): Db | Contradiction {
  if (rules.length === 0) return base;
  return run(rules, base, base, null);
}

/**
 * Prolonge un modèle DÉJÀ fermé avec de nouveaux faits de base. Sûr seulement
 * pour des faits monotones (sans `!` et ne touchant aucun motif nié) — la
 * garde est celle de l'appelant (le routeur du moteur).
 */
export function closeFrom(rules: readonly CompiledRule[], closed: Db, facts: readonly CompiledPath[]): Db | Contradiction {
  let model = closed;
  let delta = emptyDb();
  for (const f of facts) {
    model = insert(model, f);
    delta = insert(delta, f);
  }
  if (rules.length === 0) return model;
  return run(rules, model, delta, facts.slice());
}

function run(rules: readonly CompiledRule[], model0: Db, delta0: Db, deltaFacts0: CompiledPath[] | null): Db | Contradiction {
  let model = model0;
  let delta = delta0;
  let deltaFacts = deltaFacts0;
  for (;;) {
    const fresh: CompiledPath[] = [];
    const freshKeys = new Set<string>();
    for (const rule of rules) {
      if (deltaFacts !== null && rule.readAnchors.length > 0) {
        let touched = false;
        for (const f of deltaFacts) {
          for (const a of rule.readAnchors) {
            if (mayUnifySyms(f.segs, a)) {
              touched = true;
              break;
            }
          }
          if (touched) break;
        }
        if (!touched) continue;
      }
      for (const b of ruleBindings(rule, model, delta)) {
        for (const h of rule.heads) {
          const g = groundTokens(h, b);
          if (!entailed(model, g)) {
            const key = renderPath(g);
            if (!freshKeys.has(key)) {
              freshKeys.add(key);
              fresh.push(g);
            }
          }
        }
      }
    }
    if (fresh.length === 0) return model;
    // Le ⊥ ne dépend pas de l'ordre de rencontre ; on rencontre dans l'ordre
    // des noms pour que le témoin éventuel soit le plus petit par nom.
    const named = stableSort(
      fresh.map((g) => ({ name: renderPath(g), g })),
      (a, b) => cmpStr(a.name, b.name),
    );
    let nextDelta = emptyDb();
    let cur: Db = model;
    const tok = {};
    for (const { name, g } of named) {
      const m = metOneTransient(cur, g, tok);
      if (m === null) return new Contradiction(name);
      cur = m;
      nextDelta = insert(nextDelta, g);
    }
    model = cur;
    delta = nextDelta;
    deltaFacts = named.map((x) => x.g);
  }
}

function ruleBindings(rule: CompiledRule, model: Db, delta: Db): Bindings[] {
  if (rule.kind.k === 'full') return query(model, rule.body, new Map());
  const positions = rule.kind.positions;
  if (positions.length === 1) return joinAt(rule.body, positions[0], model, delta);
  const out: Bindings[] = [];
  const seen = new Set<string>();
  for (const i of positions) {
    for (const b of joinAt(rule.body, i, model, delta)) {
      const k = bindingsKey(b);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(b);
      }
    }
  }
  return out;
}

function joinAt(body: readonly Cond[], i: number, model: Db, delta: Db): Bindings[] {
  let bs: Bindings[] = [new Map()];
  for (let j = 0; j < body.length; j++) {
    const db = j === i ? delta : model;
    const next: Bindings[] = [];
    for (const b of bs) for (const r of query(db, [body[j]], b)) next.push(r);
    bs = next;
    if (bs.length === 0) break;
  }
  return bs;
}

/**
 * La fermeture NAÏVE (oracle de test) : toutes les règles sur tout le modèle à
 * chaque tour, sans delta. Doit toujours égaler `close`.
 */
export function naiveClosure(rules: readonly CompiledRule[], base: Db): Db | Contradiction {
  if (rules.length === 0) return base;
  let model = base;
  for (;;) {
    const fresh = new Map<string, CompiledPath>();
    for (const rule of rules) {
      for (const b of query(model, rule.body, new Map())) {
        for (const h of rule.heads) {
          const g = groundTokens(h, b);
          if (!entailed(model, g)) fresh.set(renderPath(g), g);
        }
      }
    }
    if (fresh.size === 0) return model;
    const names = stableSort([...fresh.keys()], cmpStr);
    for (const name of names) {
      const m = metOne(model, fresh.get(name) as CompiledPath);
      if (m === null) return new Contradiction(name);
      model = m;
    }
  }
}

// ---- tables d'analyse dérivées des axiomes ----------------------------------

/** Chaque motif que les axiomes peuvent lire ou écrire. */
export function axiomFootprint(rules: readonly CompiledRule[]): Array<readonly string[]> {
  const out: Array<readonly string[]> = [];
  for (const r of rules) {
    out.push(...readAnchors(r.body));
    for (const h of r.heads) out.push(h.segs);
  }
  return out;
}

/** Chaque motif sous une négation dans un corps. */
export function axiomNegPatterns(rules: readonly CompiledRule[]): Array<readonly string[]> {
  const out: Array<readonly string[]> = [];
  for (const r of rules) for (const c of r.body) negOf(c, out);
  return out;
}

function negOf(c: Cond, out: Array<readonly string[]>): void {
  switch (c.t) {
    case 'not':
      out.push(c.segs);
      return;
    case 'absent':
      out.push(...readAnchors(c.cs));
      return;
    case 'exists':
      for (const x of c.cs) negOf(x, out);
      return;
    case 'or':
      for (const cl of c.clauses) for (const x of cl) negOf(x, out);
      return;
    case 'subquery':
      for (const x of c.where) negOf(x, out);
      return;
    default:
      return;
  }
}

/** Chaque tête que les axiomes peuvent écrire. */
export function axiomHeadPatterns(rules: readonly CompiledRule[]): Array<readonly string[]> {
  const out: Array<readonly string[]> = [];
  for (const r of rules) for (const h of r.heads) out.push(h.segs);
  return out;
}

/** L'ensemble d'axiomes admet-il le prolongement monotone (`monotoneAxioms`) ? */
export function monotoneAxioms(rules: readonly CompiledRule[]): boolean {
  return rules.every((r) => {
    const aggs = aggVars(r.body);
    return r.body.every((c) => condOk(aggs, c));
  });
}

function aggVars(body: readonly Cond[]): Set<string> {
  const out = new Set<string>();
  const go = (c: Cond): void => {
    switch (c.t) {
      case 'count':
        out.add(c.r);
        return;
      case 'subquery':
        out.add(c.set);
        c.where.forEach(go);
        return;
      case 'exists':
        c.cs.forEach(go);
        return;
      case 'or':
        c.clauses.forEach((cl) => cl.forEach(go));
        return;
      default:
        return;
    }
  };
  body.forEach(go);
  return out;
}

function numericLiteral(x: string): boolean {
  if (x.length === 0) return false;
  for (let i = 0; i < x.length; i++) {
    const c = x.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

function condOk(aggs: Set<string>, c: Cond): boolean {
  switch (c.t) {
    case 'match':
    case 'not':
    case 'absent':
    case 'count':
      return true;
    case 'eq':
    case 'neq':
      return !aggs.has(c.a) && !aggs.has(c.b);
    case 'exists':
      return c.cs.every((x) => condOk(aggs, x));
    case 'or':
      return c.clauses.every((cl) => cl.every((x) => condOk(aggs, x)));
    case 'subquery':
      return c.where.every((x) => condOk(aggs, x));
    case 'cmp':
      return c.op === 'gt' || c.op === 'gte' ? numericLiteral(c.b) : numericLiteral(c.a);
    case 'calc':
      return false;
  }
}

export function isContradiction(x: Db | Contradiction): x is Contradiction {
  return x instanceof Contradiction;
}
