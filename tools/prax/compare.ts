/**
 * Comparateur différentiel : rejoue une partie de référence (JSONL produit par
 * l'oracle de Prax) avec notre moteur et compare enregistrement par
 * enregistrement.
 *
 * Usage : node .prax-dist/tools/prax/compare.js <fichier.jsonl[.gz]>...
 */
import * as fs from 'node:fs';
import * as zlib from 'node:zlib';
import { Json, randWalk, traceWalk } from './record';
import { buildWorld } from './worlds';

export function readJsonl(file: string): Json[] {
  let buf = fs.readFileSync(file);
  if (file.endsWith('.gz')) buf = zlib.gunzipSync(buf);
  return buf
    .toString('utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l.replace(/"walkSeed":(\d+)/, '"walkSeed":"$1"').replace(/"bits":(\d+)/g, '"bits":"$1"')) as Json);
}

export function diffJson(a: Json, b: Json, path = ''): string[] {
  if (a === b) return [];
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return [`${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`];
  if (Array.isArray(a) !== Array.isArray(b)) return [`${path}: tableau/objet`];
  if (Array.isArray(a) && Array.isArray(b)) {
    if (path.endsWith('facts') || path.endsWith('view')) {
      const sa = new Set(a as string[]);
      const sb = new Set(b as string[]);
      const only1 = [...sa].filter((x) => !sb.has(x));
      const only2 = [...sb].filter((x) => !sa.has(x));
      if (only1.length > 0 || only2.length > 0) return [`${path}: en trop ${JSON.stringify(only1)} / manquants ${JSON.stringify(only2)}`];
      if (a.length !== b.length || a.some((x, i) => x !== b[i])) return [`${path}: ordre différent`];
      return [];
    }
    const out: string[] = [];
    if (a.length !== b.length) out.push(`${path}: longueur ${a.length} ≠ ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) out.push(...diffJson(a[i], b[i], `${path}[${i}]`));
    return out;
  }
  const oa = a as { [k: string]: Json };
  const ob = b as { [k: string]: Json };
  const keys = new Set([...Object.keys(oa), ...Object.keys(ob)]);
  const out: string[] = [];
  for (const k of keys) {
    if (!(k in oa)) out.push(`${path}.${k}: absent chez nous`);
    else if (!(k in ob)) out.push(`${path}.${k}: absent dans la référence`);
    else out.push(...diffJson(oa[k], ob[k], `${path}.${k}`));
  }
  return out;
}

export interface CompareResult {
  file: string;
  ok: boolean;
  records: number;
  firstDivergence?: { index: number; diffs: string[] };
}

export function replay(ref: Json[]): Json[] {
  const h = ref[0] as { [k: string]: Json };
  const world = h.world as string;
  const st = buildWorld(world);
  const dieSeed = typeof h.dieSeed === 'number' ? h.dieSeed : null;
  if (dieSeed !== null) st.seedDie(dieSeed);
  const mode = h.mode as 'decisions' | 'state' | 'view';
  const em = { candidates: h.candidates === true, scores: h.scores === true, identity: h.identity === true, logs: h.logs === true };
  if ('cap' in h) return randWalk(st, world, em, mode, h.cap as number, h.seed as number, dieSeed);
  return traceWalk(st, world, em, h.depth as number, h.turns as number, (h.idle as string | null) ?? null, mode);
}

export function compareFile(file: string): CompareResult {
  const ref = readJsonl(file);
  const ours = replay(ref);
  const n = Math.max(ref.length, ours.length);
  for (let i = 0; i < n; i++) {
    const diffs = i >= ref.length ? ['enregistrement en trop chez nous'] : i >= ours.length ? ['enregistrement manquant chez nous'] : diffJson(ours[i], ref[i]);
    if (diffs.length > 0) return { file, ok: false, records: ref.length, firstDivergence: { index: i, diffs: diffs.slice(0, 12) } };
  }
  return { file, ok: true, records: ref.length };
}

declare const require: { main: unknown };
declare const module: unknown;
if (require.main === module) {
  const files = process.argv.slice(2);
  let ok = 0;
  let ko = 0;
  const t0 = Date.now();
  for (const f of files) {
    let r: CompareResult;
    try {
      r = compareFile(f);
    } catch (e) {
      r = { file: f, ok: false, records: 0, firstDivergence: { index: -1, diffs: [String(e instanceof Error ? e.stack : e)] } };
    }
    if (r.ok) ok++;
    else {
      ko++;
      if (ko <= 5) console.log(`DIVERGENT ${r.file} @${r.firstDivergence?.index}\n  ${r.firstDivergence?.diffs.join('\n  ')}`);
    }
  }
  console.log(`${ok} identiques, ${ko} divergentes (${files.length} parties, ${Date.now() - t0} ms)`);
  if (ko > 0) process.exitCode = 1;
}
