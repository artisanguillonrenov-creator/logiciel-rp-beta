/**
 * Portage TypeScript des tests du cœur logique de Prax (Rust, BSD-3-Clause) :
 *   - prax-core/src/db.rs        (modules `tests` et `proptest_laws`) ;
 *   - prax-core/src/path.rs      (module `tests`) ;
 *   - prax-core/src/el.rs        (modules `tests` et `proptest_laws`) ;
 *   - prax-core/src/query.rs     (modules `tests` et `proptest_laws`) ;
 *   - prax-core/src/derive.rs    (modules `tests` et `optimization_laws`) ;
 *   - prax-core/src/interner.rs  (module `tests`, adapté : pas d'interneur en TS) ;
 *   - conformance/src/derive_props.rs et conformance/src/view_invariant.rs.
 * (Le rejeu des jeux d'essai de conformance/src/fixtures.rs est dans praxCoreFixtures.test.ts.)
 *
 * Les `proptest!` deviennent des boucles déterministes : un PRNG à graine fixe
 * (mulberry32, une graine par cas), ~200 cas par loi (PRAX_PROPTEST_CASES pour
 * changer), mêmes générateurs, mêmes lois. Un échec indique le cas et sa graine.
 *
 * Chaque test garde sa référence d'origine (`// R:` et, s'il y en a, `// H:`).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Bindings,
  Db,
  DbNode,
  SetVal,
  Val,
  bindingsEq,
  child,
  childKeys,
  dbEq,
  emptyDb,
  existsStr,
  ground,
  groundTokens,
  insert,
  insertStr,
  metOne,
  retractStr,
  toLabeledSentences,
  toSentences,
  unify,
  valToString,
} from '../src/prax/core/db';
import {
  CompiledRule,
  Contradiction,
  axiomNegPatterns,
  close,
  closeFrom,
  compileRule,
  isContradiction,
  monotoneAxioms,
  naiveClosure,
} from '../src/prax/core/derive';
import { leq, meet } from '../src/prax/core/el';
import { State } from '../src/prax/core/engine';
import { WorldError } from '../src/prax/core/errors';
import { CompiledPath, isExclAfter, renderPath, segmentNames, segmentNamesChecked, tokenize } from '../src/prax/core/path';
import {
  Cond,
  Condition,
  absent,
  calc,
  cmp,
  compileCondition,
  condSents,
  conditionVars,
  count,
  eq,
  exists,
  forAll,
  groundCondition,
  implies,
  matches,
  neq,
  not_,
  or_,
  query,
  readAnchors,
  subquery,
} from '../src/prax/core/query';
import { advance } from '../src/prax/core/turn';
import { Outcome, axiom, del as oDelete, insert as oInsert } from '../src/prax/core/types';
import { isVariableName } from '../src/prax/core/util';
import { audienceWorld } from '../src/prax/worlds/audience';
import { barDirectorWorld, barWorld } from '../src/prax/worlds/bar';
import { bigFeud, feudWorld } from '../src/prax/worlds/feud';
import { intrigueWorld } from '../src/prax/worlds/intrigue';
import { playWorld } from '../src/prax/worlds/play';
import { TEST_SCALE, vampireWorld } from '../src/prax/worlds/vampire';
import { villageWorld } from '../src/prax/worlds/village';

// =============================================================================
// Outillage commun : PRNG déterministe et boucle « proptest »
// =============================================================================

const CASES = Number(process.env.PRAX_PROPTEST_CASES ?? 200);

/** mulberry32 : petit PRNG 32 bits à graine fixe (reproductible sur tout moteur JS). */
class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Entier uniforme dans [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  /** Entier uniforme dans [lo, hi) — la plage Rust `lo..hi`. */
  range(lo: number, hi: number): number {
    return lo + this.int(hi - lo);
  }
  bool(): boolean {
    return this.next() < 0.5;
  }
  /** `any::<u8>()`. */
  u8(): number {
    return this.int(256);
  }
  /** `prop::sample::select`. */
  pick<T>(xs: readonly T[]): T {
    return xs[this.int(xs.length)];
  }
  /** `prop::collection::vec(g, lo..hi)`. */
  vec<T>(lo: number, hi: number, g: () => T): T[] {
    const n = this.range(lo, hi);
    const out: T[] = [];
    for (let i = 0; i < n; i++) out.push(g());
    return out;
  }
  /** `prop_oneof![...]` (poids égaux). */
  oneOf<T>(gs: ReadonlyArray<() => T>): T {
    return gs[this.int(gs.length)]();
  }
}

function hashName(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** Une loi `proptest!` : `cases` cas déterministes, une graine par cas (rapportée en cas d'échec). */
function property(name: string, body: (rng: Rng) => void, cases = CASES): void {
  const base = hashName(name);
  for (let i = 0; i < cases; i++) {
    const seed = (base + Math.imul(i, 0x9e3779b9)) >>> 0;
    try {
      body(new Rng(seed));
    } catch (e) {
      if (e instanceof Error) e.message = `[${name} : cas ${i}, graine ${seed}] ${e.message}`;
      throw e;
    }
  }
}

// ---- aides communes ---------------------------------------------------------------

/** `build` : une base construite par insertions de gauche à droite (`DbSpec.build`). */
function build(sentences: readonly string[]): Db {
  let db = emptyDb();
  for (const s of sentences) db = insertStr(db, s);
  return db;
}

function seed(pairs: ReadonlyArray<readonly [string, string]>): Bindings {
  return new Map<string, Val>(pairs.map(([k, v]) => [k, v]));
}

/** Une liaison rendue en paires (nom, valeur) dans l'ordre de liaison — la forme observable. */
function render(b: Bindings): Array<[string, string]> {
  return [...b].map(([k, v]) => [k, valToString(v)]);
}

/** La valeur liée à `name`, rendue. */
function look(b: Bindings, name: string): string | undefined {
  const v = b.get(name);
  return v === undefined ? undefined : valToString(v);
}

/** Égalité de listes de liaisons (Rust `Vec<Bindings> == Vec<Bindings>`). */
function assertBindingsList(got: readonly Bindings[], want: readonly Bindings[], msg?: string): void {
  assert.equal(got.length, want.length, msg ?? `expected ${want.length} binding(s), got ${got.length}`);
  got.forEach((b, i) => assert.ok(bindingsEq(b, want[i]), `${msg ?? 'bindings differ'} at #${i}: ${JSON.stringify(render(b))} vs ${JSON.stringify(render(want[i]))}`));
}

function assertTrailing(f: () => unknown, sentence: string, op: string, msg?: string): void {
  assert.throws(
    f,
    (e: unknown) => e instanceof WorldError && e.kind === 'TrailingOperator' && e.details.sentence === sentence && e.details.op === op,
    msg,
  );
}

/** Deux résultats de fermeture égaux (modèles structurellement égaux, ou même témoin ⊥). */
function closureEq(a: Db | Contradiction, b: Db | Contradiction): boolean {
  if (isContradiction(a) || isContradiction(b)) return isContradiction(a) && isContradiction(b) && a.sentence === b.sentence;
  return dbEq(a, b);
}

function showClosure(r: Db | Contradiction): string {
  return isContradiction(r) ? `⊥(${r.sentence})` : JSON.stringify(toLabeledSentences(r));
}

const m = (s: string): Condition => matches(s);
const n = (s: string): Condition => not_(s);

// =============================================================================
// prax-core/src/db.rs — module `tests`
// H: DbSpec.hs "Prax.Db"
// =============================================================================

// R: db.rs clone_is_refcount_bump_and_untouched_subtrees_stay_shared
test('db.rs : une copie partage la racine ; une insertion ne recopie que l’échine touchée', () => {
  // Adaptation : Rust `Arc::ptr_eq` -> identité `===` des nœuds de la base persistante.
  // Un `Db` TS est une valeur immuable : la « copie » observable est celle de l'état
  // que le planificateur clone pour imaginer puis jeter un monde (`State.clone`).
  const db = build(['deep.subtree.with.leaves', 'deep.subtree.other', 'elsewhere.branch']);

  const st = new State();
  st.withDb(() => db);
  const cloned = st.clone();
  assert.ok(cloned.db === st.db, 'a Db clone must be a refcount bump, not a copy');
  assert.ok(cloned.view === st.view, 'the cached view is shared by the clone too');

  // Insérer le long de `elsewhere.*` : le sous-arbre `deep` intact reste PARTAGÉ.
  const grown = insertStr(db, 'elsewhere.new.leaf');
  const oldDeep = child(db, 'deep');
  const newDeep = child(grown, 'deep');
  assert.ok(oldDeep !== undefined, 'deep in original');
  assert.ok(newDeep !== undefined, 'deep in derived');
  assert.ok(oldDeep === newDeep, 'an insert must path-copy only the touched spine; untouched subtrees stay shared');
  // Et l'échine touchée n'est PAS partagée (la copie a bien eu lieu).
  const oldE = child(db, 'elsewhere');
  const newE = child(grown, 'elsewhere');
  assert.ok(oldE !== undefined && newE !== undefined);
  assert.ok(oldE !== newE, 'the touched spine must be a fresh copy');
  // L'original est intact (persistance).
  assert.ok(!existsStr(db, 'elsewhere.new.leaf'));
});

/** `Prax.Db.unifyAll` : unification conjonctive d'une liste de phrases. */
function unifyAll(db: Db, patterns: readonly string[]): Bindings[] {
  let bss: Bindings[] = [new Map()];
  for (const pat of patterns) {
    const path = tokenize(pat);
    const next: Bindings[] = [];
    for (const b of bss) next.push(...unify(db, path.segs, b));
    bss = next;
  }
  return bss;
}

function symName(v: Val | undefined): string {
  assert.equal(typeof v, 'string', `expected a bound VSym, got ${String(v)}`);
  return v as string;
}

// ===== insert / dbToSentences =====
// H: DbSpec.hs "insert / dbToSentences"

// R: db.rs basic_multi_valued_facts
// H: DbSpec.hs "basic multi-valued facts"
test('db.rs : faits multi-valués', () => {
  const db = build(['foo.bar.baz', 'foo.bar.woof', 'foo.meow.woof']);
  assert.deepEqual(toSentences(db), ['foo.bar.baz', 'foo.bar.woof', 'foo.meow.woof']);
});

// R: db.rs exclusion_replaces_old_single_value
// H: DbSpec.hs "exclusion replaces the old single value (x.age!32 then x.age!33)"
test('db.rs : l’exclusion remplace l’ancienne valeur unique', () => {
  assert.deepEqual(toSentences(build(['x.age!32', 'x.age!33'])), ['x.age.33']);
});

// R: db.rs regression_reasserting_bang_parent_preserves_subtree
// H: DbSpec.hs "REGRESSION: re-asserting an ! parent preserves its existing subtree"
test('db.rs : RÉGRESSION — réaffirmer un parent `!` préserve son sous-arbre', () => {
  // Le bogue `!` de Praxish : `foo!bar.meow` après `foo!bar.baz` doit garder `baz`.
  assert.deepEqual(toSentences(build(['foo!bar.baz', 'foo!bar.meow'])), ['foo.bar.baz', 'foo.bar.meow']);
});

// R: db.rs exclusion_clears_siblings_when_bang_child_changes
// H: DbSpec.hs "exclusion clears siblings when the ! child changes"
test('db.rs : l’exclusion efface les frères quand l’enfant `!` change', () => {
  assert.deepEqual(toSentences(build(['p!a.x', 'p!b.y'])), ['p.b.y']);
});

// R: db.rs dot_under_bang_child_accumulates
// H: DbSpec.hs "dot under an ! child accumulates"
test('db.rs : un `.` sous un enfant `!` s’accumule', () => {
  assert.deepEqual(toSentences(build(['g!closingStar!prebeginning'])), ['g.closingStar.prebeginning']);
});

// ===== retract =====
// H: DbSpec.hs "retract"

// R: db.rs retract_removes_subtree_by_prefix
// H: DbSpec.hs "removes a subtree by prefix"
test('db.rs : retirer enlève un sous-arbre par préfixe', () => {
  const db = retractStr(build(['foo.bar.baz', 'foo.meow.woof']), 'foo.bar');
  assert.deepEqual(toSentences(db), ['foo.meow.woof']);
});

// R: db.rs retracting_missing_path_is_a_noop
// H: DbSpec.hs "retracting a missing path is a no-op"
test('db.rs : retirer un chemin absent ne fait rien', () => {
  assert.deepEqual(toSentences(retractStr(build(['foo.bar']), 'nope.nothere')), ['foo.bar']);
});

// R: db.rs instance_persistence_asserted_instance_survives_drain
// H: DbSpec.hs "INSTANCE PERSISTENCE: an asserted instance survives its transient children draining to nothing"
test('db.rs : PERSISTANCE D’INSTANCE — une instance affirmée survit à la vidange de ses enfants', () => {
  const instance = 'practice.tendBar.bar.ada';
  let db = build([instance]);
  db = insertStr(db, `${instance}.customer.you!order!beer`);
  db = retractStr(db, `${instance}.customer.you!order`);
  db = insertStr(db, `${instance}.customer.you!beverage!beer`);
  db = retractStr(db, `${instance}.customer.you!beverage`);
  assert.ok(existsStr(db, instance), 'instance survives');
  assert.ok(!existsStr(db, `${instance}.customer.you`), 'drained transient scaffold is pruned');
  assert.deepEqual(toSentences(db), [instance]);
});

// R: db.rs siblings_and_shared_ancestors_survive
// H: DbSpec.hs "sibling and shared ancestors survive retracting the other sibling"
test('db.rs : le frère et les ancêtres communs survivent au retrait de l’autre frère', () => {
  const db = retractStr(build(['eve.lied.dana.stole.carol.loaf', 'eve.lied.dana.stole.carol.purse']), 'eve.lied.dana.stole.carol.loaf');
  const probes: Array<[string, boolean]> = [
    ['eve.lied.dana.stole.carol.loaf', false],
    ['eve.lied.dana.stole.carol.purse', true],
    ['eve.lied.dana.stole.carol', true],
    ['eve.lied.dana.stole', true],
    ['eve.lied.dana', true],
    ['eve.lied', true],
    ['eve', true],
  ];
  for (const [path, present] of probes) assert.equal(existsStr(db, path), present, path);
  assert.deepEqual(toSentences(db), ['eve.lied.dana.stole.carol.purse']);
});

// R: db.rs v38_repro_last_leaf_retract_prunes_toward_ancestor
// H: DbSpec.hs "v38 repro: retracting the last targeted leaf prunes the drained `toward` ancestor"
test('db.rs : repro v38 — retirer la dernière feuille élague l’ancêtre `toward` vidé', () => {
  const db = retractStr(build(['carol.feels.angry.toward.bob']), 'carol.feels.angry.toward.bob');
  assert.ok(!existsStr(db, 'carol.feels.angry.toward'));
  assert.ok(!existsStr(db, 'carol.feels.angry'));
  assert.deepEqual(toSentences(db), []);
});

// R: db.rs reasserted_scaffold_survives_deep_leaf_retract
// H: DbSpec.hs "re-asserted scaffold: an explicitly asserted prefix survives its deep leaf retract"
test('db.rs : un échafaudage réaffirmé survit au retrait de sa feuille profonde', () => {
  const db = retractStr(build(['carol.feels.angry.toward.bob', 'carol.feels.angry']), 'carol.feels.angry.toward.bob');
  assert.ok(existsStr(db, 'carol.feels.angry'));
  assert.ok(!existsStr(db, 'carol.feels.angry.toward'));
  assert.deepEqual(toSentences(db), ['carol.feels.angry']);
});

// ===== serialization round-trips assertedness =====
// H: DbSpec.hs "serialization round-trips assertedness"

// R: db.rs labeled_asserted_interior_round_trips_exactly
// H: DbSpec.hs "labeled: an asserted interior node with children round-trips exactly (marks included)"
test('db.rs : étiqueté — un intérieur affirmé avec enfants fait l’aller-retour exact', () => {
  const db = build(['practice.tendBar.bar.ada', 'practice.tendBar.bar.ada.customer.you', 'note!seen']);
  const rebuilt = build(toLabeledSentences(db));
  assert.ok(dbEq(rebuilt, db));
});

// R: db.rs plain_mark_bearing_db_rebuilds_identically
// H: DbSpec.hs "plain: a mark-bearing db rebuilds identically from its flattened sentences"
test('db.rs : simple — une base marquée se reconstruit à l’identique depuis ses phrases', () => {
  const db = build(['practice.tendBar.bar.ada', 'practice.tendBar.bar.ada.customer.you']);
  assert.ok(dbEq(build(toSentences(db)), db));
});

// ===== unify =====
// H: DbSpec.hs "unify"

// R: db.rs two_sentence_join_binds_shared_variable
// H: DbSpec.hs "two-sentence join binds shared variable"
test('db.rs : une jointure de deux phrases lie la variable partagée', () => {
  const db = build(['foo.bar.woof', 'foo.meow.woof', 'fizz.buzz.foo', 'some.other.woof']);
  const results = unifyAll(db, ['X.Y.woof', 'fizz.buzz.X']);
  assert.deepEqual(
    results.map((b) => symName(b.get('X'))),
    ['foo', 'foo'],
  );
  const ys = results
    .map((b) => b.get('Y'))
    .filter((v): v is Val => v !== undefined)
    .map(symName)
    .sort();
  assert.deepEqual(ys, ['bar', 'meow']);
});

// R: db.rs bound_variable_descends_deterministically
// H: DbSpec.hs "bound variable descends deterministically"
test('db.rs : une variable descend de façon déterministe', () => {
  const db = build(['char.tim', 'char.kevin']);
  assert.equal(unify(db, tokenize('char.Who').segs, new Map()).length, 2);
});

// R: db.rs absent_constant_yields_no_bindings
// H: DbSpec.hs "constant that is absent yields no bindings"
test('db.rs : une constante absente ne donne aucune liaison', () => {
  assert.deepEqual(unify(build(['char.tim']), tokenize('char.nobody').segs, new Map()), []);
});

// ===== ground =====
// H: DbSpec.hs "ground"

// R: db.rs ground_substitutes_bound_vars_preserving_operators
// H: DbSpec.hs "substitutes bound vars, preserves ! and ."
test('db.rs : ground substitue les variables liées en gardant `!` et `.`', () => {
  const b = seed([
    ['B', 'ada'],
    ['C', 'beth'],
    ['Bev', 'cider'],
  ]);
  assert.equal(ground(tokenize('practice.tendBar.B.customer.C!order!Bev'), b), 'practice.tendBar.ada.customer.beth!order!cider');
});

// R: db.rs ground_unbound_var_grounds_to_its_own_name
// H: DbSpec.hs "unbound var grounds to its own name"
test('db.rs : une variable non liée se fonde en son propre nom', () => {
  assert.equal(ground(tokenize('foo.Bar'), new Map()), 'foo.Bar');
});

// R: db.rs ground_set_valued_binding_renders_as_opaque_marker
// H: DbSpec.hs "set-valued binding renders as opaque marker"
test('db.rs : une liaison ensembliste se rend en marqueur opaque', () => {
  const binds: Bindings = new Map([['Dancers', new SetVal([['a'], ['b']])]]);
  assert.equal(ground(tokenize('all.Dancers'), binds), 'all.<Set(2)>');
});

// ===== unifyNames =====
// H: DbSpec.hs "unifyNames"

// R: db.rs unify_is_invariant_under_hoisting_the_parse
// H: DbSpec.hs "unifyNames is unify with the parse hoisted out"
test('db.rs : unify est invariant quand on sort l’analyse de la boucle', () => {
  const db = build(['at.bob!square', 'at.eve!mill']);
  const inside = unify(db, tokenize('at.Who!Where').segs, new Map());
  const hoisted = unify(db, tokenize('at.Who!Where').segs, new Map());
  assertBindingsList(inside, hoisted);
  assert.equal(inside.length, 2);
});

// ===== groundTokens =====
// H: DbSpec.hs "groundTokens"

// R: db.rs ground_over_tokens_preserves_operators_and_plain_paths
// H: DbSpec.hs "groundTokens substitutes bindings segment-wise, preserving operators"
test('db.rs : groundTokens substitue segment par segment en gardant les opérateurs', () => {
  const b = seed([
    ['Who', 'bob'],
    ['Where', 'square'],
  ]);
  assert.equal(ground(tokenize('at.Who!Where'), b), 'at.bob!square');
  assert.equal(ground(tokenize('plain.path'), new Map()), 'plain.path');
});

// ===== internTokens / unifySyms =====
// H: DbSpec.hs "internTokens / unifySyms (the Sym-level cores unify/unifyNames delegate to)"

// R: db.rs tokenize_interns_names_preserving_operators
// H: DbSpec.hs "internTokens interns tokens' segment names, preserving operators"
test('db.rs : tokenize garde les noms des segments et les opérateurs', () => {
  const path = tokenize('at.Who!Where');
  assert.deepEqual([...path.segs], ['at', 'Who', 'Where']);
  // L'opérateur après le segment 0 est `.`, après le segment 1 est `!`.
  assert.ok(!isExclAfter(path, 0));
  assert.ok(isExclAfter(path, 1));
});

// R: db.rs tokenized_query_agrees_with_manual_interning
// H: DbSpec.hs "unifySyms agrees with unifyNames (Bindings is Sym-keyed natively)"
test('db.rs : la requête tokenisée égale la requête construite à la main', () => {
  // Adaptation : pas d'interneur — les segments « internés à la main » sont les noms eux-mêmes.
  const db = build(['at.bob!square', 'at.eve!mill']);
  const tokenized = tokenize('at.Who!Where');
  const manual = ['at', 'Who', 'Where'];
  assert.deepEqual([...tokenized.segs], manual);
  assertBindingsList(unify(db, tokenized.segs, new Map()), unify(db, manual, new Map()));
});

// R: db.rs unify_branches_unbound_vars_in_name_order
// H: DbSpec.hs "unifySyms branches unbound variables in name order, not id (encounter) order"
test('db.rs : unify branche les variables non liées dans l’ordre des noms', () => {
  // Enfants insérés hors de l'ordre alphabétique : l'ordre de rencontre ≠ l'ordre des noms.
  const db = build(['at.zeta', 'at.alpha', 'at.mu']);
  const names = unify(db, tokenize('at.Who').segs, new Map()).map((b) => symName(b.get('Who')));
  assert.deepEqual(names, ['alpha', 'mu', 'zeta']);
});

// ===== child_keys (pas d'épingle DbSpec ; S2 s'en sert) =====

// R: db.rs child_keys_are_name_sorted
test('db.rs : childKeys est trié par nom', () => {
  const db = build(['at.zeta', 'at.alpha', 'at.mu']);
  assert.deepEqual(childKeys(db, tokenize('at').segs), ['alpha', 'mu', 'zeta']);
});

// =============================================================================
// prax-core/src/db.rs — module `proptest_laws`
// =============================================================================

/** L'invariant v39 : aucun nœud non affirmé et sans enfant (la racine est exemptée). */
function invariantHolds(db: Db): boolean {
  const walk = (node: DbNode): boolean => node.kids.every((c) => (c.asserted || c.kids.length > 0) && walk(c));
  return walk(db);
}

const DB_ALPHA = ['a', 'b', 'c', 'd'] as const;

/** Un chemin fondé de `lo..hi` segments tirés de `alpha`, séparés par `.`/`!` au hasard. */
function genPath(rng: Rng, alpha: readonly string[], lo: number, hi: number): string {
  const parts = rng.vec(lo, hi, () => [rng.pick(alpha), rng.bool()] as const);
  let s = '';
  parts.forEach(([name, bang], idx) => {
    if (idx > 0) s += bang ? '!' : '.';
    s += name;
  });
  return s;
}

/** `distinct_seg_pair` : deux segments DISTINCTS par construction (pas de rejet). */
function distinctSegPair(rng: Rng): [string, string] {
  const a = rng.int(4);
  const d = rng.range(1, 4);
  return [DB_ALPHA[a], DB_ALPHA[(a + d) % 4]];
}

type DbOp = { k: 'insert'; s: string } | { k: 'retract'; s: string };

// R: db.rs invariant_survives_arbitrary_op_sequences
test('db.rs (proptest) : l’invariant v39 survit à toute suite d’insertions et de retraits', () => {
  property('db.invariant_survives_arbitrary_op_sequences', (rng) => {
    const ops = rng.vec(0, 40, (): DbOp => {
      const s = genPath(rng, DB_ALPHA, 1, 5);
      return rng.bool() ? { k: 'insert', s } : { k: 'retract', s };
    });
    let db = emptyDb();
    for (const o of ops) {
      db = o.k === 'insert' ? insertStr(db, o.s) : retractStr(db, o.s);
      assert.ok(invariantHolds(db), `invariant broke after ${o.k} ${o.s}; db = ${JSON.stringify(toLabeledSentences(db))}`);
    }
  });
});

// R: db.rs labeled_sentences_round_trip
test('db.rs (proptest) : l’énumération étiquetée inverse l’insertion', () => {
  property('db.labeled_sentences_round_trip', (rng) => {
    const db = build(rng.vec(0, 12, () => genPath(rng, DB_ALPHA, 1, 5)));
    const rebuilt = build(toLabeledSentences(db));
    assert.ok(dbEq(rebuilt, db), `round trip differs: ${JSON.stringify(toLabeledSentences(rebuilt))} vs ${JSON.stringify(toLabeledSentences(db))}`);
  });
});

// R: db.rs bang_supersession_preserves_survivor_subtree
test('db.rs (proptest) : la supersession `!` préserve le sous-arbre du survivant', () => {
  property('db.bang_supersession_preserves_survivor_subtree', (rng) => {
    const p = rng.pick(DB_ALPHA);
    const c = rng.pick(DB_ALPHA);
    const [x, y] = distinctSegPair(rng);
    const db = insertStr(insertStr(emptyDb(), `${p}!${c}.${x}`), `${p}!${c}.${y}`);
    assert.ok(existsStr(db, `${p}.${c}.${x}`), 'survivor subtree lost x');
    assert.ok(existsStr(db, `${p}.${c}.${y}`), 'survivor subtree lost y');
  });
});

// R: db.rs insert_exists_retract_round_trip
test('db.rs (proptest) : insertion / existence / retrait font l’aller-retour', () => {
  property('db.insert_exists_retract_round_trip', (rng) => {
    const parts = rng.vec(1, 5, () => rng.pick(DB_ALPHA));
    const full = parts.join('.');
    let db = insertStr(emptyDb(), full);
    for (let k = 1; k <= parts.length; k++) {
      const prefix = parts.slice(0, k).join('.');
      assert.ok(existsStr(db, prefix), `prefix ${prefix} missing`);
    }
    db = retractStr(db, full);
    assert.deepEqual(toSentences(db), [], `db not empty after retract: ${JSON.stringify(toSentences(db))}`);
  });
});

// =============================================================================
// prax-core/src/path.rs — module `tests`
// H: DbSpec.hs "tokens: trailing-operator rejection (v43 -- a trailing op would set a leaf's exclusion flag nothing ever reads)"
// =============================================================================

// R: path.rs no_trailing_operator_is_unaffected
// H: DbSpec.hs "a sentence with no trailing operator is unaffected"
test('path.rs : une phrase sans opérateur final est intacte', () => {
  const p = tokenize('at.bob');
  assert.deepEqual([...p.segs], ['at', 'bob']);
  assert.ok(!isExclAfter(p, 0));
});

// R: path.rs interior_bang_is_unaffected
// H: DbSpec.hs "an interior ! (not trailing) is unaffected"
test('path.rs : un `!` intérieur (non final) est intact', () => {
  const p = tokenize('turn!0');
  assert.deepEqual([...p.segs], ['turn', '0']);
  assert.ok(isExclAfter(p, 0));
});

// R: path.rs trailing_bang_is_rejected
// H: DbSpec.hs "a sentence ending in ! is a loud construction-time error"
test('path.rs : une phrase finissant par `!` est une erreur bruyante', () => {
  assertTrailing(() => tokenize('at.bob!'), 'at.bob!', '!');
});

// R: path.rs trailing_dot_is_rejected
// H: DbSpec.hs "a sentence ending in . is a loud construction-time error"
test('path.rs : une phrase finissant par `.` est une erreur bruyante', () => {
  assertTrailing(() => tokenize('at.bob.'), 'at.bob.', '.');
});

// R: path.rs segment_names_checked_is_pathnames_guard_and_all
test('path.rs : segmentNamesChecked est pathNames, garde comprise', () => {
  assert.deepEqual(segmentNamesChecked('member.X!F'), ['member', 'X', 'F']);
  for (const [s, op] of [
    ['struck.A.V.', '.'],
    ['struck.A.V!', '!'],
  ] as const) {
    assertTrailing(() => segmentNamesChecked(s), s, op, 'segment_names_checked must raise where Prax.Db.tokens raises');
    // UNCHECKED-SPLIT : ce qu'EST la découpe non gardée (le contraste qui rend la gardée nécessaire).
    assert.equal(segmentNames(s).at(-1), '', 'the unguarded split is what it is — a trailing empty segment, not an error');
  }
  assert.deepEqual(segmentNamesChecked('   '), []);
});

// R: path.rs whitespace_is_trimmed_and_empty_is_the_empty_path
test('path.rs : les blancs sont rognés et la phrase vide est le chemin vide', () => {
  assert.deepEqual([...tokenize('   ').segs], []);
  assert.deepEqual([...tokenize('  at.bob  ').segs], ['at', 'bob']);
});

// =============================================================================
// prax-core/src/el.rs — module `tests`
// H: ELSpec.hs "Prax.EL (exclusion-logic lattice)"
// =============================================================================

/** `dbToSentences <$> meet a b` (`ELSpec.meetS`). */
function meetS(a: readonly string[], b: readonly string[]): string[] | null {
  const r = meet(build(a), build(b));
  return r === null ? null : toSentences(r);
}

// ===== meet ⊓ (Def 8) and incompatibility ⊥ (Def 7) =====
// H: ELSpec.hs "meet ⊓ (Def 8) and incompatibility ⊥ (Def 7)"

// R: el.rs compatible_multi_facts_conjoin
// H: ELSpec.hs "compatible multi facts conjoin"
test('el.rs : des faits multi compatibles se conjoignent', () => {
  assert.deepEqual(meetS(['a.b'], ['a.c']), ['a.b', 'a.c']);
});

// R: el.rs same_exclusive_fact_is_idempotent
// H: ELSpec.hs "the same exclusive fact is idempotent"
test('el.rs : le même fait exclusif est idempotent', () => {
  assert.deepEqual(meetS(['x!a'], ['x!a']), ['x.a']);
});

// R: el.rs exclusive_slot_forced_to_two_values_is_bottom
// H: ELSpec.hs "exclusive slot forced to two values is ⊥"
test('el.rs : un emplacement exclusif forcé à deux valeurs est ⊥', () => {
  assert.equal(meet(build(['x!a']), build(['x!b'])), null);
});

// R: el.rs exclusive_vs_different_multi_is_bottom_either_side
// H: ELSpec.hs "an exclusive claim vs a different multi child is still ⊥ (either side)"
test('el.rs : une revendication exclusive contre un autre enfant multi est ⊥ (des deux côtés)', () => {
  assert.equal(meet(build(['x!a']), build(['x.b'])), null);
  assert.equal(meet(build(['x.b']), build(['x!a'])), null);
});

// R: el.rs two_multi_children_never_conflict
// H: ELSpec.hs "two multi children never conflict"
test('el.rs : deux enfants multi ne sont jamais en conflit', () => {
  assert.notEqual(meet(build(['x.a']), build(['x.b'])), null);
});

// R: el.rs deep_conflict_propagates_to_bottom
// H: ELSpec.hs "a conflict deep in the tree propagates to ⊥"
test('el.rs : un conflit profond se propage en ⊥', () => {
  assert.equal(meet(build(['p.q.r!a']), build(['p.q.r!b'])), null);
});

// R: el.rs disjoint_slots_conjoin_freely
// H: ELSpec.hs "disjoint slots conjoin freely"
test('el.rs : des emplacements disjoints se conjoignent librement', () => {
  assert.deepEqual(meetS(['at!bar'], ['mood!happy']), ['at.bar', 'mood.happy']);
});

// ===== information order ≤ (Def 6) =====
// H: ELSpec.hs "information order ≤ (Def 6): a ≤ b means a entails b"

// R: el.rs more_facts_entail_fewer
// H: ELSpec.hs "more facts entail fewer"
test('el.rs : plus de faits entraînent moins', () => {
  assert.ok(leq(build(['a.b', 'a.c']), build(['a.b'])));
});

// R: el.rs fewer_facts_do_not_entail_more
// H: ELSpec.hs "fewer facts do NOT entail more"
test('el.rs : moins de faits n’entraînent PAS plus', () => {
  assert.ok(!leq(build(['a.b']), build(['a.b', 'a.c'])));
});

// R: el.rs specific_label_entails_the_general
// H: ELSpec.hs "a specific label entails the general (Excl ≤ Multi)"
test('el.rs : une étiquette spécifique entraîne la générale (Excl ≤ Multi)', () => {
  assert.ok(leq(build(['x!a']), build(['x.a'])));
});

// R: el.rs general_does_not_entail_the_specific
// H: ELSpec.hs "the general does NOT entail the specific (Multi ⋠ Excl)"
test('el.rs : la générale n’entraîne PAS la spécifique (Multi ⋠ Excl)', () => {
  assert.ok(!leq(build(['x.a']), build(['x!a'])));
});

// R: el.rs everything_entails_the_empty_model
// H: ELSpec.hs "everything entails the empty model"
test('el.rs : tout entraîne le modèle vide', () => {
  assert.ok(leq(build(['a.b']), emptyDb()));
});

// ===== assertedness in the lattice (v39) =====
// H: ELSpec.hs "assertedness in the lattice (v39): the mark extends pointwise"

// R: el.rs meet_preserves_an_assertion_via_disjunction
// H: ELSpec.hs "meet preserves an assertion (a ⊓ scaffold ≤ a): forces OR, not AND"
test('el.rs : meet préserve une affirmation (OU, pas ET)', () => {
  const asserted = build(['a', 'a.b']);
  const scaffold = build(['a.b']);
  const r = meet(asserted, scaffold);
  assert.ok(r !== null, 'meet must exist');
  assert.ok(leq(r, asserted), 'meet ≤ asserted operand');
  assert.ok(leq(r, scaffold), 'meet ≤ scaffold operand');
  assert.deepEqual(toSentences(r), ['a', 'a.b']);
});

// R: el.rs leq_consults_the_mark
// H: ELSpec.hs "≤ consults the mark: an asserted fact entails its scaffold, not conversely"
test('el.rs : ≤ consulte la marque — un fait affirmé entraîne son échafaudage, pas l’inverse', () => {
  assert.ok(leq(build(['a', 'a.b']), build(['a.b'])));
  assert.ok(!leq(build(['a.b']), build(['a', 'a.b'])));
});

// =============================================================================
// prax-core/src/el.rs — module `proptest_laws`
// =============================================================================

const EL_ALPHA = ['a', 'b', 'c'] as const;

/** `model()` : 0..5 chemins de 1..3 segments (un modèle cohérent, construit par insertions). */
function genModel(rng: Rng): Db {
  return build(rng.vec(0, 5, () => genPath(rng, EL_ALPHA, 1, 4)));
}

function meetEq(a: Db | null, b: Db | null): boolean {
  return a === null || b === null ? a === b : dbEq(a, b);
}

// R: el.rs meet_idempotent
test('el.rs (proptest) : meet est idempotent', () => {
  property('el.meet_idempotent', (rng) => {
    const a = genModel(rng);
    assert.ok(meetEq(meet(a, a), a));
  });
});

// R: el.rs meet_commutative
test('el.rs (proptest) : meet est commutatif', () => {
  property('el.meet_commutative', (rng) => {
    const a = genModel(rng);
    const b = genModel(rng);
    assert.ok(meetEq(meet(a, b), meet(b, a)));
  });
});

// R: el.rs meet_associative
test('el.rs (proptest) : meet est associatif', () => {
  property('el.meet_associative', (rng) => {
    const a = genModel(rng);
    const b = genModel(rng);
    const c = genModel(rng);
    const ab = meet(a, b);
    const left = ab === null ? null : meet(ab, c);
    const bc = meet(b, c);
    const right = bc === null ? null : meet(a, bc);
    assert.ok(meetEq(left, right));
  });
});

// R: el.rs meet_is_a_lower_bound
test('el.rs (proptest) : meet est une borne inférieure', () => {
  property('el.meet_is_a_lower_bound', (rng) => {
    const a = genModel(rng);
    const b = genModel(rng);
    const r = meet(a, b);
    if (r !== null) {
      assert.ok(leq(r, a), 'meet ≤ a');
      assert.ok(leq(r, b), 'meet ≤ b');
    }
  });
});

// R: el.rs leq_reflexive
test('el.rs (proptest) : leq est réflexif', () => {
  property('el.leq_reflexive', (rng) => {
    const a = genModel(rng);
    assert.ok(leq(a, a));
  });
});

// R: el.rs leq_transitive
test('el.rs (proptest) : leq est transitif', () => {
  property('el.leq_transitive', (rng) => {
    const a = genModel(rng);
    const b = genModel(rng);
    const c = genModel(rng);
    if (leq(a, b) && leq(b, c)) assert.ok(leq(a, c));
  });
});

// R: el.rs bottom_symmetric
test('el.rs (proptest) : ⊥ est symétrique', () => {
  property('el.bottom_symmetric', (rng) => {
    const a = genModel(rng);
    const b = genModel(rng);
    assert.equal(meet(a, b) === null, meet(b, a) === null);
  });
});

// =============================================================================
// prax-core/src/query.rs — module `tests`
// H: QuerySpec.hs "Prax.Query"
// =============================================================================

/** Compile puis évalue — le chemin écriture → exécution d'une installation de monde. */
function run(db: Db, conds: readonly Condition[], s: Bindings = new Map()): Bindings[] {
  return query(db, conds.map(compileCondition), s);
}

// ===== match / not =====
// H: QuerySpec.hs "match / not"

// R: query.rs bare_sentence_unifies_and_binds
// H: QuerySpec.hs "bare sentence unifies and binds"
test('query.rs : une phrase nue s’unifie et lie', () => {
  assert.equal(run(build(['char.tim', 'char.kevin']), [m('char.Who')]).length, 2);
});

// R: query.rs negation_keeps_binding_when_absent
// H: QuerySpec.hs "negation as failure keeps binding when absent"
test('query.rs : la négation par l’échec garde la liaison quand c’est absent', () => {
  assertBindingsList(run(build(['char.tim']), [n('isDancing.tim')]), [new Map()]);
});

// R: query.rs negation_drops_binding_when_present
// H: QuerySpec.hs "negation as failure drops binding when present"
test('query.rs : la négation par l’échec fait tomber la liaison quand c’est présent', () => {
  assert.deepEqual(run(build(['isDancing.tim']), [n('isDancing.tim')]), []);
});

// ===== eq / neq =====
// H: QuerySpec.hs "eq / neq"

// R: query.rs eq_binds_an_unbound_variable_to_a_constant
// H: QuerySpec.hs "eq binds an unbound variable to a constant"
test('query.rs : eq lie une variable non liée à une constante', () => {
  const rs = run(emptyDb(), [eq('X', 'beer')]);
  assert.equal(rs.length, 1);
  assert.equal(look(rs[0], 'X'), 'beer');
});

// R: query.rs eq_of_two_equal_bound_values_keeps
// H: QuerySpec.hs "eq of two equal bound values keeps the binding"
test('query.rs : eq de deux valeurs liées égales garde la liaison', () => {
  const s = seed([
    ['X', 'a'],
    ['Y', 'a'],
  ]);
  assertBindingsList(run(emptyDb(), [eq('X', 'Y')], s), [s]);
});

// R: query.rs eq_of_two_differing_bound_values_drops
// H: QuerySpec.hs "eq of two differing bound values drops the binding"
test('query.rs : eq de deux valeurs liées différentes fait tomber la liaison', () => {
  const s = seed([
    ['X', 'a'],
    ['Y', 'b'],
  ]);
  assert.deepEqual(run(emptyDb(), [eq('X', 'Y')], s), []);
});

// R: query.rs neq_keeps_distinct_drops_equal
// H: QuerySpec.hs "neq keeps distinct, drops equal"
test('query.rs : neq garde le distinct, fait tomber l’égal', () => {
  const distinct = seed([
    ['X', 'a'],
    ['Y', 'b'],
  ]);
  assertBindingsList(run(emptyDb(), [neq('X', 'Y')], distinct), [distinct]);
  const equal = seed([
    ['X', 'a'],
    ['Y', 'a'],
  ]);
  assert.deepEqual(run(emptyDb(), [neq('X', 'Y')], equal), []);
});

// R: query.rs neq_with_an_unbound_operand_drops
// H: QuerySpec.hs "neq with an unbound operand drops the binding (tie-game reliance)"
test('query.rs : neq avec un opérande non lié fait tomber la liaison', () => {
  assert.deepEqual(run(emptyDb(), [neq('Actor', 'Winner')], seed([['Actor', 'tim']])), []);
});

// ===== numeric: cmp / calc =====
// H: QuerySpec.hs "numeric: cmp / calc  (port of tests.js math block)"

// R: query.rs gt_fails_then_passes_across_an_exclusion_update
// H: QuerySpec.hs "gt fails then passes across an exclusion update"
test('query.rs : gt échoue puis réussit à travers une mise à jour exclusive', () => {
  const db0 = build(['counter.0']);
  // gt 4 échoue à 0.
  assert.deepEqual(run(db0, [m('counter.Val'), cmp('gt', 'Val', '4')]), []);
  // calc NewVal = 0 + 5.
  let rs = run(db0, [m('counter.Val'), calc('NewVal', 'add', 'Val', '5')]);
  assert.equal(rs.length, 1);
  assert.equal(look(rs[0], 'NewVal'), '5');
  // Mise à jour exclusive à 5 ; gt 4 tient maintenant avec Val = 5.
  const db1 = insertStr(db0, 'counter!5');
  rs = run(db1, [m('counter.Val'), cmp('gt', 'Val', '4')]);
  assert.deepEqual(
    rs.map((b) => look(b, 'Val')),
    ['5'],
  );
});

// R: query.rs chained_calc_mul_then_sub_yields_minus_20
// H: QuerySpec.hs "chained calc: mul then sub yields -20"
test('query.rs : calc enchaîné — mul puis sub donne -20', () => {
  const rs = run(build(['counter!5']), [
    m('counter.Val'),
    calc('BigVal', 'mul', 'Val', 'Val'),
    cmp('lt', 'Val', 'BigVal'),
    calc('TinyVal', 'sub', 'Val', 'BigVal'),
  ]);
  assert.equal(rs.length, 1);
  assert.equal(look(rs[0], 'BigVal'), '25');
  assert.equal(look(rs[0], 'TinyVal'), '-20');
});

// R: query.rs mod_binds_17_mod_5_is_2
// H: QuerySpec.hs "mod binds 17 mod 5 = 2"
test('query.rs : mod lie 17 mod 5 = 2', () => {
  const rs = run(emptyDb(), [calc('R', 'mod', '17', '5')]);
  assert.equal(rs.length, 1);
  assert.equal(look(rs[0], 'R'), '2');
});

// R: query.rs mod_on_a_negative_left_operand_is_2
// H: QuerySpec.hs "mod on a negative left operand follows Haskell semantics: -3 mod 5 = 2"
test('query.rs : mod d’un opérande gauche négatif suit Haskell — -3 mod 5 = 2', () => {
  const rs = run(emptyDb(), [calc('R', 'mod', '-3', '5')]);
  assert.equal(rs.length, 1);
  assert.equal(look(rs[0], 'R'), '2');
});

// R: query.rs calc_overflow_is_loud
test('query.rs : un dépassement de calc Mul est bruyant (jamais d’enroulement)', () => {
  // Adaptation : le domaine entier TS est celui des entiers sûrs (|n| ≤ 2^53 − 1),
  // l'heir de l'i64 vérifié Rust (`i64::MAX` n'y est pas représentable). Le contrat
  // est le même : correct ou plantage, jamais un résultat enroulé ou arrondi.
  const big = String(Number.MAX_SAFE_INTEGER);
  const s: Bindings = new Map([['X', Number.MAX_SAFE_INTEGER]]);
  assert.throws(() => run(emptyDb(), [calc('R', 'mul', 'X', big)], s), /dépassement arithmétique/);
});

// ===== subquery / count =====
// H: QuerySpec.hs "subquery / count  (port of tests.js subquery block)"

// R: query.rs count_dancers_other_than_the_actor_equals_2
// H: QuerySpec.hs "count dancers other than the actor equals 2"
test('query.rs : compter les danseurs autres que l’acteur donne 2', () => {
  const db = build(['char.tim', 'char.kevin', 'char.james', 'char.jer', 'isDancing.tim', 'isDancing.kevin', 'isDancing.jer']);
  const conds = [
    m('char.Actor'),
    subquery('Dancers', ['Dancer'], [m('char.Dancer'), m('isDancing.Dancer'), neq('Dancer', 'Actor')]),
    count('NumDancers', 'Dancers'),
    eq('NumDancers', '2'),
  ];
  const rs = run(db, conds, seed([['Actor', 'tim']]));
  assert.equal(rs.length, 1);
  // Les deux AUTRES danseurs (kevin, jer) : un ensemble de taille 2.
  assert.equal(look(rs[0], 'Dancers'), '<Set(2)>');
  assert.equal(look(rs[0], 'NumDancers'), '2');
});

// R: query.rs eq_on_the_count_filters_out_the_wrong_actor
// H: QuerySpec.hs "eq on the count filters out the wrong actor"
test('query.rs : eq sur le compte écarte le mauvais acteur', () => {
  const db = build(['char.tim', 'char.solo', 'isDancing.tim']);
  const conds = [
    m('char.Actor'),
    subquery('Dancers', ['Dancer'], [m('isDancing.Dancer'), neq('Dancer', 'Actor')]),
    count('NumDancers', 'Dancers'),
    eq('NumDancers', '2'),
  ];
  // solo ne voit danser que tim (compte 1) : eq 2 échoue.
  assert.deepEqual(run(db, conds, seed([['Actor', 'solo']])), []);
});

// ===== groundCondition =====
// H: QuerySpec.hs "groundCondition"

// R: query.rs ground_condition_substitutes_through_every_constructor
// H: QuerySpec.hs "groundCondition substitutes bindings through every constructor"
test('query.rs : groundCondition substitue à travers chaque constructeur', () => {
  const b = seed([['A', 'bob']]);
  const cases: Array<[Condition, Condition]> = [
    [m('at.A!P'), m('at.bob!P')],
    [n('seen.A'), n('seen.bob')],
    [eq('A', 'X'), eq('bob', 'X')],
    [neq('W', 'A'), neq('W', 'bob')],
    [cmp('gt', 'A', 'N'), cmp('gt', 'bob', 'N')],
    [calc('R', 'add', 'A', '1'), calc('R', 'add', 'bob', '1')],
    [count('R', 'A'), count('R', 'bob')],
    [subquery('S', ['A'], [m('p.A')]), subquery('S', ['bob'], [m('p.bob')])],
    [or_([[m('p.A')], [m('q.A')]]), or_([[m('p.bob')], [m('q.bob')]])],
    [absent([m('p.A')]), absent([m('p.bob')])],
    [exists([m('p.A')]), exists([m('p.bob')])],
  ];
  for (const [input, want] of cases) assert.deepEqual(groundCondition(b, input), want);
});

// ===== first-order connectives =====
// H: QuerySpec.hs "first-order connectives (∨, ¬compound, ∃, ∀, →)"

// R: query.rs or_binds_via_either_clause
// H: QuerySpec.hs "Or binds via either clause (disjunction)"
test('query.rs : Or lie par l’une ou l’autre clause', () => {
  const rs = run(build(['p.a', 'q.b']), [or_([[m('p.X')], [m('q.X')]])]);
  const xs = rs
    .map((b) => look(b, 'X'))
    .filter((x): x is string => x !== undefined)
    .sort();
  assert.deepEqual(xs, ['a', 'b']);
});

// R: query.rs or_deduplicates_overlapping_clauses
// H: QuerySpec.hs "Or deduplicates overlapping clauses"
test('query.rs : Or déduplique les clauses qui se recouvrent', () => {
  // Les deux clauses donnent X=a.
  assert.equal(run(build(['p.a', 'q.a']), [or_([[m('p.X')], [m('q.X')]])]).length, 1);
});

// R: query.rs absent_is_not_exists_over_a_compound
// H: QuerySpec.hs "Absent is ¬∃ over a compound (no male leader)"
test('query.rs : Absent est ¬∃ sur un composé (pas de chef mâle)', () => {
  // Un chef mâle existe : Absent échoue.
  assert.deepEqual(run(build(['leader.brown', 'brown.sex!male']), [absent([m('leader.L'), m('L.sex!male')])]), []);
  // Seulement une cheffe : Absent tient.
  assertBindingsList(run(build(['leader.lucy', 'lucy.sex!female']), [absent([m('leader.L'), m('L.sex!male')])]), [new Map()]);
});

// R: query.rs exists_is_boolean_without_leaking_witnesses
// H: QuerySpec.hs "Exists is boolean ∃ — satisfiable without leaking witnesses"
test('query.rs : Exists est un ∃ booléen, sans fuite de témoins', () => {
  const db = build(['char.tim', 'char.kev', 'here.ok']);
  // Un Match nu se multiplie sur tous les personnages…
  assert.equal(run(db, [m('here.OK'), m('char.Who')]).length, 2);
  // … Exists garde une seule liaison et ne lie pas Who.
  const rs = run(db, [m('here.OK'), exists([m('char.Who')])]);
  assert.equal(rs.length, 1);
  assert.equal(look(rs[0], 'Who'), undefined);
});

// R: query.rs for_all_every_patron_has_a_drink
// H: QuerySpec.hs "forAll: every patron has a drink (flips when one lacks it)"
test('query.rs : forAll — chaque client a un verre (bascule quand l’un n’en a pas)', () => {
  const cond = forAll([m('patron.P')], [m('drink.P')]);
  assertBindingsList(run(build(['patron.tim', 'patron.kev', 'drink.tim', 'drink.kev']), [cond]), [new Map()]);
  assert.deepEqual(run(build(['patron.tim', 'patron.kev', 'drink.tim']), [cond]), []);
});

// R: query.rs implies_truth_table
// H: QuerySpec.hs "implies: A → B truth table"
test('query.rs : implies — table de vérité de A → B', () => {
  const cond = implies([m('raining')], [m('wet')]);
  const q = (facts: readonly string[]) => run(build(facts), [cond]);
  assertBindingsList(q(['raining', 'wet']), [new Map()]); // A ∧ B
  assert.deepEqual(q(['raining']), []); // A ∧ ¬B
  assertBindingsList(q(['wet']), [new Map()]); // ¬A vacuité
  assertBindingsList(q([]), [new Map()]); // ¬A vacuité
});

// ===== cookedReadAnchors =====
// H: QuerySpec.hs "cookedReadAnchors"

// R: query.rs read_anchors_walks_every_polarity
// H: QuerySpec.hs "cookedReadAnchors walks every polarity, including subquery internals"
test('query.rs : readAnchors parcourt toutes les polarités, sous-requêtes comprises', () => {
  const conds = [
    m('a.X'),
    n('b.X'),
    subquery('S', ['W'], [m('c.W.deed'), cmp('gte', 'N', '2')]),
    count('N', 'S'),
    calc('M', 'add', 'N', '1'),
    eq('X', 'y'),
    or_([[m('d.X')], [absent([m('e.X')])]]),
  ];
  const anchors = readAnchors(conds.map(compileCondition));
  const want = (s: string) => anchors.some((a) => JSON.stringify(a) === JSON.stringify(tokenize(s).segs));
  assert.ok(want('a.X'), 'a.X read');
  assert.ok(want('b.X'), 'b.X (Not) read');
  assert.ok(want('c.W.deed'), 'subquery inner read');
  assert.ok(want('d.X'), 'Or branch read');
  assert.ok(want('e.X'), 'Absent-in-Or read');
  assert.equal(anchors.length, 5);
});

// ===== Prax.Cooked : contenu observable réexprimé sur l'unique évaluateur =====
// H: CookedSpec.hs "Prax.Cooked"

// R: query.rs cooked_fixture_scenarios_on_the_one_evaluator
test('query.rs : les sept scénarios « cooked » sur l’unique évaluateur', () => {
  const db = build(['at.bob!square', 'at.eve!mill', 'at.gale!mill', 'holding.bob.loaf', 'regards.dana.carol.thief', 'regards.gale.carol.thief']);
  const renderAll = (bs: readonly Bindings[]) => bs.map(render);

  assert.deepEqual(renderAll(run(db, [m('at.Who!Where')])), [
    [
      ['Who', 'bob'],
      ['Where', 'square'],
    ],
    [
      ['Who', 'eve'],
      ['Where', 'mill'],
    ],
    [
      ['Who', 'gale'],
      ['Where', 'mill'],
    ],
  ]);

  assert.deepEqual(renderAll(run(db, [m('at.Who!mill'), n('holding.Who.loaf')])), [[['Who', 'eve']], [['Who', 'gale']]]);

  assert.deepEqual(renderAll(run(db, [m('at.Who!Where'), absent([m('regards.Who.carol.thief')])])), [
    [
      ['Who', 'bob'],
      ['Where', 'square'],
    ],
    [
      ['Who', 'eve'],
      ['Where', 'mill'],
    ],
  ]);

  assert.deepEqual(renderAll(run(db, [exists([m('holding.H.loaf')]), m('at.Who!square')])), [[['Who', 'bob']]]);

  assert.deepEqual(renderAll(run(db, [or_([[m('at.Who!square')], [m('regards.Who.carol.thief')]])])), [
    [['Who', 'bob']],
    [['Who', 'dana']],
    [['Who', 'gale']],
  ]);

  assert.deepEqual(renderAll(run(db, [subquery('Rs', ['W'], [m('regards.W.carol.thief')]), count('N', 'Rs'), cmp('gte', 'N', '2')])), [
    [
      ['Rs', '<Set(2)>'],
      ['N', '2'],
    ],
  ]);

  assert.deepEqual(renderAll(run(db, [m('at.Who!Where'), neq('Who', 'bob'), eq('Place', 'Where')])), [
    [
      ['Who', 'eve'],
      ['Where', 'mill'],
      ['Place', 'mill'],
    ],
    [
      ['Who', 'gale'],
      ['Where', 'mill'],
      ['Place', 'mill'],
    ],
  ]);
});

// ===== parcours de la frontière d'écriture =====

// R: query.rs condition_vars_walks_every_constructor
test('query.rs : conditionVars parcourt chaque constructeur', () => {
  assert.deepEqual(conditionVars(m('at.Who')), ['at', 'Who']);
  assert.deepEqual(conditionVars(n('seen.A')), ['seen', 'A']);
  assert.deepEqual(conditionVars(eq('A', 'B')), ['A', 'B']);
  assert.deepEqual(conditionVars(calc('R', 'add', 'A', '1')), ['R', 'A', '1']);
  assert.deepEqual(conditionVars(subquery('S', ['W'], [m('p.W.deed'), neq('W', 'X')])), ['S', 'W', 'p', 'W', 'deed', 'W', 'X']);
  assert.deepEqual(conditionVars(or_([[m('p.A')], [n('q.B')]])), ['p', 'A', 'q', 'B']);
});

// R: query.rs condition_vars_rejects_a_trailing_operator_where_the_frozen_pathnames_raises
test('query.rs : conditionVars refuse un opérateur final là où pathNames (gelé) lève', () => {
  for (const [s, op] of [
    ['a.b.', '.'],
    ['a.b!', '!'],
  ] as const) {
    assertTrailing(() => conditionVars(m(s)), s, op, `Match ${s} must be rejected where the frozen pathNames raises`);
    assertTrailing(() => conditionVars(n(s)), s, op, `Not ${s} must be rejected where the frozen pathNames raises`);
  }
  // Le refus traverse chaque constructeur récursif (le `concatMap conditionVars` gelé force chaque élément).
  assert.throws(() => conditionVars(absent([m('ok'), m('a.')])), WorldError);
  assert.throws(() => conditionVars(or_([[m('ok')], [n('a!')]])), WorldError);
  assert.throws(() => conditionVars(subquery('S', ['W'], [m('p.W.')])), WorldError, 'a subquery’s where-clause is walked too');
});

// R: query.rs cond_sents_collects_raw_paths_recursively
test('query.rs : condSents collecte les phrases brutes récursivement', () => {
  const conds = [
    m('at.Who'),
    n('seen.Who'),
    eq('A', 'B'), // ne contribue aucune phrase
    absent([m('regards.Who.carol')]),
    or_([[m('p.X')], [m('q.Y')]]),
    subquery('S', ['W'], [m('inner.W')]),
  ];
  assert.deepEqual(condSents(conds), ['at.Who', 'seen.Who', 'regards.Who.carol', 'p.X', 'q.Y', 'inner.W']);
});

// ===== garde structurelle à la compilation =====

// R: query.rs nested_subquery_is_rejected_at_compile
test('query.rs : une sous-requête imbriquée est refusée à la compilation', () => {
  const isNested = (e: unknown) => e instanceof WorldError && e.kind === 'NestedSubquery';
  assert.throws(() => compileCondition(subquery('Outer', ['X'], [subquery('Inner', ['Y'], [m('p.Y')])])), isNested);
  // L'imbrication à travers Or/Absent dans une sous-requête est aussi détectée.
  assert.throws(() => compileCondition(subquery('Outer', ['X'], [or_([[subquery('Inner', ['Y'], [m('p.Y')])]])])), isNested);
  // Une sous-requête au premier niveau, et une requête simple dedans, compilent.
  assert.doesNotThrow(() => compileCondition(subquery('Outer', ['X'], [m('p.X'), neq('X', 'Y')])));
});

// =============================================================================
// prax-core/src/query.rs — module `proptest_laws`
// =============================================================================

const Q_CONST = ['a', 'b', 'c'] as const;
const Q_OPERAND = ['a', 'b', 'c', 'X', 'Y', 'Z'] as const;

/** Un fait fondé de 1..3 segments constants (pointés). */
function genFact(rng: Rng): string {
  return rng.vec(1, 4, () => rng.pick(Q_CONST)).join('.');
}

/** Un motif `Match`/`Not` de 1..3 segments opérandes. */
function genPattern(rng: Rng): string {
  return rng.vec(1, 4, () => rng.pick(Q_OPERAND)).join('.');
}

/**
 * Une condition aléatoire (profondeur bornée, sans Subquery/Count) : feuilles
 * Match/Not/Eq/Neq, nœuds Or (une clause) / Absent / Exists de 1..2 enfants —
 * `leaf.prop_recursive(3, 12, 3, …)`.
 */
function genCondition(rng: Rng, depth = 3): Condition {
  const leaf = (): Condition =>
    rng.oneOf([() => m(genPattern(rng)), () => n(genPattern(rng)), () => eq(rng.pick(Q_OPERAND), rng.pick(Q_OPERAND)), () => neq(rng.pick(Q_OPERAND), rng.pick(Q_OPERAND))]);
  if (depth === 0 || rng.bool()) return leaf();
  const kids = () => rng.vec(1, 3, () => genCondition(rng, depth - 1));
  return rng.oneOf([() => or_([kids()]), () => absent(kids()), () => exists(kids())]);
}

/** Construit la base et évalue, rendu en paires (comparable, indépendant de l'histoire). */
function evalFresh(facts: readonly string[], conds: readonly Condition[], seedPairs: ReadonlyArray<readonly [string, string]>): Array<Array<[string, string]>> {
  return query(build(facts), conds.map(compileCondition), seed(seedPairs)).map(render);
}

// R: query.rs results_are_interner_independent
test('query.rs (proptest) : les résultats ne dépendent que de la forme écrite', () => {
  // Adaptation : pas d'interneur en TS. « L'histoire » qui pourrait fuiter dans les
  // résultats est celle des caches du moteur : le cache du tokeniseur (rempli puis
  // perturbé par des phrases parasites) et les caches indexés par identité de
  // condition compilée (mémo de sous-requête, WeakMap) — la seconde évaluation part
  // d'une copie PROFONDE (objets neufs, structurellement égaux) des conditions.
  property('query.results_are_interner_independent', (rng) => {
    const facts = rng.vec(0, 6, () => genFact(rng));
    const conds = [genCondition(rng)];
    const first = evalFresh(facts, conds, []);
    for (const junk of ['zzz', 'qqq', 'Warm', 'Up']) tokenize(junk);
    const copy = JSON.parse(JSON.stringify(conds)) as Condition[];
    const second = query(build(facts), copy.map(compileCondition), new Map()).map(render);
    assert.deepEqual(first, second);
  });
});

// R: query.rs seed_only_narrows_positive_queries
test('query.rs (proptest) : une graine ne fait que restreindre une requête positive', () => {
  property('query.seed_only_narrows_positive_queries', (rng) => {
    const facts = rng.vec(0, 6, () => genFact(rng));
    const conds = rng.vec(0, 4, () => m(genPattern(rng)));
    const seedVar = rng.pick(['X', 'Y', 'Z']);
    const seedVal = rng.pick(Q_CONST);
    const empty = evalFresh(facts, conds, []);
    const seeded = evalFresh(facts, conds, [[seedVar, seedVal]]);
    assert.ok(seeded.length <= empty.length, `seed widened results: ${seeded.length} > ${empty.length}`);
  });
});

// R: query.rs or_is_clause_order_with_local_nub
test('query.rs (proptest) : Or suit l’ordre des clauses avec un nub local', () => {
  property('query.or_is_clause_order_with_local_nub', (rng) => {
    const db = build(rng.vec(0, 6, () => genFact(rng)));
    const c0 = rng.vec(1, 3, () => m(genPattern(rng)));
    const c1 = rng.vec(1, 3, () => m(genPattern(rng)));
    const viaOr = query(db, [compileCondition(or_([c0, c1]))], new Map());
    // Attendu : nub(query(c0) ++ query(c1)), dans l'ordre.
    const expected: Bindings[] = [];
    for (const cs of [c0, c1]) {
      for (const r of query(db, cs.map(compileCondition), new Map())) {
        if (!expected.some((x) => bindingsEq(x, r))) expected.push(r);
      }
    }
    // Comparaison rendue façon BTreeMap (clés triées).
    const renderSorted = (bs: readonly Bindings[]) => bs.map((b) => render(b).sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)));
    assert.deepEqual(renderSorted(viaOr), renderSorted(expected));
  });
});

// =============================================================================
// prax-core/src/derive.rs — module `tests`
// H: DeriveSpec.hs "Prax.Derive (m(X) closure)"
// =============================================================================

const rule = (body: readonly Condition[], heads: readonly string[]): CompiledRule => compileRule(body, heads);

/** Les phrases du modèle fermé, ou `[]` en cas de contradiction (`DeriveSpec.closedFacts`). */
function closedFacts(rules: readonly CompiledRule[], base: Db): string[] {
  const r = close(rules, base);
  return isContradiction(r) ? [] : toSentences(r);
}

/** Les faits que les axiomes AJOUTENT (fermeture moins base) — `Prax.Derive.derived`. */
function derived(rules: readonly CompiledRule[], base: Db): string[] {
  const baseSents = toSentences(base);
  return closedFacts(rules, base).filter((s) => !baseSents.includes(s));
}

function expectDb(r: Db | Contradiction, msg?: string): Db {
  assert.ok(!isContradiction(r), msg ?? `unexpected ⊥: ${showClosure(r)}`);
  return r;
}

// R: derive.rs no_axioms_returns_the_base_unchanged
// H: DeriveSpec.hs "no axioms ⇒ the base is returned unchanged"
test('derive.rs : sans axiome, la base est rendue inchangée', () => {
  const r = close([], build(['a.b']));
  assert.ok(closureEq(r, build(['a.b'])));
});

// R: derive.rs a_single_domain_rule_derives_a_consequence
// H: DeriveSpec.hs "a single domain rule derives a consequence"
test('derive.rs : une règle du domaine dérive une conséquence', () => {
  const axs = [rule([m('at.W.bar')], ['in.W.building'])];
  assert.ok(closedFacts(axs, build(['at.bex.bar'])).includes('in.bex.building'));
});

// R: derive.rs closure_reaches_a_multi_step_transitive_fixpoint
// H: DeriveSpec.hs "closure reaches a multi-step (transitive) fixpoint"
test('derive.rs : la fermeture atteint un point fixe transitif à plusieurs pas', () => {
  const axs = [rule([m('reaches.X.Y'), m('reaches.Y.Z')], ['reaches.X.Z'])];
  const d = derived(axs, build(['reaches.a.b', 'reaches.b.c', 'reaches.c.d']));
  assert.ok(d.includes('reaches.a.c'), 'a→c');
  assert.ok(d.includes('reaches.a.d'), 'a→d (two derived hops)');
  assert.ok(d.includes('reaches.b.d'), 'b→d');
});

// R: derive.rs relational_join_with_variable_binding_grandparent
// H: DeriveSpec.hs "relational join with variable binding (grandparent)"
test('derive.rs : jointure relationnelle avec liaison (grand-parent)', () => {
  const axs = [rule([m('parent.X.Y'), m('parent.Y.Z')], ['grandparent.X.Z'])];
  assert.deepEqual(derived(axs, build(['parent.tom.bob', 'parent.bob.ann'])), ['grandparent.tom.ann']);
});

// R: derive.rs two_match_second_position_binds_a_later_derived_fact
test('derive.rs : CAS 5 — le second Match lie un fait dérivé un tour plus tard', () => {
  const axs = [rule([m('p.X.Y'), m('r.Y.Z')], ['chain.X.Z']), rule([m('seed.Y.Z')], ['r.Y.Z'])];
  const d = derived(axs, build(['p.a.b', 'seed.b.c']));
  assert.ok(d.includes('r.b.c'), 'r.b.c is derived from seed.b.c');
  assert.ok(
    d.includes('chain.a.c'),
    `chain.a.c: the SECOND Match binds r.b.c, derived a round after p.a.b entered the delta — dropped by single-position seeding. derived=${JSON.stringify(d)}`,
  );
});

// R: derive.rs closure_is_a_view_so_derivation_is_defeasible
// H: DeriveSpec.hs "closure is a VIEW: base untouched, so derivation is defeasible"
test('derive.rs : la fermeture est une VUE — la dérivation est révisable', () => {
  const axs = [rule([m('at.W.bar')], ['in.W.building'])];
  const base = build(['at.bex.bar']);
  assert.ok(closedFacts(axs, base).includes('in.bex.building'));
  assert.ok(!toSentences(base).includes('in.bex.building'));
  // Retirer la prémisse de la BASE et refermer : la conclusion disparaît sans défaire à la main.
  const base2 = retractStr(base, 'at.bex.bar');
  assert.ok(!closedFacts(axs, base2).includes('in.bex.building'));
});

// R: derive.rs bottom_detected_two_exclusive_values_contradict_either_order
// H: DeriveSpec.hs "⊥ DETECTED: rules forcing one exclusive slot to two values contradict"
test('derive.rs : ⊥ DÉTECTÉ — deux règles forçant un emplacement exclusif à deux valeurs', () => {
  const a1 = rule([m('trigger')], ['light!red']);
  const a2 = rule([m('trigger')], ['light!green']);
  const base = build(['trigger']);
  assert.ok(isContradiction(close([a1, a2], base)));
  assert.ok(isContradiction(close([a2, a1], base)));
  // Le témoin ⊥ nomme une tête fautive (à l'ensemble près, DeriveSpec:75).
  const witness = close([a1, a2], base);
  assert.ok(isContradiction(witness));
  assert.ok(witness.sentence === 'light!red' || witness.sentence === 'light!green', `witness was ${witness.sentence}`);
});

// R: derive.rs consistent_exclusive_derivation_is_fine_no_false_bottom
// H: DeriveSpec.hs "consistent exclusive derivation is fine (no false ⊥)"
test('derive.rs : une dérivation exclusive cohérente passe (pas de faux ⊥)', () => {
  const axs = [rule([m('wedding.W')], ['status.W!married'])];
  const base = build(['wedding.bex']);
  assert.ok(!isContradiction(close(axs, base)));
  assert.ok(closedFacts(axs, base).includes('status.bex.married'));
  // L'étiquette `!` de la tête survit à la fondation : le modèle fermé marque l'emplacement exclusif.
  assert.ok(toLabeledSentences(expectDb(close(axs, base))).includes('status.bex!married'));
});

// R: derive.rs bottom_from_either_side_derived_multi_clashes_with_base_exclusive
// H: DeriveSpec.hs "⊥ from EITHER side: a derived multi value clashes with a base EXCLUSIVE fact"
test('derive.rs : ⊥ des DEUX côtés — une valeur multi dérivée heurte un fait EXCLUSIF de base', () => {
  const axs = [rule([m('summoned.W')], ['place.W.hall'])];
  // bex est exclusivement au bar ; la règle dérive un AUTRE lieu avec `.`.
  const r = close(axs, build(['place.bex!bar', 'summoned.bex']));
  assert.ok(closureEq(r, new Contradiction('place.bex.hall')), showClosure(r));
});

// R: derive.rs close_from_continues_a_closed_model_exactly_as_from_scratch
// H: DeriveSpec.hs "closureFrom continues a closed model exactly as a from-scratch closure"
test('derive.rs : closeFrom prolonge un modèle fermé exactement comme une fermeture complète', () => {
  const axs = [rule([m('parent.X.Y')], ['elder.X']), rule([m('elder.X'), m('wise.X')], ['sage.X'])];
  const base = build(['parent.ada.bea', 'wise.ada']);
  const closed = expectDb(close(axs, base));
  // Un fait nouveau et monotone qui cascade à travers les DEUX règles.
  const newFact = tokenize('parent.cal.dun');
  const cont = expectDb(closeFrom(axs, closed, [newFact]));
  const scratch = expectDb(close(axs, insert(base, newFact)));
  assert.deepEqual(toLabeledSentences(cont), toLabeledSentences(scratch));
});

// ---- la rencontre de tête est un MEET, pas un INSERT ----

// R: derive.rs head_meet_bang_endpoint_into_existing_multi_sibling_is_bottom_not_clear
test('derive.rs : une tête `!` contre un frère multi existant est ⊥, pas un effacement', () => {
  const axs = [rule([m('trigger')], ['x!b'])];
  // meet({x.a}, x!b) : x exclusif avec les enfants {a,b} ⇒ ⊥. Insert donnerait {x.b}.
  const r = close(axs, build(['x.a', 'trigger']));
  assert.ok(closureEq(r, new Contradiction('x!b')), showClosure(r));
});

// R: derive.rs head_meet_asserted_endpoint_or_joins_the_flag
test('derive.rs : une tête affirmant un intérieur existant fait le OU du drapeau', () => {
  const axs = [rule([m('trigger')], ['a'])];
  const sents = toSentences(expectDb(close(axs, build(['a.b', 'trigger']))));
  assert.ok(sents.includes('a'), 'asserted interior emits itself');
  assert.ok(sents.includes('a.b'), 'and keeps its descendant');
});

// R: derive.rs ground_head_carries_the_head_excl_bitmask
test('derive.rs : la fondation d’une tête porte son masque d’exclusion', () => {
  // `ground_head`/`render_head` Rust -> `groundTokens`/`renderPath` (ce qu'utilise derive.ts).
  const head = tokenize('status.W!married');
  const g = groundTokens(head, seed([['W', 'bex']]));
  assert.equal(renderPath(g), 'status.bex!married');
  assert.equal(g.excl, head.excl);
});

// ---- les constructeurs de tables d'analyse S4 ----

function hasPath(ps: ReadonlyArray<readonly string[]>, s: string): boolean {
  const segs = JSON.stringify(tokenize(s).segs);
  return ps.some((p) => JSON.stringify(p) === segs);
}

// R: derive.rs axiom_neg_patterns_collects_exactly_the_negated_interiors
// H: DeriveSpec.hs "axiomNegPatterns collects exactly the negated interiors"
test('derive.rs : axiomNegPatterns collecte exactement les intérieurs niés', () => {
  const axs = [rule([m('a.X'), absent([m('b.X'), not_('c.X')])], ['d.X'])];
  const np = axiomNegPatterns(axs);
  assert.ok(hasPath(np, 'b.X'), 'Absent interior');
  assert.ok(hasPath(np, 'c.X'), 'Not inside Absent');
  assert.ok(!hasPath(np, 'a.X'), 'positive atom is NOT negated');
});

// R: derive.rs monotone_axioms_accepts_count_threshold_and_rejects_anti_monotone
// H: DeriveSpec.hs "monotoneAxioms accepts the count-threshold shape and rejects anti-monotone"
test('derive.rs : monotoneAxioms accepte le seuil de compte et refuse l’anti-monotone', () => {
  const mono = (body: readonly Condition[], heads: readonly string[]) => monotoneAxioms([rule(body, heads)]);
  assert.ok(mono([m('a.X')], ['b.X']), 'Match-only is safe');
  assert.ok(
    mono([subquery('Rs', ['W'], [m('r.W.T')]), count('N', 'Rs'), cmp('gte', 'N', '3')], ['n.T']),
    'the notoriety shape (Subquery+Count+Cmp Gte literal) is safe',
  );
  assert.ok(!mono([count('N', 'Rs'), cmp('lt', 'N', '3')], ['q.T']), 'Cmp Lt with the literal on the right is anti-monotone');
  assert.ok(!mono([calc('M', 'add', 'N', '1')], ['q.M']), 'Calc disables the tier');
  assert.ok(!mono([subquery('Rs', ['W'], [m('r.W.T')]), count('N', 'Rs'), eq('N', '3')], ['n.T']), 'Eq over a count-bound variable is anti-monotone (exactly-k)');
  assert.ok(!mono([count('N', 'Rs'), neq('N', '3')], ['q.T']), 'Neq over a count-bound variable is anti-monotone too');
  assert.ok(mono([m('a.X'), m('b.Y'), eq('X', 'Y')], ['c.X']), 'Eq over Match-bound names stays monotone');
});

// =============================================================================
// prax-core/src/derive.rs — module `optimization_laws`
// =============================================================================

const OPT_ALPHA = ['a', 'b', 'c', 'd'] as const;
const genPathStr = (rng: Rng): string => genPath(rng, OPT_ALPHA, 1, 5);

// R: derive.rs entailed_matches_leq_singleton
test('derive.rs (proptest) : `entailed` égale leq contre le modèle singleton de la tête', () => {
  // Adaptation : `entailed` est privé dans derive.ts. On l'OBSERVE par la fermeture :
  // la règle `t → tête` sur `modèle + t` atteint le point fixe sans rien ajouter
  // (le résultat est structurellement le modèle d'entrée) ssi `entailed(modèle, tête)`
  // — sinon la tête est rencontrée, ce qui ajoute un nœud, une marque `!` ou une
  // affirmation (ou donne ⊥). `t` est hors de l'alphabet : il ne change ni l'un ni l'autre côté.
  property('derive.entailed_matches_leq_singleton', (rng) => {
    const model = build(rng.vec(0, 8, () => genPathStr(rng)));
    const headS = genPathStr(rng);
    const singleton = insert(emptyDb(), tokenize(headS));
    const withTrigger = insertStr(model, 't');
    const r = close([rule([m('t')], [headS])], withTrigger);
    const observedEntailed = !isContradiction(r) && dbEq(r, withTrigger);
    assert.equal(observedEntailed, leq(model, singleton), `head ${headS} over ${JSON.stringify(toLabeledSentences(model))}`);
  });
});

// R: derive.rs meet_head_matches_general_meet
test('derive.rs (proptest) : metOne égale le meet général avec le singleton de la tête', () => {
  property('derive.meet_head_matches_general_meet', (rng) => {
    const model = build(rng.vec(0, 8, () => genPathStr(rng)));
    const head = tokenize(genPathStr(rng));
    const singleton = insert(emptyDb(), head);
    const a = metOne(model, head);
    const b = meet(model, singleton);
    if (a !== null && b !== null) assert.deepEqual(toLabeledSentences(a), toLabeledSentences(b));
    else
      assert.ok(
        a === null && b === null,
        `meet_head ⊥-status differs: ${a === null ? 'None' : JSON.stringify(toLabeledSentences(a))} vs ${b === null ? 'None' : JSON.stringify(toLabeledSentences(b))}`,
      );
  });
});

/**
 * L'oracle naïf du module : la MÊME boucle que `run` (derive.ts) mais la porte de
 * delta forcée à OFF à chaque tour. `rule_bindings` étant privé, sa jointure
 * semi-naïve par position est reproduite sur les champs publics de CompiledRule ;
 * `entailed` est remplacé par son équivalent prouvé ci-dessus (leq singleton).
 */
function ruleBindingsRef(r: CompiledRule, model: Db, delta: Db): Bindings[] {
  if (r.kind.k === 'full') return query(model, r.body, new Map());
  const out: Bindings[] = [];
  for (const i of r.kind.positions) {
    let bs: Bindings[] = [new Map()];
    for (let j = 0; j < r.body.length; j++) {
      const db = j === i ? delta : model;
      const next: Bindings[] = [];
      for (const b of bs) next.push(...query(db, [r.body[j]] as Cond[], b));
      bs = next;
      if (bs.length === 0) break;
    }
    for (const b of bs) if (!out.some((x) => bindingsEq(x, b))) out.push(b);
  }
  return out;
}

function runUngated(rules: readonly CompiledRule[], model0: Db, delta0: Db): Db | Contradiction {
  let model = model0;
  let delta = delta0;
  for (;;) {
    const fresh: Array<[string, CompiledPath]> = [];
    for (const r of rules) {
      for (const b of ruleBindingsRef(r, model, delta)) {
        for (const h of r.heads) {
          const g = groundTokens(h, b);
          if (!leq(model, insert(emptyDb(), g))) fresh.push([renderPath(g), g]);
        }
      }
    }
    if (fresh.length === 0) return model;
    fresh.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
    const dedup = fresh.filter((x, i) => i === 0 || fresh[i - 1][0] !== x[0]);
    let nextDelta = emptyDb();
    for (const [, g] of dedup) nextDelta = insert(nextDelta, g);
    let nextModel = model;
    for (const [name, g] of dedup) {
      const mm = metOne(nextModel, g);
      if (mm === null) return new Contradiction(name);
      nextModel = mm;
    }
    model = nextModel;
    delta = nextDelta;
  }
}

// R: derive.rs gated_close_from_equals_ungated
test('derive.rs (proptest) : closeFrom avec porte de delta égale la continuation sans porte', () => {
  // Une chaîne transitive plus une jointure, pour que des tours ultérieurs se déclenchent.
  const rules = [rule([m('a.X')], ['b.X']), rule([m('b.X')], ['c.X']), rule([m('c.X'), m('d.X')], ['e.X'])];
  property('derive.gated_close_from_equals_ungated', (rng) => {
    const baseFacts = rng.vec(0, 6, () => genPathStr(rng));
    const contFacts = rng.vec(0, 4, () => genPathStr(rng));
    const base = build(baseFacts);
    // Une base contradictoire est hors sujet (la précondition du palier est un modèle fermé cohérent).
    const closed = close(rules, base);
    if (isContradiction(closed)) return;
    const cont = contFacts.map((f) => tokenize(f));
    const gated = closeFrom(rules, closed, cont);
    let model = closed;
    let d = emptyDb();
    for (const f of cont) {
      model = insert(model, f);
      d = insert(d, f);
    }
    const ungated = runUngated(rules, model, d);
    if (!isContradiction(gated) && !isContradiction(ungated)) assert.deepEqual(toLabeledSentences(gated), toLabeledSentences(ungated));
    else assert.ok(closureEq(gated, ungated), `gate changed ⊥ status: ${showClosure(gated)} vs ${showClosure(ungated)}`);
  });
});

// =============================================================================
// prax-core/src/interner.rs — module `tests`
// H: SymSpec.hs "Prax.Sym"
// Adaptation : le portage TS n'a pas d'interneur — un symbole EST sa chaîne. Les
// épingles sémantiques sont reportées sur ce qui en tient lieu (le tokeniseur et
// `isVariableName`) ; les deux épingles d'identifiants bruts sont écartées.
// =============================================================================

// R: interner.rs intern_resolve_round_trips_and_is_idempotent
// H: SymSpec.hs "intern/symName round-trips and is idempotent"
test('interner.rs (adapté) : un segment se relit tel quel, et tokeniser est idempotent', () => {
  const a = tokenize('square').segs[0];
  assert.equal(a, 'square');
  assert.equal(tokenize('square').segs[0], a);
  assert.deepEqual(tokenize('square'), tokenize('square'));
});

// R: interner.rs variable_ness_is_packed_into_parity
// H: SymSpec.hs "variable-ness is packed into parity"
test('interner.rs (adapté) : être une variable dépend de l’initiale majuscule', () => {
  assert.ok(!isVariableName('square'), 'constants are not variables');
  assert.ok(isVariableName('Actor'), 'uppercase-initial segments are');
  assert.ok(!isVariableName(''), 'empty segment is a constant');
});

// R: interner.rs distinct_names_get_distinct_symbols
// H: SymSpec.hs "distinct names get distinct symbols"
test('interner.rs (adapté) : des noms distincts donnent des symboles (clés) distincts', () => {
  assert.notEqual(tokenize('mill').segs[0], tokenize('square').segs[0]);
  assert.deepEqual(childKeys(build(['mill', 'square']), []), ['mill', 'square']);
});

// R: interner.rs id_from_raw_round_trip — ÉCARTÉ : pas d'identifiants bruts de symbole en
//    TS (l'échappatoire symId/symOfId n'existe pas ; la base est indexée par la chaîne).
// R: interner.rs distinct_symbols_have_distinct_ids — ÉCARTÉ : même raison (le contenu
//    « noms distincts ⇒ symboles distincts » est couvert par le test précédent).

// =============================================================================
// conformance/src/derive_props.rs — module `props`
// =============================================================================

const UNARY = ['ua', 'ub', 'uc', 'ud'] as const;
const BIN = ['ba', 'bb', 'bc'] as const;
const CONST = ['c0', 'c1', 'c2'] as const;
const u = (i: number): string => UNARY[i % UNARY.length];
const bn = (i: number): string => BIN[i % BIN.length];
const k = (i: number): string => CONST[i % CONST.length];

/** Une règle écrite : ses conditions de corps et ses têtes. */
type RuleSpec = [Condition[], string[]];

/** Les huit formes de règle (derive_props.rs `rule_spec`). */
function genRuleSpec(rng: Rng): RuleSpec {
  const idx = () => rng.u8();
  return rng.oneOf<RuleSpec>([
    // 1. un Match unaire → unaire (deux têtes en option : multi-tête).
    () => {
      const [p, q, r, two] = [idx(), idx(), idx(), rng.bool()];
      const heads = [`${u(q)}.X`];
      if (two) heads.push(`${u(r)}.X`);
      return [[m(`${u(p)}.X`)], heads];
    },
    // 2. jointure binaire à deux Match — récursive / grand-parent / transitive (Kin).
    () => {
      const [p, q, r] = [idx(), idx(), idx()];
      return [[m(`${bn(p)}.X.Y`), m(`${bn(q)}.Y.Z`)], [`${bn(r)}.X.Z`]];
    },
    // 3. Match + Not (révisable ; Not lit un prédicat peut-être dérivé).
    () => {
      const [p, q, r] = [idx(), idx(), idx()];
      return [[m(`${u(p)}.X`), not_(`${u(q)}.X`)], [`${u(r)}.X`]];
    },
    // 4. LE FRAGMENT DU BOGUE : Match + Exists sur un prédicat disjoint, peut-être dérivé.
    () => {
      const [p, q, r] = [idx(), idx(), idx()];
      return [[m(`${u(p)}.X`), exists([m(`${u(q)}.Y`)])], [`${u(r)}.X`]];
    },
    // 5. Match + garde Neq sur une jointure binaire.
    () => {
      const [p, q] = [idx(), idx()];
      return [[m(`${bn(p)}.X.Y`), neq('X', 'Y')], [`${u(q)}.X`]];
    },
    // 6. l'agrégat livré à 4 conditions : Match + Subquery + Count + Cmp.
    () => {
      const [p, q, r, thr] = [idx(), idx(), idx(), rng.range(1, 4)];
      return [[m(`${bn(p)}.W0.T`), subquery('S', ['W'], [m(`${bn(q)}.W.T`)]), count('N', 'S'), cmp('gte', 'N', String(thr))], [`${u(r)}.T`]];
    },
    // 7. corps sans Match (Absent au premier niveau → évaluation complète à chaque tour).
    () => {
      const [p, q, c] = [idx(), idx(), idx()];
      return [[absent([m(`${u(p)}.${k(c)}`)])], [`${u(q)}.${k(c)}`]];
    },
    // 8. corps Or (disjonction lisant deux prédicats peut-être dérivés).
    () => {
      const [p, q, r] = [idx(), idx(), idx()];
      return [[or_([[m(`${u(p)}.X`)], [m(`${u(q)}.X`)]])], [`${u(r)}.X`]];
    },
  ]);
}

/** Un fait de base fondé — unaire ou binaire sur les constantes. */
function genBaseFact(rng: Rng): string {
  return rng.oneOf([() => `${u(rng.u8())}.${k(rng.u8())}`, () => `${bn(rng.u8())}.${k(rng.u8())}.${k(rng.u8())}`]);
}

function compileRules(specs: readonly RuleSpec[]): CompiledRule[] {
  return specs.map(([body, heads]) => compileRule(body, heads));
}

/** Accord à témoin près : deux Ok de mêmes phrases étiquetées, ou deux Err. */
function agree(a: Db | Contradiction, b: Db | Contradiction): boolean {
  if (isContradiction(a) || isContradiction(b)) return isContradiction(a) && isContradiction(b);
  return JSON.stringify(toLabeledSentences(a)) === JSON.stringify(toLabeledSentences(b));
}

// R: derive_props.rs naive_equals_production
test('derive_props.rs (proptest) : LA LOI PHARE — fermeture de production == oracle naïf', () => {
  property('derive_props.naive_equals_production', (rng) => {
    const specs = rng.vec(0, 4, () => genRuleSpec(rng));
    const facts = rng.vec(0, 6, () => genBaseFact(rng));
    const rules = compileRules(specs);
    const base = build(facts);
    const prod = close(rules, base);
    const naive = naiveClosure(rules, base);
    if (!isContradiction(prod) && !isContradiction(naive)) assert.deepEqual(toLabeledSentences(prod), toLabeledSentences(naive), 'naive != production facts');
    else if (isContradiction(prod) && isContradiction(naive)) assert.equal(prod.sentence, naive.sentence, 'naive != production ⊥ witness');
    else assert.fail(`naive/production Ok-vs-Err split: prod=${!isContradiction(prod)} naive=${!isContradiction(naive)}`);
  });
});

// R: derive_props.rs div1_bug_fragment_naive_equals_production
test('derive_props.rs (proptest) : le fragment du bogue DIV-1 — production == naïf, r.C dérivé', () => {
  property('derive_props.div1_bug_fragment_naive_equals_production', (rng) => {
    const cc = k(rng.u8());
    const specs: RuleSpec[] = [
      // A : Match p.X + Exists sur le prédicat DÉRIVÉ et disjoint q → r.X
      [[m('p.X'), exists([m('q.Y')])], ['r.X']],
      // B : dérive q (disjoint de p), déclenché par un fait de base t
      [[m('t.Z')], ['q.thing']],
    ];
    const rules = compileRules(specs);
    const base = build([`p.${cc}`, `t.${cc}`]);
    const prod = close(rules, base);
    const naive = naiveClosure(rules, base);
    assert.ok(closureEq(prod, naive), `DIV-1 fragment: naive != production (${showClosure(prod)} vs ${showClosure(naive)})`);
    assert.ok(toLabeledSentences(expectDb(prod)).includes(`r.${cc}`), `DIV-1 fragment: r.${cc} must be derived (the Rust beats frozen here)`);
  });
});

// R: derive_props.rs case5_second_match_binds_a_later_derived_fact
test('derive_props.rs (proptest) : CAS 5 — le second Match lie un fait dérivé plus tard', () => {
  property('derive_props.case5_second_match_binds_a_later_derived_fact', (rng) => {
    const [a, mid, z] = [k(rng.u8()), k(rng.u8()), k(rng.u8())];
    const specs: RuleSpec[] = [
      // A : p.X.Y + r.Y.Z → chain.X.Z ; r est DÉRIVÉ et disjoint de p.
      [[m('p.X.Y'), m('r.Y.Z')], ['chain.X.Z']],
      // B : seed.Y.Z → r.Y.Z ; r.mid.z entre dans le delta un tour APRÈS p.
      [[m('seed.Y.Z')], ['r.Y.Z']],
    ];
    const rules = compileRules(specs);
    const base = build([`p.${a}.${mid}`, `seed.${mid}.${z}`]);
    const prod = close(rules, base);
    const naive = naiveClosure(rules, base);
    assert.ok(closureEq(prod, naive), `CASE 5: naive != production (${showClosure(prod)} vs ${showClosure(naive)})`);
    assert.ok(
      toLabeledSentences(expectDb(prod)).includes(`chain.${a}.${z}`),
      `CASE 5: chain.${a}.${z} must be derived (the second Match binds later-derived r.${mid}.${z})`,
    );
  });
});

// R: derive_props.rs closure_is_idempotent
test('derive_props.rs (proptest) : la fermeture est idempotente', () => {
  property('derive_props.closure_is_idempotent', (rng) => {
    const rules = compileRules(rng.vec(0, 4, () => genRuleSpec(rng)));
    const base = build(rng.vec(0, 6, () => genBaseFact(rng)));
    const closed = close(rules, base);
    if (!isContradiction(closed)) {
      const twice = close(rules, closed);
      assert.ok(!isContradiction(twice), 're-closing a closed model contradicted');
      assert.deepEqual(toLabeledSentences(twice), toLabeledSentences(closed), 'closure is not idempotent');
    }
  });
});

// R: derive_props.rs bottom_and_facts_are_rule_order_independent
test('derive_props.rs (proptest) : ⊥ et faits ne dépendent pas de l’ordre des règles', () => {
  property('derive_props.bottom_and_facts_are_rule_order_independent', (rng) => {
    const rules = compileRules(rng.vec(0, 4, () => genRuleSpec(rng)));
    const rev = [...rules].reverse();
    const base = build(rng.vec(0, 6, () => genBaseFact(rng)));
    const a = close(rules, base);
    const b = close(rev, base);
    assert.ok(agree(a, b), `rule order changed the closure result: ${showClosure(a)} vs ${showClosure(b)}`);
  });
});

// R: derive_props.rs conflicting_bang_heads_agree_on_witness
test('derive_props.rs (proptest) : des têtes `!` en conflit donnent le même témoin (production/naïf)', () => {
  property('derive_props.conflicting_bang_heads_agree_on_witness', (rng) => {
    const [p, q, c] = [rng.u8(), rng.u8(), rng.u8()];
    // Deux règles écrivant le MÊME emplacement exclusif à deux valeurs, déclenchées par un fait de base.
    const specs: RuleSpec[] = [
      [[m('trig')], [`slot!${k(p)}`]],
      [[m('trig')], [`slot!${k(q)}`]],
    ];
    const rules = compileRules(specs);
    const base = build([`anchor.${k(c)}`, 'trig']);
    const prod = close(rules, base);
    const naive = naiveClosure(rules, base);
    assert.ok(closureEq(prod, naive), `production and naive disagree on the ⊥ witness/result: ${showClosure(prod)} vs ${showClosure(naive)}`);
  });
});

/** Une règle MONOTONE : Match / Neq seulement, têtes sans `!` (`monotone_rule_spec`). */
function genMonotoneRuleSpec(rng: Rng): RuleSpec {
  const idx = () => rng.u8();
  return rng.oneOf<RuleSpec>([
    () => {
      const [p, q] = [idx(), idx()];
      return [[m(`${u(p)}.X`)], [`${u(q)}.X`]];
    },
    () => {
      const [p, q, r] = [idx(), idx(), idx()];
      return [[m(`${bn(p)}.X.Y`), m(`${bn(q)}.Y.Z`)], [`${bn(r)}.X.Z`]];
    },
    () => {
      const [p, q] = [idx(), idx()];
      return [[m(`${bn(p)}.X.Y`), neq('X', 'Y')], [`${u(q)}.X`]];
    },
  ]);
}

// R: derive_props.rs close_from_continues_monotone_deltas
test('derive_props.rs (proptest) : closeFrom prolonge les deltas monotones comme une fermeture complète', () => {
  property('derive_props.close_from_continues_monotone_deltas', (rng) => {
    const rules = compileRules(rng.vec(0, 4, () => genMonotoneRuleSpec(rng)));
    const facts = rng.vec(0, 5, () => genBaseFact(rng)); // base_fact n'émet jamais de `!`
    const delta = rng.vec(0, 3, () => genBaseFact(rng));
    const base = build(facts);
    // La fermeture complète de base ∪ delta.
    const scratch = close(rules, build([...facts, ...delta]));
    // La continuation depuis la base fermée.
    const closed = close(rules, base);
    const deltaPaths = delta.map((f) => tokenize(f));
    // Si l'un des côtés contredit, la loi est vide pour cette entrée.
    if (!isContradiction(closed) && !isContradiction(scratch)) {
      const cont = expectDb(closeFrom(rules, closed, deltaPaths));
      assert.deepEqual(toLabeledSentences(cont), toLabeledSentences(scratch), 'close_from diverged from a from-scratch monotone closure');
    }
  });
});

// =============================================================================
// conformance/src/view_invariant.rs — module `props`
// =============================================================================

const vu = (i: number): string => ['p', 'q', 'r'][i % 3];
const vbin = (i: number): string => ['e', 'f'][i % 2];
const vk = (i: number): string => ['c0', 'c1', 'c2'][i % 3];

/** Formes de règle : monotones (tout Match), non monotones (Not), têtes `!` pouvant forcer ⊥. */
function genViewRuleSpec(rng: Rng): RuleSpec {
  const b = () => rng.u8();
  return rng.oneOf<RuleSpec>([
    () => {
      const [p, q] = [b(), b()];
      return [[m(`${vu(p)}.X`)], [`${vu(q)}.X`]];
    },
    () => {
      const [p, q, r] = [b(), b(), b()];
      return [[m(`${vbin(p)}.X.Y`), m(`${vbin(q)}.Y.Z`)], [`${vbin(r)}.X.Z`]];
    },
    () => {
      const [p, q, r] = [b(), b(), b()];
      return [[m(`${vu(p)}.X`), not_(`${vu(q)}.X`)], [`${vu(r)}.X`]];
    },
    () => {
      const [p, v] = [b(), b()];
      return [[m(`${vu(p)}.X`)], [`slot.X!${vk(v)}`]];
    },
  ]);
}

/** Une opération : insertions/retraits fondés, insertions exclusives (ombres d'éviction, ⊥). */
function genViewOp(rng: Rng): Outcome {
  const b = () => rng.u8();
  return rng.oneOf<Outcome>([
    () => {
      const [p, c] = [b(), b()];
      return oInsert(`${vu(p)}.${vk(c)}`);
    },
    () => {
      const [p, c, d] = [b(), b(), b()];
      return oInsert(`${vbin(p)}.${vk(c)}.${vk(d)}`);
    },
    () => {
      const [p, c] = [b(), b()];
      return oInsert(`${vu(p)}!${vk(c)}`);
    },
    () => {
      const [p, c] = [b(), b()];
      return oDelete(`${vu(p)}.${vk(c)}`);
    },
    () => {
      const [c, v] = [b(), b()];
      return oInsert(`slot.${vk(c)}!${vk(v)}`);
    },
  ]);
}

// R: view_invariant.rs view_equals_naive_after_every_perform
test('view_invariant.rs (proptest) : LA LOI PHARE — vue == fermeture naïve après chaque effet', () => {
  property('view_invariant.view_equals_naive_after_every_perform', (rng) => {
    const rules = rng.vec(0, 4, () => genViewRuleSpec(rng));
    const ops = rng.vec(0, 14, () => genViewOp(rng));
    const st = new State();
    st.setAxioms(rules.map(([when, then]) => axiom(when, then)));
    assert.deepEqual(st.labeledView(), st.naiveView(), 'invariant broke at build');
    for (const o of ops) {
      st.performOutcome(o);
      const view = st.labeledView();
      assert.deepEqual(view, st.naiveView(), `view != naive after ${JSON.stringify(o)}`);
      // La continuation après ⊥ est hors contrat ; on s'arrête après le pas ⊥ (déjà vérifié égal).
      if (view.includes('contradiction')) break;
    }
  });
});

// R: view_invariant.rs generator_reaches_both_monotone_and_non_monotone
test('view_invariant.rs (proptest) : les mondes monotones ET non monotones sont atteints', () => {
  property('view_invariant.generator_reaches_both_monotone_and_non_monotone', (rng) => {
    const s = rng.u8();
    // monotone : p.X -> q.X ; non monotone : p.X, Not r.X -> q.X
    const mono = new State();
    mono.setAxioms([axiom([m('p.X')], ['q.X'])]);
    const nonmono = new State();
    nonmono.setAxioms([axiom([m('p.X'), not_('r.X')], ['q.X'])]);
    const fact = oInsert(`p.${vk(s)}`);
    mono.performOutcome(fact);
    nonmono.performOutcome(fact);
    assert.deepEqual(mono.labeledView(), mono.naiveView());
    assert.deepEqual(nonmono.labeledView(), nonmono.naiveView());
  });
});

// ---- extension demandée : l'invariant sur les mondes LIVRÉS ----

/**
 * Le pendant « monde réel » de la loi phare (le fragment S7 annoncé par
 * view_invariant.rs) : des marches aléatoires dans chaque monde livré, sur la boucle
 * de `Prax.Stress.runRandom` (advance → actions possibles → choix au hasard), en
 * vérifiant `labeledView() == naiveView()` après chaque `advance` (frontières de tour,
 * calendrier, expirations) et après chaque action.
 * Deux écarts voulus avec runRandom : (1) le choix passe par le PRNG mulberry32 du
 * fichier — le LCG MMIX de `pick` alterne son bit de poids faible, si bien qu'avec
 * deux candidats les marches seraient périodiques ; (2) l'acteur peut aussi PASSER
 * (un candidat de plus) — sinon, dans `feud`, alice fait toujours amende honorable
 * au premier tour et la vendetta (9 axiomes) se dissout avant d'avoir circulé.
 * Renvoie le nombre d'actions jouées (garde contre une marche vide).
 */
function walkChecksView(name: string, make: () => State, seeds: number, cap: number): number {
  let played = 0;
  for (let sd = 1; sd <= seeds; sd++) {
    const rng = new Rng(hashName(name) ^ Math.imul(sd, 7919));
    const st = make();
    assert.deepEqual(st.labeledView(), st.naiveView(), `${name}: view != naive at build`);
    let passes = 0;
    for (let k = cap; k > 0; ) {
      if (st.dbChildKeys('ending').length > 0) break;
      const living = st.livingCharacterCount();
      if (living === 0 || passes > living) break;
      const actor = advance(st);
      assert.deepEqual(st.labeledView(), st.naiveView(), `${name} (graine ${sd}): view != naive after advance (turn ${st.currentTurn()})`);
      const acts = st.possibleActions(actor.name);
      if (acts.length === 0) {
        passes++;
        continue;
      }
      passes = 0;
      k--;
      const i = rng.int(acts.length + 1);
      if (i === acts.length) continue; // passe volontaire
      st.performAction(acts[i]);
      played++;
      assert.deepEqual(st.labeledView(), st.naiveView(), `${name} (graine ${sd}): view != naive after ${acts[i].label}`);
    }
  }
  return played;
}

/** [nom, constructeur, nombre de marches, choix par marche]. */
const SHIPPED: ReadonlyArray<[string, () => State, number, number]> = [
  ['feud', feudWorld, 20, 100],
  ['bigFeud(6)', () => bigFeud(6), 20, 100],
  ['intrigue', intrigueWorld, 20, 100],
  ['bar', barWorld, 4, 100],
  ['bar-director', barDirectorWorld, 4, 100],
  ['village', villageWorld, 2, 60],
  ['play', playWorld, 20, 100],
  ['audience', audienceWorld, 20, 100],
  ['vampire', () => vampireWorld(TEST_SCALE), 4, 100],
];

for (const [name, make, seeds, cap] of SHIPPED) {
  // R: view_invariant.rs view_equals_naive_after_every_perform (extension demandée : mondes livrés)
  test(`view_invariant.rs (mondes livrés) : vue == fermeture naïve à chaque pas d’une marche — ${name}`, () => {
    assert.ok(walkChecksView(name, make, seeds, cap) > 0, `${name}: the walks played no action`);
  });
}
