/**
 * Sauvegarde / reprise : un format JSON de l'état d'exécution.
 *
 * Tout l'état mutable tient en six champs : la base de faits, le curseur des
 * tours, les intentions en cours, la moitié « exécution » du calendrier
 * (échéances par règle + file des expirations) et la position du dé. Les
 * pratiques, personnages, envies et règles sont du CODE (les règles du monde) :
 * une sauvegarde se recharge sur un monde fraîchement construit du même type.
 *
 * Forme du document identique au format de la réécriture Rust de Prax
 * (`prax-core/src/persist.rs`, BSD-3-Clause) ; seule l'étiquette de version
 * diffère (`prax-ts-state v1`), et l'étiquette Rust est acceptée en lecture.
 * Parfait pour AsyncStorage (une simple chaîne).
 */
import { Bindings, SetVal, Val, emptyDb, insert } from './db';
import { State } from './engine';
import { worldErrors } from './errors';
import { tokenize } from './path';
import { GroundedAction, Intention } from './perform';
import { cmpStr, stableSort } from './util';

export const FORMAT_VERSION = 'prax-ts-state v1';
const ACCEPTED_VERSIONS = [FORMAT_VERSION, 'prax-rs-state v1'];

type ValRepr = { Sym: string } | { Num: number } | { Set: string[][] };

interface GaRepr {
  practice_id: string;
  instance_id: string;
  action_id: string;
  bindings: Array<[string, ValRepr]>;
  label: string;
}

interface IntentRepr {
  act: GaRepr | null;
  bearing: string[];
  satisfaction: number[];
  live_desires: string[];
  known_motives: Array<[string, string]>;
}

interface SaveDoc {
  version: string;
  cursor: number;
  rng_seed?: number;
  intentions: Record<string, IntentRepr>;
  dues: Record<string, number>;
  expiries: Record<string, number>;
  facts: string[];
}

function reprVal(v: Val): ValRepr {
  if (typeof v === 'string') return { Sym: v };
  if (typeof v === 'number') return { Num: v };
  return { Set: v.rows.map((r) => [...r]) };
}

function unreprVal(r: ValRepr): Val {
  if ('Sym' in r && typeof r.Sym === 'string') return r.Sym;
  if ('Num' in r && typeof r.Num === 'number') return r.Num;
  if ('Set' in r && Array.isArray(r.Set)) return new SetVal(r.Set.map((row) => [...row]));
  throw worldErrors.persistFormat('malformed save: une valeur liée est illisible');
}

function sortedRecord<V>(m: ReadonlyMap<string, V>, f: (v: V) => unknown): Record<string, never> {
  const out: Record<string, unknown> = {};
  for (const k of stableSort([...m.keys()], cmpStr)) out[k] = f(m.get(k) as V);
  return out as Record<string, never>;
}

/** Sérialise l'état mutable en JSON (indenté). */
export function serializeState(st: State): string {
  const intentions = sortedRecord(st.intentionsMap(), (i: Intention): IntentRepr => ({
    act:
      i.act === null
        ? null
        : {
            practice_id: i.act.practiceId,
            instance_id: i.act.instanceId,
            action_id: i.act.actionId,
            bindings: stableSort([...i.act.bindings.entries()], (a, b) => cmpStr(a[0], b[0])).map(([k, v]) => [k, reprVal(v)] as [string, ValRepr]),
            label: i.act.label,
          },
    bearing: [...i.basis.bearing],
    satisfaction: [...i.basis.satisfaction],
    live_desires: [...i.basis.liveDesires],
    known_motives: i.basis.knownMotives.map(([a, b]) => [a, b] as [string, string]),
  }));
  const doc: SaveDoc = {
    version: FORMAT_VERSION,
    cursor: st.cursor,
    ...(st.rngSeed === null ? {} : { rng_seed: st.rngSeed }),
    intentions,
    dues: sortedRecord(st.scheduleDues(), (x) => x),
    expiries: sortedRecord(st.expiriesRendered(), (x) => x),
    facts: st.labeledFacts(),
  };
  return JSON.stringify(doc, null, 2);
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * Recharge une sauvegarde sur `world` (un monde frais du même type). Bruyant
 * sur une entrée mal formée, une autre version de format, ou une échéance qui
 * nomme une règle que le monde ne déclare pas.
 */
export function deserializeState(text: string, world: State): State {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    throw worldErrors.persistFormat(`malformed save: not a JSON save: ${String(e)}`);
  }
  if (!isObject(value) || typeof value.version !== 'string') throw worldErrors.persistFormat('malformed save: no version tag (expected the format header)');
  if (!ACCEPTED_VERSIONS.includes(value.version)) throw worldErrors.persistFormat(`unsupported save format ${JSON.stringify(value.version)} (expected ${JSON.stringify(FORMAT_VERSION)})`);
  const doc = value as unknown as SaveDoc;
  if (typeof doc.cursor !== 'number' || !isObject(doc.dues) || !isObject(doc.expiries) || !isObject(doc.intentions) || !Array.isArray(doc.facts))
    throw worldErrors.persistFormat('malformed save: champ requis manquant ou mal typé');
  const declared = new Set(world.scheduleSrc().map((r) => r.name));
  for (const name of Object.keys(doc.dues)) if (!declared.has(name)) throw worldErrors.persistFormat(`unknown schedule rule ${JSON.stringify(name)} (not declared in the reloaded world)`);

  const st = world.clone();
  let db = emptyDb();
  for (const line of doc.facts) {
    if (typeof line !== 'string') throw worldErrors.persistFormat('malformed save: une ligne de fait n’est pas une chaîne');
    try {
      db = insert(db, tokenize(line));
    } catch (e) {
      throw worldErrors.persistFormat(`malformed save: malformed fact line ${JSON.stringify(line)}: ${String(e)}`);
    }
  }
  const expiries: Array<[string, number]> = Object.entries(doc.expiries).map(([k, v]) => [k, Number(v)]);
  for (const [k] of expiries) {
    try {
      tokenize(k);
    } catch (e) {
      throw worldErrors.persistFormat(`malformed save: malformed expiry path: ${String(e)}`);
    }
  }
  st.setLoadedRuntime({
    cursor: doc.cursor,
    rngSeed: typeof doc.rng_seed === 'number' ? doc.rng_seed : null,
    dues: new Map(Object.entries(doc.dues).map(([k, v]) => [k, Number(v)])),
    expiries,
    db,
  });
  const intentions = new Map<string, Intention>();
  for (const name of Object.keys(doc.intentions)) {
    const r = doc.intentions[name];
    let act: GroundedAction | null = null;
    if (r.act !== null) {
      const b: Bindings = new Map();
      for (const [k, v] of r.act.bindings) b.set(k, unreprVal(v));
      act = { practiceId: r.act.practice_id, instanceId: r.act.instance_id, actionId: r.act.action_id, bindings: b, label: r.act.label };
    }
    intentions.set(name, { act, basis: { bearing: r.bearing, satisfaction: r.satisfaction, liveDesires: r.live_desires, knownMotives: r.known_motives } });
  }
  st.withIntentions(intentions);
  return st;
}
