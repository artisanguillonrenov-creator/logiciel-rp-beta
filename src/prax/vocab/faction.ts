/**
 * Factions : une seule colonne d'appartenance (v31). L'appartenance est un fait
 * de base à emplacement unique — `member.<qui>!<faction>` — et le `!` EST la
 * sémantique : rejoindre, faire défection, entrer par mariage, c'est la même
 * réécriture exclusive. `comrades` en dérive des alliances.
 *
 * Reprend `prax-vocab/src/faction.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from '../core/errors';
import { segmentNamesChecked } from '../core/path';
import { matches, neq } from '../core/query';
import { Axiom, Outcome, authoredPatClash, axiom, insert } from '../core/types';
import { isVariableName } from '../core/util';

export const badSegment = (n: string): boolean => n.length === 0 || n.includes('.') || n.includes('!');

export function memberPath(who: string, faction: string): string {
  if (badSegment(who) || badSegment(faction)) throw worldErrors.notASinglePathSegment('Faction.member_path', badSegment(who) ? who : faction);
  return `member.${who}!${faction}`;
}

/** Rejoindre (ou faire défection, ou entrer par mariage) : une réécriture exclusive. */
export function joins(who: string, faction: string): Outcome {
  return insert(memberPath(who, faction));
}

/** L'appartenance partagée dérive l'alliance. */
export function comrades(): Axiom {
  return axiom([matches('member.X!F'), matches('member.Y!F'), neq('X', 'Y')], ['allied.X.Y']);
}

/**
 * Position de faction conditionnée par la croyance : une offense contre un
 * membre de ma faction, QUE JE CROIS ARRIVÉE, me fait considérer l'offenseur.
 * Première variable du motif = l'offenseur, seconde = la victime.
 */
export function factionStanding(pat: string, label: string): Axiom {
  const names = segmentNamesChecked(pat);
  const vars = names.filter((n) => isVariableName(n));
  if (vars.length < 2) throw worldErrors.patternVariables('Faction.faction_standing', pat, 'name an offender and a victim variable, in that order');
  const [offender, victim] = vars;
  const clash = authoredPatClash([], names)[0];
  if (clash !== undefined) throw worldErrors.reservedVarClash('Faction.faction_standing', clash, " -- it is reserved for the axiom's own join variables");
  return axiom(
    [matches(`PraxW.believes.${pat}`), matches(`member.${victim}!PraxF`), matches('member.PraxW!PraxF'), neq('PraxW', offender)],
    [`regards.PraxW.${offender}.${label}`],
  );
}
