/**
 * Abaisse un `Script` écrit en `State` prêt à jouer : la pratique `beats`, la
 * règle de calendrier `story` propre au compilateur, le pli d'entrée de scène,
 * et les cinq gardes d'hygiène devant tout cela.
 *
 * Les ordres générés (actions = scènes × temps forts ; clauses de `story` =
 * scènes × jonctions, pli avant et impatient ; marqueurs de patience AVANT la
 * mise en place écrite ; bascule de scène AVANT la mise en place de la
 * destination) font partie du contrat.
 *
 * Reprend `prax-script/src/compile.rs` (Prax, BSD-3-Clause).
 */
import { State, door } from '../core/engine';
import { worldErrors } from '../core/errors';
import { segmentNamesChecked } from '../core/path';
import { Condition, absent, condSents, eq, matches, not_ } from '../core/query';
import { CURRENT_SCENE_PATH, SCENE_PATIENCE_FAMILY, scenePatiencePath } from '../core/reserved';
import { Action, Outcome, Practice, action, authoredVarClash, character, insert, insertFor, outcomeSents, practice, scheduleRule } from '../core/types';
import { coreFns } from '../vocab/coreModel';
import { Beat, Junction, Scene, Script } from './script';

export const BEATS_PRACTICE = 'beats';
export const STORY_RULE = 'story';

const currentSceneFact = (sid: string): string => `${CURRENT_SCENE_PATH}!${sid}`;

/** L'identifiant de la scène courante, s'il y en a une. */
export function currentSceneOf(st: State): string | null {
  const ks = st.dbChildKeys(CURRENT_SCENE_PATH);
  return ks.length > 0 ? ks[0] : null;
}

const bakeActor = (speaker: string, label: string): string => label.split('[Actor]').join(speaker);

function authoredSentenceSites(scr: Script): Array<[string, string[]]> {
  const out: Array<[string, string[]]> = [];
  for (const s of scr.scenes) out.push([`scene ${JSON.stringify(s.id)}'s setup`, outcomeSents(s.setup)]);
  for (const s of scr.scenes) for (const j of s.junctions) out.push([`scene ${JSON.stringify(s.id)}'s junction ${JSON.stringify(j.name)} condition`, condSents(j.when)]);
  for (const s of scr.scenes) for (const b of s.beats) out.push([`scene ${JSON.stringify(s.id)}'s beat ${JSON.stringify(b.label)} condition`, condSents(b.when)]);
  for (const s of scr.scenes) for (const b of s.beats) out.push([`scene ${JSON.stringify(s.id)}'s beat ${JSON.stringify(b.label)} effect`, outcomeSents(b.effects)]);
  for (const c of scr.cast) for (const w of c.desires) out.push([`cast member ${JSON.stringify(c.name)}'s desire`, condSents(w.when)]);
  return out;
}

function checkGuards(scr: Script): void {
  for (const s of scr.scenes) {
    const names = s.junctions.map((j) => j.name).sort();
    for (let i = 0; i + 1 < names.length; i++) if (names[i] === names[i + 1]) throw worldErrors.duplicateJunctionName(s.id, names[i]);
  }
  for (const s of scr.scenes) for (const j of s.junctions) if (j.after !== null && j.after < 1) throw worldErrors.zeroDelayJunction(s.id, j.name, j.after);
  for (const [site, sents] of authoredSentenceSites(scr)) {
    for (const s of sents) {
      const head = segmentNamesChecked(s)[0];
      if (head === SCENE_PATIENCE_FAMILY) throw worldErrors.reservedFamilyAuthored(site, s, SCENE_PATIENCE_FAMILY);
    }
  }
  for (const s of scr.scenes) {
    const v = authoredVarClash([], [], s.setup)[0];
    if (v !== undefined) throw worldErrors.reservedVarClash('Script.compile', v, ` (scene ${JSON.stringify(s.id)}'s setup)`);
  }
  for (const s of scr.scenes)
    for (const j of s.junctions) {
      const v = authoredVarClash([], j.when, [])[0];
      if (v !== undefined) throw worldErrors.reservedVarClash('Script.compile', v, ` (scene ${JSON.stringify(s.id)}'s junction ${JSON.stringify(j.name)})`);
    }
}

function compileBeat(sid: string, b: Beat): Action {
  const label = b.speaker !== null ? bakeActor(b.speaker, b.label) : b.label;
  const when: Condition[] = [matches(currentSceneFact(sid)), matches('character.Actor')];
  if (b.speaker !== null) when.push(eq('Actor', b.speaker));
  when.push(...b.when);
  return action(label, when, b.effects);
}

function setupOf(scenes: readonly Scene[], sid: string): Outcome[] {
  const s = scenes.find((x) => x.id === sid);
  if (s === undefined) return [];
  const out: Outcome[] = [];
  for (const j of s.junctions) if (j.after !== null) out.push(insertFor(j.after, scenePatiencePath(sid, j.name)));
  out.push(...s.setup);
  return out;
}

function storyClause(scenes: readonly Scene[], sid: string, j: Junction): [Condition[], Outcome[]] {
  const guard: Condition[] = [matches(currentSceneFact(sid)), absent([matches('ending.E')]), ...j.when];
  if (j.after !== null) guard.push(not_(scenePatiencePath(sid, j.name)));
  const body = j.to !== null ? [insert(currentSceneFact(j.to)), ...setupOf(scenes, j.to)] : [insert(`ending!${j.name}`)];
  return [guard, body];
}

/** Compile un `Script` en `State` prêt à jouer (gardes bruyantes au point de consommation). */
export function compile(scr: Script): State {
  checkGuards(scr);
  const actions: Action[] = [];
  for (const s of scr.scenes) for (const b of s.beats) actions.push(compileBeat(s.id, b));
  const beats: Practice = practice(BEATS_PRACTICE, { name: 'scene dialogue', roles: ['Stage'], actions });
  const clauses: Array<[Condition[], Outcome[]]> = [];
  for (const s of scr.scenes) for (const j of s.junctions) clauses.push(storyClause(scr.scenes, s.id, j));
  const story = scheduleRule(STORY_RULE, 1, clauses);

  const st = new State();
  st.definePractices([beats]);
  st.defineFunctions(coreFns());
  st.setCharacters(scr.cast.map((c) => character(c.name, { wants: c.desires })));
  door.registerEngineRules(st, [story]);

  const setup: Outcome[] = [insert(`practice.${BEATS_PRACTICE}.stage`)];
  for (const c of scr.cast) setup.push(insert(`character.${c.name}`));
  for (const c of scr.cast) for (const t of c.traits) setup.push(insert(`trait.${c.name}.${t}`));
  setup.push(insert(currentSceneFact(scr.start)));
  setup.push(...setupOf(scr.scenes, scr.start));
  for (const o of setup) st.performOutcome(o);
  return st;
}

let alnumRe: RegExp | null = null;
function isAlnum(c: string): boolean {
  const code = c.charCodeAt(0);
  if (code < 128) return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
  try {
    alnumRe ??= new RegExp('^[\\p{Alphabetic}\\p{Nd}\\p{Nl}\\p{No}]$', 'u');
    return alnumRe.test(c);
  } catch {
    return c.toLowerCase() !== c.toUpperCase();
  }
}

/** Le graphe des scènes en Mermaid `graph TD`. */
export function flowChart(scr: Script): string {
  const nodeId = (s: string): string => [...s].map((c) => (isAlnum(c) ? c : '_')).join('');
  const lines = ['graph TD', `  _start((start)) --> ${nodeId(scr.start)}`];
  for (const s of scr.scenes) {
    lines.push(`  ${nodeId(s.id)}["${s.id}"]`);
    for (const j of s.junctions) {
      const from = nodeId(s.id);
      lines.push(j.to !== null ? `  ${from} -->|${j.name}| ${nodeId(j.to)}` : `  ${from} -->|${j.name}| _end_${nodeId(j.name)}((${j.name}))`);
    }
  }
  return lines.map((l) => l + '\n').join('');
}
