/**
 * Constantes de vocabulaire que le vérificateur de types doit voir (sans cycle
 * d'import) : la tête d'obligation, le préfixe □-relevé, le préfixe des désirs
 * punitifs. Reprend `prax-core/src/vocab_consts.rs` (Prax, BSD-3-Clause).
 */
export const OBLIGED_HEAD = 'obliged';
export const OBLIGED_LIFT_PREFIX = 'obliged.Obligor.';
export const PUNITIVE_PREFIX = 'punishes-';

/** Le chemin d'une obligation : `obliged.<qui>.<contenu>`. */
export function obligationPath(who: string, content: string): string {
  return `${OBLIGED_HEAD}.${who}.${content}`;
}
