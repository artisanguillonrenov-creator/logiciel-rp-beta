/**
 * La base de faits en logique d'exclusion : un arbre (trie) de segments dont
 * les arêtes sont `.` (multi-valuées) ou `!` (exclusion). Représentation
 * persistante par copie de chemin : cloner une base ne coûte rien, une
 * modification ne recopie que les nœuds du chemin touché — le planificateur
 * peut ainsi imaginer une action puis jeter le monde obtenu.
 *
 * Porte la sémantique `!` corrigée (les frères sont effacés, le sous-arbre de
 * l'enfant survivant est préservé) et la loi v39 du drapeau « affirmé » (aucun
 * nœud non affirmé et sans enfant ne survit).
 *
 * Reprend `prax-core/src/db.rs` (Prax, BSD-3-Clause). Adaptation : les enfants
 * sont rangés DANS L'ORDRE DES NOMS (tableaux triés), ce qui donne directement
 * l'ordre d'énumération que le contrat de déterminisme exige.
 */
import { CompiledPath, isExclAfter, tokenize } from './path';
import { cmpStr, isVariableName, sortStrings } from './util';

/** Valeur d'ensemble produite par une sous-requête (lignes de symboles). */
export class SetVal {
  constructor(readonly rows: ReadonlyArray<readonly string[]>) {}
}

/**
 * Valeur liée à une variable logique : un symbole (chaîne), un entier
 * (`number`, issu de `calc`/`count`) ou un ensemble (`SetVal`).
 */
export type Val = string | number | SetVal;

/** Rendu d'une valeur (`valToString`). */
export function valToString(v: Val): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return `<Set(${v.rows.length})>`;
}

export function valEq(a: Val, b: Val): boolean {
  if (typeof a === 'string' || typeof a === 'number') return a === b;
  if (!(b instanceof SetVal)) return false;
  if (a.rows.length !== b.rows.length) return false;
  for (let i = 0; i < a.rows.length; i++) {
    const ra = a.rows[i];
    const rb = b.rows[i];
    if (ra.length !== rb.length) return false;
    for (let j = 0; j < ra.length; j++) if (ra[j] !== rb[j]) return false;
  }
  return true;
}

/** Liaisons : variable → valeur. */
export type Bindings = Map<string, Val>;

export function emptyBindings(): Bindings {
  return new Map();
}

export function bindingsEq(a: Bindings, b: Bindings): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (w === undefined || !valEq(v, w)) return false;
  }
  return true;
}

/** Nœud du trie : exclusif ?, affirmé ?, enfants triés par nom. */
export interface DbNode {
  readonly excl: boolean;
  readonly asserted: boolean;
  readonly keys: readonly string[];
  readonly kids: readonly DbNode[];
}

export type Db = DbNode;

const EMPTY: DbNode = Object.freeze({ excl: false, asserted: false, keys: [], kids: [] }) as DbNode;

export function emptyDb(): Db {
  return EMPTY;
}

function mkNode(excl: boolean, asserted: boolean, keys: readonly string[], kids: readonly DbNode[]): DbNode {
  return { excl, asserted, keys, kids };
}

/** Recherche dichotomique : index si présent, sinon -(point d'insertion) - 1. */
export function kidIndex(keys: readonly string[], k: string): number {
  let lo = 0;
  let hi = keys.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const c = keys[mid];
    if (c === k) return mid;
    if (c < k) lo = mid + 1;
    else hi = mid - 1;
  }
  return -(lo + 1);
}

export function child(db: Db, k: string): Db | undefined {
  const i = kidIndex(db.keys, k);
  return i >= 0 ? db.kids[i] : undefined;
}

function prunable(n: DbNode): boolean {
  return !n.asserted && n.kids.length === 0;
}

function withChild(node: DbNode, k: string, c: DbNode): DbNode {
  const i = kidIndex(node.keys, k);
  if (i >= 0) {
    const kids = node.kids.slice();
    kids[i] = c;
    return mkNode(node.excl, node.asserted, node.keys, kids);
  }
  const at = -i - 1;
  const keys = node.keys.slice();
  const kids = node.kids.slice();
  keys.splice(at, 0, k);
  kids.splice(at, 0, c);
  return mkNode(node.excl, node.asserted, keys, kids);
}

function withoutChildAt(node: DbNode, i: number): DbNode {
  const keys = node.keys.slice();
  const kids = node.kids.slice();
  keys.splice(i, 1);
  kids.splice(i, 1);
  return mkNode(node.excl, node.asserted, keys, kids);
}

// ---- insertion -----------------------------------------------------------

/**
 * Insère un chemin tokenisé, avec la règle d'exclusion corrigée et le marquage
 * v39 de l'extrémité (`Prax.Db.insertToks`).
 */
export function insert(db: Db, path: CompiledPath): Db {
  return insertAt(db, path, 0);
}

function insertAt(node: DbNode, path: CompiledPath, i: number): DbNode {
  if (i === path.segs.length) {
    if (node.asserted) return node;
    return mkNode(node.excl, true, node.keys, node.kids);
  }
  const n = path.segs[i];
  const childExcl = isExclAfter(path, i);
  const idx = kidIndex(node.keys, n);
  let base: DbNode;
  if (idx >= 0) {
    const c = node.kids[idx];
    let keys = c.keys;
    let kids = c.kids;
    if (childExcl && i + 1 < path.segs.length) {
      const next = path.segs[i + 1];
      const j = kidIndex(keys, next);
      if (j >= 0) {
        if (keys.length !== 1) {
          keys = [keys[j]];
          kids = [kids[j]];
        }
      } else if (keys.length !== 0) {
        keys = [];
        kids = [];
      }
    }
    base = keys === c.keys && c.excl === childExcl ? c : mkNode(childExcl, c.asserted, keys, kids);
  } else {
    base = mkNode(childExcl, false, [], []);
  }
  const newChild = insertAt(base, path, i + 1);
  return withChild(node, n, newChild);
}

/** Insère une phrase (commodité de la frontière d'écriture). */
export function insertStr(db: Db, sentence: string): Db {
  return insert(db, tokenize(sentence));
}

// ---- rencontre (meet) d'une tête dérivée -----------------------------------

/** Le sous-arbre de la tête à partir du segment j (chaîne nue, seule la feuille affirmée). */
function headSubchain(head: CompiledPath, j: number): DbNode {
  const n = head.segs.length;
  let node = mkNode(isExclAfter(head, n - 1), true, [], []);
  for (let k = n - 2; k >= j; k--) {
    node = mkNode(isExclAfter(head, k), false, [head.segs[k + 1]], [node]);
  }
  return node;
}

/**
 * Rencontre (⊓) d'UNE tête fondée avec le modèle. `null` = ⊥ (un nœud exclusif
 * se retrouve avec plus d'un enfant).
 */
export function metOne(db: Db, head: CompiledPath): Db | null {
  const seg = head.segs[0];
  const i = kidIndex(db.keys, seg);
  if (i >= 0) {
    const c = meetNode(db.kids[i], head, 0);
    if (c === null) return null;
    return withChild(db, seg, c);
  }
  return withChild(db, seg, headSubchain(head, 0));
}

function meetNode(node: DbNode, head: CompiledPath, i: number): DbNode | null {
  const excl = node.excl || isExclAfter(head, i);
  const leaf = i + 1 === head.segs.length;
  let keys = node.keys;
  let kids = node.kids;
  let asserted = node.asserted;
  if (leaf) {
    asserted = true;
  } else {
    const seg1 = head.segs[i + 1];
    const j = kidIndex(keys, seg1);
    if (j >= 0) {
      const c = meetNode(kids[j], head, i + 1);
      if (c === null) return null;
      const k2 = kids.slice();
      k2[j] = c;
      kids = k2;
    } else {
      const at = -j - 1;
      const keys2 = keys.slice();
      const kids2 = kids.slice();
      keys2.splice(at, 0, seg1);
      kids2.splice(at, 0, headSubchain(head, i + 1));
      keys = keys2;
      kids = kids2;
    }
  }
  if (excl && keys.length > 1) return null;
  return mkNode(excl, asserted, keys, kids);
}

// ---- retrait ---------------------------------------------------------------

/**
 * Retire le sous-arbre nommé (les opérateurs n'ont pas d'importance), puis
 * élague chaque ancêtre laissé non affirmé et sans enfant (`retractNames`).
 */
export function retract(db: Db, names: readonly string[]): Db {
  return retractAt(db, names, 0);
}

function retractAt(node: DbNode, names: readonly string[], i: number): DbNode {
  if (i === names.length) return node;
  const n = names[i];
  const idx = kidIndex(node.keys, n);
  if (i === names.length - 1) {
    if (idx < 0) return node;
    return withoutChildAt(node, idx);
  }
  if (idx < 0) return node;
  const c2 = retractAt(node.kids[idx], names, i + 1);
  if (c2 === node.kids[idx]) return node;
  if (prunable(c2)) return withoutChildAt(node, idx);
  const kids = node.kids.slice();
  kids[idx] = c2;
  return mkNode(node.excl, node.asserted, node.keys, kids);
}

export function retractStr(db: Db, sentence: string): Db {
  return retract(db, tokenize(sentence).segs);
}

// ---- unification -------------------------------------------------------------

/**
 * Cœur de l'unification : descend le trie selon le motif, en enrichissant les
 * liaisons. Une variable non liée branche sur tous les enfants DANS L'ORDRE
 * DES NOMS. Ajoute chaque extension cohérente à `out`.
 */
export function unifyInto(db: Db, segs: readonly string[], seed: Bindings, out: Bindings[]): void {
  const b = new Map(seed);
  unifyDfs(db, segs, 0, b, out);
}

function unifyDfs(node: DbNode, segs: readonly string[], i: number, b: Bindings, out: Bindings[]): void {
  if (i === segs.length) {
    out.push(new Map(b));
    return;
  }
  const sym = segs[i];
  if (isVariableName(sym)) {
    const v = b.get(sym);
    if (v !== undefined) {
      const sub = child(node, valToString(v));
      if (sub !== undefined) unifyDfs(sub, segs, i + 1, b, out);
    } else {
      const keys = node.keys;
      const kids = node.kids;
      for (let k = 0; k < keys.length; k++) {
        b.set(sym, keys[k]);
        unifyDfs(kids[k], segs, i + 1, b, out);
      }
      b.delete(sym);
    }
  } else {
    const sub = child(node, sym);
    if (sub !== undefined) unifyDfs(sub, segs, i + 1, b, out);
  }
}

export function unify(db: Db, segs: readonly string[], seed: Bindings): Bindings[] {
  const out: Bindings[] = [];
  unifyInto(db, segs, seed, out);
  return out;
}

/** Existe-t-il au moins une solution (test rapide sans matérialiser les liaisons) ? */
export function unifiable(db: Db, segs: readonly string[], b: Bindings): boolean {
  return anyDfs(db, segs, 0, b);
}

function anyDfs(node: DbNode, segs: readonly string[], i: number, b: Bindings): boolean {
  if (i === segs.length) return true;
  const sym = segs[i];
  if (isVariableName(sym)) {
    const v = b.get(sym);
    if (v !== undefined) {
      const sub = child(node, valToString(v));
      return sub !== undefined && anyDfs(sub, segs, i + 1, b);
    }
    // Une variable non liée lie un enfant quelconque ; si elle réapparaît plus
    // loin, il faut la lier pour de bon.
    let later = false;
    for (let j = i + 1; j < segs.length; j++) if (segs[j] === sym) later = true;
    if (!later) {
      for (const k of node.kids) if (anyDfs(k, segs, i + 1, b)) return true;
      return false;
    }
    for (let k = 0; k < node.keys.length; k++) {
      b.set(sym, node.keys[k]);
      const ok = anyDfs(node.kids[k], segs, i + 1, b);
      b.delete(sym);
      if (ok) return true;
    }
    return false;
  }
  const sub = child(node, sym);
  return sub !== undefined && anyDfs(sub, segs, i + 1, b);
}

/** Un nœud existe-t-il à ce chemin ? (`Prax.Db.exists`) */
export function exists(db: Db, segs: readonly string[]): boolean {
  return unifiable(db, segs, new Map());
}

export function existsStr(db: Db, sentence: string): boolean {
  return exists(db, tokenize(sentence).segs);
}

/** Les clés directement sous le nœud d'un chemin constant, triées par nom. */
export function childKeys(db: Db, segs: readonly string[]): string[] {
  let cur: DbNode | undefined = db;
  for (const n of segs) {
    cur = child(cur, n);
    if (cur === undefined) return [];
  }
  return cur.keys.slice();
}

// ---- énumération ---------------------------------------------------------------

/** Les faits, triés, joints par `.` (`dbToSentences`). */
export function toSentences(db: Db): string[] {
  const out: string[] = [];
  collectSentences(db, '', out);
  return sortStrings(out);
}

function collectSentences(node: DbNode, prefix: string, out: string[]): void {
  for (let i = 0; i < node.keys.length; i++) {
    const name = prefix + node.keys[i];
    const c = node.kids[i];
    if (c.kids.length === 0) out.push(name);
    else {
      if (c.asserted) out.push(name);
      collectSentences(c, name + '.', out);
    }
  }
}

/** Les faits avec leurs étiquettes `!`/`.` exactes, triés (`dbToLabeledSentences`). */
export function toLabeledSentences(db: Db): string[] {
  const out: string[] = [];
  collectLabeled(db, '', out);
  return sortStrings(out);
}

function collectLabeled(node: DbNode, prefix: string, out: string[]): void {
  for (let i = 0; i < node.keys.length; i++) {
    const name = prefix + node.keys[i];
    const c = node.kids[i];
    if (c.kids.length === 0) out.push(name);
    else {
      collectLabeled(c, name + (c.excl ? '!' : '.'), out);
      if (c.asserted) out.push(name);
    }
  }
}

/** Égalité structurelle de deux bases. */
export function dbEq(a: Db, b: Db): boolean {
  if (a === b) return true;
  if (a.excl !== b.excl || a.asserted !== b.asserted || a.keys.length !== b.keys.length) return false;
  for (let i = 0; i < a.keys.length; i++) {
    if (a.keys[i] !== b.keys[i]) return false;
    if (!dbEq(a.kids[i], b.kids[i])) return false;
  }
  return true;
}

// ---- fondation (grounding) -------------------------------------------------------

/**
 * Substitue les valeurs liées aux segments variables d'un chemin (le masque
 * d'exclusion est conservé). Une variable non liée reste son propre nom.
 */
export function groundTokens(path: CompiledPath, b: Bindings): CompiledPath {
  let changed = false;
  const segs = path.segs.map((s) => {
    if (!isVariableName(s)) return s;
    const v = b.get(s);
    if (v === undefined) return s;
    changed = true;
    return valToString(v);
  });
  return changed ? { segs, excl: path.excl } : path;
}

/** Comme `groundTokens`, rendu en phrase étiquetée (`Prax.Db.ground`). */
export function ground(path: CompiledPath, b: Bindings): string {
  const g = groundTokens(path, b);
  const n = g.segs.length;
  let out = '';
  for (let i = 0; i < n; i++) {
    out += g.segs[i];
    if (i + 1 < n) out += isExclAfter(g, i) ? '!' : '.';
  }
  return out;
}

export { cmpStr };
