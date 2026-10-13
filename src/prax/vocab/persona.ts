/**
 * La personnalité comme conduite, pas comme but (v25). Un trait est un
 * ensemble nommé de désirs (surtout négatifs) sur les PROPRES marques de
 * conduite du porteur — `honest` coûte par mensonge, sans l'interdire.
 *
 * Reprend `prax-vocab/src/persona.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from '../core/errors';
import { matches } from '../core/query';
import { Axiom, Character, Desire, Outcome, axiom, insert } from '../core/types';

export interface Trait {
  readonly name: string;
  readonly desires: readonly Desire[];
}

export function trait(name: string, desires: readonly Desire[]): Trait {
  return { name, desires };
}

/** Les désirs qu'une liste de traits apporte au vocabulaire du monde (noms uniques). */
export function personaVocabulary(traits: readonly Trait[]): Desire[] {
  const ds = traits.flatMap((t) => t.desires);
  const seen = new Set<string>();
  for (const d of ds) {
    if (seen.has(d.name)) throw worldErrors.notASinglePathSegment('Persona.persona_vocabulary: duplicate desire name', d.name);
    seen.add(d.name);
  }
  return ds;
}

/** Dote un personnage d'un trait. */
export function bearing(t: Trait, c: Character): Character {
  return { ...c, desires: [...c.desires, ...t.desires.map((d) => d.name)] };
}

/** Le tempérament se lit sur le visage : chacun présume les valeurs de conduite du porteur. */
export function transparent(): Axiom {
  return axiom([matches('trait.M.T'), matches('traitDesire.T.D'), matches('character.P')], ['P.believes.desires.M.D.presumed']);
}

/** Assemblage déterministe d'une distribution, plus les faits de mise en place lus par `transparent`. */
export function cast(traits: readonly Trait[], roster: ReadonlyArray<readonly [Character, readonly Trait[]]>): [Character[], Outcome[]] {
  const tnames = traits.map((t) => t.name);
  const bad = tnames.find((n) => n.length === 0 || n.includes('.') || n.includes('!'));
  if (bad !== undefined) throw worldErrors.notASinglePathSegment('Persona.cast: trait name', bad);
  const seen = new Set<string>();
  for (const n of tnames) {
    if (seen.has(n)) throw worldErrors.notASinglePathSegment('Persona.cast: duplicate trait', n);
    seen.add(n);
  }
  for (const [, ts] of roster)
    for (const t of ts)
      if (!tnames.includes(t.name))
        throw worldErrors.notASinglePathSegment('Persona.cast: trait is borne but not in the trait list (its valuations would be silently illegible)', t.name);
  const members = roster.map(([c, ts]) => ts.reduce((acc, t) => bearing(t, acc), c));
  const outs: Outcome[] = [];
  for (const t of traits) for (const d of t.desires) outs.push(insert(`traitDesire.${t.name}.${d.name}`));
  for (const [c] of roster) outs.push(insert(`character.${c.name}`));
  for (const [c, ts] of roster) for (const t of ts) outs.push(insert(`trait.${c.name}.${t.name}`));
  return [members, outs];
}
