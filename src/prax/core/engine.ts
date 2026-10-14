/**
 * L'interpréteur : enregistrer les pratiques, découvrir les affordances d'un
 * acteur, appliquer les effets d'une action — plus la naissance des pratiques,
 * les appels de fonction, le dé dramatique, et la reconstruction des tables
 * dérivées à chaque changement de vocabulaire.
 *
 * Transformations d'état pures : le planificateur applique un effet en
 * spéculation puis jette l'état obtenu (copie bon marché). Une contradiction
 * devient un fait interrogeable `contradiction` ; une violation d'invariant du
 * moteur lève une erreur.
 *
 * Reprend `prax-core/src/engine.rs` (Prax, BSD-3-Clause).
 */
import { Compiled, compileOutcome, groundEffect, recompile } from './compile';
import { Bindings, Db, childKeys, emptyDb, exists, insert, toLabeledSentences, toSentences } from './db';
import { naiveClosure, isContradiction } from './derive';
import { worldErrors } from './errors';
import { tokenize, segmentNames, segmentNamesChecked, renderPath } from './path';
import {
  Defs,
  EffectStep,
  GroundedAction,
  Intention,
  MotiveSignature,
  Runtime,
  cloneRuntime,
  currentTurnOf,
  groundedDeltaAnchors,
  monotoneToks,
  performEffect,
  possibleActionsImpl,
  reclose,
  relevantNames,
  rollOdds,
  roundBoundaryImpl,
  setIntention,
} from './perform';
import * as planner from './planner';
import { Cond, Condition, compileCondition, groundCondition, query } from './query';
import { evictionShadowNames } from './relevanceCore';
import { cookedFnPool, improvableDesires, livenessOf, moverReadAnchors, producibleAtoms } from './relevance';
import { SEED_BOUNDS } from './rng';
import { cookedSelfWants } from './minds';
import { Axiom, Character, Desire, Outcome, Practice, PraxFunction, ScheduleRule, Want, authoredVarClash, deadSentence } from './types';
import { sortStrings, strArrEq } from './util';

export type { GroundedAction, Intention, MotiveSignature, EffectStep } from './perform';

function firstDuplicate(items: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it)) return it;
    seen.add(it);
  }
  return undefined;
}

function buildDefs(base: Omit<Defs, 'compiled'>): Defs {
  const compiled: Compiled = recompile(base.practices, base.fns, base.axioms, base.characters, base.desires, base.schedule, base.predictionScope);
  return { ...base, compiled };
}

/** Tout l'état d'une simulation en cours. */
export class State {
  /** Définitions (partagées entre copies ; remplacées à chaque installation). */
  defs: Defs;
  rt: Runtime;

  constructor(defs?: Defs, rt?: Runtime) {
    if (defs !== undefined && rt !== undefined) {
      this.defs = defs;
      this.rt = rt;
      return;
    }
    const turn0 = tokenize('turn!0');
    this.defs = buildDefs({
      practices: new Map(),
      fns: [],
      axioms: [],
      characters: [],
      desires: [],
      schedule: [],
      sorts: [],
      predictionScope: [],
      engineRuleNames: [],
    });
    this.rt = {
      db: insert(emptyDb(), turn0),
      view: insert(emptyDb(), turn0),
      cursor: -1,
      scheduleDues: new Map(),
      expiries: new Map(),
      rngSeed: null,
      intentions: new Map(),
    };
  }

  /** Copie indépendante (les arbres et définitions sont partagés structurellement). */
  clone(): State {
    return new State(this.defs, cloneRuntime(this.rt));
  }

  private redefine(patch: Partial<Omit<Defs, 'compiled'>>): void {
    const { compiled: _c, ...base } = this.defs;
    void _c;
    this.defs = buildDefs({ ...base, ...patch });
  }

  // ---- installation -------------------------------------------------------

  /** Enregistre une pratique et insère ses faits statiques sous `practiceData.<id>.`. */
  definePractice(p: Practice): void {
    const dup = firstDuplicate(p.actions.map((a) => a.name));
    if (dup !== undefined) throw worldErrors.duplicateActionName(p.id, dup);
    const prefix = `practiceData.${p.id}.`;
    const paths = p.dataFacts.map((f) => tokenize(`${prefix}${f}`));
    for (const path of paths) this.rt.db = insert(this.rt.db, path);
    const practices = new Map(this.defs.practices);
    practices.set(p.id, p);
    this.redefine({ practices });
    reclose(this.defs.compiled, this.rt);
  }

  definePractices(ps: Iterable<Practice>): void {
    for (const p of ps) this.definePractice(p);
  }

  /** Enregistre les fonctions du monde (noms uniques). */
  defineFunctions(fns: Iterable<PraxFunction>): void {
    const added = [...fns];
    const existing = new Set(this.defs.fns.map((f) => f.name));
    const seen = new Set<string>();
    for (const f of added) {
      if (seen.has(f.name) || existing.has(f.name)) throw worldErrors.duplicateFunctionName(f.name);
      seen.add(f.name);
    }
    this.redefine({ fns: [...this.defs.fns, ...added] });
  }

  /** La seule façon de changer les axiomes : recompiler PUIS refermer. */
  setAxioms(axioms: readonly Axiom[]): void {
    this.redefine({ axioms: [...axioms] });
    reclose(this.defs.compiled, this.rt);
  }

  setDesires(desires: readonly Desire[]): void {
    this.redefine({ desires: [...desires] });
  }

  /** Le nom d'un personnage doit être un seul segment (DIV-2). */
  setCharacters(characters: readonly Character[]): void {
    for (const c of characters) if (segmentNames(c.name).length !== 1) throw worldErrors.multiSegmentCharacterName(c.name);
    this.redefine({ characters: [...characters] });
  }

  setSorts(sorts: ReadonlyArray<readonly [string, readonly string[]]>): void {
    this.redefine({ sorts: [...sorts] });
  }

  setPredictionScope(scope: readonly Condition[]): void {
    this.redefine({ predictionScope: [...scope] });
  }

  /** La porte d'ÉCRITURE du calendrier : garde v40 (`Prax` réservé, `Actor` réservé aux acteurs). */
  setSchedule(rules: readonly ScheduleRule[]): void {
    for (const r of rules) {
      for (const [conds, outs] of r.body) {
        const v = authoredVarClash(['Actor'], conds, outs)[0];
        if (v !== undefined) throw worldErrors.reservedVarClash('Engine.set_schedule', v, ' (and Actor is reserved for movers; a schedule rule has no actor)');
      }
    }
    this.addScheduleRules(rules);
  }

  /** @internal Installe des règles (les deux portes y passent). */
  addScheduleRules(rules: readonly ScheduleRule[]): void {
    for (const r of rules) {
      if (segmentNamesChecked(r.name).length !== 1) throw worldErrors.multiSegmentRuleName(r.name);
      // Entier positif sûr : NaN ferait tirer la règle à chaque tour, Infinity jamais.
      if (!Number.isSafeInteger(r.period) || r.period < 1) throw worldErrors.nonPositivePeriod(r.name);
    }
    const existing = new Set(this.defs.schedule.map((r) => r.name));
    const seen = new Set<string>();
    for (const r of rules) {
      if (seen.has(r.name) || existing.has(r.name)) throw worldErrors.duplicateScheduleRuleName(r.name);
      seen.add(r.name);
    }
    const now = this.currentTurn();
    for (const r of rules) this.rt.scheduleDues.set(r.name, now + r.period);
    this.redefine({ schedule: [...this.defs.schedule, ...rules] });
  }

  /** Sème le dé dramatique. */
  seedDie(seed: number): void {
    const [lo, hi] = SEED_BOUNDS;
    if (!Number.isInteger(seed) || seed < lo || seed > hi) throw worldErrors.seedOutOfDomain(seed, lo, hi);
    this.rt.rngSeed = seed;
  }

  /** Transforme la base de faits et referme la vue (hors `perform`). */
  withDb(f: (db: Db) => Db): void {
    this.rt.db = f(this.rt.db);
    reclose(this.defs.compiled, this.rt);
  }

  // ---- exécution ------------------------------------------------------------

  /** Applique un effet déjà fondé. */
  performOutcome(o: Outcome): void {
    performEffect(this.defs, this.rt, compileOutcome(o));
  }

  /** Applique un effet après y avoir substitué des liaisons nommées. */
  performOutcomeGrounded(o: Outcome, binds: ReadonlyArray<readonly [string, string]>): void {
    const b: Bindings = new Map(binds.map(([k, v]) => [k, v]));
    performEffect(this.defs, this.rt, groundEffect(compileOutcome(o), b));
  }

  /** Toutes les actions que l'acteur peut exécuter (évaluées sur la VUE). */
  possibleActions(actor: string): GroundedAction[] {
    return possibleActionsImpl(this.defs, this.rt.view, actor);
  }

  performAction(ga: GroundedAction): void {
    this.performActionLogged(ga, () => {});
  }

  /** `performAction` avec l'observation par effet (journal des tirages). */
  performActionLogged(ga: GroundedAction, observe: (s: EffectStep) => void): void {
    const cp = this.defs.compiled.practices.get(ga.practiceId);
    if (cp === undefined) return;
    const ca = cp.actions.find((a) => a.name === ga.actionId);
    if (ca === undefined) return;
    ca.outs.forEach((out, index) => {
      const g = groundEffect(out, ga.bindings);
      const odds = rollOdds(g);
      const rngBefore = this.rt.rngSeed;
      const before = odds.length === 0 ? null : toLabeledSentences(this.rt.db);
      performEffect(this.defs, this.rt, g);
      if (before !== null) {
        observe({ index, odds, rngBefore, rngAfter: this.rt.rngSeed, changed: !strArrEq(before, toLabeledSentences(this.rt.db)) });
      }
    });
  }

  /** La valeur courante de l'horloge. */
  currentTurn(): number {
    return currentTurnOf(this.rt.db);
  }

  /** Une frontière de tour : horloge, expirations dues, règles dues. */
  roundBoundary(): void {
    roundBoundaryImpl(this.defs, this.rt);
  }

  // ---- observation -----------------------------------------------------------

  labeledFacts(): string[] {
    return toLabeledSentences(this.rt.db);
  }
  labeledView(): string[] {
    return toLabeledSentences(this.rt.view);
  }
  facts(): string[] {
    return toSentences(this.rt.db);
  }
  get cursor(): number {
    return this.rt.cursor;
  }
  /** @internal Seul `advance` déplace le curseur. */
  setCursor(c: number): void {
    this.rt.cursor = c;
  }
  get characters(): readonly Character[] {
    return this.defs.characters;
  }
  get engineRuleNames(): readonly string[] {
    return this.defs.engineRuleNames;
  }
  get rngSeed(): number | null {
    return this.rt.rngSeed;
  }
  /** Les échéances du calendrier, dans l'ordre des noms. */
  scheduleDues(): Map<string, number> {
    const out = new Map<string, number>();
    for (const k of sortStrings([...this.rt.scheduleDues.keys()])) out.set(k, this.rt.scheduleDues.get(k) as number);
    return out;
  }
  /** La file des expirations, par chemin étiqueté, dans l'ordre des noms. */
  expiriesRendered(): Map<string, number> {
    const out = new Map<string, number>();
    for (const k of sortStrings([...this.rt.expiries.keys()])) out.set(k, (this.rt.expiries.get(k) as { due: number }).due);
    return out;
  }
  dbHas(sentence: string): boolean {
    return exists(this.rt.db, tokenize(sentence).segs);
  }
  viewHas(sentence: string): boolean {
    return exists(this.rt.view, tokenize(sentence).segs);
  }
  get db(): Db {
    return this.rt.db;
  }
  get view(): Db {
    return this.rt.view;
  }

  /** La vue recalculée naïvement (oracle de test du routeur). */
  naiveView(): string[] {
    const r = naiveClosure(this.defs.compiled.rules, this.rt.db);
    if (isContradiction(r)) return toLabeledSentences(insert(this.rt.db, tokenize('contradiction')));
    return toLabeledSentences(r);
  }

  // ---- planificateur ------------------------------------------------------------

  pickAction(depth: number, actor: Character): GroundedAction | null {
    return planner.pickAction(this.defs, this.rt, depth, actor);
  }
  scoreActions(depth: number, actor: Character): Array<[GroundedAction, number]> {
    return planner.scoreActions(this.defs, this.rt, depth, actor);
  }
  predictMove(predictor: Character, mover: Character): GroundedAction | null {
    return planner.predictMove(this.defs, this.rt, predictor, mover);
  }
  motiveSignature(actor: Character): MotiveSignature {
    return planner.motiveSignature(this.defs, this.rt, actor);
  }
  candidateActions(actor: Character): GroundedAction[] {
    return planner.candidateActions(this.defs, this.rt, actor);
  }
  inPredictionScope(actor: Character, mover: Character): boolean {
    return planner.inScope(this.defs, this.rt, actor, mover);
  }
  moverReadAnchorsOf(actor: string, mover: string): Array<readonly string[]> {
    const c = this.defs.compiled;
    return moverReadAnchors(c.scope, c.practices, c.fns, c.desires, actor, mover);
  }
  groundedDeltaAnchorsOf(ga: GroundedAction): Array<readonly string[]> | null {
    return groundedDeltaAnchors(this.defs, ga);
  }
  get improvables(): readonly string[] {
    return this.defs.compiled.improvables;
  }
  improvableDesiresRecomputed(): string[] {
    const c = this.defs.compiled;
    return improvableDesires(c.practices, cookedFnPool(c.fns), c.rules, c.desires, this.defs.desires);
  }
  /** La table des recettes de vie, rendue par nom. */
  livenessRendered(): Map<string, [string, string[][]]> {
    return renderLiveness(this.defs.compiled.liveness);
  }
  livenessRecomputed(): Map<string, [string, string[][]]> {
    const c = this.defs.compiled;
    return renderLiveness(livenessOf(c.practices, cookedFnPool(c.fns), c.rules, c.desires, this.defs.desires));
  }
  caresAboutTable(): ReadonlyMap<string, readonly string[]> {
    return this.defs.compiled.caresAbout;
  }
  /** @internal Tout ce que le monde peut contenir (charpie des conditions mortes). */
  producibleAtoms(): Array<readonly string[]> | null {
    const c = this.defs.compiled;
    return producibleAtoms(c.practices, cookedFnPool(c.fns), c.schedule, c.rules, this.rt.db);
  }
  get compiled(): Compiled {
    return this.defs.compiled;
  }

  /** L'insertion de cette phrase perturberait-elle la fermeture dérivée ? */
  relevantDelta(sentence: string): boolean {
    const path = tokenize(sentence);
    return relevantNames(path.segs, evictionShadowNames(path), this.defs.compiled.footprint);
  }
  get contMonotone(): boolean {
    return this.defs.compiled.contMonotone;
  }
  monotoneInsert(sentence: string): boolean {
    const path = tokenize(sentence);
    return monotoneToks(path, this.defs.compiled.contMonotone, this.defs.compiled.negFootprint);
  }

  /** Une conjonction écrite a-t-elle une solution sur la vue, liaisons substituées d'abord ? */
  conditionsHold(conds: readonly Condition[], binds: ReadonlyArray<readonly [string, string]>): boolean {
    const b: Bindings = new Map(binds.map(([k, v]) => [k, v]));
    const grounded: Cond[] = conds.map((c) => compileCondition(groundCondition(b, c)));
    return query(this.rt.view, grounded, new Map()).length > 0;
  }

  /** Utilité entière de la vue courante pour une liste d'envies quelconque. */
  evaluateWants(wants: readonly Want[]): number {
    const model = wants.map((w) => [w.when.map(compileCondition), w.utility] as const);
    return planner.evaluateCompiled(this.rt.view, model);
  }

  /** Utilité entière de la vue courante pour les envies propres d'un personnage. */
  evaluateSelfWants(c: Character): number {
    const comp = this.defs.compiled;
    return planner.evaluateCompiled(this.rt.view, cookedSelfWants(comp.wants, comp.desires, this.defs.desires, c));
  }

  // ---- surface des sources écrites ------------------------------------------------

  practiceDefs(): ReadonlyMap<string, Practice> {
    return this.defs.practices;
  }
  functionsSrc(): readonly PraxFunction[] {
    return this.defs.fns;
  }
  axiomsSrc(): readonly Axiom[] {
    return this.defs.axioms;
  }
  desiresSrc(): readonly Desire[] {
    return this.defs.desires;
  }
  scheduleSrc(): readonly ScheduleRule[] {
    return this.defs.schedule;
  }
  sorts(): ReadonlyArray<readonly [string, readonly string[]]> {
    return this.defs.sorts;
  }
  predictionScope(): readonly Condition[] {
    return this.defs.predictionScope;
  }
  axiomHeadNames(): string[] {
    return this.defs.compiled.axiomHeads.map((h) => h.join('.'));
  }
  footprintNames(): string[] {
    return this.defs.compiled.footprint.map((h) => h.join('.'));
  }
  negFootprintNames(): string[] {
    return this.defs.compiled.negFootprint.map((h) => h.join('.'));
  }

  /** Les personnages sans marque `dead.<nom>` dans la BASE. */
  livingCharacters(): Character[] {
    return this.defs.characters.filter((c) => !this.dbHas(deadSentence(c.name)));
  }
  livingCharacterCount(): number {
    return this.livingCharacters().length;
  }

  /** Une ligne de liaisons rendue par nom, dans l'ordre des noms. */
  renderBindings(b: Bindings): Map<string, string> {
    const out = new Map<string, string>();
    for (const k of sortStrings([...b.keys()])) {
      const v = b.get(k);
      if (v !== undefined) out.set(k, typeof v === 'string' ? v : typeof v === 'number' ? String(v) : `<Set(${v.rows.length})>`);
    }
    return out;
  }

  /** Les clés enfants d'un chemin dans la BASE, dans l'ordre des noms. */
  dbChildKeys(sentence: string): string[] {
    return childKeys(this.rt.db, tokenize(sentence).segs);
  }

  intentionOf(name: string): Intention | undefined {
    return this.rt.intentions.get(name);
  }
  setIntention(name: string, intent: Intention): void {
    setIntention(this.rt, name, intent);
  }
  intentionsMap(): ReadonlyMap<string, Intention> {
    return this.rt.intentions;
  }
  withIntentions(m: ReadonlyMap<string, Intention>): void {
    this.rt.intentions = new Map(m);
  }

  // ---- support de la persistance ---------------------------------------------------

  /** @internal */
  setLoadedRuntime(fields: { cursor: number; rngSeed: number | null; dues: Map<string, number>; expiries: Array<[string, number]>; db: Db }): void {
    this.rt.cursor = fields.cursor;
    this.rt.rngSeed = fields.rngSeed;
    // Une règle déclarée absente de la sauvegarde (sauvegarde tronquée, monde
    // qui a gagné une règle) garde l'échéance du monde frais au lieu d'être
    // désactivée en silence.
    const dues = new Map(this.rt.scheduleDues);
    for (const [k, v] of fields.dues) dues.set(k, v);
    this.rt.scheduleDues = dues;
    this.rt.expiries = new Map(fields.expiries.map(([s, due]) => [renderPath(tokenize(s)), { path: tokenize(s), due }]));
    this.rt.db = fields.db;
    reclose(this.defs.compiled, this.rt);
  }

  /** Les expirations en phrases étiquetées avec leur échéance. */
  expiriesLabeled(): Array<[string, number]> {
    return [...this.rt.expiries.entries()].map(([k, v]) => [k, v.due]);
  }
}

function renderLiveness(l: ReadonlyMap<string, import('./relevance').Liveness>): Map<string, [string, string[][]]> {
  const out = new Map<string, [string, string[][]]>();
  for (const [name, lv] of l) {
    if (lv.k === 'GateCheck') {
      out.set(name, [
        'GateCheck',
        lv.gates.map((g) =>
          g.map((c) => {
            if (c.t !== 'match') throw new Error('liveness : condition de garde inattendue');
            return c.segs.join('.');
          }),
        ),
      ]);
    } else out.set(name, [lv.k, []]);
  }
  return out;
}

/** La porte du COMPILATEUR (v46/v53) : règles générées par `Prax.Script`, provenance enregistrée. */
export const door = {
  registerEngineRules(st: State, rules: readonly ScheduleRule[]): void {
    const names = rules.map((r) => r.name);
    st.addScheduleRules(rules);
    const { compiled, ...base } = st.defs;
    st.defs = { ...base, compiled, engineRuleNames: [...st.defs.engineRuleNames, ...names] };
  },
};

export { cloneRuntime };
export type { Runtime, Defs };
