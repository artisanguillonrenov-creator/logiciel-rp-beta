/**
 * La surface d'écriture d'un monde : effets (`Outcome`), pratiques sociales,
 * actions, fonctions, règles de calendrier, axiomes, envies, désirs,
 * personnages — plus les parcours d'hygiène des variables (v40) et la
 * primitive de renommage.
 *
 * Reprend `prax-core/src/types.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from './errors';
import { segmentNamesChecked } from './path';
import { Condition, condSents, flatConditionVars } from './query';
import { isVariableName } from './util';

// ---- le langage des effets -------------------------------------------------

export type Outcome =
  | { readonly t: 'insert'; readonly s: string }
  | { readonly t: 'delete'; readonly s: string }
  /** Insertion qui EXPIRE `n` frontières de tour après (v44). */
  | { readonly t: 'insertFor'; readonly n: number; readonly s: string }
  | { readonly t: 'call'; readonly fn: string; readonly args: readonly string[] }
  /** Effet quantifié : pour CHAQUE liaison de la garde (instantané sur la vue), appliquer. */
  | { readonly t: 'forEach'; readonly when: readonly Condition[]; readonly then: readonly Outcome[] }
  /** Le dé dramatique (v50) — construit seulement par `draw`. */
  | { readonly t: 'roll'; readonly num: number; readonly den: number; readonly when: readonly Condition[]; readonly then: readonly Outcome[] };

export const insert = (s: string): Outcome => ({ t: 'insert', s });
export const del = (s: string): Outcome => ({ t: 'delete', s });
export const insertFor = (n: number, s: string): Outcome => ({ t: 'insertFor', n, s });
export const call = (fn: string, args: readonly string[]): Outcome => ({ t: 'call', fn, args });
export const forEach = (when: readonly Condition[], then: readonly Outcome[]): Outcome => ({ t: 'forEach', when, then });

// ---- pratiques / actions ------------------------------------------------------

/** Une affordance : une suite d'effets nommée et conditionnée. */
export interface Action {
  /** Gabarit d'affichage ; c'est aussi l'identifiant de l'action. */
  readonly name: string;
  readonly when: readonly Condition[];
  readonly then: readonly Outcome[];
}

export function action(name: string, when: readonly Condition[] = [], then: readonly Outcome[] = []): Action {
  return { name, when, then };
}

/** Une pratique sociale : un ensemble d'affordances paramétré par des rôles. */
export interface Practice {
  readonly id: string;
  readonly name: string;
  readonly roles: readonly string[];
  readonly actions: readonly Action[];
  /** Faits statiques, insérés sous `practiceData.<id>.`. */
  readonly dataFacts: readonly string[];
  /** Exécutés une fois, à la naissance d'une instance. */
  readonly initOutcomes: readonly Outcome[];
}

export function practice(
  id: string,
  opts: { name?: string; roles?: readonly string[]; actions?: readonly Action[]; dataFacts?: readonly string[]; init?: readonly Outcome[] } = {},
): Practice {
  return {
    id,
    name: opts.name ?? '',
    roles: opts.roles ?? [],
    actions: opts.actions ?? [],
    dataFacts: opts.dataFacts ?? [],
    initOutcomes: opts.init ?? [],
  };
}

// ---- fonctions ---------------------------------------------------------------

export interface FnCase {
  readonly conditions: readonly Condition[];
  readonly outcomes: readonly Outcome[];
}

/** Une fonction nommée : des cas gardés ; le premier cas vrai s'exécute. */
export interface PraxFunction {
  readonly name: string;
  readonly params: readonly string[];
  readonly cases: readonly FnCase[];
}

export function fn(name: string, params: readonly string[], cases: ReadonlyArray<readonly [readonly Condition[], readonly Outcome[]]>): PraxFunction {
  return { name, params, cases: cases.map(([conditions, outcomes]) => ({ conditions, outcomes })) };
}

// ---- règles de calendrier ------------------------------------------------------

/** Une règle récurrente (v44) : toutes les `period` frontières de tour. */
export interface ScheduleRule {
  readonly name: string;
  readonly period: number;
  readonly body: ReadonlyArray<readonly [readonly Condition[], readonly Outcome[]]>;
}

export function scheduleRule(name: string, period: number, body: ReadonlyArray<readonly [readonly Condition[], readonly Outcome[]]> = []): ScheduleRule {
  return { name, period, body };
}

// ---- axiomes / envies / désirs / personnages --------------------------------------

export interface Axiom {
  readonly when: readonly Condition[];
  readonly then: readonly string[];
}

export function axiom(when: readonly Condition[], then: readonly string[]): Axiom {
  return { when, then };
}

/** Une envie : chaque instanciation satisfaisante ajoute `utility` au monde imaginé. */
export interface Want {
  readonly when: readonly Condition[];
  readonly utility: number;
}

export function want(when: readonly Condition[], utility: number): Want {
  return { when, utility };
}

/** Un désir nommé (envie templée par la variable réservée `Owner`). */
export interface Desire {
  readonly name: string;
  readonly want: Want;
}

export function desire(name: string, w: Want): Desire {
  return { name, want: w };
}

/** La mort (et l'éviction) se notent par le fait `dead.<nom>`. */
export function deadSentence(name: string): string {
  return `dead.${name}`;
}

/** Un personnage / agent. */
export interface Character {
  readonly name: string;
  readonly wants: readonly Want[];
  /** Noms des désirs du vocabulaire que ce personnage porte. */
  readonly desires: readonly string[];
  /** Restreint les actions à cette pratique. */
  readonly boundTo: string | null;
}

export function character(name: string, opts: { wants?: readonly Want[]; desires?: readonly string[]; boundTo?: string | null } = {}): Character {
  return { name, wants: opts.wants ?? [], desires: opts.desires ?? [], boundTo: opts.boundTo ?? null };
}

export function withWant(c: Character, w: Want): Character {
  return { ...c, wants: [...c.wants, w] };
}

export function holds(c: Character, d: string): Character {
  return { ...c, desires: [...c.desires, d] };
}

export function boundTo(c: Character, pid: string): Character {
  return { ...c, boundTo: pid };
}

// ---- renommage ------------------------------------------------------------------

export type Subst = ReadonlyMap<string, string>;

function sub(subst: Subst, name: string): string {
  return subst.get(name) ?? name;
}

function renameSentence(subst: Subst, s: string): string {
  const trimmed = s.trim();
  if (trimmed.length === 0) return '';
  let out = '';
  let seg = '';
  for (const ch of trimmed) {
    if (ch === '.' || ch === '!') {
      out += sub(subst, seg) + ch;
      seg = '';
    } else seg += ch;
  }
  return out + sub(subst, seg);
}

function renameCond(subst: Subst, c: Condition): Condition {
  switch (c.t) {
    case 'match':
      return { t: 'match', s: renameSentence(subst, c.s) };
    case 'not':
      return { t: 'not', s: renameSentence(subst, c.s) };
    case 'eq':
      return { t: 'eq', a: sub(subst, c.a), b: sub(subst, c.b) };
    case 'neq':
      return { t: 'neq', a: sub(subst, c.a), b: sub(subst, c.b) };
    case 'cmp':
      return { t: 'cmp', op: c.op, a: sub(subst, c.a), b: sub(subst, c.b) };
    case 'calc':
      return { t: 'calc', r: sub(subst, c.r), op: c.op, a: sub(subst, c.a), b: sub(subst, c.b) };
    case 'count':
      return { t: 'count', r: sub(subst, c.r), set: sub(subst, c.set) };
    case 'subquery':
      return { t: 'subquery', set: sub(subst, c.set), find: c.find.map((f) => sub(subst, f)), where: renameVars(subst, c.where) };
    case 'or':
      return { t: 'or', clauses: c.clauses.map((cl) => renameVars(subst, cl)) };
    case 'absent':
      return { t: 'absent', cs: renameVars(subst, c.cs) };
    case 'exists':
      return { t: 'exists', cs: renameVars(subst, c.cs) };
  }
}

/** Renomme (en préservant les opérateurs) les variables d'écriture de conditions. */
export function renameVars(subst: Subst, conds: readonly Condition[]): Condition[] {
  return conds.map((c) => renameCond(subst, c));
}

function renameOutcome(subst: Subst, o: Outcome): Outcome {
  switch (o.t) {
    case 'insert':
      return { t: 'insert', s: renameSentence(subst, o.s) };
    case 'delete':
      return { t: 'delete', s: renameSentence(subst, o.s) };
    case 'insertFor':
      return { t: 'insertFor', n: o.n, s: renameSentence(subst, o.s) };
    case 'call':
      return { t: 'call', fn: o.fn, args: o.args.map((a) => sub(subst, a)) };
    case 'forEach':
      return { t: 'forEach', when: renameVars(subst, o.when), then: renameOutcomes(subst, o.then) };
    case 'roll':
      return { t: 'roll', num: o.num, den: o.den, when: renameVars(subst, o.when), then: renameOutcomes(subst, o.then) };
  }
}

export function renameOutcomes(subst: Subst, outs: readonly Outcome[]): Outcome[] {
  return outs.map((o) => renameOutcome(subst, o));
}

// ---- parcours d'hygiène v40 ---------------------------------------------------------

/** Chaque nom qu'un effet MENTIONNE. */
export function outcomeVars(o: Outcome): string[] {
  switch (o.t) {
    case 'insert':
    case 'delete':
    case 'insertFor':
      return segmentNamesChecked(o.s);
    case 'call':
      return [...o.args];
    case 'forEach':
    case 'roll': {
      const out = flatConditionVars(o.when);
      for (const x of o.then) out.push(...outcomeVars(x));
      return out;
    }
  }
}

/** Chaque phrase brute qu'une liste d'effets mentionne. */
export function outcomeSents(outs: readonly Outcome[]): string[] {
  const out: string[] = [];
  for (const o of outs) {
    switch (o.t) {
      case 'insert':
      case 'delete':
      case 'insertFor':
        out.push(o.s);
        break;
      case 'call':
        break;
      case 'forEach':
      case 'roll':
        out.push(...condSents(o.when), ...outcomeSents(o.then));
        break;
    }
  }
  return out;
}

/** Un nom de l'espace réservé `Prax` : `Prax` suivi d'au moins un caractère. */
export function isPraxVar(s: string): boolean {
  return s.length >= 5 && s.startsWith('Prax');
}

/** Les noms interdits qu'un fragment d'auteur utilise (espace `Prax` ou liste `forbidden`). */
export function authoredVarClash(forbidden: readonly string[], conds: readonly Condition[], outs: readonly Outcome[]): string[] {
  const names = flatConditionVars(conds);
  for (const o of outs) names.push(...outcomeVars(o));
  return names.filter((v) => isVariableName(v) && (isPraxVar(v) || forbidden.includes(v)));
}

export function authoredPatClash(forbidden: readonly string[], names: readonly string[]): string[] {
  return names.filter((v) => isVariableName(v) && (isPraxVar(v) || forbidden.includes(v)));
}

/** Lève l'erreur d'hygiène de la première collision trouvée. */
export function guardClash(context: string, forbidden: readonly string[], conds: readonly Condition[], outs: readonly Outcome[], extra = ''): void {
  const v = authoredVarClash(forbidden, conds, outs)[0];
  if (v !== undefined) throw worldErrors.reservedVarClash(context, v, extra);
}
