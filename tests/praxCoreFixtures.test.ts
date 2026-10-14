/**
 * Portage TypeScript du rejeu des jeux d'essai unitaires de Prax (Rust, BSD-3-Clause) :
 *   - conformance/src/fixtures.rs (module `replay`).
 *
 * Chaque entrée enregistrée (`tests/fixtures/prax/{db,el,query,derive,kin,div1}.json`,
 * copies à l'identique de `conformance/fixtures/`) est recalculée par notre moteur et
 * comparée octet pour octet à la sortie enregistrée du Haskell gelé.
 *
 * Les conditions des jeux `query`/`derive`/`kin`/`div1` sont sérialisées au format
 * Haskell `show` (ex. `Subquery {subSet = "S", subFind = ["W"], subWhere = [...]}`) :
 * le petit lecteur à descente récursive de fixtures.rs (`Reader`) est porté ci-dessous.
 *
 * Lancer avec PRAX_RACINE=<racine du dépôt> quand la compilation sort hors du dépôt.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  Bindings,
  Db,
  SetVal,
  Val,
  emptyDb,
  existsStr,
  ground,
  insertStr,
  retractStr,
  toLabeledSentences,
  toSentences,
  unify,
  valToString,
} from '../src/prax/core/db';
import { CompiledRule, close, compileRule, isContradiction, naiveClosure } from '../src/prax/core/derive';
import { leq, meet } from '../src/prax/core/el';
import { tokenize } from '../src/prax/core/path';
import {
  CalcOp,
  CmpOp,
  Cond,
  Condition,
  absent,
  calc,
  cmp,
  compileCondition,
  count,
  eq,
  exists,
  matches,
  neq,
  not_,
  or_,
  query,
  subquery,
} from '../src/prax/core/query';

const RACINE = process.env.PRAX_RACINE ?? join(__dirname, '..', '..');
const DOSSIER = join(RACINE, 'tests', 'fixtures', 'prax');

// ---- aides (fixtures.rs `load`, `strs`, `build`, `binding_map`, `json_binding`) ----

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type JsonObj = { [k: string]: Json };

function load(name: string): JsonObj {
  return JSON.parse(readFileSync(join(DOSSIER, name), 'utf8')) as JsonObj;
}

function arr(v: Json | undefined): Json[] {
  assert.ok(Array.isArray(v), 'expected a JSON array');
  return v;
}

function obj(v: Json | undefined): JsonObj {
  assert.ok(v !== null && typeof v === 'object' && !Array.isArray(v), 'expected a JSON object');
  return v;
}

function str(v: Json | undefined): string {
  assert.equal(typeof v, 'string', 'expected a string');
  return v as string;
}

function strs(v: Json | undefined): string[] {
  return arr(v).map(str);
}

function build(facts: readonly string[]): Db {
  let db = emptyDb();
  for (const f of facts) db = insertStr(db, f);
  return db;
}

/** Rust `binding_map` : une liaison rendue en table nom → valeur (l'ordre des clés n'importe pas). */
function bindingMap(b: Bindings): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of b) out[k] = valToString(v);
  return out;
}

/** Rust `json_binding`. */
function jsonBinding(v: Json): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(obj(v))) out[k] = str(val);
  return out;
}

// =============================================================================
// Lecteur des conditions au format Haskell `show` (fixtures.rs `Reader`)
// =============================================================================

/**
 * Lecteur à descente récursive : `Match "a.B"`, `Cmp Gt "X" "4"`, `Calc "R" Add "A" "1"`,
 * `Subquery {subSet = .., subFind = [..], subWhere = [..]}`, `Or [[..],[..]]`,
 * `Absent [..]`, `Exists [..]`, `Count "N" "S"`, `Eq`/`Neq`/`Not`. Les opérandes ne
 * contiennent jamais de guillemets : un littéral est `"` … `"` sans échappement.
 * Chaque méthode renvoie `null` en cas d'échec (Rust `Option`).
 */
class Reader {
  pos = 0;
  constructor(readonly text: string) {}

  skipWs(): void {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) this.pos++;
  }

  peek(): string | null {
    this.skipWs();
    return this.pos < this.text.length ? this.text[this.pos] : null;
  }

  eat(tok: string): boolean {
    this.skipWs();
    if (this.text.startsWith(tok, this.pos)) {
      this.pos += tok.length;
      return true;
    }
    return false;
  }

  expect(tok: string): true | null {
    return this.eat(tok) ? true : null;
  }

  /** Une chaîne entre guillemets (pas d'échappement dans le corpus). */
  string(): string | null {
    this.skipWs();
    if (this.text[this.pos] !== '"') return null;
    this.pos++;
    const start = this.pos;
    while (this.pos < this.text.length && this.text[this.pos] !== '"') this.pos++;
    const s = this.text.slice(start, this.pos);
    this.pos++; // guillemet fermant
    return s;
  }

  /** Un identifiant nu (constructeur / opérateur). */
  ident(): string | null {
    this.skipWs();
    const start = this.pos;
    while (this.pos < this.text.length && /[A-Za-z0-9_]/.test(this.text[this.pos])) this.pos++;
    return this.pos === start ? null : this.text.slice(start, this.pos);
  }

  /** Une liste `["a", "b", ...]` de chaînes. */
  stringList(): string[] | null {
    if (this.expect('[') === null) return null;
    const out: string[] = [];
    if (this.peek() === ']') {
      this.expect(']');
      return out;
    }
    for (;;) {
      const s = this.string();
      if (s === null) return null;
      out.push(s);
      if (this.eat(',')) continue;
      break;
    }
    return this.expect(']') === null ? null : out;
  }

  /** Une liste `[cond, cond, ...]` de conditions. */
  condList(): Condition[] | null {
    if (this.expect('[') === null) return null;
    const out: Condition[] = [];
    if (this.peek() === ']') {
      this.expect(']');
      return out;
    }
    for (;;) {
      const c = this.condition();
      if (c === null) return null;
      out.push(c);
      if (this.eat(',')) continue;
      break;
    }
    return this.expect(']') === null ? null : out;
  }

  cmpOp(): CmpOp | null {
    const ops: Record<string, CmpOp> = { Lt: 'lt', Lte: 'lte', Gt: 'gt', Gte: 'gte' };
    const id = this.ident();
    return id !== null && id in ops ? ops[id] : null;
  }

  calcOp(): CalcOp | null {
    const ops: Record<string, CalcOp> = { Add: 'add', Sub: 'sub', Mul: 'mul', Mod: 'mod' };
    const id = this.ident();
    return id !== null && id in ops ? ops[id] : null;
  }

  /** Deux chaînes consécutives (arguments évalués de gauche à droite, comme en Rust). */
  twoStrings(): [string, string] | null {
    const a = this.string();
    if (a === null) return null;
    const b = this.string();
    return b === null ? null : [a, b];
  }

  condition(): Condition | null {
    this.skipWs();
    const ctor = this.ident();
    switch (ctor) {
      case 'Match': {
        const s = this.string();
        return s === null ? null : matches(s);
      }
      case 'Not': {
        const s = this.string();
        return s === null ? null : not_(s);
      }
      case 'Eq': {
        const p = this.twoStrings();
        return p === null ? null : eq(p[0], p[1]);
      }
      case 'Neq': {
        const p = this.twoStrings();
        return p === null ? null : neq(p[0], p[1]);
      }
      case 'Cmp': {
        const op = this.cmpOp();
        if (op === null) return null;
        const p = this.twoStrings();
        return p === null ? null : cmp(op, p[0], p[1]);
      }
      case 'Calc': {
        const r = this.string();
        if (r === null) return null;
        const op = this.calcOp();
        if (op === null) return null;
        const p = this.twoStrings();
        return p === null ? null : calc(r, op, p[0], p[1]);
      }
      case 'Count': {
        const p = this.twoStrings();
        return p === null ? null : count(p[0], p[1]);
      }
      case 'Subquery': {
        if (this.expect('{') === null || this.expect('subSet') === null || this.expect('=') === null) return null;
        const set = this.string();
        if (set === null) return null;
        if (this.expect(',') === null || this.expect('subFind') === null || this.expect('=') === null) return null;
        const find = this.stringList();
        if (find === null) return null;
        if (this.expect(',') === null || this.expect('subWhere') === null || this.expect('=') === null) return null;
        const where = this.condList();
        if (where === null) return null;
        if (this.expect('}') === null) return null;
        return subquery(set, find, where);
      }
      case 'Or': {
        // Or [[..],[..]] — une liste entre crochets de listes de conditions.
        if (this.expect('[') === null) return null;
        const clauses: Condition[][] = [];
        if (this.peek() === ']') {
          this.expect(']');
          return or_(clauses);
        }
        for (;;) {
          const cl = this.condList();
          if (cl === null) return null;
          clauses.push(cl);
          if (this.eat(',')) continue;
          break;
        }
        return this.expect(']') === null ? null : or_(clauses);
      }
      case 'Absent': {
        const cs = this.condList();
        return cs === null ? null : absent(cs);
      }
      case 'Exists': {
        const cs = this.condList();
        return cs === null ? null : exists(cs);
      }
      default:
        return null;
    }
  }
}

/** Rust `parse_condition` : la chaîne entière doit être consommée. */
function parseCondition(s: string): Condition | null {
  const r = new Reader(s);
  const c = r.condition();
  if (c === null) return null;
  r.skipWs();
  return r.pos === r.text.length ? c : null;
}

function parseOrDie(s: string, ctx: string): Condition {
  const c = parseCondition(s);
  assert.ok(c !== null, `parsing condition ${JSON.stringify(s)} in '${ctx}'`);
  return c;
}

// ---- le lecteur lui-même (garde du portage : il doit relire chaque forme du corpus) ----

test('fixtures.rs : le lecteur `show` relit chaque constructeur (garde du portage)', () => {
  assert.deepEqual(
    parseCondition('Subquery {subSet = "Dancers", subFind = ["Dancer"], subWhere = [Match "char.Dancer",Neq "Dancer" "Actor"]}'),
    subquery('Dancers', ['Dancer'], [matches('char.Dancer'), neq('Dancer', 'Actor')]),
  );
  assert.deepEqual(parseCondition('Or [[Match "p.X"],[Absent [Match "e.X"]]]'), or_([[matches('p.X')], [absent([matches('e.X')])]]));
  assert.deepEqual(parseCondition('Cmp Gte "N" "2"'), cmp('gte', 'N', '2'));
  assert.deepEqual(parseCondition('Calc "R" Mod "-3" "5"'), calc('R', 'mod', '-3', '5'));
  assert.deepEqual(parseCondition('Count "N" "S"'), count('N', 'S'));
  assert.deepEqual(parseCondition('Exists []'), exists([]));
  assert.equal(parseCondition('Match "a" trailing'), null, 'the whole string must be consumed');
  assert.equal(parseCondition('Bogus "a"'), null);
});

// =============================================================================
// conformance/src/fixtures.rs — module `replay`
// =============================================================================

// R: fixtures.rs db_mutations_replay
test('fixtures.rs : db.json — mutations (phrases, phrases étiquetées, existence)', () => {
  const data = load('db.json');
  const cases = arr(data.mutations);
  assert.ok(cases.length > 0);
  for (const c of cases.map(obj)) {
    const name = str(c.name);
    let db = emptyDb();
    for (const op of arr(c.ops).map(obj)) {
      const a = str(op.arg);
      const kind = str(op.op);
      if (kind === 'insert') db = insertStr(db, a);
      else if (kind === 'retract') db = retractStr(db, a);
      else assert.fail(`unknown op ${JSON.stringify(kind)} in '${name}'`);
    }
    assert.deepEqual(toSentences(db), strs(c.sentences), `sentences mismatch in '${name}'`);
    assert.deepEqual(toLabeledSentences(db), strs(c.labeled), `labeled mismatch in '${name}'`);
    for (const [path, expected] of Object.entries(obj(c.exists))) {
      assert.equal(existsStr(db, path), expected, `exists(${path}) mismatch in '${name}'`);
    }
  }
});

// R: fixtures.rs db_unify_replay
test('fixtures.rs : db.json — unification conjonctive (ordre des noms)', () => {
  const data = load('db.json');
  const cases = arr(data.unify);
  assert.ok(cases.length > 0);
  for (const c of cases.map(obj)) {
    const name = str(c.name);
    const db = build(strs(c.facts));
    let bss: Bindings[] = [new Map()];
    for (const pat of strs(c.patterns)) {
      const path = tokenize(pat);
      const next: Bindings[] = [];
      for (const b of bss) next.push(...unify(db, path.segs, b));
      bss = next;
    }
    const got = bss.map(bindingMap);
    const want = arr(c.bindings).map(jsonBinding);
    assert.deepEqual(got, want, `unify bindings mismatch in '${name}'`);
  }
});

// R: fixtures.rs db_ground_replay
test('fixtures.rs : db.json — fondation (ground)', () => {
  const data = load('db.json');
  const cases = arr(data.ground);
  assert.ok(cases.length > 0);
  for (const c of cases.map(obj)) {
    const name = str(c.name);
    const path = tokenize(str(c.pattern));
    const b: Bindings = new Map();
    for (const [v, val] of Object.entries(obj(c.binding))) {
      const raw = str(val);
      // Lier selon le VRAI genre de la valeur (S1 review M3) : le marqueur d'ensemble
      // doit exercer le rendu de SetVal (« <Set(n)> »), pas interner son texte.
      const set = /^<Set\((\d+)\)>$/.exec(raw);
      let vv: Val;
      if (set !== null) vv = new SetVal(Array.from({ length: Number(set[1]) }, () => []));
      else if (/^[+-]?\d+$/.test(raw)) vv = Number(raw);
      else vv = raw;
      b.set(v, vv);
    }
    assert.equal(ground(path, b), str(c.result), `ground mismatch in '${name}'`);
  }
});

// R: fixtures.rs el_meet_replay
test('fixtures.rs : el.json — rencontre (meet ; null = ⊥)', () => {
  const data = load('el.json');
  const cases = arr(data.meet);
  assert.ok(cases.length > 0);
  for (const c of cases.map(obj)) {
    const name = str(c.name);
    const m = meet(build(strs(c.a)), build(strs(c.b)));
    if (m === null) assert.equal(c.result, null, `expected a defined meet in '${name}'`);
    else {
      assert.notEqual(c.result, null, `expected ⊥ in '${name}'`);
      assert.deepEqual(toSentences(m), strs(c.result), `meet mismatch in '${name}'`);
    }
  }
});

// R: fixtures.rs el_leq_replay
test('fixtures.rs : el.json — ordre d’information (leq)', () => {
  const data = load('el.json');
  const cases = arr(data.leq);
  assert.ok(cases.length > 0);
  for (const c of cases.map(obj)) {
    const name = str(c.name);
    assert.equal(leq(build(strs(c.a)), build(strs(c.b))), c.result, `leq mismatch in '${name}'`);
  }
});

// R: fixtures.rs query_replay
test('fixtures.rs : query.json — conditions `show` relues, compilées, évaluées', () => {
  const data = load('query.json');
  const cases = arr(data.cases);
  assert.ok(cases.length > 0);
  for (const c of cases.map(obj)) {
    const name = str(c.name);
    const db = build(strs(c.facts));
    // La liaison de départ : des symboles (le corpus n'a pas d'initiales numériques/ensemblistes).
    const seed: Bindings = new Map();
    for (const [v, val] of Object.entries(obj(c.initial))) seed.set(v, str(val));
    const conds: Cond[] = strs(c.conds).map((s) => compileCondition(parseOrDie(s, name)));
    const got = query(db, conds, seed).map(bindingMap);
    const want = arr(c.results).map(jsonBinding);
    assert.deepEqual(got, want, `query results mismatch in '${name}'`);
  }
});

/** Rust `compile_axioms` : `when` = conditions `show`, `then` = phrases de tête. */
function compileAxioms(axioms: Json | undefined, ctx: string): CompiledRule[] {
  return arr(axioms)
    .map(obj)
    .map((ax) => compileRule(strs(ax.when).map((s) => parseOrDie(s, ctx)), strs(ax.then)));
}

/** Rust `check_closure_case` : `ok` (phrases étiquetées) ou témoin `contradiction`. */
function checkClosureCase(name: string, axioms: Json | undefined, base: Json | undefined, closure: Json | undefined): void {
  const rules = compileAxioms(axioms, name);
  const db = build(strs(base));
  const cl = obj(closure);
  const r = close(rules, db);
  if (isContradiction(r)) {
    assert.equal(cl.contradiction ?? null, r.sentence, `⊥ witness mismatch in '${name}'`);
  } else {
    assert.ok(cl.contradiction === undefined || cl.contradiction === null, `expected a ⊥ in '${name}', got a closed model`);
    assert.deepEqual(toLabeledSentences(r), strs(cl.ok), `closure mismatch in '${name}'`);
  }
}

// R: fixtures.rs derive_worlds_replay
test('fixtures.rs : derive.json — fermeture des axiomes de chaque monde livré', () => {
  const data = load('derive.json');
  const worlds = arr(data.worlds).map(obj);
  assert.ok(worlds.length > 0);
  for (const w of worlds) checkClosureCase(str(w.world), w.axioms, w.base, w.closure);
});

// R: fixtures.rs kin_recursive_closure_replay
test('fixtures.rs : kin.json — fermeture récursive des axiomes de parenté', () => {
  const data = load('kin.json');
  checkClosureCase('kin', data.axioms, data.base, data.closure);
});

// R: fixtures.rs div1_negative_fixture_rust_beats_frozen
test('fixtures.rs : div1.json — la fermeture correcte, PAS la sous-dérivation gelée (DIV-1)', () => {
  const data = load('div1.json');
  const rules = compileAxioms(data.axioms, 'div1');
  const base = build(strs(data.base));

  const closed = close(rules, base);
  assert.ok(!isContradiction(closed), 'div1 closes without ⊥');
  const got = toLabeledSentences(closed);
  const correct = strs(data.correct);
  const frozen = strs(obj(data.frozen).ok);

  // VERT : la fermeture EST le plus petit point fixe correct.
  assert.deepEqual(got, correct, 'div1: Rust must derive the CORRECT closure');
  // Artefact ROUGE : elle DIVERGE de la sortie gelée (boguée).
  assert.notDeepEqual(got, frozen, 'div1: Rust must NOT reproduce the frozen under-derivation');
  assert.ok(correct.includes('r.a') && !frozen.includes('r.a'), 'div1: the fixture must pin r.a as the exact divergence');
  // La divergence n'est pas un artefact close-vs-naïf : l'oracle naïf est d'accord.
  const naive = naiveClosure(rules, base);
  assert.ok(!isContradiction(naive), 'div1 naive closes');
  assert.deepEqual(toLabeledSentences(naive), correct, 'div1: naive == correct');
});
