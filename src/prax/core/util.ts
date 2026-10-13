/**
 * Petits outils partagés par tout le moteur Prax.
 *
 * Le déterminisme est une exigence centrale de Prax (« contrat de
 * déterminisme ») : chaque énumération observable se fait dans l'ordre des
 * noms, jamais dans un ordre accidentel. On fournit donc ici une comparaison de
 * chaînes explicite et un tri stable maison, identiques sur Node, Hermes et
 * n'importe quel moteur JavaScript.
 */

/** Ordre total des chaînes (unités UTF-16 ; identique à l'ordre octet pour l'ASCII). */
export function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Tri STABLE (fusion) renvoyant un nouveau tableau. On ne dépend pas de la
 * stabilité de `Array.prototype.sort` du moteur hôte : l'ordre des égalités
 * fait partie du contrat (bris d'égalité du planificateur, etc.).
 */
export function stableSort<T>(xs: readonly T[], cmp: (a: T, b: T) => number): T[] {
  const n = xs.length;
  if (n < 2) return xs.slice();
  let src = xs.slice();
  let dst = new Array<T>(n);
  for (let width = 1; width < n; width *= 2) {
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width, n);
      const hi = Math.min(lo + 2 * width, n);
      let i = lo;
      let j = mid;
      let k = lo;
      while (i < mid && j < hi) {
        if (cmp(src[j], src[i]) < 0) dst[k++] = src[j++];
        else dst[k++] = src[i++];
      }
      while (i < mid) dst[k++] = src[i++];
      while (j < hi) dst[k++] = src[j++];
    }
    const t = src;
    src = dst;
    dst = t;
  }
  return src;
}

/** Tri stable de chaînes dans l'ordre des noms. */
export function sortStrings(xs: readonly string[]): string[] {
  return stableSort(xs, cmpStr);
}

/** Supprime les doublons consécutifs (après tri), comme `Vec::dedup`. */
export function dedupSorted(xs: string[]): string[] {
  const out: string[] = [];
  for (const x of xs) if (out.length === 0 || out[out.length - 1] !== x) out.push(x);
  return out;
}

const varCache = new Map<string, boolean>();

/**
 * Un segment est une variable logique ssi son premier caractère est une
 * majuscule (convention Prax). Le segment vide est une constante.
 */
export function isVariableName(name: string): boolean {
  if (name.length === 0) return false;
  const c = name.charCodeAt(0);
  if (c < 128) return c >= 65 && c <= 90;
  let v = varCache.get(name);
  if (v === undefined) {
    const ch = String.fromCodePoint(name.codePointAt(0) as number);
    v = ch !== ch.toLowerCase() && ch === ch.toUpperCase();
    varCache.set(name, v);
  }
  return v;
}

/** Égalité de deux tableaux de chaînes. */
export function strArrEq(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Les clés d'une Map, triées par nom (l'ordre d'un `BTreeMap<String, _>`). */
export function sortedKeys<V>(m: ReadonlyMap<string, V>): string[] {
  return sortStrings([...m.keys()]);
}

/** Un entier JavaScript sûr, sinon erreur bruyante (l'équivalent des i64 vérifiés). */
export function checkedInt(n: number, ctx: string): number {
  if (!Number.isSafeInteger(n)) throw new Error(`Prax : dépassement arithmétique (${ctx})`);
  return n;
}
