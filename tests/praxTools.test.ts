/**
 * Portage TypeScript des tests de l'outillage de Prax (Rust, BSD-3-Clause) :
 *   - prax-core/src/persist.rs  (module #[cfg(test)]) ;
 *   - prax-core/src/inspect.rs  (module #[cfg(test)]) ;
 *   - prax-core/src/stress.rs   (module #[cfg(test)]) ;
 *   - conformance/src/persist_spec.rs (`Prax.PersistSpec` ré-exprimé sur le format JSON) ;
 *   - prax-cli/src/main.rs (module #[cfg(test)]) — la CLI TS est tools/prax/cli.ts.
 *
 * Chaque test garde sa référence d'origine (`// R:` et, s'il y en a, `// H:`).
 *
 * Adaptations au portage TS :
 *   - Persistance : même forme JSON que le Rust ; l'étiquette ÉCRITE est
 *     `prax-ts-state v1` (l'étiquette Rust `prax-rs-state v1` est acceptée en
 *     lecture). Les trois variantes Rust de `PersistError` (UnsupportedVersion,
 *     Malformed, UnknownScheduleRule) deviennent un `WorldError` de kind
 *     'PersistFormat' ; la variante se lit au message (« unsupported save
 *     format » / « malformed save » / « unknown schedule rule »), que les tests
 *     Rust épinglaient déjà par sous-chaîne.
 *   - Pas d'interneur en TS : le risque [S-I1] (ré-internement) n'existe pas,
 *     mais les épingles restent (elles disent aussi « l'action stockée est
 *     toujours offerte, la signature survit au rechargement »).
 *   - Le proptest `deserialize_of_serialize_is_the_identity` devient une boucle
 *     déterministe (mulberry32 à graine fixe) + les quatre coins du domaine.
 *   - `world_named(&[..])` (tranche d'arguments) -> `worldNamed(arg | undefined)`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { insert as dbInsert } from '../src/prax/core/db';
import { State } from '../src/prax/core/engine';
import { WorldError } from '../src/prax/core/errors';
import { explain } from '../src/prax/core/inspect';
import { tokenize } from '../src/prax/core/path';
import { FORMAT_VERSION, deserializeState, serializeState } from '../src/prax/core/persist';
import { groundedActionEq, motiveSignatureEq } from '../src/prax/core/planner';
import { matches } from '../src/prax/core/query';
import { lcg, pick, preAdvanceStop, stressTest } from '../src/prax/core/stress';
import { advance, npcAct, runNpcTicks } from '../src/prax/core/turn';
import { Character, Outcome, action, character, insert, insertFor, practice, scheduleRule } from '../src/prax/core/types';
import { compile, flowChart } from '../src/prax/script/compile';
import { beat, goto, member, player, scene, script } from '../src/prax/script/script';
import { encodeScript } from '../src/prax/script/json';
import { DIRECTOR_NAME, barDirectorWorld } from '../src/prax/worlds/bar';
import { intrigueWorld } from '../src/prax/worlds/intrigue';
import { barWorld } from '../src/prax/worlds/bar';
import { playWorld } from '../src/prax/worlds/play';
import { villageWorld } from '../src/prax/worlds/village';
import { playScript } from '../src/prax/worlds/play';
import { playerActions, renderCheck, renderStress, worldNamed } from '../tools/prax/cli';

const RACINE = process.env.PRAX_RACINE ?? join(__dirname, '..', '..');
const FIXTURES = join(RACINE, 'tests', 'fixtures', 'prax');

// ---- aides communes -----------------------------------------------------------

/** Rust `Outcome::Roll(num, den, conds, outs)`. */
const roll = (num: number, den: number, then: readonly Outcome[] = []): Outcome => ({ t: 'roll', num, den, when: [], then });

/** Un refus de chargement : WorldError 'PersistFormat' dont le message porte `needle`. */
function persistError(needle: string): (e: unknown) => boolean {
  return (e: unknown) => {
    assert.ok(e instanceof WorldError, `WorldError attendu, reçu ${String(e)}`);
    assert.equal(e.kind, 'PersistFormat', `kind 'PersistFormat' attendu, reçu ${e.kind} (${e.message})`);
    assert.ok(e.message.includes(needle), `le message doit contenir ${JSON.stringify(needle)} : ${e.message}`);
    return true;
  };
}

function characterOf(st: State, name: string): Character {
  const c = st.characters.find((x) => x.name === name);
  if (c === undefined) throw new Error(`no ${name} in world`);
  return c;
}

// =============================================================================
// prax-core/src/persist.rs — module #[cfg(test)]
// =============================================================================

// R: persist.rs round_trips_a_seeded_mutated_state
test('persist.rs : un état semé et modifié fait l’aller-retour', () => {
  const st = new State();
  st.seedDie(1988);
  st.performOutcome(insert('a.b.c'));
  st.performOutcome(insert('m!x'));
  const reloaded = deserializeState(serializeState(st), new State());
  assert.deepEqual(reloaded.labeledFacts(), st.labeledFacts());
  assert.equal(reloaded.rngSeed, st.rngSeed);
  assert.equal(reloaded.cursor, st.cursor);
});

// R: persist.rs a_foreign_version_tag_is_a_loud_unsupported_error
test('persist.rs : une étiquette de version étrangère est un refus bruyant « unsupported »', () => {
  assert.throws(() => deserializeState('{"version":"prax-state v0","cursor":0}', new State()), persistError('unsupported save format'));
});

// R: persist.rs empty_input_is_a_loud_malformed_error
test('persist.rs : une entrée vide est un refus bruyant « malformed »', () => {
  assert.throws(() => deserializeState('', new State()), persistError('malformed save'));
});

// =============================================================================
// conformance/src/persist_spec.rs — `Prax.PersistSpec` (groupe "Prax.Persist")
// =============================================================================

/** Un état d'intrigue en cours d'épisode (le gelé `mid = snd (runNpcTicks 2 3 intrigueWorld)`). */
function mid(): State {
  const st = intrigueWorld();
  runNpcTicks(st, 2, 3);
  return st;
}

/** Le même état sauvegardé puis rechargé sur une copie fraîche du monde. */
function reloaded(): State {
  return deserializeState(serializeState(mid()), intrigueWorld());
}

// R: persist_spec.rs round_trips_the_fact_database_and_cursor_exactly
// H: PersistSpec.hs "save/load round-trips the fact database and cursor exactly"
test('persist_spec.rs : sauvegarde/chargement restitue exactement la base et le curseur', () => {
  const m = mid();
  const r = deserializeState(serializeState(m), intrigueWorld());
  assert.deepEqual(r.labeledFacts(), m.labeledFacts());
  assert.equal(r.cursor, m.cursor);
});

// R: persist_spec.rs round_trips_an_asserted_interior_node_with_transient_children
// H: PersistSpec.hs "save/load round-trips an asserted interior node with transient children (marks included)"
test('persist_spec.rs : un nœud intérieur affirmé à enfants transitoires survit (marques comprises)', () => {
  // Une instance de pratique est un fait affirmé qui a AUSSI des enfants ; la marque
  // d'affirmation doit survivre, sinon l'instance revient comme simple échafaudage.
  // Injection brute (le gelé `insertAll` sur la base, pas un perform).
  const withInstance = mid();
  withInstance.withDb((db) => {
    let d = db;
    for (const s of ['practice.tendBar.bar.ada', 'practice.tendBar.bar.ada.customer.you']) d = dbInsert(d, tokenize(s));
    return d;
  });
  const reloadedInst = deserializeState(serializeState(withInstance), intrigueWorld());
  assert.deepEqual(reloadedInst.labeledFacts(), withInstance.labeledFacts());
  assert.ok(
    reloadedInst.labeledFacts().includes('practice.tendBar.bar.ada'),
    'the asserted instance re-emits as its own fact after reload',
  );
});

// R: persist_spec.rs round_trips_standing_intentions_exactly
// H: PersistSpec.hs "save/load round-trips standing intentions exactly"
test('persist_spec.rs : les intentions en cours font l’aller-retour exactement', () => {
  // « Exactement » au domaine des noms : la sérialisation est canonique par contenu.
  const m = mid();
  const r = deserializeState(serializeState(m), intrigueWorld());
  assert.equal(serializeState(r), serializeState(m));
  assert.ok(m.intentionsMap().size > 0, 'the mid state must actually carry standing intentions, or this pin is vacuous');
});

// R: persist_spec.rs a_reloaded_standing_intention_is_served_without_re_deliberating
// H: PersistSpec.hs "a reloaded standing intention is served without re-deliberating"
test('persist_spec.rs : une intention rechargée est servie sans re-délibérer', () => {
  // (1) Même décision que l'original (comparaison par libellé, comme le Rust).
  const midClone = mid();
  const midReloaded = reloaded();
  const marcus = characterOf(midReloaded, 'marcus');
  const cont = npcAct(midClone, 2, marcus)?.label ?? null;
  const relo = npcAct(midReloaded, 2, marcus)?.label ?? null;
  assert.equal(cont, 'marcus: bide your time');
  assert.equal(relo, cont, 'the reloaded state makes the same decision');

  // (2) Un personnage dont l'intention stockée EST réutilisée après rechargement :
  // la signature de motifs d'artus égale celle fraîchement calculée ET son action
  // stockée est toujours offerte — les deux égalités qui font que npcAct la réutilise.
  const reloaded2 = reloaded();
  const artus = characterOf(reloaded2, 'artus');
  const intent = reloaded2.intentionOf('artus');
  assert.ok(intent !== undefined, 'artus carries a standing intention after reload');
  const sig = reloaded2.motiveSignature(artus);
  assert.ok(motiveSignatureEq(intent.basis, sig), 'the MotiveSignature survives the re-intern (basis == fresh sig)');
  const ga = intent.act;
  assert.ok(ga !== null, 'artus’ stored intention has an action');
  assert.ok(
    reloaded2.candidateActions(artus).some((g) => groundedActionEq(g, ga)),
    'the stored GroundedAction is still offered after the re-intern (content-canonical equality)',
  );
});

// R: persist_spec.rs a_reloaded_session_continues_identically
// H: PersistSpec.hs "a reloaded session continues identically (Marcus can still warn)"
test('persist_spec.rs : une session rechargée continue à l’identique (Marcus peut encore prévenir)', () => {
  const r = reloaded();
  const ga = r.possibleActions('marcus').find((g) => g.label.includes('warn artus'));
  assert.ok(ga !== undefined, 'marcus can warn artus after reload');
  r.performAction(ga);
  assert.ok(r.dbHas('ending.loyalty'), 'reaches the loyalty ending after reload');
});

// R: persist_spec.rs the_serialized_form_is_human_readable_label_faithful_facts
// H: PersistSpec.hs "the serialized form is human-readable, label-faithful facts"
test('persist_spec.rs : la forme sérialisée est lisible et fidèle aux étiquettes', () => {
  const text = serializeState(mid());
  assert.ok(text.includes('marcus.believes.plotAgainst.artus!yes'), 'carries the belief Marcus formed, label-faithful');
  assert.ok(text.includes('"cursor"'), 'has a cursor field');
});

// --- v43 : l'en-tête de version du format ---------------------------------------
// H: PersistSpec.hs "v43: the save-format version header (previously latent: a save from another era misparsed silently)"

// R: persist_spec.rs the_serialized_form_carries_the_format_version_tag
// H: PersistSpec.hs "the serialized form's first line is the format version tag"
test('persist_spec.rs : la forme sérialisée porte l’étiquette de version du format', () => {
  // Adaptation TS : l'étiquette écrite est celle du portage.
  assert.equal(FORMAT_VERSION, 'prax-ts-state v1');
  const text = serializeState(mid());
  assert.ok(text.includes(FORMAT_VERSION), 'the version tag is present');
  const v = JSON.parse(text) as { version?: unknown };
  assert.equal(v.version, FORMAT_VERSION);
});

// R: persist_spec.rs the_serialized_form_carries_the_format_version_tag (adaptation TS)
test('persist_spec.rs (adaptation TS) : une sauvegarde à l’étiquette Rust `prax-rs-state v1` se relit', () => {
  // Le format TS reprend la forme JSON du Rust ; l'étiquette Rust est acceptée en
  // lecture. Même document, étiquette Rust : rechargement identique.
  const m = mid();
  const doc = JSON.parse(serializeState(m)) as Record<string, unknown>;
  doc.version = 'prax-rs-state v1';
  const r = deserializeState(JSON.stringify(doc), intrigueWorld());
  assert.equal(serializeState(r), serializeState(m));
});

// R: persist_spec.rs a_header_with_no_cursor_is_a_loud_malformed_error
// H: PersistSpec.hs "a header with no cursor line is a loud, malformed-save error"
test('persist_spec.rs : un en-tête sans curseur est un refus bruyant « malformed »', () => {
  assert.throws(() => deserializeState(JSON.stringify({ version: FORMAT_VERSION }), intrigueWorld()), persistError('malformed save'));
});

// R: persist.rs SaveDoc (types serde : cursor i32, rng_seed Option<i64>, dues/expiries i64, IntentRepr) — adaptation TS
test('persist.rs (adaptation TS) : un champ mal typé est un refus « malformed », jamais une valeur devinée', () => {
  const base = JSON.parse(serializeState(mid())) as Record<string, unknown>;
  const name = Object.keys(base.intentions as object)[0];
  assert.ok(name !== undefined, 'l’état d’intrigue doit porter au moins une intention');
  const casse = (f: (d: Record<string, any>) => void): string => {
    const d = JSON.parse(JSON.stringify(base)) as Record<string, any>;
    f(d);
    return JSON.stringify(d);
  };
  const mauvais: Array<[string, string]> = [
    ['rng_seed chaîne', casse((d) => (d.rng_seed = 'abc'))],
    ['cursor fractionnaire', casse((d) => (d.cursor = 1.5))],
    ['cursor hors i32', casse((d) => (d.cursor = 2 ** 31))],
    ['expiration non numérique', casse((d) => (d.expiries = { 'x.y': 'z' }))],
    ['échéance non numérique', casse((d) => (d.dues = { règle: 'z' }))],
    ['intention sans bindings', casse((d) => (d.intentions[name] = { ...d.intentions[name], act: { practice_id: 'p', instance_id: 'i', action_id: 'a', label: 'l' } }))],
    ['intention sans bearing', casse((d) => delete d.intentions[name].bearing)],
    ['satisfaction négative', casse((d) => (d.intentions[name].satisfaction = [-1]))],
    ['valeur liée inconnue', casse((d) => (d.intentions[name].act = { practice_id: 'p', instance_id: 'i', action_id: 'a', label: 'l', bindings: [['X', { Autre: 1 }]] }))],
  ];
  for (const [quoi, texte] of mauvais) assert.throws(() => deserializeState(texte, intrigueWorld()), persistError('malformed save'), quoi);
  // Les formes que serde accepte restent acceptées : graine nulle ou absente, intention sans acte.
  assert.equal(deserializeState(casse((d) => (d.rng_seed = null)), intrigueWorld()).rngSeed, null);
  assert.doesNotThrow(() => deserializeState(casse((d) => (d.intentions[name].act = null)), intrigueWorld()));
});

/** Une sauvegarde portant `tag` comme version (toute ère étrangère) est refusée bruyamment. */
function assertUnsupported(tag: string): void {
  assert.throws(
    () => deserializeState(`{"version":${JSON.stringify(tag)},"cursor":0}`, intrigueWorld()),
    persistError('unsupported save format'),
    `expected unsupported-format rejection for ${JSON.stringify(tag)}`,
  );
}

// R: persist_spec.rs an_unsupported_format_version_v0_is_a_loud_version_mismatch
// H: PersistSpec.hs "an unsupported format version (prax-state v0) is a loud, version-mismatch error"
test('persist_spec.rs : la version prax-state v0 est refusée bruyamment', () => {
  assertUnsupported('prax-state v0');
});

// R: persist_spec.rs a_save_with_no_header_is_a_loud_malformed_error
// H: PersistSpec.hs "a save with no header at all is a loud, malformed-save error"
test('persist_spec.rs : une sauvegarde sans en-tête est un refus bruyant « malformed »', () => {
  assert.throws(() => deserializeState('', intrigueWorld()), persistError('malformed save'));
});

// R: persist_spec.rs the_previous_format_version_v1_is_rejected_loudly
// H: PersistSpec.hs "the previous format version (prax-state v1) is now rejected loudly"
test('persist_spec.rs : la version prax-state v1 est refusée bruyamment', () => {
  assertUnsupported('prax-state v1');
});

// R: persist_spec.rs the_format_version_v2_is_rejected
// H: PersistSpec.hs "the immediately-prior format version (prax-state v2) is rejected under v46's v3 bump"
test('persist_spec.rs : la version prax-state v2 est refusée', () => {
  assertUnsupported('prax-state v2');
});

// R: persist_spec.rs the_format_version_v3_is_rejected
// H: PersistSpec.hs "the immediately-prior format version (prax-state v3) is rejected under v50's v4 bump"
test('persist_spec.rs : la version prax-state v3 est refusée', () => {
  assertUnsupported('prax-state v3');
});

// --- v44 : la moitié « exécution » du calendrier (échéances + expirations) -----
// H: PersistSpec.hs "v44: the schedule's runtime half (per-rule dues + the expiry queue) round-trips"

/** Un monde qui déclare une règle de calendrier (`set_schedule` la cale une période plus loin). */
function beatWorld(): State {
  const st = new State();
  st.setSchedule([scheduleRule('beat', 3)]);
  return st;
}

// R: persist_spec.rs populated_dues_and_expiries_survive_save_load
// H: PersistSpec.hs "populated dues and expiries survive save/load; dues re-associate by name"
test('persist_spec.rs : échéances et expirations peuplées survivent ; les échéances se rattachent par nom', () => {
  const populated = beatWorld();
  populated.performOutcome(insertFor(6, 'mood!a'));
  assert.ok(populated.scheduleDues().size > 0, 'the schedule rule start-sates a due');
  assert.ok(populated.expiriesRendered().size > 0, 'the InsertFor arms an expiry');
  const r = deserializeState(serializeState(populated), beatWorld());
  assert.deepEqual(r.scheduleDues(), populated.scheduleDues());
  assert.deepEqual(r.expiriesRendered(), populated.expiriesRendered());
});

// Adaptation TS (revue Codex de la PR) : une sauvegarde qui omet l'échéance d'une
// règle déclarée ne doit pas désactiver cette règle en silence.
test('persist (adaptation TS) : une règle déclarée absente de la sauvegarde garde l’échéance du monde frais', () => {
  const doc = JSON.parse(serializeState(beatWorld())) as Record<string, unknown>;
  doc.dues = {};
  const r = deserializeState(JSON.stringify(doc), beatWorld());
  assert.deepEqual(r.scheduleDues(), beatWorld().scheduleDues());
  assert.ok(r.scheduleDues().has('beat'));
});

// R: persist_spec.rs a_due_naming_an_undeclared_rule_is_a_loud_error
// H: PersistSpec.hs "a due naming a rule the reloaded world does not declare is a loud error"
test('persist_spec.rs : une échéance qui nomme une règle non déclarée est un refus bruyant', () => {
  const save = JSON.stringify({ version: FORMAT_VERSION, cursor: 0, intentions: {}, dues: { ghost: 3 }, expiries: {}, facts: [] });
  assert.throws(() => deserializeState(save, intrigueWorld()), persistError('unknown schedule rule'));
});

// --- v50 : la position du dé dramatique (rngseed) --------------------------------
// H: PersistSpec.hs "v50: the drama die's stream position (rngseed) round-trips"

// R: persist_spec.rs a_seeded_mid_stream_state_round_trips_its_rngseed
// H: PersistSpec.hs "a seeded, mid-stream state round-trips its rngseed exactly"
test('persist_spec.rs : un état semé en cours de flux restitue exactement sa graine', () => {
  const st = new State();
  st.seedDie(1988);
  st.performOutcome(roll(1, 2, [insert('hit.mark')]));
  const r = deserializeState(serializeState(st), new State());
  assert.equal(r.rngSeed, st.rngSeed);
});

// R: persist_spec.rs an_unseeded_state_emits_no_rngseed
// H: PersistSpec.hs "an unseeded state emits no rngseed line"
test('persist_spec.rs : un état non semé n’écrit pas de rng_seed', () => {
  assert.ok(!serializeState(mid()).includes('rng_seed'), 'no rng_seed field for an unseeded (intrigue) save');
});

// R: persist_spec.rs mid_stream_save_resume_continues_the_stream_identically
// H: PersistSpec.hs "mid-stream save/resume continues the stream identically"
test('persist_spec.rs : reprendre en cours de flux continue le flux à l’identique', () => {
  const st1 = new State();
  st1.seedDie(1988);
  st1.performOutcome(roll(1, 2));
  const contReload = deserializeState(serializeState(st1), new State());
  const contDirect = st1.clone();
  contDirect.performOutcome(roll(1, 2));
  contReload.performOutcome(roll(1, 2));
  assert.equal(contReload.rngSeed, contDirect.rngSeed);
});

// --- la loi d'aller-retour (proptest) ---------------------------------------------

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
  /** Entier uniforme dans [lo, hi) — la plage Rust `lo..hi`. */
  range(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo));
  }
}

const PERSIST_CASES = Number(process.env.PRAX_PROPTEST_CASES ?? 256);

// R: persist_spec.rs deserialize_of_serialize_is_the_identity (proptest)
test('persist_spec.rs (proptest) : deserialize ∘ serialize est l’identité (domaine des noms)', () => {
  // ticks in 0..6, seed in 1..2147483562 : les quatre coins du domaine, puis des
  // cas tirés d'un PRNG à graine fixe.
  const cases: Array<[number, number]> = [
    [0, 1],
    [5, 1],
    [0, 2147483561],
    [5, 2147483561],
  ];
  const rng = new Rng(0x5eed_0043);
  for (let i = 0; i < PERSIST_CASES; i++) cases.push([rng.range(0, 6), rng.range(1, 2147483562)]);
  for (const [ticks, seed] of cases) {
    const st = intrigueWorld();
    st.seedDie(seed);
    runNpcTicks(st, 2, ticks);
    const once = serializeState(st);
    const twice = serializeState(deserializeState(once, intrigueWorld()));
    assert.equal(twice, once, `ticks=${ticks}, seed=${seed}`);
  }
});

// =============================================================================
// prax-core/src/inspect.rs — module #[cfg(test)]
// =============================================================================

// R: inspect.rs zero_role_practice_instance_has_no_dangling_separator
test('inspect.rs : l’instance d’une pratique sans rôle n’a pas de séparateur pendant', () => {
  const shrine = practice('shrine', { actions: [action('[Actor]: kneel', [], [insert('knelt.Actor')])] });
  const st = new State();
  st.definePractices([shrine]);
  st.performOutcome(insert('practice.shrine'));
  const out = explain(st, 'marcus', 'kneel').join('');
  assert.ok(
    out.includes('AVAILABLE'),
    `a spawned zero-role practice's action must be explainable — the instance query must be \`practice.shrine\`, not \`practice.shrine.\`: ${JSON.stringify(out)}`,
  );
});

// R: inspect.rs explain_reports_a_blocking_condition
test('inspect.rs : explain nomme la condition bloquante', () => {
  const gate = practice('gate', {
    roles: ['R'],
    actions: [action('[Actor]: pass', [matches('hasKey.Actor')], [insert('passed.Actor')])],
  });
  const st = new State();
  st.definePractices([gate]);
  st.performOutcome(insert('practice.gate.here'));
  const out = explain(st, 'bob', 'pass').join('');
  assert.ok(out.includes('blocked by') && out.includes('hasKey'), `the missing key must be named as the blocker: ${JSON.stringify(out)}`);
});

// =============================================================================
// prax-core/src/stress.rs — module #[cfg(test)]
// =============================================================================

// R: stress.rs lcg_step_is_the_mmix_recurrence
test('stress.rs : le pas du LCG est la récurrence MMIX', () => {
  const MASK = (1n << 64n) - 1n;
  assert.equal(lcg(0n), 1_442_695_040_888_963_407n);
  assert.equal(lcg(1n), (6_364_136_223_846_793_005n + 1_442_695_040_888_963_407n) & MASK);
});

// R: stress.rs pick_indexes_the_advanced_seed_not_the_current_one
test('stress.rs : pick indexe la graine avancée, pas la courante', () => {
  const [i, s] = pick(7, 0n);
  assert.equal(s, lcg(0n));
  assert.equal(i, Number(lcg(0n) % 7n));
});

// R: stress.rs pre_advance_stop_orders_cap_before_ending
test('stress.rs : preAdvanceStop place le plafond avant la fin', () => {
  // k == 0 est Cap même si une fin est présente (ordre gelé).
  assert.deepEqual(preAdvanceStop(0, 'x', 3, 0), { k: 'Cap' });
  assert.deepEqual(preAdvanceStop(5, 'x', 3, 0), { k: 'Ending', ending: 'x' });
  assert.deepEqual(preAdvanceStop(5, null, 0, 0), { k: 'Extinct' });
  assert.deepEqual(preAdvanceStop(5, null, 2, 3), { k: 'DeadEnd' });
  assert.equal(preAdvanceStop(5, null, 2, 2), null);
});

// =============================================================================
// prax-cli/src/main.rs — module #[cfg(test)] (CLI TS : tools/prax/cli.ts)
// =============================================================================
// prax-oracle/src/stress.rs — la spec gelée `Prax.StressSpec` sur l'agrégateur
// =============================================================================

/**
 * La reproduction v46 (constat 4) : la scène « s » n'offre aucun temps fort à sa
 * distribution, seulement une transition inconditionnelle en attente vers « s2 »
 * — on n'avance que par la règle `story` de la frontière de tour. Le détecteur
 * d'impasses doit la franchir.
 */
function deadEndRegressionWorld(): State {
  const scr = script('s', [player('p'), member('q')], [scene('s', { junctions: [goto('go', 's2', [])] }), scene('s2', { beats: [beat('linger', [], [])] })]);
  return compile(scr);
}

// R: stress.rs a_move_less_scene_with_a_pending_transition_is_not_a_false_positive
// H: StressSpec.hs "a move-less scene with a pending transition is not a stress-harness false positive: the dead-end detector must give the round boundary's wrap its turn before declaring deadlock (v46 review finding 4)"
test('StressSpec : une scène sans coup mais à transition en attente n’est pas une fausse impasse', () => {
  const r = stressTest(50, 40, 'currentScene', deadEndRegressionWorld());
  assert.equal(r.deadEnds, 0);
  assert.ok(r.visited.has('s2'), 's2 reached');
});

// R: stress.rs random_play_of_the_episode_no_dead_ends_both_branches
// H: StressSpec.hs "random play of the episode: no dead ends, both active branches reached"
test('StressSpec : jeu aléatoire de l’épisode — aucune impasse, les deux branches atteintes', () => {
  const r = stressTest(60, 40, 'currentScene', intrigueWorld());
  assert.equal(r.deadEnds, 0, 'no dead ends');
  assert.equal(r.noEnding, 0, 'no run stuck at the cap');
  assert.ok(r.endings.has('loyalty'), 'loyalty reached');
  assert.ok(r.endings.has('complicity'), 'complicity reached');
});

// R: stress.rs the_bar_survives_random_play
// H: StressSpec.hs "the bar survives random play with no dead ends and broad coverage"
test('StressSpec : le bar survit au jeu aléatoire, sans impasse et avec une large couverture', () => {
  const r = stressTest(20, 30, 'currentScene', barWorld());
  assert.equal(r.deadEnds, 0);
  assert.ok(r.coverage.size >= 10, `many distinct actions exercised: ${r.coverage.size}`);
});

// R: stress.rs scene_coverage_reaches_both_scenes_and_every_ending
// H: StressSpec.hs "scene coverage: random play reaches both scenes and every ending"
test('StressSpec : couverture des scènes — les deux scènes et chaque fin sont atteintes', () => {
  const r = stressTest(200, 50, 'currentScene', playWorld());
  assert.ok(r.visited.has('confidence'), 'confidence visited');
  assert.ok(r.visited.has('banquet'), 'banquet visited');
  for (const e of ['betrayal', 'loyalty', 'complicity']) assert.ok(r.endings.has(e), `${e} reached`);
  assert.equal(r.deadEnds, 0, 'no dead ends');
});

// R: stress.rs coverage_family_generalizes_past_current_scene
// H: StressSpec.hs "coverage family generalizes past Script's currentScene: the village's marketDay family is tracked when named, proving the second application"
test('StressSpec : la famille suivie se généralise au-delà de currentScene (marketDay du village)', () => {
  const r = stressTest(80, 60, 'marketDay', villageWorld());
  assert.ok(r.visited.has('square'), 'the market was observed open at least once');
});

// =============================================================================

// R: main.rs dump_play_is_byte_identical_to_the_shipped_example
test('main.rs : dump-play est identique à l’octet près à l’exemple livré', () => {
  // `prax dump-play` émet `encodeScript(...)` + un saut de ligne final.
  const shipped = readFileSync(join(FIXTURES, 'play.json'), 'utf8');
  assert.equal(`${encodeScript(playScript())}\n`, shipped);
});

// R: main.rs check_reports_every_shipped_world_well_formed
test('main.rs : check déclare bien formé chaque monde livré', () => {
  const cases: Array<[string | undefined, string]> = [
    [undefined, 'a night at the bar'],
    ['intrigue', 'Intrigue (Rome)'],
    ['play', 'the conspiracy (a play)'],
    ['village', 'the village'],
  ];
  for (const [arg, name] of cases) {
    const [n, world] = worldNamed(arg);
    assert.equal(n, name);
    assert.equal(renderCheck(n, world), `well-formed: ${name}\n`);
  }
});

// R: main.rs vampire_world_is_selectable
test('main.rs : le monde vampire est sélectionnable', () => {
  const [title, world, player] = worldNamed('vampire');
  assert.equal(title, 'the vampire village');
  assert.equal(player, 'bram');
  assert.ok(world.labeledFacts().some((f) => f === 'character.bram'), 'worldNamed("vampire") returns the vampire village');
});

// R: main.rs flow_renders_the_default_play_script
test('main.rs : flow rend la pièce par défaut (golden à l’octet près)', () => {
  const golden = readFileSync(join(FIXTURES, 'goldens', 'cli', 'flow-play.txt'), 'utf8');
  assert.equal(flowChart(playScript()), golden);
});

// R: main.rs stress_renders_a_deterministic_report
test('main.rs : stress rend un rapport déterministe (golden à l’octet près)', () => {
  const golden = readFileSync(join(FIXTURES, 'goldens', 'cli', 'stress-play.txt'), 'utf8');
  const [name, world] = worldNamed('play');
  assert.equal(renderStress(name, world), golden);
});

// R: main.rs player_actions_hide_no_ops_but_candidates_keep_them
test('main.rs : les actions sans effet sont cachées au joueur mais restent candidates', () => {
  const p = practice('idle', {
    roles: ['R'],
    actions: [action('[Actor]: do a thing', [], [insert('did.Actor')]), action('[Actor]: wait a moment', [], [])],
  });
  const st = new State();
  st.definePractices([p]);
  st.performOutcome(insert('practice.idle.here'));
  st.setCharacters([character('you')]);
  const you = characterOf(st, 'you');
  const cands = st.candidateActions(you);
  const player = playerActions(st, you);
  assert.ok(
    cands.some((g) => g.label.includes('wait a moment')),
    'the no-op stays an NPC candidate',
  );
  assert.ok(!player.some((g) => g.label.includes('wait a moment')), 'the no-op is hidden from the player');
  assert.ok(
    player.some((g) => g.label.includes('do a thing')),
    'the real action is still offered',
  );
});

// R: main.rs a_bound_player_sees_only_its_practices_affordances
test('main.rs : un joueur lié ne voit que les affordances de sa pratique', () => {
  const st = barDirectorWorld();
  const director = characterOf(st, DIRECTOR_NAME);
  assert.ok(director.boundTo !== null, 'the director is practice-bound');
  const bound = director.boundTo;
  for (const ga of playerActions(st, director)) {
    assert.equal(ga.practiceId, bound, 'a bound player is offered only its bound practice’s affordances');
  }
});

// R: main.rs resume_from_the_save_point_replays_the_advance
test('main.rs : reprendre au point de sauvegarde rejoue l’avance', () => {
  // Le point de sauvegarde est l'état AVANT d'avancer jusqu'au joueur ; le recharger
  // puis avancer retombe sur le MÊME acteur.
  const [, world, player] = worldNamed('intrigue');
  const st = world.clone();
  let savePoint: State;
  for (;;) {
    savePoint = st.clone();
    const actor = advance(st);
    if (actor.name === player) break;
  }
  const fresh = worldNamed('intrigue')[1];
  const resumed = deserializeState(serializeState(savePoint), fresh);
  const reActor = advance(resumed);
  assert.equal(reActor.name, player, 'resuming the save-point and re-advancing lands back on the player’s turn');
});
