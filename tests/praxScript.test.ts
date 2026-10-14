/**
 * Portage TypeScript des tests de la couche « script » de Prax (Rust, BSD-3-Clause) :
 *   - prax-script/src/script.rs, compile.rs, json.rs (modules #[cfg(test)], épingles natives) ;
 *   - conformance/src/script_spec.rs (`Prax.ScriptSpec`) ;
 *   - conformance/src/script_json_spec.rs (`Prax.Script.JsonSpec`) ;
 *   - conformance/src/script_supersession.rs (CG-1, la loi de supersession par données écrites).
 * prax-worlds/src/play.rs et audience.rs n'ont pas de tests.
 *
 * Les fonctions privées de compile.rs (`setup_of`, `compile_beat`, `story_clause`,
 * `bake_actor`) ne sont pas exportées par src/prax/script/compile.ts : leurs épingles
 * sont portées par la surface publique qui les expose fidèlement (les actions compilées
 * de `practiceDefs()`, les clauses de `scheduleSrc()`), mêmes valeurs attendues.
 *
 * Chaque test garde sa référence d'origine (`// R:` et, s'il y en a, `// H:`).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { GroundedAction, State } from '../src/prax/core/engine';
import { WorldError, WorldErrorKind } from '../src/prax/core/errors';
import { deserializeState, serializeState } from '../src/prax/core/persist';
import { CalcOp, Condition, absent, calc, cmp, count, eq, exists, matches, neq, not_, or_, subquery } from '../src/prax/core/query';
import { advance, npcAct } from '../src/prax/core/turn';
import { Outcome, call, del, forEach, insert, insertFor, want } from '../src/prax/core/types';
import { BEATS_PRACTICE, STORY_RULE, compile, currentSceneOf, flowChart } from '../src/prax/script/compile';
import { decodeScript, encodeScript } from '../src/prax/script/json';
import {
  Script,
  after,
  beat,
  concernedWith,
  ending,
  goto,
  member,
  player,
  quip,
  scene,
  script,
  scriptPlayer,
  timeout,
  wanting,
  withTraits,
} from '../src/prax/script/script';
import { adjustScore } from '../src/prax/vocab/coreModel';
import { audienceWorld } from '../src/prax/worlds/audience';
import { playScript, playWorld } from '../src/prax/worlds/play';

const RACINE = process.env.PRAX_RACINE ?? join(__dirname, '..', '..');
const fixture = (name: string): string => readFileSync(join(RACINE, 'tests', 'fixtures', 'prax', name), 'utf8');

// ---- aides communes -----------------------------------------------------------

/** Rust `assert!(matches!(compile(&scr).err(), Some(WorldError::<kind> { .. })))`. */
function assertCompileFails(scr: Script, kind: WorldErrorKind, details?: Record<string, unknown>): void {
  assert.throws(
    () => compile(scr),
    (e: unknown) => {
      assert.ok(e instanceof WorldError, `attendu un WorldError, obtenu ${String(e)}`);
      assert.equal(e.kind, kind, `variante : ${e.message}`);
      if (details !== undefined) assert.deepEqual({ ...e.details }, details);
      return true;
    },
  );
}

/** Le `WorldError` levé par `compile` (Rust `expect_err`). */
function compileErr(scr: Script): WorldError {
  try {
    compile(scr);
  } catch (e) {
    if (e instanceof WorldError) return e;
    throw e;
  }
  assert.fail('compile aurait dû échouer');
}

/** La fin atteinte, s'il y en a une (le gelé `endingOf`). */
const endingOf = (st: State): string | null => st.dbChildKeys('ending')[0] ?? null;

/** Une action disponible du personnage dont l'étiquette contient `needle` (le gelé `actionMatching`). */
function actionMatching(st: State, who: string, needle: string): GroundedAction {
  const acts = st.possibleActions(who);
  const ga = acts.find((g) => g.label.includes(needle));
  if (ga === undefined) throw new Error(`no action for ${who} matching ${JSON.stringify(needle)}; had: ${JSON.stringify(acts.map((g) => g.label))}`);
  return ga;
}

function act(st: State, who: string, needle: string): void {
  st.performAction(actionMatching(st, who, needle));
}

/**
 * Fait tourner la simulation, `idle` (le joueur) n'agissant jamais et les autres
 * pilotés par le planificateur, jusqu'à une fin, jusqu'à ce que `target` soit la scène
 * courante, ou pendant `k` avances (le gelé `driveIdle`).
 */
function driveIdle(st: State, target: string | null, idle: string, k: number): void {
  for (let i = 0; i < k; i++) {
    if (endingOf(st) !== null) return;
    if (currentSceneOf(st) === target) return;
    const actor = advance(st);
    if (actor.name !== idle) npcAct(st, 2, actor);
  }
}

/** L'état mené jusqu'au banquet, Marcus inactif. */
function atBanquet(): State {
  const st = playWorld();
  driveIdle(st, 'banquet', 'marcus', 20);
  return st;
}

const beatsLabels = (st: State): string[] => {
  const p = st.practiceDefs().get(BEATS_PRACTICE);
  assert.ok(p !== undefined, 'la pratique beats existe');
  return p.actions.map((a) => a.name);
};

// =============================================================================
// prax-script/src/script.rs — module #[cfg(test)]
// =============================================================================

// R: script.rs a_character_sketch_compiles_concerns_to_wants_and_traits_to_facts
// H: ScriptSpec.hs "a character sketch compiles concerns to wants and traits to facts"
test('script.rs : un croquis de personnage compile les préoccupations en envies et les traits en faits', () => {
  const cm = withTraits(concernedWith(member('vain'), [['beauty', 50]]), ['proud']);
  assert.deepEqual(cm.desires, [want([matches('Other.relationship.vain.beauty.score!N'), neq('Other', 'vain'), cmp('gt', 'N', '0')], 50)]);
  assert.deepEqual(cm.traits, ['proud']);
});

// R: script.rs script_player_takes_the_first_playable_member_and_is_loud_without_one
test('script.rs : scriptPlayer prend le premier membre jouable et est bruyant sans', () => {
  const scr = script('s', [member('a'), player('b'), player('c')]);
  assert.equal(scriptPlayer(scr), 'b');
  const none = script('s', [member('a')]);
  assert.throws(
    () => scriptPlayer(none),
    (e: unknown) => e instanceof WorldError && e.kind === 'NoPlayableCastMember',
  );
});

// R: script.rs the_sketch_combinators_append_rather_than_replace
test('script.rs : les combinateurs de croquis AJOUTENT au lieu de remplacer', () => {
  const c = withTraits(withTraits(concernedWith(wanting(member('x'), [want([], 1)]), [['favor', 10]]), ['a']), ['b']);
  assert.equal(c.desires.length, 2, "the plain want AND the concern's want");
  assert.deepEqual(c.traits, ['a', 'b']);
});

// =============================================================================
// prax-script/src/compile.rs — module #[cfg(test)]
// =============================================================================

/**
 * Un script à deux scènes dont tous les ordres sont non triviaux : scènes, temps forts
 * et jonctions déclarés hors de l'ordre alphabétique, et chaque scène porte une jonction
 * minutée et une mise en place écrite.
 */
function orderingProbe(): Script {
  return script(
    'zeta',
    [player('p'), member('q')],
    [
      scene('zeta', {
        setup: [insert('zSetup')],
        beats: [quip('q', '[Actor]: zeta-second', [not_('done')], []), beat('zeta-first', [], [])],
        junctions: [goto('zOut', 'alpha', [matches('go')]), after('zWait', 3, 'alpha')],
      }),
      scene('alpha', {
        setup: [insert('aSetup')],
        beats: [beat('alpha-only', [], [])],
        junctions: [timeout('aEnd', 2)],
      }),
    ],
  );
}

// R: compile.rs o1_compiled_action_labels_are_scene_major_then_beat_declaration_order
test('compile.rs : O1 — étiquettes compilées scène-majeur puis ordre de déclaration des temps forts', () => {
  const st = compile(orderingProbe());
  assert.deepEqual(
    beatsLabels(st),
    ['q: zeta-second', 'zeta-first', 'alpha-only'],
    'scene declaration order outermost, beat declaration order within (NOT alphabetical, NOT beats-major)',
  );
});

// R: compile.rs o3_scene_entry_arms_patience_markers_before_the_authored_setup
test('compile.rs : O3 — l’entrée de scène arme les marqueurs de patience AVANT la mise en place écrite', () => {
  // Rust : `setup_of(&scr.scenes, "zeta")` (privée). Observée ici par le corps d'une clause
  // de transition VERS `zeta` : [Insert currentScene!zeta] ++ setup_of(zeta) (O6). La sonde
  // reçoit une scène supplémentaire, déclarée en dernier, dont la seule jonction mène à zeta.
  const base = orderingProbe();
  const scr = script(base.start, base.cast, [...base.scenes, scene('omega', { junctions: [goto('toZeta', 'zeta', [])] })]);
  const st = compile(scr);
  const body = st.scheduleSrc()[0].body;
  assert.equal(body.length, 4);
  const [entry, ...setupOfZeta] = body[3][1];
  assert.deepEqual(entry, insert('currentScene!zeta'));
  assert.deepEqual(setupOfZeta, [insertFor(3, 'scenePatience.zeta.zWait'), insert('zSetup')]);
});

// R: compile.rs o4_a_compiled_beat_gates_scene_then_cast_then_speaker_then_author
test('compile.rs : O4 — un temps fort compilé garde scène, puis distribution, puis locuteur, puis auteur', () => {
  // Rust : `compile_beat("zeta", &b)` (privée) ; observée par les actions compilées.
  const b = quip('q', '[Actor]: say', [not_('done')], [insert('said')]);
  const st = compile(script('zeta', [], [scene('zeta', { beats: [b, beat('plain', [], [])] })]));
  const acts = st.practiceDefs().get(BEATS_PRACTICE)?.actions ?? [];
  const a = acts[0];
  assert.equal(a.name, 'q: say');
  assert.deepEqual(a.when, [matches('currentScene!zeta'), matches('character.Actor'), eq('Actor', 'q'), not_('done')]);
  assert.deepEqual(a.then, [insert('said')]);
  // et un temps fort sans locuteur ne porte aucune garde `Eq`
  const open = acts[1];
  assert.equal(open.name, 'plain');
  assert.deepEqual(open.when, [matches('currentScene!zeta'), matches('character.Actor')]);
});

// R: compile.rs o5_o6_the_story_clause_guard_and_body_orders
test('compile.rs : O5/O6 — ordres de la garde et du corps d’une clause de story', () => {
  // Rust : `story_clause(&scr.scenes, sid, j)` (privée) ; observée par les clauses de la
  // règle `story` compilée (une par (scène, jonction), déclaration × déclaration).
  const st = compile(orderingProbe());
  const body = st.scheduleSrc()[0].body;
  const [guard, outs] = body[1]; // after "zWait" 3 "alpha"
  assert.deepEqual(guard, [
    matches('currentScene!zeta'),
    absent([matches('ending.E')]),
    // the author's own `when` would sit here (this junction has none)
    not_('scenePatience.zeta.zWait'),
  ]);
  assert.deepEqual(
    outs,
    [insert('currentScene!alpha'), insertFor(2, 'scenePatience.alpha.aEnd'), insert('aSetup')],
    "the scene switch precedes the destination's entry outcomes",
  );

  // an author's own `when` sits between the two standing gates and the patience `Not`
  const [untimed, endBody] = body[2];
  assert.deepEqual(untimed, [matches('currentScene!alpha'), absent([matches('ending.E')]), not_('scenePatience.alpha.aEnd')]);
  assert.deepEqual(endBody, [insert('ending!aEnd')]);
});

// R: compile.rs o7_the_compile_time_setup_fold_asserts_stage_cast_traits_and_scene_entry
test('compile.rs : O7 — le pli de mise en place affirme scène, distribution, traits et entrée de scène', () => {
  const scr = script('s', [withTraits(player('p'), ['bold', 'shy'])], [scene('s', { setup: [insert('here')] })]);
  const st = compile(scr);
  const facts = st.labeledFacts();
  for (const f of ['practice.beats.stage', 'character.p', 'trait.p.bold', 'trait.p.shy', 'currentScene!s', 'here']) {
    assert.ok(facts.includes(f), `${f} in setup, got ${JSON.stringify(facts)}`);
  }
});

// R: compile.rs the_five_compile_guards_fire_in_the_frozen_order
test('compile.rs : les cinq gardes de compile tirent dans l’ordre gelé', () => {
  // 1 avant 2 : une scène avec un nom dupliqué ET un délai nul.
  const dupAndZero = script('a', [player('p')], [scene('a', { junctions: [timeout('dup', 0), ending('dup', [])] })]);
  assertCompileFails(dupAndZero, 'DuplicateJunctionName');

  // DANS la garde 1 : le PREMIER nom dupliqué ALPHABÉTIQUEMENT, pas le premier déclaré.
  const twoDups = script('a', [player('p')], [scene('a', { junctions: [ending('zed', []), ending('abe', []), ending('zed', []), ending('abe', [])] })]);
  assertCompileFails(twoDups, 'DuplicateJunctionName', { scene: 'a', junction: 'abe' });

  // 2 avant 3 : une jonction à délai nul ET une lecture de patience écrite.
  const zeroAndPatience = script('a', [player('p')], [scene('a', { junctions: [timeout('t', 0), ending('e', [matches('scenePatience.a.t')])] })]);
  assertCompileFails(zeroAndPatience, 'ZeroDelayJunction');

  // 3 avant 4 : une écriture de patience ET une variable Prax dans la mise en place.
  const patienceAndClash = script('a', [player('p')], [scene('a', { setup: [insert('scenePatience.a.x'), insert('mood.PraxNow')] })]);
  assertCompileFails(patienceAndClash, 'ReservedFamilyAuthored');

  // DANS la garde 3 : le balayage est LISTE-MAJEUR (toutes les mises en place avant tout `when`).
  const listMajor = script(
    'a',
    [player('p')],
    [scene('a', { junctions: [goto('j', 'b', [matches('scenePatience.a.j')])] }), scene('b', { setup: [insert('scenePatience.b.k')] })],
  );
  assertCompileFails(listMajor, 'ReservedFamilyAuthored', { site: 'scene "b"\'s setup', sentence: 'scenePatience.b.k', family: 'scenePatience' });

  // 4 avant 5 : `a` a un `when` de jonction fautif ; `b` une mise en place fautive — `b` gagne.
  const setupBeforeJunction = script(
    'a',
    [player('p')],
    [scene('a', { junctions: [goto('j', 'b', [matches('chapter!PraxNow')])] }), scene('b', { setup: [insert('flag.PraxE')] })],
  );
  const e = compileErr(setupBeforeJunction);
  assert.equal(e.kind, 'ReservedVarClash', `expected a ReservedVarClash, got ${e.kind}`);
  assert.equal(e.details.var, 'PraxE');
  assert.ok(String(e.details.extra).includes('"b"\'s setup'), `got ${JSON.stringify(e.details.extra)}`);
});

// R: compile.rs the_patience_sweep_reproduces_the_frozen_count_read_hole
test('compile.rs : le balayage de patience reproduit le trou de lecture gelé de Count', () => {
  const counted = script('a', [player('p')], [scene('a', { junctions: [ending('e', [count('N', 'scenePatience.a.e')])] })]);
  assert.doesNotThrow(
    () => compile(counted),
    "the frozen guard does not see a Count's sentence operand, and neither does this one -- a READ hole, and CG-1 is unaffected because the WRITE side is complete",
  );
});

// R: compile.rs bake_actor_replaces_every_occurrence_left_to_right_without_rescanning
test('compile.rs : bakeActor remplace chaque occurrence de gauche à droite sans re-balayer', () => {
  // Rust : `bake_actor(speaker, label)` (privée). Observée par le nom de l'action compilée
  // d'une réplique (`quip`), qui est exactement `bake_actor(speaker, label)`.
  const bake = (speaker: string, label: string): string => {
    const names = beatsLabels(compile(script('s', [], [scene('s', { beats: [quip(speaker, label, [], [])] })])));
    assert.equal(names.length, 1);
    return names[0];
  };
  assert.equal(bake('q', '[Actor]: greet'), 'q: greet');
  // pas en tête, et plus d'une fois
  assert.equal(bake('q', 'the [Actor] greets [Actor]'), 'the q greets q');
  // un locuteur dont le nom contient le jeton : le texte inséré n'est jamais re-balayé
  assert.equal(bake('[Actor]x', '[Actor]!'), '[Actor]x!');
  // aucun jeton : verbatim
  assert.equal(bake('q', 'plain label'), 'plain label');
});

// R: compile.rs flow_chart_renders_the_exact_mermaid_graph
test('compile.rs : flowChart rend exactement le graphe Mermaid', () => {
  const scr = script('act one', [], [scene('act one', { junctions: [goto('toB', 'act-two', [])] }), scene('act-two', { junctions: [ending('done', [])] })]);
  assert.equal(
    flowChart(scr),
    'graph TD\n' +
      '  _start((start)) --> act_one\n' +
      '  act_one["act one"]\n' +
      '  act_one -->|toB| act_two\n' +
      '  act_two["act-two"]\n' +
      '  act_two -->|done| _end_done((done))\n',
  );
});

// R: compile.rs the_story_rule_arrives_through_the_compiler_door_with_provenance
test('compile.rs : la règle story entre par la porte du compilateur, avec provenance', () => {
  const st = compile(orderingProbe());
  assert.deepEqual([...st.engineRuleNames], ['story']);
  assert.equal(st.scheduleSrc().length, 1);
  assert.equal(st.scheduleSrc()[0].name, STORY_RULE);
  assert.equal(st.scheduleSrc()[0].period, 1);
  // une clause par (scène, jonction), déclaration × déclaration
  assert.equal(st.scheduleSrc()[0].body.length, 3);
});

// R: compile.rs a_script_world_has_no_die_so_its_setup_provably_drew_nothing
test('compile.rs : un monde de script n’a pas de dé, donc sa mise en place n’a rien tiré', () => {
  const st = compile(orderingProbe());
  assert.equal(st.rngSeed, null);
  assert.equal(
    st.practiceDefs().get(BEATS_PRACTICE)?.initOutcomes.length,
    0,
    'the compiled beats practice has no init outcomes, which is why the frozen setup-roll scan is vacuous for script worlds',
  );
});

// =============================================================================
// prax-script/src/json.rs — module #[cfg(test)]
// =============================================================================

const EVERY_CONDITION: Condition[] = [
  matches('a.b!c'),
  not_('d'),
  eq('X', 'y'),
  neq('X', 'z'),
  cmp('gte', 'N', '3'),
  calc('R', 'mod', '17', '5'),
  count('N', 'S'),
  subquery('S', ['C'], [matches('at.C!P')]),
  or_([[matches('p')], [not_('q')]]),
  absent([matches('e')]),
  exists([matches('f')]),
];
const EVERY_OUTCOME: Outcome[] = [
  insert('i'),
  del('d'),
  insertFor(3, 'mood!a'),
  call('f', ['x']),
  forEach([matches('at.W!P')], [insert('W.saw')]),
  { t: 'roll', num: 1, den: 4, when: [matches('t.T')], then: [insert('T.angry')] },
];

function everyConstructorScript(): Script {
  return script(
    's',
    [wanting(player('p'), [want(EVERY_CONDITION, 100)])],
    [
      scene('s', {
        opening: 'o',
        setup: EVERY_OUTCOME,
        beats: [quip('p', 'l', EVERY_CONDITION, EVERY_OUTCOME)],
        junctions: [goto('g', 's', EVERY_CONDITION), timeout('t', 5)],
      }),
    ],
  );
}

/** Vérifie récursivement que chaque objet a ses clés en ordre trié (unités UTF-16 = octets en ASCII). */
function assertSortedKeys(v: unknown, path = '$'): void {
  if (Array.isArray(v)) {
    v.forEach((x, i) => assertSortedKeys(x, `${path}[${i}]`));
    return;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v);
    const sorted = [...ks].sort();
    assert.deepEqual(ks, sorted, `clés non triées en ${path}`);
    for (const k of ks) assertSortedKeys((v as Record<string, unknown>)[k], `${path}.${k}`);
  }
}

// R: json.rs serde_json_objects_sort_their_keys
test('json.rs : (adapté) les objets émis par l’encodeur ont leurs clés triées', () => {
  // Le test Rust épingle un risque propre à Cargo (`serde_json/preserve_order` activé par
  // unification de features, qui ferait passer `Map` en ordre d'insertion). Il n'a pas
  // d'équivalent TS ; on épingle son INTENTION : la sortie de `encodeScript` a des clés
  // triées à tous les niveaux. `JSON.parse` conserve l'ordre d'émission des clés non
  // numériques, et le schéma n'en a aucune de numérique.
  assert.equal(JSON.stringify(JSON.parse('{"b":1,"a":2}')), '{"b":1,"a":2}', 'JSON.parse conserve l’ordre du document (prémisse de la vérification)');
  assertSortedKeys(JSON.parse(encodeScript(playScript())));
  assertSortedKeys(JSON.parse(encodeScript(everyConstructorScript())));
});

/** Décode une condition par tout le chemin du document (là où un fichier l'atteint). */
function cond(json: string): Condition {
  const raw = `{"start":"a","cast":[],"scenes":[{"id":"a","junctions":[
               {"name":"j","when":[${json}]}]}]}`;
  return decodeScript(raw).scenes[0].junctions[0].when[0];
}

// R: json.rs a_duplicated_json_key_resolves_to_the_first_occurrence
test('json.rs : une clé JSON dupliquée se résout à sa PREMIÈRE occurrence', () => {
  assert.deepEqual(cond('{"match":"first","match":"second"}'), matches('first'), "aeson keeps the FIRST duplicate key; serde_json's Map keeps the last");
  assert.deepEqual(cond('{"not":"n1","not":"n2"}'), not_('n1'));
});

// R: json.rs the_condition_probe_runs_in_chain_order_and_falls_through_on_malformed
test('json.rs : la sonde de condition suit l’ordre de la chaîne et se replie sur une charge mal formée', () => {
  // 1. la première clé est présente mais MAL FORMÉE : repli sur `not`
  assert.deepEqual(cond('{"match": 1, "not": "x"}'), not_('x'));
  // 2. les deux valides, ordre du document != ordre de la chaîne : la CHAÎNE gagne
  assert.deepEqual(cond('{"not": "y", "match": "x"}'), matches('x'));
  // 3. un `cmp` mal formé (deux éléments au lieu de trois) se replie sur `count`
  assert.deepEqual(cond('{"cmp": ["gt","a"], "count": ["R","s"]}'), count('R', 's'));
  // 4. un opérateur de comparaison INCONNU se replie aussi (pas d'erreur bruyante)
  assert.deepEqual(cond('{"cmp": ["gtt","a","b"], "match": "m"}'), matches('m'));
});

// R: json.rs the_outcome_probe_falls_through_a_malformed_payload
test('json.rs : la sonde d’effet se replie sur une charge mal formée', () => {
  const raw = `{"start":"a","cast":[],"scenes":[{"id":"a","setup":[
            {"insert": 5, "call": {"fn":"f","args":["x"]}}]}]}`;
  assert.deepEqual(decodeScript(raw).scenes[0].setup, [call('f', ['x'])]);
});

// R: json.rs an_explicit_null_reads_as_an_absent_optional_field
test('json.rs : un null explicite se lit comme un champ optionnel absent', () => {
  const raw = `{"start":"a","cast":[{"name":"p","playable":null,"desires":null,"traits":null}],
            "scenes":[{"id":"a","beats":null,"junctions":null,"setup":null,"opening":null}]}`;
  const scr = decodeScript(raw);
  assert.equal(scr.cast[0].playable, false);
  assert.ok(scr.cast[0].desires.length === 0 && scr.cast[0].traits.length === 0);
  const s = scr.scenes[0];
  assert.equal(s.opening, '');
  assert.ok(s.setup.length === 0 && s.beats.length === 0 && s.junctions.length === 0);
});

// R: json.rs unknown_keys_are_ignored_except_memories
test('json.rs : les clés inconnues sont ignorées (sauf memories)', () => {
  const raw = '{"start":"a","cast":[],"scenes":[{"id":"a","futureField":42}],"extra":1}';
  assert.doesNotThrow(() => decodeScript(raw));
});

// R: json.rs every_condition_and_outcome_constructor_round_trips
test('json.rs : chaque constructeur de condition et d’effet fait l’aller-retour', () => {
  const scr = everyConstructorScript();
  assert.deepEqual(decodeScript(encodeScript(scr)), scr);
});

// R: json.rs the_encoder_omits_absent_speaker_and_after_keys
test('json.rs : l’encodeur omet les clés speaker et after absentes', () => {
  const scr = script('s', [], [scene('s', { beats: [beat('l', [], [])], junctions: [ending('e', [])] })]);
  assert.equal(
    encodeScript(scr),
    '{"cast":[],"scenes":[{"beats":[{"effects":[],"label":"l","when":[]}],"id":"s","junctions":[{"name":"e","when":[]}],"opening":"","setup":[]}],"start":"s"}',
  );
});

// =============================================================================
// conformance/src/script_spec.rs — `Prax.ScriptSpec`
// =============================================================================

// R: script_spec.rs compile_the_start_scene_is_active_and_the_cast_is_present
// H: ScriptSpec.hs "compile: the start scene is active and the cast is present"
test('script_spec : compile — la scène de départ est active et la distribution présente', () => {
  const st = playWorld();
  assert.equal(currentSceneOf(st), 'confidence');
  assert.ok(st.dbHas('character.marcus'), 'marcus present');
  assert.ok(st.dbHas('character.cassia'), 'cassia present');
  // v46 : pas de gestionnaire d'histoire ; la distribution n'a que de vrais personnages
  assert.ok(!st.characters.some((c) => c.name === '_narrator'), 'no _narrator in the cast');
});

// R: script_spec.rs a_beat_fires_only_in_its_scene_and_applies_its_effects
// H: ScriptSpec.hs "a beat fires only in its scene and applies its effects"
test('script_spec : un temps fort ne tire que dans sa scène et applique ses effets', () => {
  const st = playWorld();
  act(st, 'cassia', 'confide');
  assert.ok(st.dbHas('confided'), 'confided asserted');
  assert.ok(st.dbHas('marcusKnows'), 'marcus now knows');
  assert.ok(!st.possibleActions('cassia').some((ga) => ga.label.includes('poison')), 'no banquet beats yet');
});

// R: script_spec.rs a_transition_junction_fires_silently_at_the_round_boundary
// H: ScriptSpec.hs "a transition junction fires silently at the round boundary (no story manager)"
test('script_spec : une jonction de transition tire en silence à la frontière de tour', () => {
  const st = playWorld();
  act(st, 'cassia', 'confide'); // confided holds
  st.roundBoundary(); // le moteur tire la règle story
  assert.equal(currentSceneOf(st), 'banquet', 'the scene advanced and no actor took a turn');
});

// R: script_spec.rs idle_player_the_plot_runs_to_betrayal_across_two_scenes
// H: ScriptSpec.hs "idle player: the plot runs to betrayal across two scenes"
test('script_spec : joueur inactif — l’intrigue va jusqu’à la trahison sur deux scènes', () => {
  const st = playWorld();
  driveIdle(st, null, 'marcus', 30);
  assert.equal(endingOf(st), 'betrayal');
  assert.equal(currentSceneOf(st), 'banquet', 'the transition happened');
});

// R: script_spec.rs the_player_can_warn_ending_loyalty
// H: ScriptSpec.hs "the player can warn: ending loyalty"
test('script_spec : le joueur peut avertir — fin loyauté', () => {
  const st = atBanquet();
  assert.equal(currentSceneOf(st), 'banquet');
  act(st, 'marcus', 'warn');
  driveIdle(st, null, 'marcus', 20);
  assert.equal(endingOf(st), 'loyalty');
});

// R: script_spec.rs the_player_can_strike_first_ending_complicity
// H: ScriptSpec.hs "the player can strike first: ending complicity"
test('script_spec : le joueur peut frapper le premier — fin complicité', () => {
  const st = atBanquet();
  act(st, 'marcus', 'own hand');
  driveIdle(st, null, 'marcus', 20);
  assert.equal(endingOf(st), 'complicity');
});

// R: script_spec.rs the_player_can_romance_the_conspirator
// H: ScriptSpec.hs "the player can romance the conspirator (as in Intrigue)"
test('script_spec : le joueur peut séduire la conspiratrice', () => {
  const st = atBanquet();
  act(st, 'marcus', 'charms');
  assert.ok(st.dbHas('bond.marcus.cassia.lovers'), `Marcus and Cassia become lovers, got ${JSON.stringify(st.labeledFacts())}`);
});

// R: script_spec.rs flow_chart_names_every_scene_and_junction
// H: ScriptSpec.hs "flowChart names every scene and junction"
test('script_spec : flowChart nomme chaque scène et chaque jonction', () => {
  const chart = flowChart(playScript());
  for (const needle of ['confidence', 'banquet', 'toBanquet', 'betrayal', 'loyalty', 'complicity', 'graph TD']) {
    assert.ok(chart.includes(needle), `${needle} in chart, got:\n${chart}`);
  }
});

// ---- fonctions de compilation Prompter ------------------------------------------

// R: script_spec.rs a_timed_junction_times_out_after_n_turns_of_inaction
// H: ScriptSpec.hs "a timed junction times out after N turns of inaction"
test('script_spec : une jonction minutée expire après N tours d’inaction', () => {
  const scr = script('wait', [player('p')], [scene('wait', { junctions: [timeout('gaveUp', 3)] })]);
  const st = compile(scr);
  driveIdle(st, null, 'p', 30); // personne n'agit ; l'horloge s'épuise
  assert.equal(endingOf(st), 'gaveUp');
});

// ---- la loi de story : une frontière, la machinerie de calendrier existante (v46) --

// R: script_spec.rs same_scene_co_enabled_junctions_first_in_authored_order_fires
// H: ScriptSpec.hs "same-scene co-enabled junctions: first in authored order fires, the eviction masks the second"
test('script_spec : jonctions co-activées d’une même scène — la première dans l’ordre écrit tire, l’éviction masque la seconde', () => {
  const scr = script(
    's',
    [player('p')],
    [scene('s', { junctions: [goto('toX', 'x', [matches('go')]), goto('toY', 'y', [matches('go')])] }), scene('x'), scene('y')],
  );
  const st = compile(scr);
  st.performOutcome(insert('go'));
  st.roundBoundary();
  assert.equal(currentSceneOf(st), 'x', 'not "y": authored order + eviction');
});

// R: script_spec.rs authored_order_not_alphabetical_resolves_a_simultaneous_enable
// H: ScriptSpec.hs "authored order, not alphabetical label order, resolves a simultaneous enable"
test('script_spec : l’ordre écrit, pas l’ordre alphabétique, départage une activation simultanée', () => {
  const scr = script(
    's',
    [player('p')],
    [scene('s', { junctions: [goto('zzz', 'x', [matches('go')]), goto('aaa', 'y', [matches('go')])] }), scene('x'), scene('y')],
  );
  const st = compile(scr);
  st.performOutcome(insert('go'));
  st.roundBoundary();
  assert.equal(currentSceneOf(st), 'x');
});

// R: script_spec.rs an_ending_masks_every_later_clause_in_the_same_boundary
// H: ScriptSpec.hs "an ending masks every later clause in the same boundary"
test('script_spec : une fin masque toute clause ultérieure de la même frontière', () => {
  const scr = script('s', [player('p')], [scene('s', { junctions: [ending('endHere', [matches('go')]), goto('toY', 'y', [matches('go')])] }), scene('y')]);
  const st = compile(scr);
  st.performOutcome(insert('go'));
  st.roundBoundary();
  assert.equal(endingOf(st), 'endHere');
  assert.equal(currentSceneOf(st), 's', 'the transition was masked');
});

// R: script_spec.rs cross_scene_cascade_traverses_a_pass_through_scene_in_one_boundary
// H: ScriptSpec.hs "cross-scene cascade: a pass-through scene traverses in one boundary (documented eager semantics)"
test('script_spec : cascade inter-scènes — une scène de passage est traversée en une frontière', () => {
  const scr = script(
    'a',
    [player('p')],
    [scene('a', { junctions: [goto('toB', 'b', [matches('go')])] }), scene('b', { junctions: [goto('toC', 'c', [matches('go')])] }), scene('c')],
  );
  const st = compile(scr);
  st.performOutcome(insert('go'));
  st.roundBoundary();
  assert.equal(currentSceneOf(st), 'c', 'traversed a->b->c in one boundary');
});

// ---- gardes de compile des jonctions minutées / marqueurs de patience (v50 T2) ----

// R: script_spec.rs compile_rejects_two_junctions_with_the_same_name_in_one_scene
// H: ScriptSpec.hs "compile rejects two junctions with the same name in one scene"
test('script_spec : compile refuse deux jonctions de même nom dans une scène', () => {
  const scr = script('a', [player('p')], [scene('a', { junctions: [ending('dup', [matches('x')]), ending('dup', [matches('y')])] })]);
  assertCompileFails(scr, 'DuplicateJunctionName');
});

// R: script_spec.rs compile_rejects_a_timeout_with_a_zero_delay
// H: ScriptSpec.hs "compile rejects a timeout with a zero delay (n=0 is a plain junction)"
test('script_spec : compile refuse un timeout à délai nul', () => {
  const scr = script('a', [player('p')], [scene('a', { junctions: [timeout('now', 0)] })]);
  assertCompileFails(scr, 'ZeroDelayJunction');
});

// R: script_spec.rs compile_rejects_an_after_goto_with_a_zero_delay
// H: ScriptSpec.hs "compile rejects an 'after' goto with a zero delay"
test('script_spec : compile refuse un goto « after » à délai nul', () => {
  const scr = script('a', [player('p')], [scene('a', { junctions: [after('toB', 0, 'b')] }), scene('b')]);
  assertCompileFails(scr, 'ZeroDelayJunction');
});

// R: script_spec.rs compile_rejects_an_authored_scene_patience_read_in_a_junction_condition
// H: ScriptSpec.hs "compile rejects an authored scenePatience read in a junction condition"
test('script_spec : compile refuse une lecture scenePatience écrite dans une condition de jonction', () => {
  const scr = script('a', [player('p')], [scene('a', { junctions: [ending('e', [matches('scenePatience.a.foo')])] })]);
  assertCompileFails(scr, 'ReservedFamilyAuthored');
});

// R: script_spec.rs compile_rejects_an_authored_scene_patience_write_in_a_scene_setup
// H: ScriptSpec.hs "compile rejects an authored scenePatience write in a scene setup"
test('script_spec : compile refuse une écriture scenePatience écrite dans une mise en place', () => {
  const scr = script('a', [player('p')], [scene('a', { setup: [insert('scenePatience.a.foo')] })]);
  assertCompileFails(scr, 'ReservedFamilyAuthored');
});

// R: script_spec.rs compile_rejects_an_authored_scene_patience_touch_in_a_beat_effect
// H: ScriptSpec.hs "compile rejects an authored scenePatience touch in a beat effect (a newly-swept list)"
test('script_spec : compile refuse un contact scenePatience dans un effet de temps fort', () => {
  const scr = script('a', [player('p')], [scene('a', { beats: [beat('meddle', [], [del('scenePatience.a.foo')])] })]);
  assertCompileFails(scr, 'ReservedFamilyAuthored');
});

// R: script_spec.rs compile_rejects_an_authored_scene_patience_touch_in_a_beat_condition
// H: ScriptSpec.hs "compile rejects an authored scenePatience touch in a beat condition (a newly-swept list)"
test('script_spec : compile refuse un contact scenePatience dans une condition de temps fort', () => {
  const scr = script('a', [player('p')], [scene('a', { beats: [beat('peek', [matches('scenePatience.a.foo')], [])] })]);
  assertCompileFails(scr, 'ReservedFamilyAuthored');
});

// R: script_spec.rs compile_rejects_an_authored_scene_patience_touch_in_a_cast_desire
// H: ScriptSpec.hs "compile rejects an authored scenePatience touch in a cast-desire condition (a newly-swept list, absence polarity)"
test('script_spec : compile refuse un contact scenePatience dans un désir de la distribution', () => {
  const scr = script('a', [player('p'), wanting(member('d'), [want([not_('scenePatience.a.foo')], 5)])], [scene('a')]);
  assertCompileFails(scr, 'ReservedFamilyAuthored');
});

// ---- v50 : les jonctions minutées chevauchent des marqueurs de patience ---------

// R: script_spec.rs the_audience_dismissed_fires_at_boundary_5_not_before
// H: ScriptSpec.hs "the audience: 'dismissed' fires at boundary 5, not before (the fidelity pin)"
test('script_spec : l’audience — « dismissed » tire à la frontière 5, pas avant', () => {
  const st = audienceWorld();
  for (let i = 0; i < 4; i++) st.roundBoundary();
  assert.equal(endingOf(st), null, 'patience still holds at boundary 4');
  st.roundBoundary();
  assert.equal(endingOf(st), 'dismissed', 'boundary 5: it ran out');
});

// R: script_spec.rs mid_scene_save_resume_reaches_the_same_timeout_boundary
// H: ScriptSpec.hs "mid-scene save/resume reaches the same timeout boundary (persistence symmetry)"
test('script_spec : sauvegarde/reprise en milieu de scène — même frontière d’expiration', () => {
  // Frontière 2 : en milieu de scène, marqueur armé et échéance EN ATTENTE.
  const mid = audienceWorld();
  mid.roundBoundary();
  mid.roundBoundary();
  assert.equal(endingOf(mid), null, 'no ending at boundary 2');

  // Sauvegarder et recharger sur un monde audience frais.
  const resumed = deserializeState(serializeState(mid), audienceWorld());
  resumed.roundBoundary();
  resumed.roundBoundary();
  assert.equal(endingOf(resumed), null, 'still holds at absolute boundary 4 after reload');
  resumed.roundBoundary();
  assert.equal(endingOf(resumed), 'dismissed', 'reaches dismissed at the SAME absolute boundary 5 (the pending patience expiry rode the save)');
});

// R: script_spec.rs a_timed_after_goto_fires_at_its_delay_boundary
// H: ScriptSpec.hs "a timed 'after' goto fires at its delay boundary"
test('script_spec : un goto minuté « after » tire à sa frontière de délai', () => {
  const scr = script('a', [player('p')], [scene('a', { junctions: [after('toB', 3, 'b')] }), scene('b')]);
  const st = compile(scr);
  st.roundBoundary();
  st.roundBoundary();
  assert.equal(currentSceneOf(st), 'a', 'not yet');
  st.roundBoundary();
  assert.equal(currentSceneOf(st), 'b', 'boundary 3: hands off');
});

// R: script_spec.rs re_entry_resets_a_timed_junction
// H: ScriptSpec.hs "re-entry resets a timed junction: it times out n from the LAST entry"
test('script_spec : la ré-entrée réarme une jonction minutée (n depuis la DERNIÈRE entrée)', () => {
  const scr = script(
    'a',
    [player('p')],
    [scene('a', { junctions: [goto('leave', 'b', [matches('leaveNow')]), timeout('out', 3)] }), scene('b', { junctions: [goto('back', 'a', [matches('backNow')])] })],
  );
  const st = compile(scr);
  st.roundBoundary(); // traîner en a
  st.performOutcome(insert('leaveNow'));
  st.roundBoundary(); // partir avant l'expiration
  assert.equal(currentSceneOf(st), 'b');
  st.performOutcome(del('leaveNow'));
  st.performOutcome(insert('backNow'));
  st.roundBoundary(); // ré-entrer en a
  assert.equal(currentSceneOf(st), 'a');
  // depuis la DERNIÈRE entrée l'horloge court 3 frontières fraîches
  st.roundBoundary();
  st.roundBoundary();
  assert.equal(endingOf(st), null);
  st.roundBoundary();
  assert.equal(endingOf(st), 'out');
});

// R: script_spec.rs early_exit_is_harmless_a_pending_patience_marker_fires_no_stray_junction
// H: ScriptSpec.hs "early exit is harmless: a pending patience marker fires no stray junction"
test('script_spec : une sortie précoce est inoffensive — un marqueur en attente ne tire aucune jonction égarée', () => {
  const scr = script('a', [player('p')], [scene('a', { junctions: [goto('leave', 'b', [matches('leaveNow')]), timeout('out', 3)] }), scene('b')]);
  const st = compile(scr);
  st.roundBoundary(); // traîner en a (marqueur à mi-vie)
  st.performOutcome(insert('leaveNow'));
  st.roundBoundary(); // partir avant l'expiration
  assert.equal(currentSceneOf(st), 'b');
  // dépasser l'échéance d'origine (frontière 3) : le marqueur périmé expire en `b`
  for (let i = 0; i < 5; i++) st.roundBoundary();
  assert.equal(endingOf(st), null);
});

// R: script_spec.rs two_timed_junctions_on_one_scene_fire_independently
// H: ScriptSpec.hs "two timed junctions on one scene fire independently at their own delays"
test('script_spec : deux jonctions minutées d’une scène tirent indépendamment à leurs délais', () => {
  const scr = script('a', [player('p')], [scene('a', { junctions: [after('quick', 2, 'b'), after('slow', 4, 'c')] }), scene('b'), scene('c')]);
  const st = compile(scr);
  st.roundBoundary();
  assert.equal(currentSceneOf(st), 'a', 'boundary 1: neither yet');
  st.roundBoundary();
  assert.equal(currentSceneOf(st), 'b', 'boundary 2: `quick` (delay 2) fired');
});

// R: script_spec.rs a_concern_actually_drives_behaviour
// H: ScriptSpec.hs "a concern actually drives behaviour"
test('script_spec : une préoccupation pilote réellement le comportement', () => {
  const scr = script(
    's',
    [player('p'), concernedWith(member('vain'), [['beauty', 50]])],
    [scene('s', { beats: [quip('vain', '[Actor]: preen for p', [not_('preened')], [insert('preened'), adjustScore('p', 'vain', 'beauty', 5, 'dazzled')])] })],
  );
  const st = compile(scr);
  driveIdle(st, null, 'p', 12);
  assert.ok(st.dbHas('preened'), 'trait/desire wiring lets vain be moved by regard: it preens');
});

// R: script_spec.rs same_labelled_quips_by_different_speakers_dispatch_to_their_own_effects
// H: ScriptSpec.hs "same-labelled quips by different speakers dispatch to their own effects"
test('script_spec : des répliques de même étiquette par des locuteurs différents déclenchent leurs propres effets', () => {
  const scr = script(
    's',
    [member('a'), member('b')],
    [scene('s', { beats: [quip('a', '[Actor]: act', [], [insert('aDid')]), quip('b', '[Actor]: act', [], [insert('bDid')])] })],
  );
  const st = compile(scr);
  act(st, 'b', 'act');
  assert.ok(st.dbHas('bDid'), "b's beat set b's fact");
  assert.ok(!st.dbHas('aDid'), "b's beat did NOT run a's beat");
});

// ---- l'audience : une histoire qui utilise les trois fonctions ensemble ----------

// R: script_spec.rs the_audience_dawdling_lets_the_clock_run_out_to_dismissed
// H: ScriptSpec.hs "the audience: dawdling lets the clock run out to 'dismissed'"
test('script_spec : l’audience — traîner laisse l’horloge courir jusqu’à « dismissed »', () => {
  const st = audienceWorld();
  driveIdle(st, null, 'envoy', 40);
  assert.equal(endingOf(st), 'dismissed');
});

// R: script_spec.rs the_audience_flatter_then_petition_reaches_granted
// H: ScriptSpec.hs "the audience: flatter then petition reaches 'granted'"
test('script_spec : l’audience — flatter puis présenter la requête mène à « granted »', () => {
  const st = audienceWorld();
  act(st, 'envoy', 'flatter');
  act(st, 'envoy', 'petition');
  driveIdle(st, null, 'envoy', 15);
  assert.equal(endingOf(st), 'granted');
});

// R: script_spec.rs the_audience_the_dukes_concern_moves_him_once
// H: ScriptSpec.hs "the audience: the Duke's concern moves him (once)"
test('script_spec : l’audience — la préoccupation du Duc le fait agir (une fois)', () => {
  const st = audienceWorld();
  driveIdle(st, null, 'envoy', 6);
  assert.ok(st.dbHas('dukeSpoke'), 'the Duke, concerned for favour, flattered unbidden');
  assert.ok(!st.possibleActions('duke').some((ga) => ga.label.includes('flatter')), "and the one-shot held: no flatter left on the Duke's menu");
});

// R: script_spec.rs the_sketch_reaches_the_compiled_world_as_facts_and_wants
test('script_spec : le croquis atteint le monde compilé comme faits et envies', () => {
  const scr = script('s', [withTraits(concernedWith(member('vain'), [['beauty', 50]]), ['proud'])], [scene('s')]);
  const st = compile(scr);
  assert.ok(st.dbHas('trait.vain.proud'), 'the trait is a queryable fact');
  const vain = st.characters.find((c) => c.name === 'vain');
  assert.ok(vain !== undefined, 'vain is in the cast');
  assert.deepEqual(vain.wants, [want([matches('Other.relationship.vain.beauty.score!N'), neq('Other', 'vain'), cmp('gt', 'N', '0')], 50)]);
});

// R: script_spec.rs the_audience_carries_a_pending_expiry_before_any_turn_runs
test('script_spec : l’audience porte une échéance en attente avant tout tour', () => {
  const st = audienceWorld();
  assert.deepEqual([...st.expiriesRendered()], [['scenePatience.audience.dismissed', 5]], "the start scene's timed junction armed its marker during compile");
});

// R: script_spec.rs the_shipped_script_worlds_compile_to_these_exact_action_labels
test('script_spec : les mondes de script livrés compilent en ces étiquettes exactes', () => {
  assert.deepEqual(beatsLabels(playWorld()), [
    'cassia: confide the plot against artus to marcus',
    "cassia: slip poison into artus's cup",
    'marcus: warn artus that cassia means to kill him',
    'marcus: poison artus with your own hand',
    "marcus: warm to cassia's charms",
  ]);
  assert.deepEqual(beatsLabels(audienceWorld()), ['envoy: flatter the king', 'envoy: present your petition', 'duke: flatter the king']);
});

// R: script_spec.rs the_compiled_world_holds_exactly_one_engine_rule_named_story
test('script_spec : le monde compilé détient exactement une règle moteur nommée story', () => {
  const st = playWorld();
  assert.deepEqual([...st.engineRuleNames], ['story']);
  assert.deepEqual(
    st.scheduleSrc().map((r) => r.name),
    ['story'],
  );
});

// R: script_spec.rs the_audiences_story_clauses_carry_the_patience_guard_only_where_timed
test('script_spec : les clauses story de l’audience ne portent la garde de patience que si minutées', () => {
  const st = audienceWorld();
  const body = st.scheduleSrc()[0].body;
  assert.equal(body.length, 2, 'one clause per junction');
  // `granted` n'est pas minutée : deux gardes permanentes plus le `when` de l'auteur
  assert.deepEqual(body[0][0], [matches('currentScene!audience'), absent([matches('ending.E')]), matches('petitioned')]);
  assert.deepEqual(body[0][1], [insert('ending!granted')]);
  // `dismissed` est minutée : pas de `when` écrit, et le `Not` de patience déployé depuis `after: 5`
  assert.deepEqual(body[1][0], [matches('currentScene!audience'), absent([matches('ending.E')]), not_('scenePatience.audience.dismissed')]);
  assert.deepEqual(body[1][1], [insert('ending!dismissed')]);
});

// R: script_spec.rs a_transition_clause_re_arms_the_destinations_patience_marker
test('script_spec : une clause de transition réarme le marqueur de patience de la destination', () => {
  const scr = script('a', [player('p')], [scene('a', { junctions: [goto('toB', 'b', [matches('go')])] }), scene('b', { junctions: [timeout('out', 4)] })]);
  const st = compile(scr);
  assert.deepEqual(
    st.scheduleSrc()[0].body[0][1],
    [insert('currentScene!b'), insertFor(4, 'scenePatience.b.out')],
    "the transition arms the destination's marker, so every entry path (compile-time start, transition, re-entry) threads through the same scene-entry outcomes",
  );
});

// =============================================================================
// conformance/src/script_json_spec.rs — `Prax.Script.JsonSpec`
// =============================================================================

const SHIPPED_PLAY_JSON = (): string => fixture('play.json');

/** Aller-retour d'une liste de conditions par un document entier. */
function roundTripConditions(cs: Condition[]): readonly Condition[] {
  const scr = script('a', [], [scene('a', { junctions: [ending('e', cs)] })]);
  return decodeScript(encodeScript(scr)).scenes[0].junctions[0].when;
}

function roundTripOutcomes(os: Outcome[]): readonly Outcome[] {
  const scr = script('a', [], [scene('a', { setup: os })]);
  return decodeScript(encodeScript(scr)).scenes[0].setup;
}

// R: script_json_spec.rs a_play_script_round_trips_through_json_exactly
// H: Script/JsonSpec.hs "a play-script round-trips through JSON exactly"
test('script_json_spec : un script de pièce fait l’aller-retour JSON à l’identique', () => {
  assert.deepEqual(decodeScript(encodeScript(playScript())), playScript());
});

// R: script_json_spec.rs the_decoded_script_still_compiles_to_a_runnable_world
// H: Script/JsonSpec.hs "the decoded script still compiles to a runnable world"
test('script_json_spec : le script décodé compile toujours en un monde jouable', () => {
  const scr = decodeScript(encodeScript(playScript()));
  const st = compile(scr);
  assert.equal(currentSceneOf(st), 'confidence');
});

// R: script_json_spec.rs malformed_json_reports_an_error_rather_than_failing_silently
// H: Script/JsonSpec.hs "malformed JSON reports an error rather than failing silently"
test('script_json_spec : un JSON mal formé signale une erreur au lieu d’échouer en silence', () => {
  assert.throws(
    () => decodeScript('{ "start": 3 }'),
    (e: unknown) => e instanceof Error && e.message.length > 0,
  );
});

// R: script_json_spec.rs every_calc_op_round_trips_through_json_mod_included
// H: Script/JsonSpec.hs "every CalcOp round-trips through JSON, Mod included"
test('script_json_spec : chaque CalcOp fait l’aller-retour JSON, Mod compris', () => {
  const ops: CalcOp[] = ['add', 'sub', 'mul', 'mod'];
  const cs = ops.map((op) => calc('R', op, '17', '5'));
  assert.deepEqual(roundTripConditions(cs), cs);
});

// R: script_json_spec.rs a_for_each_outcome_round_trips_through_json
// H: Script/JsonSpec.hs "a ForEach outcome round-trips through JSON"
test('script_json_spec : un effet ForEach fait l’aller-retour JSON', () => {
  const o = forEach([matches('at.Witness!P'), neq('Witness', 'Actor')], [insert('Witness.believes.stole.Actor.loaf.seen')]);
  assert.deepEqual(roundTripOutcomes([o]), [o]);
});

// R: script_json_spec.rs an_insert_for_outcome_round_trips_through_json
// H: Script/JsonSpec.hs "an InsertFor outcome round-trips through JSON"
test('script_json_spec : un effet InsertFor fait l’aller-retour JSON', () => {
  const o = insertFor(3, 'mood!a');
  assert.deepEqual(roundTripOutcomes([o]), [o]);
});

// R: script_json_spec.rs a_roll_outcome_round_trips_through_json
// H: Script/JsonSpec.hs "a Roll outcome (the drama die, v50) round-trips through JSON"
test('script_json_spec : un effet Roll (le dé dramatique, v50) fait l’aller-retour JSON', () => {
  const o: Outcome = { t: 'roll', num: 1, den: 4, when: [matches('shortTempered.T')], then: [insert('T.feels.angry.toward.Actor')] };
  assert.deepEqual(roundTripOutcomes([o]), [o]);
});

// R: script_json_spec.rs a_timed_junctions_after_field_round_trips_through_json
// H: Script/JsonSpec.hs "a timed junction's \"after\" field round-trips through JSON"
test('script_json_spec : le champ « after » d’une jonction minutée fait l’aller-retour JSON', () => {
  const j = timeout('gaveUp', 5);
  const scr = script('a', [], [scene('a', { junctions: [j] })]);
  assert.deepEqual(decodeScript(encodeScript(scr)).scenes[0].junctions, [j]);
});

// R: script_json_spec.rs decoding_and_compiling_the_json_repro_rejects_the_prax_namespaced_goto
// H: Script/JsonSpec.hs "decoding+compiling the reviewer's JSON repro rejects the Prax-namespaced goto condition (guard-trigger, at the JSON authoring surface FromJSON Junction decodes straight into)"
test('script_json_spec : décoder+compiler la repro JSON refuse le goto à variable Prax', () => {
  const json = `{ "start": "a",
              "cast": [ { "name": "p", "playable": true } ],
              "scenes": [
                { "id": "a", "junctions": [
                    { "name": "go", "to": "b", "when":
                        [ { "match": "chapter!PraxNow" } ] } ] },
                { "id": "b" } ] }`;
  const scr = decodeScript(json); // le document se décode
  // la garde vit au point de CONSOMMATION : toute voie d'écriture y passe
  assertCompileFails(scr, 'ReservedVarClash');
});

// R: script_json_spec.rs a_scene_json_carrying_a_removed_memories_field_is_rejected_loudly
// H: Script/JsonSpec.hs "a scene JSON carrying a removed \"memories\" field is rejected loudly, not silently ignored"
test('script_json_spec : une scène JSON portant le champ retiré « memories » est refusée bruyamment', () => {
  const json = `{ "start": "a",
              "cast": [ { "name": "p", "playable": true } ],
              "scenes": [
                { "id": "a", "memories": [ "artus.confided" ] } ] }`;
  assert.throws(
    () => decodeScript(json),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.ok(e.message.includes('memories'), `the error should name the removed memories feature: ${e.message}`);
      return true;
    },
  );

  // DIV-5 : la garde se déclenche sur la CLÉ, null compris (le gelé l'accepte).
  const withNull = '{ "start": "a", "cast": [], "scenes": [ { "id": "a", "memories": null } ] }';
  assert.throws(
    () => decodeScript(withNull),
    (e: unknown) => {
      assert.ok(e instanceof Error, 'DIV-5: the Rust guard fires on the key, null included');
      assert.ok(e.message.includes('memories'), e.message);
      return true;
    },
  );
});

// R: script_json_spec.rs the_shipped_examples_play_json_decodes_and_compiles
// H: Script/JsonSpec.hs "the shipped examples/play.json decodes and compiles"
test('script_json_spec : examples/play.json livré se décode et compile', () => {
  const scr = decodeScript(SHIPPED_PLAY_JSON());
  const st = compile(scr);
  assert.notEqual(currentSceneOf(st), null, 'compiles to a scene-bearing world');
});

// R: script_json_spec.rs the_shipped_file_is_the_encoders_own_output_byte_for_byte
test('script_json_spec : le fichier livré EST la sortie de l’encodeur, octet pour octet', () => {
  const shipped = SHIPPED_PLAY_JSON();
  const emitted = `${encodeScript(playScript())}\n`;
  assert.equal(Buffer.byteLength(emitted, 'utf8'), Buffer.byteLength(shipped, 'utf8'), 'byte length: encoder vs file');
  assert.equal(emitted, shipped);
  assert.equal(Buffer.byteLength(shipped, 'utf8'), 2122);
});

// R: script_json_spec.rs the_shipped_file_decodes_to_exactly_the_worlds_own_script
test('script_json_spec : le fichier livré se décode EXACTEMENT en le script du monde', () => {
  assert.deepEqual(decodeScript(SHIPPED_PLAY_JSON()), playScript());
});

// =============================================================================
// conformance/src/script_supersession.rs — CG-1
// =============================================================================

/** Le chemin que l'entrée de scène arme et que le temps fort ré-insère à nu. */
const LANTERN = 'lantern.lit';
/** La durée de vie écrite par l'`insertFor` du script. */
const LIFETIME = 3;

const cg1Script = (): Script => decodeScript(fixture('cg1_supersession.json'));
const cg1World = (): State => compile(cg1Script());

function shield(st: State): GroundedAction {
  const ga = st.possibleActions('q').find((g) => g.label.includes('shield'));
  assert.ok(ga !== undefined, 'q can shield the lantern');
  return ga;
}

// R: script_supersession.rs a_script_can_author_a_timer_and_a_bare_insert_onto_the_same_path
test('script_supersession : un script peut écrire un minuteur et une insertion nue sur le même chemin', () => {
  const scr = cg1Script();
  assert.deepEqual(scr.scenes[0].setup, [insertFor(LIFETIME, LANTERN)], 'the scene setup arms its own timer');
  assert.ok(
    scr.scenes[0].beats[0].effects.some((o) => o.t === 'insert' && o.s === LANTERN),
    `the beat bare-inserts the very path the setup armed, got ${JSON.stringify(scr.scenes[0].beats[0].effects)}`,
  );

  const st = cg1World();
  assert.equal(currentSceneOf(st), 'vigil');
  assert.equal(st.expiriesRendered().get(LANTERN), LIFETIME, 'compile ran the authored InsertFor and the timer is live at t=0');
});

// R: script_supersession.rs the_authored_timer_fires_on_schedule_when_nothing_touches_it
test('script_supersession : le minuteur écrit tire à l’heure quand rien n’y touche', () => {
  const st = cg1World();
  for (let b = 1; b < LIFETIME; b++) {
    st.roundBoundary();
    assert.ok(st.dbHas(LANTERN), `the lantern still burns at boundary ${b}`);
    assert.equal(endingOf(st), null, 'and the story runs on');
  }
  st.roundBoundary();
  assert.ok(!st.dbHas(LANTERN), `the authored timer expired at boundary ${LIFETIME}`);
  assert.equal(endingOf(st), 'darkness', 'and the junction reading its absence ended the story');
});

// R: script_supersession.rs a_beats_bare_insert_supersedes_the_scripts_own_authored_timer
test('script_supersession : l’insertion nue d’un temps fort supplante le minuteur écrit du script', () => {
  const st = cg1World();
  assert.ok(st.expiriesRendered().has(LANTERN), 'precondition: the authored timer is live before the beat');

  st.performAction(shield(st));

  assert.ok(!st.expiriesRendered().has(LANTERN), "the beat's BARE insert superseded the pending expiry: the due is gone");
  for (let i = 0; i < 8; i++) st.roundBoundary();
  assert.ok(st.dbHas(LANTERN), 'the superseded fact still stands eight boundaries later -- more than twice the lifetime the script armed it with');
  assert.equal(endingOf(st), null, 'and the ending the CONTROL reaches at boundary 3 never comes');
});

// R: script_supersession.rs re_arming_the_authored_timer_refreshes_rather_than_supersedes
test('script_supersession : réarmer le minuteur écrit le RAFRAÎCHIT au lieu de le supplanter', () => {
  const st = cg1World();
  st.roundBoundary();
  st.roundBoundary();
  const refreshedDue = st.currentTurn() + LIFETIME;
  st.performOutcome(insertFor(LIFETIME, LANTERN));
  assert.equal(st.expiriesRendered().get(LANTERN), refreshedDue, 'the timer is RE-ARMED at the new due, not cancelled');
  for (let i = 0; i < LIFETIME; i++) st.roundBoundary();
  assert.ok(!st.dbHas(LANTERN), 'a refreshed lantern still goes out -- only a BARE insert supersedes');
});

// R: script_supersession.rs the_scripts_own_timer_is_the_one_the_law_is_about
test('script_supersession : le minuteur du script est le seul dont parle la loi', () => {
  const st = cg1World();
  assert.deepEqual([...st.expiriesRendered().keys()], [LANTERN], 'the only live expiry is the one the author wrote');
  assert.ok(
    cg1Script().scenes[0].junctions.every((j) => j.after === null),
    'no timed junction, so no scenePatience marker anywhere',
  );
});
