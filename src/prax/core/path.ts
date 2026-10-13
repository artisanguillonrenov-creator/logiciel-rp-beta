/**
 * Chemins compilés et l'UNIQUE tokeniseur — la frontière d'écriture où une
 * phrase devient une suite de segments. Un chemin est une suite de noms
 * séparés par `.` (descente ordinaire, multi-valuée) ou `!` (exclusion : le
 * parent a exactement un enfant). Les requêtes traitent `.` et `!` de la même
 * façon ; la distinction est conservée ici (le masque d'exclusion) pour que la
 * base reste un modèle fidèle de la logique d'exclusion.
 *
 * Reprend `prax-core/src/path.rs` (Prax, BSD-3-Clause). Différence
 * d'adaptation : pas d'interneur — les segments restent des chaînes JavaScript.
 */
import { worldErrors } from './errors';

const MAX_SEGMENTS = 32;

/** Un chemin tokenisé : segments + masque (bit i = le séparateur APRÈS le segment i est `!`). */
export interface CompiledPath {
  readonly segs: readonly string[];
  readonly excl: number;
}

export function isExclAfter(p: CompiledPath, i: number): boolean {
  return (p.excl & (1 << i)) !== 0;
}

function trimWs(s: string): string {
  let a = 0;
  let b = s.length;
  const ws = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
  while (a < b && ws(s[a])) a++;
  while (b > a && ws(s[b - 1])) b--;
  return s.slice(a, b);
}

/**
 * Parcourt les paires nom/séparateur d'une phrase (le séparateur qui SUIT le
 * nom). Une phrase finissant par un opérateur est refusée bruyamment.
 */
function scanTokens(sentence: string, emit: (name: string, op: string | null) => void): void {
  const trimmed = trimWs(sentence);
  if (trimmed.length === 0) return;
  let start = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '.' || ch === '!') {
      if (i + 1 === trimmed.length) throw worldErrors.trailingOperator(sentence, ch);
      emit(trimmed.slice(start, i), ch);
      start = i + 1;
    }
  }
  emit(trimmed.slice(start), null);
}

const tokenCache = new Map<string, CompiledPath>();

/** Tokenise une phrase en chemin compilé (mis en cache : les phrases sont immuables). */
export function tokenize(sentence: string): CompiledPath {
  const hit = tokenCache.get(sentence);
  if (hit !== undefined) return hit;
  const segs: string[] = [];
  let excl = 0;
  scanTokens(sentence, (name, op) => {
    if (segs.length >= MAX_SEGMENTS) throw worldErrors.pathTooLong(sentence, segs.length + 1);
    if (op === '!') excl |= 1 << segs.length;
    segs.push(name);
  });
  const p: CompiledPath = { segs, excl };
  if (tokenCache.size > 50000) tokenCache.clear();
  tokenCache.set(sentence, p);
  return p;
}

/** Construit un chemin à partir de segments et d'un masque. */
export function mkPath(segs: readonly string[], excl = 0): CompiledPath {
  return { segs, excl };
}

/**
 * Les noms de segments d'une phrase brute SANS la garde d'opérateur final
 * (renvoie un dernier segment vide). Pour les gardes d'écriture qui doivent
 * rester infaillibles. Voir `segmentNamesChecked` pour la version gardée.
 */
export function segmentNames(sentence: string): string[] {
  const t = trimWs(sentence);
  if (t.length === 0) return [];
  return t.split(/[.!]/);
}

/** Les noms de segments d'une phrase, garde comprise (`Prax.Db.pathNames`). */
export function segmentNamesChecked(sentence: string): string[] {
  const out: string[] = [];
  scanTokens(sentence, (name) => out.push(name));
  return out;
}

/** Chaque nom avec l'opérateur qui le suit (`Prax.Db.tokens`), garde comprise. */
export function segmentTokensChecked(sentence: string): Array<[string, string | null]> {
  const out: Array<[string, string | null]> = [];
  scanTokens(sentence, (name, op) => out.push([name, op]));
  return out;
}

/** Inverse de `segmentTokensChecked`. */
export function tokensToSentence(tokens: ReadonlyArray<readonly [string, string | null]>): string {
  let out = '';
  for (const [name, op] of tokens) {
    out += name;
    if (op !== null) out += op;
  }
  return out;
}

/** Rend un chemin compilé en phrase étiquetée (`!`/`.` préservés). */
export function renderPath(p: CompiledPath): string {
  const n = p.segs.length;
  let out = '';
  for (let i = 0; i < n; i++) {
    out += p.segs[i];
    if (i + 1 < n) out += isExclAfter(p, i) ? '!' : '.';
  }
  return out;
}

/** Égalité structurelle de deux chemins. */
export function pathEq(a: CompiledPath, b: CompiledPath): boolean {
  if (a.excl !== b.excl || a.segs.length !== b.segs.length) return false;
  for (let i = 0; i < a.segs.length; i++) if (a.segs[i] !== b.segs[i]) return false;
  return true;
}
