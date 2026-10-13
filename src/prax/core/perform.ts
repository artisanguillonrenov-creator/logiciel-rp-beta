/**
 * Le cœur d'exécution, en fonctions libres sur l'état découpé (définitions
 * partagées + exécution mutable) : appliquer un effet, découvrir les
 * affordances d'un acteur, la frontière de tour, la naissance des instances
 * de pratique, et le routeur à trois étages de la vue fermée.
 *
 * Routeur (identique à Prax) — chaque insertion est classée puis routée :
 *  - non pertinente pour les axiomes → base ET vue modifiées en même temps ;
 *  - monotone → la vue fermée est prolongée avec le seul fait nouveau ;
 *  - sinon → refermeture complète (⊥ ⇒ vue = base + `contradiction`).
 *
 * Reprend la partie « perform » de `prax-core/src/engine.rs` (Prax, BSD-3-Clause).
 */
import { Compiled, Effect, groundEffect } from './compile';
import { Bindings, Db, childKeys, exists, insert, retract, unify, valToString } from './db';
import { close, closeFrom, isContradiction } from './derive';
import { CompiledPath, renderPath, tokenize } from './path';
import { Cond, Condition, query, groundNames } from './query';
import { evictionShadowNames, mayUnifySyms } from './relevanceCore';
import { rollStep } from './rng';
import { Axiom, Character, Desire, Practice, PraxFunction, ScheduleRule } from './types';
import { cmpStr, isVariableName, stableSort } from './util';

/** Une action entièrement fondée, exécutable (`GroundedAction`). */
export interface GroundedAction {
  readonly practiceId: string;
  readonly instanceId: string;
  /** Le nom de l'action d'origine (une clé). */
  readonly actionId: string;
  /** Acteur + rôles + liaisons de la requête. */
  readonly bindings: Bindings;
  /** Le texte affiché. */
  readonly label: string;
}

/** La signature de motivation v35. */
export interface MotiveSignature {
  readonly bearing: readonly string[];
  readonly satisfaction: readonly number[];
  readonly liveDesires: readonly string[];
  readonly knownMotives: ReadonlyArray<readonly [string, string]>;
}

/** Une intention en cours : l'action choisie (ou rien) et la signature sur laquelle elle reposait. */
export interface Intention {
  readonly act: GroundedAction | null;
  readonly basis: MotiveSignature;
}

/** Une étape d'effet observée (le journal des tirages de l'oracle). */
export interface EffectStep {
  readonly index: number;
  readonly odds: ReadonlyArray<readonly [number, number]>;
  readonly rngBefore: number | null;
  readonly rngAfter: number | null;
  readonly changed: boolean;
}

/** Les sources écrites conservées + les formes compilées. */
export interface Defs {
  readonly practices: ReadonlyMap<string, Practice>;
  readonly fns: readonly PraxFunction[];
  readonly axioms: readonly Axiom[];
  readonly characters: readonly Character[];
  readonly desires: readonly Desire[];
  readonly schedule: readonly ScheduleRule[];
  readonly sorts: ReadonlyArray<readonly [string, readonly string[]]>;
  readonly predictionScope: readonly Condition[];
  readonly engineRuleNames: readonly string[];
  readonly compiled: Compiled;
}

export interface ExpiryEntry {
  readonly path: CompiledPath;
  readonly due: number;
}

/** L'exécution mutable : base, vue fermée, curseur, calendrier, expirations, dé, intentions. */
export interface Runtime {
  db: Db;
  view: Db;
  cursor: number;
  scheduleDues: Map<string, number>;
  /** Clé = chemin étiqueté rendu. */
  expiries: Map<string, ExpiryEntry>;
  rngSeed: number | null;
  /** Partagée entre copies ; écrite en copie-sur-écriture. */
  intentions: ReadonlyMap<string, Intention>;
}

export function cloneRuntime(rt: Runtime): Runtime {
  return {
    db: rt.db,
    view: rt.view,
    cursor: rt.cursor,
    scheduleDues: new Map(rt.scheduleDues),
    expiries: new Map(rt.expiries),
    rngSeed: rt.rngSeed,
    intentions: rt.intentions,
  };
}

export function setIntention(rt: Runtime, name: string, intent: Intention): void {
  const m = new Map(rt.intentions);
  m.set(name, intent);
  rt.intentions = m;
}

/** Les chances de chaque `Roll` d'un sous-arbre d'effet, dans l'ordre de parcours. */
export function rollOdds(e: Effect): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const go = (x: Effect): void => {
    if (x.t === 'roll') {
      out.push([x.num, x.den]);
      x.then.forEach(go);
    } else if (x.t === 'forEach') x.then.forEach(go);
  };
  go(e);
  return out;
}

// ---- horloge ----------------------------------------------------------------

/** La valeur de l'horloge : l'unique enfant `turn` de la base. */
export function currentTurnOf(db: Db): number {
  const ks = childKeys(db, ['turn']);
  if (ks.length !== 1) throw new Error(`Prax.Engine.currentTurn : une seule valeur « turn » attendue, trouvé ${JSON.stringify(ks)}`);
  const n = ks[0];
  if (!/^-?[0-9]+$/.test(n) && !/^\+?[0-9]+$/.test(n)) throw new Error(`Prax.Engine.currentTurn : la valeur « turn » ${JSON.stringify(n)} n'est pas numérique`);
  return Number(n);
}

// ---- routeur de la vue ------------------------------------------------------

export function reclose(compiled: Compiled, rt: Runtime): void {
  const r = close(compiled.rules, rt.db);
  rt.view = isContradiction(r) ? insert(rt.db, tokenize('contradiction')) : r;
}

function applyGrow(compiled: Compiled, rt: Runtime, path: CompiledPath): void {
  const r = closeFrom(compiled.rules, rt.view, [path]);
  rt.db = insert(rt.db, path);
  if (isContradiction(r)) reclose(compiled, rt);
  else rt.view = r;
}

export function relevantNames(names: readonly string[], shadows: ReadonlyArray<readonly string[]>, footprint: ReadonlyArray<readonly string[]>): boolean {
  for (const fp of footprint) if (mayUnifySyms(names, fp)) return true;
  for (const s of shadows) for (const fp of footprint) if (mayUnifySyms(s, fp)) return true;
  return false;
}

export function monotoneToks(path: CompiledPath, contMonotone: boolean, negFootprint: ReadonlyArray<readonly string[]>): boolean {
  return contMonotone && path.excl === 0 && !negFootprint.some((nf) => mayUnifySyms(path.segs, nf));
}

function isPrefix(needle: readonly string[], hay: readonly string[]): boolean {
  if (needle.length > hay.length) return false;
  for (let i = 0; i < needle.length; i++) if (needle[i] !== hay[i]) return false;
  return true;
}

// ---- exécution d'un effet ----------------------------------------------------

/** Applique un effet déjà fondé (cas par cas avec `performCooked`). */
export function performEffect(defs: Defs, rt: Runtime, e: Effect): void {
  const compiled = defs.compiled;
  switch (e.t) {
    case 'delete': {
      const names = e.p.segs;
      for (const [k, v] of rt.expiries) if (isPrefix(names, v.path.segs)) rt.expiries.delete(k);
      const shadows = evictionShadowNames(e.p);
      if (relevantNames(names, shadows, compiled.footprint)) {
        rt.db = retract(rt.db, names);
        reclose(compiled, rt);
      } else {
        rt.db = retract(rt.db, names);
        rt.view = retract(rt.view, names);
      }
      return;
    }
    case 'insert': {
      const path = e.p;
      rt.expiries.delete(renderPath(path));
      const names = path.segs;
      const spawn = spawnedInstance(defs, rt.db, names);
      const shadows = evictionShadowNames(path);
      if (!relevantNames(names, shadows, compiled.footprint)) {
        rt.db = insert(rt.db, path);
        rt.view = insert(rt.view, path);
      } else if (monotoneToks(path, compiled.contMonotone, compiled.negFootprint)) {
        applyGrow(compiled, rt, path);
      } else {
        rt.db = insert(rt.db, path);
        reclose(compiled, rt);
      }
      if (spawn !== null) {
        const roleB: Bindings = new Map(spawn.roleBindings);
        const inits = (compiled.practices.get(spawn.pid) as { inits: readonly Effect[] }).inits;
        for (const init of inits) performEffect(defs, rt, groundEffect(init, roleB));
      }
      return;
    }
    case 'insertFor': {
      performEffect(defs, rt, { t: 'insert', p: e.p });
      const due = currentTurnOf(rt.db) + e.n;
      rt.expiries.set(renderPath(e.p), { path: e.p, due });
      return;
    }
    case 'call': {
      const f = compiled.fns.get(e.fn);
      if (f === undefined) return;
      const paramB: Bindings = new Map();
      const n = Math.min(f.params.length, e.args.length);
      for (let i = 0; i < n; i++) paramB.set(f.params[i], e.args[i]);
      for (const [conds, outs] of f.cases) {
        const res = query(rt.db, conds, paramB);
        if (res.length > 0) {
          for (const out of outs) performEffect(defs, rt, groundEffect(out, res[0]));
          return;
        }
      }
      return;
    }
    case 'forEach':
      performForEach(defs, rt, e.when, e.then);
      return;
    case 'roll': {
      if (rt.rngSeed === null) throw new Error('Prax.Engine : Roll exécuté sur un dé non semé (un tirage dans un monde qui n’a jamais appelé seedDie)');
      const advanced = rollStep(rt.rngSeed);
      rt.rngSeed = advanced;
      if (advanced % e.den < e.num) performForEach(defs, rt, e.when, e.then);
      return;
    }
  }
}

/** Corps d'un ForEach/Roll : instantané de TOUTES les liaisons sur la VUE, puis application. */
function performForEach(defs: Defs, rt: Runtime, conds: readonly Cond[], effs: readonly Effect[]): void {
  const bindings = query(rt.view, conds, new Map());
  for (const b of bindings) for (const e of effs) performEffect(defs, rt, groundEffect(e, b));
}

/** Une frontière de tour : horloge, expirations dues, puis règles dues (ordre de déclaration). */
export function roundBoundaryImpl(defs: Defs, rt: Runtime): void {
  const now = currentTurnOf(rt.db) + 1;
  performEffect(defs, rt, { t: 'insert', p: tokenize(`turn!${now}`) });
  const due: Array<[string, CompiledPath]> = [];
  for (const [k, v] of rt.expiries) if (v.due <= now) due.push([k, v.path]);
  for (const [k] of due) rt.expiries.delete(k);
  const ordered = stableSort(due, (a, b) => cmpStr(a[0], b[0]));
  for (const [, path] of ordered) {
    if (exists(rt.db, path.segs)) performEffect(defs, rt, { t: 'delete', p: path });
  }
  for (const rule of defs.compiled.schedule) {
    const d = rt.scheduleDues.get(rule.name);
    if (d === undefined || d > now) continue;
    const src = defs.schedule.find((r) => r.name === rule.name);
    if (src === undefined) throw new Error(`Prax.Engine.roundBoundary : aucune règle ${JSON.stringify(rule.name)}`);
    for (const [conds, effs] of rule.body) performForEach(defs, rt, conds, effs);
    rt.scheduleDues.set(rule.name, now + src.period);
  }
}

interface SpawnInfo {
  pid: string;
  roleBindings: Array<[string, string]>;
}

/** Si l'insertion fait naître une instance de pratique, ses liaisons de rôles. */
function spawnedInstance(defs: Defs, baseDb: Db, names: readonly string[]): SpawnInfo | null {
  if (names.length < 2 || names[0] !== 'practice') return null;
  const pid = names[1];
  const def = defs.practices.get(pid);
  if (def === undefined || !defs.compiled.practices.has(pid)) return null;
  const numRoles = def.roles.length;
  const rest = names.slice(2);
  if (rest.length < numRoles) return null;
  const roleVals = rest.slice(0, numRoles);
  if (exists(baseDb, ['practice', pid, ...roleVals])) return null;
  return { pid, roleBindings: def.roles.map((r, i) => [r, roleVals[i]] as [string, string]) };
}

/** Chaque affordance qu'un acteur peut exécuter, évaluée sur la VUE. */
export function possibleActionsImpl(defs: Defs, view: Db, actor: string): GroundedAction[] {
  const pids = childKeys(view, ['practice']);
  const out: GroundedAction[] = [];
  for (const pid of pids) {
    const cp = defs.compiled.practices.get(pid);
    if (cp === undefined) continue;
    const seed: Bindings = new Map([['Actor', actor]]);
    for (const inst of unify(view, cp.instanceNames, seed)) {
      const instanceId = groundNames(inst, cp.instanceNames).join('.');
      for (const ca of cp.actions) {
        for (const binding of query(view, ca.conds, inst)) {
          out.push({ practiceId: pid, instanceId, actionId: ca.name, bindings: binding, label: renderText(ca.name, binding) });
        }
      }
    }
  }
  return out;
}

/** Applique les effets d'une action fondée sur une exécution (la primitive du planificateur). */
export function performActionOn(defs: Defs, rt: Runtime, ga: GroundedAction): void {
  const cp = defs.compiled.practices.get(ga.practiceId);
  if (cp === undefined) return;
  const ca = cp.actions.find((a) => a.name === ga.actionId);
  if (ca === undefined) return;
  for (const out of ca.outs) performEffect(defs, rt, groundEffect(out, ga.bindings));
}

/** Substitue les `[Var]` d'un gabarit ; les inconnus restent tels quels. */
export function renderText(template: string, b: Bindings): string {
  let out = '';
  let rest = template;
  for (;;) {
    const open = rest.indexOf('[');
    if (open < 0) break;
    out += rest.slice(0, open);
    const after = rest.slice(open + 1);
    const closeIx = after.indexOf(']');
    if (closeIx < 0) {
      out += '[';
      rest = after;
      continue;
    }
    const name = after.slice(0, closeIx);
    const v = b.get(name);
    out += v === undefined ? `[${name}]` : valToString(v);
    rest = after.slice(closeIx + 1);
  }
  return out + rest;
}

// ---- ancres de delta d'une action fondée (le cône de réutilisation v34) --------

type Names = readonly string[];

/**
 * Les familles d'ancres qu'une action fondée peut toucher ; `null` quand ses
 * effets ne peuvent pas être bornés (le planificateur traite cela comme opaque).
 */
export function groundedDeltaAnchors(defs: Defs, ga: GroundedAction): Names[] | null {
  const cp = defs.compiled.practices.get(ga.practiceId);
  if (cp === undefined) return null;
  const ca = cp.actions.find((a) => a.name === ga.actionId);
  if (ca === undefined) return null;
  const grounded = ca.outs.map((o) => groundEffect(o, ga.bindings));
  return deltaGoAll(defs, [], new Set(), grounded);
}

function deltaGoAll(defs: Defs, visited: readonly string[], safe: ReadonlySet<string>, outs: readonly Effect[]): Names[] | null {
  const all: Names[] = [];
  for (const o of outs) {
    const r = deltaGo(defs, visited, safe, o);
    if (r === null) return null;
    all.push(...r);
  }
  return all;
}

function unanchored(names: Names): boolean {
  return names.every((s) => isVariableName(s));
}

function mightSpawn(safe: ReadonlySet<string>, names: Names): boolean {
  if (names.length === 0) return false;
  const n = names[0];
  return isVariableName(n) ? !safe.has(n) : n === 'practice';
}

function safeBinders(conds: readonly Cond[]): Set<string> {
  const deep = new Set<string>();
  const first = new Set<string>();
  for (const c of conds) {
    if (c.t !== 'match') continue;
    c.segs.forEach((v, i) => {
      if (i > 0 && isVariableName(v)) deep.add(v);
    });
    if (c.segs.length > 0 && isVariableName(c.segs[0])) first.add(c.segs[0]);
  }
  const out = new Set<string>();
  for (const v of deep) if (!first.has(v)) out.add(v);
  return out;
}

function deltaGo(defs: Defs, visited: readonly string[], safe: ReadonlySet<string>, o: Effect): Names[] | null {
  switch (o.t) {
    case 'insert': {
      const names = o.p.segs;
      if (mightSpawn(safe, names) || unanchored(names)) return null;
      return [names, ...evictionShadowNames(o.p)];
    }
    case 'insertFor':
      return deltaGo(defs, visited, safe, { t: 'insert', p: o.p });
    case 'delete': {
      const names = o.p.segs;
      if (unanchored(names)) return null;
      return [names, ...evictionShadowNames(o.p)];
    }
    case 'forEach':
    case 'roll': {
      const safe2 = new Set(safe);
      for (const v of safeBinders(o.when)) safe2.add(v);
      return deltaGoAll(defs, visited, safe2, o.then);
    }
    case 'call': {
      if (visited.includes(o.fn)) return [];
      const f = defs.compiled.fns.get(o.fn);
      if (f === undefined) return null;
      const b: Bindings = new Map();
      const n = Math.min(f.params.length, o.args.length);
      for (let i = 0; i < n; i++) b.set(f.params[i], o.args[i]);
      const vv = [...visited, o.fn];
      const all: Names[] = [];
      for (const [, os] of f.cases) {
        const grounded = os.map((e) => groundEffect(e, b));
        const r = deltaGoAll(defs, vv, new Set(), grounded);
        if (r === null) return null;
        all.push(...r);
      }
      return all;
    }
  }
}
