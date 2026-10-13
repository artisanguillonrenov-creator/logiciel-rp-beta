/**
 * Prax pour Elyndor — moteur de simulation sociale (portage TypeScript de
 * Prax, https://github.com/AHartNtkn/Prax, licence BSD-3-Clause ; voir
 * `src/prax/LICENSE-PRAX.md`).
 *
 * Le monde est un ensemble de faits en logique d'exclusion ; des pratiques
 * sociales offrent des affordances par rôle ; des personnages autonomes
 * choisissent leurs actions par utilité, en anticipant les autres à partir de
 * ce qu'ils CROIENT de leurs motivations.
 *
 * Ce module est autonome : il n'importe rien du reste de l'application et ne
 * dépend d'aucune API Node (compatible Hermes / React Native).
 */
export * as db from './core/db';
export type { Db, Bindings, Val } from './core/db';
export { SetVal, emptyDb, valToString } from './core/db';
export * from './core/el';
export * from './core/errors';
export * from './core/path';
export * from './core/query';
export * from './core/types';
export { State, door } from './core/engine';
export type { GroundedAction, Intention, MotiveSignature, EffectStep, Defs, Runtime } from './core/perform';
export { renderText } from './core/perform';
export { close, closeFrom, naiveClosure, compileRule, Contradiction, isContradiction } from './core/derive';
export type { CompiledRule } from './core/derive';
export { advance, npcAct, npcActLogged, runNpcTicks } from './core/turn';
export { lasts, gathering, sightRule } from './core/schedule';
export { sightedWithin } from './core/sight';
export { draw, rollStep, SEED_BOUNDS } from './core/rng';
export { plannerDebug, evaluateCompiled, groundedActionEq, motiveSignatureEq } from './core/planner';
export { typeCheck, describe } from './core/typecheck';
export type { TypeError } from './core/typecheck';
export { serializeState, deserializeState, FORMAT_VERSION } from './core/persist';
export { explain, firstFailing } from './core/inspect';
export { stressTest, runRandom, pick, lcg, seedFor, preAdvanceStop, endingReached } from './core/stress';
export type { StressReport, RunResult, RunStop } from './core/stress';
export * from './core/reserved';
export * from './core/vocabConsts';
export * as vocab from './vocab';
export * as script from './script/script';
export { compile as compileScript, flowChart, currentSceneOf, BEATS_PRACTICE, STORY_RULE } from './script/compile';
export { encodeScript, decodeScript } from './script/json';
export * as worlds from './worlds';
