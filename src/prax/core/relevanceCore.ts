/**
 * Les deux primitives de pertinence que le routeur du moteur utilise à chaud :
 * `mayUnifySyms` (un delta peut-il toucher un motif ?) et
 * `evictionShadowNames` (les « ombres » d'une insertion exclusive).
 *
 * Reprend la tête de `prax-core/src/relevance.rs` (Prax, BSD-3-Clause).
 */
import { CompiledPath, isExclAfter } from './path';
import { isVariableName } from './util';

/**
 * Une instance d'un motif pourrait-elle être une instance (ou un
 * préfixe/prolongement) de l'autre ? Il faut au moins un segment LITTÉRAL
 * commun dans la zone qui se recouvre.
 */
export function mayUnifySyms(a: readonly string[], b: readonly string[]): boolean {
  const n = a.length < b.length ? a.length : b.length;
  let anchored = false;
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    const xv = isVariableName(x);
    const yv = isVariableName(y);
    if (!xv && !yv) {
      if (x !== y) return false;
      anchored = true;
    }
  }
  return anchored;
}

/** Les ombres d'éviction d'une insertion exclusive : une par opérateur `!`. */
export function evictionShadowNames(path: CompiledPath): string[][] {
  const out: string[][] = [];
  for (let j = 0; j < path.segs.length; j++) {
    if (isExclAfter(path, j)) {
      const shadow = path.segs.slice(0, j + 1);
      shadow.push('PraxEvicted');
      out.push(shadow);
    }
  }
  return out;
}
