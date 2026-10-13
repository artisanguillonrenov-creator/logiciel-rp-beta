/**
 * Le `Script` écrit (le « Prompter » de Versu) : scènes, distribution,
 * temps forts (beats) et jonctions — la valeur que produit un constructeur ou
 * un document JSON décodé, avant compilation.
 *
 * Tous les constructeurs sont INFAILLIBLES : la validation se fait au seul
 * point de consommation (`compile`), uniformément quelle que soit la voie de
 * construction (constructeur, littéral, JSON).
 *
 * Reprend `prax-script/src/script.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from '../core/errors';
import { Condition, cmp, matches, neq } from '../core/query';
import { Outcome, Want, want } from '../core/types';

export interface Script {
  readonly cast: readonly CastMember[];
  readonly scenes: readonly Scene[];
  /** L'identifiant de la scène d'ouverture. */
  readonly start: string;
}

export interface CastMember {
  readonly name: string;
  readonly playable: boolean;
  readonly desires: readonly Want[];
  readonly traits: readonly string[];
}

export interface Scene {
  readonly id: string;
  /** Narration d'ouverture — donnée inerte (jamais lue par la compilation). */
  readonly opening: string;
  readonly setup: readonly Outcome[];
  readonly beats: readonly Beat[];
  readonly junctions: readonly Junction[];
}

export interface Beat {
  readonly label: string;
  readonly speaker: string | null;
  readonly when: readonly Condition[];
  readonly effects: readonly Outcome[];
}

/** Une sortie de scène : transition (`to`) ou fin (`to === null`), éventuellement minutée (`after`). */
export interface Junction {
  readonly name: string;
  readonly to: string | null;
  readonly when: readonly Condition[];
  readonly after: number | null;
}

export function script(start: string, cast: readonly CastMember[] = [], scenes: readonly Scene[] = []): Script {
  return { cast, scenes, start };
}

export function member(n: string): CastMember {
  return { name: n, playable: false, desires: [], traits: [] };
}

export function player(n: string): CastMember {
  return { ...member(n), playable: true };
}

export function wanting(c: CastMember, ws: readonly Want[]): CastMember {
  return { ...c, desires: [...c.desires, ...ws] };
}

/** Les préoccupations d'un personnage : être bien vu sur une dimension (+poids par autre qui l'évalue > 0). */
export function concernedWith(c: CastMember, pairs: ReadonlyArray<readonly [string, number]>): CastMember {
  const ds = [...c.desires];
  for (const [dim, w] of pairs) ds.push(want([matches(`Other.relationship.${c.name}.${dim}.score!N`), neq('Other', c.name), cmp('gt', 'N', '0')], w));
  return { ...c, desires: ds };
}

export function withTraits(c: CastMember, ts: readonly string[]): CastMember {
  return { ...c, traits: [...c.traits, ...ts] };
}

export function scene(sid: string, opts: { opening?: string; setup?: readonly Outcome[]; beats?: readonly Beat[]; junctions?: readonly Junction[] } = {}): Scene {
  return { id: sid, opening: opts.opening ?? '', setup: opts.setup ?? [], beats: opts.beats ?? [], junctions: opts.junctions ?? [] };
}

export function beat(label: string, when: readonly Condition[], effects: readonly Outcome[]): Beat {
  return { label, speaker: null, when, effects };
}

export function quip(speaker: string, label: string, when: readonly Condition[], effects: readonly Outcome[]): Beat {
  return { label, speaker, when, effects };
}

export function goto(name: string, to: string, when: readonly Condition[]): Junction {
  return { name, to, when, after: null };
}

export function ending(name: string, when: readonly Condition[]): Junction {
  return { name, to: null, when, after: null };
}

export function after(name: string, n: number, to: string): Junction {
  return { name, to, when: [], after: n };
}

export function timeout(name: string, n: number): Junction {
  return { name, to: null, when: [], after: n };
}

/** Le personnage joué : le premier membre marqué jouable. */
export function scriptPlayer(scr: Script): string {
  const c = scr.cast.find((x) => x.playable);
  if (c === undefined) throw worldErrors.noPlayableCastMember();
  return c.name;
}
