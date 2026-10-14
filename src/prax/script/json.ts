/**
 * Le format JSON des scripts — la représentation durable sur disque.
 *
 * Schéma écrit à la main : chaque condition et chaque effet est un objet à clé
 * unique. L'encodeur émet les clés TRIÉES, en JSON compact (compatible octet à
 * octet avec `examples/play.json`). Le décodeur suit les règles d'aeson :
 * la PREMIÈRE occurrence d'une clé dupliquée gagne ; un `null` optionnel vaut
 * absent ; une chaîne de sondes ordonnée avec repli (`match`, `not`, `eq`, …) ;
 * les clés inconnues sont ignorées, sauf `memories` (refusée bruyamment, DIV-5).
 *
 * Reprend `prax-script/src/json.rs` (Prax, BSD-3-Clause).
 */
import { CalcOp, CmpOp, Condition } from '../core/query';
import { Outcome, Want } from '../core/types';
import { Beat, CastMember, Junction, Scene, Script } from './script';

// ---- un analyseur JSON « premier gagne », entiers distingués --------------------

type Jv = null | boolean | { int: number } | { float: number } | string | Jv[] | JObj;
class JObj {
  readonly m = new Map<string, Jv>();
}

function parseJson(text: string): Jv {
  let i = 0;
  const ws = () => {
    while (i < text.length && ' \t\n\r'.includes(text[i])) i++;
  };
  const fail = (msg: string): never => {
    throw new Error(`JSON invalide à la position ${i} : ${msg}`);
  };
  const value = (): Jv => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++;
      const o = new JObj();
      ws();
      if (text[i] === '}') {
        i++;
        return o;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') fail('clé attendue');
        const k = str();
        ws();
        if (text[i] !== ':') fail('« : » attendu');
        i++;
        const v = value();
        if (!o.m.has(k)) o.m.set(k, v);
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === '}') {
          i++;
          return o;
        }
        fail('« , » ou « } » attendu');
      }
    }
    if (c === '[') {
      i++;
      const a: Jv[] = [];
      ws();
      if (text[i] === ']') {
        i++;
        return a;
      }
      for (;;) {
        a.push(value());
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === ']') {
          i++;
          return a;
        }
        fail('« , » ou « ] » attendu');
      }
    }
    if (c === '"') return str();
    if (text.startsWith('true', i)) {
      i += 4;
      return true;
    }
    if (text.startsWith('false', i)) {
      i += 5;
      return false;
    }
    if (text.startsWith('null', i)) {
      i += 4;
      return null;
    }
    const m = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(text.slice(i));
    if (m === null) return fail('valeur attendue');
    i += m[0].length;
    const n = Number(m[0]);
    // serde_json lit `-0` comme un flottant : ce n'est pas un entier du schéma.
    return m[2] === undefined && m[3] === undefined && m[0] !== '-0' && Number.isSafeInteger(n) ? { int: n } : { float: n };
  };
  const str = (): string => {
    let j = i + 1;
    let out = '';
    for (;;) {
      if (j >= text.length) fail('chaîne non terminée');
      const ch = text[j];
      if (ch === '"') break;
      if (ch === '\\') {
        const e = text[j + 1];
        const map: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        if (e === 'u') {
          const hex = (k: number): number => {
            const h = text.slice(k, k + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(h)) fail('échappement \\u invalide');
            return parseInt(h, 16);
          };
          const cu = hex(j + 2);
          j += 6;
          if (cu >= 0xd800 && cu <= 0xdbff) {
            if (text[j] !== '\\' || text[j + 1] !== 'u') fail('demi-substitut isolé');
            const lo = hex(j + 2);
            if (lo < 0xdc00 || lo > 0xdfff) fail('demi-substitut isolé');
            out += String.fromCharCode(cu, lo);
            j += 6;
          } else if (cu >= 0xdc00 && cu <= 0xdfff) fail('demi-substitut isolé');
          else out += String.fromCharCode(cu);
        } else if (e in map) {
          out += map[e];
          j += 2;
        } else fail('échappement invalide');
      } else {
        if (ch < ' ') fail('caractère de contrôle brut dans une chaîne');
        out += ch;
        j++;
      }
    }
    i = j + 1;
    return out;
  };
  const v = value();
  ws();
  if (i !== text.length) fail('contenu après la valeur');
  return v;
}

const isObj = (v: Jv | undefined): v is JObj => v instanceof JObj;
const isArr = (v: Jv | undefined): v is Jv[] => Array.isArray(v);
const asStr = (v: Jv | undefined): string | undefined => (typeof v === 'string' ? v : undefined);
const asInt = (v: Jv | undefined): number | undefined => (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof JObj) && 'int' in v ? v.int : undefined);

function req(o: JObj, k: string, what: string): Jv {
  const v = o.m.get(k);
  if (v === undefined || v === null) throw new Error(`${what}: missing required key ${JSON.stringify(k)}`);
  return v;
}
function opt(o: JObj, k: string): Jv | undefined {
  const v = o.m.get(k);
  return v === null ? undefined : v;
}
function reqStr(o: JObj, k: string, what: string): string {
  const s = asStr(req(o, k, what));
  if (s === undefined) throw new Error(`${what}: key ${JSON.stringify(k)} is not a string`);
  return s;
}
function optStr(o: JObj, k: string, what: string): string | null {
  const v = opt(o, k);
  if (v === undefined) return null;
  const s = asStr(v);
  if (s === undefined) throw new Error(`${what}: key ${JSON.stringify(k)} is not a string`);
  return s;
}
function optInt(o: JObj, k: string, what: string): number | null {
  const v = opt(o, k);
  if (v === undefined) return null;
  const n = asInt(v);
  if (n === undefined) throw new Error(`${what}: key ${JSON.stringify(k)} is not an integer`);
  return n;
}
function optList<T>(o: JObj, k: string, what: string, f: (v: Jv) => T): T[] {
  const v = opt(o, k);
  if (v === undefined) return [];
  if (!isArr(v)) throw new Error(`${what}: key ${JSON.stringify(k)} is not an array`);
  return v.map(f);
}
function reqList<T>(o: JObj, k: string, what: string, f: (v: Jv) => T): T[] {
  const v = req(o, k, what);
  if (!isArr(v)) throw new Error(`${what}: key ${JSON.stringify(k)} is not an array`);
  return v.map(f);
}
function attempt<T>(f: () => T): T | undefined {
  try {
    return f();
  } catch {
    return undefined;
  }
}

const CMP: readonly CmpOp[] = ['lt', 'lte', 'gt', 'gte'];
const CALC: readonly CalcOp[] = ['add', 'sub', 'mul', 'mod'];

function decodeCondition(v: Jv): Condition {
  if (!isObj(v)) throw new Error('Condition: expected an object');
  const o = v.m;
  const two = (k: string): [string, string] | undefined => {
    const a = o.get(k);
    if (!isArr(a) || a.length !== 2) return undefined;
    const x = asStr(a[0]);
    const y = asStr(a[1]);
    return x !== undefined && y !== undefined ? [x, y] : undefined;
  };
  const conds = (k: string): Condition[] | undefined => {
    const a = o.get(k);
    return isArr(a) ? attempt(() => a.map(decodeCondition)) : undefined;
  };
  const m = asStr(o.get('match'));
  if (m !== undefined) return { t: 'match', s: m };
  const n = asStr(o.get('not'));
  if (n !== undefined) return { t: 'not', s: n };
  let p = two('eq');
  if (p) return { t: 'eq', a: p[0], b: p[1] };
  p = two('neq');
  if (p) return { t: 'neq', a: p[0], b: p[1] };
  const c = o.get('cmp');
  if (isArr(c) && c.length === 3) {
    const [op, a, b] = c.map(asStr);
    if (op !== undefined && a !== undefined && b !== undefined && (CMP as string[]).includes(op)) return { t: 'cmp', op: op as CmpOp, a, b };
  }
  const k = o.get('calc');
  if (isArr(k) && k.length === 4) {
    const [r, op, a, b] = k.map(asStr);
    if (r !== undefined && op !== undefined && a !== undefined && b !== undefined && (CALC as string[]).includes(op)) return { t: 'calc', r, op: op as CalcOp, a, b };
  }
  p = two('count');
  if (p) return { t: 'count', r: p[0], set: p[1] };
  const sq = o.get('subquery');
  if (isObj(sq)) {
    const r = attempt(() => ({
      set: reqStr(sq, 'set', 'subquery'),
      find: reqList(sq, 'find', 'subquery', (x) => {
        const s = asStr(x);
        if (s === undefined) throw new Error('subquery: a find entry is not a string');
        return s;
      }),
      where: reqList(sq, 'where', 'subquery', decodeCondition),
    }));
    if (r !== undefined) return { t: 'subquery', ...r };
  }
  const orv = o.get('or');
  if (isArr(orv)) {
    const cls = attempt(() =>
      orv.map((cl) => {
        if (!isArr(cl)) throw new Error('or');
        return cl.map(decodeCondition);
      }),
    );
    if (cls !== undefined) return { t: 'or', clauses: cls };
  }
  const ab = conds('absent');
  if (ab !== undefined) return { t: 'absent', cs: ab };
  const ex = conds('exists');
  if (ex !== undefined) return { t: 'exists', cs: ex };
  throw new Error('Condition: no alternative in the probe chain (match, not, eq, neq, cmp, calc, count, subquery, or, absent, exists) accepted the value');
}

function decodeOutcome(v: Jv): Outcome {
  if (!isObj(v)) throw new Error('Outcome: expected an object');
  const o = v.m;
  const ins = asStr(o.get('insert'));
  if (ins !== undefined) return { t: 'insert', s: ins };
  const de = asStr(o.get('delete'));
  if (de !== undefined) return { t: 'delete', s: de };
  const f = o.get('insertFor');
  if (isObj(f)) {
    const n = asInt(f.m.get('rounds'));
    const s = asStr(f.m.get('sentence'));
    if (n !== undefined && s !== undefined) return { t: 'insertFor', n, s };
  }
  const c = o.get('call');
  if (isObj(c)) {
    const name = asStr(c.m.get('fn'));
    const args = c.m.get('args');
    if (name !== undefined && isArr(args)) {
      const as = args.map(asStr);
      if (as.every((x) => x !== undefined)) return { t: 'call', fn: name, args: as as string[] };
    }
  }
  const fe = o.get('forEach');
  if (isObj(fe)) {
    const r = attempt(() => ({ when: reqList(fe, 'when', 'forEach', decodeCondition), then: reqList(fe, 'do', 'forEach', decodeOutcome) }));
    if (r !== undefined) return { t: 'forEach', when: r.when, then: r.then };
  }
  const ro = o.get('roll');
  if (isObj(ro)) {
    const num = asInt(ro.m.get('num'));
    const den = asInt(ro.m.get('den'));
    if (num !== undefined && den !== undefined) {
      const r = attempt(() => ({ when: reqList(ro, 'when', 'roll', decodeCondition), then: reqList(ro, 'do', 'roll', decodeOutcome) }));
      if (r !== undefined) return { t: 'roll', num, den, when: r.when, then: r.then };
    }
  }
  throw new Error('Outcome: no alternative in the probe chain (insert, delete, insertFor, call, forEach, roll) accepted the value');
}

function decodeWant(v: Jv): Want {
  if (!isObj(v)) throw new Error('Want: expected an object');
  const when = reqList(v, 'when', 'Want', decodeCondition);
  const u = asInt(req(v, 'utility', 'Want'));
  if (u === undefined) throw new Error('Want: "utility" is not an integer');
  if (u < -2147483648 || u > 2147483647) throw new Error(`Want: utility ${u} does not fit the engine's i32 weight`);
  return { when, utility: u };
}

function decodeCastMember(v: Jv): CastMember {
  if (!isObj(v)) throw new Error('CastMember: expected an object');
  const name = reqStr(v, 'name', 'CastMember');
  const p = opt(v, 'playable');
  if (p !== undefined && typeof p !== 'boolean') throw new Error('CastMember: "playable" is not a boolean');
  return {
    name,
    playable: p === true,
    desires: optList(v, 'desires', 'CastMember', decodeWant),
    traits: optList(v, 'traits', 'CastMember', (x) => {
      const s = asStr(x);
      if (s === undefined) throw new Error('CastMember: a trait is not a string');
      return s;
    }),
  };
}

function decodeBeat(v: Jv): Beat {
  if (!isObj(v)) throw new Error('Beat: expected an object');
  return {
    label: reqStr(v, 'label', 'Beat'),
    speaker: optStr(v, 'speaker', 'Beat'),
    when: optList(v, 'when', 'Beat', decodeCondition),
    effects: optList(v, 'effects', 'Beat', decodeOutcome),
  };
}

function decodeJunction(v: Jv): Junction {
  if (!isObj(v)) throw new Error('Junction: expected an object');
  return { name: reqStr(v, 'name', 'Junction'), to: optStr(v, 'to', 'Junction'), when: optList(v, 'when', 'Junction', decodeCondition), after: optInt(v, 'after', 'Junction') };
}

function decodeScene(v: Jv): Scene {
  if (!isObj(v)) throw new Error('Scene: expected an object');
  if (v.m.has('memories'))
    throw new Error('Prax.Script.Json: Scene\'s "memories" field is no longer supported -- the memory feature was removed (spec v46); author scene content via setup/beats/junctions instead');
  return {
    id: reqStr(v, 'id', 'Scene'),
    opening: optStr(v, 'opening', 'Scene') ?? '',
    setup: optList(v, 'setup', 'Scene', decodeOutcome),
    beats: optList(v, 'beats', 'Scene', decodeBeat),
    junctions: optList(v, 'junctions', 'Scene', decodeJunction),
  };
}

/** Décode un script JSON (lève une erreur avec le message de décodage). */
export function decodeScript(text: string): Script {
  const v = parseJson(text);
  if (!isObj(v)) throw new Error('Script: expected an object');
  return { cast: reqList(v, 'cast', 'Script', decodeCastMember), scenes: reqList(v, 'scenes', 'Script', decodeScene), start: reqStr(v, 'start', 'Script') };
}

// ---- l'encodeur ------------------------------------------------------------------------

type Out = string | number | boolean | Out[] | { [k: string]: Out };

function obj(pairs: Array<[string, Out]>): { [k: string]: Out } {
  const o: { [k: string]: Out } = {};
  for (const [k, v] of [...pairs].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) o[k] = v;
  return o;
}

function condValue(c: Condition): Out {
  switch (c.t) {
    case 'match':
      return obj([['match', c.s]]);
    case 'not':
      return obj([['not', c.s]]);
    case 'eq':
      return obj([['eq', [c.a, c.b]]]);
    case 'neq':
      return obj([['neq', [c.a, c.b]]]);
    case 'cmp':
      return obj([['cmp', [c.op, c.a, c.b]]]);
    case 'calc':
      return obj([['calc', [c.r, c.op, c.a, c.b]]]);
    case 'count':
      return obj([['count', [c.r, c.set]]]);
    case 'subquery':
      return obj([['subquery', obj([['set', c.set], ['find', [...c.find]], ['where', c.where.map(condValue)]])]]);
    case 'or':
      return obj([['or', c.clauses.map((cl) => cl.map(condValue))]]);
    case 'absent':
      return obj([['absent', c.cs.map(condValue)]]);
    case 'exists':
      return obj([['exists', c.cs.map(condValue)]]);
  }
}

function outcomeValue(o: Outcome): Out {
  switch (o.t) {
    case 'insert':
      return obj([['insert', o.s]]);
    case 'delete':
      return obj([['delete', o.s]]);
    case 'insertFor':
      return obj([['insertFor', obj([['rounds', o.n], ['sentence', o.s]])]]);
    case 'call':
      return obj([['call', obj([['fn', o.fn], ['args', [...o.args]]])]]);
    case 'forEach':
      return obj([['forEach', obj([['when', o.when.map(condValue)], ['do', o.then.map(outcomeValue)]])]]);
    case 'roll':
      return obj([['roll', obj([['num', o.num], ['den', o.den], ['when', o.when.map(condValue)], ['do', o.then.map(outcomeValue)]])]]);
  }
}

function scriptValue(scr: Script): Out {
  return obj([
    ['start', scr.start],
    [
      'cast',
      scr.cast.map((c) =>
        obj([
          ['name', c.name],
          ['playable', c.playable],
          ['desires', c.desires.map((w) => obj([['when', w.when.map(condValue)], ['utility', w.utility]]))],
          ['traits', [...c.traits]],
        ]),
      ),
    ],
    [
      'scenes',
      scr.scenes.map((s) =>
        obj([
          ['id', s.id],
          ['opening', s.opening],
          ['setup', s.setup.map(outcomeValue)],
          [
            'beats',
            s.beats.map((b) => {
              const pairs: Array<[string, Out]> = [
                ['label', b.label],
                ['when', b.when.map(condValue)],
                ['effects', b.effects.map(outcomeValue)],
              ];
              if (b.speaker !== null) pairs.push(['speaker', b.speaker]);
              return obj(pairs);
            }),
          ],
          [
            'junctions',
            s.junctions.map((j) => {
              const pairs: Array<[string, Out]> = [
                ['name', j.name],
                ['when', j.when.map(condValue)],
              ];
              if (j.to !== null) pairs.push(['to', j.to]);
              if (j.after !== null) pairs.push(['after', j.after]);
              return obj(pairs);
            }),
          ],
        ]),
      ),
    ],
  ]);
}

/** Sérialise un script en JSON compact aux clés triées (sans saut de ligne final). */
export function encodeScript(scr: Script): string {
  return JSON.stringify(scriptValue(scr));
}
